import { describe, it, expect } from "vitest";
import {
  slideRowLeft,
  slide,
  isGameOver,
  applyMove,
  type GameGrid,
  type GameState,
} from "../../src/grid";

// ─── Down-direction column chain reaction ─────────────────────────────────────
// specRequirements covers "up" column chain; this covers the symmetric "down" case.
describe("連鎖反應 — down direction column chain", () => {
  it("two column pairs at the bottom merge when sliding down, scoring 20", () => {
    const grid: GameGrid = [
      [null, null, null, null],
      [null, null, null, null],
      [1, 2, null, null],
      [9, 8, null, null],
    ];
    const outcome = slide(grid, "down");
    expect(outcome.scoreGained).toBe(20);
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[2][0]).toBeNull();
    expect(outcome.grid[3][0]).toBeNull();
    expect(outcome.grid[2][1]).toBeNull();
    expect(outcome.grid[3][1]).toBeNull();
  });

  it("non-adjacent tiles in same column (3 at top, 7 at bottom) merge when sliding down, scoring 10", () => {
    const grid: GameGrid = [
      [3, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [7, null, null, null],
    ];
    const outcome = slide(grid, "down");
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[3][0]).toBeNull();
    expect(outcome.grid[2][0]).toBeNull();
  });
});

// ─── Right-direction row chain reaction ───────────────────────────────────────
// specRequirements covers "left" row chain; this covers the symmetric "right" case.
describe("連鎖反應 — right direction row chain", () => {
  it("[1, 9, 2, 8] all merge when sliding right, scoring 20", () => {
    const grid: GameGrid = [
      [1, 9, 2, 8],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "right");
    expect(outcome.scoreGained).toBe(20);
    expect(outcome.moved).toBe(true);
    expect(outcome.grid[0]).toEqual([null, null, null, null]);
  });
});

// ─── Same-value chain: [5,5,5,5] ─────────────────────────────────────────────
// Verifies self-pair chain reaction (not a combination of different pairs).
describe("連鎖反應 — same-value chain", () => {
  it("[5,5,5,5] produces two 5+5 merges for 20 points and an all-null row", () => {
    const result = slideRowLeft([5, 5, 5, 5]);
    expect(result.row).toEqual([null, null, null, null]);
    expect(result.scoreGained).toBe(20);
    expect(result.moved).toBe(true);
  });
});

// ─── eliminatedPairs for "down" slide ────────────────────────────────────────
// mergeAnimation tests cover left/right/up; this adds down direction coverage.
describe("slide eliminatedPairs — down direction", () => {
  it("adjacent column pair: a is bottom tile, b is tile above; both meet at their original positions", () => {
    const grid: GameGrid = [
      [null, null, null, null],
      [null, null, null, null],
      [4, null, null, null],
      [6, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "down");
    expect(eliminatedPairs).toHaveLength(1);
    expect(eliminatedPairs[0]).toEqual({
      a: { row: 3, col: 0 },
      b: { row: 2, col: 0 },
      meetA: { row: 3, col: 0 },
      meetB: { row: 2, col: 0 },
    });
  });

  it("non-adjacent column pair: meetB shows 4 sliding to just above 6 at the bottom", () => {
    const grid: GameGrid = [
      [4, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [6, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "down");
    expect(eliminatedPairs).toHaveLength(1);
    // 6 stays at bottom (row 3), 4 slides to row 2 (one above 6)
    expect(eliminatedPairs[0]).toEqual({
      a: { row: 3, col: 0 },
      b: { row: 0, col: 0 },
      meetA: { row: 3, col: 0 },
      meetB: { row: 2, col: 0 },
    });
  });

  it("returns empty eliminatedPairs when no elimination occurs on down slide", () => {
    const grid: GameGrid = [
      [1, null, null, null],
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "down");
    expect(eliminatedPairs).toEqual([]);
  });
});

// ─── Multi-move score accumulation ───────────────────────────────────────────
// Validates that applyMove accumulates score correctly across sequential calls.
describe("multi-move score accumulation", () => {
  it("three sequential merging moves across separate states accumulate to 30", () => {
    let score = 0;
    const pairs: Array<[number, number]> = [[1, 9], [2, 8], [3, 7]];

    pairs.forEach(([a, b]) => {
      const state: GameState = {
        grid: [
          [a, b, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
        score,
      };
      const next = applyMove(state, "left", () => 0);
      score = next.score;
    });

    expect(score).toBe(30);
  });

  it("score carried from previous applyMove is not reset on the next valid move", () => {
    const state0: GameState = {
      grid: [
        [4, 6, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 50,
    };
    const state1 = applyMove(state0, "left", () => 0);
    expect(state1.score).toBe(60);
  });
});

// ─── isGameOver — additional boundary cases ───────────────────────────────────
describe("isGameOver — boundary cases", () => {
  it("returns false for a 6-4 alternating full grid (every adjacent pair sums to 10)", () => {
    const grid: GameGrid = [
      [6, 4, 6, 4],
      [4, 6, 4, 6],
      [6, 4, 6, 4],
      [4, 6, 4, 6],
    ];
    expect(isGameOver(grid)).toBe(false);
  });

  it("returns false for a full grid where 5+5=10 pairs run along a column", () => {
    // Column 0 has [5,5,5,5] — adjacent 5s sum to 10 → moves are possible
    const grid: GameGrid = [
      [5, 1, 2, 1],
      [5, 2, 1, 2],
      [5, 1, 2, 1],
      [5, 2, 1, 2],
    ];
    expect(isGameOver(grid)).toBe(false);
  });
});

// ─── Compaction-only move: score stays 0 ─────────────────────────────────────
// A tile that moves (compaction) but does not produce a 10-sum merge must not earn points.
describe("無效移動 / compaction-only move", () => {
  it("compaction-only slide (move but no merge) does not change the score", () => {
    const state: GameState = {
      grid: [
        [null, 3, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 25,
    };
    const result = applyMove(state, "left", () => 0);
    // 3 slides to col 0, no merge occurs → score stays 25
    expect(result.score).toBe(25);
    expect(result.grid[0][0]).toBe(3);
  });
});
