# Dodge Drop: time-only results + graze-charged Chomp (v3.3.0)

Status: done 2026-11-25 (all phases; portrait gauge is 136 px wide with a Chomp icon so it clears the goal label).

Owner decision 2026-11-25: score and combo feel meaningless ("nobody risks a near miss for points").
Chosen: drop score, survival time is the only result; near misses charge a gauge that triggers Chomp.

## Design

1. **Result = clock time** (includes the tier-start offset, same clock the medals use). Best = longest clock time.
2. **Kit**: `GameDefinition.scoreFormat?: 'points' | 'time'` (default points). `time`:
   results overlay label `gk.time`, values shown as m:ss, best stored under `<slug>:bestTime`
   (old `<slug>:best` holds points and is ignored, no migration).
3. **Site lobby**: manifest `scoreFormat: "time"` → card reads `bestTime`, shows m:ss, label "Best time / 最佳時間".
4. **Coins** = stars + floor(survived seconds / 5) (survived = excluding tier start), then loss floor and rank
   multiplier as before. Measured old rate (stationary god player): 60 s ≈ 5, 120 s ≈ 28 coins; new 12 / 24.
5. **Graze gauge**: each near miss +1; 8 fills it → Chomp for 4 s (+0.5 s per "Steady Combo" level, which becomes
   "Longer Chomp"); gauge resets, does not fill during Chomp, never decays. Near-miss pop text "Graze!",
   sfx pitch rises with the gauge. Bought Chomp boost (fatal-hit save, 6 s) unchanged.
6. **Eaten blocks**: no score; counted in stats (`chompEats`) for missions.
7. **HUD**: score text + combo text/bar removed. Timer takes the score slot (top-left, large); gauge bar under it
   (portrait: combo slot; landscape: left panel). Right-side timer slot freed.
8. **Missions**: `score` → `chompEat` (eat 5/15/30 blocks, total); `combo` → `chompRun` (graze-Chomp 1/2/3 in a run).
   Unknown saved mission ids are dropped and redrawn by `sanitizeMissions`.
9. **Removed**: head-start score (`HEAD_START_SCORE`, `headStart`), Combo multiplier.
10. **Goal bar** after Legend: percent of best time.
11. Store text (game.json en/zh description + instructions) updated; version 3.3.0; resubmit notes.

## Phases (TDD each; commit per phase; push after all green)

1. game-kit `scoreFormat` + session bestKey + overlay formatting + site lobby. Tests: session, GameOverScene via e2e results spec, render.test.
2. Pure logic: progression (coins, no head start), graze gauge module, missions, runSetup, goalBar, settle. Unit tests first.
3. PlayScene/HUD/results/strings wiring; e2e updates; screenshots portrait/landscape en/zh.
4. Docs, version, full suites (vitest, smoke, rwd, portals), push, verify live version.
