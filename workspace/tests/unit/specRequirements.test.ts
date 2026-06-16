import { describe, it, expect } from "vitest";
import {
  slideRowLeft,
  slide,
  isGameOver,
  applyMove,
  createInitialState,
  type GameGrid,
  type GameState,
} from "../../src/grid";

// ─── 基本合併 ──────────────────────────────────────────────────────────────────
// Spec: 相鄰兩數字相加為 10 時會消除並加分
describe("基本合併 — all 10-sum pairs", () => {
  it("1+9=10: both tiles eliminated, score +10", () => {
    const result = slideRowLeft([1, 9, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("2+8=10: both tiles eliminated, score +10", () => {
    const result = slideRowLeft([2, 8, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("3+7=10: both tiles eliminated, score +10", () => {
    const result = slideRowLeft([3, 7, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("9+1=10 (reversed pair): both tiles eliminated after right-slide", () => {
    // Row [1, 9, null, null] slid right: becomes [null, null, 1, 9] after pack,
    // then rightmost pair 1+9 tries to merge in reversed view — actually 9 is at
    // col 3 and 1 at col 2. Reversed: [null, null, 9, 1]. slideRowLeft sees [9, 1]
    // → 9+1=10 → merged. Then un-reverse → [null, null, null, null].
    const grid: GameGrid = [
      [null, null, 1, 9],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "right");
    expect(outcome.grid[0]).toEqual([null, null, null, null]);
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.moved).toBe(true);
  });

  it("merge not at row start: [1, 2, 8, null] → [1, null, null, null], score 10", () => {
    // After compact: [1, 2, 8, null] is already compacted. i=0: 1+2=3 ≠ 10, push 1.
    // i=1: 2+8=10, merge, score+10, i=3. merged=[1]. Row=[1,null,null,null].
    const result = slideRowLeft([1, 2, 8, null]);
    expect(result.row).toEqual([1, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("4+6=10: both tiles eliminated, score +10", () => {
    const result = slideRowLeft([4, 6, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("5+5=10 (self-pair): both tiles eliminated, score +10", () => {
    const result = slideRowLeft([5, 5, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("non-10 pair does not merge: [3, 8, null, null] stays [3, 8, null, null]", () => {
    const result = slideRowLeft([3, 8, null, null]);
    expect(result.row).toEqual([3, 8, null, null]);
    expect(result.scoreGained).toBe(0);
    expect(result.moved).toBe(false);
  });

  it("all-null row: nothing moves, scoreGained=0", () => {
    const result = slideRowLeft([null, null, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(0);
    expect(result.moved).toBe(false);
  });
});

// ─── 連鎖反應 ──────────────────────────────────────────────────────────────────
// Spec: 一次滑動觸發多組合併
describe("連鎖反應 — multiple pairs eliminated in one slide", () => {
  it("two pairs in one row [1,9,2,8] all eliminated, score 20", () => {
    const result = slideRowLeft([1, 9, 2, 8]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(20);
    expect(result.moved).toBe(true);
  });

  it("two rows each with a mergeable pair: applyMove scores 20 in one move", () => {
    const state: GameState = {
      grid: [
        [3, 7, null, null],
        [2, 8, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const result = applyMove(state, "left", () => 0);
    expect(result.score).toBe(20);
    const filled = result.grid.flat().filter((c): c is number => c !== null);
    expect(filled).toHaveLength(1);
  });

  it("four rows each with a mergeable pair: applyMove scores 40 in one move", () => {
    const state: GameState = {
      grid: [
        [1, 9, null, null],
        [2, 8, null, null],
        [3, 7, null, null],
        [4, 6, null, null],
      ],
      score: 0,
    };
    const result = applyMove(state, "left", () => 0);
    expect(result.score).toBe(40);
  });

  it("column chain reaction: two column pairs eliminated by sliding up", () => {
    const grid: GameGrid = [
      [1, 2, null, null],
      [9, 8, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "up");
    expect(outcome.grid[0][0]).toBeNull();
    expect(outcome.grid[1][0]).toBeNull();
    expect(outcome.grid[0][1]).toBeNull();
    expect(outcome.grid[1][1]).toBeNull();
    expect(outcome.scoreGained).toBe(20);
    expect(outcome.moved).toBe(true);
  });
});

// ─── 4x4 滿格且無法合併 → Game Over ──────────────────────────────────────────
// Spec: 當盤面填滿且任何方向的滑動都無法移動或合併任何方塊時，遊戲結束
describe("isGameOver — 4×4 full grid scenarios", () => {
  it("returns true for a 3-4 alternating full grid (no adjacent pair sums to 10)", () => {
    // 3+4=7, 4+3=7 — no horizontal or vertical neighbour sums to 10
    const grid: GameGrid = [
      [3, 4, 3, 4],
      [4, 3, 4, 3],
      [3, 4, 3, 4],
      [4, 3, 4, 3],
    ];
    expect(isGameOver(grid)).toBe(true);
  });

  it("returns true for a full grid using only values 1 and 2 (no pair sums to 10)", () => {
    const grid: GameGrid = [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 1],
    ];
    expect(isGameOver(grid)).toBe(true);
  });

  it("returns false when a full grid contains at least one adjacent 10-sum pair (horizontal)", () => {
    const grid: GameGrid = [
      [1, 9, 3, 4],
      [4, 3, 4, 3],
      [3, 4, 3, 4],
      [4, 3, 4, 3],
    ];
    expect(isGameOver(grid)).toBe(false);
  });

  it("returns false when a full grid contains at least one adjacent 10-sum pair (vertical)", () => {
    const grid: GameGrid = [
      [1, 3, 4, 3],
      [9, 4, 3, 4],
      [3, 4, 3, 4],
      [4, 3, 4, 3],
    ];
    expect(isGameOver(grid)).toBe(false);
  });

  it("returns false when the grid has at least one empty cell", () => {
    const grid: GameGrid = [
      [3, 4, 3, 4],
      [4, 3, 4, 3],
      [3, 4, 3, 4],
      [4, 3, 4, null],
    ];
    expect(isGameOver(grid)).toBe(false);
  });
});

// ─── 無效移動 ─────────────────────────────────────────────────────────────────
// Spec: 無效移動（滑動方向不會改變盤面）時，GameGrid 狀態保持不變
describe("無效移動 — state is preserved exactly", () => {
  it("applyMove returns the same object reference when no movement occurs", () => {
    const state: GameState = {
      grid: [
        [4, 7, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    // Already compacted left; 4+7≠10 → slide left changes nothing
    expect(applyMove(state, "left", () => 0)).toBe(state);
  });

  it("score is not incremented when the slide produces no change", () => {
    const state: GameState = {
      grid: [
        [1, 3, null, null],
        [2, 4, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 100,
    };
    const result = applyMove(state, "left", () => 0);
    expect(result.score).toBe(100);
  });

  it("no new tile is spawned after an invalid move", () => {
    const state: GameState = {
      grid: [
        [1, 3, null, null],
        [2, 4, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const before = state.grid.flat().filter((c): c is number => c !== null).length;
    const result = applyMove(state, "left", () => 0);
    const after = result.grid.flat().filter((c): c is number => c !== null).length;
    expect(after).toBe(before);
  });

  it("slide returns moved=false for every direction when the board cannot change", () => {
    // Full grid with no 10-sum pairs → no direction produces a change
    const grid: GameGrid = [
      [3, 4, 3, 4],
      [4, 3, 4, 3],
      [3, 4, 3, 4],
      [4, 3, 4, 3],
    ];
    const directions = ["left", "right", "up", "down"] as const;
    directions.forEach((dir) => {
      expect(slide(grid, dir).moved).toBe(false);
    });
  });
});

// ─── 初始狀態 ──────────────────────────────────────────────────────────────────
// Spec: 遊戲開始時，盤面上會隨機產生 2 個數字方塊（值為 1-9），分數為 0
describe("初始狀態 — createInitialState", () => {
  it("starts with exactly 2 tiles on a 4×4 grid", () => {
    const state = createInitialState(4, () => 0);
    const tiles = state.grid.flat().filter((c): c is number => c !== null);
    expect(tiles).toHaveLength(2);
  });

  it("starts with score 0", () => {
    const state = createInitialState(4, () => 0);
    expect(state.score).toBe(0);
  });

  it("all starting tiles have values between 1 and 9", () => {
    const state = createInitialState(4, () => 0);
    state.grid.flat().filter((c): c is number => c !== null).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(9);
    });
  });
});

// ─── 成功滑動後產生新方塊 ──────────────────────────────────────────────────────
// Spec: 每次成功滑動（盤面有變化）後，會在剩餘空格中隨機產生一個新的數字方塊（值為 1-9）
describe("成功滑動後產生新方塊 — applyMove spawns exactly one tile", () => {
  it("tile count increases by exactly 1 (net) after a valid move that causes no merge", () => {
    const state: GameState = {
      grid: [
        [null, 3, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const before = state.grid.flat().filter((c): c is number => c !== null).length;
    const result = applyMove(state, "left", () => 0);
    const after = result.grid.flat().filter((c): c is number => c !== null).length;
    expect(after).toBe(before + 1);
  });

  it("tile count is net -1 after a valid move that eliminates one pair (2 removed, 1 spawned)", () => {
    const state: GameState = {
      grid: [
        [4, 6, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const before = state.grid.flat().filter((c): c is number => c !== null).length;
    const result = applyMove(state, "left", () => 0);
    const after = result.grid.flat().filter((c): c is number => c !== null).length;
    expect(after).toBe(before - 1);
  });

  it("spawned tile has a value between 1 and 9", () => {
    const state: GameState = {
      grid: [
        [null, 3, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const result = applyMove(state, "left", () => 0);
    const newTiles = result.grid.flat().filter((c): c is number => c !== null);
    newTiles.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(9);
    });
  });
});
