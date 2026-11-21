# game-kit juice layer (fx / audio / input / theme / save) and instant-results overlay

Status: approved design 2026-11-21. Consumer #1: dodge-drop 2.0 (`docs/specs/dodge-drop/v2-design.md`). Consumer #2: Neon Swarm (later).
Research basis: `docs/specs/game-design/research-arcade-dodge.md` (items #1 instant retry, #5 death juice, #6 audio feedback, #10 rewarded placements, #12 feel).

## Goals

- Every game built on game-kit gets "game feel" for free: particles, screen shake, hit-stop, flash, pop text, trails, glow, procedural SFX and music, mobile-friendly input, and a themed title/results flow.
- No binary assets: all audio is synthesized with WebAudio and all particles use runtime-generated textures. Build size per game stays ≤ 2 MB (research #3).
- Instant retry is a game-kit feature, not per-game code (research #1).
- Game and game-kit code still never branch on `platform.id`; behaviour differences go through `platform.features` (enforced by `scripts/rules.test.ts`).

## Non-goals

- No asset pipeline, sprite atlases, or audio files.
- No leaderboard, daily challenge, or analytics (dodge-drop 1.1 at the earliest).
- No changes to portal adapters beyond the new feature flag.

## 1. Platform: `features.rewardedAds`

`PlatformFeatures` gains `rewardedAds: boolean`.

| Adapter | value | reason |
|---|---|---|
| local | `true` | so rewarded UI is testable locally (local adapter already resolves `'rewarded'`) |
| site | `false` | no ads on own site until AdSense (phase 2); rewarded buttons must be hidden |
| crazygames | `true` | |
| gamedistribution | `true` | |

The shared contract test (`packages/platform/src/testing/contract.ts`) asserts the field is a boolean.

## 2. Module layout (`packages/game-kit/src/`)

| File | Phaser? | Responsibility |
|---|---|---|
| `juice/trauma.ts` | no | Trauma-based shake math: `addTrauma`, `decay`, `offset(trauma, maxPx, rng)` (offset = maxPx · trauma², per Eiserloh). Unit-tested. |
| `juice/fx.ts` | yes | `createFx(scene): Fx` — burst, shake, hitStop, flash, popText, trail, glow. |
| `juice/textures.ts` | yes | Generates shared textures once per game (`gk-dot` 8px soft circle, `gk-spark` 4×12 streak, `gk-bg` vertical gradient). |
| `audio/notes.ts` | no | Pitch math: `pentatonic(step, base)` → Hz, clamps step to 0..14. Unit-tested. |
| `audio/sfx.ts` | no (WebAudio only) | SFX preset table + `playSfx(ctx, dest, name, opts)`. |
| `audio/music.ts` | no (WebAudio only) | Look-ahead step sequencer with up to 4 layers (bass, drums, arp, lead) at 120 BPM; `setLayers(n)`. Pattern data is pure and unit-tested. |
| `audio/audio.ts` | no | `GameAudio` facade: lazy `AudioContext`, unlock on first gesture, master gain, mute (persisted), ad-pause mute. Unit-tested with a fake AudioContext. |
| `input/vector.ts` | no | Pure math: `keyVector(keys)`, `joystickVector(origin, pointer, radius)` (clamped to length 1, 8 px dead zone). Unit-tested. |
| `input/input.ts` | yes | `createInput(scene, opts): GameInput` — keyboard (arrows + WASD), floating joystick, relative drag. |
| `theme.ts` | no | `Theme` type, `DEFAULT_THEME`, `resolveTheme(partial)`, `hex(color)` helpers. Unit-tested. |
| `save.ts` | no | `SaveData` over `platform.storage` with the slug prefix: `getNumber/setNumber/getJSON/setJSON`. Unit-tested. |
| `scenes/TitleScene.ts` | yes | Rewritten: themed (§6). |
| `scenes/GameOverScene.ts` | yes | Rewritten as the overlay (§7). |
| `ui/button.ts` | yes | `addButton(scene, x, y, label, opts)` themed rounded button with press scale, returns the container. |

Everything new is exported from `packages/game-kit/src/index.ts`.

## 3. Fx API

```ts
interface Fx {
  burst(x: number, y: number, opts?: { color?: number; count?: number; speed?: number; lifespanMs?: number }): void; // defaults: count 24, speed 420, lifespan 600
  shake(trauma: number): void;          // adds trauma (0..1, summed and clamped to 1); camera offset = 18px · trauma², decays 1.6/s
  hitStop(ms: number): Promise<void>;   // freezes scene time + physics for ms (real time), then resumes
  flash(color?: number, ms?: number): void; // full-screen additive flash, default white 120 ms
  popText(x: number, y: number, text: string, opts?: { color?: number; size?: number }): void; // rises 60px, scales 1.3→1, fades over 700 ms
  trail(target: Phaser.GameObjects.Components.Transform, opts?: { color?: number }): { stop(): void }; // particle trail following target
  glow(obj: Phaser.GameObjects.GameObject, color: number, strength?: number): void; // preFX glow in WebGL; no-op in Canvas
  timeScale(scale: number, ms: number): Promise<void>; // slow-motion: scene.time.timeScale + tweens.timeScale, restored after ms (real time)
}
```

- `glow` checks `scene.renderer.type === Phaser.WEBGL` and silently does nothing otherwise (Canvas fallback).
- Shake uses its own trauma offset applied to `camera.setScroll` in a `postupdate` listener, not `camera.shake` (so repeated hits accumulate correctly).
- All fx objects are cleaned up on scene `shutdown`.

## 4. Audio API

```ts
type SfxName = 'nearMiss' | 'pickup' | 'shield' | 'shieldBreak' | 'death' | 'medal' | 'click' | 'rush' | 'newBest';
interface GameAudio {
  sfx(name: SfxName, opts?: { step?: number }): void; // step raises pitch along a pentatonic scale (nearMiss combo)
  music: { start(): void; stop(): void; setLayers(n: 1 | 2 | 3 | 4): void };
  readonly muted: boolean;
  toggleMute(): Promise<void>; // persisted as save key "muted"
}
```

- Exposed as `kit.audio` (one per game).
- The `AudioContext` is created lazily and resumed on the first `pointerdown`/`keydown` (browser autoplay rules). Before unlock, calls are silent no-ops; they never throw.
- Ad pause (`session.onPauseChange`) sets the master gain to 0 and suspends the music clock; resume restores the user's mute choice.
- Master volume: SFX 0.5, music 0.25. Music layers fade in over one bar when `setLayers` increases.
- If `AudioContext` is unavailable (old browser, test), `GameAudio` becomes a silent stub.

## 5. Input API

```ts
interface GameInput {
  vector(): { x: number; y: number };  // keyboard OR floating joystick, length ≤ 1
  dragDx(): number;                     // relative horizontal drag since last call, in game pixels (consumed on read)
  readonly usingTouch: boolean;
}
createInput(scene, { joystick?: boolean /* default true */, joystickRadius?: number /* default 90 */ })
```

- Floating joystick: the base appears where the finger lands, the knob follows within `joystickRadius`, both drawn at 35% alpha in the theme accent colour; hidden when not touching.
- `dragDx` reports pointer movement while down, independent of the joystick, so a game can choose relative-drag control (dodge-drop) or joystick control (Neon Swarm).

## 6. Theme and title scene

```ts
interface Theme {
  bgTop: number; bgBottom: number;   // background gradient
  primary: number; accent: number; danger: number; text: number; muted: number;
  font: string;                      // CSS font stack
}
```

`DEFAULT_THEME` ("bright neon"): `bgTop 0x2b1d7a` (indigo), `bgBottom 0x7a2fb0` (violet), `primary 0x3ff0ff` (cyan), `accent 0xffe14d` (yellow), `danger 0xff4fa3` (hot pink), `text 0xffffff`, `muted 0xc9b8ff`, font `"Trebuchet MS", "Segoe UI", system-ui, sans-serif`.

`GameDefinition` gains:

```ts
theme?: Partial<Theme>;
scenes?: Array<new () => Phaser.Scene>;          // extra game scenes, registered after Play
titleMenu?: Array<{ labelKey: string; scene: string }>; // buttons on the title screen → kit.goTo(scene)
titleBackdrop?: (scene: Phaser.Scene) => void;   // optional animated decoration behind the title
results?: (scene: Phaser.Scene, ctx: ResultsContext) => void; // game-specific results content (§7)
```

`backgroundColor` stays for compatibility; when `theme` is set, every kit scene draws the `gk-bg` gradient instead.

Title screen: gradient background, `titleBackdrop`, title text with a pulsing glow, "Tap to start" blinking at 1 Hz, best score, `titleMenu` buttons, mute toggle in the top-right corner. Tapping a menu button must not also start the game.

New Kit methods: `goTo(sceneKey, data?)` (public version of `switchTo`), `addMuteButton(scene, x, y)`, `theme` (resolved), `audio`, `save`, `fx(scene)` and `input(scene, opts)` (thin wrappers over `createFx`/`createInput`).

## 7. Instant-results overlay (`GKGameOver`)

`kit.gameOver(score, opts?)` changes from "stop everything, start GKGameOver" to:

1. The play scene is **paused, not stopped**, and `GKGameOver` is **launched on top** of it. The frozen play field stays visible under a 55% dark scrim.
2. **Revive offer.** If `opts.revive` is given, `platform.features.rewardedAds` is true, and revive has not been used this run, the overlay first shows a revive panel: "Revive" button with a rewarded-ad icon, a "No thanks" link, and a 5 s countdown ring that auto-declines. The session stays `'playing'` during the offer.
   - On `'rewarded'`: stop the overlay, resume the play scene, call `opts.revive()`. Revive is used for this run.
   - Otherwise (skipped, unavailable, declined, timeout): continue to step 3.
3. **Commit.** Call `session.gameOver(score)`, which sets state to `'over'` and persists best. Then show results.
4. **Results.** Score counts up over 400 ms, "NEW BEST!" banner (accent colour, burst plus `newBest` sfx) when `score > previousBest && score > 0`, best score, then the game's `results(scene, ctx)` hook content, then "Tap anywhere to retry" and a small Home button.
5. **Retry.** After a 400 ms input guard, any tap outside a button, or Space/Enter, calls `kit.retry()`. `kit.retry()` stops the overlay and restarts the play scene (`scene.stop` + `scene.start`). The interstitial gate stays in `session.retry()`, unchanged.
6. **Home.** Calls `kit.goTo('GKTitle')`.

```ts
interface ResultsContext { score: number; best: number; newBest: boolean; top: number /* y where the hook may draw */; rewardedAds: boolean }
interface GameOverOptions { revive?: () => void }
```

- `newBest` is computed before `session.gameOver` updates best.
- The `__gk.endRound(score)` test hook calls `kit.gameOver(score)` with no revive, so it commits immediately (the smoke test expectation "state over + GKGameOver active" still holds).
- `revive` is tracked by the Kit per run and reset by `kit.start()` and `kit.retry()`.

## 8. Save data

`SaveData` (exposed as `kit.save`) keys are `<slug>:<key>`, giving storage keys `gk:<slug>:<key>` (same scheme as `best`). Corrupt or missing values return the supplied default and never throw. Reserved key: `muted`.

## 9. Testing

- Unit: trauma, notes, music patterns, audio facade (fake AudioContext: no throw before unlock, mute persisted, ad-pause gain 0), input vector math, theme resolution, save data defaults and corruption, Kit revive bookkeeping (revive once per run, reset on retry), platform `rewardedAds` per adapter.
- e2e smoke stays green unchanged.
- New e2e `e2e/results.spec.ts` (local build): end a round via hook → `activeScenes` contains `GKGameOver` and the new hook `__gk.pausedScenes` contains `Play` (paused, not stopped) → click the canvas → `state === 'playing'` within 1 s.
