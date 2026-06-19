import { describe, it, expect } from "vitest";
import {
  slideRowLeft,
  slide,
  createInitialState,
  spawnRandomTile,
  isGameOver,
  canMove,
  createEmptyGrid,
} from "../../src/grid";

describe("slideRowLeft — greedy longest-match", () => {
  it("eliminates a 2-tile pair summing to 10", () => {
    const result = slideRowLeft([1, 9, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].length).toBe(2);
  });

  it("eliminates a 3-tile group summing to 10", () => {
    const result = slideRowLeft([2, 3, 5, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(25);
    expect(result.groups[0].length).toBe(3);
  });

  it("eliminates a 4-tile group summing to 10", () => {
    const result = slideRowLeft([1, 2, 3, 4]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(50);
    expect(result.groups[0].length).toBe(4);
  });

  it("prefers 4-tile over 3-tile: [1,2,3,4] = quad not [1,2,3]+[4]", () => {
    const result = slideRowLeft([1, 2, 3, 4]);
    expect(result.groups[0].length).toBe(4);
  });

  it("prefers 3-tile over 2-tile: [2,3,5,5] — triple then leftover 5", () => {
    const result = slideRowLeft([2, 3, 5, 5]);
    expect(result.row).toEqual([5, null, null, null]);
    expect(result.scoreGained).toBe(25);
    expect(result.groups[0].length).toBe(3);
  });

  it("falls back to 2-tile when no 3/4-tile match: [5,5,null,null]", () => {
    const result = slideRowLeft([5, 5, null, null]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.groups[0].length).toBe(2);
  });

  it("handles two consecutive 2-tile pairs: [3,7,3,7]", () => {
    const result = slideRowLeft([3, 7, 3, 7]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(20);
    expect(result.groups).toHaveLength(2);
  });

  it("handles mixed pair + triple in one row: [1,9,2,3,5,null]", () => {
    const result = slideRowLeft([1, 9, 2, 3, 5, null]);
    expect(result.row).toEqual([null, null, null, null, null, null]);
    expect(result.scoreGained).toBe(35); // 10 + 25
    expect(result.groups).toHaveLength(2);
  });

  it("keeps non-matching tiles", () => {
    const result = slideRowLeft([1, 2, 3, null]);
    expect(result.row).toEqual([1, 2, 3, null]);
    expect(result.scoreGained).toBe(0);
    expect(result.groups).toHaveLength(0);
    expect(result.moved).toBe(false);
  });

  it("compacts tiles left after elimination", () => {
    const result = slideRowLeft([null, 1, 9, 3]);
    expect(result.row).toEqual([3, null, null, null]);
    expect(result.moved).toBe(true);
  });

  it("records original column positions in groups", () => {
    const result = slideRowLeft([2, 3, 5, null]);
    expect(result.groups[0].originalCols).toEqual([0, 1, 2]);
  });
});

describe("slide — 4-direction", () => {
  it("slides left and eliminates pair", () => {
    const grid = [
      [1, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "left");
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.eliminatedGroups).toHaveLength(1);
    expect(outcome.grid[0]).toEqual([null, null, null, null]);
  });

  it("slides right and eliminates pair", () => {
    const grid = [
      [null, null, 1, 9],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "right");
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[0]).toEqual([null, null, null, null]);
  });

  it("slides up and eliminates pair in column", () => {
    const grid = [
      [1, null, null, null],
      [9, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "up");
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[0][0]).toBe(null);
    expect(outcome.grid[1][0]).toBe(null);
  });

  it("returns moved=false when no tile changes", () => {
    const grid = [
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "left");
    expect(outcome.moved).toBe(false);
  });
});

describe("spawnRandomTile — weighted distribution", () => {
  it("always places a tile in an empty cell", () => {
    const grid = createEmptyGrid(4);
    const result = spawnRandomTile(grid);
    const filled = result.flat().filter((c) => c !== null);
    expect(filled).toHaveLength(1);
  });

  it("spawns only values 1-9", () => {
    const grid = createEmptyGrid(4);
    for (let i = 0; i < 50; i++) {
      const result = spawnRandomTile(grid);
      const value = result.flat().find((c) => c !== null)!;
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it("returns grid unchanged when no empty cells", () => {
    const full = Array.from({ length: 4 }, () => [1, 2, 3, 4] as (number | null)[]);
    const result = spawnRandomTile(full);
    expect(result).toEqual(full);
  });

  it("biases toward small values (1-4 > 5-9 in aggregate)", () => {
    const grid = createEmptyGrid(4);
    const counts: Record<number, number> = {};
    for (let i = 0; i < 1000; i++) {
      const result = spawnRandomTile(grid);
      const v = result.flat().find((c) => c !== null)!;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const smallCount = [1, 2, 3, 4].reduce((s, v) => s + (counts[v] ?? 0), 0);
    const largeCount = [5, 6, 7, 8, 9].reduce((s, v) => s + (counts[v] ?? 0), 0);
    expect(smallCount).toBeGreaterThan(largeCount);
  });
});

describe("isGameOver / canMove", () => {
  it("returns false when moves exist", () => {
    const grid = createEmptyGrid(4);
    expect(isGameOver(grid)).toBe(false);
    expect(canMove(grid)).toBe(true);
  });

  it("returns true when no moves exist (full board, no matches)", () => {
    // 1+3=4, 3+1=4, 1+3+1=5, 3+1+3=7 — none sum to 10
    const grid = [
      [1, 3, 1, 3],
      [3, 1, 3, 1],
      [1, 3, 1, 3],
      [3, 1, 3, 1],
    ] as (number | null)[][];
    expect(isGameOver(grid)).toBe(true);
    expect(canMove(grid)).toBe(false);
  });
});

describe("createInitialState", () => {
  it("creates 4x4 grid with 2 tiles", () => {
    const state = createInitialState(4);
    expect(state.grid).toHaveLength(4);
    expect(state.grid[0]).toHaveLength(4);
    const filled = state.grid.flat().filter((c) => c !== null);
    expect(filled).toHaveLength(2);
    expect(state.score).toBe(0);
  });

  it("creates 5x5 grid with 4 tiles", () => {
    const state = createInitialState(5);
    expect(state.grid).toHaveLength(5);
    const filled = state.grid.flat().filter((c) => c !== null);
    expect(filled).toHaveLength(4);
  });
});
