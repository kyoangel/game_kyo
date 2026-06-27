# Spec: 角色技能系統（heal / buff 實際生效）

## Goal

Make `heal` and `buff` skill types (already declared in `SkillType` but unused) actually affect HP and stats in battle, with a skill-selection UI so characters with multiple skills can choose between them.

## Current state (for context)

- `src/types.ts` declares `SkillType = 'attack' | 'heal' | 'buff'`, but `src/data/skills.ts` only defines `attack` skills (`burst_shot`, `shield_bash`, `swift_strike`).
- `BattleScene.showCommandMenu` → `技能` button always jumps straight to **enemy** target selection (`enemyParty.filter(e => e.alive)`), then `executePlayerCommand` does `cmd.character.skills.find(s => s.type === 'attack')` — i.e. it ignores which skill was picked and hardcodes "the first attack skill." Heal/buff skills could never be selected or executed even if they existed.
- Most non-protagonist characters (`vega`, `ash`, `crow`, `mira`, `zora`, `rook`, `dex`, `echo`, `aaaa` in `src/data/characters.ts`) have `skillIds: []` — no skills at all.
- `Character` has no stat-modifier/status state besides the single-round `defending: boolean` flag.
- `calcDamage` (`src/battle/DamageCalc.ts`) reads `attacker.stats.atk` / `defender.stats.def` directly — no concept of buffed stats.
- Auto-battle (`runAutoRound`) picks `useSkill = Math.random() < 0.5 && c.skills.some(s => s.type === 'attack')` then always targets a random enemy — also hardcoded to attack-only.

## Rules

### Skill targeting
- Each `Skill` gets a `target: 'enemy' | 'ally' | 'self'`.
  - `attack` skills → `target: 'enemy'` (existing behavior, unchanged).
  - `heal` skills → `target: 'ally'` (caster may target itself or a teammate — "ally" list includes the caster).
  - `buff` skills → `target: 'ally'` or `'self'` per-skill (a few buffs, like a personal combat stim, are self-only; support buffs can target any ally including self).
- Target list for `heal`/`ally`-buff skills = caster's own party, alive members only (for player casters: `playerParty.filter(c => c.alive)`; for enemy casters: `enemyParty.filter(c => c.alive)`).
- Target list for `self` skills = no selection step; target is locked to the caster.

### Heal
- Heal amount = `Math.max(1, Math.floor(caster.stats.atk * skill.multiplier))` (reuses the existing `multiplier` field — consistent with how `attack` skills already use it).
- Healing cannot raise `stats.hp` above `stats.maxHp` (clamp).
- Healing cannot target a dead (`alive === false`) character — dead allies are excluded from the target list entirely; there is no revive mechanic in this spec.
- Healing always succeeds (no miss/resist chance), mirroring how attack damage always lands today.

### Buff
- A buff skill defines `buffStat: 'atk' | 'def' | 'spd'`, `buffAmountPct` (e.g. `0.3` = +30%), and `buffDuration` (number of the *target's own* upcoming turns the buff lasts, e.g. `3`).
- Applying a buff adds an `ActiveBuff` entry to the target's `activeBuffs` array.
- **One buff per stat per character**: if a new buff targets a stat the character already has an active buff for, it **replaces** the old one (no stacking, no additive duration) — simplest rule that avoids balance complexity from stacking multipliers.
- Effective stat for damage/turn-order/AI purposes = `base * (1 + sum of active buff amountPct for that stat)` — since only one buff per stat can be active, this is just `base * (1 + amountPct)` when present, `base` otherwise. Implemented via three pure helpers (see Data model) so call sites never read `stats.atk/def/spd` directly mid-battle.
- Buff duration ticks down by 1 at the **start of each new round's command phase** (i.e. when `startCommandPhase()` runs, for both `playerParty` and `enemyParty`), after which buffs at `turnsRemaining <= 0` are removed. This means a buff applied in round N is active for the caster's target through rounds N, N+1, ..., up to `buffDuration` rounds of combat, then expires before round N+`buffDuration`+1's commands are chosen.
- Buffs are cosmetic-free for this spec (no buff/debuff icon polish required, though a small text indicator is nice-to-have — see UI changes).
- Buffing a target that already has the *exact same* buff (same stat, same source skill) simply resets `turnsRemaining` to `buffDuration` (refresh, not stack).

### Skill availability in UI
- If `character.skills.length === 0`, the `技能` button is omitted from the command menu entirely (today it always shows even though every "skill" press just does a basic attack via the `find(s => s.type === 'attack')` fallback — that fallback goes away).
- If `character.skills.length === 1`, pressing `技能` skips the skill-list and goes directly to that skill's target selection (preserves today's "feel" for single-skill characters like the protagonist/Rex/Nyx).
- If `character.skills.length > 1`, pressing `技能` opens a skill-picker submenu (button per skill, showing `skill.name`) before target selection.

### Auto-battle and enemy AI
- Auto-battle (`runAutoRound`) and plain enemy AI (`executeEnemyAction`) get a shared decision helper (see Data model) that, per acting character with skills:
  1. If the character has a `heal` skill and any living ally (including self) is below 50% HP, cast that heal skill on the lowest-HP-percentage ally.
  2. Else if the character has a `buff` skill whose target stat is **not** currently buffed on its intended target (self, or — for ally-targetable buffs — the ally with the lowest effective value of that stat), cast it on that target.
  3. Else if the character has any `attack` skill, 50% chance to use a random one (existing odds), targeting per existing AI (`chooseTarget` for enemies, random alive enemy for player auto-mode).
  4. Else, basic attack.
- This priority order (heal > buff > attack-skill > basic attack) keeps support characters useful without making fights trivial — heal only triggers below the 50% HP threshold so it doesn't spam on full-health parties.

## Data model changes

`src/types.ts`:

```ts
export type SkillTarget = 'enemy' | 'ally' | 'self';
export type BuffStat = 'atk' | 'def' | 'spd';

export interface Skill {
  id: string;
  name: string;
  type: SkillType;            // 'attack' | 'heal' | 'buff'
  target: SkillTarget;        // NEW — who this skill can be aimed at
  /** attack: ATK multiplier for damage. heal: ATK multiplier for heal amount. unused for buff. */
  multiplier: number;
  description: string;
  /** buff-only fields */
  buffStat?: BuffStat;
  buffAmountPct?: number;      // e.g. 0.3 = +30%
  buffDuration?: number;       // rounds
}

export interface ActiveBuff {
  stat: BuffStat;
  amountPct: number;
  turnsRemaining: number;
  sourceSkillId: string;
}
```

`Character` interface — add one field:

```ts
export interface Character {
  // ...existing fields unchanged...
  activeBuffs: ActiveBuff[];   // NEW — empty array by default
}
```

`PendingCommand` — record which skill was chosen (today it's implied/wrong):

```ts
export interface PendingCommand {
  character: Character;
  action: 'attack' | 'skill' | 'defend';
  skill?: Skill;               // NEW — the specific skill chosen when action === 'skill'
  target?: Character;
}
```

`CharacterFactory.ts` — both `createCharacter` and `createEnemy` must initialize `activeBuffs: []`.

New module `src/battle/Buffs.ts`:

```ts
export function effectiveAtk(c: Character): number;
export function effectiveDef(c: Character): number;
export function effectiveSpd(c: Character): number;
export function applyBuff(target: Character, skill: Skill): void;   // insert-or-refresh per "one per stat" rule
export function tickBuffs(party: Character[]): void;                // decrement + prune, called once per round per side
```

`DamageCalc.ts` — use `effectiveAtk`/`effectiveDef` instead of raw `stats.atk`/`stats.def`:

```ts
export function calcDamage(attacker: Character, defender: Character, skill?: Skill): number {
  const multiplier = skill?.type === 'attack' ? skill.multiplier : 1.0;
  const raw = effectiveAtk(attacker) * multiplier - effectiveDef(defender) * 0.5;
  ...
}

export function calcHeal(caster: Character, skill: Skill): number {
  return Math.max(1, Math.floor(effectiveAtk(caster) * skill.multiplier));
}
```

`TurnEngine.computeTurnOrder` and `AI.chooseTarget`'s `highest-atk` branch — switch to `effectiveSpd` / `effectiveAtk` so active buffs affect turn order and AI targeting choices, not just damage.

`src/data/skills.ts` — add heal/buff entries:

```ts
field_medic: {
  id: 'field_medic', name: '戰地醫療', type: 'heal', target: 'ally',
  multiplier: 0.8, description: '以 ATK × 0.8 治療一名隊友',
},
combat_stim: {
  id: 'combat_stim', name: '戰鬥興奮劑', type: 'buff', target: 'self',
  multiplier: 0, buffStat: 'atk', buffAmountPct: 0.3, buffDuration: 3,
  description: '自身 ATK 提升 30%，持續 3 回合',
},
iron_will: {
  id: 'iron_will', name: '鋼鐵意志', type: 'buff', target: 'ally',
  multiplier: 0, buffStat: 'def', buffAmountPct: 0.4, buffDuration: 3,
  description: '一名隊友 DEF 提升 40%，持續 3 回合',
},
```

Existing skill entries (`burst_shot`, `shield_bash`, `swift_strike`) gain `target: 'enemy'`.

`src/data/characters.ts` — give support-flavored characters something to actually support with (currently `skillIds: []`):
- `mira` (high HP/DEF) → `skillIds: ['field_medic']`
- `ash` (balanced tank) → `skillIds: ['iron_will']`
- `vega` (highest ATK early) → `skillIds: ['combat_stim']`
- Leave `crow`, `zora`, `rook`, `dex`, `echo`, `aaaa` as-is (later backlog items — Archetype effects, shop — may give them skills too; out of scope here).

New module `src/battle/SkillAI.ts` (shared by auto-mode and enemy AI):

```ts
export interface SkillDecision {
  skill?: Skill;          // undefined => basic attack
  target: Character;
}
export function decideAction(actor: Character, allies: Character[], enemies: Character[]): SkillDecision;
```

## UI changes

`BattleScene.showCommandMenu`:
- Omit the `技能` entry when `character.skills.length === 0`.
- When pressed: if exactly one skill, go straight into target selection scoped by that skill's `target` (enemy list / ally list / locked-to-self with no selection step and an immediate confirm). If multiple skills, render a skill-picker submenu (reuse the same button-row layout as the action menu) with one button per skill labeled `skill.name`; selecting one then proceeds to that skill's target selection.
- `ESC` from the skill-picker submenu returns to the main command menu (same affordance as existing target-selection cancel).

`BattleScene.enterTargetSelection`:
- Generalize from "always `enemyParty`" to accept the candidate list already filtered by the caller per `skill.target` (`ally` → caster's own party minus dead; `self` → bypass selection, call the callback immediately with the caster as target).

`BattleScene.executePlayerCommand` / `executeEnemyAction`:
- Branch on `cmd.skill?.type` (or computed skill from `SkillAI.decideAction` in auto/enemy paths):
  - `attack` or no skill → existing `calcDamage` + `applyDamageAndAdvance` flow.
  - `heal` → compute `calcHeal`, clamp to `maxHp`, update HP bar, message `"${caster.name}【${skill.name}】→ ${target.name} +${amount} HP"`.
  - `buff` → call `applyBuff(target, skill)`, message `"${caster.name}【${skill.name}】→ ${target.name} ${statLabel}↑"` (e.g. `ATK↑`).

`BattleScene.startCommandPhase`:
- After clearing `defending` flags, call `tickBuffs(this.playerParty)` and `tickBuffs(this.enemyParty)` so durations decrement once per round.

Status display (nice-to-have, not required for acceptance):
- Small text under `archetypeText` showing active buff stat letters (e.g. `ATK+ DEF+`) when `character.activeBuffs.length > 0`.

## Acceptance criteria

1. **Given** a character with one heal skill and a damaged ally, **when** the player selects 技能 → confirms the heal skill → selects that ally as target, **then** the ally's `stats.hp` increases by `floor(caster.effectiveAtk * skill.multiplier)`, clamped to `maxHp`, and the battle log shows a heal message (not a damage message).

2. **Given** a full-HP ally, **when** a heal skill targets them, **then** their `stats.hp` does not exceed `stats.maxHp` (no overheal).

3. **Given** a dead ally, **when** the player opens the ally target list for a heal/buff skill, **then** the dead ally does not appear as a selectable target.

4. **Given** a character with a buff skill (`buffStat: 'atk'`, `buffAmountPct: 0.3`, `buffDuration: 3`) cast on an ally, **when** that ally subsequently attacks, **then** `calcDamage` uses `ally.stats.atk * 1.3` as the effective ATK for that attack.

5. **Given** a buffed character, **when** 3 of their own rounds elapse (i.e. `tickBuffs` runs 3 times for their party), **then** the buff is removed from `activeBuffs` and their effective stat reverts to base.

6. **Given** a character already has an active `atk` buff from skill A, **when** skill B (also `buffStat: 'atk'`) is cast on the same character, **then** the character ends up with exactly one `atk` entry in `activeBuffs` (B's values), not two.

7. **Given** a character with zero skills (e.g. `crow`, default `skillIds: []`), **when** the command menu is shown for that character, **then** no `技能` button is rendered.

8. **Given** a character with exactly one skill, **when** the player presses `技能`, **then** target selection opens immediately (no intermediate skill-picker screen).

9. **Given** a character with two or more skills, **when** the player presses `技能`, **then** a skill-picker listing each skill's name appears before target selection, and pressing `ESC` from that picker returns to the main command menu without consuming the character's turn.

10. **Given** auto-battle mode, **when** a party member has a heal skill and any ally (including self) is below 50% HP, **then** `SkillAI.decideAction` returns that heal skill targeted at the lowest-HP% living ally rather than an attack.

11. **Given** an enemy with a buff skill and no active matching buff on itself, **when** the enemy's turn executes in `executeEnemyAction`, **then** the enemy casts the buff before falling back to attack logic.

12. **Given** the existing attack-skill flow (`burst_shot`, `shield_bash`, `swift_strike`), **when** a character with one of these skills attacks via 技能, **then** damage calculation and messaging behave exactly as before this change (regression check — adding `target: 'enemy'` to these entries must not alter existing combat behavior or test expectations).
