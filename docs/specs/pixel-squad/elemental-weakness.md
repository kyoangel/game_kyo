# 元素弱點系統 (Elemental Weakness System)

## Goal

Add an elemental type to each skill and a matching weakness to each enemy; attacking a weakness deals 1.5× damage and immediately grants the attacker one bonus action, inspired by Persona 5's Press Turn mechanic.

---

## Rules

### Elements

Five elements cover the post-apocalyptic setting:

| ID | Name | Thematic flavour |
|----|------|-----------------|
| `fire` | 火焰 | Explosive rounds, incendiary grenades |
| `ice` | 冰凍 | Cryo-tech, freeze rounds |
| `thunder` | 閃電 | EMP blades, electric discharge |
| `toxin` | 毒素 | Chemical acid, wasteland bio-weapons |
| `physical` | 物理 | Raw force, default for un-typed skills |

### Weakness Hit Resolution

1. A weakness hit occurs when a skill's `element` matches the target's `weakness`.
2. Weakness damage multiplier: **1.5×** (stacks multiplicatively with archetype multipliers and crits; e.g. Sniper crit + weakness = 1.5 × 1.5 = 2.25×).
3. The target gains the `knockedDown` flag for the rest of the round (visual stagger state only).
4. The attacking character gains a **bonus action** inserted immediately after their current action resolves—before any pending enemy turns.
5. A character may earn at most **one bonus action per round** (`bonusActionUsed` flag). Hitting a second weakness during the bonus action deals 1.5× damage but grants no further bonus action.
6. The `bonusActionUsed` flag and all `knockedDown` flags reset at the start of each new round.
7. Weaknesses apply only to enemies. Player characters have no elemental weaknesses in v1.
8. Buff and heal skills have no element and cannot trigger a weakness hit.

### Enemy Weakness Assignment

Default weakness by monster type (individual enemies may override):

| Monster type | Default weakness |
|--------------|-----------------|
| `demon` | `ice` |
| `dragon` | `thunder` |
| `jinn` | `toxin` |
| `lizard` | `fire` |
| `medusa` | `fire` |
| `small_dragon` | `thunder` |

Boss weaknesses are set explicitly in their `EnemyTemplate` (they should differ from type default to add variety):

| Boss | Weakness |
|------|---------|
| Vega | `thunder` |
| Crow | `fire` |
| Zora | `ice` |
| Dex | `toxin` |
| AAAA | `fire` |

### Weakness Discovery (Fog-of-War)

- An enemy's weakness is hidden until the player lands a weakness hit on any enemy sharing that `EnemyTemplate.id`.
- While hidden, the weakness icon shows as **???** in the enemy info panel.
- Discovery is persisted per enemy template ID in `GameState.discoveredWeaknesses`.
- In Challenge Run mode, discovered weaknesses carry over from the base save.

### Skill Element Assignments

Update existing attack skills and add four new elemental skills to the shop:

**Existing skills:**

| Skill ID | Element |
|----------|---------|
| `burst_shot` | `fire` |
| `shield_bash` | `physical` |
| `swift_strike` | `thunder` |

**New shop skills (see Data Model section for full definition):**

| Skill ID | Name | Element | Cost |
|----------|------|---------|------|
| `cryo_round` | 冰凍彈 | `ice` | 45 |
| `acid_splash` | 酸液噴灑 | `toxin` | 40 |
| `fire_grenade` | 燃燒手榴彈 | `fire` | 55 |
| `emp_pulse` | 電磁衝擊 | `thunder` | 50 |

### Edge Cases

- Healing / buff skills have `element: undefined`; they never trigger weakness checks.
- If the target is already dead (0 HP after normal damage), no bonus action is granted even if weakness was hit.
- In **auto-battle** mode, the AI uses elemental skills preferentially against known weaknesses (known = already discovered this run).
- The bonus action in auto-battle follows the same AI priority rules as a normal action.
- A character using their bonus action cannot use the same skill if that skill's cooldown was just set (cooldown ticks start after the bonus action resolves, same as normal).
- If the bonus-action character is killed before their bonus action resolves (by a reaction or event), the bonus action is discarded.

---

## Data Model Changes

### `types.ts`

```typescript
// New
type Element = 'fire' | 'ice' | 'thunder' | 'toxin' | 'physical';

// Skill — add optional element field
interface Skill {
  id: string;
  name: string;
  type: 'attack' | 'heal' | 'buff';
  target: 'enemy' | 'ally' | 'self';
  multiplier: number;
  description: string;
  cooldown?: number;
  buffStat?: BuffStat;
  buffAmountPct?: number;
  buffDuration?: number;
  element?: Element; // NEW — undefined treated as 'physical', no weakness check
}

// EnemyTemplate — add weakness field
interface EnemyTemplate {
  id: string;
  name: string;
  baseStats: StatBlock;
  skillIds: string[];
  monsterType?: MonsterType;
  weakness?: Element; // NEW — undefined = no weakness
}

// Character (battle instance) — add two round-scoped flags
interface Character {
  // ... existing fields ...
  knockedDown: boolean;       // NEW — true if hit by weakness this round
  bonusActionUsed: boolean;   // NEW — true if bonus action was already granted this round
}

// GameState — persist weakness discovery
interface GameState {
  // ... existing fields ...
  discoveredWeaknesses: Record<string, Element>; // NEW — key = EnemyTemplate.id
}
```

### `data/skills.ts`

Add `element` to all existing attack skills and four new shop skills:

```typescript
// Update existing
{ id: 'burst_shot',   ..., element: 'fire'     },
{ id: 'shield_bash',  ..., element: 'physical' },
{ id: 'swift_strike', ..., element: 'thunder'  },

// New skills
{
  id: 'cryo_round', name: '冰凍彈', type: 'attack', target: 'enemy',
  multiplier: 1.2, cooldown: 2, element: 'ice',
  description: '發射低溫冷凍彈，凍傷目標。',
},
{
  id: 'acid_splash', name: '酸液噴灑', type: 'attack', target: 'enemy',
  multiplier: 1.1, cooldown: 1, element: 'toxin',
  description: '噴出高濃度腐蝕液體，溶解目標裝甲。',
},
{
  id: 'fire_grenade', name: '燃燒手榴彈', type: 'attack', target: 'enemy',
  multiplier: 1.6, cooldown: 3, element: 'fire',
  description: '投擲充滿燃燒劑的手榴彈，爆炸傷害極高。',
},
{
  id: 'emp_pulse', name: '電磁衝擊', type: 'attack', target: 'enemy',
  multiplier: 1.3, cooldown: 2, element: 'thunder',
  description: '釋放電磁脈衝，對機械敵人特別有效。',
},
```

### `data/shopItems.ts`

Add entries for four new skills with costs listed above.

### `battle/DamageCalc.ts`

Add weakness multiplier check and return hit-type metadata:

```typescript
interface DamageResult {
  damage: number;
  isWeaknessHit: boolean;
  isCrit: boolean;
}

function calcDamage(attacker, defender, skill): DamageResult {
  // ... existing formula ...
  const isWeaknessHit = !!skill.element
    && !!defender.weakness
    && skill.element === defender.weakness;
  if (isWeaknessHit) finalDamage = Math.floor(finalDamage * 1.5);
  return { damage: finalDamage, isWeaknessHit, isCrit };
}
```

### `battle/TurnEngine.ts`

Add `insertBonusAction(character, turnQueue)` helper:

```typescript
// Inserts character at position 0 of the remaining turn queue for this round.
function insertBonusAction(character: Character, remaining: Character[]): void {
  remaining.unshift(character);
}
```

### `scenes/BattleScene.ts`

- After resolving each attack action, check `damageResult.isWeaknessHit`.
- If true and `!attacker.bonusActionUsed` and defender is still alive:
  - Set `attacker.bonusActionUsed = true`
  - Call `insertBonusAction(attacker, remainingTurnQueue)`
  - Emit `'weaknessHit'` event with `{ attacker, defender }` for UI
- On round start: reset `knockedDown` and `bonusActionUsed` on all characters.
- In `GameState` persistence, record `discoveredWeaknesses` on first weakness hit.

---

## UI Changes

### BattleScene — Combat Feedback

**"WEAK!" floating text:**
- Trigger: `weaknessHit` event
- Style: Bold, pulsing text in orange-yellow (`#FFB300`), font size 24px, floats 40px upward over 800 ms then fades, identical to existing damage numbers but larger and offset left by 20px to avoid overlap.

**Enemy knocked-down animation:**
- Trigger: `knockedDown` flag set to true on enemy
- Effect: Enemy sprite flashes white for 150 ms then tilts (rotation ±8°, duration 300 ms) using Phaser tween, returns upright when round ends or enemy dies.

**Bonus action indicator:**
- When a player character gains a bonus action, show a "⚡ 追加行動！" banner at the top of the command panel in `#FFD700` for 1.5 s before opening that character's command menu.

**Element icons on skill buttons:**
- Skill buttons in the command UI show a 12×12 element icon beside the skill name.
- Icon filenames follow pattern: `assets/ui/element-{id}.png` (fire, ice, thunder, toxin, physical).
- Physical element icon can be omitted (no icon shown for purely physical skills).

### Enemy Info Panel (PrepScene / BattleScene hover)

Add a "弱點 (Weakness)" row below enemy stats:
- **Undiscovered:** Show `❓` icon and text "???"
- **Discovered:** Show element icon and localised element name (e.g. 火焰)
- Data source: `GameState.discoveredWeaknesses[enemyTemplate.id]` cross-referenced against current enemy template

---

## Acceptance Criteria

**AC-1: Basic weakness hit — damage and bonus action**
- Given: Enemy `demon` has `weakness: 'ice'` and player skill `cryo_round` has `element: 'ice'`
- When: Player uses `cryo_round` on that enemy
- Then: Damage equals the normal formula × 1.5, "WEAK!" text appears, and the attacking character receives one bonus action before any pending enemy turns

**AC-2: Non-matching element — no weakness effect**
- Given: Enemy has `weakness: 'ice'` and player uses `burst_shot` (`fire`)
- When: Skill connects
- Then: Normal damage, no "WEAK!" text, no bonus action

**AC-3: Bonus action chain prevention**
- Given: Character already has `bonusActionUsed: true` (earned bonus action earlier this round)
- When: During their bonus action they hit another weakness
- Then: Damage is still 1.5×, "WEAK!" text appears, but NO second bonus action is inserted

**AC-4: Bonus action resets each round**
- Given: Character used their bonus action in round N
- When: Round N+1 begins
- Then: `bonusActionUsed` is false and `knockedDown` is false on all characters

**AC-5: Weakness discovery persists**
- Given: Player has never hit enemy `mutant_01`'s weakness
- When: Player looks at enemy info panel
- Then: Weakness shows as "???"
- When: Player hits the weakness with a matching skill
- Then: From that point (including after save/load), weakness shows the correct element icon for any `mutant_01` enemy

**AC-6: Undiscovered weakness — no discovery on miss**
- Given: Player uses a non-weakness skill and deals normal damage
- When: Checking discovery state
- Then: `discoveredWeaknesses` does not contain an entry for that enemy

**AC-7: Weakness multiplier stacks with Sniper crit**
- Given: Sniper archetype character uses a skill matching enemy weakness, and the crit roll succeeds
- When: Damage is calculated
- Then: Damage = normal formula × 1.5 (weakness) × 1.5 (crit) = 2.25× normal

**AC-8: New elemental skills available in shop**
- Given: Player opens the shop after chapter 1
- When: Browsing skill scrolls
- Then: At least two of the four new elemental skills are purchasable and display their element icon

**AC-9: Dead target grants no bonus action**
- Given: A weakness hit reduces enemy HP to 0 or below
- When: Post-damage bonus action check runs
- Then: No bonus action is inserted (attacker does not act again)

**AC-10: Auto-battle uses element awareness**
- Given: Auto-battle is active and a discovered weakness exists for an enemy
- When: The AI selects an action for a character who has a skill matching that weakness
- Then: The AI preferentially selects the weakness-exploiting skill over a non-elemental attack
