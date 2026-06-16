import { describe, it, expect } from "vitest";
import {
  slideRowLeft,
  slide,
  isGameOver,
  applyMove,
  type GameGrid,
  type GameState,
} from "../../src/grid";

// ─── slideRowLeft edge cases not covered by existing test files ────────────────

describe("slideRowLeft — single tile no-op", () => {
  it("a single tile already at the left stays put, moved=false, scoreGained=0", () => {
    const result = slideRowLeft([5, null, null, null]);
    expect(result.row).toEqual([5, null, null, null]);
    expect(result.moved).toBe(false);
    expect(result.scoreGained).toBe(0);
  });

  it("a single tile not at the left compacts to left, moved=true, scoreGained=0", () => {
    const result = slideRowLeft([null, null, 3, null]);
    expect(result.row).toEqual([3, null, null, null]);
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(0);
  });
});

describe("slideRowLeft — merge at end of fully-populated row", () => {
  it("[3, 2, 4, 6]: first pair does not merge (3+2=5), last pair merges (4+6=10)", () => {
    const result = slideRowLeft([3, 2, 4, 6]);
    expect(result.row).toEqual([3, 2, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("[1, 3, 2, 8]: middle pair merges (2+8=10 after sliding), leading tile survives", () => {
    // values = [1, 3, 2, 8]; 1+3≠10 push 1; 3+2≠10 push 3; 2+8=10 merge, score+10
    const result = slideRowLeft([1, 3, 2, 8]);
    expect(result.row).toEqual([1, 3, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });
});

// ─── applyMove — state identity ───────────────────────────────────────────────

describe("applyMove — state object identity", () => {
  it("returns a NEW object (not same reference) after a valid move", () => {
    const state: GameState = {
      grid: [
        [4, 6, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const result = applyMove(state, "left", () => 0);
    expect(result).not.toBe(state);
    expect(result.score).toBe(10);
  });

  it("returns the SAME reference (strict equality) after an invalid move", () => {
    const state: GameState = {
      grid: [
        [3, 2, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 50,
    };
    const result = applyMove(state, "left", () => 0);
    expect(result).toBe(state);
    expect(result.score).toBe(50);
  });
});

// ─── isGameOver — full vs near-full board boundary ────────────────────────────

describe("isGameOver — 16-cell full board vs 15-cell board", () => {
  it("returns true when all 16 cells are non-null and no adjacent pair sums to 10", () => {
    const grid: GameGrid = [
      [1, 3, 1, 3],
      [3, 1, 3, 1],
      [1, 3, 1, 3],
      [3, 1, 3, 1],
    ];
    // Verify full board (no nulls)
    expect(grid.flat().filter((c) => c === null)).toHaveLength(0);
    // 1+3=4, 3+1=4 — no horizontal or vertical pair sums to 10
    expect(isGameOver(grid)).toBe(true);
  });

  it("returns false when exactly 1 cell is null (tile can compact into it)", () => {
    const grid: GameGrid = [
      [1, 3, 1, 3],
      [3, 1, 3, 1],
      [1, 3, 1, 3],
      [3, 1, 3, null],
    ];
    // The tile at [3][2]=3 can slide right into [3][3]=null → board changes → not game over
    expect(isGameOver(grid)).toBe(false);
  });
});

// ─── slide("down") — multi-column chain reaction ──────────────────────────────

describe("slide 'down' — multiple columns eliminated in one move", () => {
  it("two columns each with a 10-sum pair: both columns cleared, scoreGained=20", () => {
    const grid: GameGrid = [
      [null, null, 4, 3],
      [null, null, 6, 7],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "down");
    expect(outcome.scoreGained).toBe(20);
    expect(outcome.moved).toBe(true);
    // Both columns should be fully cleared after the merge
    expect(outcome.grid.flat().every((c) => c === null)).toBe(true);
  });

  it("down chain reaction: [4,6] and [3,7] in two columns, all eliminated to null", () => {
    const grid: GameGrid = [
      [4, 3, null, null],
      [6, 7, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "down");
    expect(outcome.scoreGained).toBe(20);
    // After merge and settling to bottom, all source cells are null
    expect(outcome.grid[0][0]).toBeNull();
    expect(outcome.grid[1][0]).toBeNull();
    expect(outcome.grid[0][1]).toBeNull();
    expect(outcome.grid[1][1]).toBeNull();
  });
});
