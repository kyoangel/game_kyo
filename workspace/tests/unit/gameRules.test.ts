import { describe, it, expect } from "vitest";
import {
  slideRowLeft,
  slide,
  isGameOver,
  applyMove,
  type GameGrid,
  type GameState,
} from "../../src/grid";

describe("slideRowLeft — edge cases", () => {
  it("merges 5+5=10 (self-pair) and scores 10", () => {
    const result = slideRowLeft([5, 5, null, null]);

    expect(result.row).toEqual([null, null, null, null]);
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(10);
  });

  it("compacts across a gap then merges: [4, null, 6, null] → all null, score 10", () => {
    const result = slideRowLeft([4, null, 6, null]);

    expect(result.row).toEqual([null, null, null, null]);
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(10);
  });

  it("does not merge a non-10 pair even after compaction: [3, null, 5, null] → [3, 5, null, null]", () => {
    const result = slideRowLeft([3, null, 5, null]);

    expect(result.row).toEqual([3, 5, null, null]);
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(0);
  });

  it("merges only the first valid pair and leaves the third tile: [3, 4, 6, null] → [3, null, null, null]", () => {
    const result = slideRowLeft([3, 4, 6, null]);

    expect(result.row).toEqual([3, null, null, null]);
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(10);
  });
});

describe("slide — additional direction coverage", () => {
  it("right: merges pairs adjacent after reversing and returns correct grid", () => {
    const grid: GameGrid = [
      [null, null, 4, 6],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    const outcome = slide(grid, "right");

    expect(outcome.grid[0]).toEqual([null, null, null, null]);
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(10);
  });

  it("up: merges pairs adjacent in the same column after sliding upward", () => {
    const grid: GameGrid = [
      [4, null, null, null],
      [6, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    const outcome = slide(grid, "up");

    expect(outcome.grid[0][0]).toBeNull();
    expect(outcome.grid[1][0]).toBeNull();
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(10);
  });

  it("down: merges pairs adjacent in the same column after sliding downward", () => {
    const grid: GameGrid = [
      [null, null, null, null],
      [null, null, null, null],
      [4, null, null, null],
      [6, null, null, null],
    ];

    const outcome = slide(grid, "down");

    expect(outcome.grid[3][0]).toBeNull();
    expect(outcome.grid[2][0]).toBeNull();
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(10);
  });
});

describe("isGameOver — explicit false cases", () => {
  it("returns false when the grid has at least one empty cell", () => {
    const grid: GameGrid = [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, null],
    ];

    expect(isGameOver(grid)).toBe(false);
  });

  it("returns false when the full grid has a vertical merge available", () => {
    // All cells filled but column 0 has 4 on top of 6 → can merge by sliding down
    const grid: GameGrid = [
      [4, 1, 2, 1],
      [6, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
    ];

    expect(isGameOver(grid)).toBe(false);
  });
});

describe("applyMove — all directions", () => {
  it("right: eliminates pair, scores 10, and spawns a new tile", () => {
    const state: GameState = {
      grid: [
        [null, null, 4, 6],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const rng = () => 0;

    const result = applyMove(state, "right", rng);

    expect(result.score).toBe(10);
    const filled = result.grid.flat().filter((c): c is number => c !== null);
    expect(filled).toHaveLength(1);
  });

  it("up: eliminates a column pair, scores 10, and spawns a new tile", () => {
    const state: GameState = {
      grid: [
        [4, null, null, null],
        [6, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const rng = () => 0;

    const result = applyMove(state, "up", rng);

    expect(result.score).toBe(10);
    const filled = result.grid.flat().filter((c): c is number => c !== null);
    expect(filled).toHaveLength(1);
  });

  it("down: eliminates a column pair, scores 10, and spawns a new tile", () => {
    const state: GameState = {
      grid: [
        [null, null, null, null],
        [null, null, null, null],
        [4, null, null, null],
        [6, null, null, null],
      ],
      score: 0,
    };
    const rng = () => 0;

    const result = applyMove(state, "down", rng);

    expect(result.score).toBe(10);
    const filled = result.grid.flat().filter((c): c is number => c !== null);
    expect(filled).toHaveLength(1);
  });

  it("does not spawn or change state when slide direction changes nothing", () => {
    const state: GameState = {
      grid: [
        [4, 7, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 5,
    };
    const rng = () => 0;

    expect(applyMove(state, "left", rng)).toEqual(state);
    expect(applyMove(state, "up", rng)).toEqual(state);
  });
});
