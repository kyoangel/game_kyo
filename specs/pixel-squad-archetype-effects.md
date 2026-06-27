# Spec: Archetype 效果（坦克減傷、狙擊暴擊等）

## Goal

Give each `ArchetypeLabel` (`坦克` / `輸出` / `狙擊` / `輔助` / `全能`) a real passive combat effect, so the label shown in `BaseScene`/`BattleScene` is more than cosmetic.

## Current state (for context)

- `ArchetypeLabel` is computed automatically from a character's raw `StatBlock` by `computeArchetype()` (`src/battle/Archetype.ts`) — it is **not** manually assigned and **not** stored per `CharacterTemplate`. It is recomputed in `createCharacter`/`createEnemy` (`src/battle/CharacterFactory.ts`) every time an instance is built (covers level-ups changing the dominant stat).
- `Character.archetype` exists today only as a display field: `BaseScene.ts:99` and `BattleScene.ts:160` render it as text. No code branches on its value.
- `calcDamage` (`src/battle/DamageCalc.ts`) does `effectiveAtk(attacker) * multiplier - effectiveDef(defender) * 0.5`, floors to a minimum of 1, then halves (rounded up) if `defender.defending`.
- `calcHeal` does `effectiveAtk(caster) * skill.multiplier`, floored to minimum 1.
- `applyBuff` (`src/battle/Buffs.ts`) writes `skill.buffAmountPct` verbatim into the target's `ActiveBuff` — it has no caster context today (called as `applyBuff(target, skill)`).
- `effectiveAtk`/`effectiveDef`/`effectiveSpd` (`src/battle/Buffs.ts`) already centralize "base stat + active buff" math — every damage/heal/turn-order/AI call site goes through them, so they are the right place to add an archetype-driven stat modifier without touching call sites.
- RNG-based mechanics in this codebase use plain `Math.random()` in a small dedicated pure function (e.g. `RecruitSystem.attemptRecruit(chance)`), keeping the deterministic math (`recruitChance`) separately testable. Crit should follow the same split: a deterministic damage formula that accepts a `isCrit: boolean`, plus a separate `rollCrit()` that calls `Math.random()`.

## Rules

Each archetype gets exactly one passive effect. Effects are multiplicative and stack with existing mechanics (buffs, defending, skill multipliers) in the order specified below — no archetype effect disables or replaces an existing mechanic.

1. **坦克 (Tank) — damage reduction.** Any damage this character receives (as `defender` in `calcDamage`, from any attacker/skill) is multiplied by `0.85` (-15%) before the existing `defending` halving is applied. Applies to both basic attacks and `attack`-type skills aimed at them; does not affect heal amounts received.
2. **輸出 (DPS) — bonus damage dealt.** Any damage this character deals (as `attacker` in `calcDamage`) is multiplied by `1.1` (+10%) before flooring. Stacks with Tank's reduction multiplicatively if a DPS attacks a Tank (`1.1 * 0.85`).
3. **狙擊 (Sniper) — crit chance.** When a 狙擊 character performs a basic attack or an `attack`-type skill, there is a `20%` chance (rolled once per action via `rollCrit`) the hit is a critical: damage is further multiplied by `1.5`. Crit never applies to `heal` or `buff` actions (no roll is made for them). Crit chance does not stack with or get boosted by anything else in this spec.
4. **輔助 (Support) — heal/buff potency.** When a 輔助 character casts a `heal` skill, `calcHeal`'s result is multiplied by `1.2` (+20%). When a 輔助 character casts a `buff` skill, the buff's `amountPct` actually applied (stored in the resulting `ActiveBuff`) is multiplied by `1.2` before being written — i.e. a +30% ATK buff cast by a 輔助 character grants +36% ATK. This does not change `buffDuration`. A non-輔助 caster applies buffs at their printed `amountPct`, unchanged from today.
5. **全能 (All-rounder) — small all-stat boost.** This character's `effectiveAtk`, `effectiveDef`, and `effectiveSpd` are each multiplied by an additional `1.05` (+5%), applied *after* any active buff multiplier (e.g. base 100 ATK + buff +30% + all-rounder +5% = `100 * 1.3 * 1.05 = 136.5`). This is the only archetype effect that flows through the existing `effectiveAtk/Def/Spd` helpers rather than `calcDamage`/`calcHeal`/`applyBuff` directly, since it must also affect turn order (`computeTurnOrder` uses `effectiveSpd`) and enemy AI targeting (`chooseTarget`'s `highest-atk` mode uses `effectiveAtk`).

### Ordering inside `calcDamage`

```
raw = effectiveAtk(attacker) * skillMultiplier - effectiveDef(defender) * 0.5
raw *= attackerArchetypeDamageDealtMult   // 輸出: 1.1, else 1.0
raw *= defenderArchetypeDamageTakenMult   // 坦克: 0.85, else 1.0
if isCrit: raw *= 1.5                     // 狙擊 only, see rollCrit
base = max(1, floor(raw))
if defender.defending: base = max(1, ceil(base / 2))
```

### Edge cases

- An archetype is derived from current stats, so a level-up that shifts a character's dominant stat can change their archetype (and thus their passive) between battles — this already happens today for the label; this spec makes it mechanically meaningful but introduces no new volatility.
- A 坦克 that is also `defending` gets both reductions (15% archetype + 50% defend), applied in the fixed order above (archetype reduction first, then defend halving) — this order is decided, not left ambiguous, so the two `DamageCalc.test.ts`-style fixed-number tests stay exact.
- Recruit-attempt counterattacks (`BattleScene.attemptRecruitAction`, `calcDamage(enemy, target)`) and boss multi-hit actions go through the same `calcDamage`, so archetype effects apply there with no special-casing needed.
- Crit is rolled once per `calcDamage` call site that represents a single hit; multi-hit boss actions that call `calcDamage` multiple times roll once per hit (each call site already loops per hit today).
- Heal/buff potency (輔助) only depends on the **caster's** archetype, never the target's.

## Data model changes

New file `src/battle/ArchetypeEffects.ts`:

```ts
import type { ArchetypeLabel, Character } from '../types';

export const ARCHETYPE_DAMAGE_DEALT_MULT: Record<ArchetypeLabel, number> = {
  '坦克': 1.0,
  '輸出': 1.1,
  '狙擊': 1.0,
  '輔助': 1.0,
  '全能': 1.0,
};

export const ARCHETYPE_DAMAGE_TAKEN_MULT: Record<ArchetypeLabel, number> = {
  '坦克': 0.85,
  '輸出': 1.0,
  '狙擊': 1.0,
  '輔助': 1.0,
  '全能': 1.0,
};

export const SNIPER_CRIT_CHANCE = 0.2;
export const SNIPER_CRIT_MULTIPLIER = 1.5;

export const ARCHETYPE_SUPPORT_POTENCY_MULT: Record<ArchetypeLabel, number> = {
  '坦克': 1.0,
  '輸出': 1.0,
  '狙擊': 1.0,
  '輔助': 1.2,
  '全能': 1.0,
};

export const ALL_ROUNDER_STAT_MULT = 1.05;

/** Rolls whether `attacker`'s next basic attack / attack-skill is a critical hit. Only 狙擊 has nonzero chance. */
export function rollCrit(attacker: Character): boolean {
  if (attacker.archetype !== '狙擊') return false;
  return Math.random() < SNIPER_CRIT_CHANCE;
}
```

`src/battle/DamageCalc.ts` — `calcDamage` gains an `isCrit` parameter and applies the dealt/taken multipliers:

```ts
export function calcDamage(attacker: Character, defender: Character, skill?: Skill, isCrit = false): number {
  const multiplier = skill?.type === 'attack' ? skill.multiplier : 1.0;
  let raw = effectiveAtk(attacker) * multiplier - effectiveDef(defender) * 0.5;
  raw *= ARCHETYPE_DAMAGE_DEALT_MULT[attacker.archetype];
  raw *= ARCHETYPE_DAMAGE_TAKEN_MULT[defender.archetype];
  if (isCrit) raw *= SNIPER_CRIT_MULTIPLIER;
  const base = Math.max(1, Math.floor(raw));
  if (defender.defending) return Math.max(1, Math.ceil(base / 2));
  return base;
}
```

`calcHeal` gains the support potency multiplier:

```ts
export function calcHeal(caster: Character, skill: Skill): number {
  const potency = ARCHETYPE_SUPPORT_POTENCY_MULT[caster.archetype];
  return Math.max(1, Math.floor(effectiveAtk(caster) * skill.multiplier * potency));
}
```

`src/battle/Buffs.ts`:
- `effectiveStat` multiplies by `ALL_ROUNDER_STAT_MULT` when `c.archetype === '全能'`, after the existing buff multiplier.
- `applyBuff` gains an optional `caster` parameter; when provided and `caster.archetype === '輔助'`, the stored `amountPct` is `skill.buffAmountPct * ARCHETYPE_SUPPORT_POTENCY_MULT['輔助']`:

```ts
export function applyBuff(target: Character, skill: Skill, caster?: Character): void {
  if (!skill.buffStat || skill.buffAmountPct === undefined || skill.buffDuration === undefined) return;
  const potency = caster ? ARCHETYPE_SUPPORT_POTENCY_MULT[caster.archetype] : 1.0;
  const newBuff = {
    stat: skill.buffStat,
    amountPct: skill.buffAmountPct * potency,
    turnsRemaining: skill.buffDuration,
    sourceSkillId: skill.id,
  };
  // ... existing replace/push logic unchanged
}
```

No changes to `types.ts` — `ArchetypeLabel` and `Character.archetype` already exist.

## UI changes

- `BattleScene.ts` (the `[archetype]` text shown per combatant, `BattleScene.ts:160`) gains a one-line tooltip-style suffix on the existing archetype text reflecting the passive, e.g. `[坦克] 減傷15%` / `[輸出] 傷害+10%` / `[狙擊] 暴擊20%` / `[輔助] 治療/增益+20%` / `[全能] 全屬性+5%`. Implemented as a lookup `ARCHETYPE_TOOLTIP: Record<ArchetypeLabel, string>` colocated in `BattleScene.ts` (display-only, not used by combat math).
- When a crit lands, the existing floating damage-number/message path (`applyDamageAndAdvance`) shows the number prefixed with `暴擊!` the same way other one-off combat messages are shown today (no new UI primitive needed).
- `PrepScene`/squad-select screens that already print `${char.archetype}` via `BaseScene.ts:99` are left unchanged (no tooltip there) — keep prep screens uncluttered, full effect detail only needed mid-battle.

## Acceptance criteria

- **Given** a 坦克 character with effective DEF unchanged, **when** an attacker without any archetype bonus deals damage that would otherwise be 100, **then** `calcDamage` returns `floor(100 * 0.85) = 85` (before any `defending` halving).
- **Given** a 輸出 character with effective ATK such that base raw damage would be 100, **when** they attack a non-坦克 target, **then** `calcDamage` returns `floor(100 * 1.1) = 110`.
- **Given** a 輸出 character attacking a 坦克 character where pre-archetype raw damage is 100, **when** `calcDamage` runs, **then** the result is `floor(100 * 1.1 * 0.85) = floor(93.5) = 93`.
- **Given** a 狙擊 character performing a basic attack, **when** `rollCrit` returns `true` and base (pre-crit) damage would be `50`, **then** calling `calcDamage(attacker, defender, undefined, true)` returns `floor(50 * 1.5) = 75`.
- **Given** a non-狙擊 character, **when** `rollCrit` is called any number of times, **then** it always returns `false` (no `Math.random()` call happens for non-snipers — verify via a spy that `Math.random` is not invoked).
- **Given** a 輔助 character casting `field_medic` (multiplier `0.8`) with effective ATK `100`, **when** `calcHeal` runs, **then** it returns `floor(100 * 0.8 * 1.2) = 96` (vs. `80` for a non-輔助 caster).
- **Given** a 輔助 character casting `iron_will` (`buffAmountPct: 0.4`) on an ally, **when** `applyBuff(target, iron_will, supportCaster)` runs, **then** the resulting `ActiveBuff.amountPct` is `0.4 * 1.2 = 0.48`; **given** the same skill cast by a non-輔助 caster or with no caster argument, **then** `amountPct` remains `0.4`.
- **Given** a 全能 character with base ATK `100` and an active `+30%` ATK buff, **when** `effectiveAtk` is called, **then** it returns `100 * 1.3 * 1.05 = 136.5` truncated/floored per the call site's existing rounding (callers already `Math.floor` the final damage/heal, so `effectiveAtk` itself returns the raw float `136.5`).
- **Given** a 全能 character with base SPD `20` and no buffs, **when** `effectiveSpd` is called, **then** it returns `20 * 1.05 = 21`, which `computeTurnOrder` uses for sorting (verify a 全能 character with SPD `20` acts before a non-全能 character with SPD `20.5` only if `20*1.05=21 > 20.5`... use concrete distinct test values to avoid float-equality flakiness, e.g. base SPD 20 vs 21 non-全能).
- **Given** a defending 坦克 character receiving an attack where pre-archetype raw damage is `40`, **when** `calcDamage` runs, **then** archetype reduction applies first (`40 * 0.85 = 34`, floored to `34`) and defend halving applies second (`ceil(34/2) = 17`).

## Implementation notes (non-binding, for the coding agent)

- `BattleScene.ts` call sites that invoke `calcDamage` for basic attacks / attack-skills should call `rollCrit(attacker)` immediately before `calcDamage` and pass the result through; heal/buff call sites (`applyHealAndAdvance`, `applyBuffAndAdvance`) never call `rollCrit`.
- `applyBuffAndAdvance(caster, target, skill, next)` (`BattleScene.ts:680`) should pass `caster` through to `applyBuff(target, skill, caster)` — currently calls `applyBuff(target, skill)` and drops the caster.
- Existing `DamageCalc.test.ts` fixtures all use `archetype: '全能'` characters, whose dealt/taken multipliers are both `1.0` — those tests remain valid unchanged after this spec, since 全能 has no `calcDamage`-level effect (its bonus lives in `effectiveAtk/Def/Spd` instead, and those existing fixtures have no buffs so the 1.05 multiplier would change their expected numbers — **double-check**: 全能's `effectiveAtk`/`effectiveDef` bonus DOES apply even with zero buffs, since it's unconditional on archetype, not on buff presence. This means existing `DamageCalc.test.ts` numbers using `archetype: '全能'` will shift by the 1.05 factor and need updating as part of this implementation — flag this explicitly to the coding agent rather than letting CI catch it as a surprise.
