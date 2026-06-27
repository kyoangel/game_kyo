# pixel-squad: 音樂 (Background Music)

## Goal

Add looping background music per scene-context (title, basecamp/menus, battle, victory/defeat stingers) with its own independent mute toggle, without breaking the existing SFX mute control.

## Rules

1. **Track groups, not per-scene tracks.** Define 3 loop tracks: `title`, `theme` (basecamp/world-map/shop/prep — anywhere outside battle), `battle`. Plus 2 one-shot stingers: `victory`, `defeat`.
2. **No restart on same-track scene transitions.** `BaseScene → WorldMapScene → ShopScene → PrepScene` all request the `theme` track. If `theme` is already playing, `MusicManager.playTrack('theme')` is a no-op — the loop keeps playing uninterrupted across scene swaps.
3. **Crossfade on track change.** Switching to a *different* track (e.g. `theme` → `battle`) fades the old track out and the new one in over 500ms, rather than hard-cutting.
4. **Stingers don't loop and don't get tracked as "current track".** `ResultScene` plays `victory` or `defeat` once (no loop). Returning to `BaseScene`/`WorldMapScene` afterward resumes `theme` as normal (since the stinger never became `currentTrack`, `theme` correctly registers as a track change and plays).
5. **Independent mute from SFX — critical constraint.** `SfxManager` already calls `this.sound.mute = muted` on the shared `Phaser.Sound.BaseSoundManager` (`src/audio/SfxManager.ts:13,30`). Since scene `sound` is the same singleton across the whole game, `MusicManager` **must not** touch `sound.mute` — doing so would silence (or unsilence) SFX as a side effect. Instead `MusicManager` controls volume directly on the `Phaser.Sound.BaseSound` instance it owns (set volume to `0` when muted, restore to the track's target volume when unmuted).
6. **Persisted separately.** Music mute state persists to `localStorage` under key `pixel-squad:musicMuted`, independent of `pixel-squad:sfxMuted`.
7. **Respect mute on construction and on every `playTrack`/crossfade.** If music is muted when a new track starts, the new track still plays (so unmuting resumes the correct track) but at volume 0.
8. **One active loop at a time.** Starting a new track stops/destroys the previous `Phaser.Sound.BaseSound` instance after its fade-out completes (no lingering silent loops accumulating in memory).
9. **No real audio assets in this pass.** Like the prior SFX feature, this spec covers the data/manager/scene-wiring layer with placeholder asset paths under `audio/`. Sourcing/producing actual `.mp3` files is out of scope and tracked separately.

## Data model changes

`src/data/audio.ts` — add alongside existing `SFX_KEYS`/`SFX_ASSETS`:

```ts
export const MUSIC_KEYS = {
  title: 'music_title',
  theme: 'music_theme',
  battle: 'music_battle',
  victory: 'music_victory',
  defeat: 'music_defeat',
} as const;

export type MusicKey = typeof MUSIC_KEYS[keyof typeof MUSIC_KEYS];

export const MUSIC_ASSETS: Record<MusicKey, string> = {
  [MUSIC_KEYS.title]: 'audio/music_title.mp3',
  [MUSIC_KEYS.theme]: 'audio/music_theme.mp3',
  [MUSIC_KEYS.battle]: 'audio/music_battle.mp3',
  [MUSIC_KEYS.victory]: 'audio/music_victory.mp3',
  [MUSIC_KEYS.defeat]: 'audio/music_defeat.mp3',
};

export const MUSIC_LOOP_KEYS: ReadonlySet<MusicKey> = new Set([
  MUSIC_KEYS.title, MUSIC_KEYS.theme, MUSIC_KEYS.battle,
]);

export const MUSIC_VOLUME = 0.4;
export const MUSIC_FADE_MS = 500;
```

New file `src/audio/MusicManager.ts` (mirrors `SfxManager` shape, registered in `game.registry` under key `'music'`):

```ts
export class MusicManager {
  constructor(sound: Phaser.Sound.BaseSoundManager);
  static loadMuted(): boolean;
  static preload(scene: Phaser.Scene): void;

  playTrack(key: MusicKey): void;   // no-op if key === currentKey and still playing
  toggleMute(): boolean;
  isMuted(): boolean;
}

export function getMusic(scene: Phaser.Scene): MusicManager;
```

Internal state: `currentKey?: MusicKey`, `currentSound?: Phaser.Sound.BaseSound`, `muted: boolean`. `playTrack` creates the new sound (loop = `MUSIC_LOOP_KEYS.has(key)`, volume = `muted ? 0 : MUSIC_VOLUME`), tweens it in over `MUSIC_FADE_MS` while tweening the old sound's volume to 0 and destroying it on tween complete.

## UI changes

- **TitleScene**: add a second icon next to the existing `🔊`/`🔇` SFX mute icon at `(336, 16)` — a `🎵`/`🔇` music mute icon at `(336, 40)` (directly below), wired to `getMusic(this).toggleMute()`. Calls `MusicManager.preload(this)` alongside `SfxManager.preload(this)` in `preload()`. Calls `getMusic(this).playTrack(MUSIC_KEYS.title)` in `create()` (skipped on the `?e2e=1` bypass path, same as today's behavior of skipping other title UI).
- **BaseScene / WorldMapScene / ShopScene / PrepScene**: each scene's `create()` calls `getMusic(this).playTrack(MUSIC_KEYS.theme)`. Because all four request the same key, moving between them produces no audible restart/gap.
- **BattleScene**: `create()` calls `getMusic(this).playTrack(MUSIC_KEYS.battle)`.
- **ResultScene**: `create()` calls `getMusic(this).playTrack(victory ? MUSIC_KEYS.victory : MUSIC_KEYS.defeat)` once (non-looping stinger plays to completion and stops naturally; no manual stop needed since `loop: false`).

## Acceptance criteria

- **Given** the title screen loads, **when** `TitleScene.create()` runs, **then** the `title` track starts looping at `MUSIC_VOLUME`.
- **Given** music is playing the `theme` track in `BaseScene`, **when** the player navigates to `WorldMapScene`, **then** the same `Phaser.Sound` instance keeps playing (no restart, no fade) because the requested key is unchanged.
- **Given** the `theme` track is playing, **when** `BattleScene` starts and requests `battle`, **then** `theme` fades out over `MUSIC_FADE_MS` while `battle` fades in over the same duration, and only one `Phaser.Sound` instance is alive once the fade completes.
- **Given** music is muted via the title-screen icon, **when** any scene calls `playTrack`, **then** the new track plays at volume `0` (audibly silent) and the mute icon reflects muted state across scene reloads (persisted to `localStorage['pixel-squad:musicMuted']`).
- **Given** music is muted, **when** the player toggles the SFX mute icon, **then** SFX mute state changes but music remains independently muted (and vice versa) — i.e. `sound.mute` on the shared `Phaser.Sound.BaseSoundManager` is never written by `MusicManager`.
- **Given** a battle ends in victory, **when** `ResultScene` loads, **then** the `victory` stinger plays once without looping, and returning to `BaseScene` afterward resumes the `theme` track (treated as a normal track change since the stinger was the last `currentKey`).
- **Given** `MusicManager.preload` runs, **then** `scene.load.audio` is called once per entry in `MUSIC_ASSETS` (5 calls).
