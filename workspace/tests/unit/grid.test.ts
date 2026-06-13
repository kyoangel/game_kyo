import { describe, it, expect } from "vitest";
import {
  createEmptyGrid,
  compactRow,
  slideRowLeft,
  slide,
  canMove,
  type GameGrid,
} from "../../src/grid";

describe("createEmptyGrid", () => {
  it("creates an NxN grid filled with null", () => {
    const grid = createEmptyGrid(4);

    expect(grid).toHaveLength(4);
    grid.forEach((row) => {
      expect(row).toHaveLength(4);
      row.forEach((cell) => {
        expect(cell).toBeNull();
      });
    });
  });
});

describe("compactRow", () => {
  it("compacts non-null values to the left without merging", () => {
    const result = compactRow([null, 4, null, 7]);

    expect(result.row).toEqual([4, 7, null, null]);
    expect(result.moved).toBe(true);
  });

  it("reports moved=false when the row is already compacted", () => {
    const result = compactRow([4, 7, null, null]);

    expect(result.row).toEqual([4, 7, null, null]);
    expect(result.moved).toBe(false);
  });
});

describe("slideRowLeft", () => {
  it("merges a single adjacent pair that sums to 10 and scores 10", () => {
    const result = slideRowLeft([4, 6, null, null]);

    expect(result.row).toEqual([null, null, null, null]);
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(10);
  });

  it("resolves chain reactions in a single call", () => {
    const result = slideRowLeft([4, 6, 4, 6]);

    expect(result.row).toEqual([null, null, null, null]);
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(20);
  });

  it("reports moved=false and scoreGained=0 when nothing can merge or compact", () => {
    const result = slideRowLeft([4, 7, null, null]);

    expect(result.row).toEqual([4, 7, null, null]);
    expect(result.moved).toBe(false);
    expect(result.scoreGained).toBe(0);
  });
});

describe("slide", () => {
  it("slides and merges every row to the left", () => {
    const grid: GameGrid = [
      [null, 4, null, 7],
      [4, 6, null, null],
      [4, 6, 4, 6],
      [4, 7, null, null],
    ];

    const outcome = slide(grid, "left");

    expect(outcome.grid).toEqual([
      [4, 7, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [4, 7, null, null],
    ]);
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(30);
  });

  it("slides and merges every row to the right", () => {
    const grid: GameGrid = [
      [7, null, null, 4],
      [null, null, 4, 6],
      [6, 4, 6, 4],
      [null, null, 4, 7],
    ];

    const outcome = slide(grid, "right");

    expect(outcome.grid).toEqual([
      [null, null, 7, 4],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, 4, 7],
    ]);
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(30);
  });

  it("slides and merges every column upward", () => {
    const grid: GameGrid = [
      [null, 4, 4, 4],
      [4, 6, 6, 7],
      [null, 4, 4, null],
      [7, 6, 6, null],
    ];

    const outcome = slide(grid, "up");

    expect(outcome.grid).toEqual([
      [4, null, null, 4],
      [7, null, null, 7],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(40);
  });

  it("slides and merges every column downward", () => {
    const grid: GameGrid = [
      [4, 4, null, null],
      [7, 6, null, null],
      [null, 4, null, null],
      [null, 6, null, null],
    ];

    const outcome = slide(grid, "down");

    expect(outcome.grid).toEqual([
      [null, null, null, null],
      [null, null, null, null],
      [4, null, null, null],
      [7, null, null, null],
    ]);
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(20);
  });
});

describe("canMove", () => {
  it("returns true when at least one direction would change the grid", () => {
    const grid: GameGrid = [
      [4, 6, 1, 2],
      [3, 5, 7, 8],
      [9, 1, 2, 3],
      [4, 5, 6, 7],
    ];

    expect(canMove(grid)).toBe(true);
  });

  it("returns false when no direction would change a full grid with no merges", () => {
    const grid: GameGrid = [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 1],
    ];

    expect(canMove(grid)).toBe(false);
  });
});
