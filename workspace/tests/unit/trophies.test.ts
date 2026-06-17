import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { checkTrophies, loadTrophyStatuses, getTrophyDef } from "../../src/trophies";

// Provide a full in-memory localStorage mock for the node test environment
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

  // zero_score
  it("zero_score unlocks when gameOver with score 0", () => {
    const result = checkTrophies({ type: "gameOver", score: 0 });
    expect(result).toContain("zero_score");
  });

  it("zero_score does NOT unlock when score > 0", () => {
    const result = checkTrophies({ type: "gameOver", score: 10 });
    expect(result).not.toContain("zero_score");
  });

  // one_flood
  it("one_flood unlocks when grid has ≥ 5 tiles of value 1", () => {
    const grid = makeGrid([
      [1, 1, 1, 1],
      [1, 2, 3, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("one_flood");
  });

  it("one_flood does NOT unlock with 4 tiles of 1", () => {
    const grid = makeGrid([
      [1, 1, 1, 1],
      [2, 3, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("one_flood");
  });

  // nine_feast
  it("nine_feast unlocks when grid has ≥ 3 tiles of value 9", () => {
    const grid = makeGrid([
      [9, 9, 9, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("nine_feast");
  });

  it("nine_feast does NOT unlock with 2 tiles of 9", () => {
    const grid = makeGrid([
      [9, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("nine_feast");
  });

  // almost_full
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

  // combo trophies
  it("combo_2 unlocks at comboCount 2", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 })).toContain("combo_2");
  });

  it("combo_2 does NOT unlock at comboCount 1", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 1 })).not.toContain("combo_2");
  });

  it("combo_3 unlocks at comboCount 3", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 3 })).toContain("combo_3");
  });

  it("combo_4 unlocks at comboCount 4", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 })).toContain("combo_4");
  });

  it("combo_5 unlocks at comboCount 5", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 })).toContain("combo_5");
  });

  it("combo_5 also unlocks at comboCount 7 (≥ 5)", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 7 })).toContain("combo_5");
  });

  it("comboCount 5 unlocks all four combo trophies at once", () => {
    const result = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 });
    expect(result).toContain("combo_2");
    expect(result).toContain("combo_3");
    expect(result).toContain("combo_4");
    expect(result).toContain("combo_5");
  });

  // deduplication
  it("already-unlocked trophy is NOT returned again by checkTrophies", () => {
    checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    const result = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    expect(result).not.toContain("combo_2");
  });

  // loadTrophyStatuses
  it("loadTrophyStatuses returns exactly 8 entries", () => {
    expect(loadTrophyStatuses()).toHaveLength(8);
  });

  it("loadTrophyStatuses reflects unlocked state after checkTrophies", () => {
    checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    const statuses = loadTrophyStatuses();
    const combo2 = statuses.find((s) => s.def.id === "combo_2")!;
    expect(combo2.unlocked).toBe(true);
    expect(combo2.unlockedAt).toBeTypeOf("number");
    const zeroScore = statuses.find((s) => s.def.id === "zero_score")!;
    expect(zeroScore.unlocked).toBe(false);
    expect(zeroScore.unlockedAt).toBeNull();
  });

  // getTrophyDef
  it("getTrophyDef returns correct def by id", () => {
    const def = getTrophyDef("combo_5");
    expect(def).toBeDefined();
    expect(def!.name).toBe("連鎖大師");
  });

  it("getTrophyDef returns undefined for unknown id", () => {
    expect(getTrophyDef("unknown")).toBeUndefined();
  });
});
