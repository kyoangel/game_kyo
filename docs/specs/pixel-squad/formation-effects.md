# Spec: 陣型效果（位置 0 前排減傷、位置 4 後排加成）

## Goal

Make a character's slot index in the battle party array (already drawn on-screen as a front-to-back formation) mechanically matter: slot 0 takes less damage, slot 4 deals more damage.

## Current state (for context)

- `Character` (`src/types.ts:49-72`) has no `position`/`slot` field — "position" today is purely the array index of whichever `Character[]` is passed around (`GameState.squad`, `playerParty`, `enemyParty`).
- `BattleScene.ts:153-186` already lays the party out vertically by index with the comment `// Single column — position index i is the formation slot (0=front, 4=back)`, but nothing reads that index for gameplay — it's cosmetic only.
- `GameState.squad: Character[]` (max 5) is ordered by **join order** (`BaseScene.toggleSquad`, `BaseScene.ts:226-237`) — appended on recruit, spliced on remove. There is no squad-reorder UI anywhere in the codebase.
- `calcDamage` (`DamageCalc.ts:10-19`) already layers `ARCHETYPE_DAMAGE_DEALT_MULT` / `ARCHETYPE_DAMAGE_TAKEN_MULT` multiplicatively onto `raw` before flooring, and `effectiveAtk`/`effectiveDef`/`effectiveSpd` (`Buffs.ts`) already layer buff and archetype (`ALL_ROUNDER_STAT_MULT`) multipliers onto base stats. Formation effects compose into these same two layers.
- `AI.chooseTarget` (`AI.ts:6-20`) has no position-aware logic (random / lowest-hp / highest-atk only).
- No existing tests reference position/index semantics on `Character`.

## Rules

### Scope: literal slots, not relative front/back
- The backlog item names two fixed indices, not "first/last": **slot 0** and **slot 4** specifically (a 5-member squad's first and fifth positions). Squads with fewer than 5 living-at-recruit members simply never populate slot 4, so the back-row bonus only ever applies once a squad has 5 members and the 5th joined.
- This avoids inventing a relative "front/back" concept (which would need a reorder UI, currently nonexistent — out of scope here) and instead ties effects to a position that already has stable meaning: join order. Squad reordering remains a separate future backlog item if wanted.

### Front row (slot 0): damage reduction
- Whichever character occupies index 0 of the party array takes **15% less damage** from all incoming attacks (`FRONT_SLOT_DAMAGE_TAKEN_MULT = 0.85`), applied identically to both `playerParty` and `enemyParty` (symmetric — an enemy's slot-0 member is also tankier).
- Composes multiplicatively with `ARCHETYPE_DAMAGE_TAKEN_MULT` (e.g. a 坦克 in slot 0 takes `0.85 (archetype) * 0.85 (slot 0) = 0.7225` of raw damage) and is applied to `raw` in `calcDamage` before the `Math.max(1, Math.floor(...))` floor, same point in the pipeline as the existing archetype multiplier.
- Applies to all damage sources (basic attack, attack skills); does not apply to healing (heals are not "damage").

### Back row (slot 4): attack bonus
- Whichever character occupies index 4 of the party array deals **15% more damage** via an ATK bonus (`BACK_SLOT_ATK_MULT = 1.15`), implemented as a multiplier on `effectiveAtk` so it also boosts heal amounts (`calcHeal` already reuses `effectiveAtk`) — consistent with "ATK bonus" meaning bonus to the ATK stat itself, not a damage-only modifier.
- Composes multiplicatively with the existing buff and `ALL_ROUNDER_STAT_MULT` layers inside `effectiveAtk` (e.g. a buffed 全能 in slot 4: `base * (1 + buffPct) * 1.05 (全能) * 1.15 (slot 4)`).
- Only affects ATK — slot 4 does not get a DEF or SPD bonus.

### Determining a character's slot
- A character's slot is **assigned per-battle**, not stored on `GameState.squad` — it is simply that character's index within the `Character[]` array passed into `BattleScene`'s party setup, mirroring how the visual layout already derives "front/back" from index.
- Enemy formations: enemy party arrays are already authored in encounter data as ordered arrays; their existing order becomes their formation for these purposes (no new authoring step needed).
- A 1-member party: slot 0 reduction applies (that member is in slot 0); slot 4 bonus does not apply (no slot 4 exists). No double-dipping is possible since 0 ≠ 4.

## Data model changes

`src/types.ts` — add a transient field to `Character`, set at battle setup (not persisted as part of squad-management state, and not written by `CharacterFactory`):

```ts
export interface Character {
  // ...existing fields unchanged...
  position: number;   // NEW — index within this battle's party array (0-based), assigned when the battle starts
}
```

`CharacterFactory.ts` — `createCharacter`/`createEnemy` initialize `position: 0` as a placeholder default (immediately overwritten by `BattleScene` below); factories themselves have no party-array context so they cannot compute the real value.

New module `src/battle/Formation.ts`:

```ts
export const FRONT_SLOT_DAMAGE_TAKEN_MULT = 0.85;
export const BACK_SLOT_ATK_MULT = 1.15;
export const FRONT_SLOT_INDEX = 0;
export const BACK_SLOT_INDEX = 4;

export function assignFormationPositions(party: Character[]): void {
  party.forEach((c, i) => { c.position = i; });
}

export function formationDamageTakenMult(defender: Character): number {
  return defender.position === FRONT_SLOT_INDEX ? FRONT_SLOT_DAMAGE_TAKEN_MULT : 1.0;
}

export function formationAtkMult(attacker: Character): number {
  return attacker.position === BACK_SLOT_INDEX ? BACK_SLOT_ATK_MULT : 1.0;
}
```

`src/scenes/BattleScene.ts` — call `assignFormationPositions(this.playerParty)` and `assignFormationPositions(this.enemyParty)` once, immediately after both arrays are built (same place the existing layout code already assumes index-as-slot).

`src/battle/Buffs.ts` — `effectiveStat` gains the formation ATK multiplier (ATK only):

```ts
export function effectiveAtk(c: Character): number {
  return effectiveStat(c, 'atk', c.stats.atk) * formationAtkMult(c);
}
```

`src/battle/DamageCalc.ts` — `calcDamage` multiplies in the formation damage-taken multiplier alongside the existing archetype one:

```ts
raw *= ARCHETYPE_DAMAGE_DEALT_MULT[attacker.archetype];
raw *= ARCHETYPE_DAMAGE_TAKEN_MULT[defender.archetype];
raw *= formationDamageTakenMult(defender);
```

## UI changes

- No new screens or controls. Squad join order (already visible in `BaseScene`'s squad list and `BattleScene`'s vertical party layout) **is** the formation — players already see it, they just gain a reason to care about who's first/fifth.
- Optional nice-to-have (not required for acceptance): a small "前排" / "後排" tag rendered next to the slot-0 and slot-4 character's name in `BattleScene`'s party display, reusing the existing per-character label rendering.

## Acceptance criteria

1. **Given** a 5-member player party, **when** the character in array index 0 is attacked, **then** `calcDamage` returns a value reflecting `raw *= 0.85` for the slot-0 multiplier (composed with any archetype/buff multipliers already in effect), verified via a unit test comparing `calcDamage` output for the same attacker/skill against a slot-0 defender vs. a slot-2 defender (same base stats, same archetype).
2. **Given** a 5-member player party, **when** the character in array index 4 attacks, **then** `calcDamage`'s effective ATK input is `15%` higher than the same character's effective ATK would be in any other slot, verified by comparing `calcDamage` output for that character at `position = 4` vs. `position = 1` (same defender, same skill).
3. **Given** a 5-member party, **when** the character in slot 4 casts a heal skill, **then** `calcHeal`'s output also reflects the `1.15` ATK multiplier (heal amount scales with effective ATK, same as damage).
4. **Given** a party with only 1 member, **when** that member is both attacked and attacks, **then** the slot-0 damage-reduction multiplier applies (member is in slot 0) and the slot-4 ATK bonus does **not** apply (no slot-4 member exists).
5. **Given** an enemy party where the encounter data orders enemies such that a boss is at index 0, **when** the boss is attacked, **then** the same `0.85` slot-0 multiplier reduces damage dealt to it (formation effects are symmetric between player and enemy sides).
6. **Given** `BattleScene` starting a battle, **when** `assignFormationPositions` runs on `playerParty`/`enemyParty`, **then** each character's `.position` exactly equals its index in that array, and re-running it after a character dies (array unchanged, `alive: false`) does not reassign positions of the remaining characters (dead characters keep their original slot — no re-indexing mid-battle).
7. **Given** the existing `DamageCalc.test.ts` fixtures that don't set `position` explicitly, **when** `calcDamage` is invoked with a defender whose `position` defaults to `0` (per the `CharacterFactory` placeholder), **then** those pre-existing tests must be updated to set an explicit non-front, non-back `position` (e.g. `2`) on fixtures where the test's expected numeric output assumes no formation multiplier — regression check so this feature doesn't silently change unrelated existing test expectations.
