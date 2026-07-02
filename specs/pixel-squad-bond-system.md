# pixel-squad — 角色關係系統（羈絆與援護攻擊）

## Goal

Squad members accumulate a persistent **bond value** with each other by surviving battles together, and once a pair's bond crosses a threshold, the higher-bonded ally has a chance to automatically join in on an attack as a **support attack (援護攻擊)**.

## Rules

1. **Bond storage**: `GameState.bondLevels?: Record<string, number>`, keyed by a canonical pair key built from the two characters' `templateId`s (order-independent — `bondKey('rex','nyx') === bondKey('nyx','rex')`). Missing key = bond `0`. Missing `bondLevels` on a legacy save = treat as `{}` (never throw).
2. **Bond gain**: On victory only, for every unique pair of characters in the post-battle `playerParty` that are **both `alive === true`** at the end of the battle, add `BOND_GAIN_PER_BATTLE` (4) to that pair's bond value. Characters who were KO'd during the battle gain no bond with anyone that battle. This runs inside `VictoryProcessor.processVictory`.
3. **Support-attack chance** is a step function of the bond value between the attacker and the candidate supporter (see `BOND_TIERS` in Data Model). Below 20 bond, chance is 0 (support attack never triggers) — bonds ramp up gradually, so newly-formed squads see no support attacks until they've fought together a few times.
4. **Trigger point**: only for player-side, damage-dealing actions that resolve in `executePlayerCommand`'s final block — plain `attack` or an `attack`-type skill against an enemy. Heal, buff, defend, and 勸降 never trigger a support attack. Enemy actions and boss actions never trigger one (bonds are a player-squad-only mechanic).
5. **Eligible supporter**: the alive squad member with the **highest bond** to the attacker, excluding the attacker itself and anyone who already performed a support attack this round (`supportUsedThisRound`). Ties break by squad array order (first match wins) for determinism. If no eligible supporter exists (solo squad, or everyone already used their support this round), nothing happens.
6. **Survival gate**: the support attack only fires if the original hit **did not kill the target** (checked via `target.alive` once the primary hit's animation/damage has resolved). No follow-up on an already-dead enemy — mirrors the existing weakness-bonus-action guard in `TurnEngine.applyWeaknessBonus`.
7. **Support damage**: `floor(calcDamage(supporter, defender).damage * 0.6)`, minimum 1. Reuses the existing `calcDamage` (archetype multipliers, `defending` halving) rather than duplicating damage math. Never crits, never applies elemental weakness bonuses, never applies status effects — it's a plain follow-up strike.
8. **No extra turn cost**: the support attack does not touch the turn queue and does not cost the supporter their own upcoming turn — it resolves as a side effect of the attacker's action, then the attacker's normal `next()` (AOA check / battle-end check / turn advance) proceeds exactly as it does today.
9. **Round-scoping**: `supportUsedThisRound` is reset to `false` for all characters at the start of every command phase (`startCommandPhase`), independent of the existing `resetRoundFlags` (which stays untouched — do not add bond fields to it, to avoid touching its existing test contract). Add a sibling reset call.
10. **`processVictory` signature**: add `playerParty: Character[] = []` as a new **8th, final** parameter (after `alliesSurvived`). Do not insert it earlier in the parameter list.

## Data model changes

`src/types.ts`:

```ts
export interface Character {
  // ...existing fields unchanged...
  /** True if this character already performed a support attack this round (bond system). */
  supportUsedThisRound?: boolean;
}

export interface GameState {
  // ...existing fields unchanged...
  /** key = bondKey(templateIdA, templateIdB); value = accumulated bond points between that pair. */
  bondLevels?: Record<string, number>;
}
```

New module `src/battle/BondSystem.ts`:

```ts
import type { Character } from '../types';
import { calcDamage } from './DamageCalc';

export const BOND_GAIN_PER_BATTLE = 4;
const SUPPORT_DAMAGE_MULTIPLIER = 0.6;

const BOND_TIERS: Array<{ min: number; chance: number }> = [
  { min: 80, chance: 0.5 },
  { min: 50, chance: 0.3 },
  { min: 20, chance: 0.15 },
  { min: 0, chance: 0 },
];

export function bondKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('_');
}

export function getBond(bondLevels: Record<string, number> | undefined, idA: string, idB: string): number {
  if (!bondLevels) return 0;
  return bondLevels[bondKey(idA, idB)] ?? 0;
}

export function supportChance(bond: number): number {
  return (BOND_TIERS.find(t => bond >= t.min) ?? BOND_TIERS[BOND_TIERS.length - 1]).chance;
}

/** Adds BOND_GAIN_PER_BATTLE to every unique pair of alive characters in `party`. Returns a new record; never mutates the input. */
export function applyBondGains(
  bondLevels: Record<string, number> | undefined,
  party: Character[],
): Record<string, number> {
  const result = { ...(bondLevels ?? {}) };
  const survivors = party.filter(c => c.alive);
  for (let i = 0; i < survivors.length; i++) {
    for (let j = i + 1; j < survivors.length; j++) {
      const key = bondKey(survivors[i].templateId, survivors[j].templateId);
      result[key] = (result[key] ?? 0) + BOND_GAIN_PER_BATTLE;
    }
  }
  return result;
}

/** Highest-bond alive candidate for `attacker`, excluding itself and anyone with supportUsedThisRound. Ties -> first in `squad` order. */
export function pickSupporter(
  attacker: Character,
  squad: Character[],
  bondLevels: Record<string, number> | undefined,
): Character | undefined {
  let best: Character | undefined;
  let bestBond = -1;
  for (const candidate of squad) {
    if (candidate.id === attacker.id || !candidate.alive || candidate.supportUsedThisRound) continue;
    const bond = getBond(bondLevels, attacker.templateId, candidate.templateId);
    if (bond > bestBond) { bestBond = bond; best = candidate; }
  }
  return best;
}

export function rollSupportAttack(bond: number): boolean {
  return Math.random() < supportChance(bond);
}

/** floor(calcDamage(supporter, defender).damage * 0.6), minimum 1. No crit, no weakness bonus, no status. */
export function calcSupportDamage(supporter: Character, defender: Character): number {
  return Math.max(1, Math.floor(calcDamage(supporter, defender).damage * SUPPORT_DAMAGE_MULTIPLIER));
}

/** Resets supportUsedThisRound on all given characters. Call once per command phase. */
export function resetSupportRoundFlags(characters: Character[]): void {
  for (const c of characters) c.supportUsedThisRound = false;
}
```

`src/battle/VictoryProcessor.ts` — `processVictory` gains the 8th parameter and, near the existing `bestStarRatings`/`perfectClearStageIds` block, applies bond gains:

```ts
export function processVictory(
  gameState: GameState,
  stage: Stage,
  expGained: number,
  recruitedEnemy: Character | undefined,
  ngPlusCycle = 0,
  starRating = 1,
  alliesSurvived = false,
  playerParty: Character[] = [],
): GameState {
  // ...existing body...
  state.bondLevels = applyBondGains(gameState.bondLevels, playerParty);
  // ...
}
```

`src/scenes/ResultScene.ts` passes the battle's final `playerParty` through:

```ts
updatedGameState = processVictory(gameState, stage, expGained, recruitedEnemy, undefined, starRating, alliesSurvived, playerParty);
```

## UI changes

**BattleScene** (`src/scenes/BattleScene.ts`): no new visual elements — support attacks reuse the existing combat-log line via `applyDamageAndAdvance`, the same way boss `連擊①`/`連擊②` combo hits already do. In `executePlayerCommand`, the final damage-resolution block changes from:

```ts
applyWeaknessBonus(cmd.character, hpAfterHit, dmgResult.isWeaknessHit, queue);

this.applyDamageAndAdvance(cmd.character, target, dmgResult.damage, skill?.name, next, isCrit, skill?.appliesStatus, skill?.id);
```

to:

```ts
applyWeaknessBonus(cmd.character, hpAfterHit, dmgResult.isWeaknessHit, queue);

const finalTarget = target;
const afterPrimaryHit = () => {
  if (!finalTarget.alive) { next(); return; }
  const supporter = pickSupporter(cmd.character, this.playerParty, this.gameState?.bondLevels);
  if (!supporter) { next(); return; }
  const bond = getBond(this.gameState?.bondLevels, cmd.character.templateId, supporter.templateId);
  if (!rollSupportAttack(bond)) { next(); return; }
  supporter.supportUsedThisRound = true;
  const supportDmg = calcSupportDamage(supporter, finalTarget);
  this.applyDamageAndAdvance(supporter, finalTarget, supportDmg, '援護攻擊', next);
};

this.applyDamageAndAdvance(cmd.character, target, dmgResult.damage, skill?.name, afterPrimaryHit, isCrit, skill?.appliesStatus, skill?.id);
```

`startCommandPhase()` gains one call alongside the existing `resetRoundFlags(...)`:

```ts
resetRoundFlags([...this.playerParty, ...this.enemyParty]);
resetSupportRoundFlags(this.playerParty);
resetAoaRoundState(this.aoaState);
```

Imports to add at the top of `BattleScene.ts`: `pickSupporter, getBond, rollSupportAttack, calcSupportDamage, resetSupportRoundFlags` from `../battle/BondSystem`.

No changes to `PrepScene.ts` / `BaseScene.ts` squad cards — bond values stay backstage for this iteration (a future backlog item can surface a bond indicator once players have asked for it).

## Acceptance criteria

- **AC-1**: `bondKey('rex', 'nyx')` and `bondKey('nyx', 'rex')` return the same string.
- **AC-2**: `getBond(undefined, 'a', 'b')` returns `0` without throwing.
- **AC-3**: `supportChance(0)` → `0`; `supportChance(19)` → `0`; `supportChance(20)` → `0.15`; `supportChance(49)` → `0.15`; `supportChance(50)` → `0.3`; `supportChance(79)` → `0.3`; `supportChance(80)` → `0.5`; `supportChance(1000)` → `0.5`.
- **AC-4**: `applyBondGains({}, [alive A, alive B, alive C])` produces bond `4` for all three pairs (A-B, A-C, B-C).
- **AC-5**: `applyBondGains({}, [alive A, dead B])` produces no entry for the A-B pair (KO'd member earns no bond that battle).
- **AC-6**: `applyBondGains` does not mutate the `bondLevels` object passed in (returns a new object; original reference's keys are unchanged after the call).
- **AC-7**: `pickSupporter` excludes the attacker itself, dead squad members, and anyone with `supportUsedThisRound: true`; among remaining candidates it picks the one with the highest bond to the attacker; ties resolve to whichever candidate appears first in the `squad` array.
- **AC-8**: `pickSupporter` returns `undefined` when the squad has no eligible candidate (e.g., a 1-character squad, or every other member already used their support this round).
- **AC-9**: `calcSupportDamage(supporter, defender)` equals `Math.max(1, Math.floor(calcDamage(supporter, defender).damage * 0.6))`.
- **AC-10**: `resetSupportRoundFlags([a, b])` sets `supportUsedThisRound = false` on both, regardless of prior value.
- **AC-11**: `processVictory(...)` called with a `playerParty` of 3 all-alive characters returns `state.bondLevels` containing all 3 pair keys incremented by 4 over whatever `gameState.bondLevels` held before the call.
- **AC-12**: `processVictory(...)` called with no 8th argument (legacy call site) does not throw and leaves `bondLevels` equal to the input `gameState.bondLevels` (empty `playerParty` default means `applyBondGains` adds no new pairs).
- **AC-13** (BattleScene wiring, source-level assertion): `executePlayerCommand`'s final damage block calls `pickSupporter`, and the resulting supporter-triggered call to `applyDamageAndAdvance` only happens inside a branch guarded by `finalTarget.alive` — i.e., a killing blow on the primary attack never reaches `pickSupporter`.
- **AC-14** (BattleScene wiring): `startCommandPhase` calls `resetSupportRoundFlags(this.playerParty)` alongside the existing `resetRoundFlags(...)` call.
- **AC-15**: existing `TurnEngine`, `AllOutAttack`, `VictoryProcessor`, and `BattleScene` wiring test suites all continue to pass unmodified (no field added to `resetRoundFlags`, no altered parameter order on `processVictory`'s existing 7 parameters).

## Test plan

- `tests/unit/BondSystem.test.ts` — pure-function coverage for AC-1 through AC-10 (`bondKey`, `getBond`, `supportChance` tier boundaries, `applyBondGains` immutability/pairing/KO-exclusion, `pickSupporter` selection/tie-break/empty-candidate cases, `calcSupportDamage`, `resetSupportRoundFlags`).
- `tests/unit/VictoryProcessor.bondGains.test.ts` — AC-11, AC-12, following the existing `makeGameState`/`makeStage` helper pattern used in `VictoryProcessor.perfectClear.test.ts`.
- `tests/unit/BattleScene.bondWiring.test.ts` — AC-13, AC-14, source-text assertions in the same style as `BattleScene.aoaWiring.test.ts` (Phaser scenes can't be instantiated under vitest, so wiring is verified by asserting the call sites and guard ordering exist in the compiled method body).
- Run the full existing suite (`npm test` under `workspace-pixel-squad`) to confirm AC-15.
