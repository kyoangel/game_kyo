# Spec: 技能冷卻時間設計 (Skill Cooldown System)

## Goal

Add per-skill cooldown timers so that powerful skills can only be used once every N rounds, creating meaningful tactical decisions and preventing spam of high-multiplier abilities.

---

## Rules

### Cooldown Definition
- Each skill may declare an optional `cooldown: number` (integer ≥ 1, representing rounds).
- Skills without a `cooldown` field (or `cooldown: 0`) are **unlimited-use** — current behaviour unchanged.
- A skill with `cooldown: 2` may be used on round 1, then becomes unavailable for rounds 2–3, and is usable again on round 4.

### Cooldown Tracking
- Cooldown state is tracked **per-character per-skill** as a "remaining locked rounds" counter (`skillCooldowns: Record<string, number>`).
- Immediately after a character uses a skill with a cooldown, that skill's counter is set to `skill.cooldown`.
- At the **start of each round's command phase** (before any player input is collected), every living character's non-zero counters are decremented by 1.
- Counter reaches 0 → skill is usable again.
- Dead characters' cooldowns are not ticked (they don't act), but the counters persist in case of a revive mechanic added later.

### Scope
- Cooldown tracking applies to **both player characters and enemies**.
- Cooldowns reset to 0 when a battle ends (win or lose). Skills are fully available at the start of every new battle.
- Cooldowns are **not** saved to `GameState` — they are ephemeral, battle-only state.
- The defend action and basic attack are unaffected.

### UI / Feedback
- In the **skill picker UI**, skills currently on cooldown are shown greyed-out with a "(CD: N)" suffix indicating remaining rounds.
- Greyed-out skills are **not selectable** — tapping/pressing them does nothing or shows a brief "冷卻中" message.
- After a skill is used, the command icon shown next to the character immediately reflects the choice (existing `⚔ / 技 / 🛡` system), no new icon needed.
- In **Auto mode**, the auto-AI simply skips skills on cooldown, falling back to the next-best action as `SkillAI.decideAction` already does.

### Skill Cooldown Values (Initial Assignments)
| Skill ID       | Name           | Cooldown (rounds) | Rationale |
|----------------|----------------|--------------------|-----------|
| `burst_shot`   | 爆發射擊       | 3                  | 1.5× multiplier — strong nuke |
| `overdrive`    | 超載           | 4                  | 1.5× effective burst over 2 turns |
| `iron_will`    | 鋼鐵意志       | 3                  | 40% DEF buff, party-wide impact |
| `combat_stim`  | 戰鬥興奮劑     | 3                  | 30% ATK self-buff |
| `shield_bash`  | 盾擊           | 2                  | 1.2× — moderate |
| `swift_strike` | 迅捷突刺       | 2                  | 1.3× — moderate |
| `field_medic`  | 戰地醫療       | 2                  | 0.8× heal — sustain, not burst |

---

## Data Model Changes

### `src/types.ts` — `Skill` interface
Add optional `cooldown` field:

```typescript
export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  target: SkillTarget;
  multiplier: number;
  description: string;
  /** Number of rounds this skill is locked after use. 0 or absent = no cooldown. */
  cooldown?: number;
  buffStat?: BuffStat;
  buffAmountPct?: number;
  buffDuration?: number;
}
```

### `src/types.ts` — `Character` interface
Add `skillCooldowns` map:

```typescript
export interface Character {
  // ... existing fields ...
  /** Maps skill.id → remaining locked rounds (0 = ready). Only non-zero entries need to be present. */
  skillCooldowns: Record<string, number>;
}
```

### `src/battle/CharacterFactory.ts`
Initialize `skillCooldowns: {}` when creating both player characters and enemies.

---

## Logic Changes

### New helper: `src/battle/SkillCooldown.ts`
```typescript
import type { Character, Skill } from '../types';

/** Returns true if the skill is currently available (not on cooldown). */
export function isSkillReady(char: Character, skill: Skill): boolean {
  if (!skill.cooldown) return true;
  return (char.skillCooldowns[skill.id] ?? 0) === 0;
}

/** Call immediately after a character uses a skill. */
export function triggerCooldown(char: Character, skill: Skill): void {
  if (skill.cooldown) {
    char.skillCooldowns[skill.id] = skill.cooldown;
  }
}

/** Call at the start of each command phase, for every character in the battle. */
export function tickCooldowns(characters: Character[]): void {
  for (const char of characters) {
    for (const id of Object.keys(char.skillCooldowns)) {
      if (char.skillCooldowns[id] > 0) {
        char.skillCooldowns[id]--;
      }
    }
  }
}
```

### `src/scenes/BattleScene.ts` — `startCommandPhase()`
1. After calling `tickBuffs(...)`, also call `tickCooldowns([...this.playerParty, ...this.enemyParty])`.

### `src/scenes/BattleScene.ts` — `showSkillPicker()` / single-skill branch
- For each skill in `character.skills`, call `isSkillReady(character, skill)`.
- If not ready: render the skill label in a dimmed colour (`#6b7280`) with text `${skill.name} (CD: ${character.skillCooldowns[skill.id]})` and do not attach a click/keyboard handler.
- If ready: render normally.

### `src/scenes/BattleScene.ts` — after executing a player skill
Call `triggerCooldown(character, skill)` immediately after the command is confirmed (inside `confirmCommand` or when the skill execution resolves).

### `src/battle/SkillAI.ts` — `decideAction()`
Import `isSkillReady` and guard each skill check:

```typescript
const healSkill = actor.skills.find(s => s.type === 'heal' && isSkillReady(actor, s));
const buffSkill = actor.skills.find(s => s.type === 'buff' && isSkillReady(actor, s));
const attackSkills = actor.skills.filter(s => s.type === 'attack' && isSkillReady(actor, s));
```

After the AI chooses to use a skill, call `triggerCooldown(actor, skill)` before returning the decision (so the counter is set before the next tick).

### `src/data/skills.ts`
Add `cooldown` values to each skill definition per the table above.

---

## UI Changes

### BattleScene — Skill Picker Panel
Current: a list of buttons, one per skill.
After: same layout, with the following additions per skill row:
- **Ready**: white text, fully interactive.
- **On cooldown**: grey text (`#6b7280`), label appended with ` (CD: N)`, pointer cursor removed, tap is a no-op (or shows a 1-second toast: "冷卻中").

The indicator `(CD: N)` uses the remaining turns value from `char.skillCooldowns[skill.id]`.

No new UI panels or icons are needed beyond the cooldown label in the existing skill picker.

---

## Acceptance Criteria

**Given** a character has `burst_shot` (cooldown 3) and uses it on round 1,  
**When** the player tries to pick `burst_shot` on round 2,  
**Then** the skill appears greyed-out with label "爆發射擊 (CD: 3)" and cannot be selected.

**Given** a character used `burst_shot` on round 1,  
**When** rounds 2, 3, and 4 begin (each triggering `tickCooldowns`),  
**Then** on round 4 the cooldown counter is 0 and the skill appears white and interactive again.

**Given** a character has a skill with no `cooldown` field (e.g., any newly-added skill without it),  
**When** the player uses it,  
**Then** no cooldown counter is set and the skill is immediately available next round.

**Given** an enemy AI character has `overdrive` (cooldown 4) and uses it,  
**When** `decideAction` is called in the next round,  
**Then** `isSkillReady` returns false for `overdrive` and the AI falls back to an attack skill or basic attack.

**Given** a battle ends (victory or defeat),  
**When** a new battle begins,  
**Then** all characters' `skillCooldowns` are `{}` (reset via `CharacterFactory` or battle init) and all skills are immediately usable.

**Given** a player has a character with only one skill and that skill is on cooldown,  
**When** the `技能` button is shown in the command menu,  
**Then** the `技能` button is either hidden or the single skill is shown greyed-out with the cooldown label (no silent no-op entry).
