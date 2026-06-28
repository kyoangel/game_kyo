# Pixel Monster Assets — Implementation Spec

## Goal

Wire the existing monster PNG sprite sheets into the BattleScene so every enemy renders as an animated pixel-art sprite instead of a coloured rectangle.

---

## Background

Six monster types already exist as individual PNG frames under `public/sprites/monsters/`:
`demon`, `dragon`, `jinn`, `lizard`, `medusa`, `small_dragon`.
`src/data/sprites.ts` already declares `MONSTER_FRAMES` with full frame paths per animation state.
`BattleScene.renderParty()` currently creates a `Phaser.GameObjects.Rectangle` for every enemy.
The feature connects these three pieces: type annotation → asset preload → sprite render + animation.

---

## Rules

### Enemy-to-MonsterType Mapping

| Enemy template ID(s) | MonsterType | Rationale |
|---|---|---|
| `mutant`, `mutant_a`, `mutant_b` | `demon` | Humanoid mutant — hulking demonic silhouette |
| `wolf_a`, `wolf_b` | `small_dragon` | Fast feral animal — closest available creature |
| `raider`, `raider_a`…`raider_c`, `raider_cap`, `raider_sniper` | `demon` | Human fighter — demon's humanoid form works |
| `waste_dog` | `lizard` | Ground-crawling fast beast |
| `mech_a`…`mech_c`, `mech_soldier`, `em_guard`, `elite_mech` | `jinn` | Mechanical/ethereal glow matches robotic look |
| `soldier`, `soldier_a`…`soldier_c`, `elite_a`, `elite_b`, `sniper` | `demon` | Human soldiers share humanoid silhouette |
| `franken` | `demon` | Oversized humanoid |
| `bomber` | `demon` | Human-form explosive unit |
| `beast_a`…`beast_c`, `mutant_beast` | `dragon` | Large mutated quadruped |
| `em_spider` | `lizard` | Multi-legged crawler |
| `forge_bot` | `jinn` | Large industrial bot |
| `ruin_guard`, `elite_guard`, `arena_fighters` | `demon` | Armoured humanoid |
| `gargoyle` | `dragon` | Winged stone creature |
| `shadow_assassin`, `top_samurai`, `market_boss`, `ancient_guardians`, `deity` | `jinn` | Agile, spectral |
| `crow` | `jinn` | Fast agile boss |
| `vega` | `demon` | Brawler boss |
| `zora` | `medusa` | Mystic female boss |
| `dex` | `dragon` | Heavy mechanical boss |
| `aaaa` | `demon` | Final humanoid boss |
| `arena_champion`, `market_thugs` | `demon` | Human fighters |

Any enemy template without an explicit mapping falls back to a `0xee4444` rectangle (current behaviour), preserving forward-compatibility with future enemy IDs.

### Animation States & Transitions

| Game event | Animation played | Loop? | On complete |
|---|---|---|---|
| Waiting for turn | `idle` | yes (loop) | — |
| Moving to attack | `walk` (optional, skip if frame budget tight) | no | → attack |
| Executing attack | `attack` | no | → idle |
| Receiving damage | `hurt` | no | → idle |
| HP reaches 0 | `death` | no | freeze on last frame |

- Frame rate: **8 fps** for idle/walk, **10 fps** for attack/hurt, **6 fps** for death.
- On death: do NOT destroy the sprite — hold the last death frame at 40% alpha (matches current dead-rect appearance).
- Sprites face **left** (towards the player side) — flip horizontally (`setFlipX(true)`) since the source art faces right.

### Sizing

- Enemy sprite display size: **64 × 64 px** (scaled from native frame size with `setDisplaySize`).
- HP bar remains below the sprite at `cy + 38` (same relative offset as current rectangle version).
- Target highlight ring scales to `70 × 70` (`Phaser.GameObjects.Ellipse`, same orange tint as current rectangle highlight).

### Edge Cases

- If a frame file fails to load (network/asset error), Phaser silently uses its missing-texture checker; the game must not crash — the sprite still renders (checkerboard) and the battle continues.
- Multiple enemies of the same `monsterType` in the same stage must each have their own `Phaser.GameObjects.Sprite` instance but share the same registered `Phaser.Animations.Animation` key (animations are global in Phaser; registering the same key twice should be guarded with `scene.anims.exists(key)`).
- Named character enemies (Vega, Crow, etc.) use their mapped `monsterType` sprite when encountered as enemies, not a protagonist sprite (protagonist sprite is player-only).

---

## Data Model Changes

### `src/types.ts` — extend `EnemyTemplate`

```typescript
// Add import at top of file
import type { MonsterType } from './data/sprites';

export interface EnemyTemplate {
  id: string;
  name: string;
  baseStats: Stats;
  skillIds: string[];
  monsterType?: MonsterType;   // ← NEW optional field
}
```

### `src/data/stages.ts` — add `monsterType` to every enemy definition

Each `EnemyTemplate` object in the stages data file gets a `monsterType` property according to the mapping table above. Example diff for Chapter 1:

```typescript
// Before
{ id: 'mutant', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [] }

// After
{ id: 'mutant', name: '變種人', baseStats: { hp: 60, atk: 15, def: 5, spd: 8 }, skillIds: [], monsterType: 'demon' }
```

### `src/data/sprites.ts` — add helper constants

```typescript
// Animation frame rates per state
export const MONSTER_ANIM_FPS: Record<MonsterAnimKey, number> = {
  idle:   8,
  walk:   8,
  attack: 10,
  hurt:   10,
  death:  6,
};

// Generate a unique Phaser animation key for a monster+state pair
export function monsterAnimKey(type: MonsterType, anim: MonsterAnimKey): string {
  return `monster_${type}_${anim}`;
}
```

---

## UI Changes — `BattleScene`

### `preload()` — load all monster frame PNGs

```typescript
// After existing protagonist spritesheet load:
import { MONSTER_FRAMES, MonsterType, MonsterAnimKey } from '../data/sprites';

for (const [monsterType, anims] of Object.entries(MONSTER_FRAMES)) {
  for (const [animKey, paths] of Object.entries(anims)) {
    paths.forEach((path, i) => {
      const key = `${monsterType}_${animKey}_${i}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, path);
      }
    });
  }
}
```

### `create()` — register Phaser animations (once, guarded)

```typescript
import { monsterAnimKey, MONSTER_ANIM_FPS } from '../data/sprites';

private registerMonsterAnimations() {
  for (const [monsterType, anims] of Object.entries(MONSTER_FRAMES) as [MonsterType, Record<MonsterAnimKey, string[]>][]) {
    for (const [animKey, paths] of Object.entries(anims) as [MonsterAnimKey, string[]][]) {
      const key = monsterAnimKey(monsterType, animKey);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: paths.map((_, i) => ({ key: `${monsterType}_${animKey}_${i}` })),
        frameRate: MONSTER_ANIM_FPS[animKey],
        repeat: animKey === 'idle' || animKey === 'walk' ? -1 : 0,
      });
    }
  }
}
```

Call `this.registerMonsterAnimations()` at the end of `create()`.

### `renderParty()` — enemy body: sprite instead of rectangle

```typescript
// Current code (enemy branch):
const body = this.add.rectangle(cx, cy, 44, 56, color).setAlpha(0.9);

// New code (enemy branch):
const mt = (char as any)._monsterType as MonsterType | undefined;
let body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
if (mt && MONSTER_FRAMES[mt]) {
  const idleKey0 = `${mt}_idle_0`;
  body = this.add.sprite(cx, cy, idleKey0)
    .setDisplaySize(64, 64)
    .setFlipX(true);
  body.play(monsterAnimKey(mt, 'idle'));
} else {
  body = this.add.rectangle(cx, cy, 44, 56, color).setAlpha(0.9);
}
```

The `_monsterType` field is a runtime annotation attached by `CharacterFactory.createEnemy()`:

```typescript
// src/battle/CharacterFactory.ts — in createEnemy():
const char = createCharacterFromTemplate(template, statMultiplier);
(char as any)._monsterType = template.monsterType;
return char;
```

### Animation triggers — `BattleScene` combat event handlers

The existing battle execution code dispatches visual feedback. Extend it to trigger animations:

```typescript
// Helper to play a one-shot animation then return to idle
private playEnemyAnim(charId: string, anim: MonsterAnimKey) {
  const entry = this.partyEntries.get(charId);
  if (!entry || !(entry.body instanceof Phaser.GameObjects.Sprite)) return;
  const mt: MonsterType | undefined = (entry.char as any)._monsterType;
  if (!mt) return;
  const key = monsterAnimKey(mt, anim);
  if (anim === 'death') {
    entry.body.play(key).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      entry.body.setAlpha(0.4);
    });
  } else {
    entry.body.play(key).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      entry.body.play(monsterAnimKey(mt, 'idle'));
    });
  }
}
```

Call sites:
- When an enemy takes damage → `playEnemyAnim(enemy.id, 'hurt')`
- When an enemy attacks → `playEnemyAnim(enemy.id, 'attack')`
- When an enemy HP hits 0 → `playEnemyAnim(enemy.id, 'death')`

---

## Acceptance Criteria

**Given** a stage with enemies that have `monsterType` set  
**When** BattleScene loads  
**Then** all monster PNGs are preloaded with no 404 errors in the network tab.

---

**Given** the BattleScene renders the enemy party  
**When** the scene initialises  
**Then** each enemy with a `monsterType` displays a 64×64 pixel sprite (not a red rectangle), flipped to face left, playing the idle animation on loop.

---

**Given** two enemies of the same `monsterType` in the same stage  
**When** animations are registered  
**Then** `scene.anims.exists(key)` prevents duplicate registration and no console error appears.

---

**Given** an enemy without a `monsterType` (unmapped ID or future content)  
**When** the scene renders  
**Then** the enemy falls back to the existing red rectangle with no crash.

---

**Given** an enemy with `monsterType: 'jinn'` attacks a player character  
**When** the attack resolves  
**Then** the jinn sprite plays the `attack` animation, then automatically returns to `idle` loop.

---

**Given** an enemy takes lethal damage  
**When** HP reaches 0  
**Then** the sprite plays the `death` animation, freezes on the last frame at 40% alpha, and stops all further animation playback.

---

**Given** the game is running on a slow connection and a frame PNG fails to load  
**When** the enemy sprite is created  
**Then** Phaser renders the missing-texture checkerboard; the battle resolves correctly and no JS exception is thrown.

---

**Given** Chapter 3 stage 5 (Zora boss)  
**When** the boss stage begins  
**Then** Zora displays using the `medusa` monster sprite set (not a rectangle), playing idle.

---

**Given** Chapter 4 stage 5 (Dex boss)  
**When** the boss stage begins  
**Then** Dex displays using the `dragon` monster sprite set.
