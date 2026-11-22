# Dodge Drop 2.0 — design

Status: approved design 2026-11-21. It depends on the game-kit juice layer (`docs/specs/game-platform/juice-layer.md`).
Research basis: `docs/specs/game-design/research-arcade-dodge.md`. The `#n` tags below refer to its ranked element list.
Release rule: site only. No portal submission until the user has played it and approved it.

## Pillars

1. **One more try.** Death to playing again takes under 1 second (#1).
2. **Every death is fair.** Telegraphs, a forgiving hitbox, and readable colours (#2).
3. **Risk pays.** Brushing past blocks builds a combo that multiplies score (#4, #6).
4. **It feels great to touch.** Shake, hit-stop, particles, rising-pitch audio, and layered music (#5, #12).
5. **A reason to come back.** Medals, coins, and skins (#8, #9).

## Core loop

The screen is portrait, 720×1280. The player is a glowing shape near the bottom, at y = 1100, and moves only horizontally. Blocks fall from the top. Each round lasts until the first unshielded hit.

### Controls (#3: no tutorial)

- **Touch or mouse:** relative drag with `kit.input(scene).dragDx()`, 1:1 with the finger. The finger can be anywhere on screen, so it never covers the player.
- **Keyboard:** arrows or A/D, with acceleration 5000 px/s² up to a maximum speed of 640 px/s, and deceleration 7000 px/s² when released.
- **Feel (#12):**
  - The player tilts up to 12° and stretches horizontally (scaleX up to 1.25, scaleY down to 0.85) in proportion to its velocity.
  - It leaves a particle trail (`fx.trail`) in the skin colour.
- The first 10 s are gentle (see the waves table), so players learn by doing. There is no text tutorial apart from a hint that fades after 3 s: "Drag anywhere ←→".

### Hitboxes (#2)

| Object | Hitbox size |
|---|---|
| Player (56×56 visual) | centred rect at 80% of the visual: 44.8×44.8 |
| Blocks | 90% of their visual size |
| Pickups | 140% of their visual size (generous) |

### Telegraphs (#2)

- Every block is announced 0.4 s before it spawns by a warning chevron at the top edge, at the block's x, sized to the block's width. The chevron is in the danger colour and blinks at 10 Hz.
- Rush events (see below) show a full-width "RUSH!" banner 1.0 s ahead.

### Waves (#7: patterns, not pure randomness)

A pure, seeded module (`waves.ts`) plans the spawns. `planWave(kind, t, rng, width)` returns `Spawn[]`, where each `Spawn` is `{ at: seconds offset, x, w, h, speedMul }`.

| Pattern | Description | Fairness guarantee |
|---|---|---|
| `rain` | single blocks at random x, spaced by `spawnInterval(t)` | none needed |
| `wall` | a full row with one gap | gap ≥ 2.2 × player hitbox width, and the gap centre is ≤ 360 px from the previous gap centre |
| `stairs` | 5 blocks stepping left→right or right→left, 0.25 s apart | the step width keeps a safe column open |
| `zigzag` | blocks alternating at the left third and right third, 0.45 s apart | the middle third stays clear |

Timeline:

| Time | Content |
|---|---|
| 0–10 s | `rain` only, at 60% of the base speed |
| every 20 s from 10 s | a new wave block. The kind cycles `wall → stairs → zigzag → rain-heavy`, then repeats, with `rain` filler between pattern instances |
| 45 s and 90 s | a **Rush**: 4 s at 1.4× speed, a "RUSH!" banner and `rush` sfx, and the music jumps a layer for its duration. No rushes exist from 120 s on (see Overdrive) |

- Base speed and interval follow the original curves up to 32.5 s (interval) / 53.33 s (speed): `fallSpeed = 260 + 12t` and `spawnInterval = max(0.25, 0.9 − 0.02t)`. After that difficulty keeps rising: `spawnInterval = max(0.15, 0.25 − 0.0011 (t − 32.5))` (0.15 at ≈123.4 s) and `fallSpeed = min(1150, 900 + 4 (t − 53.33))` (1150 at ≈115.8 s).
- **Overdrive (from 120 s, after Neon):** rushes stop and speed never drops back. The motion multiplier `speedBoost(t)` is 1.4 in a rush, 1 otherwise before 120 s, then `1 + 0.3 × min(1, (t − 120) / 30)` (1.30 from 150 s). The validator (`fairness.ts`) and `PlayScene` both use this one function. At 120 s an `OVERDRIVE!` / `極速模式！` banner and the `rush` sfx play, music stays at 4 layers, and new blocks are orange. Racing streaks scale with `overdrive(t)` (0 at 120 s, 1 at 150 s): up to 28 pooled white/cyan speed lines (2–4 px wide, 90–260 px long, alpha 0.2–0.6 × intensity) in the 130 px bands on both screen edges falling at 2.5× block speed, plus a `0x1a1033` edge vignette at alpha 0.55 × intensity; the backdrop grid and dots scroll faster too. Pure helpers live in `speedFx.ts`.
- Patterns scale their `speedMul` from these curves.
- Tests cover all of the following for 200 seeds:
  - every `wall` has a passable gap;
  - no two blocks overlap at spawn;
  - every spawn x stays inside [w/2, width − w/2].

### Near-miss combo (#4, #6)

- **Near miss:** a block passes the player's row with a horizontal gap between hitboxes of more than 0 and at most 28 px, and no collision. Each block counts at most once.
- **On a near miss:**
  - `combo += 1`;
  - `multiplier = min(5, 1 + floor(combo / 3))`;
  - score `+5 × multiplier`;
  - `popText("+5 ×m")`;
  - `nearMiss` sfx with `step = combo`, which climbs the pentatonic scale;
  - a small spark burst on the player's near side.
- **Combo reset:** after 2.5 s with no near miss, or on a shield break. The combo meter in the HUD drains visibly over those 2.5 s.
- **Dodged block:** a block leaving the bottom of the screen scores `+1 × multiplier`.

### Pickups

| Pickup | Spawn | Effect |
|---|---|---|
| **Star** (accent yellow, 36 px) | every 6–9 s at a reachable x (never inside a wall row) | +1 coin, +10 score, `pickup` sfx, burst |
| **Shield** (green ring, 40 px) | first at 25 s, then every 30–40 s, only while no shield is held | absorbs one hit: the block shatters, 60 ms hit-stop, `shieldBreak` sfx, 0.5 s invulnerability blink |

The held shield is drawn as a ring around the player. The slow-time power-up from v1 planning is dropped (unsupported by research).

### Death (#5)

The sequence on an unshielded hit:

1. `fx.hitStop(80)`.
2. `fx.shake(0.8)`, `fx.flash(danger, 120)`, and a 40-particle burst in the skin colour. The player is hidden. `death` sfx plays and the music stops.
3. `fx.timeScale(0.3, 500)`: the remaining blocks drift on in slow motion.
4. `kit.gameOver(score, { revive })`. The overlay from juice-layer §7 handles the revive offer, the results, and instant retry.

**Revive (#10):**
- Clear all blocks within 400 px above the player.
- Grant 2 s of invulnerability (blinking).
- Keep score, combo = 0, time, and wave state.
- Restart the music.
- Revive is offered once per run, and only when `features.rewardedAds` is true, so never on the site build.

### Medals (#8)

| Medal | Survive | Colour |
|---|---|---|
| Bronze | 30 s | `0xd08a4a` |
| Silver | 60 s | `0xd8e0ff` |
| Gold | 90 s | `0xffe14d` |
| Neon | 120 s | `0x3ff0ff` |

- Reaching a medal triggers a medal toast at the top (icon plus name, 1.5 s), `medal` sfx, and a burst.
- Earned medals persist to save key `medals` (a list of ids).
- The results screen shows the medals earned this run, plus the 4-slot collection row. Unearned slots are dim.

### Coins and skins (#9)

- **Coins per run:** `stars + floor(score / 25)`.
- **Double coins:** the results show "+N coins". When `rewardedAds` is true, they also show a "×2" button that calls `kit.showRewarded()`; on `'rewarded'`, the run's coins are doubled. It is offered once per results screen.
- **Persistence:** save keys `coins` (number), `skins` (owned ids), and `skin` (selected id).
- **Skins:** 8 skins, picked in the **Skins scene**, which is reached from the title menu button "Skins".

  | id | shape | colour | trail | cost |
  |---|---|---|---|---|
  | `cyan` | rounded square | cyan `0x3ff0ff` | cyan dots | 0 (owned) |
  | `lime` | rounded square | lime `0x7dff5a` | lime dots | 30 |
  | `orb` | circle | pink `0xff7ad9` | pink dots | 60 |
  | `tri` | triangle | orange `0xffa14d` | orange sparks | 100 |
  | `diamond` | diamond | white `0xffffff` | rainbow dots | 150 |
  | `hex` | hexagon | violet `0xb98cff` | violet sparks | 200 |
  | `star` | star | gold `0xffe14d` | gold sparks | 300 |
  | `prism` | diamond | hue-cycling | rainbow sparks | 500 |

- **Skins scene:**
  - 2×4 grid of skin cards, the coin balance, and the medal collection.
  - Tapping an owned skin selects it.
  - Tapping an affordable locked skin buys and selects it (`click` sfx plus burst). An unaffordable one shakes.
  - A Back button returns to the title.
- **Economy check (estimate):** a 60 s run gives ~12–18 coins, so the first unlock comes on run 2–3 and the full set takes ~60–80 runs.

### Music (#12)

The procedural loop runs at 120 BPM. The number of layers follows progress:

| Time | Layers |
|---|---|
| 0 s | 1 (bass) |
| 10 s | 2 (+ drums) |
| 30 s | 3 (+ arp) |
| 60 s | 4 (+ lead) |

A rush temporarily forces 4 layers.

## Visuals (bright neon, approved)

- **Background:** the theme gradient from indigo `0x2b1d7a` to violet `0x7a2fb0`, a faint perspective grid scrolling down at 0.3× block speed, and slow-drifting small dots for depth.
- **Blocks:** rounded rectangles in hot pink `0xff4fa3` with a glow (WebGL) and a 2 px lighter top edge. Rush blocks are orange `0xffa14d`.
- **HUD:**

  | Position | Content |
  |---|---|
  | top-left | score (48 px, counts up) |
  | under the score | combo multiplier "×3" with a drain bar |
  | top-right | timer `mm:ss` and the mute button |

- **Title backdrop:** blocks fall slowly behind the title, and the player skin idles with a bob.
- **Text:** the theme font with white text. Every text uses a dark stroke of at least 4 px for readability on bright backgrounds.

## Score

Score is the points from dodges, near misses, and stars. It remains the value saved as `best` and reported to the kit. Time survived drives medals and is shown in the results ("Survived 1:07").

## Strings

New keys in `strings.ts`, for en and zh-TW:
- `dragHint`, `rush`, `skins`, `back`, `coins`, `survived`;
- `medal.bronze|silver|gold|neon`;
- `double`, `revive`, `noThanks`, `newBest`, `tapRetry`, `home`.

Kit-generic ones (`revive`, `noThanks`, `newBest`, `tapRetry`, `home`, `double`) go in game-kit `builtinStrings.ts` as `gk.*`.

## Manifest and site

- `game.json` version becomes `2.0.0`.
- The description and instructions are updated to mention near misses, stars, and skins.
- `releases` stays `todo`.
- `cover.svg` is redrawn in the bright neon style: gradient background, pink blocks, cyan player, a near-miss spark, and the title. Store PNGs are regenerated with `npm run covers -- dodge-drop`.
- **Size budget:** the total `dist-site/dodge-drop/` is ≤ 2 MB (no binary assets).

## Testing

- **Unit (pure modules in `games/dodge-drop/src/`):** `waves.ts` (fairness properties over 200 seeds), `combo.ts` (near-miss detection, multiplier, reset timing), `economy.ts` (coins formula, buy/select rules, skin table integrity), `medals.ts` (thresholds, persistence merge), `difficulty.ts` (existing).
- **e2e:** the existing smoke test passes. A new `e2e/dodge-drop.spec.ts` (local build) covers:
  - start → play 3 s with key presses → `__gk.endRound` → results visible → tap → `state === 'playing'`;
  - the Skins scene opens from the title and returns.
- **Manual verification before handing to the user:** a headless 30 s playthrough with screenshots at the title, mid-run (combo visible), the death overlay, and the skins scene, plus one GIF.

## Out of scope (1.1+)

Daily challenge (#11), leaderboard, haptics, and additional power-ups.

## 2.3 density / tiers / shields

Owner decisions 2026-11-22 (after play-testing 2.2; revised the same day).

- **Density = row coverage** (fraction of a horizontal row covered by blocks), not blocks per second and not fall speed. Each rain spawn time is now a *row* of k blocks, k = floor(e) + (rng < frac(e)), max 3, with expected blocks per row `e(t)`: 1 until 30 s, linear to 1.6 at 120 s (Neon), to 2.2 at 180 s (Diamond), to 2.8 at 240 s (Legend), flat after. Rain width range 60-160 -> 80-180, stairs width 120 -> 160, zigzag width 100-180 -> 120-200, all ramping 30 -> 240 s then flat. Every row keeps a horizontal gap of at least 2.2 x hitbox (about 99 px), re-placed up to 12 times, else the last block is dropped. Walls, `spawnInterval` and the wave cycle are unchanged. Helpers (`rainRowExpected`, `rainRowBlocks`, `rainWidthRange`, `stairsWidth`, `zigzagWidthRange`, `rainRow`) live in `waves.ts`.
- **Speed:** top speed is reached at Neon: `OVERDRIVE_RAMP` 30 -> 10 s (1150 x 1.3 = 1495 px/s from 2:10). Nothing else changes; base speed never increases after that.
- **Surges:** from Diamond (180 s) on, every 30 s (180, 210, 240, ...; forever, also after Legend) a 4 s surge multiplies speed by 1.2 (`speedBoost` = 1.56 during a surge, then back to 1.3). Surges reuse the RUSH banner and sfx, count for the `rush` mission and `rushesBefore`/`rushStartAt`. Single source of truth: `speedBoost` / `isSurge` in `difficulty.ts` (the fairness validator uses it).
- **Legend is endurance:** after 240 s density and base speed stay flat; only the surges continue.
- **Medals:** `diamond` 180 s (`0xc8f4ff`) and `legend` 240 s (`0xff7ad9`); results show six medals with time labels in one row. Start tiers are unchanged (maximum Gold, head starts 100/200/300): Diamond and Legend are medals only.
- **Stacking shields:** see meta-progression.md (Shield Stack upgrade, +1 per pickup, count badge).
- **Validator:** the scheduler prunes non-wall blocks, trying the blocks that reach the player row near the dead end first (at most 8 single-removal tries, then drop the likeliest culprit). The property tests plan 240 s per seed.
