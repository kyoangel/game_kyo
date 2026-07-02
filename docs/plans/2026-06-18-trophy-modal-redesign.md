# Trophy Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the trophy modal to a compact progress-card layout and update the trophy data model to 67 trophies across 6 categories with maxCombo/maxNum tracking and beyond-diamond display for play count and total score.

**Architecture:** Three-task TDD sequence — (1) rewrite unit tests for the new 67-trophy system (RED), (2) rewrite `trophies.ts` with new `GameStats`, 67 defs, and `loadModalData()` (GREEN), (3) rewrite `renderTrophyModal()` in `game.ts`, replace CSS in `index.html`, and update E2E tests. The spec is committed at `docs/superpowers/specs/2026-06-18-trophy-modal-redesign-design.md`.

**Tech Stack:** TypeScript, Vitest (unit tests), Playwright (E2E tests), vanilla DOM APIs

---

## File Map

| File | Change |
|------|--------|
| `workspace/tests/unit/trophies.test.ts` | Full replacement — new counts, thresholds, loadModalData tests |
| `workspace/src/trophies.ts` | Full replacement — new GameStats, 67 defs, loadModalData() |
| `workspace/src/game.ts` | Update import line 29 + replace renderTrophyModal() |
| `workspace/index.html` | Replace old trophy CSS block (lines ~392–433) with new progress-card CSS |
| `workspace/tests/e2e/ux-v2.spec.ts` | Update 4 trophy E2E tests |

**Test commands:**
- Unit: `cd workspace && npm run test:unit`
- E2E:  `cd workspace && npm run test:e2e`

---

## Task 1: Rewrite unit tests (RED)

**Files:**
- Modify: `workspace/tests/unit/trophies.test.ts` (full replacement)

**What changes:** 76→67 trophies, 5→6 categories, thresholds 3/4/5/6→6/10/14/16 for numbers, combo system replaced with maxCombo (IDs `combo_bronze/silver/gold/diamond`, thresholds 2/3/5/8), new `score_total_*` cumulative trophies, `loadModalData()` tested for section structure and beyondDiamond flag.

- [ ] **Step 1: Replace the entire test file**

Write `workspace/tests/unit/trophies.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { checkTrophies, loadTrophyStatuses, getTrophyDef, loadModalData } from "../../src/trophies";

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
}
const localStorageMock = makeLocalStorageMock();

const EMPTY_GRID = Array.from({ length: 4 }, () => Array(4).fill(null)) as (number | null)[][];
const ONE_TILE_GRID: (number | null)[][] = [
  [1, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
];

describe("trophies", () => {
  beforeAll(() => { vi.stubGlobal("localStorage", localStorageMock); });
  afterAll(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { localStorage.clear(); });

  // ── loadTrophyStatuses ────────────────────────────────────────────────────────

  it("loadTrophyStatuses returns exactly 67 entries", () => {
    expect(loadTrophyStatuses()).toHaveLength(67);
  });

  it("loadTrophyStatuses has 6 distinct categories including cumulative", () => {
    const cats = new Set(loadTrophyStatuses().map((s) => s.def.category));
    expect(cats).toEqual(new Set(["numbers", "combos", "scores", "play", "cumulative", "special"]));
  });

  it("loadTrophyStatuses all entries start unlocked: false", () => {
    expect(loadTrophyStatuses().every((s) => !s.unlocked)).toBe(true);
  });

  // ── Number series: thresholds 6/10/14/16 ─────────────────────────────────────

  it("num_1_bronze does NOT unlock with 5 tiles (threshold is now 6)", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("num_1_bronze");
  });

  it("num_1_bronze unlocks with exactly 6 tiles of value 1", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).not.toContain("num_1_silver");
  });

  it("num_1_silver unlocks with 10 tiles", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, null, null],
      [null, null, null, null],
    ];
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).toContain("num_1_silver");
    expect(r).not.toContain("num_1_gold");
  });

  it("num_1_gold unlocks with 14 tiles", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, null, null],
    ];
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_gold");
    expect(r).not.toContain("num_1_diamond");
  });

  it("num_1_diamond unlocks with 16 tiles (full board)", () => {
    const full1: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ];
    const r = checkTrophies({ type: "slide", grid: full1, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).toContain("num_1_silver");
    expect(r).toContain("num_1_gold");
    expect(r).toContain("num_1_diamond");
  });

  it("num_9_bronze unlocks with 6 tiles of value 9", () => {
    const grid: (number | null)[][] = [
      [9, 9, 9, 9],
      [9, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("num_9_bronze");
  });

  // ── maxCombo tracking ─────────────────────────────────────────────────────────

  it("combo_bronze unlocks on first slide with comboCount >= 2", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 2 });
    expect(r).toContain("combo_bronze");
    expect(r).not.toContain("combo_silver");
  });

  it("combo_bronze does NOT unlock when comboCount < 2", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 1 });
    expect(r).not.toContain("combo_bronze");
  });

  it("combo_silver unlocks on first slide with comboCount >= 3", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 3 });
    expect(r).toContain("combo_bronze");
    expect(r).toContain("combo_silver");
    expect(r).not.toContain("combo_gold");
  });

  it("combo_gold unlocks on first slide with comboCount >= 5", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    expect(r).toContain("combo_bronze");
    expect(r).toContain("combo_silver");
    expect(r).toContain("combo_gold");
    expect(r).not.toContain("combo_diamond");
  });

  it("combo_diamond unlocks on first slide with comboCount >= 8", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 8 });
    expect(r).toContain("combo_bronze");
    expect(r).toContain("combo_silver");
    expect(r).toContain("combo_gold");
    expect(r).toContain("combo_diamond");
  });

  it("maxCombo persists: combo_silver unlocks on later slide without re-unlocking bronze", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 2 }); // unlocks bronze
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 3 }); // maxCombo → 3
    expect(r).toContain("combo_silver");
    expect(r).not.toContain("combo_bronze"); // already unlocked
  });

  it("maxCombo does NOT regress: a lower comboCount slide doesn't reduce maxCombo", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 }); // maxCombo = 5
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 1 }); // maxCombo stays 5
    expect(r).not.toContain("combo_gold"); // already unlocked, not re-unlocked
    // Verify combo_gold remains unlocked
    expect(loadTrophyStatuses().find((s) => s.def.id === "combo_gold")!.unlocked).toBe(true);
  });

  // ── totalScore tracking ───────────────────────────────────────────────────────

  it("score_total_bronze does NOT unlock with totalScore < 1000", () => {
    const r = checkTrophies({ type: "gameOver", score: 500 });
    expect(r).not.toContain("score_total_bronze"); // 500 < 1000
  });

  it("score_total_bronze unlocks when totalScore accumulates to >= 1000", () => {
    checkTrophies({ type: "gameOver", score: 500 });       // total = 500
    const r = checkTrophies({ type: "gameOver", score: 600 }); // total = 1100
    expect(r).toContain("score_total_bronze");
    expect(r).not.toContain("score_total_silver");
  });

  it("score_total_silver unlocks once totalScore >= 10000", () => {
    for (let i = 0; i < 19; i++) checkTrophies({ type: "gameOver", score: 600 }); // 11400 total
    const r = checkTrophies({ type: "gameOver", score: 600 });
    expect(r).toContain("score_total_silver");
  });

  it("score_total trophy IDs use loadModalData section category=cumulative", () => {
    const sections = loadModalData();
    const cumSection = sections.find((s) => s.category === "cumulative")!;
    expect(cumSection.groups[0].tiers!.map((t) => t.def.id)).toEqual([
      "score_total_bronze",
      "score_total_silver",
      "score_total_gold",
      "score_total_diamond",
    ]);
  });

  // ── Score milestones (unchanged behavior) ─────────────────────────────────────

  it("score_100_bronze still unlocks on first game with score >= 100", () => {
    expect(checkTrophies({ type: "gameOver", score: 100 })).toContain("score_100_bronze");
  });

  it("gameOver score=0 unlocks zero_score but not score_100_bronze", () => {
    const r = checkTrophies({ type: "gameOver", score: 0 });
    expect(r).toContain("zero_score");
    expect(r).not.toContain("score_100_bronze");
  });

  it("gameOver score=350 unlocks score_100_bronze + score_300_bronze, not score_500_bronze", () => {
    const r = checkTrophies({ type: "gameOver", score: 350 });
    expect(r).toContain("score_100_bronze");
    expect(r).toContain("score_300_bronze");
    expect(r).not.toContain("score_500_bronze");
  });

  // ── Play count ────────────────────────────────────────────────────────────────

  it("play_bronze unlocks after exactly 10 gameOver events", () => {
    for (let i = 0; i < 9; i++) {
      expect(checkTrophies({ type: "gameOver", score: 0 })).not.toContain("play_bronze");
    }
    expect(checkTrophies({ type: "gameOver", score: 0 })).toContain("play_bronze");
  });

  // ── board_clear / almost_full ─────────────────────────────────────────────────

  it("board_clear unlocks when slide produces an all-null grid", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 0 })).toContain("board_clear");
  });

  it("almost_full unlocks with 15 non-null tiles on board", () => {
    const grid: (number | null)[][] = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, 6, null],
    ];
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("almost_full");
  });

  // ── loadModalData structure ───────────────────────────────────────────────────

  it("loadModalData returns 6 sections in order: numbers/combos/scores/play/cumulative/special", () => {
    const sections = loadModalData();
    expect(sections).toHaveLength(6);
    expect(sections.map((s) => s.category)).toEqual(
      ["numbers", "combos", "scores", "play", "cumulative", "special"]
    );
  });

  it("數字系列 section has 9 groups with thresholds [6,10,14,16]", () => {
    const sections = loadModalData();
    expect(sections[0].groups).toHaveLength(9);
    expect(sections[0].groups[0].thresholds).toEqual([6, 10, 14, 16]);
    expect(sections[0].groups[8].thresholds).toEqual([6, 10, 14, 16]);
  });

  it("連鎖系列 section has 1 group with thresholds [2,3,5,8] and progressCeiling 8", () => {
    const sections = loadModalData();
    expect(sections[1].groups).toHaveLength(1);
    expect(sections[1].groups[0].thresholds).toEqual([2, 3, 5, 8]);
    expect(sections[1].groups[0].progressCeiling).toBe(8);
  });

  it("累積成就 section has 1 group with thresholds [1000,10000,50000,200000]", () => {
    const sections = loadModalData();
    const cum = sections[4];
    expect(cum.categoryLabel).toBe("累積成就");
    expect(cum.groups).toHaveLength(1);
    expect(cum.groups[0].thresholds).toEqual([1000, 10000, 50000, 200000]);
    expect(cum.groups[0].progressCeiling).toBe(200000);
  });

  it("遊玩成就 section has 2 groups: tiered play count + single board_clear", () => {
    const sections = loadModalData();
    const play = sections[3];
    expect(play.groups).toHaveLength(2);
    expect(play.groups[0].type).toBe("tiered");
    expect(play.groups[1].type).toBe("single");
    expect(play.groups[1].single!.def.id).toBe("board_clear");
  });

  it("play group beyondDiamond is false before play_diamond unlocked", () => {
    // Seed: only play_bronze unlocked
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ playCount: 10 }));
    localStorage.setItem("mathMerge10Trophies", JSON.stringify({ play_bronze: 1 }));
    expect(loadModalData()[3].groups[0].beyondDiamond).toBe(false);
  });

  it("play group beyondDiamond is true when all 4 play tiers unlocked", () => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ playCount: 510 }));
    localStorage.setItem("mathMerge10Trophies", JSON.stringify({
      play_bronze: 1, play_silver: 2, play_gold: 3, play_diamond: 4,
    }));
    const playGroup = loadModalData()[3].groups[0];
    expect(playGroup.beyondDiamond).toBe(true);
    expect(playGroup.progressValue).toBe(510);
  });

  it("cumulative group beyondDiamond is true when all 4 score_total tiers unlocked", () => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ totalScore: 250000 }));
    localStorage.setItem("mathMerge10Trophies", JSON.stringify({
      score_total_bronze: 1, score_total_silver: 2, score_total_gold: 3, score_total_diamond: 4,
    }));
    const cumGroup = loadModalData()[4].groups[0];
    expect(cumGroup.beyondDiamond).toBe(true);
    expect(cumGroup.progressValue).toBe(250000);
  });

  it("loadModalData progressValue for maxCombo reflects latest slide", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    expect(loadModalData()[1].groups[0].progressValue).toBe(5);
  });

  it("loadModalData progressValue for maxNum1 reflects latest slide", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(loadModalData()[0].groups[0].progressValue).toBe(7); // 7 tiles of value 1
  });

  it("loadModalData totalScore reflects gameOver accumulation", () => {
    checkTrophies({ type: "gameOver", score: 300 });
    checkTrophies({ type: "gameOver", score: 200 });
    expect(loadModalData()[4].groups[0].progressValue).toBe(500);
  });

  // ── getTrophyDef ──────────────────────────────────────────────────────────────

  it("getTrophyDef works for new combo_bronze ID", () => {
    const def = getTrophyDef("combo_bronze");
    expect(def).toBeDefined();
    expect(def!.name).toBe("連鎖初現");
    expect(def!.category).toBe("combos");
  });

  it("getTrophyDef works for score_total_diamond", () => {
    const def = getTrophyDef("score_total_diamond");
    expect(def).toBeDefined();
    expect(def!.name).toBe("二十萬傳說");
    expect(def!.category).toBe("cumulative");
  });

  it("getTrophyDef returns undefined for retired combo_5", () => {
    expect(getTrophyDef("combo_5")).toBeUndefined();
  });

  it("getTrophyDef returns undefined for retired combo_1_bronze", () => {
    expect(getTrophyDef("combo_1_bronze")).toBeUndefined();
  });

  // ── Deduplication ─────────────────────────────────────────────────────────────

  it("already-unlocked trophy is NOT returned again", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    expect(r).not.toContain("combo_gold"); // already unlocked
  });

  it("loadTrophyStatuses reflects unlocked state after checkTrophies", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 3 });
    const statuses = loadTrophyStatuses();
    const bronze = statuses.find((s) => s.def.id === "combo_bronze")!;
    expect(bronze.unlocked).toBe(true);
    expect(bronze.unlockedAt).toBeTypeOf("number");
    const gold = statuses.find((s) => s.def.id === "combo_gold")!;
    expect(gold.unlocked).toBe(false); // maxCombo=3 < 5
  });
});
```

- [ ] **Step 2: Run unit tests to confirm RED**

```bash
cd workspace && npm run test:unit
```

Expected: ~32 tests FAIL (all 67-count / new-threshold / loadModalData tests fail because `trophies.ts` still has old code). The old tests that still pass (like `board_clear`, `almost_full`, `zero_score`) are fine.

- [ ] **Step 3: Commit failing tests**

```bash
git add workspace/tests/unit/trophies.test.ts
git commit -m "test(trophies): rewrite unit tests for 67-trophy system with maxCombo and loadModalData (RED)"
```

---

## Task 2: Rewrite trophies.ts (GREEN)

**Files:**
- Modify: `workspace/src/trophies.ts` (full replacement)

- [ ] **Step 1: Replace the entire file**

Write `workspace/src/trophies.ts`:

```typescript
import { type GameGrid } from "./grid";

// ── Public types ──────────────────────────────────────────────────────────────

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "numbers" | "combos" | "scores" | "play" | "cumulative" | "special";
}

export interface TrophyStatus {
  def: TrophyDef;
  unlocked: boolean;
  unlockedAt: number | null;
}

export type TrophyCheckEvent =
  | { type: "slide"; grid: GameGrid; comboCount: number }
  | { type: "gameOver"; score: number };

export interface ModalGroup {
  label: string;
  type: "tiered" | "single";
  tiers?: TrophyStatus[];
  single?: TrophyStatus;
  progressValue?: number;
  progressCeiling?: number;
  thresholds?: number[];
  thresholdDisplays?: string[];
  beyondDiamond?: boolean;
  progressDisplay?: string;
  beyondDisplay?: string;
  beyondSubDisplay?: string;
}

export interface ModalSection {
  categoryLabel: string;
  category: TrophyDef["category"];
  groups: ModalGroup[];
}

// ── Internal types ────────────────────────────────────────────────────────────

interface GameStats {
  playCount: number;
  maxCombo: number;
  maxNum1: number; maxNum2: number; maxNum3: number;
  maxNum4: number; maxNum5: number; maxNum6: number;
  maxNum7: number; maxNum8: number; maxNum9: number;
  score100Count: number;
  score300Count: number;
  score500Count: number;
  score1000Count: number;
  totalScore: number;
}

interface CheckPayload {
  event: TrophyCheckEvent;
  stats: GameStats;
}

interface TrophyRule extends TrophyDef {
  check: (payload: CheckPayload) => boolean;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const TROPHY_KEY = "mathMerge10Trophies";
const STATS_KEY  = "mathMerge10Stats";

const EMPTY_STATS: GameStats = {
  playCount: 0, maxCombo: 0,
  maxNum1: 0, maxNum2: 0, maxNum3: 0, maxNum4: 0, maxNum5: 0,
  maxNum6: 0, maxNum7: 0, maxNum8: 0, maxNum9: 0,
  score100Count: 0, score300Count: 0, score500Count: 0, score1000Count: 0,
  totalScore: 0,
};

function loadUnlocked(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "{}") as Record<string, number>; }
  catch { return {}; }
}

function loadStats(): GameStats {
  try {
    return { ...EMPTY_STATS, ...(JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") as Partial<GameStats>) };
  } catch { return { ...EMPTY_STATS }; }
}

function saveStats(stats: GameStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

function countValue(grid: GameGrid, value: number): number {
  return grid.flat().filter((c) => c === value).length;
}

function countNonNull(grid: GameGrid): number {
  return grid.flat().filter((c) => c !== null).length;
}

// ── Trophy definition generators ─────────────────────────────────────────────

const NUM_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

function numTrophies(value: number): TrophyRule[] {
  const n = NUM_NAMES[value - 1];
  const tiers: Array<[string, string, string, number]> = [
    ["bronze", "🥉", `${n}的初現`, 6],
    ["silver", "🥈", `${n}的聚集`, 10],
    ["gold",   "🥇", `${n}的洪流`, 14],
    ["diamond","💎", `${n}的霸主`, 16],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `num_${value}_${tier}`, name, icon,
    category: "numbers" as const,
    description: `版面上同時出現 ${threshold} 個或以上的「${value}」`,
    check: ({ event }) => event.type === "slide" && countValue(event.grid, value) >= threshold,
  }));
}

function scoreTrophies(
  score: number,
  thresholds: [number, number, number, number],
  label: string,
  getCount: (stats: GameStats) => number,
): TrophyRule[] {
  const tiers: Array<[string, string, string, number]> = [
    ["bronze", "🥉", `${label}首達`, thresholds[0]],
    ["silver", "🥈", `${label}常客`, thresholds[1]],
    ["gold",   "🥇", `${label}習慣`, thresholds[2]],
    ["diamond","💎", `${label}大師`, thresholds[3]],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `score_${score}_${tier}`, name, icon,
    category: "scores" as const,
    description: `得分達到 ${score} 分 ${threshold} 次`,
    check: ({ stats }) => getCount(stats) >= threshold,
  }));
}

// ── Trophy definitions (67 total) ────────────────────────────────────────────

const TROPHY_DEFS: TrophyRule[] = [
  // 數字系列 (36) — thresholds 6/10/14/16
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(numTrophies),

  // 連鎖系列 (4) — maxCombo based, thresholds 2/3/5/8
  { id: "combo_bronze",  name: "連鎖初現", icon: "🥉", category: "combos" as const,
    description: "單次消除 2 對以上", check: ({ stats }) => stats.maxCombo >= 2 },
  { id: "combo_silver",  name: "連鎖進階", icon: "🥈", category: "combos" as const,
    description: "單次消除 3 對以上", check: ({ stats }) => stats.maxCombo >= 3 },
  { id: "combo_gold",    name: "連鎖高手", icon: "🥇", category: "combos" as const,
    description: "單次消除 5 對以上", check: ({ stats }) => stats.maxCombo >= 5 },
  { id: "combo_diamond", name: "連鎖大師", icon: "💎", category: "combos" as const,
    description: "單次消除 8 對以上", check: ({ stats }) => stats.maxCombo >= 8 },

  // 分數里程碑 (16) — unchanged
  ...scoreTrophies(100,  [1, 5, 20, 50], "百分", (s) => s.score100Count),
  ...scoreTrophies(300,  [1, 3, 10, 25], "三百", (s) => s.score300Count),
  ...scoreTrophies(500,  [1, 2, 5,  15], "五百", (s) => s.score500Count),
  ...scoreTrophies(1000, [1, 2, 5,  10], "千分", (s) => s.score1000Count),

  // 遊玩成就 (5) — unchanged
  { id: "play_bronze",  name: "新手冒險", icon: "🥉", category: "play" as const,
    description: "遊玩 10 局",  check: ({ stats }) => stats.playCount >= 10 },
  { id: "play_silver",  name: "進階玩家", icon: "🥈", category: "play" as const,
    description: "遊玩 50 局",  check: ({ stats }) => stats.playCount >= 50 },
  { id: "play_gold",    name: "資深玩家", icon: "🥇", category: "play" as const,
    description: "遊玩 100 局", check: ({ stats }) => stats.playCount >= 100 },
  { id: "play_diamond", name: "遊戲達人", icon: "💎", category: "play" as const,
    description: "遊玩 500 局", check: ({ stats }) => stats.playCount >= 500 },
  { id: "board_clear",  name: "天地清明", icon: "✨", category: "play" as const,
    description: "一局遊戲中將盤面完全清空",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) === 0 },

  // 累積成就 (4) — NEW
  { id: "score_total_bronze",  name: "千分旅程",   icon: "🥉", category: "cumulative" as const,
    description: "累積總分達到 1,000 分",    check: ({ stats }) => stats.totalScore >= 1000 },
  { id: "score_total_silver",  name: "萬分修煉",   icon: "🥈", category: "cumulative" as const,
    description: "累積總分達到 10,000 分",   check: ({ stats }) => stats.totalScore >= 10000 },
  { id: "score_total_gold",    name: "五萬精通",   icon: "🥇", category: "cumulative" as const,
    description: "累積總分達到 50,000 分",   check: ({ stats }) => stats.totalScore >= 50000 },
  { id: "score_total_diamond", name: "二十萬傳說", icon: "💎", category: "cumulative" as const,
    description: "累積總分達到 200,000 分",  check: ({ stats }) => stats.totalScore >= 200000 },

  // 特殊成就 (2) — unchanged
  { id: "zero_score",  name: "空手而歸", icon: "🕊️", category: "special" as const,
    description: "完成一場遊戲，得分為零",
    check: ({ event }) => event.type === "gameOver" && event.score === 0 },
  { id: "almost_full", name: "滿溢邊緣", icon: "💥", category: "special" as const,
    description: "版面上同時有 15 格或以上非空的格子",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) >= 15 },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function checkTrophies(event: TrophyCheckEvent): string[] {
  const stats = loadStats();

  if (event.type === "slide") {
    stats.maxCombo = Math.max(stats.maxCombo, event.comboCount);
    stats.maxNum1  = Math.max(stats.maxNum1,  countValue(event.grid, 1));
    stats.maxNum2  = Math.max(stats.maxNum2,  countValue(event.grid, 2));
    stats.maxNum3  = Math.max(stats.maxNum3,  countValue(event.grid, 3));
    stats.maxNum4  = Math.max(stats.maxNum4,  countValue(event.grid, 4));
    stats.maxNum5  = Math.max(stats.maxNum5,  countValue(event.grid, 5));
    stats.maxNum6  = Math.max(stats.maxNum6,  countValue(event.grid, 6));
    stats.maxNum7  = Math.max(stats.maxNum7,  countValue(event.grid, 7));
    stats.maxNum8  = Math.max(stats.maxNum8,  countValue(event.grid, 8));
    stats.maxNum9  = Math.max(stats.maxNum9,  countValue(event.grid, 9));
  } else {
    stats.playCount++;
    stats.totalScore += event.score;
    if (event.score >= 100)  stats.score100Count++;
    if (event.score >= 300)  stats.score300Count++;
    if (event.score >= 500)  stats.score500Count++;
    if (event.score >= 1000) stats.score1000Count++;
  }

  saveStats(stats);

  const unlocked = loadUnlocked();
  const newlyUnlocked: string[] = [];
  const payload: CheckPayload = { event, stats };

  for (const def of TROPHY_DEFS) {
    if (unlocked[def.id] !== undefined) continue;
    if (def.check(payload)) {
      unlocked[def.id] = Date.now();
      newlyUnlocked.push(def.id);
    }
  }

  if (newlyUnlocked.length > 0) localStorage.setItem(TROPHY_KEY, JSON.stringify(unlocked));
  return newlyUnlocked;
}

export function loadTrophyStatuses(): TrophyStatus[] {
  const unlocked = loadUnlocked();
  return TROPHY_DEFS.map((def) => ({
    def,
    unlocked: def.id in unlocked,
    unlockedAt: unlocked[def.id] ?? null,
  }));
}

export function getTrophyDef(id: string): TrophyDef | undefined {
  return TROPHY_DEFS.find((d) => d.id === id);
}

export function loadModalData(): ModalSection[] {
  const gs = loadStats();
  const unlocked = loadUnlocked();

  function makeStatus(id: string): TrophyStatus {
    const def = TROPHY_DEFS.find((d) => d.id === id)!;
    return { def, unlocked: id in unlocked, unlockedAt: unlocked[id] ?? null };
  }

  function firstLockedIdx(tierIds: string[]): number {
    return tierIds.findIndex((id) => !(id in unlocked));
  }

  function nextThreshold(tierIds: string[], rawThresholds: number[]): number {
    const idx = firstLockedIdx(tierIds);
    return idx === -1 ? rawThresholds[rawThresholds.length - 1] : rawThresholds[idx];
  }

  // ── 數字系列 ──
  const maxNums = [gs.maxNum1, gs.maxNum2, gs.maxNum3, gs.maxNum4, gs.maxNum5, gs.maxNum6, gs.maxNum7, gs.maxNum8, gs.maxNum9];
  const numRawThresholds = [6, 10, 14, 16];
  const numberGroups: ModalGroup[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => {
    const tierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `num_${v}_${t}`);
    const maxV = maxNums[v - 1];
    const allDone = tierIds.every((id) => id in unlocked);
    const next = nextThreshold(tierIds, numRawThresholds);
    return {
      label: `數字 ${v}`,
      type: "tiered",
      tiers: tierIds.map(makeStatus),
      progressValue: maxV,
      progressCeiling: 16,
      thresholds: numRawThresholds,
      thresholdDisplays: numRawThresholds.map((n) => `×${n}`),
      beyondDiamond: false,
      progressDisplay: allDone ? `最多 ${maxV} 個` : `最多 ${maxV} 個 / 目標 ${next}`,
    } as ModalGroup;
  });

  // ── 連鎖系列 ──
  const comboTierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `combo_${t}`);
  const comboThresholds = [2, 3, 5, 8];
  const allComboDone = comboTierIds.every((id) => id in unlocked);
  const nextCombo = nextThreshold(comboTierIds, comboThresholds);
  const comboGroup: ModalGroup = {
    label: "最高連鎖",
    type: "tiered",
    tiers: comboTierIds.map(makeStatus),
    progressValue: gs.maxCombo,
    progressCeiling: 8,
    thresholds: comboThresholds,
    thresholdDisplays: comboThresholds.map((n) => `×${n}`),
    beyondDiamond: false,
    progressDisplay: allComboDone ? `×${gs.maxCombo}` : `目前 ×${gs.maxCombo} / 目標 ×${nextCombo}`,
  };

  // ── 分數里程碑 ──
  const scoreMilestoneGroups: ModalGroup[] = (
    [
      { score: 100,  label: "單場 ≥100 分",  thresholds: [1, 5, 20, 50] as [number,number,number,number], count: gs.score100Count },
      { score: 300,  label: "單場 ≥300 分",  thresholds: [1, 3, 10, 25] as [number,number,number,number], count: gs.score300Count },
      { score: 500,  label: "單場 ≥500 分",  thresholds: [1, 2, 5,  15] as [number,number,number,number], count: gs.score500Count },
      { score: 1000, label: "單場 ≥1000 分", thresholds: [1, 2, 5,  10] as [number,number,number,number], count: gs.score1000Count },
    ] as const
  ).map(({ score, label, thresholds, count }) => {
    const tierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `score_${score}_${t}`);
    const allDone = tierIds.every((id) => id in unlocked);
    const next = nextThreshold(tierIds, [...thresholds]);
    return {
      label,
      type: "tiered",
      tiers: tierIds.map(makeStatus),
      progressValue: count,
      progressCeiling: thresholds[3],
      thresholds: [...thresholds],
      thresholdDisplays: [...thresholds].map((n) => `${n}次`),
      beyondDiamond: false,
      progressDisplay: allDone ? `${count} 次` : `${count} 次 / 目標 ${next}`,
    } as ModalGroup;
  });

  // ── 遊玩成就 ──
  const playTierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `play_${t}`);
  const playThresholds = [10, 50, 100, 500];
  const allPlayDone = playTierIds.every((id) => id in unlocked);
  const nextPlay = nextThreshold(playTierIds, playThresholds);
  const playCountGroup: ModalGroup = allPlayDone
    ? {
        label: "遊玩次數",
        type: "tiered",
        tiers: playTierIds.map(makeStatus),
        progressValue: gs.playCount,
        progressCeiling: 500,
        thresholds: playThresholds,
        thresholdDisplays: playThresholds.map((n) => `${n}局`),
        beyondDiamond: true,
        beyondDisplay: `${gs.playCount} 局 🔄`,
        beyondSubDisplay: `超越鑽石 +${gs.playCount - 500} 局`,
      }
    : {
        label: "遊玩次數",
        type: "tiered",
        tiers: playTierIds.map(makeStatus),
        progressValue: gs.playCount,
        progressCeiling: 500,
        thresholds: playThresholds,
        thresholdDisplays: playThresholds.map((n) => `${n}局`),
        beyondDiamond: false,
        progressDisplay: `${gs.playCount} 局 / 目標 ${nextPlay}`,
      };

  // ── 累積成就 ──
  const totalTierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `score_total_${t}`);
  const totalThresholds = [1000, 10000, 50000, 200000];
  const allTotalDone = totalTierIds.every((id) => id in unlocked);
  const nextTotal = nextThreshold(totalTierIds, totalThresholds);
  const cumulativeGroup: ModalGroup = allTotalDone
    ? {
        label: "累積總分",
        type: "tiered",
        tiers: totalTierIds.map(makeStatus),
        progressValue: gs.totalScore,
        progressCeiling: 200000,
        thresholds: totalThresholds,
        thresholdDisplays: totalThresholds.map((n) => n.toLocaleString()),
        beyondDiamond: true,
        beyondDisplay: `${gs.totalScore.toLocaleString()} 分 🔄`,
        beyondSubDisplay: `超越鑽石 +${(gs.totalScore - 200000).toLocaleString()} 分`,
      }
    : {
        label: "累積總分",
        type: "tiered",
        tiers: totalTierIds.map(makeStatus),
        progressValue: gs.totalScore,
        progressCeiling: 200000,
        thresholds: totalThresholds,
        thresholdDisplays: totalThresholds.map((n) => n.toLocaleString()),
        beyondDiamond: false,
        progressDisplay: `${gs.totalScore.toLocaleString()} 分 / 目標 ${nextTotal.toLocaleString()}`,
      };

  return [
    { categoryLabel: "數字系列",  category: "numbers",    groups: numberGroups },
    { categoryLabel: "連鎖系列",  category: "combos",     groups: [comboGroup] },
    { categoryLabel: "分數里程碑", category: "scores",    groups: scoreMilestoneGroups },
    { categoryLabel: "遊玩成就",  category: "play",       groups: [playCountGroup, { label: "天地清明", type: "single", single: makeStatus("board_clear") }] },
    { categoryLabel: "累積成就",  category: "cumulative", groups: [cumulativeGroup] },
    { categoryLabel: "特殊成就",  category: "special",    groups: [
      { label: "空手而歸", type: "single", single: makeStatus("zero_score") },
      { label: "滿溢邊緣", type: "single", single: makeStatus("almost_full") },
    ]},
  ];
}
```

- [ ] **Step 2: Run unit tests to confirm GREEN**

```bash
cd workspace && npm run test:unit
```

Expected: all tests pass (174 unit tests). If TypeScript errors arise, fix them (do not skip type checking).

- [ ] **Step 3: Commit**

```bash
git add workspace/src/trophies.ts
git commit -m "feat(trophies): rewrite to 67 trophies with maxCombo/maxNum tracking, cumulative category, and loadModalData()"
```

---

## Task 3: Update modal rendering + CSS + E2E tests

**Files:**
- Modify: `workspace/src/game.ts` (import line 29 + `renderTrophyModal` function)
- Modify: `workspace/index.html` (replace CSS block)
- Modify: `workspace/tests/e2e/ux-v2.spec.ts` (update 4 trophy tests)

### Step 1: Update game.ts import

- [ ] **Step 1a: Update the import on line 29 of `workspace/src/game.ts`**

Old:
```typescript
import { checkTrophies, loadTrophyStatuses, getTrophyDef, type TrophyDef } from "./trophies";
```

New:
```typescript
import { checkTrophies, loadModalData, getTrophyDef } from "./trophies";
```

### Step 2: Rewrite renderTrophyModal

- [ ] **Step 2: Replace the `renderTrophyModal` function body in `workspace/src/game.ts`**

Old (entire function):
```typescript
function renderTrophyModal(): void {
  trophyModalListEl.innerHTML = "";
  const statuses = loadTrophyStatuses();

  const CATEGORY_ORDER: TrophyDef["category"][] = ["numbers", "combos", "scores", "play", "special"];
  const CATEGORY_LABELS: Record<TrophyDef["category"], string> = {
    numbers: "數字系列",
    combos: "連鎖系列",
    scores: "分數里程碑",
    play: "遊玩成就",
    special: "特殊成就",
  };

  for (const cat of CATEGORY_ORDER) {
    const group = statuses.filter((s) => s.def.category === cat);
    if (group.length === 0) continue;

    const header = document.createElement("li");
    header.className = "tm-category-header";
    header.textContent = CATEGORY_LABELS[cat];
    trophyModalListEl.appendChild(header);

    for (const { def, unlocked } of group) {
      const li = document.createElement("li");
      if (!unlocked) li.classList.add("tm-locked");
      li.innerHTML = `<span class="tm-icon">${def.icon}</span><span class="tm-body"><strong>${def.name}</strong>${unlocked ? '<span class="tm-check">✓</span>' : ""}<small>${def.description}</small></span>`;
      trophyModalListEl.appendChild(li);
    }
  }
}
```

New:
```typescript
function renderTrophyModal(): void {
  trophyModalListEl.innerHTML = "";
  const sections = loadModalData();

  for (const section of sections) {
    const header = document.createElement("li");
    header.className = "tm-category-header";
    header.textContent = section.categoryLabel;
    trophyModalListEl.appendChild(header);

    for (const group of section.groups) {
      const li = document.createElement("li");

      if (group.type === "single") {
        const { def, unlocked } = group.single!;
        li.className = `tm-single${unlocked ? "" : " locked"}`;
        li.innerHTML = `<span class="tm-single-ico">${def.icon}</span><div class="tm-single-body"><strong>${def.name}</strong><small>${def.description}</small></div>`;
      } else if (group.beyondDiamond) {
        li.className = "tm-prog-row";
        li.innerHTML = `
          <div class="tm-prog-top">
            <span class="tm-prog-label">${group.label}</span>
            <span class="tm-beyond-count">${group.beyondDisplay ?? ""}</span>
          </div>
          <div class="tm-medals">
            ${group.tiers!.map((t) => `<div class="tm-tier"><span class="tm-ico">${t.def.icon}</span></div>`).join("")}
            <span class="tm-beyond-tag">全數解鎖 ✦</span>
          </div>
          <div class="tm-bar"><div class="tm-fill tm-fill-cyan" style="width:100%"></div></div>
          <div class="tm-beyond-sub">${group.beyondSubDisplay ?? ""}</div>
        `;
      } else {
        const pct = Math.min(100, ((group.progressValue ?? 0) / (group.progressCeiling ?? 1)) * 100);
        li.className = "tm-prog-row";
        li.innerHTML = `
          <div class="tm-prog-top">
            <span class="tm-prog-label">${group.label}</span>
            <span class="tm-prog-val">${group.progressDisplay ?? ""}</span>
          </div>
          <div class="tm-medals">
            ${group.tiers!.map((t, i) => `
              <div class="tm-tier${t.unlocked ? "" : " locked"}">
                <span class="tm-ico">${t.def.icon}</span>
                <span class="tm-thr">${group.thresholdDisplays?.[i] ?? ""}</span>
              </div>`).join("")}
          </div>
          <div class="tm-bar"><div class="tm-fill tm-fill-purple" style="width:${pct.toFixed(1)}%"></div></div>
        `;
      }

      trophyModalListEl.appendChild(li);
    }
  }
}
```

### Step 3: Replace CSS in index.html

- [ ] **Step 3: Replace the trophy CSS block in `workspace/index.html`**

Find this exact block (lines ~392–433) and replace it entirely:

Old (find this exact text):
```css
    #trophy-modal-list li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    #trophy-modal-list li.tm-locked {
      opacity: 0.4;
    }
    .tm-icon {
      font-size: 20px;
      flex-shrink: 0;
      line-height: 1.3;
    }
    .tm-body {
      font-size: 13px;
      line-height: 1.5;
    }
    .tm-body small {
      display: block;
      color: #9ca3af;
      font-size: 11px;
    }
    .tm-check {
      color: #4ade80;
      font-weight: bold;
      margin-left: 4px;
    }
    .tm-category-header {
      font-size: 11px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 8px 0 2px;
      border-top: 1px solid #374151;
      margin-top: 4px;
    }
    .tm-category-header:first-child {
      border-top: none;
      margin-top: 0;
      padding-top: 0;
    }
```

New:
```css
    .tm-category-header {
      font-size: 10px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      padding: 8px 0 4px;
      border-top: 1px solid #374151;
      margin-top: 4px;
    }
    .tm-category-header:first-child {
      border-top: none;
      margin-top: 0;
      padding-top: 0;
    }
    /* Progress card row */
    .tm-prog-row { padding: 6px 0; border-bottom: 1px solid #1f2937; }
    .tm-prog-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .tm-prog-label { color: #e5e7eb; font-size: 12px; font-weight: 600; }
    .tm-prog-val { color: #9ca3af; font-size: 10px; }
    .tm-medals { display: flex; margin-bottom: 4px; }
    .tm-tier { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .tm-tier .tm-ico { font-size: 16px; }
    .tm-tier .tm-thr { font-size: 9px; color: #9ca3af; }
    .tm-tier.locked .tm-ico { filter: grayscale(1) opacity(0.22); }
    .tm-tier.locked .tm-thr { color: #374151; }
    .tm-bar { height: 3px; background: #374151; border-radius: 2px; overflow: hidden; }
    .tm-fill { height: 100%; border-radius: 2px; }
    .tm-fill-purple { background: linear-gradient(90deg, #7c3aed, #a78bfa); }
    .tm-fill-cyan   { background: linear-gradient(90deg, #0891b2, #67e8f9); }
    /* Beyond diamond */
    .tm-beyond-count { font-size: 11px; font-weight: bold; color: #67e8f9; }
    .tm-beyond-tag { font-size: 9px; color: #67e8f9; margin-left: 4px; }
    .tm-beyond-sub { font-size: 9px; color: #0891b2; text-align: right; margin-top: 2px; }
    /* Single achievement */
    .tm-single { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #1f2937; }
    .tm-single-ico { font-size: 20px; }
    .tm-single-body strong { color: #e5e7eb; font-size: 12px; display: block; }
    .tm-single-body small { color: #6b7280; font-size: 10px; }
    .tm-single.locked .tm-single-ico { filter: grayscale(1) opacity(0.25); }
    .tm-single.locked .tm-single-body strong { color: #4b5563; }
```

### Step 4: Update E2E tests

- [ ] **Step 4: Update 4 trophy tests in `workspace/tests/e2e/ux-v2.spec.ts`**

**Test A** — "5 categories" → "6 categories":

Old:
```typescript
test("Trophy: clicking 🏆 opens modal with trophy names from all 5 categories", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  // Spot-check one trophy from each category (numbers, combos, scores, play, special)
  for (const name of [
    "一的洪流",    // numbers
    "連鎖初學",   // combos
    "百分首達",   // scores
    "新手冒險",   // play
    "空手而歸",   // special
  ]) {
    await expect(page.locator("#trophy-modal")).toContainText(name);
  }
});
```

New:
```typescript
test("Trophy: clicking 🏆 opens modal with trophy names from all 6 categories", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  // Spot-check one trophy from each category (numbers, combos, scores, play, cumulative, special)
  for (const name of [
    "一的洪流",    // numbers
    "連鎖初現",   // combos (new ID/name)
    "百分首達",   // scores
    "新手冒險",   // play
    "千分旅程",   // cumulative (new)
    "空手而歸",   // special
  ]) {
    await expect(page.locator("#trophy-modal")).toContainText(name);
  }
});
```

**Test B** — category header count 5 → 6:

Old:
```typescript
test("trophy modal: shows 5 category headers", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.click("#hud-trophy");
  await expect(page.locator("#trophy-modal")).toBeVisible();

  const headers = page.locator(".tm-category-header");
  await expect(headers).toHaveCount(5);
  await expect(headers.first()).toHaveText("數字系列");
});
```

New:
```typescript
test("trophy modal: shows 6 category headers", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.click("#hud-trophy");
  await expect(page.locator("#trophy-modal")).toBeVisible();

  const headers = page.locator(".tm-category-header");
  await expect(headers).toHaveCount(6);
  await expect(headers.first()).toHaveText("數字系列");
});
```

**Test C** — combo_2 / 連鎖初學 → combo_bronze / 連鎖初現:

Old:
```typescript
test("Trophy: combo_2 slide unlocks 連鎖初學 and shows toast", async ({ page }) => {
  await page.goto("/");
  // Pre-seed stats so that combo2Count is already 2 (threshold is 3)
  await page.evaluate(() => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ combo2Count: 2 }));
  });
  // Grid with 2 pairs (row 0: 1+9, row 1: 1+9) — ArrowLeft eliminates both (combo-2)
  await page.evaluate(() => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [1, 9, null, null],
        [1, 9, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  await expect(page.locator("#trophy-toast")).toContainText("連鎖初學");
});
```

New:
```typescript
test("Trophy: combo-2 slide unlocks 連鎖初現 and shows toast", async ({ page }) => {
  await page.goto("/");
  // No pre-seeding needed: combo_bronze unlocks immediately on first slide with comboCount >= 2
  // Grid with 2 pairs (row 0: 1+9, row 1: 1+9) — ArrowLeft eliminates both (combo-2)
  await page.evaluate(() => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [1, 9, null, null],
        [1, 9, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  await expect(page.locator("#trophy-toast")).toContainText("連鎖初現");
});
```

**Test D** — "unlocked trophy shows ✓" → "unlocked medal not locked in new UI":

Old:
```typescript
test("Trophy: unlocked trophy shows ✓ in modal", async ({ page }) => {
  await page.goto("/");
  // Pre-seed stats so that combo2Count is already 2 (threshold is 3), then do one more combo-2
  await page.evaluate(() => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ combo2Count: 2 }));
  });
  // Unlock 連鎖初學 by reaching combo2Count=3
  await page.evaluate(() => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [1, 9, null, null],
        [1, 9, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  // Open trophy modal
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  // 連鎖初學 row should have ✓
  const combo2Item = page.locator("#trophy-modal-list li").filter({ hasText: "連鎖初學" });
  await expect(combo2Item).toContainText("✓");
});
```

New:
```typescript
test("Trophy: unlocked combo_bronze shows as unlocked medal in new UI", async ({ page }) => {
  await page.goto("/");
  // Unlock 連鎖初現 with a combo-2 slide (no pre-seeding needed)
  await page.evaluate(() => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [1, 9, null, null],
        [1, 9, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  // Open trophy modal
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  // The 連鎖系列 progress row should have its first medal unlocked (not locked)
  const comboRow = page.locator("#trophy-modal-list .tm-prog-row").filter({ hasText: "最高連鎖" });
  await expect(comboRow).toBeVisible();
  const firstMedal = comboRow.locator(".tm-tier").first();
  await expect(firstMedal).not.toHaveClass(/locked/);
  // Second medal (silver, needs ×3) should still be locked
  const secondMedal = comboRow.locator(".tm-tier").nth(1);
  await expect(secondMedal).toHaveClass(/locked/);
});
```

### Step 5: Run full test suite

- [ ] **Step 5a: Run unit tests**

```bash
cd workspace && npm run test:unit
```

Expected: all 174 tests pass.

- [ ] **Step 5b: Run E2E tests**

```bash
cd workspace && npm run test:e2e
```

Expected: all 48 E2E tests pass. If the E2E dev server takes time to start, add `--timeout 60000` to the command.

- [ ] **Step 6: Commit**

```bash
git add workspace/src/game.ts workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat(trophy-modal): progress-card layout with 6 categories, maxCombo/totalScore tracking, beyond-diamond display"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ 67 trophies (36+4+16+5+4+2)
  - ✅ Number thresholds 6/10/14/16
  - ✅ Combo IDs `combo_bronze/silver/gold/diamond`, thresholds 2/3/5/8
  - ✅ `score_total_*` trophies, thresholds 1000/10000/50000/200000
  - ✅ `loadModalData()` returns `ModalSection[]` with beyondDiamond
  - ✅ Beyond-diamond mode for play count + cumulative score
  - ✅ Single-achievement rows for board_clear, zero_score, almost_full
  - ✅ CSS: `.tm-prog-row`, `.tm-tier`, `.tm-tier.locked`, `.tm-fill-purple`, `.tm-fill-cyan`, `.tm-single`, `.tm-beyond-*`
  - ✅ Old CSS classes removed: `.tm-icon`, `.tm-body`, `.tm-check`, `.tm-locked`
  - ✅ `TrophyDef.category` union updated to include `"cumulative"`

- **Type consistency:**
  - `ModalGroup.tiers` used in Task 2 and Task 3 ✅
  - `ModalGroup.single` used in Task 2 and Task 3 ✅
  - `ModalSection.category` type is `TrophyDef["category"]` which now includes `"cumulative"` ✅
  - `loadModalData` imported in game.ts, `loadTrophyStatuses` removed from import ✅

- **Migration:**
  - Old `combo1Count`~`combo4Count` in existing localStorage silently ignored (EMPTY_STATS defaults to 0) ✅
  - Old combo IDs in `mathMerge10Trophies` never checked again (not in TROPHY_DEFS) ✅
  - `loadTrophyStatuses()` still exported (backward compat, used in unit tests) ✅
