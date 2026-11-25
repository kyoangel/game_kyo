# Dodge Drop — meta-progression, Phase 1

Status: draft 2026-11-22, awaiting owner review.
Research basis: `docs/specs/game-design/research-meta-progression.md` (section D gives the starting numbers; all numbers here are design estimates to tune after playtest).
Release rule: site only. No portal submission until the owner has played it and approved it.

## Goal

"Lose a few times, upgrade, break through." A new player should lose early, feel challenged, and see within 1–2 runs that coins buy something that helps. Different players have different resilience, so Phase 1 covers both ends:

| Player | Mechanism in this phase |
|---|---|
| Quits fast | Loss-streak coin floor, first upgrade within ~2 runs, near-goal bar on results, automatic assist |
| Keeps trying | Workshop (6 upgrades × 5 levels), missions and rank |
| Skilled | Start from an earned medal tier; skill metrics (score) unaffected by assist |

Phase 2 (later spec): in-run perk pick (1 of 3, **game fully paused** while choosing — owner decision 2026-11-22) and zone breakthroughs. Phase 3: ability characters and daily challenge.

## 1. Workshop (permanent upgrades)

New `WorkshopScene`, reached from a new title button "Upgrades". Layout: 6 rows (icon, name, level pips ●●○○○, effect text, cost button), coin balance at the top, Back button.

Cost of level n (1..5): `round(15 × 1.6^(n−1))` → 15 / 24 / 38 / 61 / 98 (236 per upgrade, 1,416 total). No cross-upgrade price inflation.

| id | Name (en / zh-TW) | Effect per level L (L = 0 means not bought) |
|---|---|---|
| `shield` | Shield Core / 護盾核心 | L1–L4: first shield at `25 − 3L` s, then every `(30–40) × 0.92^L` s. **L5: a held shield absorbs 2 hits** (ring shows 2 bands). Capacity never exceeds 2. |
| `startShield` | Head Start / 開局護盾 | Chance to begin each run holding a shield: 20 / 40 / 60 / 80 / 100 %. |
| `magnet` | Star Magnet / 星星磁鐵 | Stars within 40 / 70 / 100 / 130 / 160 px of the player fly to it. |
| `nearMiss` | Daredevil / 擦邊高手 | Near-miss window `28 × (1 + 0.08L)` px → 30 / 32 / 35 / 37 / 39 px. |
| `combo` | Steady Combo / 連擊延長 | Combo timeout `2.5 + 0.15L` s. |
| `luck` | Lucky Stars / 幸運星 | Star interval `(6–9) × (1 − 0.07L)` s. |

The research's "dash" upgrade is replaced by `luck`: dash needs a new input gesture, which conflicts with drag control on mobile.

Persistence: save key `workshop`, JSON `{ [id]: level }`; unknown ids and out-of-range levels are sanitized to 0..5.

## 2. Coins

Coins credited at the results screen:

```
base   = stars + floor(score / 25)                    (unchanged)
floor  = min(10, 2 × lossStreak)                       (loss-streak minimum)
coins  = round(max(base, floor) × rankMultiplier)
```

- `lossStreak` counts consecutive runs (including this one) that ended before 30 s survived. A run reaching 30 s resets it to 0. Save key `lossStreak`.
- `rankMultiplier` comes from missions (§4).
- The coin line on results shows the breakdown when a floor or multiplier applied, e.g. `+8 coins (min 8)` / `+12 coins (×1.10)`.
- Head-start score from a medal-tier start (§5) does **not** earn coins.
- The rewarded ×2 button doubles the final `coins` (unchanged rule; ads builds only).

Check: a first-time player who survives ~15 s earns roughly 5–8 coins, so with the floor the first 15-coin upgrade comes by run 2–3.

## 3. Near-goal bar on results

One line under the coin line, never blocking retry:

- Target = the cheapest next workshop level; if all upgrades are maxed, the cheapest locked skin; if everything is owned, hide the bar.
- Text: `Shield Core Lv2 — 7 more coins` / `護盾核心 Lv2 — 還差 7 金幣`, plus a bar filling from the pre-run balance to the post-run balance (0.6 s tween).
- When the balance already covers it: `Shield Core Lv2 — ready!` with a pulsing accent colour.

## 4. Missions and rank

Three active missions, shown on the title screen (compact list) and on results (progress and completions).

Mission pool (each template has 3 tiers; tier = stars awarded):

| id | Template | Tier 1 / 2 / 3 | Scope |
|---|---|---|---|
| `nearMiss` | Near-miss N times | 10 / 25 / 50 | total |
| `combo` | Reach combo ×N | ×2 / ×3 / ×4 | one run |
| `survive` | Survive N seconds | 20 / 45 / 75 | one run |
| `starsTotal` | Collect N stars | 5 / 15 / 30 | total |
| `starsRun` | Collect N stars in one run | 3 / 6 / 10 | one run |
| `shieldBreak` | Block N hits with shields | 1 / 3 / 6 | total |
| `score` | Score N points in one run | 150 / 400 / 800 | one run |
| `rush` | Survive N rushes | 1 / 2 / 4 | total |
| `runs` | Play N runs | 3 / 6 / 10 | total |

Rules:
- New missions are drawn at random from templates not currently active. Tier = 1 for the first 3 missions ever; afterwards tier is weighted by rank (rank 1–3: 1★ 70 %, 2★ 30 %; rank 4–7: 40/45/15; rank 8+: 20/45/35).
- Progress updates during the run (no in-run UI except a 1.5 s toast "Mission complete!" when one completes). Completed missions are replaced when the results screen opens.
- Skip: on the title screen each mission has a skip button costing `40 × stars` coins; the replacement keeps the same tier.
- Rank: every 5 mission stars raise rank by 1 (rank starts at 1). Rank-up shows on results with a burst. `rankMultiplier = 1 + 0.05 × (rank − 1)`, capped at ×2.00 (rank 21).
- Persistence: save key `missions`, JSON `{ active: [{ id, tier, progress }], stars, rank, completedCount }`.

## 5. Start from a medal tier (for skilled players)

- After earning a medal, the player may start runs at that medal's time: Bronze 0:30, Silver 1:00, Gold 1:30 (Neon is the top tier, not a start point).
- The title screen shows a start selector under Play: chips `0:00 / Bronze / Silver / Gold`, only earned tiers enabled. The selection persists (save key `startTier`). **Default is 0:00 and it never changes by itself** (owner decision 2026-11-22: earning a medal only unlocks a chip; only the player selects it).
- A tier start sets the game clock to T: difficulty, wave cycle, rush timing, and medal thresholds all use the clock, so the run plays exactly like the T-second mark of a normal run.
- 2.0 s of grace at start: no blocks spawn, banner `Silver start` / `銀杯起跑`.
- Score starts at a fixed, round head start: **Bronze 100, Silver 200, Gold 300** (owner decision 2026-11-22: non-round numbers like 342 made players wonder why). This is the casual track: tier starts and upgrades are allowed. The head start counts for `best` but not for coins (§2). `rushesBefore` counts only the 45 s and 90 s rushes (Overdrive replaces rushes from 120 s).
- Future (not now): a separate **pure-skill leaderboard** — always from 0:00, no upgrades, no assist, no revive.
- Shield timing restarts relative to the start (first shield at start + its usual delay). Medals below T are not re-awarded; missions with "survive N s" count seconds actually survived in this run, not the clock.

## 6. Automatic assist (for players who keep losing)

Owner decision 2026-11-22: no opt-in prompt; it switches on by itself and is only needed until the player gets going.

- Trigger (checked at each game over): **2 consecutive runs with score 0**, or **3 consecutive runs without reaching Bronze (30 s)**.
- Only before the player's first Bronze medal ever. Once Bronze is earned, assist turns off permanently and never triggers again.
- While active, every run:
  - starts with a shield held (does not stack with `startShield`);
  - blocks fall at `0.85 ×` normal speed and spawn at `1.25 ×` the normal interval.
- Silent: no label or prompt. (Scope is limited to pre-Bronze players, so it does not affect skilled players' fairness.)
- The fairness validator (`fairness.ts`) and scheduler take the same speed/interval multipliers so every assisted field is still validated.
- Persistence: save key `assist`, JSON `{ zeroStreak, noBronzeStreak, active, retired }`.

## Shared rules

- All new logic lives in pure, Phaser-free modules with unit tests (`workshop.ts`, `missions.ts`, `progression.ts` for coins/assist/start tier); scenes only render and call them.
- All save keys go through `kit.save` (stored as `gk:dodge-drop:<key>`); every loaded value is sanitized.
- New strings in en and zh-TW in `strings.ts`.
- `game.json` version 2.1.0; site only.
- e2e (local build): open Workshop from title, buy an upgrade with seeded coins, return; results show the near-goal bar and a mission row; a tier start begins with the clock at the tier time (via `window.__dd.stats()`).

## Out of scope for Phase 1

In-run perks, zones and new block types, ability characters, daily challenge, leaderboards, rewarded-ad mission skips.

## 2.3 stacking shields

- New workshop upgrade `shieldStack` ("Shield Stack" / 「護盾堆疊」, `Hold up to {v} shields` / `最多累積 {v} 個護盾`) as the 2nd row (after Shield Core); same cost curve 15/24/38/61/98. Max held shields = `1 + L` (L0 = 1 ... L5 = 6). The workshop now has 7 rows; total cost 1652.
- **Pickup rule:** each shield pickup adds +1 held shield up to the maximum (it no longer refills to capacity). Without the upgrade, holding 1 and picking up another stays 1. Shield pickups only spawn while held < max.
- **Shield Core** keeps only the timing effect (first shield at `25 - 3L` s, interval `(30..40) x 0.92^L`); its L5 "absorbs 2 hits" special is removed.
- The `startShield` roll and assist each start the run with exactly 1 shield.
- HUD: the ring around the player stays; when held >= 2 a count badge (`x3`) shows beside the player, updated on pickup/break. Each absorbed hit keeps the existing break effect and invulnerability, then held -1.
- `sanitizeWorkshop` treats a missing `shieldStack` as 0; the near-goal bar includes it.
- Start tiers stay Bronze/Silver/Gold (head starts 100/200/300); Diamond and Legend are medals only.
