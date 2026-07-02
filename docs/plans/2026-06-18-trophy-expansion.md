# Trophy System Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the career trophy system from 8 ad-hoc trophies to 76 trophies organized into five categories with Bronze/Silver/Gold/Diamond tiers.

**Architecture:** `trophies.ts` is completely rewritten — new `GameStats` persistent counters (second localStorage key `mathMerge10Stats`), updated `TrophyDef` with `category` field, private `TrophyRule` type with `check` predicate, generator functions for the 36 per-number and 16 combo-count trophies. `game.ts`'s `renderTrophyModal()` is updated to insert category header `<li>` elements. `index.html` gains one new CSS rule. `game.ts` needs no other changes — the public API of `trophies.ts` is unchanged.

**Tech Stack:** TypeScript, vitest (unit tests), Playwright (E2E tests)

---

## Files

| File | Change |
|------|--------|
| `workspace/src/trophies.ts` | Full rewrite |
| `workspace/src/game.ts` | `renderTrophyModal()` only |
| `workspace/index.html` | `.tm-category-header` CSS rule only |
| `workspace/tests/unit/trophies.test.ts` | Full rewrite |
| `workspace/tests/e2e/ux-v2.spec.ts` | Update existing trophy tests |

---

### Task 1: Rewrite unit tests (RED)

**Files:**
- Modify: `workspace/tests/unit/trophies.test.ts`

The existing 20 tests cover the old 8 trophies. Replace the entire file with tests for the new 76-trophy system. All tests will fail until Task 2 is done — that is intentional.

- [ ] **Step 1: Replace the full content of `workspace/tests/unit/trophies.test.ts`**

```typescript
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { checkTrophies, loadTrophyStatuses, getTrophyDef } from "../../src/trophies";

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

function makeGrid(values: (number | null)[][]): (number | null)[][] {
  return values;
}

describe("trophies", () => {
  beforeAll(() => {
    vi.stubGlobal("localStorage", localStorageMock);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    localStorage.clear();
  });

  // ── loadTrophyStatuses ────────────────────────────────────────────────────────

  it("loadTrophyStatuses returns exactly 76 entries", () => {
    expect(loadTrophyStatuses()).toHaveLength(76);
  });

  it("loadTrophyStatuses all entries start as unlocked: false", () => {
    const statuses = loadTrophyStatuses();
    expect(statuses.every((s) => !s.unlocked)).toBe(true);
  });

  it("loadTrophyStatuses entries have 5 distinct categories", () => {
    const categories = new Set(loadTrophyStatuses().map((s) => s.def.category));
    expect(categories).toEqual(new Set(["numbers", "combos", "scores", "play", "special"]));
  });

  // ── Stats: combo counter increments ──────────────────────────────────────────

  it("slide with comboCount=1 only increments combo1Count", () => {
    // After 10 slides with comboCount=1, combo_1_bronze should unlock (threshold=10)
    for (let i = 0; i < 9; i++) {
      const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 1 });
      expect(r).not.toContain("combo_1_bronze");
    }
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 1 });
    expect(r).toContain("combo_1_bronze");
    // combo_2_bronze threshold is 3; combo2Count should still be 0
    expect(r).not.toContain("combo_2_bronze");
  });

  it("slide with comboCount=3 increments combo1, combo2, combo3 counts but not combo4", () => {
    // combo_3_bronze threshold is 1 — first slide with comboCount=3 should unlock it
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 3 });
    expect(r).toContain("combo_3_bronze");
    // combo_4_bronze threshold is 1 — but combo4Count is 0 (comboCount=3 < 4)
    expect(r).not.toContain("combo_4_bronze");
    // combo_2_bronze threshold is 3 — only 1 increment so far
    expect(r).not.toContain("combo_2_bronze");
  });

  // ── Stats: gameOver counter increments ───────────────────────────────────────

  it("gameOver with score=0 increments playCount and unlocks zero_score", () => {
    const r = checkTrophies({ type: "gameOver", score: 0 });
    expect(r).toContain("zero_score");
    // score100Count NOT incremented (0 < 100)
    expect(r).not.toContain("score_100_bronze");
  });

  it("gameOver with score=350 increments score100Count and score300Count but not score500Count", () => {
    const r = checkTrophies({ type: "gameOver", score: 350 });
    expect(r).toContain("score_100_bronze");  // threshold=1
    expect(r).toContain("score_300_bronze");  // threshold=1
    expect(r).not.toContain("score_500_bronze");
  });

  it("play_bronze unlocks after exactly 10 gameOver events", () => {
    for (let i = 0; i < 9; i++) {
      const r = checkTrophies({ type: "gameOver", score: 0 });
      expect(r).not.toContain("play_bronze");
    }
    const r = checkTrophies({ type: "gameOver", score: 0 });
    expect(r).toContain("play_bronze");
  });

  // ── Per-number trophies ───────────────────────────────────────────────────────

  it("num_1_bronze unlocks when slide has exactly 3 tiles of value 1", () => {
    const grid = makeGrid([
      [1, 1, 1, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).not.toContain("num_1_silver"); // needs 4
  });

  it("num_1_diamond unlocks when slide has 6 tiles of value 1", () => {
    const grid = makeGrid([
      [1, 1, 1, 1],
      [1, 1, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).toContain("num_1_silver");
    expect(r).toContain("num_1_gold");
    expect(r).toContain("num_1_diamond");
  });

  it("num_9_bronze unlocks when slide has 3 tiles of value 9", () => {
    const grid = makeGrid([
      [9, 9, 9, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("num_9_bronze");
  });

  it("num_9_bronze does NOT unlock with 2 tiles of value 9", () => {
    const grid = makeGrid([
      [9, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("num_9_bronze");
  });

  it("num_5_gold unlocks when slide has 5 tiles of value 5", () => {
    const grid = makeGrid([
      [5, 5, 5, 5],
      [5, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_5_gold");
    expect(r).not.toContain("num_5_diamond"); // needs 6
  });

  // ── Combo count trophies ──────────────────────────────────────────────────────

  it("combo_2_bronze unlocks after 3 slides with comboCount ≥ 2", () => {
    for (let i = 0; i < 2; i++) {
      const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
      expect(r).not.toContain("combo_2_bronze");
    }
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    expect(r).toContain("combo_2_bronze");
  });

  it("combo_4_bronze unlocks on first slide with comboCount ≥ 4 (threshold=1)", () => {
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 });
    expect(r).toContain("combo_4_bronze");
  });

  it("combo_4_diamond NOT unlocked until 20 slides with comboCount ≥ 4", () => {
    for (let i = 0; i < 19; i++) {
      checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 });
    }
    // Not yet after 19
    const r19 = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 });
    // 20th slide should unlock diamond
    expect(r19).toContain("combo_4_diamond");
  });

  // ── combo_5 single achievement (unchanged) ───────────────────────────────────

  it("combo_5 unlocks on first slide with comboCount ≥ 5", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 })).toContain("combo_5");
  });

  it("combo_5 does NOT unlock at comboCount 4", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 })).not.toContain("combo_5");
  });

  // ── Score milestone trophies ──────────────────────────────────────────────────

  it("score_100_bronze unlocks on first game with score ≥ 100", () => {
    const r = checkTrophies({ type: "gameOver", score: 100 });
    expect(r).toContain("score_100_bronze");
  });

  it("score_1000_bronze unlocks on first game with score ≥ 1000", () => {
    const r = checkTrophies({ type: "gameOver", score: 1000 });
    expect(r).toContain("score_1000_bronze");
    expect(r).not.toContain("score_1000_silver"); // needs 2×
  });

  it("score_300_silver unlocks after 3 games with score ≥ 300 (threshold=3)", () => {
    checkTrophies({ type: "gameOver", score: 300 });
    checkTrophies({ type: "gameOver", score: 400 });
    const r = checkTrophies({ type: "gameOver", score: 350 });
    expect(r).toContain("score_300_silver");
  });

  // ── Board clear ───────────────────────────────────────────────────────────────

  it("board_clear unlocks when slide produces an all-null grid", () => {
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 0 });
    expect(r).toContain("board_clear");
  });

  it("board_clear does NOT unlock when one tile remains", () => {
    const grid = makeGrid([
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("board_clear");
  });

  // ── Special: almost_full (unchanged threshold) ────────────────────────────────

  it("almost_full unlocks when grid has ≥ 15 non-null tiles", () => {
    const grid = makeGrid([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, 6, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("almost_full");
  });

  it("almost_full does NOT unlock with 14 non-null tiles", () => {
    const grid = makeGrid([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("almost_full");
  });

  // ── Deduplication ─────────────────────────────────────────────────────────────

  it("already-unlocked trophy is NOT returned again by checkTrophies", () => {
    checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 });
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 });
    expect(r).not.toContain("combo_5");
  });

  // ── getTrophyDef ──────────────────────────────────────────────────────────────

  it("getTrophyDef returns correct def for num_9_diamond", () => {
    const def = getTrophyDef("num_9_diamond");
    expect(def).toBeDefined();
    expect(def!.name).toBe("九的霸主");
    expect(def!.category).toBe("numbers");
  });

  it("getTrophyDef returns correct def for combo_5", () => {
    const def = getTrophyDef("combo_5");
    expect(def).toBeDefined();
    expect(def!.name).toBe("連鎖大師");
  });

  it("getTrophyDef returns undefined for unknown id", () => {
    expect(getTrophyDef("unknown_id")).toBeUndefined();
  });

  it("getTrophyDef returns undefined for retired id one_flood", () => {
    expect(getTrophyDef("one_flood")).toBeUndefined();
  });

  // ── loadTrophyStatuses post-unlock ────────────────────────────────────────────

  it("loadTrophyStatuses reflects unlocked state after checkTrophies", () => {
    checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 });
    const statuses = loadTrophyStatuses();
    const combo5 = statuses.find((s) => s.def.id === "combo_5")!;
    expect(combo5.unlocked).toBe(true);
    expect(combo5.unlockedAt).toBeTypeOf("number");
    const zeroScore = statuses.find((s) => s.def.id === "zero_score")!;
    expect(zeroScore.unlocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm tests FAIL**

```bash
cd /Users/kyo.lai82/Projects/Personal/game-factory/workspace
npm run test:unit
```

Expected: many FAILs — `loadTrophyStatuses().length` is 8 not 76, `num_1_bronze` not found, etc.

- [ ] **Step 3: Commit the failing tests**

```bash
git add workspace/tests/unit/trophies.test.ts
git commit -m "test: rewrite trophies unit tests for 76-trophy expansion (RED)"
```

---

### Task 2: Rewrite `trophies.ts` (GREEN)

**Files:**
- Modify: `workspace/src/trophies.ts`

Replace the **entire** contents of `workspace/src/trophies.ts` with the following:

- [ ] **Step 1: Replace the full file content**

```typescript
import { type GameGrid } from "./grid";

// ── Public types ──────────────────────────────────────────────────────────────

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "numbers" | "combos" | "scores" | "play" | "special";
}

export interface TrophyStatus {
  def: TrophyDef;
  unlocked: boolean;
  unlockedAt: number | null;
}

export type TrophyCheckEvent =
  | { type: "slide"; grid: GameGrid; comboCount: number }
  | { type: "gameOver"; score: number };

// ── Internal types ────────────────────────────────────────────────────────────

interface GameStats {
  playCount: number;
  combo1Count: number;
  combo2Count: number;
  combo3Count: number;
  combo4Count: number;
  score100Count: number;
  score300Count: number;
  score500Count: number;
  score1000Count: number;
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
const STATS_KEY = "mathMerge10Stats";

const EMPTY_STATS: GameStats = {
  playCount: 0,
  combo1Count: 0,
  combo2Count: 0,
  combo3Count: 0,
  combo4Count: 0,
  score100Count: 0,
  score300Count: 0,
  score500Count: 0,
  score1000Count: 0,
};

function loadUnlocked(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function loadStats(): GameStats {
  try {
    return {
      ...EMPTY_STATS,
      ...(JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") as Partial<GameStats>),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
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
    ["bronze", "🥉", `${n}的初現`, 3],
    ["silver", "🥈", `${n}的聚集`, 4],
    ["gold", "🥇", `${n}的洪流`, 5],
    ["diamond", "💎", `${n}的霸主`, 6],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `num_${value}_${tier}`,
    name,
    icon,
    category: "numbers" as const,
    description: `版面上同時出現 ${threshold} 個或以上的「${value}」`,
    check: ({ event }) =>
      event.type === "slide" && countValue(event.grid, value) >= threshold,
  }));
}

function comboCountTrophies(
  n: number,
  thresholds: [number, number, number, number],
  names: [string, string, string, string],
  getCount: (stats: GameStats) => number,
): TrophyRule[] {
  const tiers: Array<[string, string, string, number]> = [
    ["bronze", "🥉", names[0], thresholds[0]],
    ["silver", "🥈", names[1], thresholds[1]],
    ["gold", "🥇", names[2], thresholds[2]],
    ["diamond", "💎", names[3], thresholds[3]],
  ];
  const desc = n === 1 ? "消除任意對數" : `達到 ${n} 連鎖`;
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `combo_${n}_${tier}`,
    name,
    icon,
    category: "combos" as const,
    description: `${desc} ${threshold} 次`,
    check: ({ stats }) => getCount(stats) >= threshold,
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
    ["gold", "🥇", `${label}習慣`, thresholds[2]],
    ["diamond", "💎", `${label}大師`, thresholds[3]],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `score_${score}_${tier}`,
    name,
    icon,
    category: "scores" as const,
    description: `得分達到 ${score} 分 ${threshold} 次`,
    check: ({ stats }) => getCount(stats) >= threshold,
  }));
}

// ── Trophy definitions ────────────────────────────────────────────────────────

const TROPHY_DEFS: TrophyRule[] = [
  // 數字系列 (36)
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(numTrophies),

  // 連鎖系列 (17)
  ...comboCountTrophies(1, [10, 50, 200, 500], ["消除初手", "消除熟手", "消除達人", "消除傳說"], (s) => s.combo1Count),
  ...comboCountTrophies(2, [3, 15, 50, 100],   ["連鎖初學", "連鎖進階", "連鎖精通", "連鎖宗師"], (s) => s.combo2Count),
  ...comboCountTrophies(3, [1, 5, 20, 50],     ["連鎖高手", "連鎖大將", "連鎖傳奇", "連鎖神話"], (s) => s.combo3Count),
  ...comboCountTrophies(4, [1, 3, 8, 20],      ["連鎖達人", "連鎖精英", "連鎖王者", "連鎖霸主"], (s) => s.combo4Count),
  {
    id: "combo_5", name: "連鎖大師", icon: "🌟", category: "combos",
    description: "一次消除 5 對或以上",
    check: ({ event }) => event.type === "slide" && event.comboCount >= 5,
  },

  // 分數里程碑 (16)
  ...scoreTrophies(100,  [1, 5, 20, 50], "百分", (s) => s.score100Count),
  ...scoreTrophies(300,  [1, 3, 10, 25], "三百", (s) => s.score300Count),
  ...scoreTrophies(500,  [1, 2, 5, 15],  "五百", (s) => s.score500Count),
  ...scoreTrophies(1000, [1, 2, 5, 10],  "千分", (s) => s.score1000Count),

  // 遊玩成就 (5)
  { id: "play_bronze",  name: "新手冒險", icon: "🥉", category: "play", description: "遊玩 10 局",  check: ({ stats }) => stats.playCount >= 10 },
  { id: "play_silver",  name: "進階玩家", icon: "🥈", category: "play", description: "遊玩 50 局",  check: ({ stats }) => stats.playCount >= 50 },
  { id: "play_gold",    name: "資深玩家", icon: "🥇", category: "play", description: "遊玩 100 局", check: ({ stats }) => stats.playCount >= 100 },
  { id: "play_diamond", name: "遊戲達人", icon: "💎", category: "play", description: "遊玩 500 局", check: ({ stats }) => stats.playCount >= 500 },
  {
    id: "board_clear", name: "天地清明", icon: "✨", category: "play",
    description: "一局遊戲中將盤面完全清空",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) === 0,
  },

  // 特殊成就 (2)
  {
    id: "zero_score", name: "空手而歸", icon: "🕊️", category: "special",
    description: "完成一場遊戲，得分為零",
    check: ({ event }) => event.type === "gameOver" && event.score === 0,
  },
  {
    id: "almost_full", name: "滿溢邊緣", icon: "💥", category: "special",
    description: "版面上同時有 15 格或以上非空的格子",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) >= 15,
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function checkTrophies(event: TrophyCheckEvent): string[] {
  const stats = loadStats();
  let statsChanged = false;

  if (event.type === "slide") {
    if (event.comboCount >= 1) { stats.combo1Count++; statsChanged = true; }
    if (event.comboCount >= 2) { stats.combo2Count++; statsChanged = true; }
    if (event.comboCount >= 3) { stats.combo3Count++; statsChanged = true; }
    if (event.comboCount >= 4) { stats.combo4Count++; statsChanged = true; }
  } else {
    stats.playCount++;
    if (event.score >= 100)  stats.score100Count++;
    if (event.score >= 300)  stats.score300Count++;
    if (event.score >= 500)  stats.score500Count++;
    if (event.score >= 1000) stats.score1000Count++;
    statsChanged = true;
  }

  if (statsChanged) saveStats(stats);

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

  if (newlyUnlocked.length > 0) {
    localStorage.setItem(TROPHY_KEY, JSON.stringify(unlocked));
  }
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
```

- [ ] **Step 2: Run unit tests to confirm they pass**

```bash
cd /Users/kyo.lai82/Projects/Personal/game-factory/workspace
npm run test:unit
```

Expected: all tests GREEN.

- [ ] **Step 3: Commit**

```bash
git add workspace/src/trophies.ts
git commit -m "feat: rewrite trophies module with 76 trophies, stats counters, and category system"
```

---

### Task 3: Category headers in modal + CSS + E2E tests

**Files:**
- Modify: `workspace/src/game.ts` (lines ~540–548, `renderTrophyModal` only)
- Modify: `workspace/index.html` (add `.tm-category-header` CSS rule)
- Modify: `workspace/tests/e2e/ux-v2.spec.ts` (update existing trophy tests)

- [ ] **Step 1: Write failing E2E tests for category modal**

In `workspace/tests/e2e/ux-v2.spec.ts`, find the existing trophy tests (lines containing `"Trophy:"`) and replace ALL of them with:

```typescript
test("Trophy: 🏆 button is visible in HUD", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  await expect(page.locator("#hud-trophy")).toBeVisible();
});

test("Trophy: modal opens and shows category headers", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  // Category headers
  await expect(page.locator(".tm-category-header").first()).toBeVisible();
  const headers = page.locator(".tm-category-header");
  await expect(headers).toHaveCount(5);
  // Spot-check some trophy names from different categories
  await expect(page.locator("#trophy-modal-list")).toContainText("一的初現");
  await expect(page.locator("#trophy-modal-list")).toContainText("消除初手");
  await expect(page.locator("#trophy-modal-list")).toContainText("百分首達");
  await expect(page.locator("#trophy-modal-list")).toContainText("新手冒險");
  await expect(page.locator("#trophy-modal-list")).toContainText("空手而歸");
});

test("Trophy: clicking overlay closes trophy modal", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  await page.locator("#trophy-modal-overlay").click();
  await expect(page.locator("#trophy-modal")).toBeHidden();
});

test("Trophy: combo_2_bronze unlocks after 3 slides with 2-combo and shows toast", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  // Clear any persisted localStorage from previous tests
  await page.evaluate(() => localStorage.clear());

  // Do 3 slides that each produce comboCount=2
  // Grid: two pairs side by side — sliding left eliminates both = comboCount 2
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      (window as any).__setTestState({
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
    await page.waitForTimeout(120);
  }

  // Toast should appear for combo_2_bronze (連鎖初學)
  await expect(page.locator("#trophy-toast")).toContainText("連鎖初學");
});

test("Trophy: unlocked trophy shows ✓ in modal", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.evaluate(() => localStorage.clear());

  // Unlock combo_5 (single achievement — first slide with comboCount ≥ 5)
  await page.evaluate(() => {
    (window as any).__setTestState({
      grid: [
        [1, 9, 2, 8],
        [3, 7, 4, 6],
        [5, 5, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);

  await page.locator("#hud-trophy").click();
  const combo5Item = page.locator("#trophy-modal-list li").filter({ hasText: "連鎖大師" });
  await expect(combo5Item.locator(".tm-check")).toBeVisible();
});
```

- [ ] **Step 2: Run E2E tests to confirm new tests FAIL**

```bash
cd /Users/kyo.lai82/Projects/Personal/game-factory/workspace
npm run test:e2e -- --grep "Trophy:"
```

Expected: FAIL — `.tm-category-header` not found, `一的初現` not in modal (modal still groups flat), `連鎖初手` not found (old combo name).

- [ ] **Step 3: Update `renderTrophyModal` in `game.ts`**

In `workspace/src/game.ts`, find `function renderTrophyModal()` (~line 540) and replace the entire function:

```typescript
function renderTrophyModal(): void {
  const CATEGORY_LABELS: Record<string, string> = {
    numbers: "數字系列",
    combos: "連鎖系列",
    scores: "分數里程碑",
    play: "遊玩成就",
    special: "特殊成就",
  };
  trophyModalListEl.innerHTML = "";
  let currentCategory = "";
  loadTrophyStatuses().forEach(({ def, unlocked }) => {
    if (def.category !== currentCategory) {
      currentCategory = def.category;
      const header = document.createElement("li");
      header.classList.add("tm-category-header");
      header.textContent = CATEGORY_LABELS[def.category] ?? def.category;
      trophyModalListEl.appendChild(header);
    }
    const li = document.createElement("li");
    if (!unlocked) li.classList.add("tm-locked");
    li.innerHTML = `<span class="tm-icon">${def.icon}</span><span class="tm-body"><strong>${def.name}</strong>${unlocked ? '<span class="tm-check">✓</span>' : ""}<small>${def.description}</small></span>`;
    trophyModalListEl.appendChild(li);
  });
}
```

- [ ] **Step 4: Add `.tm-category-header` CSS to `index.html`**

In `workspace/index.html`, find the `.tm-check` rule at the bottom of the `<style>` block and add after it:

```css
    .tm-category-header {
      font-size: 11px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 8px 0 2px;
      border-top: 1px solid #374151;
      margin-top: 4px;
      list-style: none;
    }
    .tm-category-header:first-child {
      border-top: none;
      margin-top: 0;
      padding-top: 0;
    }
```

- [ ] **Step 5: Run E2E tests to confirm they pass**

```bash
cd /Users/kyo.lai82/Projects/Personal/game-factory/workspace
npm run test:e2e -- --grep "Trophy:"
```

Expected: all Trophy tests GREEN.

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
npm run test:unit && npm run test:e2e
```

Expected: all tests green.

- [ ] **Step 7: Commit**

```bash
git add workspace/src/game.ts workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: add trophy modal category headers and update E2E tests for 76-trophy system"
```
