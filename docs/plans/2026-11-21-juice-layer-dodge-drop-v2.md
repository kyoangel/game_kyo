# Juice Layer + Dodge Drop 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give game-kit a reusable "game feel" layer (fx, procedural audio, input, theme, save, instant-results overlay with rewarded revive) and rebuild dodge-drop on it as a publish-quality 2.0.

**Architecture:** Pure logic (math, patterns, economy, save, audio scheduling data) lives in Phaser-free modules with vitest unit tests; thin Phaser wrappers consume them. game-kit owns cross-game flow (title, results overlay, revive, retry); the game owns gameplay, economy, and skins and plugs into kit hooks.

**Tech Stack:** TypeScript (erasable syntax only, `.ts` import extensions), Phaser 3.90, WebAudio, vitest (jsdom), Playwright, Vite.

**Specs (read the sections your task names):** `docs/specs/game-platform/juice-layer.md` (JL §n) and `docs/specs/dodge-drop/v2-design.md` (DD).

**Status:** not started.

## Global Constraints

- Node ≥ 24; TS `erasableSyntaxOnly` (no enums, no parameter properties, no namespaces); relative imports use `.ts` extensions.
- No branching on `platform.id` anywhere in game or game-kit code (`scripts/rules.test.ts`); use `platform.features`.
- No binary assets (no image/audio files) in game-kit or dodge-drop; textures generated at runtime, audio synthesized with WebAudio.
- `dist-site/dodge-drop/` total ≤ 2 MB.
- Storage keys: `gk:<slug>:<key>` (via `platform.storage`, which already adds `gk:`; game-kit passes `<slug>:<key>`).
- Ads never reject; rewarded content only granted on `AdResult === 'rewarded'`; rewarded UI hidden when `features.rewardedAds === false`.
- `window.__gk` test hooks only when `__GK_TEST_HOOKS__` is true. Existing hook fields keep their meaning.
- Theme default values exactly as JL §6. Gameplay numbers exactly as DD.
- Every new user-facing string has `en` and `zh-TW`.
- dodge-drop stays site-only: `releases` entries remain `status: "todo"`.
- `npm run typecheck`, `npm test`, and `npm run test:smoke` pass at the end of every task.

---

### Task 1: Platform `rewardedAds` + game-kit pure foundations

**Files:**
- Modify: `packages/platform/src/types.ts`, `packages/platform/src/adapters/{local,site,crazygames,gamedistribution}.ts`, `packages/platform/src/testing/contract.ts`, adapter tests as needed.
- Create: `packages/game-kit/src/theme.ts` (+ `theme.test.ts`), `packages/game-kit/src/save.ts` (+ `save.test.ts`), `packages/game-kit/src/juice/trauma.ts` (+ test), `packages/game-kit/src/audio/notes.ts` (+ test), `packages/game-kit/src/input/vector.ts` (+ test).
- Modify: `packages/game-kit/src/index.ts` (export new pure modules).

**Interfaces (Produces):**
```ts
// platform types.ts
interface PlatformFeatures { externalLinks: boolean; leaderboard: boolean; rewardedAds: boolean }
// theme.ts
export interface Theme { bgTop: number; bgBottom: number; primary: number; accent: number; danger: number; text: number; muted: number; font: string }
export const DEFAULT_THEME: Theme;            // values from JL §6
export function resolveTheme(partial?: Partial<Theme>): Theme;
export function cssColor(color: number): string; // 0x3ff0ff -> '#3ff0ff'
// save.ts
export class SaveData {
  constructor(storage: PlatformStorage, slug: string);
  getNumber(key: string, fallback: number): Promise<number>;   // non-finite / missing -> fallback
  setNumber(key: string, value: number): Promise<void>;
  getJSON<T>(key: string, fallback: T): Promise<T>;            // parse error / missing -> fallback
  setJSON(key: string, value: unknown): Promise<void>;
}
// juice/trauma.ts
export function addTrauma(current: number, amount: number): number;  // clamp [0,1]
export function decayTrauma(current: number, dtSec: number, rate?: number): number; // rate default 1.6, floor 0
export function shakeOffset(trauma: number, maxPx: number, rng: () => number): { x: number; y: number }; // each axis = maxPx * trauma^2 * (rng()*2-1)
// audio/notes.ts
export const PENTATONIC: readonly number[]; // semitone offsets [0,2,4,7,9]
export function pentatonic(step: number, baseHz?: number): number; // base default 440; step clamped 0..14; octave = floor(step/5)
// input/vector.ts
export interface Vec { x: number; y: number }
export function keyVector(k: { left: boolean; right: boolean; up: boolean; down: boolean }): Vec; // normalized diagonal
export function joystickVector(origin: Vec, pointer: Vec, radius: number, deadZone?: number): Vec; // deadZone default 8 -> {0,0}; length clamped to 1
```

- [ ] **Step 1: Write failing tests**, minimum cases:
  - contract: `typeof p.features.rewardedAds === 'boolean'`; per-adapter test: local true, site false, crazygames true, gamedistribution true.
  - theme: `resolveTheme()` equals DEFAULT_THEME; partial override replaces only given keys; `cssColor(0x0000ff) === '#0000ff'`.
  - save: uses key `dodge-drop:coins` on the storage passed in (use an in-memory fake storage); `getNumber` returns fallback for missing, `'abc'`, `'Infinity'`; `getJSON` returns fallback on `'{bad'`; round-trips.
  - trauma: add clamps to 1; decay of 0.5 over 1 s at 1.6 → 0; offset is 0 at trauma 0; with rng ()=>1 and trauma 0.5, maxPx 18 → x = 4.5.
  - notes: `pentatonic(0) === 440`; `pentatonic(5) === 880`; `pentatonic(2)` ≈ 440·2^(4/12); step 99 clamps to 14; negative clamps to 0.
  - vector: keyVector left+up → (-√½, -√½); joystick within dead zone → 0; pointer 2× radius away → length 1.
- [ ] **Step 2: Run `npx vitest run packages` — confirm RED.**
- [ ] **Step 3: Implement.** Update all four adapters' `features`.
- [ ] **Step 4: GREEN; run `npm run typecheck && npm test`.**
- [ ] **Step 5: Commit** `feat(game-kit): add rewardedAds feature and pure juice foundations`, push.

---

### Task 2: Procedural audio (`GameAudio`)

**Files:** Create `packages/game-kit/src/audio/{sfx.ts,music.ts,audio.ts}` with tests `music.test.ts`, `audio.test.ts`. Modify `kit.ts`, `defineGame.ts`, `index.ts`.

**Consumes:** `pentatonic` (Task 1), `SaveData` (Task 1), `GameSession.onPauseChange`.

**Produces (JL §4):**
```ts
export type SfxName = 'nearMiss' | 'pickup' | 'shield' | 'shieldBreak' | 'death' | 'medal' | 'click' | 'rush' | 'newBest';
export interface GameAudio {
  sfx(name: SfxName, opts?: { step?: number }): void;
  music: { start(): void; stop(): void; setLayers(n: 1 | 2 | 3 | 4): void };
  readonly muted: boolean;
  toggleMute(): Promise<void>;
  unlock(): void;               // resume AudioContext; called from first gesture
  setAdPaused(paused: boolean): void;
  loadMuted(): Promise<void>;   // reads save key 'muted'
}
export function createGameAudio(save: SaveData, ctxFactory?: () => AudioContext | null): GameAudio;
// music.ts (pure data + scheduler)
export const BPM = 120;
export const LAYERS: readonly MusicLayer[]; // 4 layers in order bass, drums, arp, lead; each { name, steps: 16-step pattern of (note semitone | null) or drum hits }
export function stepsToSchedule(fromTime: number, toTime: number, nextStepTime: number, stepIndex: number): Array<{ time: number; step: number }>; // 16th notes at BPM
```
Kit gets `readonly audio: GameAudio`. `defineGame` creates it, `await audio.loadMuted()`, wires `session.onPauseChange(p => audio.setAdPaused(p))`, and registers a one-time `pointerdown`/`keydown` listener on `window` that calls `audio.unlock()`.

Behaviour rules:
- No AudioContext (factory returns null or constructor throws) → silent stub; every method is a safe no-op; `toggleMute` still persists.
- Before `unlock()` succeeds, `sfx`/`music.start` do nothing and do not throw.
- Master gain: sfx bus 0.5, music bus 0.25; muted or ad-paused → master gain 0. Ad resume restores to the user's mute state.
- Music: look-ahead scheduler (setInterval 25 ms, schedule 0.1 s ahead). `setLayers(n)` ramps new layer gains up over one bar (2 s), lowering ramps down over 0.3 s.
- SFX presets (oscillator + gain envelope; noise buffer for death/shieldBreak/drums): `nearMiss` short triangle blip at `pentatonic(step, 523.25)`; `pickup` two-note up chirp; `shield` rising sine sweep; `shieldBreak` noise burst + low thud; `death` descending saw sweep 400→60 Hz over 0.5 s + noise; `medal` 3-note arpeggio; `click` 30 ms square tick; `rush` rising sweep 200→1200 Hz; `newBest` 4-note arpeggio.

- [ ] **Step 1: Failing tests** with a hand-written fake AudioContext (records created nodes, `currentTime`, `resume()`): stub mode never throws; `toggleMute` writes `'1'`/`'0'` to save key `muted` (storage key `<slug>:muted`); `loadMuted` restores; `setAdPaused(true)` sets master gain value 0 and `false` restores 1 (or 0 if muted); `sfx` before unlock creates no oscillator; after unlock creates ≥1; `stepsToSchedule(0, 0.3, 0, 0)` returns steps at 0, 0.125, 0.25 (16th = 0.125 s at 120 BPM) with step indices 0,1,2; `LAYERS` has 4 entries each with 16 steps.
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + typecheck + full test + `npm run test:smoke`.**
- [ ] **Step 5: Commit** `feat(game-kit): add procedural sfx and layered music`, push.

---

### Task 3: Fx, textures, input, button, theme wiring in Kit/defineGame

**Files:** Create `packages/game-kit/src/juice/{fx.ts,textures.ts}`, `packages/game-kit/src/input/input.ts`, `packages/game-kit/src/ui/button.ts`. Modify `kit.ts`, `defineGame.ts`, `index.ts`. Add a vitest for Kit wiring where Phaser-free (e.g. `kit.save` prefix); Phaser modules are verified via e2e in Task 4/7.

**Consumes:** Task 1 trauma/vector/theme/save; Task 2 audio.

**Produces:**
```ts
// JL §3 Fx exactly; JL §5 GameInput exactly
export function createFx(scene: Phaser.Scene): Fx;
export function ensureTextures(scene: Phaser.Scene, theme: Theme): void; // 'gk-dot','gk-spark','gk-bg' (bg sized to game width/height), idempotent
export function addBackground(scene: Phaser.Scene): Phaser.GameObjects.Image; // draws gk-bg at depth -100
export function createInput(scene: Phaser.Scene, opts?: { joystick?: boolean; joystickRadius?: number }): GameInput;
export function addButton(scene: Phaser.Scene, x: number, y: number, label: string, opts?: { width?: number; height?: number; fill?: number; textColor?: number; fontSize?: number; onClick: () => void }): Phaser.GameObjects.Container;
// GameDefinition additions (JL §6):
theme?: Partial<Theme>; scenes?: Array<new () => Phaser.Scene>; titleMenu?: Array<{ labelKey: string; scene: string }>;
titleBackdrop?: (scene: Phaser.Scene) => void; results?: (scene: Phaser.Scene, ctx: ResultsContext) => void;
// Kit additions:
readonly theme: Theme; readonly save: SaveData; readonly audio: GameAudio;
fx(scene): Fx; input(scene, opts?): GameInput; goTo(key: string, data?: object): void; addMuteButton(scene, x, y): Phaser.GameObjects.Container;
```
- Scenes list order: `[PreloadScene, TitleScene, def.playScene, ...def.scenes, GameOverScene]`.
- `addButton`: rounded rect (radius 18) in `fill` (default theme.primary), text in theme font with 4 px dark stroke, scale 0.94 on press, `click` sfx, stops event propagation so a scene-wide tap handler does not also fire (use `pointerdown` on the button and set a flag consumed by scene handlers: export `consumeButtonTap(scene): boolean` returning true once if a button handled the current pointer).
- `addMuteButton`: speaker icon drawn with Graphics (no glyph fonts), toggles `kit.audio.toggleMute()`, redraws crossed when muted.
- Fx details per JL §3: hitStop pauses `scene.time`, `scene.tweens`, and sets a flag; implement with real-time `setTimeout` so it resumes even while scene time is frozen. Shake applies offset in `scene.events.on('postupdate')` using camera `setScroll(baseX + ox, baseY + oy)`. Glow uses `preFX.addGlow` only when `scene.renderer.type === Phaser.WEBGL`.
- [ ] Steps: failing test(s) for Phaser-free parts (save prefix via Kit construction with fake platform, scenes order via a pure helper `sceneList(def)` exported from defineGame) → RED → implement → GREEN → typecheck + test + smoke → commit `feat(game-kit): add fx, input, themed button and kit wiring`, push.

---

### Task 4: Themed title + instant-results overlay with revive

**Files:** Rewrite `packages/game-kit/src/scenes/{TitleScene.ts,GameOverScene.ts}`; modify `kit.ts`, `defineGame.ts` (hook `pausedScenes`), `builtinStrings.ts`; create `packages/game-kit/src/runFlow.ts` (+ `runFlow.test.ts`); create `e2e/results.spec.ts`; modify root `package.json` `test:smoke` to `npm run build:local && playwright test e2e/smoke.spec.ts e2e/results.spec.ts`.

**Consumes:** Tasks 1–3.

**Produces:**
```ts
// runFlow.ts — Phaser-free decision logic (unit-tested)
export class RunFlow {
  reset(): void;                                   // new run: revive available again
  canOfferRevive(hasReviveCb: boolean, rewardedAds: boolean): boolean; // all true AND not used
  markReviveUsed(): void;
}
export interface ResultsContext { score: number; best: number; newBest: boolean; top: number; rewardedAds: boolean }
export interface GameOverOptions { revive?: () => void }
// Kit
gameOver(score: number, opts?: GameOverOptions): Promise<void>; // JL §7 steps 1–3
retry(): Promise<void>;   // session.retry() then stop GKGameOver, stop+start play scene, flow.reset()
start(): void;            // also flow.reset()
// __gk hook addition: get pausedScenes(): string[]  (scenes with sys.isPaused())
```
- Builtin strings (en / zh-TW): `gk.revive` "Revive" / "復活", `gk.noThanks` "No thanks" / "不用了", `gk.newBest` "NEW BEST!" / "新紀錄！", `gk.tapRetry` "Tap anywhere to retry" / "點任意處重來", `gk.home` "Home" / "首頁", `gk.double` "×2" / "×2", `gk.coins` "Coins" / "金幣".
- Overlay behaviour exactly JL §7 (scrim 55%, revive panel with 5 s countdown ring, count-up score 400 ms, NEW BEST banner + burst + `newBest` sfx, results hook at `top`, 400 ms input guard, tap-anywhere / Space / Enter retry, Home button). Kit.gameOver must guard re-entry (second call while overlay up is ignored). `newBest` = `score > session.best && score > 0` captured before commit.
- Title per JL §6 (gradient, `titleBackdrop`, pulsing glow title, blinking "tap to start", best, `titleMenu` buttons via `addButton` + `kit.goTo`, mute button top-right at (width−60, 60); `titleMenu` buttons at x = width/2, y = height·0.72 + i·96, size 280×72; button taps don't start the game).
- [ ] **Step 1: Failing tests:** RunFlow (offer only when cb && rewardedAds && unused; after markReviveUsed false; reset re-enables); e2e `results.spec.ts`: boot local build, click to start, `endRound(5)` → `activeScenes` includes `GKGameOver`, `pausedScenes` includes `Play`, `state === 'over'`; wait 500 ms, click canvas center → within 1500 ms `state === 'playing'` and `activeScenes` includes `Play` and not `GKGameOver`; zero console errors.
- [ ] **Step 2: RED** (`npx vitest run packages/game-kit` and `npm run test:smoke`). **Step 3: Implement.** **Step 4: GREEN** typecheck + test + test:smoke.
- [ ] **Step 5: Commit** `feat(game-kit): themed title and instant-results overlay with rewarded revive`, push.

---

### Task 5: dodge-drop pure gameplay modules

**Files:** Create in `games/dodge-drop/src/`: `rng.ts` (+test), `waves.ts` (+test), `combo.ts` (+test), `economy.ts` (+test), `medals.ts` (+test). Keep `difficulty.ts` unchanged.

**Produces:**
```ts
// rng.ts
export function mulberry32(seed: number): () => number; // [0,1)
// waves.ts
export type WaveKind = 'rain' | 'wall' | 'stairs' | 'zigzag' | 'rainHeavy';
export interface Spawn { at: number; x: number; w: number; h: number; speedMul: number }
export const PLAYER_HITBOX_W = 44.8;
export const BLOCK_H = 40;
export function waveKindAt(t: number): WaveKind;      // 0–10 rain; then by 20 s blocks cycling wall→stairs→zigzag→rainHeavy
export function isRush(t: number): boolean;           // t >= 45 && (t - 45) % 45 < 4
export function planWave(kind: WaveKind, t: number, rng: () => number, width: number, prevGapX?: number): { spawns: Spawn[]; duration: number; gapX?: number };
// combo.ts
export const NEAR_MISS_PX = 28; export const COMBO_TIMEOUT = 2.5; export const MAX_MULT = 5;
export function horizontalGap(a: { x: number; w: number }, b: { x: number; w: number }): number; // edge-to-edge, <=0 means overlap
export function isNearMiss(gap: number): boolean;     // 0 < gap <= 28
export class Combo { count: number; sinceLast: number; get multiplier(): number; hit(): number /* returns points 5*mult after increment */; tick(dt: number): boolean /* true if reset */; reset(): void; }
// economy.ts
export interface Skin { id: string; shape: 'square' | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'star'; color: number | 'cycle'; trail: 'dots' | 'sparks'; trailColor: number | 'rainbow'; cost: number }
export const SKINS: readonly Skin[];                  // exactly the DD table, in order
export function coinsForRun(score: number, stars: number): number; // stars + floor(score/25)
export function buySkin(state: { coins: number; owned: string[] }, id: string): { ok: true; coins: number; owned: string[] } | { ok: false; reason: 'owned' | 'poor' | 'unknown' };
// medals.ts
export type MedalId = 'bronze' | 'silver' | 'gold' | 'neon';
export const MEDALS: readonly { id: MedalId; seconds: number; color: number }[]; // DD table
export function medalsReached(prevSeconds: number, nowSeconds: number): MedalId[]; // newly crossed this frame
export function mergeMedals(saved: unknown, earned: MedalId[]): MedalId[];        // sanitizes saved, unique, MEDALS order
```
- [ ] **Step 1: Failing tests** incl. fairness properties over seeds 1..200 for each kind at t ∈ {12, 60, 150}, width 720: every `wall` has exactly one gap with width ≥ 2.2×44.8 and |gapX − prevGapX| ≤ 360; no two spawns with equal `at` overlap horizontally; every spawn has `w/2 ≤ x ≤ 720 − w/2`; `zigzag` never places a block intersecting the middle third [240,480]; `waveKindAt(5)==='rain'`, `(15)==='wall'`, `(35)==='stairs'`, `(55)==='zigzag'`, `(75)==='rainHeavy'`, `(95)==='wall'`; `isRush(46)` true, `(50)` false, `(91)` true; combo: multiplier = min(5, 1+floor(count/3)) → after 1 hit 1, after 3 hits 2, after 12 hits 5, after 30 hits 5; `hit()` returns 5 on the 1st hit and 10 on the 3rd; `tick(2.5)` with no hit resets count to 0 and returns true, `tick(2.4)` returns false; `isNearMiss(0)` false, `(28)` true, `(28.1)` false; coinsForRun(100,3)=7; buySkin poor/owned/unknown/ok; SKINS ids order and costs match DD; medalsReached(29,31) = ['bronze'], (59, 121) = ['silver','gold','neon']; mergeMedals('garbage',['gold']) = ['gold'].
- [ ] RED → implement → GREEN → typecheck + test → commit `feat(dodge-drop): add seeded waves, combo, economy and medal logic`, push.

---

### Task 6: dodge-drop PlayScene 2.0

**Files:** Rewrite `games/dodge-drop/src/PlayScene.ts`; create `games/dodge-drop/src/skinArt.ts` (draws a skin shape into a Graphics/texture: `skinTextureKey(scene, skin): string`, generates once), `games/dodge-drop/src/runState.ts` (registry key + type for results hook: `{ score, seconds, stars, medals: MedalId[] }`); update `strings.ts`; update `main.ts` to pass `theme: {}` (DEFAULT_THEME).

**Consumes:** Task 5 modules; Kit API (fx, input, audio, save, theme, gameOver with revive, addMuteButton).

Implement DD sections Core loop, Controls, Hitboxes, Telegraphs, Waves (schedule from `planWave` + `isRush`), Near-miss combo, Pickups, Death, Revive, Medals (toast + persist via `kit.save` `medals`), Music layers, Visuals (background grid, block style, HUD). Selected skin read from `kit.save.getJSON('skin','cyan')` in `create`. Before calling `kit.gameOver`, write the run state to `this.registry.set(RUN_STATE_KEY, ...)`. Use object pooling for blocks and warning chevrons (pool size ≥ 40) to avoid GC spikes.

Strings (en / zh-TW): `dragHint` "Drag anywhere ←→" / "在任意處左右拖曳", `rush` "RUSH!" / "加速！", `skins` "Skins" / "造型", `back` "Back" / "返回", `survived` "Survived" / "存活", `medal.bronze` "Bronze" / "銅牌", `medal.silver` "Silver" / "銀牌", `medal.gold` "Gold" / "金牌", `medal.neon` "Neon" / "霓虹".

- [ ] **Step 1: Failing test:** add to `e2e/results.spec.ts`-style new file `e2e/dodge-drop.spec.ts`: start, hold ArrowLeft 1 s then ArrowRight 1 s, play ≥3 s, assert `state === 'playing'` OR `'over'` with zero console errors; then `endRound` → overlay → tap → playing. Add the file to `test:smoke`.
- [ ] RED → implement → GREEN (typecheck + test + test:smoke) → commit `feat(dodge-drop): rebuild play scene with waves, near-miss combo, pickups and juice`, push.

---

### Task 7: Skins scene, results content, title backdrop, manifest, cover

**Files:** Create `games/dodge-drop/src/SkinsScene.ts`, `games/dodge-drop/src/results.ts` (the `results` hook), `games/dodge-drop/src/backdrop.ts` (the `titleBackdrop`); modify `main.ts` (`scenes: [SkinsScene]`, `titleMenu: [{ labelKey: 'skins', scene: 'Skins' }]`, `results`, `titleBackdrop`), `game.json` (version `2.0.0`, updated en/zh-TW description + instructions mentioning near misses, stars, skins; releases unchanged), `public/cover.svg` (bright neon redraw: first `<rect>` fill `#2b1d7a` so `extractBackground` works; gradient, pink blocks, cyan player, spark, title), regenerate `store/*.png` via `npm run covers -- dodge-drop`; extend `e2e/dodge-drop.spec.ts`.

Results hook (DD Coins & skins, Medals): read run state from registry, compute `coinsForRun`, add to saved `coins` immediately, show "+N coins", medals earned this run + 4-slot collection, "Survived m:ss"; if `ctx.rewardedAds`, a `×2` button → `kit.showRewarded()`; on `'rewarded'` add N more coins, update label, hide button (once).

Skins scene per DD (2×4 grid, balance, medal row, select/buy/shake, Back → `kit.goTo('GKTitle')`).

- [ ] **Step 1: Failing e2e cases:** from title click the Skins button (locate by computing its position from the game's known layout; expose position via `__gk` is NOT allowed — instead the title menu button y is fixed in JL title layout: place menu buttons at height·0.72 + i·96 and click there) → `activeScenes` includes `Skins`; click Back (fixed at 120, 80 in game coords) → `GKTitle`. Unit test for any pure helper added (e.g. `formatTime(67) === '1:07'` in `results.ts` → move into `medals.ts` or a `format.ts`).
- [ ] RED → implement → GREEN → `npm run build:site` and confirm `du -sh dist-site/dodge-drop` ≤ 2 MB → commit `feat(dodge-drop): add skins, results rewards, title backdrop and 2.0 cover`, push.

---

### Task 8: Playthrough verification (controller)

- [ ] Build local, run a headless Playwright script (scratchpad, not committed) that captures screenshots: title, mid-run at ~8 s with combo visible, death overlay, results, skins scene; record a ~10 s GIF/video. Review visuals against DD; dispatch fixes for any defect.
- [ ] Final whole-branch review; update this plan's Status with the commit range; confirm CI green on GitHub and the live site shows 2.0.
