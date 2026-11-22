# Dodge Drop Meta-Progression (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permanent progression to dodge-drop 2.1.0 so a player who loses early sees coins buy something useful within 1–2 runs: Workshop (6 upgrades × 5 levels), loss-streak coin floor, near-goal bar, missions + rank, medal-tier starts for skilled players, and a silent pre-Bronze assist.

**Architecture:** All rules live in Phaser-free, unit-tested modules (`workshop.ts`, `progression.ts`, `missions.ts`, `runSetup.ts`, `settle.ts`). `schedule.ts`/`fairness.ts`/`waves.ts` learn difficulty multipliers and a start clock so assisted and tier-start fields stay validated. Scenes (`PlayScene`, `results.ts`, new `WorkshopScene`, title extras) only render and call the pure modules. game-kit gains exactly one generic, optional hook (`titleExtras`) so a game can draw custom content on the title screen; the kit never branches on game id or platform id.

**Tech Stack:** TypeScript (erasable syntax only, `.ts` import extensions), Phaser 3.90, vitest (`--no-experimental-webstorage`), Playwright e2e against `dist/local` (game served at `/dodge-drop/`), Node >= 24.

**Spec (source of truth, numbers copied verbatim below):** `docs/specs/dodge-drop/meta-progression.md` (MP §n). Prior art: `docs/specs/dodge-drop/v2-design.md`, `docs/plans/2026-11-21-juice-layer-dodge-drop-v2.md`.

**Status:** complete (Tasks 1-6 done; site-only 2.1.0, portal releases stay todo, no portal submission until the owner has played it). Verified: typecheck, 383 unit tests, test:smoke (8 e2e) pass; dist/site/dodge-drop 1.5 MB.

## Global Constraints

- Implementer rules: read `.superpowers/sdd/rules.md` first and obey it (work on master, `git push origin master` after each commit, explicit-path staging only, never stage `workspace-pixel-squad/run_aoa_tests.sh`, never modify `workspace/`, `workspace-merge10x/`, `workspace-pixel-squad/`, no nested dispatch, failing test first with RED output captured, `npm run typecheck` and `npm test` pass before each commit, report to the path given). Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Node >= 24; TS `erasableSyntaxOnly` (no enums, no parameter properties, no namespaces); relative imports use `.ts` extensions.
- No branching on `platform.id` or on game id in game-kit (`scripts/rules.test.ts`). No binary assets; textures are generated at runtime.
- Site only: `game.json` version `2.1.0`; `releases` entries stay `status: "todo"`. No portal submission until the owner has played it.
- All new save keys go through `kit.save` (stored as `gk:dodge-drop:<key>`); every loaded value is sanitized. Keys: `workshop` (JSON `{ [id]: level }`), `lossStreak` (number), `assist` (JSON `{ zeroStreak, noBronzeStreak, active, retired }`), `missions` (JSON `{ active: [{ id, tier, progress }], stars, rank, completedCount }`), `startTier` (JSON string `"none" | "bronze" | "silver" | "gold"`). Existing keys `coins`, `skins`, `skin`, `medals` unchanged.
- Every new user-facing string has `en` and `zh-TW` in `strings.ts`.
- Workshop (MP §1): cost of level n (1..5) = `round(15 x 1.6^(n-1))` = 15 / 24 / 38 / 61 / 98 (236 per upgrade, 1,416 total), no cross-upgrade inflation. Ids and effects at level L (L = 0 not bought):
  - `shield` Shield Core / 護盾核心: L1–L4 first shield at `25 − 3L` s then every `(30–40) × 0.92^L` s; **L5: a held shield absorbs 2 hits** (ring shows 2 bands); capacity never exceeds 2.
  - `startShield` Head Start / 開局護盾: chance to begin each run holding a shield 20 / 40 / 60 / 80 / 100 %.
  - `magnet` Star Magnet / 星星磁鐵: stars within 40 / 70 / 100 / 130 / 160 px fly to the player.
  - `nearMiss` Daredevil / 擦邊高手: window `28 × (1 + 0.08L)` px -> 30 / 32 / 35 / 37 / 39.
  - `combo` Steady Combo / 連擊延長: combo timeout `2.5 + 0.15L` s.
  - `luck` Lucky Stars / 幸運星: star interval `(6–9) × (1 − 0.07L)` s.
  - `workshop` sanitized: unknown ids dropped, levels clamped to 0..5.
- Coins (MP §2): `base = stars + floor(score / 25)`; `floor = min(10, 2 × lossStreak)`; `coins = round(max(base, floor) × rankMultiplier)`. `lossStreak` counts consecutive runs (including this one) that ended before 30 s survived; reaching 30 s resets to 0. Breakdown text `+8 coins (min 8)` / `+12 coins (×1.10)` when a floor or multiplier applied. Head-start score earns no coins. Rewarded x2 doubles the final `coins` (ads builds only, unchanged).
- Near-goal bar (MP §3): target = cheapest next workshop level; if all maxed the cheapest locked skin; if everything owned hide the bar. Text `Shield Core Lv2 — 7 more coins` / `護盾核心 Lv2 — 還差 7 金幣`; bar fills from pre-run to post-run balance (0.6 s tween); when covered `Shield Core Lv2 — ready!` with pulsing accent.
- Missions (MP §4): 3 active; tier = stars awarded; pool (Tier 1 / 2 / 3, scope): `nearMiss` 10 / 25 / 50 total; `combo` ×2 / ×3 / ×4 one run; `survive` 20 / 45 / 75 s one run; `starsTotal` 5 / 15 / 30 total; `starsRun` 3 / 6 / 10 one run; `shieldBreak` 1 / 3 / 6 total; `score` 150 / 400 / 800 one run; `rush` 1 / 2 / 4 total; `runs` 3 / 6 / 10 total. New missions drawn at random from templates not currently active; tier 1 for the first 3 missions ever, afterwards weighted by rank (rank 1–3: 1★ 70 %, 2★ 30 %; rank 4–7: 40/45/15; rank 8+: 20/45/35). No in-run UI except a 1.5 s toast "Mission complete!"; completed missions replaced when results opens. Skip on title costs `40 × stars` coins, replacement keeps the tier. Rank: every 5 mission stars +1 (starts at 1), burst on results; `rankMultiplier = 1 + 0.05 × (rank − 1)`, cap ×2.00 (rank 21).
- Start tier (MP §5): Bronze 0:30, Silver 1:00, Gold 1:30 (Neon is not a start point). Title chips `0:00 / Bronze / Silver / Gold`, only earned enabled; selection persists and auto-advances to the newest tier when a run earns a higher medal; player may tap back to a lower tier. Tier start sets the game clock to T (difficulty, waves, rush, medal thresholds all use the clock). 2.0 s grace with no blocks, banner `Silver start` / `銀盃起跑`. Score starts at `headStartScore(T)` = blocks spawned before T by the standard scheduler with seed 1 (precomputed 30/60/90 = **44 / 147 / 304**, asserted in a unit test); counts for `best`, not for coins. Shield timing restarts relative to the start; medals below T not re-awarded; "survive N s" missions count real seconds survived.
- Assist (MP §6): silent, no prompt. Trigger at each game over: 2 consecutive runs with score 0, or 3 consecutive runs without reaching Bronze (30 s); only before the first Bronze ever; once Bronze is earned assist turns off permanently and never triggers again. While active every run: start with a shield held (does not stack with `startShield`), blocks fall at `0.85 ×` speed and spawn at `1.25 ×` the normal interval. Scheduler and fairness validator take the same multipliers.
- All gameplay numbers are design estimates; do not "tune" them in this plan.
- `npm run typecheck`, `npm test` pass after every task; `npm run test:smoke` passes after Tasks 4, 5, 6.

## Spec coverage map

| Spec | Task |
|---|---|
| §1 Workshop rules/effects/cost/sanitize | 1 (pure), 4 (effects in play), 6 (scene) |
| §2 Coins, loss streak | 1 (formula), 5 (credit + breakdown) |
| §3 Near-goal bar | 5 |
| §4 Missions, rank | 2 (pure), 4 (in-run stats + toast), 5 (results), 6 (title list + skip) |
| §5 Start from medal tier | 1 (tier logic, headStartScore), 3 (scheduler startT), 4 (play), 6 (chips) |
| §6 Assist | 1 (state machine), 3 (multipliers), 4 (effects), 5 (persistence) |
| Shared rules (pure modules, kit.save, strings, version, e2e) | all; 6 for strings/version/e2e |

## Decisions on spec gaps (apply these; do not re-litigate)

1. "First 3 missions ever are tier 1" is implemented as: the initial state (no saved `missions`) draws 3 tier-1 missions; every later draw (completion or skip replacement) uses rank weights. No extra save field.
2. Shield Core L5 keeps the `25 − 3L` first-shield time and `0.92^L` interval formulas (L = 5 gives 10 s) plus capacity 2. The spec lists timing for L1–L4 only; continuing the formula keeps L5 strictly better.
3. Shield pickups keep spawning while `shieldHits < capacity` (so an L5 player holding 1 hit can top up). Start shield (workshop roll or assist) grants full capacity.
4. A replacement mission never repeats a template that is currently active **or that was just completed/skipped**.
5. One-run missions store `progress = max(progress, run value)`; total missions store `progress + run value`. `combo` measures the combo multiplier reached (×2 = 3 hits, ×4 = 9 hits). `score` and the coin base use `score − headStart`.
6. `seconds` in `RunState` becomes real seconds survived (`floor(t − startT)`); loss streak, survive missions, and the "Survived" line use it. Medals still use the clock.
7. Missions progress is persisted when the results screen opens (after the revive offer resolves), as the spec says replacements happen then.
8. Assist `active` latches until Bronze is owned (then `retired`), it does not switch off when streaks break.
9. Magnet pull speed is 900 px/s (spec gives only the radius). Block speed multiplier for assist is applied globally on top of each block's own `speedMul`.
10. Revive does not reset run stats. Rush missions count a rush when the clock passes the rush end (start + 4 s) while alive.

---

### Task 1: Pure modules `workshop.ts` and `progression.ts`

**Files:**
- Create: `games/dodge-drop/src/workshop.ts`, `games/dodge-drop/src/workshop.test.ts`, `games/dodge-drop/src/progression.ts`, `games/dodge-drop/src/progression.test.ts`.

**Interfaces (Produces):**
```ts
// workshop.ts
export type UpgradeId = 'shield' | 'startShield' | 'magnet' | 'nearMiss' | 'combo' | 'luck';
export const UPGRADE_IDS: readonly UpgradeId[];            // order above = row order
export const MAX_LEVEL = 5;
export type Workshop = Record<UpgradeId, number>;          // level 0..5
export function emptyWorkshop(): Workshop;
export function sanitizeWorkshop(raw: unknown): Workshop;
export function upgradeCost(n: number): number;            // n = target level 1..5; otherwise Infinity
export function nextCost(level: number): number | null;    // null when level >= 5
export function buyUpgrade(
  state: { coins: number; levels: Workshop }, id: string,
): { ok: true; coins: number; levels: Workshop } | { ok: false; reason: 'max' | 'poor' | 'unknown' };
export function shieldFirstAt(level: number): number;      // 25 - 3L
export function shieldInterval(level: number, r: number): number; // (30 + 10r) * 0.92^L, r in [0,1)
export function shieldCapacity(level: number): 1 | 2;
export function startShieldChance(level: number): number;  // 0 / .2 / .4 / .6 / .8 / 1
export function magnetRadius(level: number): number;       // 0 / 40 / 70 / 100 / 130 / 160
export function nearMissWindow(level: number): number;     // round(28 * (1 + 0.08L))
export function comboTimeout(level: number): number;       // 2.5 + 0.15L
export function starInterval(level: number, r: number): number; // (6 + 3r) * (1 - 0.07L)
export function effectValue(id: UpgradeId, level: number): number; // number shown in the Workshop row (see Task 6)

// progression.ts
export const LOSS_SECONDS = 30;
export const ASSIST_SPEED_MUL = 0.85;
export const ASSIST_INTERVAL_MUL = 1.25;
export function nextLossStreak(prev: number, secondsSurvived: number): number;
export interface CoinInput { score: number; headStart: number; stars: number; lossStreak: number; rankMultiplier: number }
export interface CoinResult { coins: number; base: number; floor: number; multiplier: number; floorApplied: boolean }
export function runCoins(i: CoinInput): CoinResult;
export interface AssistState { zeroStreak: number; noBronzeStreak: number; active: boolean; retired: boolean }
export const DEFAULT_ASSIST: AssistState;
export function sanitizeAssist(raw: unknown): AssistState;
export function updateAssist(prev: AssistState, run: { score: number; seconds: number; bronzeOwned: boolean }): AssistState; // score excludes head start
export type StartTier = 'none' | 'bronze' | 'silver' | 'gold';
export const START_TIERS: readonly { id: StartTier; seconds: number }[];
export function tierSeconds(t: StartTier): number;
export function availableTiers(medals: readonly string[]): StartTier[];  // 'none' always first
export function sanitizeStartTier(raw: unknown, medals: readonly string[]): StartTier;
export function advanceStartTier(current: StartTier, runMedals: readonly string[]): StartTier;
export const HEAD_START_SCORE: Record<'bronze' | 'silver' | 'gold', number>; // 44 / 147 / 304
export function headStartScore(t: StartTier): number;
export function rushesBefore(clock: number): number;       // rushes whose 4 s window has fully ended before `clock`
```
Consumes: `economy.coinsForRun(score, stars)` (existing base formula), `schedule.SpawnScheduler`, `rng.mulberry32` (test only).

- [ ] **Step 1: Write `workshop.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import {
  buyUpgrade, comboTimeout, effectValue, emptyWorkshop, magnetRadius, nearMissWindow, nextCost, sanitizeWorkshop,
  shieldCapacity, shieldFirstAt, shieldInterval, startShieldChance, starInterval, UPGRADE_IDS, upgradeCost,
} from './workshop.ts';

describe('workshop table', () => {
  it('lists the six upgrades in row order', () => {
    expect(UPGRADE_IDS).toEqual(['shield', 'startShield', 'magnet', 'nearMiss', 'combo', 'luck']);
  });
  it('costs 15/24/38/61/98 per level, 236 per upgrade, 1416 total', () => {
    expect([1, 2, 3, 4, 5].map(upgradeCost)).toEqual([15, 24, 38, 61, 98]);
    const per = [1, 2, 3, 4, 5].reduce((s, n) => s + upgradeCost(n), 0);
    expect(per).toBe(236);
    expect(per * UPGRADE_IDS.length).toBe(1416);
    expect(upgradeCost(0)).toBe(Infinity);
    expect(upgradeCost(6)).toBe(Infinity);
  });
  it('nextCost is the cost of the next level, null when maxed', () => {
    expect(nextCost(0)).toBe(15);
    expect(nextCost(4)).toBe(98);
    expect(nextCost(5)).toBeNull();
  });
});

describe('workshop effects', () => {
  it('shield: first at 25-3L, interval (30..40)*0.92^L, capacity 2 only at L5', () => {
    expect([0, 1, 2, 3, 4, 5].map(shieldFirstAt)).toEqual([25, 22, 19, 16, 13, 10]);
    expect(shieldInterval(0, 0)).toBe(30);
    expect(shieldInterval(0, 0.9999)).toBeCloseTo(40, 2);
    expect(shieldInterval(2, 0)).toBeCloseTo(30 * 0.92 ** 2, 6);
    expect([0, 1, 2, 3, 4, 5].map(shieldCapacity)).toEqual([1, 1, 1, 1, 1, 2]);
  });
  it('startShield chance 20/40/60/80/100 %', () => {
    expect([0, 1, 2, 3, 4, 5].map(startShieldChance)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it('magnet radius 40/70/100/130/160 px', () => {
    expect([0, 1, 2, 3, 4, 5].map(magnetRadius)).toEqual([0, 40, 70, 100, 130, 160]);
  });
  it('near-miss window 28 -> 30/32/35/37/39 px', () => {
    expect([0, 1, 2, 3, 4, 5].map(nearMissWindow)).toEqual([28, 30, 32, 35, 37, 39]);
  });
  it('combo timeout 2.5 + 0.15L', () => {
    expect(comboTimeout(0)).toBe(2.5);
    expect(comboTimeout(5)).toBeCloseTo(3.25, 9);
  });
  it('star interval (6..9)*(1-0.07L)', () => {
    expect(starInterval(0, 0)).toBe(6);
    expect(starInterval(0, 1)).toBe(9);
    expect(starInterval(5, 0)).toBeCloseTo(6 * 0.65, 9);
  });
  it('clamps out-of-range levels', () => {
    expect(shieldFirstAt(-3)).toBe(25);
    expect(nearMissWindow(99)).toBe(39);
    expect(shieldCapacity(99)).toBe(2);
  });
  it('effectValue gives the number shown per row', () => {
    expect(effectValue('shield', 2)).toBe(19);
    expect(effectValue('startShield', 3)).toBe(60);
    expect(effectValue('magnet', 1)).toBe(40);
    expect(effectValue('nearMiss', 3)).toBe(35);
    expect(effectValue('combo', 4)).toBeCloseTo(3.1, 9);
    expect(effectValue('luck', 5)).toBe(35);
  });
});

describe('sanitize / buy', () => {
  it('sanitizes unknown ids and out-of-range levels to 0..5', () => {
    expect(sanitizeWorkshop({ shield: 3, bogus: 2, magnet: 9, luck: -1, combo: '2', nearMiss: 2.7 })).toEqual({
      shield: 3, startShield: 0, magnet: 5, nearMiss: 2, combo: 0, luck: 0,
    });
    expect(sanitizeWorkshop(null)).toEqual(emptyWorkshop());
    expect(sanitizeWorkshop([1, 2])).toEqual(emptyWorkshop());
  });
  it('buyUpgrade: ok, poor, max, unknown', () => {
    const levels = { ...emptyWorkshop(), shield: 1 };
    expect(buyUpgrade({ coins: 30, levels }, 'shield')).toEqual({ ok: true, coins: 6, levels: { ...levels, shield: 2 } });
    expect(buyUpgrade({ coins: 23, levels }, 'shield')).toEqual({ ok: false, reason: 'poor' });
    expect(buyUpgrade({ coins: 999, levels: { ...levels, shield: 5 } }, 'shield')).toEqual({ ok: false, reason: 'max' });
    expect(buyUpgrade({ coins: 999, levels }, 'dash')).toEqual({ ok: false, reason: 'unknown' });
  });
  it('buyUpgrade does not mutate its input', () => {
    const levels = emptyWorkshop();
    buyUpgrade({ coins: 100, levels }, 'luck');
    expect(levels.luck).toBe(0);
  });
});
```

- [ ] **Step 2: Write `progression.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import {
  advanceStartTier, availableTiers, DEFAULT_ASSIST, HEAD_START_SCORE, headStartScore, nextLossStreak, runCoins,
  rushesBefore, sanitizeAssist, sanitizeStartTier, START_TIERS, tierSeconds, updateAssist, type AssistState,
} from './progression.ts';
import { mulberry32 } from './rng.ts';
import { SpawnScheduler } from './schedule.ts';

describe('loss streak', () => {
  it('increments below 30 s, resets at 30 s or more', () => {
    expect(nextLossStreak(0, 12)).toBe(1);
    expect(nextLossStreak(2, 29)).toBe(3);
    expect(nextLossStreak(2, 30)).toBe(0);
    expect(nextLossStreak(5, 75)).toBe(0);
  });
});

describe('runCoins', () => {
  const base = { headStart: 0, lossStreak: 0, rankMultiplier: 1 };
  it('base = stars + floor(score/25), no floor or multiplier', () => {
    expect(runCoins({ ...base, score: 100, stars: 3 })).toEqual({ coins: 7, base: 7, floor: 0, multiplier: 1, floorApplied: false });
  });
  it('loss-streak floor is min(10, 2*streak) and applies only when above base', () => {
    expect(runCoins({ ...base, score: 25, stars: 0, lossStreak: 2 })).toMatchObject({ coins: 4, base: 1, floor: 4, floorApplied: true });
    expect(runCoins({ ...base, score: 0, stars: 0, lossStreak: 9 })).toMatchObject({ coins: 10, floor: 10, floorApplied: true });
    expect(runCoins({ ...base, score: 250, stars: 0, lossStreak: 1 })).toMatchObject({ coins: 10, floorApplied: false });
  });
  it('rank multiplier multiplies max(base, floor) and rounds', () => {
    expect(runCoins({ ...base, score: 250, stars: 0, rankMultiplier: 1.1 })).toMatchObject({ coins: 11, multiplier: 1.1 });
    expect(runCoins({ ...base, score: 500, stars: 0, rankMultiplier: 1.35 })).toMatchObject({ coins: 27 });
    expect(runCoins({ ...base, score: 25, stars: 0, lossStreak: 3, rankMultiplier: 1.1 })).toMatchObject({ coins: 7, floor: 6 });
  });
  it('head-start score earns no coins', () => {
    expect(runCoins({ ...base, score: 304 + 50, headStart: 304, stars: 0 })).toMatchObject({ coins: 2 });
    expect(runCoins({ ...base, score: 100, headStart: 304, stars: 0 })).toMatchObject({ coins: 0 });
  });
});

describe('assist state machine', () => {
  const run = (score: number, seconds: number, bronzeOwned = false) => ({ score, seconds, bronzeOwned });
  it('starts inactive', () => {
    expect(DEFAULT_ASSIST).toEqual({ zeroStreak: 0, noBronzeStreak: 0, active: false, retired: false });
  });
  it('turns on after 2 consecutive zero-score runs', () => {
    let s = updateAssist(DEFAULT_ASSIST, run(0, 3));
    expect(s.active).toBe(false);
    s = updateAssist(s, run(0, 2));
    expect(s.active).toBe(true);
  });
  it('a non-zero score resets the zero streak', () => {
    let s = updateAssist(DEFAULT_ASSIST, run(0, 3));
    s = updateAssist(s, run(5, 4));
    expect(s.zeroStreak).toBe(0);
    s = updateAssist(s, run(0, 3));
    expect(s.active).toBe(false);
  });
  it('turns on after 3 consecutive runs under 30 s without Bronze', () => {
    let s: AssistState = DEFAULT_ASSIST;
    s = updateAssist(s, run(10, 12));
    s = updateAssist(s, run(10, 12));
    expect(s.active).toBe(false);
    s = updateAssist(s, run(10, 12));
    expect(s.active).toBe(true);
  });
  it('stays active (latched) until Bronze is owned, then retires permanently', () => {
    let s = updateAssist({ ...DEFAULT_ASSIST, zeroStreak: 1 }, run(0, 1));
    expect(s.active).toBe(true);
    s = updateAssist(s, run(40, 20));
    expect(s.active).toBe(true);
    s = updateAssist(s, run(300, 35, true));
    expect(s).toEqual({ zeroStreak: 0, noBronzeStreak: 0, active: false, retired: true });
    for (let i = 0; i < 5; i++) s = updateAssist(s, run(0, 1, true));
    expect(s.active).toBe(false);
    expect(s.retired).toBe(true);
  });
  it('retire wins over a trigger in the same run', () => {
    const s = updateAssist({ ...DEFAULT_ASSIST, zeroStreak: 1 }, run(0, 31, true));
    expect(s.active).toBe(false);
    expect(s.retired).toBe(true);
  });
  it('sanitizes garbage', () => {
    expect(sanitizeAssist(null)).toEqual(DEFAULT_ASSIST);
    expect(sanitizeAssist({ zeroStreak: -4, noBronzeStreak: 'x', active: 'yes', retired: 1 })).toEqual(DEFAULT_ASSIST);
    expect(sanitizeAssist({ zeroStreak: 2.9, noBronzeStreak: 1, active: true, retired: false })).toEqual({
      zeroStreak: 2, noBronzeStreak: 1, active: true, retired: false,
    });
  });
});

describe('start tiers', () => {
  it('Bronze 0:30, Silver 1:00, Gold 1:30', () => {
    expect(START_TIERS.map((t) => [t.id, t.seconds])).toEqual([['none', 0], ['bronze', 30], ['silver', 60], ['gold', 90]]);
    expect(tierSeconds('gold')).toBe(90);
  });
  it('only earned medals are available; neon is not a start point', () => {
    expect(availableTiers([])).toEqual(['none']);
    expect(availableTiers(['bronze', 'silver', 'neon', 'bogus'])).toEqual(['none', 'bronze', 'silver']);
  });
  it('sanitizeStartTier falls back to none when not earned or invalid', () => {
    expect(sanitizeStartTier('silver', ['bronze', 'silver'])).toBe('silver');
    expect(sanitizeStartTier('gold', ['bronze'])).toBe('none');
    expect(sanitizeStartTier(42, ['bronze'])).toBe('none');
  });
  it('auto-advances up to the newest medal, never down', () => {
    expect(advanceStartTier('none', ['bronze'])).toBe('bronze');
    expect(advanceStartTier('none', ['bronze', 'silver'])).toBe('silver');
    expect(advanceStartTier('silver', ['gold', 'neon'])).toBe('gold');
    expect(advanceStartTier('gold', ['bronze'])).toBe('gold');
    expect(advanceStartTier('bronze', [])).toBe('bronze');
    expect(advanceStartTier('none', ['neon'])).toBe('none');
  });
});

describe('headStartScore', () => {
  it('constants for 30/60/90 are 44/147/304', () => {
    expect(HEAD_START_SCORE).toEqual({ bronze: 44, silver: 147, gold: 304 });
    expect(headStartScore('none')).toBe(0);
    expect(headStartScore('silver')).toBe(147);
  });
  it('equal the blocks spawned before T by the standard seed-1 scheduler', () => {
    for (const [tier, T] of [['bronze', 30], ['silver', 60], ['gold', 90]] as const) {
      expect(new SpawnScheduler(mulberry32(1), 720).planUntil(T).length).toBe(HEAD_START_SCORE[tier]);
    }
  });
});

describe('rushesBefore', () => {
  it('counts rushes (45 s, 90 s, 135 s, 4 s long) fully ended before the clock', () => {
    expect([0, 30, 48.9, 49, 60, 90, 93.9, 94, 139].map(rushesBefore)).toEqual([0, 0, 0, 1, 1, 1, 1, 2, 3]);
  });
});
```

- [ ] **Step 3: Run `npx vitest run games/dodge-drop/src/workshop.test.ts games/dodge-drop/src/progression.test.ts --no-experimental-webstorage`** — expected RED (modules missing). Capture output.

- [ ] **Step 4: Implement `workshop.ts`.** Rules: `lvl(level) = clamp(Math.floor(level) , 0, 5)` applied in every getter (non-finite -> 0); `upgradeCost(n) = Number.isInteger(n) && n>=1 && n<=5 ? Math.round(15 * 1.6 ** (n-1)) : Infinity`; `nearMissWindow = Math.round(28 * (1 + 0.08*L))`; `effectValue`: shield -> `shieldFirstAt`, startShield -> `startShieldChance*100`, magnet -> `magnetRadius`, nearMiss -> `nearMissWindow`, combo -> `comboTimeout`, luck -> `7 * L` (percent faster). `buyUpgrade` returns a fresh `levels` object and never mutates. `sanitizeWorkshop` accepts only plain objects (not arrays), for each known id takes `typeof v === 'number' && Number.isFinite(v) ? clamp(Math.floor(v),0,5) : 0`.

- [ ] **Step 5: Implement `progression.ts`.**
  - `runCoins`: `earned = max(0, score - headStart)`; `base = coinsForRun(earned, stars)`; `floor = min(10, 2*lossStreak)`; `multiplier = Math.round(rankMultiplier*100)/100`; `coins = Math.round(Math.max(base, floor) * multiplier)`; `floorApplied = floor > base`.
  - `updateAssist(prev, run)`: if `prev.retired || run.bronzeOwned` return `{0,0,false,true}`; `zero = run.score === 0 ? prev.zeroStreak+1 : 0`; `noBronze = run.seconds < LOSS_SECONDS ? prev.noBronzeStreak+1 : 0`; `active = prev.active || zero >= 2 || noBronze >= 3`.
  - `availableTiers`: `['none', ...START_TIERS tiers other than none whose id is in medals]`. `advanceStartTier(current, runMedals)`: pick the highest tier id among `runMedals` that is a start tier; return it if its seconds exceed `tierSeconds(current)`, else `current`.
  - `HEAD_START_SCORE = { bronze: 44, silver: 147, gold: 304 }` (precomputed with `new SpawnScheduler(mulberry32(1), 720).planUntil(T).length`); `rushesBefore(c) = c < 49 ? 0 : Math.floor((c - 49) / 45) + 1`.

- [ ] **Step 6: Run both test files — GREEN.** Then `npm run typecheck && npm test`.
- [ ] **Step 7: Commit** (explicit paths):
```bash
git add games/dodge-drop/src/workshop.ts games/dodge-drop/src/workshop.test.ts games/dodge-drop/src/progression.ts games/dodge-drop/src/progression.test.ts
git commit -m "feat(dodge-drop): add workshop and progression pure modules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin master
```

---

### Task 2: Pure module `missions.ts`

**Files:**
- Create: `games/dodge-drop/src/missions.ts`, `games/dodge-drop/src/missions.test.ts`.

**Interfaces (Produces):**
```ts
export type MissionId = 'nearMiss' | 'combo' | 'survive' | 'starsTotal' | 'starsRun' | 'shieldBreak' | 'score' | 'rush' | 'runs';
export type Tier = 1 | 2 | 3;
export interface MissionDef { id: MissionId; targets: readonly [number, number, number]; scope: 'run' | 'total' }
export const MISSION_POOL: readonly MissionDef[];           // order as the spec table
export interface RunStats {
  nearMisses: number; maxMultiplier: number; seconds: number; stars: number;
  shieldBlocks: number; score: number; rushes: number; runs: number;
}
export function emptyStats(): RunStats;                      // maxMultiplier starts at 1, rest 0
export interface Mission { id: MissionId; tier: Tier; progress: number }
export interface MissionState { active: Mission[]; stars: number; rank: number; completedCount: number }
export function missionTarget(m: Mission): number;
export function rankFromStars(stars: number): number;        // floor(stars/5) + 1
export function rankMultiplier(rank: number): number;        // min(2, 1 + 0.05(rank-1)), rounded to 2 dp
export function pickTier(rank: number, rng: () => number): Tier;
export function drawMission(exclude: readonly MissionId[], tier: Tier, rng: () => number): Mission;
export function initialMissions(rng: () => number): MissionState;   // 3 distinct tier-1 missions
export function runValue(id: MissionId, stats: RunStats): number;
export function liveProgress(m: Mission, stats: RunStats): number;  // total: progress + value; run: max(progress, value)
export function isComplete(m: Mission, stats: RunStats): boolean;
export function newlyCompleted(state: MissionState, stats: RunStats, seen: ReadonlySet<MissionId>): Mission[];
export interface ApplyResult {
  state: MissionState; completed: Mission[]; replacements: Mission[];
  rankBefore: number; rankAfter: number; starsGained: number;
}
export function applyRun(state: MissionState, stats: RunStats, rng: () => number): ApplyResult;
export function skipCost(m: Mission): number;                // 40 * tier
export function skipMission(
  state: MissionState, index: number, coins: number, rng: () => number,
): { ok: true; state: MissionState; coins: number } | { ok: false; reason: 'poor' | 'index' };
export function sanitizeMissions(raw: unknown, rng: () => number): MissionState;
```
`runValue`: nearMiss -> `nearMisses`; combo -> `maxMultiplier`; survive -> `seconds`; starsTotal and starsRun -> `stars`; shieldBreak -> `shieldBlocks`; score -> `score`; rush -> `rushes`; runs -> `runs`. `applyRun` draws each replacement with `pickTier(rankAfter, rng)` then `drawMission` excluding all remaining active ids plus every just-completed id. `skipMission` keeps the tier, excludes active ids and the skipped id, leaves stars/rank untouched. `sanitizeMissions`: non-object -> `initialMissions(rng)`; keep entries with a known id, integer tier 1..3, finite progress >= 0 (floor), unique ids, at most 3; refill to 3 with `pickTier(rank, rng)`; `stars` and `completedCount` non-negative integers; `rank = rankFromStars(stars)`.

- [ ] **Step 1: Write `missions.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import {
  applyRun, drawMission, emptyStats, initialMissions, isComplete, liveProgress, MISSION_POOL, missionTarget,
  newlyCompleted, pickTier, rankFromStars, rankMultiplier, runValue, sanitizeMissions, skipCost, skipMission,
  type Mission, type MissionState, type RunStats,
} from './missions.ts';

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length]!;
};
const stats = (o: Partial<RunStats> = {}): RunStats => ({ ...emptyStats(), ...o });
const state = (active: Mission[], stars = 0): MissionState => ({ active, stars, rank: rankFromStars(stars), completedCount: 0 });

describe('pool', () => {
  it('has the 9 templates with the spec targets and scopes', () => {
    expect(MISSION_POOL.map((d) => [d.id, ...d.targets, d.scope])).toEqual([
      ['nearMiss', 10, 25, 50, 'total'],
      ['combo', 2, 3, 4, 'run'],
      ['survive', 20, 45, 75, 'run'],
      ['starsTotal', 5, 15, 30, 'total'],
      ['starsRun', 3, 6, 10, 'run'],
      ['shieldBreak', 1, 3, 6, 'total'],
      ['score', 150, 400, 800, 'run'],
      ['rush', 1, 2, 4, 'total'],
      ['runs', 3, 6, 10, 'total'],
    ]);
  });
  it('missionTarget reads the tier column', () => {
    expect(missionTarget({ id: 'survive', tier: 2, progress: 0 })).toBe(45);
  });
});

describe('rank', () => {
  it('every 5 mission stars raise rank by 1, starting at 1', () => {
    expect([0, 4, 5, 14, 15].map(rankFromStars)).toEqual([1, 1, 2, 3, 4]);
  });
  it('multiplier is 1 + 0.05(rank-1), capped at 2.00 (rank 21)', () => {
    expect(rankMultiplier(1)).toBe(1);
    expect(rankMultiplier(3)).toBe(1.1);
    expect(rankMultiplier(8)).toBe(1.35);
    expect(rankMultiplier(21)).toBe(2);
    expect(rankMultiplier(40)).toBe(2);
  });
});

describe('pickTier (rank-weighted)', () => {
  it('rank 1-3: 70/30', () => {
    expect([0.69, 0.7, 0.99].map((r) => pickTier(1, () => r))).toEqual([1, 2, 2]);
    expect(pickTier(3, () => 0.8)).toBe(2);
  });
  it('rank 4-7: 40/45/15', () => {
    expect([0.39, 0.4, 0.84, 0.85].map((r) => pickTier(4, () => r))).toEqual([1, 2, 2, 3]);
    expect(pickTier(7, () => 0.99)).toBe(3);
  });
  it('rank 8+: 20/45/35', () => {
    expect([0.19, 0.2, 0.64, 0.65].map((r) => pickTier(8, () => r))).toEqual([1, 2, 2, 3]);
    expect(pickTier(30, () => 0.5)).toBe(2);
  });
});

describe('drawMission / initialMissions', () => {
  it('never draws an excluded template and starts at progress 0', () => {
    const all = MISSION_POOL.map((d) => d.id);
    const left = all[6]!;
    const m = drawMission(all.filter((id) => id !== left), 2, seq(0.5));
    expect(m).toEqual({ id: left, tier: 2, progress: 0 });
  });
  it('picks uniformly among remaining templates (pool order)', () => {
    expect(drawMission([], 1, () => 0).id).toBe('nearMiss');
    expect(drawMission([], 1, () => 0.9999).id).toBe('runs');
  });
  it('initial state: 3 distinct tier-1 missions, rank 1, no stars', () => {
    const s = initialMissions(seq(0.1, 0.5, 0.9));
    expect(s.active).toHaveLength(3);
    expect(new Set(s.active.map((m) => m.id)).size).toBe(3);
    expect(s.active.every((m) => m.tier === 1 && m.progress === 0)).toBe(true);
    expect([s.stars, s.rank, s.completedCount]).toEqual([0, 1, 0]);
  });
});

describe('progress', () => {
  it('runValue maps each template to a stat', () => {
    const s = stats({ nearMisses: 7, maxMultiplier: 3, seconds: 41, stars: 5, shieldBlocks: 2, score: 333, rushes: 1, runs: 1 });
    const v = (id: Mission['id']) => runValue(id, s);
    expect([v('nearMiss'), v('combo'), v('survive'), v('starsTotal'), v('starsRun'), v('shieldBreak'), v('score'), v('rush'), v('runs')]).toEqual([7, 3, 41, 5, 5, 2, 333, 1, 1]);
  });
  it('total scope adds to saved progress; run scope takes the max', () => {
    expect(liveProgress({ id: 'nearMiss', tier: 1, progress: 4 }, stats({ nearMisses: 3 }))).toBe(7);
    expect(liveProgress({ id: 'score', tier: 1, progress: 100 }, stats({ score: 60 }))).toBe(100);
    expect(liveProgress({ id: 'score', tier: 1, progress: 100 }, stats({ score: 180 }))).toBe(180);
  });
  it('isComplete uses the tier target', () => {
    expect(isComplete({ id: 'nearMiss', tier: 1, progress: 9 }, stats({ nearMisses: 1 }))).toBe(true);
    expect(isComplete({ id: 'nearMiss', tier: 1, progress: 8 }, stats({ nearMisses: 1 }))).toBe(false);
  });
  it('newlyCompleted skips ids already toasted', () => {
    const st = state([{ id: 'combo', tier: 1, progress: 0 }, { id: 'score', tier: 1, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }]);
    const s = stats({ maxMultiplier: 2, score: 200 });
    expect(newlyCompleted(st, s, new Set()).map((m) => m.id)).toEqual(['combo', 'score']);
    expect(newlyCompleted(st, s, new Set(['combo'])).map((m) => m.id)).toEqual(['score']);
  });
});

describe('applyRun', () => {
  const active: Mission[] = [
    { id: 'nearMiss', tier: 1, progress: 4 },
    { id: 'combo', tier: 1, progress: 0 },
    { id: 'survive', tier: 2, progress: 0 },
  ];
  it('completes, awards stars, stores progress for the rest, and replaces', () => {
    const r = applyRun(state(active), stats({ nearMisses: 6, maxMultiplier: 2, seconds: 30 }), seq(0.1, 0.2, 0.3));
    expect(r.completed.map((m) => m.id)).toEqual(['nearMiss', 'combo']);
    expect(r.starsGained).toBe(2);
    expect(r.state.stars).toBe(2);
    expect(r.state.completedCount).toBe(2);
    expect(r.state.active).toHaveLength(3);
    expect(r.state.active.find((m) => m.id === 'survive')).toEqual({ id: 'survive', tier: 2, progress: 30 });
    expect(r.replacements).toHaveLength(2);
    expect(r.replacements.map((m) => m.id)).not.toContain('survive');
    expect(r.replacements.map((m) => m.id)).not.toContain('nearMiss');
    expect(r.replacements.map((m) => m.id)).not.toContain('combo');
    expect(new Set(r.state.active.map((m) => m.id)).size).toBe(3);
    expect(r.rankBefore).toBe(1);
    expect(r.rankAfter).toBe(1);
  });
  it('rank-up when stars cross a multiple of 5; replacement tier uses the new rank', () => {
    const st = state([{ id: 'survive', tier: 2, progress: 0 }, { id: 'combo', tier: 1, progress: 0 }, { id: 'runs', tier: 1, progress: 0 }], 4);
    const r = applyRun(st, stats({ seconds: 50 }), seq(0.5, 0.99));
    expect(r.starsGained).toBe(2);
    expect(r.rankBefore).toBe(1);
    expect(r.rankAfter).toBe(2);
    expect(r.state.rank).toBe(2);
  });
  it('runs mission counts the run', () => {
    const st = state([{ id: 'runs', tier: 1, progress: 2 }, { id: 'combo', tier: 3, progress: 0 }, { id: 'rush', tier: 3, progress: 0 }]);
    const r = applyRun(st, stats({ runs: 1 }), seq(0.5));
    expect(r.completed.map((m) => m.id)).toEqual(['runs']);
  });
  it('is pure: input state is not mutated', () => {
    const st = state(active.map((m) => ({ ...m })));
    applyRun(st, stats({ nearMisses: 99 }), seq(0.5));
    expect(st.active[0]!.progress).toBe(4);
    expect(st.stars).toBe(0);
  });
});

describe('skip', () => {
  const st = state([{ id: 'nearMiss', tier: 2, progress: 3 }, { id: 'combo', tier: 1, progress: 0 }, { id: 'score', tier: 3, progress: 0 }], 7);
  it('costs 40 x stars', () => {
    expect([1, 2, 3].map((tier) => skipCost({ id: 'combo', tier: tier as 1 | 2 | 3, progress: 0 }))).toEqual([40, 80, 120]);
  });
  it('rejects when poor or index invalid', () => {
    expect(skipMission(st, 0, 79, seq(0.5))).toEqual({ ok: false, reason: 'poor' });
    expect(skipMission(st, 5, 999, seq(0.5))).toEqual({ ok: false, reason: 'index' });
  });
  it('replaces with the same tier, never the same template, stars/rank unchanged', () => {
    const r = skipMission(st, 0, 100, seq(0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.coins).toBe(20);
    expect(r.state.active[0]!.tier).toBe(2);
    expect(r.state.active[0]!.progress).toBe(0);
    expect(['nearMiss', 'combo', 'score']).not.toContain(r.state.active[0]!.id);
    expect(r.state.stars).toBe(7);
    expect(r.state.rank).toBe(2);
  });
});

describe('sanitizeMissions', () => {
  it('garbage -> initial state', () => {
    const s = sanitizeMissions('x', seq(0.1, 0.5, 0.9));
    expect(s.active).toHaveLength(3);
    expect(s.active.every((m) => m.tier === 1)).toBe(true);
  });
  it('drops invalid / duplicate entries, clamps, refills to 3, derives rank from stars', () => {
    const raw = {
      active: [
        { id: 'combo', tier: 2, progress: -5 },
        { id: 'combo', tier: 1, progress: 1 },
        { id: 'nope', tier: 1, progress: 0 },
        { id: 'runs', tier: 9, progress: 2 },
      ],
      stars: 12.7, rank: 99, completedCount: -3,
    };
    const s = sanitizeMissions(raw, seq(0.1, 0.5, 0.9));
    expect(s.active).toHaveLength(3);
    expect(s.active[0]).toEqual({ id: 'combo', tier: 2, progress: 0 });
    expect(new Set(s.active.map((m) => m.id)).size).toBe(3);
    expect(s.stars).toBe(12);
    expect(s.rank).toBe(3);
    expect(s.completedCount).toBe(0);
  });
});
```
- [ ] **Step 2: Run `npx vitest run games/dodge-drop/src/missions.test.ts --no-experimental-webstorage` — RED.**
- [ ] **Step 3: Implement `missions.ts`** per the interface notes above (pure, no Phaser import; `rankMultiplier` returns `Math.round(Math.min(2, 1 + 0.05 * (rank - 1)) * 100) / 100`). An `invalid tier` entry in sanitize (e.g. 9) is dropped, not clamped, so the `runs` entry above is dropped and refilled.
- [ ] **Step 4: GREEN; `npm run typecheck && npm test`.**
- [ ] **Step 5: Commit** `feat(dodge-drop): add missions and rank pure module` (explicit paths: the two new files), trailer, push.

---

### Task 3: Difficulty options in `waves.ts`, `fairness.ts`, `schedule.ts`

**Files:**
- Modify: `games/dodge-drop/src/waves.ts`, `games/dodge-drop/src/fairness.ts`, `games/dodge-drop/src/schedule.ts`, and tests `waves.test.ts`, `fairness.test.ts`, `schedule.test.ts`.

**Interfaces:**
```ts
// fairness.ts (Consumes existing; Produces new optional 5th arg)
export interface FieldOptions { speedMul?: number }          // global block speed multiplier, default 1
export function firstDeadEnd(spawns: Scheduled[], width: number, fromT: number, toT: number, opts?: FieldOptions): number | null;
// waves.ts
export function planWave(kind: WaveKind, t: number, rng: () => number, width: number, prevGapX?: number, intervalMul?: number): Plan; // default 1
// schedule.ts
export interface DifficultyOptions { speedMul?: number; intervalMul?: number; startT?: number }
export const START_GRACE = 2.0;
export class SpawnScheduler { constructor(rng: () => number, width: number, validate?: boolean, opts?: DifficultyOptions) }
```
Semantics: `speedMul` scales the integrated fall distance in the validator (`D[k+1] = D[k] + fallSpeed(t) * rush * speedMul * dt`), mirroring PlayScene which multiplies block motion by the same value. `intervalMul` multiplies the rain interval (both `rain` and `rainHeavy`) and the intra-wave `gap` of `stairs` and `zigzag`; walls and breathers are unchanged. `startT > 0` starts planning at `startT + START_GRACE` (so no spawn has `at < startT + 2.0`); `startT` of 0/undefined keeps today's `START = 0.4`. Defaults reproduce existing behavior byte-for-byte.

- [ ] **Step 1: Add failing tests.**

`waves.test.ts` (append inside the file, new `describe`):
```ts
describe('intervalMul', () => {
  it('stretches rain, stairs and zigzag spacing; default is unchanged', () => {
    const mk = () => mulberry32(5);
    const base = planWave('rain', 20, mk(), 720);
    const slow = planWave('rain', 20, mk(), 720, undefined, 1.25);
    expect(slow.spawns.length).toBeLessThan(base.spawns.length);
    expect(planWave('rain', 20, mk(), 720, undefined, 1)).toEqual(base);
    const s0 = planWave('stairs', 30, mk(), 720);
    const s1 = planWave('stairs', 30, mk(), 720, undefined, 1.25);
    expect(s1.spawns[1]!.at).toBeCloseTo(s0.spawns[1]!.at * 1.25, 9);
    expect(s1.duration).toBeGreaterThan(s0.duration);
    const z0 = planWave('zigzag', 50, mk(), 720);
    const z1 = planWave('zigzag', 50, mk(), 720, undefined, 1.25);
    expect(z1.spawns[1]!.at).toBeCloseTo(z0.spawns[1]!.at * 1.25, 9);
  });
});
```
(add `import { mulberry32 } from './rng.ts'` and `planWave` to the file's imports if not present).

`fairness.test.ts` (append):
```ts
describe('firstDeadEnd with speedMul', () => {
  it('speedMul 1 is identical to no option', () => {
    const spawns = [...wall(5, 360), { at: 4.85, x: 360, w: 100, ...B, speedMul: 1 }];
    expect(firstDeadEnd(spawns, W, 0, 20, { speedMul: 1 })).toBe(firstDeadEnd(spawns, W, 0, 20));
  });
  it('still detects an overtaking dead end when everything falls at 0.85x', () => {
    const slowWall = wall(3, 360, 0.6);
    const hits: number[] = [];
    for (let at = 3.5; at < 8; at += 0.05) {
      const fast = { at, x: 360, w: 100, ...B, speedMul: 1.0 };
      if (firstDeadEnd([...slowWall, fast], W, 0, 30, { speedMul: 0.85 }) !== null) hits.push(at);
    }
    expect(hits.length).toBeGreaterThan(0);
  });
  it('blocks arrive later at 0.85x: a block that would hit a lone wall row early is clear later', () => {
    // A block planted in the gap of a wall row spawned together (t=3) seals the row. At 1.0x it reaches the player
    // band at about t=6.3 (inside the 8 s window); at 0.5x it arrives at about t=9.4 (outside the window).
    const spawns = [...wall(3, 360), { at: 3.0, x: 360, w: 100, ...B, speedMul: 1 }];
    expect(firstDeadEnd(spawns, W, 0, 8, { speedMul: 1 })).not.toBeNull();
    expect(firstDeadEnd(spawns, W, 0, 8, { speedMul: 0.5 })).toBeNull();
  });
});
```
`schedule.test.ts` (append):
```ts
const ASSIST = { speedMul: 0.85, intervalMul: 1.25 };

describe('SpawnScheduler difficulty options', () => {
  it('no options behaves exactly like before', () => {
    const a = new SpawnScheduler(mulberry32(3), W).planUntil(60);
    const b = new SpawnScheduler(mulberry32(3), W, true, {}).planUntil(60);
    expect(b).toEqual(a);
  });

  it('intervalMul 1.25 plans fewer spawns than 1.0 over the same window', () => {
    const n1 = new SpawnScheduler(mulberry32(5), W).planUntil(60).length;
    const n2 = new SpawnScheduler(mulberry32(5), W, true, { intervalMul: 1.25 }).planUntil(60).length;
    expect(n2).toBeLessThan(n1);
  });

  it('startT = 60 plans nothing before startT + 2.0 s of grace', () => {
    const all = new SpawnScheduler(mulberry32(9), W, true, { startT: 60 }).planUntil(120);
    expect(all.length).toBeGreaterThan(20);
    expect(Math.min(...all.map((s) => s.at))).toBeGreaterThanOrEqual(62);
  });

  it('assist multipliers keep every field survivable for seeds 1..300 (validator uses the same speedMul)', () => {
    const bad: number[] = [];
    for (const seed of SEEDS) {
      const all = new SpawnScheduler(mulberry32(seed), W, true, ASSIST).planUntil(120);
      if (firstDeadEnd(all, W, 0, 120, { speedMul: ASSIST.speedMul }) !== null) bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('a tier start at 60 s keeps every field survivable for seeds 1..300', () => {
    const bad: number[] = [];
    for (const seed of SEEDS) {
      const all = new SpawnScheduler(mulberry32(seed), W, true, { startT: 60 }).planUntil(150);
      if (firstDeadEnd(all, W, 60, 150) !== null) bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('assist + tier start together stay survivable (seeds 1..100)', () => {
    const bad: number[] = [];
    for (const seed of SEEDS.slice(0, 100)) {
      const all = new SpawnScheduler(mulberry32(seed), W, true, { ...ASSIST, startT: 30 }).planUntil(110);
      if (firstDeadEnd(all, W, 30, 110, { speedMul: ASSIST.speedMul }) !== null) bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 120_000);
});
```
- [ ] **Step 2: Run `npx vitest run games/dodge-drop/src/waves.test.ts games/dodge-drop/src/fairness.test.ts games/dodge-drop/src/schedule.test.ts --no-experimental-webstorage` — new tests RED, old tests GREEN.**
- [ ] **Step 3: Implement.**
  - `waves.ts`: add trailing `intervalMul = 1` param to `planWave`; `rain(t, rng, width, intervalMul)` where the existing `1` / `0.6` constants become `0.6 * intervalMul` for heavy, `1 * intervalMul` for rain; `stairs(rng, width, intervalMul)` and `zigzag(...)` multiply their `gap`; `wall` unchanged.
  - `fairness.ts`: `const sm = opts?.speedMul ?? 1;` and `D[k + 1] = D[k]! + fallSpeed(t) * (isRush(t) ? 1.4 : 1) * sm * DT;`.
  - `schedule.ts`: store `opts`; `planEnd = (opts.startT ?? 0) > 0 ? opts.startT + START_GRACE : START`; `planOne` passes `this.opts.intervalMul ?? 1` to `planWave`; `prune`'s `firstDeadEnd` call passes `{ speedMul: this.opts.speedMul ?? 1 }`. Fresh spawn `at` values are absolute clock times (already `this.planEnd + sp.at`).
  - If a seed fails the 300-seed property for startT = 60 or assist, debug `prune` (history window, `fromT` clamp) — do not weaken the test.
- [ ] **Step 4: GREEN for these three files and `npm run typecheck && npm test`** (the full suite includes the original 300-seed schedule property test; it must stay green).
- [ ] **Step 5: Commit** `feat(dodge-drop): scheduler and validator accept speed/interval multipliers and a start clock` with the modified files + tests, trailer, push.

---

### Task 4: PlayScene integration

**Files:**
- Create: `games/dodge-drop/src/runSetup.ts`, `games/dodge-drop/src/runSetup.test.ts`.
- Modify: `games/dodge-drop/src/combo.ts` (+ `combo.test.ts`), `games/dodge-drop/src/runState.ts`, `games/dodge-drop/src/PlayScene.ts`, `games/dodge-drop/src/playArt.ts` (2-band ring texture `dd-ring2`), `games/dodge-drop/src/strings.ts` (play strings only; the rest in Task 6).
- Modify: `e2e/dodge-drop.spec.ts` (only if the existing play test needs adjustment; new e2e lands in Task 6).

**Interfaces (Produces):**
```ts
// combo.ts (backwards compatible defaults)
export function isNearMiss(gap: number, windowPx?: number): boolean;   // default NEAR_MISS_PX (28)
export class Combo { constructor(timeout?: number); readonly timeout: number; /* tick uses this.timeout */ }

// runState.ts
export interface RunState {
  score: number;          // includes head start (counts for best)
  seconds: number;        // REAL seconds survived: floor(t - startT)
  stars: number;
  medals: MedalId[];      // medals earned this run (clock-based, below-T medals excluded)
  headStart: number;
  startTier: StartTier;
  stats: RunStats;        // stats.score already excludes headStart; stats.runs = 1
}

// runSetup.ts
export interface RunConfig {
  tier: StartTier; startT: number; grace: number; headStart: number;
  assisted: boolean; speedMul: number; intervalMul: number;
  shieldLevel: number; shieldCapacity: 1 | 2; startShieldHits: number;   // 0..capacity
  firstShieldAt: number;  // absolute clock: startT + shieldFirstAt(L)
  magnetRadius: number; nearMissWindow: number; comboTimeout: number; luckLevel: number;
  rushIdx: number;        // rushesBefore(startT)
}
export function buildRunConfig(i: { workshop: Workshop; assist: AssistState; tier: StartTier; rng: () => number }): RunConfig;
export const MAGNET_SPEED = 900;
export const GRACE_SECONDS = 2.0;
```
Consumes: Tasks 1–3 (`workshop.ts`, `progression.ts`, `missions.ts` `RunStats/emptyStats/newlyCompleted/sanitizeMissions`, `SpawnScheduler` options).

- [ ] **Step 1: Failing tests.** `combo.test.ts` additions: `new Combo(3.25)` times out at 3.25 s not 2.5 (tick 2.6 s keeps count, tick another 0.7 s resets and returns true); `isNearMiss(30, 32)` true, `isNearMiss(30)` false, `isNearMiss(0, 32)` false. `runSetup.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildRunConfig } from './runSetup.ts';
import { DEFAULT_ASSIST } from './progression.ts';
import { emptyWorkshop } from './workshop.ts';

const ws = (o: Partial<ReturnType<typeof emptyWorkshop>> = {}) => ({ ...emptyWorkshop(), ...o });
const base = { workshop: ws(), assist: DEFAULT_ASSIST, tier: 'none' as const, rng: () => 0.5 };

describe('buildRunConfig', () => {
  it('defaults: clock 0, no grace, no multipliers, no start shield', () => {
    expect(buildRunConfig(base)).toMatchObject({
      tier: 'none', startT: 0, grace: 0, headStart: 0, assisted: false, speedMul: 1, intervalMul: 1,
      shieldLevel: 0, shieldCapacity: 1, startShieldHits: 0, firstShieldAt: 25, magnetRadius: 0,
      nearMissWindow: 28, comboTimeout: 2.5, luckLevel: 0, rushIdx: 0,
    });
  });
  it('silver start: clock 60, 2 s grace, head start 147, shield timing relative to start, rush index 1', () => {
    const c = buildRunConfig({ ...base, tier: 'silver', workshop: ws({ shield: 2 }) });
    expect(c).toMatchObject({ startT: 60, grace: 2, headStart: 147, firstShieldAt: 60 + 19, rushIdx: 1 });
  });
  it('workshop levels feed the getters; L5 shield holds 2 hits', () => {
    const c = buildRunConfig({ ...base, workshop: ws({ shield: 5, magnet: 3, nearMiss: 4, combo: 2, luck: 1 }) });
    expect(c).toMatchObject({ shieldCapacity: 2, magnetRadius: 100, nearMissWindow: 37, luckLevel: 1 });
    expect(c.comboTimeout).toBeCloseTo(2.8, 9);
    expect(c.firstShieldAt).toBe(10);
  });
  it('start shield is a chance roll against the rng; L5 shield start grants full capacity', () => {
    const lv2 = ws({ startShield: 2 }); // 40 %
    expect(buildRunConfig({ ...base, workshop: lv2, rng: () => 0.39 }).startShieldHits).toBe(1);
    expect(buildRunConfig({ ...base, workshop: lv2, rng: () => 0.4 }).startShieldHits).toBe(0);
    expect(buildRunConfig({ ...base, workshop: ws({ startShield: 5, shield: 5 }), rng: () => 0.99 }).startShieldHits).toBe(2);
  });
  it('assist: shield held at start (no stacking), 0.85x speed, 1.25x interval', () => {
    const c = buildRunConfig({ ...base, assist: { ...DEFAULT_ASSIST, active: true }, workshop: ws({ startShield: 5 }) });
    expect(c).toMatchObject({ assisted: true, speedMul: 0.85, intervalMul: 1.25, startShieldHits: 1 });
  });
});
```
Run: RED.
- [ ] **Step 2: Implement `combo.ts` changes, `runState.ts`, `runSetup.ts`.** `buildRunConfig`: `startT = tierSeconds(tier)`, `grace = startT > 0 ? 2 : 0`, `headStart = headStartScore(tier)`; start shield hits = `assisted || rng() < startShieldChance(L) ? shieldCapacity(L) : 0` (assist forces exactly `shieldCapacity(L)`; test above expects 1 at L0). Roll `rng()` only when not assisted and L > 0. Tests GREEN.
- [ ] **Step 3: PlayScene behavior (no new unit tests; verified by Steps 4–5).** Make these changes, keeping existing structure:
  1. **Profile load.** In `create()` replace the single `getJSON('skin')` with `Promise.all([skin, workshop, assist, startTier, medals, missions])`, all through `kit.save` and sanitizers (`sanitizeWorkshop`, `sanitizeAssist`, `sanitizeStartTier(raw, mergeMedals(medals, []))`, `sanitizeMissions(raw, this.rng)`). Then `cfg = buildRunConfig({ workshop, assist, tier, rng: this.rng })`, store `this.cfg`, `this.missionState`, then `buildPlayer(); ready = true;` as today. Scheduler is built in this callback: `new SpawnScheduler(this.rng, W, true, { speedMul: cfg.speedMul, intervalMul: cfg.intervalMul, startT: cfg.startT })` (move construction out of the synchronous part of `create`).
  2. **Clock start.** `this.t = cfg.startT`; `this.runStartT = cfg.startT`; `this.score = cfg.headStart`; `this.rushIdx = cfg.rushIdx`; `this.nextShield = cfg.firstShieldAt`; `this.nextStar = cfg.startT + starInterval(cfg.luckLevel, rng())`; `this.shieldHits = cfg.startShieldHits`. `medalsReached(prev, now)` already ignores medals at or below the start clock (prev = T >= threshold), so nothing is re-awarded. `layersFor`, waves, rush, `fallSpeed` all use `this.t` unchanged.
  3. **Grace + banner.** While `t < cfg.startT + GRACE_SECONDS` and `cfg.grace > 0`, show a banner text `kit.t('tierStart.<tier>')` (`Bronze start` etc.) centered at y 330 using the rush banner style, hidden after grace; the scheduler's `START_GRACE` guarantees no spawns. Start the shield-ring/HUD normally.
  4. **Shield.** Replace `shieldHeld: boolean` with `shieldHits: number` and `get shieldHeld() { return this.shieldHits > 0 }`. Collect shield: `shieldHits = cfg.shieldCapacity`. Pickup spawn gate: `this.shieldHits < cfg.shieldCapacity`. Next spawn: `nextShield = t + shieldInterval(cfg.shieldLevel, rng())`. `onHit` with `shieldHits > 0`: `shieldHits -= 1`, `stats.shieldBlocks += 1`, same effects as today; ring stays visible if hits remain. Ring: add texture `dd-ring2` (same ring plus a second concentric band, generated in `playArt.ts` like `dd-ring`); show `dd-ring2` when `shieldHits === 2`, `dd-ring` when 1. Burst/hitstop as today.
  5. **Magnet.** In `updatePickups` for `kind === 'star'` when not dead and `cfg.magnetRadius > 0`: `d = hypot(p.x - px, p.y - PLAYER_Y)`; if `d <= radius` move toward the player at `MAGNET_SPEED * dt` along the vector (set both `p.x`, `p.y`; keep the existing fall step when outside the radius).
  6. **Near-miss / combo.** `this.combo = new Combo(cfg.comboTimeout)`; `isNearMiss(gap, cfg.nearMissWindow)`; combo HUD bar fraction uses `this.combo.timeout`. On near miss: `stats.nearMisses++`; `stats.maxMultiplier = max(stats.maxMultiplier, combo.multiplier)`. Revive resets combo with the same timeout (`new Combo` not needed, `reset()` as today).
  7. **Luck.** Every star re-arm uses `starInterval(cfg.luckLevel, this.rng())`; the retry-after-failed-spawn `+0.4` stays.
  8. **Assist speed.** In `updateBlocks`: `b.y += base * b.speedMul * cfg.speedMul * dt`; `spawnBlock` late-offset multiplies by `cfg.speedMul` too.
  9. **Stats.** `this.stats: RunStats = emptyStats()` reset in `create`. Updates: `collect` star -> `stats.stars++`; every frame `stats.seconds = floor(t - runStartT)` and `stats.score = score - cfg.headStart` (in `updateHud` throttle or `update`); rushes: in `updateRush` when `this.t >= next + 4` increments `rushIdx`, also `stats.rushes++` (only if the rush start `next >= runStartT`, i.e. the player saw it); do not decrement on revive.
  10. **Mission toast.** Every 0.25 s of run time call `newlyCompleted(this.missionState, this.stats, this.toasted)`; for each result add id to `toasted` and call `showMissionToast()` — a pill like `showMedalToast` (reuse its builder with accent colour, text `kit.t('missionComplete')`, slides in at y 250, auto-hides after 1.5 s, `kit.audio.sfx('medal')`). Queue so two toasts never overlap (delay the second by 1.6 s).
  11. **Death.** `die()` writes the extended `RunState`: `{ score, seconds: floor(t - runStartT), stars, medals, headStart: cfg.headStart, startTier: cfg.tier, stats: { ...stats, runs: 1 } }`. `kit.gameOver(this.score, ...)` is unchanged (the head start counts for `best`).
  12. **Test hook.** Extend `window.__dd.stats()` with `clock: this.t`, `startTier: cfg.tier`, `shieldHits`, `headStart: cfg.headStart`, `assisted: cfg.assisted` (keep every existing field and meaning). `stats()` must return safe defaults before the profile load resolves (`cfg` initialised to `buildRunConfig` defaults in `create`).
- [ ] **Step 4: Verify.** `npm run typecheck && npm test`; then `npm run test:smoke` (existing e2e play test must pass unchanged). Add a throwaway Playwright probe (not committed) or manual run: seed `localStorage` `gk:dodge-drop:medals = ["bronze","silver"]` and `gk:dodge-drop:startTier = "silver"`, start a run, confirm `__dd.stats().t` is between 60 and 63, `startTier === 'silver'`, `score >= 147`, and no `pageerror`.
- [ ] **Step 5: Commit** `feat(dodge-drop): apply workshop effects, assist and tier starts in play` (list every touched path explicitly), trailer, push.

---

### Task 5: Results screen

**Files:**
- Create: `games/dodge-drop/src/settle.ts`, `games/dodge-drop/src/settle.test.ts`.
- Modify: `games/dodge-drop/src/results.ts`, `games/dodge-drop/src/strings.ts` (results strings: `coinsMin`, `coinsMult`, `goalMore`, `goalReady`, `missionDone`, `rankUp`, `mission.<id>` templates; these are shared with Task 6, add all en + zh-TW mission template strings here).

**Interfaces (Produces):**
```ts
// settle.ts — pure, called once by results.ts
export interface Saved {
  coins: number; lossStreak: number; assist: AssistState; startTier: StartTier;
  medals: string[];           // medals saved BEFORE merging this run (results merges)
  missions: MissionState; workshop: Workshop; ownedSkins: string[];
}
export interface Goal { kind: 'workshop' | 'skin'; id: string; level: number; cost: number }  // level 0 for skins
export function nearGoal(workshop: Workshop, ownedSkins: readonly string[]): Goal | null;
export interface Settled {
  coin: CoinResult;
  coinsAfter: number;                // saved.coins + coin.coins
  lossStreak: number; assist: AssistState; startTier: StartTier; medals: string[];   // merged
  missions: ApplyResult;
  goal: Goal | null;                 // computed against post-run balance
  goalFrom: number; goalTo: number;  // balances for the bar: saved.coins -> coinsAfter
}
export function settleRun(run: RunState, saved: Saved, rng: () => number): Settled;
```
`nearGoal`: candidates = every non-maxed workshop row `{kind:'workshop', id, level: lvl+1, cost: nextCost(lvl)}`; if none, every locked skin `{kind:'skin', id, level:0, cost}`; return the cheapest (ties: earlier in list order); `null` when nothing left. `settleRun`: `lossStreak = nextLossStreak(saved.lossStreak, run.seconds)`; `rankMultiplier(saved.missions.rank)` is the multiplier in force for this run's coins (rank before the missions of this run apply); `coin = runCoins({score: run.score, headStart: run.headStart, stars: run.stars, lossStreak, rankMultiplier})`; `medals = mergeMedals(saved.medals, run.medals)`; `assist = updateAssist(saved.assist, {score: run.score - run.headStart, seconds: run.seconds, bronzeOwned: medals.includes('bronze')})`; `startTier = advanceStartTier(saved.startTier, run.medals)`; `missions = applyRun(saved.missions, run.stats, rng)`.

- [ ] **Step 1: Write `settle.test.ts`** covering: `nearGoal` (fresh workshop -> first cheapest = `shield` level 1 cost 15 [ties by row order]; one row at level 2 and the rest 0 -> still a cost-15 row with the lowest-index zero-level id; all maxed + owned only `cyan` -> `lime` cost 30; all maxed + all skins -> `null`); `settleRun`: (a) first run, 15 s, score 100, 3 stars, empty saved -> `lossStreak 1`, `coin` floor 2 vs base 7 -> `coin.coins 7`, `coinsAfter` = saved.coins + 7, `assist.active false`; (b) 2nd consecutive zero-score run -> `assist.active true`, floor applied `coin.coins 4` (lossStreak 2, base 0); (c) a Bronze run (`medals: ['bronze']`, seconds 31) -> `lossStreak 0`, `assist.retired true`, `startTier 'bronze'`, merged medals include saved; (d) tier-start silver run with `headStart 147`, `score 160` -> coin base uses 13, `startTier` stays `silver`, assist ignored (bronze owned); (e) mission completion flows through (`missions.completed`), and the coin multiplier uses the rank BEFORE the run (state with stars 4 + completing mission worth 2 -> multiplier still 1); (f) `goalFrom/goalTo`. Run: RED.
- [ ] **Step 2: Implement `settle.ts`.** GREEN.
- [ ] **Step 3: Rewrite `results.ts`** to use `settleRun`. Flow: on hook call, show immediately (synchronously) what needs no storage (survived time, medal slots from `run.medals`), then `Promise.all` loads `Saved` from `kit.save` (`coins`, `lossStreak`, `assist`, `startTier`, `medals`, `missions`, `workshop`, `skins`) with sanitizers and when resolved (guard `scene.sys.isActive()`): call `settleRun(run, saved, Math.random)`, **persist in one serialized chain** (`coins`, `lossStreak`, `assist`, `startTier`, `missions`; `medals` already saved by PlayScene), then render: coin line with breakdown, near-goal bar, missions block, rank-up burst. Keep the `credit(n)` serialization and rewarded x2: on x2 reward `credit(coin.coins)` and update text to `coin.coins * 2`, and the goal bar target `goalTo` becomes `goalTo + coin.coins` (re-render text; no re-tween needed). Layout budget (offsets from `ctx.top`, canvas 720 x 1280, retry hint stays at 0.82H and Home at 0.91H, so everything must end by about y 1030): coin text 52 px at x = cx − 100 (+28); x2 button (width 200, height 64) on the same row at x = cx + 200; breakdown 24 px (+66, only when `floorApplied` or `multiplier > 1`: `+8 coins (min 8)` / `+12 coins (×1.10)` via `coinsMin` / `coinsMult`); survived 30 px (+100); medal slots radius 22 at (+150) spaced 100 px; medal names 24 px (+190); goal text 28 px (+228) and bar 440 x 14 (+256); three mission rows 26 px at +296 / +326 / +356 each `<name> n/N`, completed rows show a check and `+<tier>★` with a 0.3 s scale-in; replaced missions shown dimmed as the new row text; rank-up: text `Rank <n>!` (`rankUp`) 40 px at +396 with `kit.fx(scene).burst` and `kit.audio.sfx('medal')` only when `rankAfter > rankBefore`. Adjust offsets after a screenshot if anything collides; do not move `ctx.top`.
  Goal bar behavior: `Shield Core Lv2 — 7 more coins` (`goalMore`) with fill tweened 0.6 s from `goalFrom / cost` to `min(1, goalTo / cost)`; when `goalTo >= cost`: `... — ready!` (`goalReady`) with a pulsing accent tween (alpha/scale yoyo, repeat -1); hide everything when `goal === null`.
- [ ] **Step 4: Test hook (test builds only).** In `ddResults`, `if (__GK_TEST_HOOKS__)` set `window.__dd.results = { coins: coin.coins, goal, missions: settled.missions.state.active, completed: settled.missions.completed.map(m => m.id), lossStreak, assist, startTier }` (read by e2e in Task 6). `window.__dd` already exists from `PlayScene.create`; create it defensively if absent.
- [ ] **Step 5: Verify.** `npm run typecheck && npm test && npm run test:smoke`. Manual probe (or throwaway Playwright script): finish a run with `endRound` and screenshot the overlay at 720 x 1280 to confirm nothing overlaps the retry hint.
- [ ] **Step 6: Commit** `feat(dodge-drop): results show coin breakdown, near-goal bar and missions` (explicit paths), trailer, push.

---

### Task 6: Title extras, WorkshopScene, strings, version, e2e

**Files:**
- game-kit (generic hook): Create `packages/game-kit/src/titleLayout.ts`, `packages/game-kit/src/titleLayout.test.ts`. Modify `packages/game-kit/src/defineGame.ts`, `packages/game-kit/src/scenes/TitleScene.ts`, `packages/game-kit/src/index.ts`.
- dodge-drop: Create `games/dodge-drop/src/WorkshopScene.ts`, `games/dodge-drop/src/titleExtras.ts`. Modify `games/dodge-drop/src/main.ts`, `games/dodge-drop/src/strings.ts`, `games/dodge-drop/game.json` (`"version": "2.1.0"`), `e2e/dodge-drop.spec.ts`.
- Optional: update `docs/plans/` status line and, if tracked, `docs/STATUS.md` at wrap-up.

**Does the title need a new game-kit hook? Yes, one.** `TitleScene` only renders a fixed layout plus `titleMenu` buttons (each `kit.goTo(scene)`) and a `titleBackdrop` that is decorative and runs before the text. The missions list (with skip buttons) and the start-tier chips need to draw interactive content and call game save logic, so add one generic optional hook, game-agnostic, no branching on platform or game id.

**Interfaces (Produces):**
```ts
// packages/game-kit/src/titleLayout.ts (pure, tested)
export interface TitleExtrasContext { width: number; height: number; below: number; menuTop: number; menuBottom: number }
export function titleLayout(width: number, height: number, menuCount: number): TitleExtrasContext;
// below     = height * 0.62 + 36        (just under the best-score line; 830 at 1280)
// menuTop   = height * 0.72 - 36        (top edge of the first menu button; 886)
// menuBottom= height * 0.72 + (menuCount - 1) * 96 + 36   (1054 for 2 buttons)
// defineGame.ts
export interface GameDefinition { /* ... */ titleExtras?: (scene: Phaser.Scene, ctx: TitleExtrasContext) => void }
```
TitleScene calls `kit.def.titleExtras?.(this, titleLayout(width, height, menu.length))` after the menu buttons are created and before the pointer handlers are wired. Extras must create their buttons with `addButton` (it sets the flag read by `consumeButtonTap`) so tapping a chip or skip never starts the game. `index.ts` exports `TitleExtrasContext`.

- [ ] **Step 1: game-kit failing test.** `titleLayout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { titleLayout } from './titleLayout.ts';

describe('titleLayout', () => {
  it('derives bands from the canvas height and menu size', () => {
    const l = titleLayout(720, 1280, 2);
    expect(l.below).toBeCloseTo(830.4, 1);
    expect(l.menuTop).toBeCloseTo(885.6, 1);
    expect(l.menuBottom).toBeCloseTo(1053.6, 1);
    expect(l.width).toBe(720);
  });
  it('menuBottom grows by 96 px per extra button', () => {
    expect(titleLayout(720, 1280, 3).menuBottom - titleLayout(720, 1280, 2).menuBottom).toBeCloseTo(96, 6);
  });
  it('with no menu items menuBottom sits just above menuTop', () => {
    const l = titleLayout(720, 1280, 0);
    expect(l.menuBottom).toBeLessThanOrEqual(l.menuTop);
  });
});
```
Run RED; implement (`menuCount <= 0` -> `menuBottom = menuTop`); GREEN. Wire `defineGame.ts` + `TitleScene.ts` + `index.ts`. `npm run typecheck && npm test` (includes `scripts/rules.test.ts`). **Commit 1:** `feat(game-kit): add optional titleExtras hook for custom title content` (paths: the five game-kit files), trailer, push.

- [ ] **Step 2: Strings (`strings.ts`, en + zh-TW).** Add keys (templates use `{n}` / `{v}` replaced with `String.replace`): `upgrades` (`Upgrades` / `升級`), `balance` (`Coins` / `金幣`), `maxed` (`MAX` / `已滿`), `up.<id>.name` and `up.<id>.desc` for the six ids (names from the spec table; descs e.g. shield `First shield at {v} s` / `第一個護盾於 {v} 秒`, startShield `{v}% start with a shield` / `{v}% 機率開局帶護盾`, magnet `Pulls stars within {v} px` / `吸引 {v} 像素內的星星`, nearMiss `Near-miss window {v} px` / `擦邊範圍 {v} 像素`, combo `Combo lasts {v} s` / `連擊持續 {v} 秒`, luck `Stars {v}% more often` / `星星多出現 {v}%`; shield L5 adds ` · blocks 2 hits` / `・可擋 2 次`), `startFrom` (`Start` / `起跑`), `tier.none` (`0:00`), `tier.bronze|silver|gold` (reuse `medal.*`), `tierStart.bronze|silver|gold` (`Bronze start` / `銅盃起跑`, `Silver start` / `銀盃起跑`, `Gold start` / `金盃起跑`), `missionComplete` (`Mission complete!` / `任務完成！`), `skip` (`Skip` / `略過`), `missionsTitle` (`Missions` / `任務`), `rank` (`Rank {n}` / `等級 {n}`), `mission.<id>` for the nine templates (e.g. `Near-miss {n} times` / `擦邊 {n} 次`, `Reach combo ×{n}` / `連擊達 ×{n}`, `Survive {n} s` / `存活 {n} 秒`, `Collect {n} stars` / `收集 {n} 顆星星`, `Collect {n} stars in one run` / `單局收集 {n} 顆星星`, `Block {n} hits with shields` / `用護盾擋下 {n} 次撞擊`, `Score {n} points in one run` / `單局得 {n} 分`, `Survive {n} rushes` / `撐過 {n} 次加速`, `Play {n} runs` / `遊玩 {n} 局`), plus the Task-5 results keys if not yet added. (Task 5 should already have added its own; do not duplicate keys.) Add a unit test `strings.test.ts` asserting `Object.keys(strings.en)` equals `Object.keys(strings['zh-TW'])`.
- [ ] **Step 3: `WorkshopScene.ts`** (`super('Workshop')`, registered in `main.ts` `scenes: [SkinsScene, WorkshopScene]`; `titleMenu: [{labelKey:'skins',scene:'Skins'},{labelKey:'upgrades',scene:'Workshop'}]` — Skins stays first so its existing e2e tap at y = 0.72H keeps working; Upgrades is at 0.72H + 96 = 1017.6). Layout constants (canvas 720 x 1280): title `upgrades` at (400, 80), Back button (120, 80) 180 x 72 as in `SkinsScene`; balance line `balance: <coins>` centered at y 170 (32 px, accent); six rows with centers `y = 270 + i * 150` (i = 0..5), each: a 96 x 96 icon drawn with Graphics at x = 80 (simple per-id glyph: ring, ring2, magnet U, spark, bar, star), name (30 px) at x = 150 / y − 28, effect text (`up.<id>.desc` with `{v}` = `effectValue(id, level)`, 22 px, muted) at x = 150 / y + 4, pips `●●○○○` (Graphics circles r 9, spacing 26, accent filled) at x = 150 / y + 38, cost button (addButton width 170, height 80) at x = 600 showing the next cost, dimmed (muted fill, no-op) when `coins < cost`, `MAX` label and no handler when level is 5. On tap: `buyUpgrade({coins, levels}, id)`; on `ok` persist `coins` (`setNumber`) then `workshop` (`setJSON`), play `kit.audio.sfx('pickup')`, `fx.burst` at the row, re-render; serialize writes with a promise chain so rapid taps never lose coins. Load via `Promise.all([coins, workshop])` + sanitizers; guard `scene.sys.isActive()`.
- [ ] **Step 4: `titleExtras.ts`** exporting `ddTitleExtras(scene, ctx)` wired in `main.ts` as `titleExtras: ddTitleExtras`. It loads `medals`, `startTier`, `missions`, `coins`, and renders:
  - **Start chips** at `y = ctx.below + 28` (858): four `addButton`s width 150, height 44, fontSize 22, x = `width/2 + (i − 1.5) * 162` (117 / 279 / 441 / 603), labels `tier.none | medal.bronze | medal.silver | medal.gold`. Enabled only for `availableTiers(medals)`; the selected chip uses `theme.accent` fill with dark text, other enabled chips `theme.primary`, locked chips `theme.muted` at alpha 0.4 with no-op handler. Tap: persist `startTier` via `setJSON`, re-render chips (selection persists and auto-advances per Task 5). Selection loaded through `sanitizeStartTier`. Caption `startFrom` is omitted if there is no room.
  - **Missions block** from `y = ctx.menuBottom + 12` (1066): header omitted (compact), three rows of height 52 (row center `y0 + 26 + i * 52`), each: tier stars `★` x `tier` (left, x = 30, accent), name via `mission.<id>` template with `{n}` = `missionTarget`, and `progress/target` right-aligned at x = 520 (muted, 22 px), plus a skip `addButton` (width 140, height 40, fontSize 20, x = 640) labelled `skip` + cost (e.g. `Skip 40`), muted fill when `coins < cost`. Tap: `skipMission(state, i, coins, Math.random)`; on ok persist `missions` and `coins`, re-render. A small `rank` line (`Rank n`, 22 px, muted) is drawn at (width − 24, ctx.menuBottom − 4)... only if it does not overlap the menu; otherwise omit.
  - Use a single container re-created on each render (`destroy` the old one) so repeated taps are safe, and a `rendering` guard so overlapping async loads never double-draw. Verify visually with a screenshot at 720 x 1280; adjust y offsets by a few pixels if something touches a menu button, then update the e2e coordinates below to match.
- [ ] **Step 5: `game.json`** `version` -> `2.1.0` (leave `releases` as is). If `scripts/*.test.ts` or `docs` pin the version, update them with the change.
- [ ] **Step 6: e2e (`e2e/dodge-drop.spec.ts`).** Helper `seed(page, kv)` using `page.addInitScript` to set `localStorage['gk:dodge-drop:<key>']` (numbers as plain strings, JSON values as JSON strings). Helper `at(gx, gy)` converting game coordinates to page coordinates (as in the existing Skins test). Read-back helper `ls(page, key)`. Add four tests (each asserts `errors` is empty like the existing tests):
  1. **Workshop buy:** seed `coins = '100'`; open title; click Upgrades at `at(360, 1018)`; wait `activeScenes` includes `Workshop`; click the first row's cost button at `at(600, 270)`; poll until `ls('workshop')` parses to `shield: 1` and `ls('coins') === '85'`; click Back `at(120, 80)`; wait for `GKTitle`.
  2. **Results near-goal + mission row:** seed `coins = '10'`, `missions = {"active":[{"id":"score","tier":1,"progress":0},{"id":"combo","tier":1,"progress":0},{"id":"runs","tier":1,"progress":0}],"stars":0,"rank":1,"completedCount":0}`; start a run by clicking the canvas center; `endRound(5)`; wait for `GKGameOver`; wait for `window.__dd.results` to be set; assert `results.goal` equals `{kind:'workshop', id:'shield', level:1, cost:15}` (coins 10 + earned >= 10 floor? lossStreak 1 -> floor 2; coins may be 10 or 12, so assert `goal.cost === 15` and `results.missions` length 3 with ids `['score','combo','runs']`).
  3. **Tier start clock:** seed `medals = '["bronze","silver"]'` and `startTier = '"silver"'`; start a run; wait `__dd.stats().startTier === 'silver'`; assert `60 <= stats.t < 63` and `stats.score >= 147`.
  4. **Chips and skip:** seed `medals = '["bronze"]'`, `coins = '100'`, `missions` as above; on the title click the Bronze chip `at(279, 858)` and poll `ls('startTier') === '"bronze"'`; click the first mission's skip `at(640, 1092)` and poll `ls('coins') === '60'` (tier 1 costs 40) and the saved `missions.active[0].id` differs from `score`.
  If tuned layout coordinates differ from the numbers above, update the spec with the final values and keep a comment next to each constant naming the layout source.
- [ ] **Step 7: Full verification.** `npm run typecheck && npm test && npm run test:smoke` (the last runs `build:local` and Playwright for smoke, results, dodge-drop). All green. Then `npm run build:site` and confirm `dist-site/dodge-drop/` is still <= 2 MB (`du -sk`). Manual pass (screenshots at 720 x 1280): title with chips and missions, Workshop with a mix of levels, results with floor breakdown, assist active (seed `assist = {"zeroStreak":0,"noBronzeStreak":0,"active":true,"retired":false}` and confirm slower blocks and a shield at start).
- [ ] **Step 8: Commit 2:** `feat(dodge-drop): add Workshop, title missions and start-tier chips, release 2.1.0` (explicit paths: `games/dodge-drop/src/WorkshopScene.ts`, `titleExtras.ts`, `main.ts`, `strings.ts`, `strings.test.ts`, `games/dodge-drop/game.json`, `e2e/dodge-drop.spec.ts`), trailer, push. Update this plan's **Status** line (commit range, verification summary, site-only reminder) and, if `docs/STATUS.md` is tracked, its dodge-drop entry; commit those docs separately with explicit paths (`docs(plan): mark dodge-drop meta-progression complete`).

---

## Final verification checklist (run by a fresh agent, not the implementer)

- [ ] Every spec section maps to a merged task (coverage map above).
- [ ] `npm run typecheck`, `npm test`, `npm run test:smoke` pass; paste actual output.
- [ ] `grep -rn "platform.id\|dodge-drop" packages/game-kit/src` shows no new branching on game or platform id.
- [ ] `games/dodge-drop/game.json` is `2.1.0`, `releases` untouched; no portal build artifacts added.
- [ ] `git status` shows `workspace-pixel-squad/run_aoa_tests.sh` still unstaged and unmodified by the work.
