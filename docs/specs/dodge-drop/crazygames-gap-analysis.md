# Neon Rush (dodge-drop v2.8.4) - CrazyGames Gap Analysis

Date: 2026-11-23. Rejection text (from `games/dodge-drop/game.json`): "The overall quality of the game does not yet meet the expectations of our platform".
Legend: **[V]** = verified, fetched this session (URL given). **[I]** = my inference. **UNVERIFIED** = not found. I did not play the game or any competitor; game claims come from source and portal listing text only.

## (a) CrazyGames stated quality criteria

| # | Criterion [V] | Source |
|---|---|---|
| 1 | Onboarding: land directly in a simple, skippable onboarding built into gameplay; visuals over text; show controls with overlay/gestures; labelled buttons, not sized/delayed to push ad clicks | https://docs.crazygames.com/requirements/quality/ |
| 2 | Clear, reachable goals; easy to learn; consistent intuitive controls | same |
| 3 | "Respond quickly to player actions"; balance/pace challenge; avoid repetitive or boring tasks; appeal to different player segments | same |
| 4 | Uniqueness: easy to add content; maintain/update frequently; avoid names/iconography confusable with other games | same |
| 5 | Aesthetics: high and consistent resolution, no compression artifacts; consistent audio levels, music complements visuals; ONE coherent visual style; name/imagery honest about genre | same |
| 6 | Mandatory (basic): legible at devicePixelRatio 1, in 16:9 responsive iframes (800x450 mobile up to 1920x1080) and on mobile; consistent physics at 144/165 Hz; English localization; no crashes; original name/assets; no custom fullscreen button; no cross-promotion; PEGI-12 | https://docs.crazygames.com/requirements/gameplay/ |
| 7 | Mandatory (full launch): new users land in gameplay immediately, max one click | same |
| 8 | FAQ: every submission is reviewed by hand. Strong games have "a fast load, a clear goal, polished mechanics, and fast, intuitive onboarding"; players decide within the first few minutes. Ranking after launch uses play count, avg playtime, retention, conversion, feedback | https://docs.crazygames.com/faq/ |
| 9 | Basic Launch KPIs (benchmarks, not cutoffs): avg play time 10+ min, D1 retention 10-15%, conversion 80%+, load <10 s, build <20 MB; CTR (top 20% of category) is a 4th metric for games starting Basic Launch on/after 2026-11-23; 7-21 day test, min 500 plays | https://docs.crazygames.com/resources/basic-launch-metrics/ |

## (e) Resubmission policy

- [V] Resubmission is allowed after failing initial review or after Basic Launch, "if you've made clear improvements"; "resubmitting with only small tweaks will most likely produce the same result". Pre-resubmit self-check named by CG: clear goal, smooth and polished gameplay, quick onboarding. (https://docs.crazygames.com/faq/)
- [V] The FAQ page mentions NO cooldown period. Cooldown: UNVERIFIED (absent from docs; not confirmed with support).
- [V] Review time for initial review: not stated in FAQ. UNVERIFIED.
- [V] The FAQ describes it as "resubmitting as a new submission" - so expect a new submission in the Developer Portal; whether the old listing/slug is reused: UNVERIFIED.
- [V] Rejection feedback is generic by design: "constructive feedback on what to fix" and common reasons list (bugs, missing English, unoriginal, inappropriate, kids content, not meeting requirements). Our message names none of these, so per the FAQ's own list the likely cause is quality/polish/onboarding. [I]
- Developer anecdotes (weak evidence): an itch.io poster says CG rejected for "metrics"; another got contradictory accept/reject emails without reasons. https://itch.io/post/16271765 , https://itch.io/post/13196930 . No credible write-up found of what changed to flip a "does not yet meet expectations" rejection: UNVERIFIED. The exact phrase was not found anywhere on the web by search.

## (b) Competitor table (CrazyGames, fetched 2026-11-23)

Popularity rank = position on https://www.crazygames.com/t/avoid or the Arcade list in the FAQ of /t/arcade [V].

| Game | URL | Key strengths [V from portal listing text] | Orient. |
|---|---|---|---|
| Space Waves (do.games) | https://www.crazygames.com/game/space-waves | #1 Avoid. 8.7 from 6.0M votes. Dozens of levels over multiple worlds, Classic/Endless/Race modes, practice mode, crash % progress, ad-resume, arrow skins, leaderboards tag, one-button control, music-driven (Geometry Dash-like), mobile app. Unity 6 | Landscape |
| Drift Boss | https://www.crazygames.com/game/drift-boss | 9.1 from 265k votes. One-button endless; coins buy boosters/cars; unlockable cars; bonus mini-games; daily rewards; spin-to-win; save via CG account; 80s arcade look | n/a |
| Wave Dash: Geometry Arrow (gamebiz) | https://www.crazygames.com/game/wave-dash-geometry-arrow | 8.4 from 80k votes. Levels synced to music, progress bar, instant restart, built-in level editor, Unity 6, updated May 2026 | Landscape |
| Slice Master | https://www.crazygames.com/game/slice-master | 8.6 from 1.3M votes. 3D physics, 9 unlockable knives, score-multiplier targets, one-button, 5-minute-fun | Land+Portrait |
| Count Masters: Stickman | https://www.crazygames.com/game/count-masters-stickman-games | 8.9 from 1.29M votes. 3D runner, gate math choices, boss fights, traps, colourful | Land+Portrait |
| Rocket Fling, Steal Eggs, Ragdoll Archers, Hoard Sweeper | listed in /t/arcade FAQ; https://www.crazygames.com/t/arcade | Appear in Arcade top 10; I did NOT fetch their pages: strengths UNVERIFIED | - |
| Slice Master/Count Masters peers: Diep.io, Miniblox, House of Hazards, Battle Brigade | https://www.crazygames.com/t/avoid | In Avoid top 10; pages not fetched: UNVERIFIED | - |

Pattern across the fetched games [I, based on the table]: (1) a *finite content spine* (levels/worlds/modes) on top of the endless loop; (2) a progress cue that makes failure feel close (crash %, progress bar); (3) cosmetic or functional unlocks bought with run currency; (4) daily/retention hooks (Drift Boss); (5) 3D or high-production art in the top results, with both orientations supported or landscape; (6) mobile-friendly one-button input; (7) years of updates. Our earlier research (docs/specs/game-design/research-arcade-dodge.md) already recorded Poki's finding that bright, consistent, polished art outperforms and that the first seconds decide retention.

## (c) Neon Rush current state (source-grounded)

- Manifest: tags `arcade, reflex`, portrait, mouse/touch/keyboard, CG tags Avoid/Speed/Skill/Difficult/2D, `progressSave: sdk` - `games/dodge-drop/game.json:4-35`. Canvas fixed 720x1280 - `src/main.ts:13-14`.
- Core loop: one-axis dodge of falling blocks; drag anywhere / keys / optional tilt - `src/PlayScene.ts:42-47` (key accel constants), `src/layout.ts`, `src/tilt*.ts`.
- Onboarding: title "tap to start" (`packages/game-kit/src/scenes/TitleScene.ts:37-47`), then a single text hint "Drag anywhere" shown on-screen up to 4 s (`PlayScene.ts:424-426, 495-501`, `strings.ts:6`). Text-only; no keyboard overlay or hand gesture graphic (CG guideline 1 prefers visuals). Title->Play costs one click (acceptable under the one-click clause).
- Difficulty: spawn interval and fall speed ramp over time, speed rushes at 45 s cadence, Overdrive from 120 s, surges from 180 s - `src/difficulty.ts:1-36`; wave templates `src/waves.ts`; fairness validator `src/fairness.ts`.
- Juice: 80 ms hit-stop, shake, flash, 0.3x slow-mo on death - `PlayScene.ts:1067-1103`; near-miss combo + pitch-stepped SFX - `PlayScene.ts:955`; speed streak FX `src/speedFx.ts`; skin trails/death FX `src/skinFxRender.ts`. Solid.
- Audio: fully synthesized WebAudio (oscillator tones/noise, procedural music with layers added at 10/30/60 s) - `packages/game-kit/src/audio/sfx.ts:13-57`, `PlayScene.ts:60-65, 314-316`. No recorded assets. [I] Reads as chiptune/prototype quality versus music-driven competitors.
- Visuals: no image/spritesheet/audio files loaded (grep for `load.image/audio` found none); everything procedural: textures generated in `src/playArt.ts`, `src/skinArt.ts`, grid backdrop drawn with Graphics `PlayScene.ts:520-545`. Cover is `public/cover.svg`; store art is 3 PNGs in `store/`.
- Meta: Shop with workshop upgrades, skins, boosts (`src/ShopScene.ts`, `workshop.ts`, `skinsPanel.ts`, `boosts.ts`), rotating missions (`missions.ts`), medals/tiers Bronze to Legend (`medals.ts`, `progression.ts`), stars currency, revive via rewarded ad (`PlayScene.ts:1105-1120`, kit `session.ts:71`). Results screen with boost quick-buy and x2 rewarded (`results.ts:41, 232`).
- No daily reward, no leaderboard, no distinct modes/levels/worlds, no practice/checkpoint, no named content roadmap (grep of game-kit/game for leaderboard/daily: none).
- ~6,100 lines of src incl. tests; 1,171-line PlayScene.

## (d) Prioritized gap list

| # | Gap | Evidence | Severity | Proposed change | Effort |
|---|---|---|---|---|---|
| 1 | **Portrait-only 720x1280 canvas inside CG's 16:9 desktop iframe** | [V] CG requires legibility at 800x450-1920x1080 16:9 iframes (gameplay page). Ours: 720x1280 (`main.ts:13-14`), manifest `portrait` (`game.json:23`). At 450 px iframe height the scale is ~0.35: 36 px text becomes ~13 px, play field ~253 px wide with huge side bars. Top competitors are landscape or support both [V] | **blocker** [I] (first impression + legibility rule + CTR/conversion on desktop where most traffic lands: desktop share UNVERIFIED) | Add a landscape/wide layout: either true horizontal-play redesign (blocks fall in a wide field) or at minimum fill side bars with themed art and a wider play lane + scale HUD. Test in the Developer Portal preview at 800x450 and 1920x1080 | L |
| 2 | **Thin first 30 s: text-only hint, no visual onboarding, no clear early goal** | [V] guideline 1 and FAQ "clear goal, quick onboarding". Source: 4 s text hint only (`PlayScene.ts:495-501`); goals (missions/medals) appear as toasts later (`PlayScene.ts:1012,1056`) | major | Animated finger/arrow ghost-hand overlay + keyboard arrow overlay; first run shows one visible target (e.g. "Survive 30 s -> Bronze") as persistent HUD bar; first 10 s scripted easy pattern | S-M |
| 3 | **Prototype-grade art direction: all procedural shapes, no authored assets** | [V] guideline 5: coherent high-res style; [V] Poki: bright, consistent, polished assets outperform (via our earlier research, https://poki.com/blog/what-makes-high-quality-browser-game). Source: no image loads; `playArt.ts`, `skinArt.ts` | major [I] | Commission/author a real art pass: character/ship sprite with idle/hit animation, block variants with theme, layered parallax backdrop, polished logo/title screen, proper UI skin. Keep neon but add depth/lighting. Replace store art with in-game screenshots of the new look | L |
| 4 | **No finite content spine; one mode, endless only** | [V] Space Waves: worlds, levels, Classic/Endless/Race, practice; Drift Boss: mini-games/spin; Wave Dash: level editor. Ours: single endless loop (`waves.ts` templates, `PlayScene`) | major | Add 2-3 modes or stage sets (e.g. Endless, 30 s timed challenges/"zones" with distinct block rules, daily seeded run). Show near-miss progress ("82% to next tier") at death like Space Waves' crash % | M-L |
| 5 | **No retention hooks (daily reward, leaderboard, streak)** | [V] Drift Boss daily rewards + spin; Space Waves leaderboards tag. Ours: none found | major | Daily login reward + daily seeded challenge (rng already seedable: `rng.ts`), CG leaderboard if offered by SDK (check https://docs.crazygames.com/sdk/ - not fetched, UNVERIFIED), 3-day streak | M |
| 6 | **Audio is synthesized prototype audio** | [V] guideline 5 (music complements visuals, consistent levels). [I] vs. music-synced competitors | major-minor | Licensed/composed loop tracks (2-3), mixed samples for hit/pickup, level-normalize; keep layering by speed tier | M |
| 7 | **Meta economy is heavy relative to core variety** | Source: shop, workshop, boosts, missions, medals, assist, tilt all present before the core loop is deepened. [I] A reviewer in "first few minutes" ([V] FAQ) sees menus not fun | minor-major [I] | Hide shop/boost bar on first 2 runs; progressive unlock; make results screen one clear primary action (Retry) | S |
| 8 | **Name/genre clarity and CTR assets** | [V] CTR is a 4th Basic Launch metric from 2026-11-23, wants strong thumbnail/video (our own research, https://docs.crazygames.com/resources/basic-launch-metrics/). Source: `cover.svg`, 3 PNGs in `store/`; tags arcade/reflex | minor | Redo thumbnails from the new art with one focal subject; 15-20 s hover preview of best moment; check "Neon Rush" distinctiveness vs other CG titles (not checked: UNVERIFIED) | S |
| 9 | **Tilt/mobile-only features and fullscreen** | [V] custom fullscreen buttons prohibited (gameplay page). `kit.ts:205-218` has a fullscreen toggle gated on "platform feature" | minor, VERIFY | Confirm the CG build never shows a custom fullscreen button (check platform adapter); portal preview will flag it | S |
| 10 | **Update cadence/changelog** | [V] guideline 4: "maintain and update the game frequently". v2.8.4 is the rejected build | minor | Resubmit as a visibly new major version with a changelog in the portal notes | S |

## Verified vs inference summary

- Verified: all items marked [V] with URL (CG docs: quality, gameplay, FAQ, basic-launch-metrics; CG game pages for Space Waves, Drift Boss, Wave Dash, Slice Master, Count Masters; /t/avoid and /t/arcade FAQ lists). Source facts come from reading `games/dodge-drop` and `packages/game-kit` this session.
- Inference: the root cause of rejection (CG gave no specifics), severity ratings, the portrait-in-16:9 problem's impact, art/audio judgments, and the "pattern across competitors". Treat as hypotheses; the best check is the Developer Portal preview at 800x450 and 1920x1080 and 3-5 unseen playtesters.
- UNVERIFIED: resubmission cooldown, review SLA, listing reuse, desktop vs mobile traffic share, details of 4 unfetched competitors, exact meaning of "quality" in our rejection, SDK leaderboard availability, any developer write-up of a flipped "does not yet meet expectations" rejection. `https://docs.crazygames.com/t/dodge` and `/t/endless` returned 404 (no such tag pages).
