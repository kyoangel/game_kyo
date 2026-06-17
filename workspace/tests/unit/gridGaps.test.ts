import { describe, it, expect } from "vitest";
import { slide, applyMove, type GameGrid, type GameState } from "../../src/grid";

// ─── slide("up") non-adjacent column pair ──────────────────────────────────────
// Existing tests cover adjacent column pairs (rows 0+1) for "up" and non-adjacent
// for "down". This file closes the gap for "up" with tiles separated by null rows.
describe("slide('up') — non-adjacent column pair", () => {
  it("[4, null, null, 6] in col 0 compact and merge when sliding up, scoring 10", () => {
    const grid: GameGrid = [
      [4, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [6, null, null, null],
    ];
    const outcome = slide(grid, "up");
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[0][0]).toBeNull();
    expect(outcome.grid[1][0]).toBeNull();
    expect(outcome.grid[2][0]).toBeNull();
    expect(outcome.grid[3][0]).toBeNull();
  });

  it("[1, null, null, 9] in col 0 compact and merge when sliding up, scoring 10", () => {
    const grid: GameGrid = [
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [9, null, null, null],
    ];
    const outcome = slide(grid, "up");
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[0][0]).toBeNull();
  });

  it("[3, null, 7, null] in col 0 compact and merge when sliding up, scoring 10", () => {
    const grid: GameGrid = [
      [3, null, null, null],
      [null, null, null, null],
      [7, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "up");
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[0][0]).toBeNull();
    expect(outcome.grid[1][0]).toBeNull();
  });

  it("[2, null, 5, null] in col 0 compact but do NOT merge when sliding up (2+5≠10)", () => {
    const grid: GameGrid = [
      [2, null, null, null],
      [null, null, null, null],
      [5, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "up");
    expect(outcome.scoreGained).toBe(0);
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[0][0]).toBe(2);
    expect(outcome.grid[1][0]).toBe(5);
  });
});

// ─── slide("right") single-tile compaction ─────────────────────────────────────
// Ensures that a single leftmost tile moves all the way to the rightmost column
// with moved=true and scoreGained=0 (compaction-only move, no merge).
describe("slide('right') — single tile compaction only", () => {
  it("single tile at col 0 moves to col 3 with moved=true and scoreGained=0", () => {
    const grid: GameGrid = [
      [5, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "right");
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(0);
    expect(outcome.grid[0][3]).toBe(5);
    expect(outcome.grid[0][0]).toBeNull();
    expect(outcome.grid[0][1]).toBeNull();
    expect(outcome.grid[0][2]).toBeNull();
  });
});

// ─── applyMove("up") with non-adjacent pair ────────────────────────────────────
// Integrates the non-adjacent "up" merge into applyMove to confirm score and
// tile-count changes are applied correctly end-to-end.
describe("applyMove('up') — non-adjacent column pair integration", () => {
  it("eliminates a non-adjacent 4+6 column pair, scores 10, and spawns exactly one new tile", () => {
    const state: GameState = {
      grid: [
        [4, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [6, null, null, null],
      ],
      score: 0,
    };
    const result = applyMove(state, "up", () => 0);
    expect(result.score).toBe(10);
    const filled = result.grid.flat().filter((c): c is number => c !== null);
    expect(filled).toHaveLength(1);
  });

  it("does not change the state when the up direction cannot move any tile", () => {
    // All tiles already at the top row; no pairs sum to 10; no movement possible
    const state: GameState = {
      grid: [
        [1, 2, 3, 4],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 7,
    };
    expect(applyMove(state, "up", () => 0)).toBe(state);
  });
});
