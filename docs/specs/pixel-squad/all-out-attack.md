# All-Out Attack（連鎖攻擊）

## Goal

When every surviving enemy on the field has been knocked down by elemental weakness hits within the same round, the player is prompted to unleash a dramatic All-Out Attack — every conscious party member rushes all enemies simultaneously for massive total damage.

---

## Rules

### Knock-Down Condition

1. A weakness hit (`isWeaknessHit === true` from `calcDamage()`) against a **surviving** enemy sets that enemy's `knockedDown = true`.
2. **Bosses are immune to knockdown.** Enemies with `_monsterType === 'boss'` cannot be set to `knockedDown`.
3. `knockedDown` is reset for all characters at the start of every command phase via the existing `resetRoundFlags()`.
4. The existing extra-turn bonus from `applyWeaknessBonus()` still fires before the AOA check (attacker gets their bonus turn first).

### All-Out Attack Trigger

5. After **every** resolved player action that produced a weakness hit, check: are **all** currently alive enemies knocked down?
   - Dead enemies are excluded from the check (they're already removed).
   - If the field contains at least one boss, the check can never pass (bosses block AOA).
6. If the check passes and AOA has **not** already been used or declined this round:
   - Pause turn execution immediately (do not advance to the next actor in the queue).
   - Enter battle phase `'all-out-attack-prompt'`.

### Declining AOA

7. If the player selects **Pass**, set an `aoa.usedThisRound = true` flag and resume turn execution normally from where it was paused. AOA cannot be re-triggered this round.

### All-Out Attack Execution

8. Damage per party member per target:
   ```
   aoaDamage = floor(member.stats.atk * 0.5)   // no element, no defense reduction, no archetype mults
   aoaDamage = max(1, aoaDamage)
   ```
9. All alive party members deal `aoaDamage` to **all alive enemies**, applied simultaneously (all damage resolved before any death check).
10. AOA damage is **physical** and carries no element — it cannot trigger further weakness hits.
11. Archetype bonuses, defending status, and cooldowns do **not** apply to AOA damage.
12. After all AOA damage is applied, `knockedDown` resets on surviving enemies.
13. The turn queue is **cleared** after AOA (current round ends); the next round starts normally.

### Round-State Reset

14. `aoa.usedThisRound` resets to `false` at the start of each command phase alongside `resetRoundFlags()`.

---

## Data Model Changes

### `Character` (`types.ts`)

No new field needed — `knockedDown?: boolean` already exists.

### New `AoaRoundState` (local to `BattleScene`)

```typescript
// Local state inside BattleScene, no export needed
interface AoaRoundState {
  usedThisRound: boolean;   // true once player uses or declines AOA this round
}
```

Initialise as `{ usedThisRound: false }` in `create()` and reset in `startCommandPhase()`.

### `BattlePhase` union (`BattleScene.ts` — local type)

Add one value to the existing phase type:

```typescript
type BattlePhase =
  | 'command'
  | 'executing'
  | 'auto'
  | 'all-out-attack-prompt';   // ← new
```

### `DamageResult` (`battle/DamageCalc.ts`)

No change — `isWeaknessHit` is already returned.

---

## UI Changes

### Execution Flow — `applyDamageAndAdvance()` (`BattleScene.ts:726`)

After the existing damage + animation block, add:

```
if (result.isWeaknessHit && target.alive) {
  target.knockedDown = true
  applyWeaknessBonus(attacker, target.stats.hp, true, remainingQueue)  // existing fn
  if (!aoaState.usedThisRound && allEnemiesKnockedDown()) {
    enterAoaPrompt()   // pause queue, show prompt
    return             // do NOT call executeNextInOrder yet
  }
}
```

### Knock-Down Visual Indicator

- When `knockedDown = true`, the enemy sprite plays its existing hit/stagger animation **continuously** (loop frames 0–3 of the Hit animation clip).
- A small icon (e.g., downward arrow or `↓` text label) appears above the knocked-down enemy's HP bar.
- Color: yellow (`#FFD700`).

### AOA Prompt Screen (`'all-out-attack-prompt'` phase)

**Layout (full-screen overlay on top of battle scene):**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│           ★ ALL ENEMIES DOWN! ★                         │
│                                                         │
│    [  ALL-OUT ATTACK!  ]   [  PASS  ]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Background: semi-transparent dark overlay (`rgba(0,0,0,0.65)`).
- Headline text: large, bold, yellow (`#FFD700`), with a brief shake/bounce tween (0.3 s).
- "ALL-OUT ATTACK!" button: bright red background, white text, slight pulse animation.
- "PASS" button: grey, no animation.
- Keyboard: `Z` / Enter confirms AOA; `X` / Escape passes.

### AOA Animation Sequence

1. **Rush-in (0.4 s):** All alive party sprites tween from their current position off to the right edge of the screen at high speed (mirrored — they run toward the enemies).
2. **Impact flash (0.2 s):** White screen flash (`Graphics` fill).
3. **Damage numbers (0.5 s):** All damage values pop simultaneously on each enemy (stacked, different vertical offsets).
4. **Sprites return (0.3 s):** Party sprites tween back to their original positions.
5. **Death resolution:** Enemy death animations play for any enemy whose HP ≤ 0.
6. **Resume:** Call `checkBattleEnd()`; if battle continues, start next command phase.

Sound: play the existing `atk` SFX at the start of step 2, then `hit` SFX for each damaged enemy.

---

## Acceptance Criteria

### Core Trigger

**Given** a battle with two alive enemies, both vulnerable to specific elements  
**When** the player hits enemy A's weakness (leaving A alive and knocked down), then on the bonus turn hits enemy B's weakness (leaving B alive and knocked down)  
**Then** the `'all-out-attack-prompt'` phase activates immediately after the second weakness hit and the turn queue is paused.

---

**Given** a battle where one enemy has already been knocked down  
**When** the player kills a second enemy without triggering a weakness hit  
**Then** no AOA prompt appears (dead enemies excluded, and the surviving knocked-down enemy alone does not satisfy the "all alive enemies" condition).

---

**Given** a battle containing a boss enemy  
**When** the player hits the boss's weakness  
**Then** `knockedDown` is NOT set on the boss, and no AOA prompt appears regardless of other enemies' state.

---

### AOA Damage

**Given** AOA is triggered with a party of 3 alive members against 2 alive enemies  
**When** the player confirms All-Out Attack  
**Then** each member deals `floor(member.atk * 0.5)` (min 1) to each enemy, for a total of 6 damage applications, all applied before any death check.

---

### Decline Path

**Given** the AOA prompt is displayed  
**When** the player selects Pass  
**Then** `aoa.usedThisRound` is set to `true`, the turn queue resumes from the paused position, and no further AOA prompt appears this round even if another weakness hit occurs.

---

### Round Reset

**Given** a round where the player declined AOA  
**When** the round ends and the next command phase begins  
**Then** `aoa.usedThisRound` is reset to `false`, `knockedDown` is reset on all characters, and the AOA mechanic is fully available again.

---

### Knock-Down Visual

**Given** an enemy is knocked down  
**When** the battle scene re-renders  
**Then** the enemy sprite loops its Hit animation frames and shows a yellow `↓` indicator above its HP bar.

---

### AOA Kills All Enemies

**Given** AOA deals enough damage to kill all remaining enemies  
**When** the AOA animation completes  
**Then** the battle end condition is checked, the victory screen appears, and the result scene plays normally.
