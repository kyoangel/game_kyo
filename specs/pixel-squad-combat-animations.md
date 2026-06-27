# Pixel Squad — 角色攻擊動作 (Combat Animation States)

## Goal

Replace the static protagonist sprite / colored-rectangle stand-ins in `BattleScene` with a sprite animation system that plays Idle, Walk, Attack, Hit, Die, and Skill-cast animations at the right moments in the command/execution battle loop.

## Current state (research findings)

- `src/data/sprites.ts` already declares the LPC-layout protagonist sheet (`character_rogue.png`, 320×320, 10 cols × 10 rows, 32×32/frame) with documented rows: 0–3 Walk (Up/Left/Down/Right, 9 frames), 4–7 Attack (Up/Left/Down/Right, 6 frames), 8 Death (6 frames), 9 Idle/Gesture. **No Hurt row exists for the protagonist sheet.**
- `src/battle/SpriteSelection.ts` (`shouldUseProtagonistSprite`) only renders the protagonist as a sprite (single static frame, `protagonistIdle` key) when `char.isProtagonist && char.isPlayer`. Every other character (recruits, enemies) is a plain colored `Rectangle` (`BattleScene.renderParty`, src/scenes/BattleScene.ts:164-201).
- `MONSTER_FRAMES` in `src/data/sprites.ts` already defines per-monster `idle/walk/attack/hurt/death` frame arrays, and the PNG frames exist on disk (`public/sprites/monsters/*`), but nothing in `src/` ever loads or references `MONSTER_FRAMES` — monsters are still rectangles today. (Wiring monster art is the next backlog item, "像素怪物素材" — out of scope here, but this spec's animation controller must be monster-frame-shape-compatible so that item can plug in without a second redesign.)
- `BattleScene` has no Phaser `anims` usage anywhere in the codebase (`grep` confirms zero `this.anims` / `anims.create` calls).
- Combat is fully scripted through callback chains: `applyDamageAndAdvance`, `applyHealAndAdvance`, `applyBuffAndAdvance`, `checkBattleEnd`, all gated by `this.time.delayedCall(900, …)`. These are the natural hook points for animation triggers — each already has a `next()` continuation we can delay until an animation completes.
- Existing SFX hooks (`SFX_KEYS.attack`, `.hit`, `.crit`, `.heal`, `.buff`, `.victory`, `.defeat`) already fire at the same call sites animations need to trigger from — sound and animation will be kept in sync by triggering both from the same function.

## Rules

1. **Animation states**: `idle | walk | attack | hit | die | skill`. Only the protagonist has real frame data today; all other characters (rectangle bodies) get a **non-sprite fallback** (tween-based: scale/move/tint) so the system works uniformly across sprite and rectangle bodies without an `if (isSprite)` branch at every call site.
2. **Idle**: default state for any alive character not currently acting. Sprite bodies loop the Idle row (row 9, single gesture frame — since it's 1 distinct pose, "loop" degrades to static; if more idle frames are added later the controller already supports N-frame loops). Rectangle bodies show a subtle idle "breathing" tween (slow scaleY 1.0↔1.03, 1200ms yoyo loop) so non-sprite characters aren't completely static either.
3. **Walk**: plays when a character steps up to act. Player characters step toward the enemy side (x + 24px) and back; enemies step toward the player side (x - 24px) and back. For sprite bodies, this uses the Walk-Right row for players / Walk-Left row for enemies, scrubbed across the forward leg of the move only (no walk frames on the return leg — character is already turning to Attack). For rectangle bodies, it's a positional tween only (no frame change), duration 220ms out / 220ms back.
4. **Attack**: melee-style "lunge" — plays immediately after Walk's forward leg completes, synced with the existing `SFX_KEYS.attack` call in `applyDamageAndAdvance`. Sprite bodies play Attack-Right (players) / Attack-Left (enemies), 6 frames, ~360ms total (60ms/frame), once. Rectangle bodies do a quick scale-punch (scaleX 1.0→1.15→1.0, 150ms) at the same moment.
5. **Skill cast**: plays instead of Attack when `cmd.action === 'skill'`. Sprite bodies use the Idle/Gesture row frame held for the cast duration with a color flash overlay (additive white→transparent, 250ms) layered on top — this distinguishes "casting" from "swinging" without new frame art. Rectangle bodies get the same flash overlay, no scale-punch. Buff/heal skills use a green/blue tinted flash respectively (matches existing `SFX_KEYS.heal` / `.buff` calls); damage skills use white.
6. **Hit / Hurt reaction**: plays on the **target** the instant damage is applied (same tick as `target.stats.hp -= dmg` in `applyDamageAndAdvance`). Since the protagonist sheet has no Hurt row, ALL bodies (sprite and rectangle) use the same fallback: red tint flash (`0xff0000` alpha 0.6 → 0, 200ms) + a small horizontal shake (±6px, 3 oscillations, 220ms total). This keeps hit-reaction visually consistent across protagonist/recruits/enemies regardless of asset availability, and costs nothing to extend later if a real Hurt row is added (the controller's `playHit()` entry point can be swapped to use frames without changing call sites).
7. **Crit hit**: same Hit reaction but the tint flash is brighter/longer (alpha 0.85, 280ms) and adds a single extra shake oscillation — reuses the existing `isCrit` flag already threaded through `applyDamageAndAdvance`.
8. **Die**: plays once `target.alive` flips to `false` inside `applyDamageAndAdvance`, replacing the current instant `view.body.setAlpha(0.2)` in `updateHpBar`. Sprite bodies play the Death row (6 frames, 80ms/frame = 480ms) and hold the last frame at low alpha (0.3) instead of snapping to alpha 0.2 immediately. Rectangle bodies fade + rotate slightly (alpha 1→0.2, rotation 0→8°, 480ms) over the same duration. `updateHpBar`'s alive-check branch is removed; death visuals are owned entirely by the new `playDie()` call site.
9. **Animation completion gates the existing `delayedCall(900, …)` advance**, it does not add new delay on top of it for Attack/Hit (they fit inside the existing 900ms message window — Attack ~360ms + Hit ~220ms ≈ 580ms < 900ms, so no perceptible slowdown). Die is the one exception: `applyDamageAndAdvance`'s `next()` continuation waits for `Math.max(900, dieDuration + 200)` when the target died, so the death animation is never cut off.
10. **Interruption safety**: if a character's view is destroyed mid-animation (e.g., scene transition on victory/defeat), all running tweens for that view must be killed in `checkBattleEnd` before `scene.start('ResultScene', …)` — prevents "tween still running on destroyed game object" console warnings.
11. **No new asset requirement**: this spec ships entirely against existing assets (protagonist LPC sheet + tween-based fallbacks). Adding Walk/Attack/Death frame sheets for non-protagonist player characters (Rex, Nyx, etc.) is explicitly out of scope — they keep rectangle bodies with tween fallbacks until their own art exists.

## Data model changes

`src/types.ts` — no `Character` field changes needed (animation state is view-layer only, not battle-state). Add nothing to the serialized `Character` shape (must stay save-compatible).

New file `src/battle/AnimationState.ts`:

```typescript
export type AnimState = 'idle' | 'walk' | 'attack' | 'hit' | 'die' | 'skill';

export interface AnimRequest {
  state: AnimState;
  facing: 'left' | 'right'; // derived from isPlayer at call site
  isCrit?: boolean;          // 'hit' only
  flashTint?: 'white' | 'green' | 'blue'; // 'skill' only
}
```

New file `src/battle/CharacterAnimator.ts` — one instance per `CharacterView`, created alongside the view in `renderParty`:

```typescript
import Phaser from 'phaser';

export class CharacterAnimator {
  constructor(
    private scene: Phaser.Scene,
    private body: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
    private isSprite: boolean,
  ) {}

  playIdleLoop(): void { /* sprite: hold gesture frame; rect: scaleY breathing tween, loop -1 */ }
  playWalk(facing: 'left' | 'right', onForwardLegDone: () => void): void { /* position tween + optional frame scrub */ }
  playAttack(facing: 'left' | 'right', onComplete: () => void): void { /* sprite: Attack row anim; rect: scale-punch tween */ }
  playSkillCast(flashTint: 'white' | 'green' | 'blue', onComplete: () => void): void { /* idle hold + color flash tween */ }
  playHit(isCrit: boolean, onComplete: () => void): void { /* tint flash + shake tween, no row dependency */ }
  playDie(facing: 'left' | 'right', onComplete: () => void): void { /* sprite: Death row; rect: fade+rotate tween */ }
  returnToIdle(): void { /* reset position/scale/tint, resume idle loop */ }
  killAllTweens(): void { /* this.scene.tweens.killTweensOf(this.body) + any overlay objects */ }
}
```

`src/data/sprites.ts` additions — register the Phaser animation keys for the protagonist sheet (loaded once in `BattleScene.preload`):

```typescript
export const PROTAGONIST_ANIM_KEYS = {
  walkRight: 'protagonist_walk_right', // row 3, 9 frames
  walkLeft: 'protagonist_walk_left',   // row 1, 9 frames
  attackRight: 'protagonist_attack_right', // row 7, 6 frames
  attackLeft: 'protagonist_attack_left',   // row 5, 6 frames
  death: 'protagonist_death',               // row 8, 6 frames
  idle: 'protagonist_idle_gesture',         // row 9, single frame
} as const;
```

`CharacterView` (in `BattleScene.ts`) gains one field:

```typescript
interface CharacterView {
  body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  animator: CharacterAnimator; // NEW
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  archetypeText: Phaser.GameObjects.Text;
}
```

## UI changes (scene-level)

**`BattleScene.preload()`**: switch from `this.load.image(SPRITE_KEYS.protagonistIdle, …)` to `this.load.spritesheet(SPRITE_KEYS.protagonistSheet, SPRITE_SHEET_ASSETS[...].path, { frameWidth: 32, frameHeight: 32 })`. In `create()`, register the 5 `anims.create(...)` definitions (idle, walkLeft/Right, attackLeft/Right, death) once using `PROTAGONIST_ANIM_KEYS`, guarded by `if (!this.anims.exists(key))` so repeated battle entries don't throw on duplicate creation.

**`renderParty`**: construct a `CharacterAnimator` per character and store it on the view; call `animator.playIdleLoop()` immediately after creation so every body (sprite or rectangle) idles by default.

**`executePlayerCommand` / `executeEnemyAction` / `executeBossPhaseAction`**: before computing damage, call `view.animator.playWalk(facing, () => { /* then trigger attack or skill cast */ })` for attack/skill actions; defend keeps no walk/attack (character just visually "braces" — reuse a short scale-down tween, not in scope of this rewrite beyond a no-op for v1, can ship as a stretch task).

**`applyDamageAndAdvance`**: sequence becomes: walk → attack/skill-flash anim → on attack-complete, apply `target.stats.hp -= dmg` and call `view(target).animator.playHit(isCrit, …)` → if target died, `playDie()` instead of the hit's return-to-idle → call attacker's `animator.returnToIdle()` once its anim completes.

**`applyHealAndAdvance` / `applyBuffAndAdvance`**: route through `playSkillCast('blue', …)` / `playSkillCast('green', …)` on the caster; no walk step needed for self/ally-targeted skills (caster doesn't need to approach itself or a same-side ally).

**`updateHpBar`**: remove the `if (!char.alive) { view.body.setAlpha(0.2); … }` branch — death visuals now owned by `playDie()`, called once from `applyDamageAndAdvance` at the moment `alive` flips false.

**`checkBattleEnd`**: before `scene.start('ResultScene', …)`, iterate `this.views.values()` and call `animator.killAllTweens()`.

## Acceptance criteria

- **Given** the protagonist is the active player character in command phase, **when** the command phase starts, **then** the protagonist sprite plays the idle gesture frame (no longer a single frozen image swap only at scene load).
- **Given** a player character (sprite or rectangle) executes a basic attack, **when** `applyDamageAndAdvance` fires, **then** the body visibly steps toward the enemy side, plays an attack motion (frame animation for protagonist, scale-punch for rectangle bodies), and the SFX `attack`/`hit` cues remain audibly synced to the visual lunge and impact (not noticeably offset).
- **Given** any character takes non-fatal damage, **when** `target.stats.hp` is reduced, **then** that character's body flashes red and shakes, regardless of whether it's a sprite or rectangle body.
- **Given** a critical hit occurs (`isCrit === true`), **when** the hit animation plays, **then** the flash is visibly brighter/longer and the shake has one extra oscillation compared to a normal hit.
- **Given** a character's HP reaches 0, **when** `applyDamageAndAdvance` sets `alive = false`, **then** the character plays a death animation (Death row for protagonist, fade+rotate for rectangles) lasting ~480ms before settling at low alpha, and the existing `updateHpBar` no longer instantly snaps alpha on death.
- **Given** a character casts a heal or buff skill, **when** `applyHealAndAdvance` / `applyBuffAndAdvance` fire, **then** the caster plays a skill-cast flash (blue for heal, green for buff) instead of the attack lunge, with no walk step toward an enemy.
- **Given** battle ends (victory or defeat), **when** `checkBattleEnd` transitions to `ResultScene`, **then** no Phaser console warnings about tweens running on destroyed game objects appear (verified by killing all tweens for every view before `scene.start`).
- **Given** the existing unit test suite (`AI.test.ts`, `DamageCalc` tests, etc.) which only exercises pure functions, **when** this change ships, **then** all existing unit tests still pass unmodified (animation logic lives entirely in `CharacterAnimator`/`BattleScene`, not in any pure function under test).
- **Given** a non-protagonist player character (e.g., Rex) or any enemy (still a rectangle body today), **when** any of the above actions occur, **then** the rectangle-fallback tweens play correctly without throwing — confirming the system is sprite/rectangle-agnostic and ready for future monster/character art to plug in via the same `CharacterAnimator` interface.

## Follow-up items appended to backlog

- 像素怪物素材 wiring should consume `MONSTER_FRAMES` + this same `CharacterAnimator` interface (already monster-frame-shape-compatible) rather than introducing a second animation system.
