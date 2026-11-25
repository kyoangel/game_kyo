# Neon Rush (dodge-drop) v3 - CrazyGames Resubmission Implementation Plan

> **For Agent:** Execute this plan task-by-task. Follow each step exactly, verify test results before proceeding, and commit after each task.
> **TDD Rule:** No production code without a failing test first.
> **Commit trailer:** every commit message ends with the attribution line from the session system reminder (`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).
> **Repo rules that apply:** never review via a background reviewer subagent (reviewer = inline, see `docs/STATUS.md` landmines); pre-push hook runs `npm run typecheck && npm test && npm run test:smoke` (`docs/ci.md`); push in batches; deploy is live (GitHub Pages) so confirm the game is playable before pushing; stop before the CrazyGames Submit button (user approves).

**Goal:** Ship Neon Rush v3.0.0 with clearly visible improvements over the rejected v2.8.4 (adaptive portrait/landscape layout legible at 800x450, authored CC0 art and audio, first-run visual onboarding plus a persistent next-medal goal bar) and prepare, but not submit, the CrazyGames resubmission.
**Architecture:** A pure `frame` module chooses a logical canvas per viewport. Portrait stays 720x1280 exactly as today. Landscape is a 1440x810 canvas in which the FULL, unchanged 720x1280 play field (gameplay geometry, speeds, fairness untouched) is shown through a zoomed camera (zoom 0.633, about 456 canvas px wide, centred) and ALL readable HUD text (score, timer, combo, goal bar, missions, shields) lives in two ~492 px side panels drawn by a second camera; in-field text is limited to large, minimal cues. Art/audio are CC0 files under `games/dodge-drop/public/assets/`, loaded in the kit preload step, overriding the procedural textures/synth when present, with every file listed in a license manifest enforced by a vitest-run checker. A first-run tutorial model (`onboarding.ts`, persisted through the existing `SaveData` key-value store) and a goal-bar model (`goalBar.ts`, built on the existing `MEDALS` tiers and optionally `GameSession.best`) drive a visual control tutorial inside gameplay and a next-medal progress bar in the HUD (left panel in landscape).
**Tech Stack:** Phaser 3.88, TypeScript, Vite, vitest (unit, `npm test`), Playwright (`npm run test:smoke`, `npm run test:rwd`), WebAudio, ffmpeg (already installed at `/opt/homebrew/bin/ffmpeg`).
**Complexity Path:** `E2E path` (user-facing UI, multi-layer, external portal integration, persisted state)
**Status:** Complete 2026-11-25 except user-only steps (listening check, CrazyGames Preview, Submit) - checklist in `docs/specs/dodge-drop/v3-resubmit-notes.md`. Decisions 1-6 applied (full portrait field in landscape; TDD exception; daily reward removed; PB cue replaced by onboarding + goal bar; assets A/A/A).

---

## Execution Log

### Batch 1 (2026-11-24) - DONE
- Task 0.1 `10ee7fa`: `e2e/crazygames-viewport.spec.ts` created; RED confirmed 6/6 (5 on `__gk.frame` undefined, landscape-HUD on `__dd.hud is not a function`; scene key `Play` confirmed). Not in `test:smoke`.
  - Deviation: no "before" screenshots were produced (each test fails before its `page.screenshot`); `.superpowers/sdd/meta/v3/` is empty. Title shots appear once Task 1.3+ lands.
- Task 0.2 `370bc33`: STATUS.md (now tracked), juice-layer.md non-goal superseded note, crazygames.md rejection-history item.
- Task 1.1 `8543349`: `games/dodge-drop/src/frame.ts` + `frame.test.ts` (9 tests); `layout.ts` derives PLAYER_Y/STRIP_* from `frameFor('portrait')`, values unchanged.
- Verification: `npm run typecheck` ok; `npm test` 64 files / 514 tests passed. Not pushed yet (push at end of next batch with pre-push hook).

### Batch 2 (2026-11-24) - DONE (not pushed: smoke red until Task 1.6)
- Task 1.3 `7aaae64`: `packages/game-kit/src/frameProvider.ts`(+test), `defineGame.ts` (new `GameDefinition.onFrame`, deviation: not in plan interface), `kit.ts` (`Kit.setFrame`/`Kit.frame<T>()`, registry `gk:frame`), `index.ts`, dodge-drop `main.ts` (`frameAt` helper), `frameAccess.ts`.
- Task 1.4 `a49b070`: `hudLayout.ts`(+test), `layout.ts` `dragToDx(dx, zoom)`, `PlayScene.ts` (field + UI cameras, `buildPanels()`, landscape-only `missionsText`, `__dd.hud()`; no `best` entry until 2.2). `backdrop.ts` untouched.
- Commander feedback fix `34f91f0`: missions wrapped mid-item at 800x450 -> pure `missionPanelText` (label line + progress line), `MISSION_PANEL_FONT = 30`.
- Task 1.5 `f1c00d1`: game-kit `ui/landscape.ts`, `ui/bounds.ts` (`__dd.bounds()`, `__dd.menuAt()`), `titleLayout.ts` landscape fields (signature kept `(width,height,menuCount)`), TitleScene/GameOverScene, `ResultsContext.cx/landscape`; dodge-drop `titleExtras.ts`, `boostBar.ts` vertical mode, `results.ts`, Shop panels 2-column grid. Deviations: landscape menu at 0.53h (0.5h put Shop under the centre tap); viewport spec extended with shop+results legs at 800x450 and 1920x1080.
- Verification: typecheck ok; `npm test` 66 files / 529 passed (PROPERTY_SEEDS=100 too); `crazygames-viewport.spec.ts` 8/8 passed; `test:smoke` 11 passed / 7 failed, all 7 in `e2e/dodge-drop.spec.ts` due to 1280x720 default -> landscape; all 13 pass with `?layout=portrait` (Task 1.6 pins them).
- Follow-ups noted: zh strings not checked in landscape; results overlay shows ~3% of paused HUD; shop level-0 descriptions read "within 0 px" / "0% more often" (pre-existing copy, worth fixing for quality); fullscreen button visible in local build - Task 1.6 confirms hidden on CrazyGames.

### Batch 2 feedback fixes (2026-11-24, user-approved)
- `71a5da4` shop cards preview NEXT level ("Next: ...", zh "下一級：...") instead of "0 px"/"0%" (`upgradeDesc.ts`, `strings.ts` `upNext`).
- `c30e50f` zh-TW legs in `crazygames-viewport.spec.ts` (title, 3 shop tabs, play, results at 800x450 + 1920x1080); CJK copy shortened. `c977e54` (commander) shorter zh magnet/combo copy so no card wraps.
- `ed9f5a8` landscape GameOver overlay alpha 1 (no ghosted Play HUD), with screenshot-variance e2e test.

### Batch 3 (2026-11-24) - DONE
- Task 1.6 `5135288`: debounced `window.resize` -> `Kit.onViewport`; deferred while playing/overlay, applied in `switchTo`/`retry`/`gameOver`(no revive). Existing specs pinned `?layout=portrait`; rwd adds desktop-1920/1280; `crazygames-viewport.spec.ts` added to `test:smoke`. Fullscreen on CrazyGames: `crazygames.ts:116 fullscreenButton:false`, click-probe tests in `portals.spec.ts` (+ positive control on local build).
- Task 1.7 `a84c72b`: `MIN_TAP = 88` hit height in game-kit `ui/button.ts`; overlapping hit areas re-routed to nearest button centre (e2e covers Swap rows). Magnet test flake root cause: frame-rate-bound pull under heavy load; poll timeout 8 s -> 22 s (no retries). Caveat: portrait Swap rows (52 px pitch) only meet 44 css px via overlapping hit areas.
- Task 1.8 `109d6b7`: orientation `any`; `publish:prep` payload `mobileOrientation: "BOTH"`.
- Deviations: resize logic lives in `kit.ts` (`onViewport`/`applyView`/`applyPendingFrame`), not only `defineGame`; no `e2e/fixtures/urls.ts`; `__dd.tapTargets()` registered in `button.ts`; explicit staging instead of `git add -A`.
- Verification: typecheck ok; `npm test` 66/530; `test:smoke` 34 passed; `test:rwd` 14 passed; `test:portals` 4 passed. Commander reviewed `button.ts`/`kit.ts` diffs inline and desktop screenshots.

### Batch 4 - Phase 2 onboarding + goal bar (2026-11-25) - DONE
- Plan rewrite `6707c6b` (PB cue dropped, decision 5) + commander resolutions `d740237` (Task 2.5 not executed).
- Task 2.1 `4557d4e`: `onboarding.ts`(+test, 9 tests). RED re-proved by removing the impl file (impl was written first - process slip, noted).
- Task 2.2 `d7800ce`: `tutorialView.ts` (ghost finger / arrow-key caps), `PlayScene.startTutorial/updateTutorial`, `__dd.tutorial()`, `e2e/fixtures/onboarding.ts` `skipOnboarding` (real key `gk:dodge-drop:onboarding`), `startRun` helper in `e2e/dodge-drop.spec.ts`. Caption y 1085 (plan 1110) to clear the caps.
- Task 2.3 `f675b07`: `goalBar.ts`(+test, 7 tests).
- Task 2.4 `4edc59b`: `hudLayout` `best` -> `goal` (`GOAL_PANEL_FONT = 30`); portrait anchor `{x:220,y:84}` (plan `{24,120}` overlapped the combo bar); track colour `0x3a2f66`@0.85 for visibility; `__dd.goal()`.
- Side work: `3008e80` CC0 asset shortlist (`docs/specs/dodge-drop/v3-asset-shortlist.md`) for the user's pick.
- Verification: typecheck ok; `PROPERTY_SEEDS=100 npm test` 68/546; `test:smoke` 39; `test:rwd` 14; `test:portals` 4. Commander read tutorial + goal screenshots (landscape en/zh, portrait).
- Follow-up: portrait goal label ~13.5 css px at 375 px wide (legible but small).

### Batch 5 - Task 3.1 (2026-11-25) - DONE; STOPPED for user asset pick
- Task 3.1 `4e8e8b0`: `scripts/check-assets.ts`(+test), `games/dodge-drop/assets/manifest.json` (`{"assets":[]}`), `assets/README.md`, `package.json` `check:assets`. Deviation: optional `credit` string field (some CC0 authors ask for optional credit).
- Commander fix (red-green inline): checker ignores dotfiles (`.DS_Store`) - new test failed first, then passed.
- Verification: `check-assets.test.ts` 10/10; `node scripts/check-assets.ts` -> `assets ok`; `npm test` 69/555; `test:smoke` 39.
- NEXT: Tasks 3.2/3.3 need the user's pick from `docs/specs/dodge-drop/v3-asset-shortlist.md` (recommended: Kenney Simple Space + Particle Pack + UI Pack Sci-Fi; Pro Sensory synthwave x3 on OGA; Kenney Digital/Interface/Sci-fi audio). Do not start them without that pick.

### Batch 6 - Tasks 3.2-3.8 (2026-11-25) - DONE
- Kenney zips (6) downloaded via the user's own Chrome (approved; scripted download endpoint refused automated clients). Pages + in-zip License.txt say CC0; UI page delivers `kenney_ui-pack-space-expansion.zip` whose License.txt is "UI Pack: Sci-fi (2.0)".
- 3.2 `242f9ae` art (10 PNGs) + logo rendered from Orbitron (SIL OFL 1.1, font not shipped). Commander fixes: `6043b61` lossless PNG export (palette quantisation banded the glows) + 1024 px logo; `2e187e2` panel art uses abstract particle emblems (ship/station icons removed: franchise-lookalike risk).
- 3.3 `849a357` audio: 4 music loops (Pro Sensory, OGA, CC0, optional credit recorded) + 9 Kenney SFX.
- 3.4 `9a6df6d` `art.ts` preload + override (only `dd-ring` mapped; star/shield sprites read worse, kept procedural). 3.5 `17fa520` parallax (alpha 0.14), panel art, `GameDefinition.titleLogo` (en only; zh-TW keeps text title). `dd-panel`/`dd-button*`/star/shield PNGs shipped but unused (candidate cleanup).
- 3.6 `f79d82d` `samples.ts` (`computeLoopPoints` trims mp3 padding), sample music/SFX with synth fallback, PreloadScene awaits samples (4 s cap). Commander `perf` commit: loop points cached per buffer.
- 3.7 `4f7ac39` `audioManifest.ts` + per-track gains (music ~-14 LUFS target), `click` stays synth (7 ms sample too short), `e2e/audio.spec.ts` in smoke (track switches on rush/overdrive; no-audio fallback).
- 3.8 `c916927` `ASSET_BUDGET_BYTES` 8 MB media budget (plan text contradicted itself; media-only interpretation).
- Verification: `npm test` 72/603; smoke 44; rwd 14; portals 4; `check-assets` ok; crazygames build 4.75 MB (assets 3.1 MB), zip 3.49 MB.

### Batch 7 - Tasks 3.9-4.4 (2026-11-25) - DONE (user-only steps pending)
- 3.9 `d1e941f` two-pass loudnorm (music -18, SFX -14 LUFS, all within 1 LU except unused click), per-track gains removed; listening checklist in `games/dodge-drop/assets/README.md` (USER pending).
- 4.1 independent haiku verification: typecheck; `PROPERTY_SEEDS=300 npm test` 72/603; smoke 44; rwd 14; portals 4; build 4.8 MB; Fast-4G ~2.1 s to canvas, ~4.7 s network idle.
- 4.2 `b791bd3` v3.0.0 + notes; Open Question 1 resolved: no reset needed (`publish-payload.ts:58` never blocks a `rejected` entry; rejection record kept).
- 4.3 `0f3be84` per-orientation store recording (`store-video.ts` `recordingKinds`), onboarding seeded off; covers kept (existing SVG art). Commander: `190a78a` landscape field backdrop bug (bare below logic y 810, new e2e test red->green), `afd5fed` recordings hide the local-build fullscreen button.
- 4.4: checklist + STATUS updated; STOP before Submit.

## Requirements

Goal in one sentence: make the resubmission a visibly different, higher-quality game than v2.8.4 along the axes the user chose (adaptive layout, CC0 art/audio, first-run visual onboarding and a visible in-run goal), because CrazyGames FAQ says small tweaks "will most likely produce the same result".

### User Stories
- As a desktop player in a 16:9 CrazyGames iframe, I want the game to use the width of the frame, with the HUD text in side panels large enough to read even at 800x450, so that it looks and feels made for the portal rather than a phone game with black bars.
- As a phone player in portrait, I want the existing tall play field and thumb controls unchanged, so that the game still feels right in my hand.
- As a new player, I want a coherent, bright, authored visual style with music and good sound effects, so that the first minutes feel polished (CrazyGames quality criteria: one coherent style, music complements visuals, consistent audio levels).
- As a first-time player, I want to see how to control the game (a ghost finger drag on touch, arrow keys on desktop) right inside the game, so that I understand it in seconds without reading text.
- As a player mid-run, I want a visible next goal ("Bronze 30 s") with a progress bar, so that I always know what I am playing for and want to retry.
- As the developer/seller of this template, I want every asset's source and license recorded and machine-checked, so that the template stays extractable and legally clean.
- As the reviewer on CrazyGames, I want the build to pass the portal technical rules (size, no external URLs, no custom fullscreen button), so that the game is not rejected for something avoidable.

### Acceptance Criteria
- Given a 16:9 iframe from 800x450 to 1920x1080, when the game loads, then the landscape layout is used: the full portrait play field is centred (about 253 css px wide at 800x450), and every piece of HUD text (score, timer, combo, goal bar, missions, shields, mute) is in a side panel and renders at >= 14 css px at 800x450 (target 20+); any text left inside the field (hint, rush/overdrive banners, pop text) is a large minimal cue that also renders at >= 14 css px.
- Given a portrait phone viewport (for example 375x667), when the game loads, then the layout is identical to v2.8.4 (720x1280 canvas, thumb strip, HUD in the field).
- Given a window that changes orientation, when no run is in progress, then the layout switches; when a run is in progress, then the layout switches only after the run ends and the player is never moved mid-run.
- Given landscape mode, when a run is played, then gameplay geometry is identical to portrait (logic field 720x1280, `playerY` 1000, same spawn speeds); `fairness.ts`/`schedule.ts` are untouched and their property tests still pass. Dragging in landscape moves the player by the same on-screen proportion as in portrait (drag gain compensates for the camera zoom).
- Given a fresh profile, when the first run starts, then an animated visual control tutorial is shown inside gameplay (ghost finger sweeping the thumb strip on touch, arrow-key caps on desktop, portrait and landscape, en and zh-TW), and it disappears on the first real input or after 6 s; once the player has used the controls during it, it is never shown again (stored in `SaveData` key `onboarding`; runs where the player ignored it show it at most twice).
- Given any run, when it is in progress, then the HUD shows the next medal target (e.g. "Bronze · 30 s") with a progress bar that fills toward it and advances to the next tier when the medal is earned; after the top medal it shows percent of the personal best (`GameSession.best`) or nothing; in landscape it is in the left side panel at >= 14 css px at 800x450, in portrait it is a compact line that does not cover the player.
- Given the production build, when `npm run build:portals` runs, then `scripts/check-artifact.ts` passes: total <= 10 MB, no external URLs, relative paths only.
- Given any file under `games/dodge-drop/public/assets/`, when `npm test` runs, then `scripts/check-assets.test.ts` fails unless the file has a manifest entry with license `CC0-1.0`, author, source URL, retrieval date and sha256.
- Given the final build, when `npm run publish:prep -- dodge-drop` runs, then it exits 0 with version 3.0.0, covers and videos present, and the plan stops before Submit.

### Assumptions, Constraints, and Scope Boundaries
- Scope is fixed by the user: (1) adaptive portrait+landscape layout showing the full portrait field in landscape, (2) CC0-only art/audio upgrade with manifest, (3) first-run visual onboarding and a persistent next-medal goal bar (replaced the personal-best cue on 2026-11-24). Daily reward and login streak were REMOVED by the user on 2026-11-24 ("quality review has nothing to do with daily rewards"). The personal-best progress cue was dropped by the user on 2026-11-24 (no `pbCue.ts`). A scripted gentler opening is deferred (Phase 2 intro). Out of scope: new modes/worlds, leaderboards, retention hooks, results-screen redesign beyond landscape adaptation.
- Source of the reasoning: `docs/specs/dodge-drop/crazygames-gap-analysis.md` (gaps 1, 2, 3, 5, 6, 10 addressed here; gaps 4, 7 deliberately not). The gap analysis marks root cause as inference; a rejection is not guaranteed to flip. Success is measured by the criteria below plus the user's own judgment, not by the portal.
- No database modification: persistence uses key-value `SaveData` only (one new JSON key `onboarding` via `SaveData`; the personal best already persists as `best` through `GameSession`); no schema/DB involved. If the executor finds any DB need, STOP and ask.
- In-flight work check (`.superpowers/sdd/meta/progress.md`): 2.3 (density/shield), mobile 2.4.0, shop/daily missions 2.5.0, rotate/magnet 2.5.1, UX fixes 2.5.2, skins FX 2.6.0 are all recorded complete; `git status` shows only an unrelated `workspace-pixel-squad/run_aoa_tests.sh` change and untracked `docs/STATUS.md`. `docs/STATUS.md` ("next: 2.3, mobile") is stale (version is 2.8.4) and is refreshed in Task 0.2. Open items recorded in progress.md that overlap this plan and are FOLDED IN: "small-phone tap targets (chips/skip ~22 css px on SE)" -> Task 1.7; "results screen redesign: owner will brainstorm later" -> NOT done here (only landscape adaptation), listed as an open question.
- Sequencing: layout (Phase 1) -> onboarding + goal bar (Phase 2) -> art/audio (Phase 3) -> release (Phase 4). Reason: art and audio replace procedural drawing inside the same HUD/title/backdrop code that Phase 1 re-anchors; doing art first would be redone. The tutorial and goal bar go right after the HUD side-panel work because they live in the same HUD code (the goal bar uses the left panel space that is empty today).
- Portal rules that constrain design: no custom fullscreen button on CrazyGames (`kit.ts` gates it on `platform.features`; re-verified in Task 1.6), no external links, 16:9 legibility 800x450 to 1920x1080, devicePixelRatio 1 legibility, consistent behaviour at 144/165 Hz (verify dt-based motion in Task 1.4 - existing code is dt-based, confirm only), English present.
- `docs/specs/game-platform/juice-layer.md` states "No binary assets / Non-goal: no asset pipeline". This plan intentionally supersedes that for the dodge-drop game only; Task 0.2 amends the spec so docs match reality. game-kit must keep working with zero assets (Neon Swarm and the template stay procedural-capable).
- Asset licensing: CC0 only. Candidates (UNVERIFIED from memory, must be re-verified from each pack's own page at download time; the manifest records the verification): Kenney.nl packs (all Kenney assets are published CC0; look at the UI, space/simple-shape, particle, and the Interface/Impact/Digital/Sci-fi audio packs), OpenGameArt items filtered to "CC0" for music loops, Freesound items individually marked CC0. NOT acceptable: CC-BY, CC-BY-SA, "free for commercial use" custom licenses (Pixabay/Mixkit/itch "free" without CC0), anything needing attribution. The template will be sold later, so CC0 is the safe floor.
- Size: current build is small (procedural). Budget for v3: art <= 2 MB, audio <= 4 MB (mp3, 2-3 music loops of 30-60 s at 96-128 kbps plus short SFX), total build stays well under the project cap of 10 MB (`MAX_ARTIFACT_BYTES` in `scripts/check-artifact.ts`); CrazyGames Basic Launch benchmark is load < 10 s and < 20 MB.

### Decisions taken (user, 2026-11-24)
1. Landscape shows the FULL portrait field (720x1280 logic unchanged), scaled to the landscape height, with side panels for HUD/missions/decoration. Consequence: no fairness/scheduler/difficulty work; HUD text moves to panels.
2. TDD exception contract for tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3 is approved.
3. Daily reward and login streak are removed from the plan entirely.
4. Results-screen redesign stays excluded; landscape adaptation of the existing results is enough.
5. (2026-11-24) The personal-best progress cue (old Tasks 2.1 `pbCue` model and 2.2 PB line in the HUD) is dropped entirely. Phase 2 becomes onboarding + persistent visible goal (gap #2): first-run visual control tutorial, next-medal goal bar in the HUD, and an evaluated-but-deferred gentler opening (scripted opening not done because it would touch `schedule.ts`/`waves.ts` invariants; optional free first-run shield in Task 2.5).

6. Asset pick (user, 2026-11-25): art option A (Kenney Simple Space + Particle Pack + UI Pack - Sci-Fi; 3 packs from one author approved, overriding the "<= 2 packs" guideline), music option A (Pro Sensory synthwave x3 on OpenGameArt, cut into loops), SFX option A (Kenney Digital Audio + Interface Sounds + Sci-fi Sounds). Source: `docs/specs/dodge-drop/v3-asset-shortlist.md`.

### Open Questions (still open)
1. Whether `releases.crazygames` should be reset from `rejected` to `todo` in `game.json` before `publish:prep` (checked in Task 4.2/4.3 by reading `scripts/publish-payload.ts` and `scripts/mark-released.ts`).
2. Listing reuse vs new submission on the CrazyGames portal and any cooldown period are UNVERIFIED (gap analysis section (e)); check in the developer portal before the final step, do not wait on it to start work.

## Architecture Review

### Reusable components and similar implementations
- `packages/game-kit/src/save.ts` `SaveData` (`getJSON/setJSON/getNumber/setNumber`, slug-prefixed) - used for the one new persisted value, `onboarding` (first-run tutorial state, JSON).
- `packages/game-kit/src/session.ts` `GameSession.best` - optional post-Legend percent-of-best goal (already persisted, already SDK-backed).
- `games/dodge-drop/src/medals.ts` `MEDALS` (bronze 30 s ... legend 240 s) - the tiers the goal bar targets; `PlayScene.ts` `this.hint`/`updateHint` - the existing 4 s text hint the tutorial replaces on first runs.
- `games/dodge-drop/src/missions.ts` / `progression.ts` / `economy.ts` - pure, unit-tested modules; `onboarding.ts` and `goalBar.ts` copy this style.
- `games/dodge-drop/src/titleExtras.ts` + `packages/game-kit/src/titleLayout.ts` (+ `titleLayout.test.ts`) - pattern for pure layout math tested without Phaser; new `frame.ts` and `hudLayout.ts` copy it.
- `games/dodge-drop/src/layout.ts` (`PLAYER_Y`, `STRIP_*`, shared by `PlayScene.ts` and `fairness.ts`) - the single-source-of-truth pattern to extend.
- `packages/game-kit/src/audio/audio.ts` (`createGameAudio` with injectable `ctxFactory`, fake AudioContext tests in `audio.test.ts`) - extension point for sample playback.
- `games/dodge-drop/src/playArt.ts`, `skinArt.ts`, `backdrop.ts` all use `scene.textures.exists(key)` guards - a loaded PNG with the same key naturally overrides procedural generation.
- `scripts/check-artifact.ts` (size cap, URL scan over `.html/.js/.css/.json`), `scripts/publish-payload.ts` (orientation `any` -> `BOTH`), `scripts/render-covers.ts`, `scripts/store-video.ts` + `games/dodge-drop/store/record.json`.
- `e2e/rwd.spec.ts` (device sweep with `strip()` helper and `__gk` hooks), `e2e/fixtures/fake-crazygames-sdk.js`, `e2e/portals.spec.ts`.

### Affected layers and key data flow
1. Boot: `main.ts` -> `defineGame` (game-kit) now asks a `frame` provider for canvas size from `window.innerWidth/innerHeight` (+ `?layout=` override for tests) -> `Phaser.Game({width,height})`; `Kit.frame` exposes the active `Frame` to scenes.
2. `PlayScene` keeps its 720x1280 logic and gets a zoomed field camera plus a UI camera for panels (landscape only). `TitleScene`/`titleExtras.ts`, `ShopScene`, `results.ts`, `GameOverScene` lay out against the real canvas (1440x810) in landscape with a larger minimum font.
3. Onboarding and goal: `onboarding.ts` (pure) decides tutorial visibility from the `onboarding` key read through `kit.save` and the last input type; `PlayScene` draws the ghost finger / arrow caps over the thumb strip (field camera). `goalBar.ts` (pure) maps `this.t` and `MEDALS` (and optionally `kit.session.best`) to the next-medal label and progress; `PlayScene` draws it in the HUD (left panel in landscape via the UI camera, compact line in portrait).
4. Assets: `games/dodge-drop/assets/manifest.json` (NOT in `public/`, so the URL scan in `check-artifact` never sees source URLs) -> `scripts/check-assets.ts` validates against files in `games/dodge-drop/public/assets/` -> Phaser loader (`def.preload`) loads images; `GameAudio.loadSamples()` fetches/decodes audio -> `playSfx`/music prefer samples, fall back to synth.
5. Release: `game.json` (version, orientation `any`, description, `releases`) -> `npm run build:portals` -> `check-artifact` -> `npm run publish:prep`.

### Mermaid user journey
```mermaid
journey
    title Neon Rush v3 player journey (desktop iframe and phone)
    section Arrive
      Open game in 16:9 iframe (800x450): 4: Player
      Load shows authored art and logo (fast, <10 s): 4: Player
      Title scene with side-panel art: 5: Player
      Landscape HUD text readable in side panels at 800x450: 4: Player
    section Play
      Tap to start, drag or arrow keys: 5: Player
      Music plays, SFX on near miss and pickups: 5: Player
      Ghost finger / arrow keys show how to move, gone on first input: 5: Player
      HUD in side panels, goal bar fills toward Bronze 30 s: 5: Player
      Earn the medal, goal advances to Silver: 5: Player
    section Retry loop
      Die, results with best score: 4: Player
      Instant retry or Shop: 5: Player
    section Phone
      Rotate phone, layout switches after the run: 4: Player
      Portrait play unchanged: 5: Player
    section Chase
      Retry to reach the next medal: 5: Player
```

### Exact file paths that will likely change
New:
- `games/dodge-drop/src/frame.ts`, `frame.test.ts`
- `games/dodge-drop/src/hudLayout.ts`, `hudLayout.test.ts`
- `games/dodge-drop/src/onboarding.ts`, `onboarding.test.ts`
- `games/dodge-drop/src/goalBar.ts`, `goalBar.test.ts`
- (optional, Task 2.2 refactor) `games/dodge-drop/src/tutorialView.ts`; `e2e/fixtures/onboarding.ts`
- `games/dodge-drop/src/art.ts` (asset key map + preload), `art.test.ts`
- `packages/game-kit/src/audio/samples.ts`, `samples.test.ts`
- `scripts/check-assets.ts`, `scripts/check-assets.test.ts`
- `games/dodge-drop/assets/manifest.json`, `games/dodge-drop/assets/README.md`
- `games/dodge-drop/public/assets/**` (images, audio)
- `e2e/crazygames-viewport.spec.ts`
- `docs/specs/dodge-drop/v3-resubmit-notes.md` (changelog + portal notes, Phase 4)

Modified:
- `games/dodge-drop/src/main.ts`, `layout.ts` (drag gain takes zoom), `hudLayout.ts` (`best` anchor becomes `goal`), `runSetup.ts` (optional Task 2.5), `PlayScene.ts`, `titleExtras.ts`, `ShopScene.ts`, `results.ts`, `backdrop.ts`, `playArt.ts`, `skinArt.ts`, `strings.ts`, `strings.test.ts`
- `packages/game-kit/src/defineGame.ts`, `kit.ts`, `scenes/PreloadScene.ts`, `scenes/TitleScene.ts`, `scenes/GameOverScene.ts`, `titleLayout.ts`, `audio/audio.ts`, `audio/sfx.ts`, `index.ts`, `manifest.ts` only if needed
- `games/dodge-drop/game.json` (version 3.0.0, orientation `any`, description, instructions, `releases`)
- `e2e/dodge-drop.spec.ts`, `e2e/smoke.spec.ts`, `e2e/results.spec.ts`, `e2e/dodge-drop-mobile.spec.ts`, `e2e/rwd.spec.ts`, `e2e/portals.spec.ts` (portrait pin via `?layout=portrait`; landscape additions)
- `package.json` (`check:assets` script), `docs/STATUS.md`, `docs/specs/game-platform/juice-layer.md`, `docs/specs/game-platform/checklists/crazygames.md`
- `games/dodge-drop/store/*.png`, `store/record.json` (regenerated)

## TDD Exception (APPROVED by the user, 2026-11-24)

Tasks **1.8 (config: manifest orientation), 3.2 (asset sourcing: art), 3.3 (asset sourcing: music/SFX), 3.9 (generated: audio normalisation output), 4.2 (config: version/description bump), 4.3 (generated: covers/videos)** use the Approved Exception Contract from the plan skill (Implementation, Verification, COMMIT; no fake RED/GREEN). Every behavioural consequence of those files IS test-first elsewhere (manifest checker in 3.1, texture override in 3.4, audio engine in 3.6, build checks in 4.1). Where a machine gate exists it must fail before the change and pass after (the Task 3.1 checker gives the asset tasks a real failing-first gate).

## Implementation Steps

### Phase 0: Baseline and housekeeping

#### Task 0.1: Viewport baseline spec (captures the "before" and guards later work)
**Goal:** Prove, in an automated spec, what v2.8.4 does at CrazyGames iframe sizes, so Phase 1 has a failing test and a before screenshot set.

**Files:**
- Create: `e2e/crazygames-viewport.spec.ts`
- Modify: `games/dodge-drop/src/main.ts` (none yet), `packages/game-kit/src/defineGame.ts` (test hook `frame`, added in Task 1.3 - this task only asserts it exists, so it fails)
- Test: `e2e/crazygames-viewport.spec.ts`

**RED - Write Failing Test**
```ts
// e2e/crazygames-viewport.spec.ts
// CrazyGames requires legibility in 16:9 iframes from 800x450 to 1920x1080 and on phones.
import { expect, test, type Page } from '@playwright/test';

const GAME = 'http://localhost:5180/dodge-drop/';
const OUT = '.superpowers/sdd/meta/v3';

type GK = { frame?: { mode: 'portrait' | 'landscape'; width: number; height: number; fieldX: number; fieldW: number; dispW: number; zoom: number }; activeScenes: string[] };
/** fontPx is the EFFECTIVE canvas px (font size times camera zoom for in-field text). inField marks text drawn inside the play field. */
type DDHud = { name: string; x: number; y: number; fontPx: number; inField: boolean }[];

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __gk?: GK }).__gk?.activeScenes.includes('GKTitle'));
}

const SIZES = [
  { name: '800x450', width: 800, height: 450 },
  { name: '907x510', width: 907, height: 510 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;

for (const s of SIZES) {
  test(`landscape frame at ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto(GAME);
    await ready(page);
    const frame = await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame);
    expect(frame?.mode).toBe('landscape');
    expect(frame!.zoom).toBeCloseTo(810 / 1280, 4);
    const box = (await page.locator('canvas').boundingBox())!;
    expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
    await page.screenshot({ path: `${OUT}/title-${s.name}.png` });
  });
}

test('portrait frame on a phone-sized viewport is unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(GAME);
  await ready(page);
  const frame = await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame);
  expect(frame).toMatchObject({ mode: 'portrait', width: 720, height: 1280, fieldX: 0, fieldW: 720, dispW: 720, zoom: 1 });
});

test('?layout=portrait forces the portrait frame even on a wide window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${GAME}?layout=portrait`);
  await ready(page);
  const frame = await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame);
  expect(frame?.mode).toBe('portrait');
});

test('landscape: HUD text is in side panels and every text is legible (>= 14 css px) at 800x450', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto(GAME);
  await ready(page);
  await page.mouse.click(400, 225); // start (tap anywhere on title)
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  const { hud, frame, scale } = await page.evaluate(() => {
    const w = window as unknown as { __gk: GK; __dd: { hud(): DDHud } };
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    return { hud: w.__dd.hud(), frame: w.__gk.frame!, scale: c.width / w.__gk.frame!.width };
  });
  for (const h of hud) {
    expect(h.fontPx * scale, `${h.name} font in CSS px`).toBeGreaterThanOrEqual(14);
    const insideField = h.x >= frame.fieldX && h.x <= frame.fieldX + frame.dispW;
    // readable HUD (score, timer, combo, best, missions, shields) must be in a panel; only large cues may be in the field
    if (!h.inField) expect(insideField, `${h.name} must be in a side panel`).toBe(false);
  }
  await page.screenshot({ path: `${OUT}/play-800x450.png` });
});
```
Note: the scene key `Play` is the key used by `Kit.playKey` for `PlayScene`; confirm with `grep -n "super(" games/dodge-drop/src/PlayScene.ts` before running and adjust the string if it differs.

**Requirements:**
- One behaviour per test; Playwright config already serves the game on :5180 (see `playwright.config.ts` and how `e2e/smoke.spec.ts` is served by `npm run build:local`).
- Screenshots go to `.superpowers/sdd/meta/v3/` (docs-only path for the pre-push hook).

**Verify RED - Watch It Fail**
Run: `npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts`

Confirm:
- Every test fails because `__gk.frame` is undefined (feature missing), not because of a selector typo or server error.
- The "before" screenshots exist in `.superpowers/sdd/meta/v3/` (title-800x450.png shows the thin portrait strip - this is the evidence for the PR/notes).

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error (port, scene key), re-run until it fails correctly.

**GREEN - Minimal Code**
No production code in this task. It is a deliberately red spec that Tasks 1.3-1.6 turn green. Mark the tests with `test.fail` ONLY if the pre-push hook would otherwise block the intermediate commits: set `test.describe.configure({ mode: 'serial' })` is NOT needed; instead keep the spec out of the smoke list until Task 1.6 (it is not in the `test:smoke` file list, so the hook is unaffected). Commit the red spec as-is.

**Verify GREEN - Watch It Pass**
Run: `npm run typecheck`

Confirm:
- Typecheck passes (spec compiles). Playwright spec stays red until Task 1.6 by design.

**REFACTOR - Clean Up**
- Share the `ready()`/`frame()` helpers later via `e2e/fixtures/` if a second spec needs them (do not do it now, YAGNI).

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && npm test`

Confirm:
- Both pass; output pristine.

**COMMIT**
Run:
`git add e2e/crazygames-viewport.spec.ts && git commit -m "test(dodge-drop): 🧪 add CrazyGames iframe viewport spec (red baseline)"`

#### Task 0.2: Refresh stale docs (doc-only, Trivial tier)
**Goal:** Make `docs/STATUS.md`, the juice-layer spec and the CrazyGames checklist match reality before work starts.

**Files:**
- Modify: `docs/STATUS.md`, `docs/specs/game-platform/juice-layer.md`, `docs/specs/game-platform/checklists/crazygames.md`

**Implementation (no behaviour change, diff < 20 lines; exempt from RED/GREEN under the Trivial gate in AGENTS.md, re-read the diff once):**
- `docs/STATUS.md`: update `updated:` to 2026-11-23; replace the stale "dodge-drop 2.2+ / next 2.3" lines with "v2.8.4 rejected by CrazyGames 2026-11-23; v3 resubmission plan: `docs/plans/2026-11-23-dodge-drop-v3-crazygames-resubmit.md`".
- `juice-layer.md`: under "Non-goals" append "Superseded for dodge-drop v3 (2026-11): optional CC0 image/audio assets are allowed; game-kit still works with none. See plan 2026-11-23."
- `crazygames.md`: add the unchecked item "Rejection history: v2.8.4 rejected 2026-11-23 ('overall quality'); resubmission needs clear improvements (FAQ)".

**Verification**
Run: `git diff --stat docs/`

Confirm:
- Only the three files, < 20 added lines, no code touched.

**COMMIT**
Run:
`git commit -am "docs: 📝 refresh status and specs for v3 resubmission"`

### Phase 1: Adaptive portrait + landscape layout

Design recap: portrait frame = today's 720x1280, unchanged. Landscape frame = 1440x810 canvas. The full 720x1280 logic field is shown by the main camera with `setViewport(fieldX, 0, dispW, 810)`, `setZoom(810/1280 = 0.6328)` and `centerOn(360, 640)`, so it is about 456 canvas px wide, centred, and every existing world coordinate, `PLAYER_Y`, speed, wave and fairness constant stays valid. A second camera covers the full canvas and draws the side panels (about 492 px each) with all readable HUD text. At 800x450 the canvas scale is 0.556, so the field is about 253 css px wide; panel text of 40 canvas px renders at about 22 css px; in-field text is clamped to >= 40 logic px (= 14 css px). Shake/hit-stop act on the field camera only, so the HUD stays steady.

#### Task 1.1: Pure frame model
**Goal:** One tested function decides mode and geometry from the viewport; gameplay geometry is identical in both modes.

**Files:**
- Create: `games/dodge-drop/src/frame.ts`
- Test: `games/dodge-drop/src/frame.test.ts`

**RED - Write Failing Test**
```ts
// games/dodge-drop/src/frame.test.ts
import { describe, expect, it } from 'vitest';
import { FIELD_W, frameFor, parseLayoutOverride, pickMode } from './frame.ts';

describe('pickMode', () => {
  it('uses landscape for 16:9 iframes at every CrazyGames size', () => {
    for (const [w, h] of [[800, 450], [907, 510], [1280, 720], [1920, 1080]] as const) {
      expect(pickMode(w, h)).toBe('landscape');
    }
  });
  it('uses portrait for phones in portrait and for squarish windows', () => {
    for (const [w, h] of [[375, 667], [390, 844], [768, 1024], [900, 900]] as const) {
      expect(pickMode(w, h)).toBe('portrait');
    }
  });
  it('honours an explicit override', () => {
    expect(pickMode(1920, 1080, 'portrait')).toBe('portrait');
    expect(pickMode(375, 667, 'landscape')).toBe('landscape');
  });
  it('guards zero/invalid sizes by falling back to portrait', () => {
    expect(pickMode(0, 0)).toBe('portrait');
    expect(pickMode(Number.NaN, 100)).toBe('portrait');
  });
});

describe('frameFor', () => {
  it('portrait matches the v2.8.4 constants exactly', () => {
    expect(frameFor('portrait')).toEqual({
      mode: 'portrait', width: 720, height: 1280, fieldX: 0, fieldY: 0, zoom: 1,
      fieldW: 720, fieldH: 1280, dispW: 720, dispH: 1280,
      playerY: 1000, stripTop: 1060, stripBottom: 1280,
    });
  });
  it('landscape shows the full portrait field scaled to the canvas height and centred', () => {
    const f = frameFor('landscape');
    expect(f.width).toBe(1440);
    expect(f.height).toBe(810);
    expect(f.zoom).toBeCloseTo(810 / 1280, 6);
    expect(f.dispH).toBeCloseTo(810, 6);
    expect(f.dispW).toBeCloseTo(FIELD_W * f.zoom, 6);
    expect(f.fieldX * 2 + f.dispW).toBeCloseTo(f.width, 6);
  });
  it('gameplay geometry is identical in both modes (no fairness impact)', () => {
    const p = frameFor('portrait');
    const l = frameFor('landscape');
    expect([l.fieldW, l.fieldH, l.playerY, l.stripTop, l.stripBottom]).toEqual([p.fieldW, p.fieldH, p.playerY, p.stripTop, p.stripBottom]);
  });
  it('landscape aspect is 16:9 and panels are wide enough for HUD text', () => {
    const f = frameFor('landscape');
    expect(f.width / f.height).toBeCloseTo(16 / 9, 5);
    expect(f.fieldX).toBeGreaterThanOrEqual(440);
  });
});

describe('parseLayoutOverride', () => {
  it('reads ?layout=', () => {
    expect(parseLayoutOverride('?layout=portrait')).toBe('portrait');
    expect(parseLayoutOverride('?a=1&layout=landscape')).toBe('landscape');
    expect(parseLayoutOverride('?layout=weird')).toBeUndefined();
    expect(parseLayoutOverride('')).toBeUndefined();
  });
});
```

**Requirements:**
- One behaviour per `it`; no mocks.

**Verify RED - Watch It Fail**
Run: `npx vitest run games/dodge-drop/src/frame.test.ts`

Confirm:
- Fails with "Failed to resolve import ./frame.ts" (module missing), not a syntax error.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// games/dodge-drop/src/frame.ts
/** Pure viewport -> logical frame model. Field-local coordinates are always 0..FIELD_W. */
export const FIELD_W = 720;
export const FIELD_H = 1280;
export type FrameMode = 'portrait' | 'landscape';

export interface Frame {
  mode: FrameMode;
  /** Logical canvas size. */
  width: number;
  height: number;
  /** Logic play field (always 720x1280; all gameplay maths and fairness use this). */
  fieldW: number;
  fieldH: number;
  /** Camera zoom applied to the field and the on-canvas rectangle it occupies (dispW = fieldW * zoom). */
  zoom: number;
  fieldX: number;
  fieldY: number;
  dispW: number;
  dispH: number;
  playerY: number;
  stripTop: number;
  stripBottom: number;
}

/** Windows wider than this (w/h) get the landscape frame. */
export const LANDSCAPE_MIN_RATIO = 1.15;

const PORTRAIT: Frame = {
  mode: 'portrait', width: 720, height: 1280, fieldX: 0, fieldY: 0, zoom: 1,
  fieldW: FIELD_W, fieldH: FIELD_H, dispW: FIELD_W, dispH: FIELD_H,
  playerY: 1000, stripTop: 1060, stripBottom: 1280,
};
const L_W = 1440;
const L_H = 810;
const L_ZOOM = L_H / FIELD_H;
const LANDSCAPE: Frame = {
  mode: 'landscape', width: L_W, height: L_H, fieldX: (L_W - FIELD_W * L_ZOOM) / 2, fieldY: 0, zoom: L_ZOOM,
  fieldW: FIELD_W, fieldH: FIELD_H, dispW: FIELD_W * L_ZOOM, dispH: L_H,
  playerY: 1000, stripTop: 1060, stripBottom: 1280,
};

export function pickMode(viewW: number, viewH: number, override?: FrameMode): FrameMode {
  if (override) return override;
  if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) return 'portrait';
  return viewW / viewH >= LANDSCAPE_MIN_RATIO ? 'landscape' : 'portrait';
}

export function frameFor(mode: FrameMode): Frame {
  return { ...(mode === 'landscape' ? LANDSCAPE : PORTRAIT) };
}

export function parseLayoutOverride(search: string): FrameMode | undefined {
  const v = new URLSearchParams(search).get('layout');
  return v === 'portrait' || v === 'landscape' ? v : undefined;
}
```

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop/src/frame.test.ts`

Confirm:
- All tests pass; other tests still pass; output pristine.

**REFACTOR - Clean Up**
- Make `layout.ts` derive its legacy exports from `frameFor('portrait')` (`PLAYER_Y`, `STRIP_TOP`, `STRIP_BOTTOM` stay exported with unchanged values to keep imports valid). Do NOT change `PLAYER_Y` consumers (`fairness.ts`, `schedule.ts`).

**Verify GREEN - Stay Green After Refactor**
Run: `npx vitest run games/dodge-drop && npm run typecheck`

Confirm:
- Existing `layout.test.ts` still passes; output pristine.

**COMMIT**
Run:
`git add games/dodge-drop/src/frame.ts games/dodge-drop/src/frame.test.ts games/dodge-drop/src/layout.ts && git commit -m "feat(dodge-drop): ✨ pure portrait/landscape frame model"`

#### Task 1.2: REMOVED (decision 2026-11-24)
The fairness/scheduler `playerY` + `speedScale` retune is dropped because landscape now shows the full, unchanged 720x1280 field. No code, no commit. The guard that replaces it is the "gameplay geometry is identical in both modes" test in Task 1.1 plus the unchanged existing property tests (`PROPERTY_SEEDS=100 npm test` stays in every later verification step).

#### Task 1.3: defineGame picks the frame, Kit exposes it, test hook
**Goal:** Boot with the right canvas size per viewport, expose `kit.frame` and `__gk.frame`.

**Files:**
- Modify: `packages/game-kit/src/defineGame.ts` (new optional `frame` provider), `packages/game-kit/src/kit.ts` (`frame` field + `applyFrame`), `games/dodge-drop/src/main.ts`
- Create: `packages/game-kit/src/frameProvider.ts`
- Test: `packages/game-kit/src/frameProvider.test.ts`, `e2e/crazygames-viewport.spec.ts` (from Task 0.1 first two tests)

**RED - Write Failing Test**
```ts
// packages/game-kit/src/frameProvider.test.ts
import { describe, expect, it } from 'vitest';
import { resolveCanvasSize } from './frameProvider.ts';

const frames = (w: number, h: number) => ({ width: w, height: h });

describe('resolveCanvasSize', () => {
  it('falls back to the static size when no provider is given', () => {
    expect(resolveCanvasSize(undefined, { width: 720, height: 1280 }, 1920, 1080)).toEqual({ width: 720, height: 1280 });
  });
  it('asks the provider with the viewport', () => {
    const seen: number[] = [];
    const out = resolveCanvasSize((vw, vh) => { seen.push(vw, vh); return frames(1440, 810); }, { width: 720, height: 1280 }, 1920, 1080);
    expect(seen).toEqual([1920, 1080]);
    expect(out).toEqual({ width: 1440, height: 810 });
  });
  it('ignores a provider that returns nonsense', () => {
    expect(resolveCanvasSize(() => frames(0, -1), { width: 720, height: 1280 }, 100, 100)).toEqual({ width: 720, height: 1280 });
  });
});
```

**Requirements:**
- Pure function only unit-tested here; the Playwright tests from 0.1 cover wiring.

**Verify RED - Watch It Fail**
Run: `npx vitest run packages/game-kit/src/frameProvider.test.ts`

Confirm:
- Fails with unresolved import `./frameProvider.ts`.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// packages/game-kit/src/frameProvider.ts
export interface CanvasSize { width: number; height: number }
export type CanvasSizeProvider = (viewW: number, viewH: number) => CanvasSize;

export function resolveCanvasSize(provider: CanvasSizeProvider | undefined, fallback: CanvasSize, viewW: number, viewH: number): CanvasSize {
  if (!provider) return fallback;
  const s = provider(viewW, viewH);
  return Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 0 && s.height > 0 ? s : fallback;
}
```
In `defineGame.ts`: add `canvasSize?: CanvasSizeProvider; frame?: () => unknown` to `GameDefinition`; before `new Phaser.Game` compute `const size = resolveCanvasSize(def.canvasSize, { width: def.width, height: def.height }, window.innerWidth, window.innerHeight)` and use `size.width/size.height`. Add `get frame() { return kit.game.registry.get('gk:frame'); }` to the `__gk` test-hook object. In `kit.ts` add `setFrame(f: unknown)` storing it in `game.registry` key `gk:frame` and a typed generic `frame<T>()` getter. In `main.ts`:
```ts
import { frameFor, parseLayoutOverride, pickMode } from './frame.ts';
const override = typeof location === 'undefined' ? undefined : parseLayoutOverride(location.search);
...
void defineGame({
  ...,
  width: 720, height: 1280, // static fallback
  canvasSize: (vw, vh) => { const f = frameFor(pickMode(vw, vh, override)); return { width: f.width, height: f.height }; },
  onFrame: (vw, vh) => frameFor(pickMode(vw, vh, override)),
});
```
(`onFrame` result is stored into the registry by `defineGame` as `gk:frame` so `kit.frame` works; keep `frame?` typed as `unknown` in game-kit so it stays game-agnostic, with a thin typed accessor in `games/dodge-drop/src/frameAccess.ts`: `export const getFrame = (scene: Phaser.Scene): Frame => scene.registry.get('gk:frame') as Frame;`.)
Also in `index.ts` export `resolveCanvasSize`.

**Verify GREEN - Watch It Pass**
Run: `npx vitest run packages/game-kit && npm run typecheck && npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts -g "landscape frame|portrait frame|layout=portrait"`

Confirm:
- Unit tests pass; the three frame-mode e2e tests pass (aspect and `__gk.frame`); the HUD legibility test is still red (Task 1.4/1.5). Output pristine.

**REFACTOR - Clean Up**
- Remove duplicate window-size reads; make `main.ts` override parsing a single const.

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && npm test`

Confirm:
- Green; output pristine.

**COMMIT**
Run:
`git add packages/game-kit games/dodge-drop/src && git commit -m "feat(game-kit): ✨ viewport-driven canvas size and frame registry hook"`

#### Task 1.4: PlayScene field camera, UI camera, HUD text in side panels
**Goal:** In landscape, the unchanged 720x1280 field renders zoomed in the centre, every readable HUD text lives in a side panel at >= 14 css px (800x450), in-field text is a large minimal cue, and drag feel is preserved; portrait is pixel-identical to before.

**Files:**
- Create: `games/dodge-drop/src/hudLayout.ts`, `games/dodge-drop/src/hudLayout.test.ts`
- Modify: `games/dodge-drop/src/layout.ts` (`dragToDx(fingerDx, zoom = 1)`), `games/dodge-drop/src/layout.test.ts`, `games/dodge-drop/src/PlayScene.ts` (`buildHud` at line 408, `buildStrip` at 393 stays, camera setup in `create()` at line 175, drag handler that calls `dragToDx`; `W`/`H`/`PLAYER_Y`/speed code is NOT touched), `games/dodge-drop/src/backdrop.ts`
- Test: `games/dodge-drop/src/hudLayout.test.ts`, `games/dodge-drop/src/layout.test.ts`, `e2e/crazygames-viewport.spec.ts` (HUD legibility test from Task 0.1)

**RED - Write Failing Test**
```ts
// games/dodge-drop/src/hudLayout.test.ts
import { describe, expect, it } from 'vitest';
import { frameFor } from './frame.ts';
import { fieldFont, hudAnchors, MIN_FIELD_FONT, MIN_PANEL_FONT } from './hudLayout.ts';

const CSS_800 = 450 / 810; // canvas -> css scale at an 800x450 iframe

describe('hudAnchors', () => {
  it('portrait keeps the v2.8.4 anchors', () => {
    const a = hudAnchors(frameFor('portrait'));
    expect(a.score).toEqual({ x: 24, y: 18, originX: 0, panel: false });
    expect(a.timer.originX).toBe(1);
    expect(a.mute).toEqual({ x: 672, y: 48 });
  });
  it('landscape puts every readable HUD anchor in a side panel, clear of the field rectangle', () => {
    const f = frameFor('landscape');
    const a = hudAnchors(f);
    const fieldL = f.fieldX;
    const fieldR = f.fieldX + f.dispW;
    for (const [name, p] of Object.entries({ score: a.score, combo: a.combo, timer: a.timer, shields: a.shields, best: a.best, mute: a.mute, missions: a.missions })) {
      expect(p.x <= fieldL || p.x >= fieldR, `${name} x=${p.x}`).toBe(true);
    }
  });
  it('left panel holds score/combo/best, right panel holds timer/shields/missions/mute', () => {
    const f = frameFor('landscape');
    const a = hudAnchors(f);
    for (const p of [a.score, a.combo, a.best]) expect(p.x).toBeLessThan(f.fieldX);
    for (const p of [a.timer, a.shields, a.missions, a.mute]) expect(p.x).toBeGreaterThan(f.fieldX + f.dispW);
  });
  it('panel text stays legible at 800x450 (>= 14 css px, target 20+)', () => {
    expect(MIN_PANEL_FONT * CSS_800).toBeGreaterThanOrEqual(20);
  });
});

describe('fieldFont', () => {
  it('portrait never changes the size', () => {
    expect(fieldFont(frameFor('portrait'), 34)).toBe(34);
  });
  it('landscape clamps in-field text so it renders >= 14 css px at 800x450', () => {
    const f = frameFor('landscape');
    expect(fieldFont(f, 30)).toBe(MIN_FIELD_FONT);
    expect(fieldFont(f, 110)).toBe(110);
    expect(MIN_FIELD_FONT * f.zoom * CSS_800).toBeGreaterThanOrEqual(14);
  });
});
```
Add to `layout.test.ts`:
```ts
it('dragToDx compensates for the camera zoom so on-screen follow ratio is constant', () => {
  expect(dragToDx(100)).toBe(150);
  expect(dragToDx(100, 0.5)).toBe(300);
  expect(dragToDx(100, 0)).toBe(150); // guard against a zero zoom
});
```

**Verify RED - Watch It Fail**
Run: `npx vitest run games/dodge-drop/src/hudLayout.test.ts games/dodge-drop/src/layout.test.ts`

Confirm:
- Fails with unresolved import `./hudLayout.ts` and the zoom drag assertion failing (`dragToDx` ignores the second argument).

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// games/dodge-drop/src/hudLayout.ts
import type { Frame } from './frame.ts';

/** Panel text in canvas px: 40 * (450/810) = 22 css px at an 800x450 iframe. */
export const MIN_PANEL_FONT = 40;
/** In-field text in logic px: 40 * zoom 0.633 * 0.556 = 14 css px at 800x450. */
export const MIN_FIELD_FONT = 40;

export interface Anchor { x: number; y: number; originX?: number; panel?: boolean }
export interface HudAnchors {
  score: Anchor; combo: Anchor; timer: Anchor; shields: Anchor; best: Anchor; missions: Anchor;
  mute: { x: number; y: number };
}

export function fieldFont(f: Frame, size: number): number {
  return f.mode === 'landscape' ? Math.max(size, MIN_FIELD_FONT) : size;
}

export function hudAnchors(f: Frame): HudAnchors {
  if (f.mode === 'portrait') {
    return {
      score: { x: 24, y: 18, originX: 0, panel: false },
      combo: { x: 24, y: 76, originX: 0, panel: false },
      timer: { x: f.width - 100, y: 24, originX: 1, panel: false },
      shields: { x: 220, y: 44, originX: 0, panel: false },
      best: { x: 24, y: 120, originX: 0, panel: false },
      missions: { x: f.width / 2, y: 120, originX: 0.5, panel: false },
      mute: { x: f.width - 48, y: 48 },
    };
  }
  const left = 32;
  const rightPanelX = f.fieldX + f.dispW + 32;
  return {
    score: { x: left, y: 40, originX: 0, panel: true },
    combo: { x: left, y: 140, originX: 0, panel: true },
    best: { x: left, y: 250, originX: 0, panel: true },
    timer: { x: f.width - 32, y: 40, originX: 1, panel: true },
    shields: { x: rightPanelX, y: 150, originX: 0, panel: true },
    missions: { x: rightPanelX, y: 280, originX: 0, panel: true },
    mute: { x: f.width - 56, y: f.height - 56 },
  };
}
```
```ts
// layout.ts
export function dragToDx(fingerDx: number, zoom = 1): number {
  return (fingerDx * DRAG_GAIN) / (zoom > 0 ? zoom : 1);
}
```
Then wire PlayScene (each step followed by `npm run build:local`; nothing in `W`/`H`/`PLAYER_Y`/spawn/speed code changes):
1. `create()`: `this.frame = getFrame(this)` (accessor from Task 1.3). When `frame.mode === 'landscape'`: `const cam = this.cameras.main; cam.setViewport(frame.fieldX, 0, frame.dispW, frame.dispH); cam.setZoom(frame.zoom); cam.centerOn(W / 2, H / 2); this.uiCam = this.cameras.add(0, 0, frame.width, frame.height);`. Portrait: no uiCam.
2. Object routing without touching every `add.*` call: a `private buildingHud = false` flag; `this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (o) => { if (!this.uiCam) return; if (this.buildingHud) this.cameras.main.ignore(o); else this.uiCam.ignore(o); })`. `buildHud()` and the panel decoration run inside `this.buildingHud = true ... false`. Objects created later at runtime (pop text, bursts, blocks) are field objects and are ignored by the UI camera automatically. Phaser skips ignored objects in input hit-testing per camera; verify in the e2e by clicking the mute button in a panel.
3. `buildHud`: positions from `hudAnchors(frame)`; text sizes in landscape use `Math.max(size, MIN_PANEL_FONT)` for panel text; in-field cues (`hint` at line ~428, rush/overdrive/grace banners, `popText` calls) pass sizes through `fieldFont(frame, size)`. Combo text/bar and shield icon row move to the panel anchors in landscape; mute button (`kit.addMuteButton`) and fullscreen button (only if the platform feature allows it) at `a.mute`.
4. Panel decoration: dark gradient panels at depth -100 in canvas coordinates (art arrives in Task 3.5). The persistent mission list in the right panel uses `missionLabel.ts` (read-only).
5. Drag: replace `dragToDx(dx)` call with `dragToDx(dx, this.frame.zoom)` (pointer deltas are in canvas px).
6. 144/165 Hz check: confirm every movement uses `dt` (grep `delta` use in `update`); add nothing if already true.
7. Test hook (inside the existing `__GK_TEST_HOOKS__` block, line ~230): `hud: () => [...]` returning `{name, x, y, fontPx, inField}` for score, combo, timer, best, missions, hint and visible banners; `fontPx` = font size times `frame.zoom` for in-field text, `x` in canvas coordinates (add `frame.fieldX + objX * zoom` for field objects).

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop && npm run typecheck && npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts`

Confirm:
- hudLayout/layout tests pass; all of `crazygames-viewport.spec.ts` passes including the 14 css px legibility test at 800x450; inspect `.superpowers/sdd/meta/v3/play-800x450.png` inline (field centred and complete, panels hold all HUD text, nothing clipped).

**REFACTOR - Clean Up**
- Collapse repeated panel/field font logic into one `textStyleFor(kind, size)` in PlayScene; delete dead code.

**Verify GREEN - Stay Green After Refactor**
Run: `PROPERTY_SEEDS=100 npm test && npm run typecheck && npm run test:smoke`

Confirm:
- Existing smoke specs still green IF they run in portrait: they use Playwright's default 1280x720 viewport, which now selects landscape. Task 1.6 pins them; until then run `test:smoke` with `?layout=portrait` locally or do Task 1.6 immediately after 1.4/1.5 before pushing. Do not push between 1.4 and 1.6.

**COMMIT**
Run:
`git add games/dodge-drop packages/game-kit e2e && git commit -m "feat(dodge-drop): ✨ landscape frame with zoomed full field and side-panel HUD"`

#### Task 1.5: Title, Shop, Results and GameOver lay out on the real landscape canvas
**Goal:** These scenes are usable and legible (>= 14 css px at 800x450, target 20) on the 1440x810 canvas and unchanged at 720x1280. Unlike PlayScene they are NOT zoomed portrait columns, because a 1280-tall column zoomed to 810 would shrink their text below the legibility floor.

**Files:**
- Modify: `packages/game-kit/src/titleLayout.ts`, `packages/game-kit/src/scenes/TitleScene.ts`, `packages/game-kit/src/scenes/GameOverScene.ts`, `games/dodge-drop/src/titleExtras.ts`, `games/dodge-drop/src/ShopScene.ts` (uses `this.scale.width/height`; hard-coded y values such as `TAB_Y` and `1280 * 0.72`), `games/dodge-drop/src/results.ts` (line 205 `scene.scale.height * 0.745`), `games/dodge-drop/src/backdrop.ts`
- Test: `packages/game-kit/src/titleLayout.test.ts`, `e2e/crazygames-viewport.spec.ts`

**RED - Write Failing Test**
Extend `packages/game-kit/src/titleLayout.test.ts` with a landscape case (read the existing exports first with `sed -n 1,60p packages/game-kit/src/titleLayout.ts` and mirror their parameter names). The test asserts that for `{width:1440,height:810}` the title block, the menu button column and the extras fit inside `[0,height]` with >= 24 px margins, button heights are >= 88 canvas px (= 49 css px at 800x450), and that the portrait output is deep-equal to the pre-change snapshot (store the v2.8.4 numbers as literals by running the current function once). Add to `e2e/crazygames-viewport.spec.ts`:
```ts
test('title, shop and results fit the landscape canvas and are legible at 800x450', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto(GAME);
  await ready(page);
  const rows = await page.evaluate(() => {
    const w = window as unknown as { __dd?: { bounds?: () => { name: string; top: number; bottom: number; fontPx: number }[] }; __gk: { frame: { height: number } } };
    return { items: w.__dd?.bounds?.() ?? null, h: w.__gk.frame.height };
  });
  expect(rows.items, 'bounds hook present').not.toBeNull();
  const bad = rows.items!.filter((b) => b.top < 0 || b.bottom > rows.h || b.fontPx * (450 / rows.h) < 14);
  expect(bad).toEqual([]);
});
```
with a test hook `__dd.bounds()` registered by each scene (title, shop, results, game over) in `__GK_TEST_HOOKS__`, returning its text/button objects' vertical bounds and effective font px.

**Requirements:**
- Pure layout functions take `{width,height}`; scenes stop assuming 720x1280.

**Verify RED - Watch It Fail**
Run: `npx vitest run packages/game-kit/src/titleLayout.test.ts && npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts -g "fit the landscape"`

Confirm:
- Both fail for the expected reason ("bounds hook present" / layout overflow), not selector typos.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
- `titleLayout.ts`: derive vertical positions from `height` fractions instead of absolute 1280-based numbers; in landscape centre logo/menu in the middle column with the title decoration art (Phase 3) in the side areas.
- `ShopScene.ts`: in landscape arrange tabs on top and cards in a two-column grid on the 1440 width; panel fonts >= 36 canvas px. This is the heaviest relayout of Phase 1; if it overruns, the minimum acceptable fallback is a single column with larger cards and scrolling, recorded in the notes file.
- `results.ts` / `GameOverScene.ts`: score summary left, buttons right in landscape (existing content, new anchors); verify `0.745` fraction.
- Each scene registers `__dd.bounds` in the test-hook block.

**Verify GREEN - Watch It Pass**
Run: `npx vitest run packages/game-kit games/dodge-drop && npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts`

Confirm:
- Pass; screenshots of title, shop, results at 800x450 and 1920x1080 inspected inline (`.superpowers/sdd/meta/v3/`), text readable, no clipping.

**REFACTOR - Clean Up**
- Share a `isLandscape(frame)`/anchor helper between Shop and Results (DRY).

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && PROPERTY_SEEDS=100 npm test`

Confirm:
- Green; output pristine.

**COMMIT**
Run:
`git add packages/game-kit games/dodge-drop e2e && git commit -m "feat(dodge-drop): ✨ adapt title, shop and results to landscape canvas"`

#### Task 1.6: Pin existing e2e specs to portrait, add landscape journey, runtime orientation switch
**Goal:** Existing specs keep their 720x1280 coordinates; landscape has its own end-to-end journey; layout switches only between runs.

**Files:**
- Modify: `e2e/dodge-drop.spec.ts` (goto lines), `e2e/smoke.spec.ts`, `e2e/results.spec.ts`, `e2e/dodge-drop-mobile.spec.ts`, `e2e/rwd.spec.ts`, `e2e/portals.spec.ts`, `packages/game-kit/src/defineGame.ts` (resize handler), `package.json` (`test:smoke` list adds `e2e/crazygames-viewport.spec.ts`)
- Test: `e2e/crazygames-viewport.spec.ts`

**RED - Write Failing Test**
Add to `e2e/crazygames-viewport.spec.ts`:
```ts
test('layout switches on rotation only when no run is in progress', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(GAME);
  await ready(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.frame?.mode === 'landscape');
  await page.mouse.click(300, 190);
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame?.mode)).toBe('landscape'); // mid-run: unchanged
  await page.evaluate(() => (window as unknown as { __gk: { endRound(s?: number): Promise<void> } }).__gk.endRound(5));
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.frame?.mode === 'portrait');
});
```
And one landscape journey test: start, play 2 s with the arrow keys, die via `endRound`, assert results visible, retry with Space, assert `Play` active again.

**Verify RED - Watch It Fail**
Run: `npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts -g "rotation"`

Confirm:
- Fails because the mode never switches after the initial boot (no resize handling).

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
- `defineGame.ts`: on `window.resize` (debounced 150 ms) compute the new frame via `def.onFrame`; if `kit.session.state !== 'playing'` (and no overlay), `game.scale.setGameSize(w, h)`, update registry `gk:frame`, and restart the active non-play scene (`scene.restart()`); if playing, remember `pendingFrame` and apply it from the `Kit.gameOver`/`Kit.retry` entry points (call `kit.applyPendingFrame()` before `scene.start(playKey)`).
- Every e2e spec's `page.goto(...)` for the dodge-drop URL gets `?layout=portrait` (a single `const GAME = '.../dodge-drop/?layout=portrait'` edit per spec; for `rwd.spec.ts` only the phone devices, desktop keeps default so it exercises landscape; add 1920x1080 and 1280x720 desktop entries and adapt its assertions to read `frame.mode`).
- `package.json`: append `e2e/crazygames-viewport.spec.ts` to `test:smoke`.

**Verify GREEN - Watch It Pass**
Run: `npm run typecheck && PROPERTY_SEEDS=100 npm test && npm run test:smoke`

Confirm:
- All smoke specs including the new one pass; output pristine. Also run once `npm run test:rwd` and inspect device screenshots in `.superpowers/sdd/meta/mobile/` (including the new desktop sizes).
- CrazyGames build: `PLATFORM=crazygames` build shows no custom fullscreen button in either frame (assert via `npm run test:portals`, which uses the fake SDK).

**REFACTOR - Clean Up**
- Extract the spec URL const into `e2e/fixtures/urls.ts` if 3+ specs repeat it.

**Verify GREEN - Stay Green After Refactor**
Run: `npm run test:smoke && npm run test:portals`

Confirm:
- Green; output pristine.

**COMMIT**
Run:
`git add -A e2e packages/game-kit package.json && git commit -m "feat(dodge-drop): ✨ safe orientation switching and landscape e2e coverage"`

#### Task 1.7: Phone tap-target audit (folded from progress.md open item)
**Goal:** Chips and skip buttons are >= 44 css px tall on a 375x667 phone in portrait.

**Files:**
- Modify: `games/dodge-drop/src/runSetup.ts` or the file that builds tier chips (find with `grep -rn "tierHeader" games/dodge-drop/src`), `games/dodge-drop/src/titleExtras.ts`
- Test: `e2e/dodge-drop-mobile.spec.ts`

**RED - Write Failing Test**
Add a test using the existing `__dd.bounds()` hook (Task 1.5) plus `canvas` scale at 375x667 (scale 375/720 = 0.52): every interactive object height * scale >= 44, i.e. >= 85 game px:
```ts
test('interactive controls are at least 44 css px on an iPhone SE', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:5180/dodge-drop/?layout=portrait');
  await page.waitForFunction(() => (window as unknown as { __gk?: { activeScenes: string[] } }).__gk?.activeScenes.includes('GKTitle'));
  const small = await page.evaluate(() => {
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    const s = c.width / 720;
    return (window as unknown as { __dd: { tapTargets(): { name: string; h: number }[] } }).__dd.tapTargets().filter((t) => t.h * s < 44);
  });
  expect(small).toEqual([]);
});
```
(`tapTargets()` hook returns `{name,h}` for every `addButton`/chip; add to `packages/game-kit/src/ui/button.ts` registration under `__GK_TEST_HOOKS__`.)

**Verify RED - Watch It Fail**
Run: `npm run build:local && npx playwright test e2e/dodge-drop-mobile.spec.ts -g "44 css px"`

Confirm:
- Fails listing the ~22 css px chips/skip, not a missing hook (hook must exist after the Task 1.7 test-hook edit; if the hook itself is missing the failure is an error, fix first).

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
Raise chip/skip hit areas to `Math.max(height, 88)` game px using `setInteractive(new Phaser.Geom.Rectangle(...))` expansion (visual size may stay; hit area grows) in the files above.

**Verify GREEN - Watch It Pass**
Run: `npm run build:local && npx playwright test e2e/dodge-drop-mobile.spec.ts`

Confirm:
- Pass; other mobile specs pass; output pristine.

**REFACTOR - Clean Up**
- Put the 88 px minimum in one `MIN_TAP` constant in `packages/game-kit/src/ui/button.ts`.

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && npm run test:smoke`

Confirm:
- Green.

**COMMIT**
Run:
`git commit -am "fix(dodge-drop): 🐛 enlarge small-phone tap targets to 44 css px"`

#### Task 1.8: Manifest orientation `any` and portal form check
**Exception Type:** Configuration-only
**User Approval:** Approved by the user on 2026-11-24 (TDD-exception contract for tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3).
**Files:**
- Modify: `games/dodge-drop/game.json` (`"orientation": "portrait"` -> `"any"`; extend `instructions.en` with "Landscape and portrait both supported")

**Implementation**
Change the one field. `scripts/publish-payload.ts` maps `any` to the portal's `BOTH` (already in `ORIENT`). Do not bump the version here (Task 4.2).

**Verification**
Run: `npm test -- scripts/publish-payload.test.ts packages/game-kit/src/manifest.test.ts && npm run typecheck`

Confirm:
- `manifest.ts` accepts `any` (it is in `ORIENTATIONS`); payload test passes; `npm run publish:prep -- dodge-drop` prints `mobileOrientation: 'BOTH'` (it may still exit 1 for version/covers; only check that field).
- Output pristine.


**COMMIT**
Run:
`git commit -am "chore(dodge-drop): 🔧 declare portrait and landscape support"`

### Phase 2: Onboarding and a persistent visible goal (replaces the personal-best cue, decision 5)

Source: gap #2 in `docs/specs/dodge-drop/crazygames-gap-analysis.md` ("Thin first 30 s: text-only hint, no visual onboarding, no clear early goal"). CrazyGames quality guideline 1 asks for skippable onboarding built into gameplay, visuals over text, controls shown by overlay/gestures; the FAQ asks for a clear goal and fast intuitive onboarding. The earlier personal-best cue (`pbCue.ts`, PB line in the HUD) was dropped by the user on 2026-11-24; do not build it. Three deliverables: (1) first-run visual control tutorial (Tasks 2.1, 2.2), (2) always-visible next-medal goal bar (Tasks 2.3, 2.4), (3) gentler first 10 s - evaluated, scripted opening DEFERRED (see the decision below), optional low-risk substitute in Task 2.5.

Existing facts the tasks build on (verified 2026-11-24): the 4 s text hint is `PlayScene.ts` `this.hint` built in `buildHud` (about line 530, `kit.t('dragHint')`, depth 100, field text via `textStyleFor('field', 36, ...)`) and faded by `updateHint(drag)` (about line 602; ends on `drag !== 0 || this.gin.vector().x !== 0 || t - runStartT >= HINT_SECONDS`, `HINT_SECONDS = 4` at line 45). `gin = kit.input(this, { joystick: false })` handles pointer drag and arrow keys. Medal tiers live in `games/dodge-drop/src/medals.ts` `MEDALS` (bronze 30 s, silver 60, gold 90, neon 120, diamond 180, legend 240; `medalsReached`, `mergeMedals`), strings `medal.<id>` in `strings.ts` (en and zh-TW). Persistence is `kit.save` (`SaveData.getJSON/setJSON`, key prefixed `dodge-drop:`) read in the `Promise.all` in `PlayScene.create` (about line 285). HUD anchors are in `hudLayout.ts` (`hudAnchors(frame)`; landscape left panel today: score y 40, combo y 140 plus its 12 px bar at y 204, an unused `best` anchor at y 250 that Phase 2 repurposes as `goal`); test hook `__dd.hud()` is `hudReport()` (about line 420) and is asserted at >= 14 css px in `e2e/crazygames-viewport.spec.ts`.

Easy-opening decision (Task 2.5 explains): a scripted gentler opening is NOT done. The first 10 s is already single-block `rain` (`waves.ts:24-27` `waveKindAt` returns `rain` below 10 s; `waves.ts:53-56` `rainRowExpected` is 1 until 90 s), preceded by a 0.4 s start offset (`schedule.ts:7` `START = 0.4`). Making it gentler means a time-varying interval/speed inside `schedule.ts`/`waves.ts` (today `speedMul`/`intervalMul` are constant per run, `schedule.ts:10-14`, `:70`) and the fairness validator replays the same speed (`schedule.ts:73-75`, property tests `schedule.test.ts:29,77,81,85`), so any change risks the "survivable for every seed" invariant. Deferred.

Commander resolutions (2026-11-25, user delegated "review then implement without confirmation"):
- Task 2.5 (free first-run shield) is NOT executed: it changes balance and was not requested. The deferral record for the scripted opening stays as documentation only.
- Tutorial shows at most `TUTORIAL_MAX_RUNS = 2` runs, auto-dismiss after 6 s: accepted.
- Desktop mouse users see the arrow-key caps with the caption "Arrow keys or drag": accepted.
- `skipOnboarding(page)` fixture on clean-run e2e tests: accepted.
- Landscape goal label that does not fit one line at 30 px: use the two-line fallback described in Task 2.4.

#### Task 2.1: Onboarding model (pure)
**Goal:** One tested module decides whether the first-run tutorial shows, which control scheme to show (touch ghost-finger vs arrow-key caps), when it ends, and where the animated ghost finger is. No Phaser, no storage.

**Files:**
- Create: `games/dodge-drop/src/onboarding.ts`
- Test: `games/dodge-drop/src/onboarding.test.ts`

**RED - Write Failing Test**
```ts
// games/dodge-drop/src/onboarding.test.ts
import { describe, expect, it } from 'vitest';
import {
  controlKind, ghostX, onTutorialInput, onTutorialShown, sanitizeOnboarding, shouldShowTutorial,
  tutorialEnded, TUTORIAL_MAX_RUNS, TUTORIAL_SECONDS,
} from './onboarding.ts';

describe('sanitizeOnboarding', () => {
  it('defaults for missing or corrupt data', () => {
    for (const raw of [undefined, null, 5, 'x', [], { shown: 'a' }, { shown: -3, completed: 'yes' }]) {
      expect(sanitizeOnboarding(raw)).toEqual({ shown: 0, completed: false });
    }
  });
  it('keeps valid data', () => {
    expect(sanitizeOnboarding({ shown: 1, completed: true })).toEqual({ shown: 1, completed: true });
  });
});

describe('shouldShowTutorial', () => {
  it('shows on a fresh install', () => {
    expect(shouldShowTutorial({ shown: 0, completed: false })).toBe(true);
  });
  it('never shows again once the player used the controls during it', () => {
    expect(shouldShowTutorial(onTutorialInput({ shown: 1, completed: false }))).toBe(false);
  });
  it('gives up after TUTORIAL_MAX_RUNS shows even if the player never moved', () => {
    let s = sanitizeOnboarding(undefined);
    for (let i = 0; i < TUTORIAL_MAX_RUNS; i++) s = onTutorialShown(s);
    expect(shouldShowTutorial(s)).toBe(false);
  });
});

describe('controlKind', () => {
  it('last input wins', () => {
    expect(controlKind('key', true)).toBe('keys');
    expect(controlKind('touch', false)).toBe('touch');
  });
  it('before any input a coarse pointer means touch, otherwise keys (mouse users get the arrow keys; drag also works)', () => {
    expect(controlKind(null, true)).toBe('touch');
    expect(controlKind(null, false)).toBe('keys');
    expect(controlKind('mouse', false)).toBe('keys');
  });
});

describe('tutorialEnded', () => {
  it('ends on the first real input or after TUTORIAL_SECONDS', () => {
    expect(tutorialEnded(0.5, false)).toBe(false);
    expect(tutorialEnded(0.5, true)).toBe(true);
    expect(tutorialEnded(TUTORIAL_SECONDS, false)).toBe(true);
  });
});

describe('ghostX', () => {
  it('sweeps left and right around the centre, bounded by the amplitude, and is NaN-safe', () => {
    const xs = Array.from({ length: 49 }, (_, i) => ghostX(i * 0.05, 360, 200));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(160 - 1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(560 + 1e-6);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300);
    expect(ghostX(Number.NaN, 360, 200)).toBe(360);
  });
});
```

**Requirements:**
- One behaviour per `it`; no mocks.

**Verify RED - Watch It Fail**
Run: `npx vitest run games/dodge-drop/src/onboarding.test.ts`

Confirm:
- Fails with unresolved import `./onboarding.ts`, not a syntax error.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// games/dodge-drop/src/onboarding.ts
/** First-run control tutorial model. Persisted by the scene under the SaveData key `onboarding` (key-value, no DB). */
export interface Onboarding { shown: number; completed: boolean }
export type LastInput = 'touch' | 'mouse' | 'key' | null;
export type ControlKind = 'touch' | 'keys';

/** Shown at most this many runs when the player ignores it; a real input during it ends it for good. */
export const TUTORIAL_MAX_RUNS = 2;
export const TUTORIAL_SECONDS = 6;
const SWEEP_PERIOD = 2.4;

export function sanitizeOnboarding(raw: unknown): Onboarding {
  const o = (raw ?? {}) as { shown?: unknown; completed?: unknown };
  const shown = typeof o.shown === 'number' && Number.isFinite(o.shown) && o.shown > 0 ? Math.floor(o.shown) : 0;
  return { shown, completed: o.completed === true };
}

export function shouldShowTutorial(s: Onboarding): boolean {
  return !s.completed && s.shown < TUTORIAL_MAX_RUNS;
}
export function onTutorialShown(s: Onboarding): Onboarding {
  return { ...s, shown: s.shown + 1 };
}
export function onTutorialInput(s: Onboarding): Onboarding {
  return { ...s, completed: true };
}

export function controlKind(last: LastInput, coarsePointer: boolean): ControlKind {
  if (last === 'key') return 'keys';
  if (last === 'touch') return 'touch';
  if (last === 'mouse') return 'keys';
  return coarsePointer ? 'touch' : 'keys';
}

export function tutorialEnded(elapsed: number, gotInput: boolean): boolean {
  return gotInput || elapsed >= TUTORIAL_SECONDS;
}

/** Ghost finger x (field px) at `elapsed` s: smooth left-right sweep around `centre`. */
export function ghostX(elapsed: number, centre: number, amplitude: number): number {
  if (!Number.isFinite(elapsed)) return centre;
  return centre + amplitude * Math.sin((elapsed / SWEEP_PERIOD) * Math.PI * 2);
}
```

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop/src/onboarding.test.ts`

Confirm:
- All pass; output pristine.

**REFACTOR - Clean Up**
- None expected; keep constants named and exported only if the scene needs them.

**Verify GREEN - Stay Green After Refactor**
Run: `npx vitest run games/dodge-drop && npm run typecheck`

Confirm:
- Green.

**COMMIT**
Run:
`git add games/dodge-drop/src/onboarding.ts games/dodge-drop/src/onboarding.test.ts && git commit -m "feat(dodge-drop): ✨ first-run onboarding model"`

#### Task 2.2: First-run visual control tutorial in PlayScene (touch ghost finger and arrow-key caps)
**Goal:** On the first run(s) the player sees, inside gameplay, an animated ghost finger sweeping along the thumb strip (touch) or two pulsing arrow-key caps (desktop), in portrait and landscape. It disappears (fade 300 ms) on the first real input or after `TUTORIAL_SECONDS`, is skippable by simply playing, and is not shown again once the player used the controls. It replaces the 4 s text hint on tutorial runs (the hint object is kept as the short caption); runs without a tutorial keep today's hint unchanged. Do NOT add DB or new storage: the state is one `SaveData` JSON key `onboarding`.

**Files:**
- Modify: `games/dodge-drop/src/PlayScene.ts` (`create` `Promise.all` reads `save.getJSON('onboarding', null)` next to `skin`/`workshop`, about line 285; new `buildTutorial()` called from `buildHud` after the hint, new `updateTutorial(drag)` called next to `updateHint(drag)` in `update`, `hudReport()` adds a `tutorial` entry, `__dd` hook adds `tutorial: () => ({ visible, kind })`; last-input tracking via `this.input.on('pointerdown'|'pointermove', p => lastInput = p.wasTouch ? 'touch' : 'mouse')` and `this.input.keyboard?.on('keydown', () => lastInput = 'key')`), `games/dodge-drop/src/strings.ts` (`tutorial.touch`, `tutorial.keys` captions, en and zh-TW), `docs/STATUS.md` only if it lists the hint
- Test: `e2e/crazygames-viewport.spec.ts` (landscape and zh-TW legs), `e2e/dodge-drop.spec.ts` (portrait tutorial lifecycle), `e2e/dodge-drop-mobile.spec.ts` (touch kind)

**RED - Write Failing Test**
```ts
// e2e/dodge-drop.spec.ts (portrait; the file already pins ?layout=portrait via its GAME url, reuse its helpers)
type DDTut = { visible: boolean; kind: 'touch' | 'keys' };
const tut = (page: Page) => page.evaluate(() => (window as unknown as { __dd: { tutorial(): DDTut } }).__dd.tutorial());

test('first run shows the visual control tutorial; first input dismisses it; second run does not show it', async ({ page }) => {
  await page.goto(GAME); // fresh context: empty localStorage
  await startRun(page); // existing helper: click title, wait for 'Play'
  expect(await tut(page)).toEqual({ visible: true, kind: 'keys' });
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await tut(page)).visible).toBe(false);
  // second run in the same browser profile: the stored onboarding state says completed
  await page.reload();
  await startRun(page);
  expect((await tut(page)).visible).toBe(false);
});

test('tutorial times out by itself when the player does nothing', async ({ page }) => {
  await page.goto(GAME);
  await startRun(page);
  await page.evaluate(() => { (window as unknown as { __dd: { god: boolean } }).__dd.god = true; });
  await expect.poll(async () => (await tut(page)).visible, { timeout: 9000 }).toBe(false);
});
```
```ts
// e2e/crazygames-viewport.spec.ts: add to the existing 800x450 HUD legibility test, after the Play scene is up
const hudT = await page.evaluate(() => (window as unknown as { __dd: { hud(): DDHud } }).__dd.hud());
const tutorialRow = hudT.find((h) => h.name === 'tutorial');
expect(tutorialRow, 'first-run tutorial is visible in landscape').toBeTruthy();
expect(tutorialRow!.fontPx * scale, 'tutorial caption font in CSS px').toBeGreaterThanOrEqual(14);
```
```ts
// e2e/dodge-drop-mobile.spec.ts (hasTouch context): the touch scheme is chosen without any prior input
expect(await tut(page)).toEqual({ visible: true, kind: 'touch' });
```
(Use the helpers each spec already has; confirm names with `grep -n "async function\|const .* = async" e2e/dodge-drop.spec.ts e2e/dodge-drop-mobile.spec.ts`. If `god` is not reachable before `__dd` exists, set it after the Play scene is up, as other specs do.)

**Verify RED - Watch It Fail**
Run: `npm run build:local && npx playwright test e2e/dodge-drop.spec.ts -g "control tutorial|times out by itself"`

Confirm:
- Fails because `__dd.tutorial` is not a function (not because of timeouts in unrelated helpers).

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
- State: `private onboarding: Onboarding`, `private tutorialOn = false`, `private tutorialStartT = 0`, `private lastInput: LastInput = null`, `private tutorialObjs: Phaser.GameObjects.GameObject[] = []`. In the `Promise.all` result: `this.onboarding = sanitizeOnboarding(rawOnboarding)`; `this.tutorialOn = shouldShowTutorial(this.onboarding)`; if on, `this.onboarding = onTutorialShown(...)`, `void save.setJSON('onboarding', this.onboarding)` (counts the show immediately so a reload mid-run still counts), then `buildTutorial()`.
- `buildTutorial()`: `kind = controlKind(this.lastInput, this.sys.game.device.input.touch && !this.sys.game.device.os.desktop)`. All objects are field objects (main camera in landscape, so no `inPanel`), depth 99, drawn over the thumb strip (`STRIP_TOP..STRIP_BOTTOM`, y about 1170): touch = a graphics circle (fingertip, radius 34, white alpha 0.55, with a short fading trail of 3 smaller circles) tweened/updated each frame to `ghostX(elapsed, W / 2, 200)` at `y = (STRIP_TOP + STRIP_BOTTOM) / 2`; keys = two rounded 96x96 key caps with `←` and `→` glyph texts (`textStyleFor('field', 60, theme.text)`, so >= 40 logic px in landscape) at `W / 2 -/+ 90`, alpha pulsing 0.5 to 1 via a looping tween. Caption: reuse `this.hint` with `kit.t('tutorial.touch')` / `kit.t('tutorial.keys')` moved to y 1110 (still `textStyleFor('field', 36, ...)`, so clamped to 40 logic px in landscape) instead of the old 800 position, only while `tutorialOn`.
- `updateTutorial(drag)`: if `!tutorialOn || dead` return; `got = drag !== 0 || this.gin.vector().x !== 0`; update the ghost x; `if (tutorialEnded(this.t - this.tutorialStartT, got))`: tween all objects alpha 0 over 300 ms then destroy, `tutorialOn = false`, and `if (got) { this.onboarding = onTutorialInput(this.onboarding); void save.setJSON('onboarding', this.onboarding); }`. `updateHint` must skip the hint when `tutorialOn` (the caption fades with the tutorial) and otherwise behave as today. `tutorialStartT = this.t` when the run actually starts (after the `Promise.all` resolves and `ready` is set).
- `strings.ts` (en / zh-TW): `'tutorial.touch': 'Drag to move'` / `'左右拖曳移動'`, `'tutorial.keys': 'Arrow keys or drag'` / `'方向鍵或拖曳移動'`; keep both short enough for one line inside the 720 px field (check zh-TW leg). `strings.test.ts` parity test must stay green.
- `hudReport()`: add `add('tutorial', this.tutorialOn ? this.hint : null, true)` (caption text, in-field, so the existing legibility test covers it); `__dd.tutorial: () => ({ visible: this.tutorialOn, kind: this.tutorialKind })`.
- Seed isolation: existing specs that need an untouched first run (screenshot-variance tests, results overlay opacity) must not start with the tutorial on screen; add a small `e2e/fixtures/onboarding.ts` helper `skipOnboarding(page)` using `page.addInitScript(() => localStorage.setItem('dodge-drop:onboarding', JSON.stringify({ shown: 2, completed: true })))` (confirm the local adapter key format with `grep -n "localStorage" packages/platform/src/adapters/local.ts`) and call it from those tests only after the new tests pass.

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop && npm run build:local && npx playwright test e2e/dodge-drop.spec.ts e2e/dodge-drop-mobile.spec.ts e2e/crazygames-viewport.spec.ts`

Confirm:
- New tests pass in en and zh-TW (viewport spec runs both locales); take one portrait and one 800x450 screenshot with the tutorial up and view them: the ghost/keys must not cover the player (`PLAYER_Y` 1000) or hide falling blocks.

**REFACTOR - Clean Up**
- If `PlayScene.ts` grew noticeably, move drawing into `games/dodge-drop/src/tutorialView.ts` (factory taking the scene, kind and theme; returns `{ update(elapsed), dismiss(): void }`), keeping the pure decisions in `onboarding.ts`.

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && PROPERTY_SEEDS=100 npm test && npm run test:smoke`

Confirm:
- Green; `fairness.ts`/`schedule.ts` untouched (`git diff --stat` shows neither).

**COMMIT**
Run:
`git add games/dodge-drop e2e && git commit -m "feat(dodge-drop): ✨ first-run visual control tutorial"`

#### Task 2.3: Goal bar model (pure)
**Goal:** One tested function returns the next medal target with a progress fraction from the previous tier threshold, and after the top medal optionally a percent of the personal best score (`kit.session.best`).

**Files:**
- Create: `games/dodge-drop/src/goalBar.ts`
- Test: `games/dodge-drop/src/goalBar.test.ts`

**RED - Write Failing Test**
```ts
// games/dodge-drop/src/goalBar.test.ts
import { describe, expect, it } from 'vitest';
import { nextGoal } from './goalBar.ts';

describe('nextGoal (seconds survived, score, best score)', () => {
  it('starts at Bronze 30 s with an empty bar', () => {
    expect(nextGoal(0, 0, 0)).toEqual({ kind: 'medal', id: 'bronze', targetSec: 30, fromSec: 0, frac: 0, remainingSec: 30 });
  });
  it('fills linearly toward the target', () => {
    const g = nextGoal(15, 0, 0);
    expect(g).toMatchObject({ kind: 'medal', id: 'bronze', frac: 0.5, remainingSec: 15 });
  });
  it('advances at the threshold and restarts the bar from the previous tier', () => {
    expect(nextGoal(30, 0, 0)).toMatchObject({ id: 'silver', fromSec: 30, targetSec: 60, frac: 0, remainingSec: 30 });
    expect(nextGoal(75, 0, 0)).toMatchObject({ id: 'gold', fromSec: 60, targetSec: 90, frac: 0.5 });
  });
  it('a tier start (t = 60) goes straight to Gold', () => {
    expect(nextGoal(60, 0, 0)).toMatchObject({ id: 'gold', fromSec: 60, frac: 0 });
  });
  it('after the top medal it shows percent of the personal best, capped at 100', () => {
    expect(nextGoal(240, 250, 500)).toEqual({ kind: 'best', percent: 50, frac: 0.5, best: 500 });
    expect(nextGoal(300, 900, 500)).toEqual({ kind: 'best', percent: 100, frac: 1, best: 500 });
  });
  it('after the top medal with no best there is no goal', () => {
    expect(nextGoal(240, 250, 0)).toEqual({ kind: 'none' });
  });
  it('is safe on NaN and negatives', () => {
    expect(nextGoal(Number.NaN, Number.NaN, 0)).toMatchObject({ id: 'bronze', frac: 0 });
    expect(nextGoal(-4, 0, 0)).toMatchObject({ id: 'bronze', frac: 0 });
  });
});
```

**Verify RED - Watch It Fail**
Run: `npx vitest run games/dodge-drop/src/goalBar.test.ts`

Confirm:
- Fails with unresolved import `./goalBar.ts`.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// games/dodge-drop/src/goalBar.ts
import { MEDALS, type MedalId } from './medals.ts';

export type Goal =
  | { kind: 'medal'; id: MedalId; targetSec: number; fromSec: number; frac: number; remainingSec: number }
  | { kind: 'best'; percent: number; frac: number; best: number }
  | { kind: 'none' };

/** Next visible goal. `seconds` uses the same clock as `medalsReached` (PlayScene `this.t`). */
export function nextGoal(seconds: number, score: number, best: number): Goal {
  const t = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const i = MEDALS.findIndex((m) => m.seconds > t);
  if (i >= 0) {
    const targetSec = MEDALS[i].seconds;
    const fromSec = i === 0 ? 0 : MEDALS[i - 1].seconds;
    const frac = Math.min(1, Math.max(0, (t - fromSec) / (targetSec - fromSec)));
    return { kind: 'medal', id: MEDALS[i].id, targetSec, fromSec, frac, remainingSec: Math.ceil(targetSec - t) };
  }
  if (!(best > 0)) return { kind: 'none' };
  const s = Number.isFinite(score) && score > 0 ? score : 0;
  const frac = Math.min(1, s / best);
  return { kind: 'best', percent: Math.floor(frac * 100), frac, best };
}
```
(Check `remainingSec` for fractional input in the test: `nextGoal(15, ...)` gives 15; `Math.ceil` keeps the countdown from showing 0 before the medal fires.)

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop/src/goalBar.test.ts`

Confirm:
- Pass; pristine.

**REFACTOR - Clean Up**
- None needed (reuses `MEDALS`, no duplicate thresholds).

**Verify GREEN - Stay Green After Refactor**
Run: `npx vitest run games/dodge-drop && npm run typecheck`

Confirm:
- Green.

**COMMIT**
Run:
`git add games/dodge-drop/src/goalBar.ts games/dodge-drop/src/goalBar.test.ts && git commit -m "feat(dodge-drop): ✨ next-medal goal model"`

#### Task 2.4: Goal bar in the HUD (left panel in landscape, compact in portrait)
**Goal:** During a run the HUD always shows the next medal target as a short label plus a progress bar ("Bronze · 30 s", bar fills as the run proceeds), in the left side panel in landscape and as a compact line under the score row in portrait; after Legend it shows percent of best (or nothing). It must stay legible at 800x450 and must not cover the play field in landscape or hide blocks in portrait.

**Files:**
- Modify: `games/dodge-drop/src/hudLayout.ts` (replace the unused `best` anchor with `goal`: landscape `{ x: 32, y: 270, originX: 0, panel: true }`, portrait `{ x: 24, y: 120, originX: 0, panel: false }`; export `GOAL_PANEL_FONT = 30` like `MISSION_PANEL_FONT`), `games/dodge-drop/src/hudLayout.test.ts` (rename `best` to `goal` in the two existing anchor tests), `games/dodge-drop/src/PlayScene.ts` (`buildHud` adds `goalText` and `goalBar` graphics inside `panelHud` so landscape routes them to the UI camera; `updateHud` recomputes `nextGoal(this.t, this.score - this.cfg.headStart, this.kit.session.best)` and redraws only when the text or a 1 % bar step changes; `hudReport()` adds `goal`; `__dd` hook adds `goal: () => ({ text, frac, id })`), `games/dodge-drop/src/strings.ts` (`goal.medal: '{medal} · {n} s'`, `goal.best: '{n}% of best'`, zh-TW `'{medal} · {n} 秒'`, `'最高分 {n}%'`; medal names reuse `medal.<id>`; `kit.t(key)` takes no params, so fill with `.replace`)
- Test: `e2e/crazygames-viewport.spec.ts`, `e2e/dodge-drop.spec.ts`

**RED - Write Failing Test**
```ts
// e2e/crazygames-viewport.spec.ts: inside the existing 800x450 HUD legibility test (and the zh-TW leg of the LOCALES loop at ~line 127)
const goal = hud.find((h) => h.name === 'goal');
expect(goal, 'goal bar text is in the HUD report').toBeTruthy();
expect(goal!.inField, 'goal bar lives in the left side panel').toBe(false);
expect(goal!.x).toBeLessThan(frame.fieldX);
expect(goal!.fontPx * scale, 'goal font in CSS px').toBeGreaterThanOrEqual(14);
```
```ts
// e2e/dodge-drop.spec.ts (portrait)
test('goal bar shows the next medal and fills as the run proceeds', async ({ page }) => {
  await page.goto(GAME);
  await startRun(page);
  const g0 = await page.evaluate(() => (window as unknown as { __dd: { goal(): { text: string; frac: number; id: string } } }).__dd.goal());
  expect(g0.id).toBe('bronze');
  expect(g0.text).toMatch(/Bronze/);
  await page.evaluate(() => { const d = (window as unknown as { __dd: { god: boolean; warp(s: number): void } }).__dd; d.god = true; d.warp(15); });
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __dd: { goal(): { frac: number } } }).__dd.goal())).frac).toBeGreaterThan(0.4);
  await page.evaluate(() => (window as unknown as { __dd: { warp(s: number): void } }).__dd.warp(20));
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __dd: { goal(): { id: string } } }).__dd.goal())).id).toBe('silver');
});
```

**Verify RED - Watch It Fail**
Run: `npm run build:local && npx playwright test e2e/dodge-drop.spec.ts -g "goal bar" && npx playwright test e2e/crazygames-viewport.spec.ts -g "HUD text is in side panels"`

Confirm:
- Fails because `__dd.goal` is not a function / no `goal` row in `hud()`.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
- `hudLayout.ts`: `goal` anchors as above (landscape y 270 sits below combo at 140 plus its bar at 204-216, above the 14 css px floor requirement; portrait y 120 is the row below score/combo, where `missions` was never drawn in portrait). Label font in landscape `GOAL_PANEL_FONT` (30 canvas px = 16.7 css px at 800x450, the longest label "Diamond · 180 s" must fit the ~428 px usable panel width on one line; confirm with a text width check in the e2e or reduce to a two-line label/bar layout); portrait font 26 field px, bar 6 px high, width 220, alpha 0.85, depth 100.
- Bar: a `Phaser.GameObjects.Graphics` under the label (track `0x1a1033` alpha 0.6, fill in the medal colour from `MEDALS[...].color`, accent colour for `best`), landscape width 380 x 14, portrait 220 x 6.
- `updateHud`: compute the goal once per frame; skip redraw when `(id, remainingSec, Math.round(frac * 100))` is unchanged (same pattern as `lastMissionsShown`). When `kind === 'none'` hide both objects. When `this.dead` leave them as is.
- `hudReport()`: `add('goal', this.goalText, false)`. Hook `goal` returns `{ text: goalText.text, frac, id }`.
- Do not add anything to the results screen (stays out of scope).

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop && npm run build:local && npx playwright test e2e/dodge-drop.spec.ts e2e/crazygames-viewport.spec.ts e2e/results.spec.ts`

Confirm:
- Pass in en and zh-TW; view a screenshot at 800x450 (left panel: score, combo, goal bar, nothing clipped) and one portrait screenshot (bar does not collide with the score/combo rows or the mute button).

**REFACTOR - Clean Up**
- Move label formatting to `goalBar.ts` `goalLabel(goal, t)` with a unit test if more than trivial (en/zh-TW strings, plural-free).

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && PROPERTY_SEEDS=100 npm test && npm run test:smoke && npx playwright test e2e/crazygames-viewport.spec.ts`

Confirm:
- Green.

**COMMIT**
Run:
`git add games/dodge-drop e2e && git commit -m "feat(dodge-drop): ✨ persistent next-medal goal bar in the HUD"`

#### Task 2.5: Gentler first run without touching the scheduler (optional, needs user OK) and the deferral record
**Goal:** Record why a scripted easy opening is deferred (above) and, only if the user agrees, give the first tutorial run one free start shield through the existing `startShieldHits` path (`runSetup.ts` `buildRunConfig`, already used for assist, `runSetup.ts:25-30`) so a brand-new player survives the first mistake. No change to `fairness.ts`, `schedule.ts`, `waves.ts`, `rng.ts`.

**Files:**
- Modify: `games/dodge-drop/src/runSetup.ts` (`buildRunConfig` input gets `firstRun?: boolean`; `freeStartShield = 1` when `firstRun`), `games/dodge-drop/src/PlayScene.ts` (pass `firstRun: this.tutorialOn` at the `buildRunConfig` call about line 305)
- Test: `games/dodge-drop/src/runSetup.test.ts`

**RED - Write Failing Test**
```ts
it('firstRun grants one free start shield and nothing else changes', () => {
  const base = buildRunConfig({ workshop: emptyWorkshop(), assist: DEFAULT_ASSIST, tier: 'none', rng: () => 0.99 });
  const first = buildRunConfig({ workshop: emptyWorkshop(), assist: DEFAULT_ASSIST, tier: 'none', rng: () => 0.99, firstRun: true });
  expect(base.startShieldHits).toBe(0);
  expect(first.startShieldHits).toBe(1);
  expect({ ...first, startShieldHits: 0 }).toEqual({ ...base, startShieldHits: 0 });
});
```

**Verify RED - Watch It Fail**
Run: `npx vitest run games/dodge-drop/src/runSetup.test.ts`

Confirm:
- Fails: `first.startShieldHits` is 0 (the `firstRun` input is ignored / type error on the unknown property).

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
In `buildRunConfig`: `if (assisted || i.firstRun) freeStartShield = 1; else if (...)` keeping the existing workshop roll for the non-first case; pass `firstRun` from the scene.

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop && npm run build:local && npx playwright test e2e/dodge-drop.spec.ts e2e/results.spec.ts`

Confirm:
- Green; e2e tests that assert `startShieldHits`/shield counts on a fresh profile use `skipOnboarding(page)` from Task 2.2.

**REFACTOR - Clean Up**
- None.

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && PROPERTY_SEEDS=100 npm test && npm run test:smoke`

Confirm:
- Green; `git diff --stat` shows no change to `fairness.ts`, `schedule.ts`, `waves.ts`, `rng.ts`.

**COMMIT**
Run:
`git add games/dodge-drop && git commit -m "feat(dodge-drop): ✨ free start shield on the tutorial run"`
(If the user declines, skip this task and write "Task 2.5 dropped by user" in the Execution Log; the deferral of the scripted opening stays documented here.)

### Phase 3: CC0 art and audio

Style decision (executor records the choice in the manifest README before downloading): ONE art direction, max two Kenney packs from the same author for coherence, tinted at runtime to the neon palette (`theme.ts`, `BLOCK_PINK`, `BLOCK_ORANGE` in `playArt.ts`). Keep the existing procedural glow/trail juice on top of sprites so the neon identity is retained.

#### Task 3.1: Asset manifest checker (real TDD; gate for all asset tasks)
**Goal:** Fail the test suite when any shipped asset lacks verified CC0 provenance.

**Files:**
- Create: `scripts/check-assets.ts`, `scripts/check-assets.test.ts`, `games/dodge-drop/assets/manifest.json`, `games/dodge-drop/assets/README.md`
- Modify: `package.json` (`"check:assets": "node scripts/check-assets.ts"`)

**RED - Write Failing Test**
```ts
// scripts/check-assets.test.ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAssets } from './check-assets.ts';

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

function fixture(files: Record<string, Buffer>, manifest: unknown): { pub: string; manifestPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'assets-'));
  const pub = join(dir, 'public', 'assets');
  mkdirSync(pub, { recursive: true });
  for (const [name, buf] of Object.entries(files)) {
    mkdirSync(join(pub, name, '..'), { recursive: true });
    writeFileSync(join(pub, name), buf);
  }
  const manifestPath = join(dir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  return { pub, manifestPath };
}

const entry = (file: string, buf: Buffer, over: Record<string, unknown> = {}) => ({
  file, license: 'CC0-1.0', author: 'Kenney', sourceUrl: 'https://kenney.nl/assets/x', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  retrievedAt: '2026-11-24', sha256: sha(buf), ...over,
});

describe('checkAssets', () => {
  const png = Buffer.from('png-bytes');
  it('passes when every file has a complete CC0 entry', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png)] });
    expect(checkAssets(pub, manifestPath)).toEqual([]);
  });
  it('flags a shipped file with no manifest entry', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/a\.png.*no manifest entry/);
  });
  it('flags a manifest entry whose file is missing', () => {
    const { pub, manifestPath } = fixture({}, { assets: [entry('gone.png', png)] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/gone\.png.*missing/);
  });
  it('flags any license other than CC0-1.0', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { license: 'CC-BY-4.0' })] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/license must be CC0-1\.0/);
  });
  it('flags a wrong sha256 (file changed after review)', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { sha256: 'deadbeef' })] });
    expect(checkAssets(pub, manifestPath).join('\n')).toMatch(/sha256 mismatch/);
  });
  it('flags missing author, sourceUrl or retrievedAt', () => {
    const { pub, manifestPath } = fixture({ 'a.png': png }, { assets: [entry('a.png', png, { author: '', sourceUrl: 'nope', retrievedAt: '' })] });
    const out = checkAssets(pub, manifestPath).join('\n');
    expect(out).toMatch(/author/);
    expect(out).toMatch(/sourceUrl must be https/);
    expect(out).toMatch(/retrievedAt/);
  });
  it('an empty assets dir with an empty manifest passes (template works with no assets)', () => {
    const { pub, manifestPath } = fixture({}, { assets: [] });
    expect(checkAssets(pub, manifestPath)).toEqual([]);
  });
});
```
Also add a repo-level test in the same file: `it('dodge-drop shipped assets are fully documented', () => expect(checkAssets('games/dodge-drop/public/assets', 'games/dodge-drop/assets/manifest.json')).toEqual([]))` (passes on an absent dir because `checkAssets` treats a missing directory as empty).

**Verify RED - Watch It Fail**
Run: `npx vitest run scripts/check-assets.test.ts`

Confirm:
- Fails with unresolved import `./check-assets.ts`.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// scripts/check-assets.ts
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Entry { file: string; license: string; author: string; sourceUrl: string; licenseUrl?: string; retrievedAt: string; sha256: string; notes?: string }

function walk(dir: string, root = dir, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, root, out);
    else out.push(relative(root, p).split(sep).join('/'));
  }
  return out;
}

export function checkAssets(assetsDir: string, manifestPath: string): string[] {
  const errors: string[] = [];
  const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { assets?: Entry[] }) : { assets: [] };
  const entries = new Map((manifest.assets ?? []).map((e) => [e.file, e]));
  const files = walk(assetsDir);
  for (const f of files) {
    const e = entries.get(f);
    if (!e) { errors.push(`${f}: no manifest entry`); continue; }
    if (e.license !== 'CC0-1.0') errors.push(`${f}: license must be CC0-1.0 (got ${e.license})`);
    if (!e.author?.trim()) errors.push(`${f}: author is required`);
    if (!/^https:\/\//.test(e.sourceUrl ?? '')) errors.push(`${f}: sourceUrl must be https`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.retrievedAt ?? '')) errors.push(`${f}: retrievedAt must be YYYY-MM-DD`);
    const sum = createHash('sha256').update(readFileSync(join(assetsDir, f))).digest('hex');
    if (sum !== e.sha256) errors.push(`${f}: sha256 mismatch`);
  }
  for (const f of entries.keys()) if (!files.includes(f)) errors.push(`${f}: listed in manifest but missing from ${assetsDir}`);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = checkAssets('games/dodge-drop/public/assets', 'games/dodge-drop/assets/manifest.json');
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('assets ok');
}
```
Create `games/dodge-drop/assets/manifest.json` as `{ "assets": [] }` and `README.md` explaining: only CC0-1.0; add entries with `sha256sum`; the manifest lives outside `public/` so source URLs never enter the built artifact (the URL scan in `scripts/check-artifact.ts` covers `.json`); to extract the template, copy `public/assets`, `assets/manifest.json`, `scripts/check-assets.ts`.

**Verify GREEN - Watch It Pass**
Run: `npx vitest run scripts/check-assets.test.ts && node scripts/check-assets.ts && npm run typecheck`

Confirm:
- All pass; CLI prints `assets ok`; output pristine.

**REFACTOR - Clean Up**
- Add a `--add <file> --author ... --source ...` helper only if Tasks 3.2/3.3 prove tedious (YAGNI otherwise).

**Verify GREEN - Stay Green After Refactor**
Run: `npm test && npm run typecheck`

Confirm:
- Green.

**COMMIT**
Run:
`git add scripts/check-assets.ts scripts/check-assets.test.ts games/dodge-drop/assets package.json && git commit -m "feat(scripts): ✨ CC0 asset manifest checker"`

#### Task 3.2: Source and import CC0 art
**Exception Type:** Generated code / Configuration-only (asset-only; downloading third-party files cannot be test-first)
**User Approval:** Approved by the user on 2026-11-24 (TDD-exception contract for tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3).
**Files:**
- Create: `games/dodge-drop/public/assets/art/*.png` (player ship/orb frames, block variants, star, shield, ring, backdrop layers, panel art, logo, UI frame/buttons), `games/dodge-drop/assets/manifest.json` entries
- Modify: `games/dodge-drop/assets/README.md` (record chosen packs and style rationale)

**Implementation**
1. Choose packs: open each candidate pack page on kenney.nl (and OpenGameArt filtered to CC0 if a gap remains); confirm the page states "Creative Commons CC0"; record `licenseUrl` per file. Keep to <= 2 packs from one author for one coherent look; prefer 128-256 px source sprites so they stay crisp at devicePixelRatio 1 up to 1920x1080 (CrazyGames: high consistent resolution, no compression artifacts).
2. Needed sprites (names are the Phaser texture keys already used by procedural code, so no scene changes beyond Task 3.4): `dd-star`, `dd-shield`, `dd-ring`, player skins keyed by `skinTextureKey` (see `games/dodge-drop/src/skinArt.ts`), block body/edible block (`blockTexture`/`edibleBlockTexture` use 9-slice-like width variants: keep blocks procedural-tinted over a CC0 texture overlay instead of replacing width logic), backdrop parallax layers (`dd-bg-far`, `dd-bg-mid`), side-panel art (`dd-panel-art`, `dd-panel`), UI frame/button skin, a title logo image (compose "Neon Rush" lettering from a CC0 font; fonts must also be CC0/OFL-verified and recorded; do not ship a font whose license is not CC0 - use rendered PNG lettering only).
3. Optimise PNGs (`pngquant`/`oxipng` if installed; otherwise Pillow quantise via a script kept in `scripts/lib/`, not committed binaries of tools); target total art <= 2 MB.
4. For each file: `shasum -a 256 <file>` and add a manifest entry (`license: "CC0-1.0"`, `author`, `sourceUrl` of the pack page, `licenseUrl`, `retrievedAt: 2026-11-24` or actual date).

**Verification**
Run: `node scripts/check-assets.ts && npx vitest run scripts/check-assets.test.ts && du -sh games/dodge-drop/public/assets`

Confirm:
- Before adding manifest entries the checker lists every new file as "no manifest entry" (shows the gate bites); after, it prints `assets ok`.
- Art folder <= 2 MB; no file outside CC0.
- Output pristine.

**COMMIT**
Run:
`git add games/dodge-drop/public/assets games/dodge-drop/assets && git commit -m "feat(dodge-drop): 🎨 add CC0 art assets with license manifest"`

#### Task 3.3: Source and import CC0 music and SFX
**Exception Type:** Generated code / Configuration-only (asset-only)
**User Approval:** Approved by the user on 2026-11-24 (TDD-exception contract for tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3).
**Files:**
- Create: `games/dodge-drop/public/assets/audio/music-*.mp3`, `games/dodge-drop/public/assets/audio/sfx-*.mp3`, manifest entries
- Modify: `games/dodge-drop/assets/README.md`

**Implementation**
1. Music: 2-3 seamless loops (calm/normal, rush, overdrive) 30-60 s, 96-128 kbps mono-or-joint-stereo mp3 each, from CC0 sources (OpenGameArt CC0 filter; Kenney music/jingle packs). Verify the individual item page says CC0 (many OGA tracks are CC-BY: reject those). Candidate names are not trusted from memory; the executor records the page URL for each.
2. SFX (one file each, <= 100 KB): `nearMiss` (short rising tick, played with pitch steps via `playbackRate`), `pickup`, `shield`, `shieldBreak`, `death`, `medal`, `click`, `rush`, `newBest` (matches `SfxName` in `packages/game-kit/src/audio/sfx.ts`).
3. Name files `sfx-<SfxName>.mp3` and `music-<normal|rush|overdrive|chomp>.mp3` so the loader (Task 3.6) derives keys mechanically; add manifest entries with sha256.
4. Convert with ffmpeg (installed at `/opt/homebrew/bin/ffmpeg`) only to trim/encode; loudness is handled in Task 3.9.

**Verification**
Run: `node scripts/check-assets.ts && du -sh games/dodge-drop/public/assets/audio`

Confirm:
- Checker passes; audio folder <= 4 MB; every file has a CC0 manifest entry with a per-item page URL.

**COMMIT**
Run:
`git add games/dodge-drop/public/assets/audio games/dodge-drop/assets && git commit -m "feat(dodge-drop): 🎵 add CC0 music and SFX with license manifest"`

#### Task 3.4: Loaded art overrides procedural textures
**Goal:** If an asset with the same key is loaded, procedural generation is skipped; otherwise unchanged.

**Files:**
- Create: `games/dodge-drop/src/art.ts`, `games/dodge-drop/src/art.test.ts`
- Modify: `games/dodge-drop/src/main.ts` (pass `preload: preloadArt`), `games/dodge-drop/src/playArt.ts` (`ensurePlayTextures` at line 121 and `ensureUiTextures` at 211 start each generation with `if (scene.textures.exists(key)) continue;`-style guards), `games/dodge-drop/src/skinArt.ts` (already guarded at line 20), `games/dodge-drop/src/backdrop.ts` (line 8 guard exists), `games/dodge-drop/src/PlayScene.ts` `buildBackdrop` (use `dd-bg-*` layers when present)
- Test: `games/dodge-drop/src/art.test.ts`

**RED - Write Failing Test**
```ts
// games/dodge-drop/src/art.test.ts
import { describe, expect, it } from 'vitest';
import { ART_FILES, artUrl, missingArtKeys } from './art.ts';

describe('art manifest', () => {
  it('maps texture keys to relative asset urls (portal rule: no absolute paths)', () => {
    for (const f of ART_FILES) {
      expect(artUrl(f)).toMatch(/^assets\/art\/[a-z0-9-]+\.png$/);
    }
  });
  it('has unique texture keys', () => {
    const keys = ART_FILES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('reports keys whose file is not shipped so the procedural fallback is used', () => {
    expect(missingArtKeys([{ key: 'dd-star', file: 'star.png' }], new Set(['star.png']))).toEqual([]);
    expect(missingArtKeys([{ key: 'dd-star', file: 'star.png' }], new Set())).toEqual(['dd-star']);
  });
});
```
Plus a repo-level test: every `ART_FILES` entry exists in `games/dodge-drop/public/assets/art/` (reads the filesystem via `node:fs`, valid in vitest).

**Verify RED - Watch It Fail**
Run: `npx vitest run games/dodge-drop/src/art.test.ts`

Confirm:
- Fails with unresolved import `./art.ts`.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// games/dodge-drop/src/art.ts
import type Phaser from 'phaser';

export interface ArtFile { key: string; file: string }
/** Populated from the files actually delivered in Task 3.2 (keys are the existing procedural texture keys). */
export const ART_FILES: readonly ArtFile[] = [
  { key: 'dd-star', file: 'star.png' },
  { key: 'dd-shield', file: 'shield.png' },
  { key: 'dd-bg-far', file: 'bg-far.png' },
  { key: 'dd-bg-mid', file: 'bg-mid.png' },
  { key: 'dd-panel-art', file: 'panel-art.png' },
  { key: 'dd-logo', file: 'logo.png' },
];

export const artUrl = (f: ArtFile): string => `assets/art/${f.file}`;

export function missingArtKeys(files: readonly ArtFile[], shipped: ReadonlySet<string>): string[] {
  return files.filter((f) => !shipped.has(f.file)).map((f) => f.key);
}

export function preloadArt(scene: Phaser.Scene): void {
  for (const f of ART_FILES) scene.load.image(f.key, artUrl(f));
  scene.load.on('loaderror', () => { /* a missing file leaves the key unset; procedural generators fill it */ });
}
```
Adjust `ART_FILES` to exactly the files imported in 3.2 (the repo-level test enforces this). In `playArt.ts`, wrap each `generateTexture` block with the existing `exists` pattern so a loaded key wins.

**Verify GREEN - Watch It Pass**
Run: `npx vitest run games/dodge-drop && npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts e2e/dodge-drop.spec.ts`

Confirm:
- Pass; inspect `.superpowers/sdd/meta/v3/play-800x450.png`: authored art visible, still readable, neon glow retained.

**REFACTOR - Clean Up**
- Remove procedural code paths that are now dead ONLY if every consumer has an asset (keep fallbacks otherwise; the template must still run with zero assets).

**Verify GREEN - Stay Green After Refactor**
Run: `PROPERTY_SEEDS=100 npm test && npm run test:smoke`

Confirm:
- Green; output pristine; no console errors about 404 assets (`page.on('pageerror')` already asserted in smoke).

**COMMIT**
Run:
`git add games/dodge-drop && git commit -m "feat(dodge-drop): 🎨 load CC0 art over procedural textures"`

#### Task 3.5: Backdrop parallax, side-panel art, title logo
**Goal:** Landscape side panels and the title show authored art; play field has parallax depth.

**Files:**
- Modify: `games/dodge-drop/src/PlayScene.ts` (`buildBackdrop` at line 323; the grid drawing at 520-545 stays as an overlay), `games/dodge-drop/src/backdrop.ts` (`ddTitleBackdrop`, line 18), `games/dodge-drop/src/titleExtras.ts`, `packages/game-kit/src/scenes/TitleScene.ts` (logo image hook)
- Test: `e2e/crazygames-viewport.spec.ts`

**RED - Write Failing Test**
```ts
test('authored art is present on title and in the landscape side panels', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(GAME);
  await ready(page);
  const have = await page.evaluate(() => (window as unknown as { __dd: { textures(): string[] } }).__dd.textures());
  for (const k of ['dd-logo', 'dd-panel-art', 'dd-bg-far']) expect(have).toContain(k);
});
```
(`__dd.textures()` hook returns `Object.keys(scene.textures.list)`; add in `titleExtras.ts` test hook block.)

**Verify RED - Watch It Fail**
Run: `npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts -g "authored art"`

Confirm:
- Fails because the keys are not displayed/registered or the hook is missing - fix hook first if it errors, then it must fail on missing keys.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
- `buildBackdrop`: when `textures.exists('dd-bg-far')` add two `tileSprite`s (far at 0.15x, mid at 0.4x of block speed; scroll in `update` via `tilePositionY += speed*dt*k`), keep `grid` as a faint overlay (alpha 0.35).
- Landscape: `dd-panel-art` placed in both side panels on the UI camera at depth -100 under the HUD text (mirrored on the right).
- Title: `dd-logo` replaces the plain title text when present.

**Verify GREEN - Watch It Pass**
Run: `npm run build:local && npx playwright test e2e/crazygames-viewport.spec.ts e2e/smoke.spec.ts`

Confirm:
- Pass; screenshots inspected at 800x450, 1920x1080 and 375x667.

**REFACTOR - Clean Up**
- Extract `addParallax(scene, frame)` into `backdrop.ts`.

**Verify GREEN - Stay Green After Refactor**
Run: `npm run typecheck && PROPERTY_SEEDS=100 npm test`

Confirm:
- Green.

**COMMIT**
Run:
`git add games/dodge-drop packages/game-kit && git commit -m "feat(dodge-drop): 🎨 parallax backdrop, panel art and logo"`

#### Task 3.6: Sample-based SFX and music in GameAudio (with synth fallback)
**Goal:** `GameAudio` plays decoded samples when loaded, otherwise the existing synth; music layers/modes API unchanged.

**Files:**
- Create: `packages/game-kit/src/audio/samples.ts`, `packages/game-kit/src/audio/samples.test.ts`
- Modify: `packages/game-kit/src/audio/audio.ts` (new `loadSamples(urls)`; `sfx()` prefers a sample; `music.setMode/start` prefers a sample loop), `packages/game-kit/src/scenes/PreloadScene.ts` (call `kit.audio.loadSamples(def.audioManifest)` and advance the progress bar), `packages/game-kit/src/defineGame.ts` (`audioManifest?: { sfx: Record<string,string>; music: Record<string,string> }`), `games/dodge-drop/src/main.ts`, `packages/game-kit/src/audio/audio.test.ts`, `packages/game-kit/src/index.ts`
- Test: `packages/game-kit/src/audio/samples.test.ts`, `packages/game-kit/src/audio/audio.test.ts`

**RED - Write Failing Test**
```ts
// packages/game-kit/src/audio/samples.test.ts
import { describe, expect, it } from 'vitest';
import { SampleBank, sfxRate } from './samples.ts';

const fakeBuf = { duration: 1 } as AudioBuffer;
const okFetch = async (): Promise<ArrayBuffer> => new ArrayBuffer(8);
const ctx = { decodeAudioData: async () => fakeBuf } as unknown as AudioContext;

describe('SampleBank', () => {
  it('loads and returns buffers by name', async () => {
    const bank = new SampleBank(ctx, okFetch);
    await bank.load({ pickup: 'assets/audio/sfx-pickup.mp3' });
    expect(bank.get('pickup')).toBe(fakeBuf);
  });
  it('a failed fetch leaves the name unloaded instead of throwing (synth fallback)', async () => {
    const bank = new SampleBank(ctx, async () => { throw new Error('404'); });
    await expect(bank.load({ pickup: 'x.mp3' })).resolves.toBeUndefined();
    expect(bank.get('pickup')).toBeUndefined();
  });
  it('a failed decode is also tolerated', async () => {
    const bad = { decodeAudioData: async () => { throw new Error('bad'); } } as unknown as AudioContext;
    const bank = new SampleBank(bad, okFetch);
    await bank.load({ pickup: 'x.mp3' });
    expect(bank.get('pickup')).toBeUndefined();
  });
  it('reports load progress 0..1', async () => {
    const seen: number[] = [];
    const bank = new SampleBank(ctx, okFetch);
    await bank.load({ a: 'a.mp3', b: 'b.mp3' }, (r) => seen.push(r));
    expect(seen[seen.length - 1]).toBe(1);
  });
});

describe('sfxRate', () => {
  it('raises pitch per combo step by a semitone and clamps', () => {
    expect(sfxRate(0)).toBeCloseTo(1, 5);
    expect(sfxRate(12)).toBeCloseTo(2, 3);
    expect(sfxRate(99)).toBeCloseTo(sfxRate(14), 5);
    expect(sfxRate(-3)).toBeCloseTo(1, 5);
  });
});
```
And in `audio.test.ts` add: with a fake context and a loaded `pickup` sample, `audio.sfx('pickup')` creates a `BufferSource` (assert on the fake's recorded `createBufferSource` count and that no oscillator was created); without a sample it creates an oscillator (existing behaviour).

**Verify RED - Watch It Fail**
Run: `npx vitest run packages/game-kit/src/audio`

Confirm:
- Fails with unresolved import `./samples.ts` and the new audio test failing on "no BufferSource created".

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
```ts
// packages/game-kit/src/audio/samples.ts
export type Fetcher = (url: string) => Promise<ArrayBuffer>;
const defaultFetch: Fetcher = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.arrayBuffer();
};

export class SampleBank {
  private readonly buffers = new Map<string, AudioBuffer>();
  constructor(private readonly ctx: AudioContext, private readonly fetcher: Fetcher = defaultFetch) {}

  async load(urls: Record<string, string>, onProgress?: (ratio: number) => void): Promise<void> {
    const names = Object.keys(urls);
    let done = 0;
    await Promise.all(names.map(async (name) => {
      try {
        const data = await this.fetcher(urls[name]!);
        this.buffers.set(name, await this.ctx.decodeAudioData(data));
      } catch {
        /* leave unloaded: caller falls back to synthesis */
      }
      done += 1;
      onProgress?.(done / names.length);
    }));
  }

  get(name: string): AudioBuffer | undefined { return this.buffers.get(name); }
}

/** Playback rate for combo step n (semitone per step, clamped to 0..14 like pentatonic()). */
export function sfxRate(step: number): number {
  const s = Math.max(0, Math.min(14, step));
  return 2 ** (s / 12);
}
```
In `audio.ts`: add `let bank: SampleBank | null`, `loadSamples(manifest)` (creates the bank with the lazily created ctx, resolves even if ctx is null), in `sfx(name, opts)`: `const buf = bank?.get(name); if (buf) { play via createBufferSource with playbackRate = sfxRate(opts?.step ?? 0), connected to the SFX bus; return; }` else the existing synth path; for music `start()/setMode()`: if `bank.get('music-'+mode)` exists, loop it on the music bus with a 400 ms gain crossfade between modes; else existing sequencer. Keep mute/ad-pause gates identical. `PreloadScene.preload()` awaits nothing (Phaser preload is sync): start `kit.audio.loadSamples(...)` and hold the scene with `this.load` pending via a `this.load.addFile`-free approach: simplest is `create()` becoming `async` and awaiting the promise with a 4 s timeout (`withTimeout` exists in `packages/platform/src/withTimeout.ts`) before `scene.start('GKTitle')`, so a slow network never blocks the title (portal rule: fast load).

**Verify GREEN - Watch It Pass**
Run: `npx vitest run packages/game-kit && npm run typecheck && npm run build:local && npx playwright test e2e/smoke.spec.ts`

Confirm:
- Pass; the smoke run has no console errors; with files absent (rename the audio folder temporarily) the game still boots and plays (fallback proof; restore after).

**REFACTOR - Clean Up**
- Share the bus-connect code between synth and sample paths; no new behaviour.

**Verify GREEN - Stay Green After Refactor**
Run: `PROPERTY_SEEDS=100 npm test && npm run test:smoke`

Confirm:
- Green.

**COMMIT**
Run:
`git add packages/game-kit games/dodge-drop && git commit -m "feat(game-kit): ✨ sample-based SFX and music with synth fallback"`

#### Task 3.7: Wire dodge-drop audio manifest and mix
**Goal:** The game passes its sample list, and sound levels are consistent.

**Files:**
- Modify: `games/dodge-drop/src/main.ts` (`audioManifest`), `packages/game-kit/src/audio/audio.ts` (`SFX_BUS`/`MUSIC_BUS` constants, line ~40)
- Test: `packages/game-kit/src/audio/audio.test.ts`

**RED - Write Failing Test**
In `audio.test.ts`: a manifest test (`loadSamples` is called with every name in `games/dodge-drop`'s `audioManifest` and each name is a valid `SfxName` or `music-<mode>`), and a mix test: `expect(SFX_BUS + MUSIC_BUS).toBeLessThanOrEqual(1.1)` is NOT meaningful; instead assert that with a loaded music sample the music bus gain value equals `MUSIC_BUS` and mute sets both to 0 (use the fake context's gain recorder). 

**Verify RED - Watch It Fail**
Run: `npx vitest run packages/game-kit/src/audio/audio.test.ts`

Confirm:
- Fails: manifest names not wired / gain assertions not met.

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
Add the manifest wiring; keep bus constants unless the manual listening check in Task 3.9 shows music masks SFX (then change only the constants and update the test).

**Verify GREEN - Watch It Pass**
Run: `npx vitest run packages/game-kit games/dodge-drop && npm run typecheck`

Confirm:
- Pass; pristine.

**REFACTOR - Clean Up**
- None.

**Verify GREEN - Stay Green After Refactor**
Run: `npm test`

Confirm:
- Green.

**COMMIT**
Run:
`git commit -am "feat(dodge-drop): 🎵 wire CC0 audio manifest"`

#### Task 3.8: Size and artifact budget guard
**Goal:** Make the art/audio budget a failing test rather than a promise.

**Files:**
- Modify: `scripts/check-artifact.test.ts`, optionally `scripts/check-artifact.ts` (new per-folder budget constant `ASSET_BUDGET_BYTES = 8 * 1024 * 1024`)
- Test: `scripts/check-artifact.test.ts`

**RED - Write Failing Test**
Add to `scripts/check-artifact.test.ts` (mirror its existing fixture helpers; read the file first with `sed -n 1,50p scripts/check-artifact.test.ts`): a fixture artifact with a 9 MB `assets/audio/big.mp3` + html passes under 10 MB total, a fixture with `assets/` > 8 MB fails with message `assets exceed 8 MB budget`; and a manifest `.json` file under the artifact containing `https://kenney.nl/...` is rejected by the URL rule (documents why `manifest.json` must stay outside `public/`).

**Verify RED - Watch It Fail**
Run: `npx vitest run scripts/check-artifact.test.ts`

Confirm:
- The budget case fails (no budget rule yet); the URL case already passes (document as regression guard, keep).

**Test passes?** You're testing existing behavior. Fix test.

**Test errors?** Fix error, re-run until it fails correctly.

**GREEN - Minimal Code**
Add the `assets/` folder sum check in `checkArtifact` pushing `assets exceed 8 MB budget` when over.

**Verify GREEN - Watch It Pass**
Run: `npx vitest run scripts/check-artifact.test.ts && npm run build:portals`

Confirm:
- Pass; `build:portals` passes with the real assets and prints total size (< 10 MB, record the number in the plan notes).

**REFACTOR - Clean Up**
- Share size-format helper.

**Verify GREEN - Stay Green After Refactor**
Run: `npm test && npm run test:portals`

Confirm:
- Green.

**COMMIT**
Run:
`git commit -am "feat(scripts): ✨ guard asset folder budget in artifact check"`

#### Task 3.9: Normalise audio loudness and listening check
**Exception Type:** Generated code (processed audio output)
**User Approval:** Approved by the user on 2026-11-24 (TDD-exception contract for tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3).
**Files:**
- Modify: `games/dodge-drop/public/assets/audio/*.mp3`, `games/dodge-drop/assets/manifest.json` (sha256 values change; keep `notes: "loudnorm -16 LUFS"`)

**Implementation**
Use ffmpeg (`/opt/homebrew/bin/ffmpeg`): music `loudnorm=I=-18:TP=-1.5:LRA=7`, SFX `loudnorm=I=-14:TP=-1.5`, re-encode mp3, then refresh sha256 in the manifest. Goal: CrazyGames "consistent audio levels". Listening check by the user (cannot be automated): music audible under SFX at default bus gains.

**Verification**
Run: `ffmpeg -i <file> -af ebur128 -f null - 2>&1 | grep -E "I:|LRA:"` for each file, then `node scripts/check-assets.ts && npm test`

Confirm:
- Integrated loudness within +-1 LU of target per class; checker passes; sizes still within budget.

**COMMIT**
Run:
`git commit -am "chore(dodge-drop): 🔧 normalise audio loudness"`

### Phase 4: Release preparation (stop before Submit)

#### Task 4.1: Full verification gate
**Goal:** Prove the whole v3 build is green on every gate before touching version/covers.

**Files:** none modified.

**Verification (inline; run by a fresh haiku subagent per the AGENTS.md "never self-verify" rule, paste real output)**
Run in order:
1. `npm run typecheck`
2. `PROPERTY_SEEDS=300 npm test`
3. `npm run test:smoke`
4. `npm run test:rwd`
5. `npm run test:portals`
6. `npm run build:portals` (check-artifact: size, URLs, adapter)

Confirm:
- Everything exits 0; no console errors/warnings; total artifact size recorded (< 10 MB; ideally < 6 MB); first-gameplay time at throttled network acceptable (<= 10 s load benchmark; measure with Playwright `page.route` latency or Chrome DevTools "Fast 4G" and note).
- Manual checklist from `docs/specs/game-platform/checklists/crazygames.md`: legible at 800x450 and 1920x1080 (look at the screenshots), no custom fullscreen button, mobile `user-select: none`, ad flow unchanged. CrazyGames Preview tool (https://crazygames.com/preview) run by the user: portrait and landscape, ad blocker on.
- Playtest: 3-5 unseen players for 5 minutes each if the user can arrange it (gap analysis recommendation); record findings in `docs/specs/dodge-drop/v3-resubmit-notes.md`.

If any command fails: STOP, fix the failing task, do not proceed.

#### Task 4.2: Version bump, description and changelog
**Exception Type:** Configuration-only
**User Approval:** Approved by the user on 2026-11-24 (TDD-exception contract for tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3).
**Files:**
- Modify: `games/dodge-drop/game.json` (`version` "2.8.4" -> "3.0.0"; description/instructions mention landscape/portrait, new art and music, first-run visual tutorial and next-medal goal bar; `store.controls` unchanged), `docs/specs/dodge-drop/v3-resubmit-notes.md` (Create: changelog + portal "what changed since v2.8.4" text)

**Implementation**
`publish-payload.ts` refuses a version already submitted, so the version must change. Keep the old `releases.crazygames` rejection record for history (do not delete the reason). Changelog text for the portal notes (copy into the submission): "v3.0.0 - adaptive landscape/portrait layout for the 16:9 player (full play field plus readable side-panel HUD), new authored art, music and sound effects, a visual first-run control tutorial, a persistent next-medal goal bar, bigger touch targets." This addresses the FAQ requirement of "clear improvements".

**Verification**
Run: `npm run typecheck && npm test && npm run publish:prep -- dodge-drop` (it may exit 1 only for covers/videos not yet rebuilt; the version/orientation lines must be correct)

Confirm:
- Payload shows version 3.0.0, `mobileOrientation: BOTH`, description updated; no other problems listed except covers/videos.

**COMMIT**
Run:
`git commit -am "chore(dodge-drop): 🔖 v3.0.0 manifest and changelog"`

#### Task 4.3: Rebuild covers and preview videos from the new art
**Exception Type:** Generated code (store art/videos)
**User Approval:** Approved by the user on 2026-11-24 (TDD-exception contract for tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3).
**Files:**
- Modify (regenerate): `games/dodge-drop/store/landscape-1920x1080.png`, `portrait-800x1200.png`, `square-800x800.png`, `games/dodge-drop/store/record.json` (retune `warmupMs`/`afterStartScript` to a visually busy moment; add a landscape recording pass if `store-video.ts` supports a per-orientation `record.json`: check `scripts/store-video.ts` options first), `games/dodge-drop/public/cover.svg` only if still referenced by `game.json` `cover`

**Implementation**
1. `npm run covers -- dodge-drop` (sizes are validated by the script). Look at each PNG: one focal subject, only the title text, no borders/store logos (checklist rule). Gap analysis item 8: CTR is a Basic Launch metric from 2026-11-23, so spend effort on the thumbnail.
2. `npm run store-video -- dodge-drop` (portrait 1080x1620 and landscape 1920x1080, <= 20 s, MP4); the landscape video should now show the true landscape layout.

**Verification**
Run: `npm run publish:prep -- dodge-drop`

Confirm:
- Exits 0; payload JSON written to `dist/publish/dodge-drop-crazygames.json`; covers and videos exist with correct sizes; the user eyeballs the PNGs and one frame per video.

**COMMIT**
Run:
`git add games/dodge-drop/store && git commit -m "chore(dodge-drop): 🔧 rebuild store covers and previews for v3"`

#### Task 4.4: Resubmission checklist and handoff (STOP before Submit)
**Goal:** Hand the user a ready-to-confirm submission; do not click Submit.

**Files:**
- Modify: `docs/specs/dodge-drop/v3-resubmit-notes.md` (checklist state), `docs/STATUS.md` (current state + next step), `docs/specs/game-platform/checklists/crazygames.md` (rejection history line from Task 0.2 updated with v3 result later)

**Implementation**
1. Update `docs/STATUS.md`.
2. Push the batch to master (pre-push hook runs typecheck, tests, smoke; deploy to GitHub Pages is live: the site build also carries the new layout, which is acceptable because the site is the user's own domain; confirm with the user if a staged release is preferred).
3. Resubmission checklist for the user (in the notes file):
   - [ ] CrazyGames Preview tool: portrait and landscape, 800x450 and 1920x1080 iframe sizes, ad blocker on, mobile via QR.
   - [ ] Progress Save option ticked ("Yes, using the Data Module"), orientation BOTH.
   - [ ] Upload `dist/portals/crazygames/dodge-drop/` unzipped (assets/ path preserved).
   - [ ] Covers and videos attached; changelog pasted into the submission notes.
   - [ ] Confirm whether the old listing/slug is reused and any cooldown (UNVERIFIED in the gap analysis): check the developer portal or ask CrazyGames support.
   - [ ] Run the `/publish-crazygames dodge-drop` skill, which stops before Submit; the USER confirms Submit.
   - [ ] After submit: `npm run mark-released -- dodge-drop crazygames submitted`; on result `approved/basic/full` or `rejected --reason "<text>"`.

**Verification**
Run: `git status --short && git log --oneline -n 12`

Confirm:
- Working tree clean except unrelated `workspace-pixel-squad/`; nothing submitted; user informed that Submit is theirs.

**COMMIT**
Run:
`git commit -am "docs: 📝 v3 resubmission checklist and status"`

## Testing Strategy
- Unit tests (vitest, `npm test`): `frame.test.ts`, `hudLayout.test.ts`, `onboarding.test.ts`, `goalBar.test.ts`, `art.test.ts`, `samples.test.ts`, `audio.test.ts`, `frameProvider.test.ts`, `titleLayout.test.ts`, `check-assets.test.ts`, `check-artifact.test.ts`, strings en/zh parity, existing fairness/schedule property tests unchanged (`PROPERTY_SEEDS=100` in CI, 300 nightly and in Task 4.1).
- Integration tests: portal build + fake SDK (`npm run test:portals`, `e2e/portals.spec.ts`) for the SDK-backed save (best score and `onboarding` key still read back; optional one-line assert); `npm run build:portals` runs `check-artifact`.
- E2E (Playwright): `e2e/crazygames-viewport.spec.ts` (frame modes at CrazyGames sizes, HUD and tutorial/goal-bar legibility >= 14 css px at 800x450 in en and zh-TW, tutorial shown on first run and gone after first input and on the second run, orientation switch between runs, landscape journey, authored-art presence), existing specs pinned to `?layout=portrait`, `test:rwd` device sweep including 1280x720 and 1920x1080 desktops, tap-target test on iPhone SE size.
- Manual (cannot be automated; user): CrazyGames Preview tool, real phone via QR, listening check for audio mix, 3-5 unseen playtesters.

## Risks & Mitigations
- **Risk**: With the full portrait field, the field is only about 253 css px wide at 800x450 (blocks about 14 css px tall), so play precision and first impression on small iframes are weaker than on large ones -> Mitigation: all readable HUD text is in panels at 20+ css px; in-field text is limited to large cues clamped to >= 14 css px (`fieldFont`); legibility asserted in e2e at 800x450; most players see 907x510 and larger where the field is 287+ css px; confirm in the Preview tool and record the user judgment in the notes file. If still judged too small, the escape hatch (decided against for now) is a shortened field, which would need the fairness work that was removed from this plan.
- **Risk**: HUD rewrite in `PlayScene.ts` (1171 lines) regresses portrait -> Mitigation: portrait frame equals today's constants (tested in `frame.test.ts`), `W`/`H`/`PLAYER_Y`/speeds are not touched, existing specs pinned to portrait, step-wise edits each followed by `npm run build:local`, and Task 1.6 e2e before any push.
- **Risk**: Two-camera approach leaks field objects into the UI camera (double drawing) -> Mitigation: the `ADDED_TO_SCENE` routing (Task 1.4) plus a screenshot assertion; hit-stop/shake touch the main (field) camera only.
- **Risk**: Existing e2e uses default 1280x720 viewport -> now landscape -> mass failures -> Mitigation: Task 1.6 pins `?layout=portrait`; do not push between Tasks 1.4 and 1.6.
- **Risk**: Shop and Results relayout for landscape (Task 1.5) is the largest unknown effort in Phase 1 -> Mitigation: timebox; minimum acceptable fallback is a single large-card column, recorded in the notes; Title and Results are prioritised over Shop because reviewers see them first.
- **Risk**: Drag feel changes under camera zoom -> Mitigation: `dragToDx(dx, zoom)` unit-tested; verify by hand in landscape.
- **Risk**: A non-CC0 asset slips in (license pages can differ per item, e.g. OpenGameArt) -> Mitigation: manifest checker (Task 3.1) requires CC0-1.0 + per-item source URL + sha256; only Kenney packs by default; user reviews the manifest before the release task.
- **Risk**: Source URLs inside shipped JSON trip the portal URL scan -> Mitigation: manifest lives in `games/dodge-drop/assets/`, not `public/`; test documents the rule (Task 3.8).
- **Risk**: Audio decode/format issues on Safari/iOS (autoplay unlock, mp3 support) -> Mitigation: mp3 only (universal), decode failures fall back to synth, unlock logic in `audio.ts` unchanged; test on a real iPhone via the portal QR.
- **Risk**: Load time grows with assets (CrazyGames wants < 10 s, < 20 MB) -> Mitigation: budgets 2 MB art / 4 MB audio, `check-artifact` budget guard, sample load capped by a 4 s timeout before showing the title.
- **Risk**: Rejection reason is generic; v3 may still fail -> Mitigation: the plan targets the gap analysis blockers (portrait-in-16:9, prototype art/audio) plus first-run onboarding and a visible goal (gap 2); also do the Preview-tool review and unseen-player playtest in Task 4.1 (watch whether an unseen player understands the controls without help), and treat gap items 4, 7 (content spine, menu weight) as the next candidates if rejected again.
- **Risk**: The tutorial and goal bar add HUD objects and first-run state that break existing e2e (fresh profile now always sees the tutorial; a free shield changes shield counts if Task 2.5 is accepted; the landscape left panel fills up) -> Mitigation: `skipOnboarding(page)` init-script fixture for tests that need a clean run, legibility asserted through `__dd.hud()` in en and zh-TW, goal label checked for one-line fit at 800x450, screenshots reviewed in portrait and landscape.
- **Risk**: Tutorial covers the thumb strip or distracts from the first blocks -> Mitigation: drawn only over the strip area below `PLAYER_Y`, ends on first input or after 6 s, shown at most twice if ignored.
- **Risk**: A scripted gentler opening would need time-varying difficulty inside `schedule.ts`/`waves.ts` and re-proving the survivability property -> Mitigation: deferred (see Phase 2 intro); optional first-run free shield is the only softening, applied through `runSetup.ts`.
- **Risk**: Pushing to master deploys live to GitHub Pages mid-work -> Mitigation: push only at Task 4.4 (or after Phase 1 passes smoke+rwd); never between 1.4 and 1.6.

## Success Criteria
- [ ] `npm run typecheck`, `PROPERTY_SEEDS=300 npm test`, `npm run test:smoke`, `npm run test:rwd`, `npm run test:portals`, `npm run build:portals` all pass on the release commit.
- [ ] 800x450, 907x510, 1920x1080 (16:9) show the landscape layout with the full unchanged play field centred; every HUD text is in a side panel at >= 14 css px (target 20+) at 800x450 and in-field text is limited to large cues >= 14 css px; 375x667 portrait is unchanged.
- [ ] Orientation changes never alter the layout mid-run; they apply right after.
- [ ] Gameplay geometry is identical in portrait and landscape; fairness/schedule code untouched and its property tests (300 seeds) still pass; landscape drag feel matches portrait.
- [ ] Authored CC0 art on player/blocks/pickups/backdrop/UI/title, music and sample SFX in game; game still boots and plays if assets fail to load.
- [ ] `games/dodge-drop/assets/manifest.json` lists every shipped asset with CC0-1.0, author, source URL, retrieval date and sha256; `scripts/check-assets.test.ts` passes.
- [ ] Build artifact < 10 MB (target < 6 MB), no external URLs, relative paths only, no custom fullscreen button on CrazyGames.
- [ ] First run shows a visual control tutorial (ghost finger on touch, arrow-key caps on desktop; portrait, landscape, en, zh-TW) that ends on first input or after 6 s and is not shown on the next run; goal bar shows the next medal with a filling progress bar in the left panel (landscape, >= 14 css px at 800x450) or a compact line (portrait); scripted gentler opening deferred and recorded; `fairness.ts`/`schedule.ts`/`waves.ts`/`rng.ts` untouched.
- [ ] Small-phone tap targets >= 44 css px.
- [ ] `game.json` version 3.0.0, orientation `any`, updated description; covers and videos regenerated from the new art; `npm run publish:prep -- dodge-drop` exits 0.
- [ ] User has the resubmission checklist and the Submit button is untouched until the user approves.
- [ ] TDD-exception tasks 1.8, 3.2, 3.3, 3.9, 4.2, 4.3 were executed under the approved contract (approved 2026-11-24).
