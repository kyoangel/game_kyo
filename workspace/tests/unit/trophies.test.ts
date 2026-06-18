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

  it("combo_2_bronze unlocks after 3 slides with comboCount >= 2", () => {
    for (let i = 0; i < 2; i++) {
      const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
      expect(r).not.toContain("combo_2_bronze");
    }
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    expect(r).toContain("combo_2_bronze");
  });

  it("combo_4_bronze unlocks on first slide with comboCount >= 4 (threshold=1)", () => {
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 });
    expect(r).toContain("combo_4_bronze");
  });

  it("combo_4_diamond unlocks after 20 slides with comboCount >= 4", () => {
    for (let i = 0; i < 19; i++) {
      checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 });
    }
    // 20th slide should unlock diamond
    const r = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 });
    expect(r).toContain("combo_4_diamond");
  });

  // ── combo_5 single achievement (unchanged) ───────────────────────────────────

  it("combo_5 unlocks on first slide with comboCount >= 5", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 })).toContain("combo_5");
  });

  it("combo_5 does NOT unlock at comboCount 4", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 })).not.toContain("combo_5");
  });

  // ── Score milestone trophies ──────────────────────────────────────────────────

  it("score_100_bronze unlocks on first game with score >= 100", () => {
    const r = checkTrophies({ type: "gameOver", score: 100 });
    expect(r).toContain("score_100_bronze");
  });

  it("score_1000_bronze unlocks on first game with score >= 1000", () => {
    const r = checkTrophies({ type: "gameOver", score: 1000 });
    expect(r).toContain("score_1000_bronze");
    expect(r).not.toContain("score_1000_silver"); // needs 2x
  });

  it("score_300_silver unlocks after 3 games with score >= 300 (threshold=3)", () => {
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

  it("almost_full unlocks when grid has >= 15 non-null tiles", () => {
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
