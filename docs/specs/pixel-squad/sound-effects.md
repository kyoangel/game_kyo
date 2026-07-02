# Pixel Squad — Sound Effects (SFX)

## Goal
Add a centralized SFX system that plays short audio cues for combat actions and UI interactions, with a per-save mute toggle, using Phaser's built-in Sound Manager.

## Background (current state)
- No audio code exists anywhere in `src/` today — `grep -ri "sound|audio"` returns zero matches.
- `package.json` has only `phaser ^3.88.0` as a runtime dependency; Phaser's Sound Manager (WebAudio with HTML5Audio fallback) is available out of the box, no new dependency needed.
- Sprite assets follow a `SPRITE_KEYS` / `SPRITE_ASSETS` map pattern in `src/data/sprites.ts`, loaded via `this.load.image(...)` in `BattleScene.preload()`. SFX should follow the same key/asset-map convention for consistency.
- There is no `public/sprites/` or `public/audio/` directory checked in yet — asset files are expected to be dropped in by the art/audio pass; the loader code must not throw if a file 404s (Phaser logs a console warning and continues, so this is already safe by default — no extra guard needed).
- `GameState` (`src/types.ts:165`) is the persisted save shape (slot-based, via `SaveSystem.ts`). It has no settings/preferences field today.
- Relevant gameplay hook points already identified in `BattleScene.ts`:
  - `applyDamageAndAdvance` (~line 688) — normal hit, shows `-{dmg} HP` message; `isCrit` flag available here.
  - `applyHealAndAdvance` (~line 698) — heal amount applied.
  - `applyBuffAndAdvance` (~line 706) — buff/debuff applied.
  - `attemptRecruitAction` (~line 554-563) — recruit success/fail.
  - Victory/defeat branch (~line 718, `victory = !enemyAlive`) — battle end.
  - ~72 `setInteractive`/`pointerdown` call sites across `BattleScene`, `PrepScene`, `ShopScene`, `WorldMapScene`, `TitleScene`, `ResultScene` — these are the UI click hook points.
- `LevelUpSystem.ts` fires level-ups during `VictoryProcessor.ts` post-battle processing (not inside `BattleScene` directly).

## Rules
1. SFX play through a single shared `SfxManager` wrapping `Phaser.Sound.SoundManager`, instantiated once per scene from a `BaseScene` helper (or a Phaser registry-level singleton) so volume/mute state is shared across scene transitions.
2. Mute state is a single global boolean (`sfxMuted`), persisted in `localStorage` directly (NOT in `GameState`/save slots) — sound preference is a device preference, not game progress, so it must apply identically across all 3 save slots and survive "new game" without being reset.
3. Default state: SFX **on** (`sfxMuted = false`) for first-time players.
4. Every defined cue has a single canonical trigger point in code; no scene should call `sound.play` with a raw string key inline — always go through a named `SfxManager.play(SFX_KEYS.x)` method so cues stay discoverable and renameable.
5. Missing/404 audio files must not throw or block gameplay — rely on Phaser's default behavior (warns to console, `play()` on a missing key is a no-op) and design the manager so a failed load never throws synchronously.
6. Overlapping rapid triggers (e.g., multi-hit combo `連擊①/②`) must not be cut off — use `allowMultiple`/independent `Sound` instances per `play()` call (Phaser's `sound.play(key)` already spawns a new instance per call by default, satisfying this without extra code).
7. Victory and Defeat stingers are mutually exclusive and play exactly once per battle resolution, at the same point the `victory` boolean is computed (~`BattleScene.ts:718`), before transitioning to `ResultScene`.
8. Button-click SFX applies uniformly to all primary interactive UI elements (menu buttons, skill picker entries, shop buy/sell, world map stage select, title screen start/continue) — do not special-case any scene.
9. Crit hits play a distinct `sfxCrit` cue layered on top of (not replacing) `sfxHit`/`sfxAttack`.

## Data model changes

`src/data/audio.ts` (new file, mirrors `src/data/sprites.ts` pattern):

```ts
export const SFX_KEYS = {
  attack: 'sfx_attack',
  hit: 'sfx_hit',
  crit: 'sfx_crit',
  heal: 'sfx_heal',
  buff: 'sfx_buff',
  recruitSuccess: 'sfx_recruit_success',
  recruitFail: 'sfx_recruit_fail',
  victory: 'sfx_victory',
  defeat: 'sfx_defeat',
  levelUp: 'sfx_level_up',
  buttonClick: 'sfx_button_click',
  purchase: 'sfx_purchase',
} as const;

export type SfxKey = typeof SFX_KEYS[keyof typeof SFX_KEYS];

export const SFX_ASSETS: Record<SfxKey, string> = {
  [SFX_KEYS.attack]: 'audio/attack.mp3',
  [SFX_KEYS.hit]: 'audio/hit.mp3',
  [SFX_KEYS.crit]: 'audio/crit.mp3',
  [SFX_KEYS.heal]: 'audio/heal.mp3',
  [SFX_KEYS.buff]: 'audio/buff.mp3',
  [SFX_KEYS.recruitSuccess]: 'audio/recruit_success.mp3',
  [SFX_KEYS.recruitFail]: 'audio/recruit_fail.mp3',
  [SFX_KEYS.victory]: 'audio/victory.mp3',
  [SFX_KEYS.defeat]: 'audio/defeat.mp3',
  [SFX_KEYS.levelUp]: 'audio/level_up.mp3',
  [SFX_KEYS.buttonClick]: 'audio/button_click.mp3',
  [SFX_KEYS.purchase]: 'audio/purchase.mp3',
};
```

`src/audio/SfxManager.ts` (new file):

```ts
import Phaser from 'phaser';
import { SFX_KEYS, SFX_ASSETS, type SfxKey } from '../data/audio';

const MUTE_STORAGE_KEY = 'pixel-squad:sfxMuted';

export class SfxManager {
  private sound: Phaser.Sound.BaseSoundManager;
  private muted: boolean;

  constructor(sound: Phaser.Sound.BaseSoundManager) {
    this.sound = sound;
    this.muted = SfxManager.loadMuted();
    this.sound.mute = this.muted;
  }

  static loadMuted(): boolean {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  }

  static preload(scene: Phaser.Scene): void {
    Object.entries(SFX_ASSETS).forEach(([key, path]) => scene.load.audio(key, path));
  }

  play(key: SfxKey): void {
    this.sound.play(key);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.sound.mute = this.muted;
    localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted));
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}
```

`src/scenes/BaseScene.ts` — add a shared accessor so every scene reaches the same manager instance without re-instantiating it per scene (e.g. store on `this.game.registry` keyed `'sfx'`, lazily created):

```ts
protected getSfx(): SfxManager {
  if (!this.game.registry.has('sfx')) {
    this.game.registry.set('sfx', new SfxManager(this.sound));
  }
  return this.game.registry.get('sfx');
}
```

No changes to `GameState`/`SaveSystem` — mute preference deliberately bypasses the save system (see Rule 2).

## UI changes

- **TitleScene**: preload all SFX assets here (first scene loaded) via `SfxManager.preload(this)`, so later scenes don't pay a repeated load cost; play `sfxButtonClick` on Start/Continue/NG+ taps. Add a small mute icon (speaker glyph, top-right corner) that toggles `SfxManager.toggleMute()` and visually swaps icon state — this is the only scene that needs a visible mute control since the preference is global.
- **BattleScene**:
  - `applyDamageAndAdvance`: play `sfxAttack` when the action starts, `sfxHit` when damage lands, `sfxCrit` additionally if `isCrit`.
  - `applyHealAndAdvance`: play `sfxHeal`.
  - `applyBuffAndAdvance`: play `sfxBuff`.
  - `attemptRecruitAction`: play `sfxRecruitSuccess` or `sfxRecruitFail` based on outcome.
  - Victory/defeat branch (~line 718): play `sfxVictory` or `sfxDefeat` once, before scene transition to `ResultScene`.
  - All action-menu, skill-picker, and target-select interactive elements: play `sfxButtonClick` on `pointerdown`.
- **ResultScene**: play `sfxLevelUp` once per character that leveled up during this battle (data already available from `LevelUpSystem` output passed into the scene), staggered slightly if multiple level-ups occur so cues don't fully overlap into noise.
- **ShopScene**: play `sfxPurchase` on successful buy, `sfxButtonClick` on all other taps (browse/back/sell).
- **PrepScene / WorldMapScene**: play `sfxButtonClick` on squad-edit taps, stage-select taps, and navigation buttons.

## Acceptance criteria

- **Given** a fresh browser with no `localStorage` entry, **when** the game loads, **then** SFX play by default (muted = false).
- **Given** the player taps the mute icon on the Title screen, **when** they navigate through Battle/Shop/WorldMap scenes, **then** no SFX play in any scene until unmuted (mute state is global, not per-scene).
- **Given** the player reloads the page after muting, **when** the game loads again, **then** the mute state persists (read from `localStorage`, not from the save slot).
- **Given** a player has 3 different save slots, **when** they mute SFX while playing slot 0 and then switch to slot 1, **then** SFX remain muted (mute is not tied to `GameState`).
- **Given** an attacker lands a normal hit, **when** `applyDamageAndAdvance` runs, **then** `sfxAttack` and `sfxHit` both play, and `sfxCrit` does NOT play.
- **Given** an attacker lands a critical hit, **when** `applyDamageAndAdvance` runs with `isCrit = true`, **then** `sfxAttack`, `sfxHit`, and `sfxCrit` all play.
- **Given** a multi-hit combo (`連擊①` then `連擊②`) resolves in quick succession, **when** both hits land, **then** both `sfxHit` instances play fully without one cutting off the other.
- **Given** the enemy party is fully defeated, **when** the victory branch executes, **then** `sfxVictory` plays exactly once and `sfxDefeat` does not play.
- **Given** the player party is fully defeated, **when** the defeat branch executes, **then** `sfxDefeat` plays exactly once and `sfxVictory` does not play.
- **Given** an audio file referenced in `SFX_ASSETS` is missing from `public/audio/`, **when** the scene preloads and later calls `play()` on that key, **then** no exception is thrown and gameplay continues uninterrupted (console warning only).
- **Given** the player taps any primary button in Title/Battle/Shop/PrepScene/WorldMap, **when** the tap registers, **then** `sfxButtonClick` plays (verified by spot-checking at least one button per scene, not requiring every single interactive element).

## Out of scope (tracked separately in backlog)
- Background music — covered by the next backlog item ("音樂").
- Per-character voice lines.
- Volume sliders (binary mute/unmute only for this pass).
