import { describe, it, expect } from "vitest";
import {
  createEmptyGrid,
  slide,
  canMove,
  isGameOver,
  type Direction,
  type FrozenMask,
  type GameGrid,
} from "../../src/grid";

function emptyMask(size = 4): FrozenMask {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => false));
}

function maskWith(...cells: Array<[number, number]>): FrozenMask {
  const mask = emptyMask();
  cells.forEach(([row, col]) => {
    mask[row][col] = true;
  });
  return mask;
}

describe("slide with a frozen mask", () => {
  it("a frozen tile does not move and tiles stop against it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, 3, null, 5];
    const outcome = slide(grid, "left", maskWith([0, 1]));
    expect(outcome.grid[0]).toEqual([null, 3, 5, null]);
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(0);
  });

  it("a frozen tile can be eliminated by a tile sliding up against it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, 4, null, 6];
    const outcome = slide(grid, "left", maskWith([0, 1]));
    expect(outcome.grid[0]).toEqual([null, null, null, null]);
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 1 },
        b: { row: 0, col: 3 },
        meetA: { row: 0, col: 1 },
        meetB: { row: 0, col: 2 },
      },
    ]);
  });

  it("a frozen tile can be eliminated by a full run already touching it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [2, 6, 4, null];
    const outcome = slide(grid, "left", maskWith([0, 2]));
    expect(outcome.grid[0]).toEqual([2, null, null, null]);
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 1 },
        b: { row: 0, col: 2 },
        meetA: { row: 0, col: 1 },
        meetB: { row: 0, col: 2 },
      },
    ]);
  });

  it("a gap between a tile and the frozen wall prevents a left-side pairing", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [6, null, 4, null];
    const outcome = slide(grid, "left", maskWith([0, 2]));
    expect(outcome.grid[0]).toEqual([6, null, 4, null]);
    expect(outcome.moved).toBe(false);
  });

  it("works vertically: up eliminates a frozen tile at the top", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[3][0] = 9;
    const outcome = slide(grid, "up", maskWith([0, 0]));
    expect(outcome.grid).toEqual(createEmptyGrid(4));
    expect(outcome.eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 0 },
        b: { row: 3, col: 0 },
        meetA: { row: 0, col: 0 },
        meetB: { row: 1, col: 0 },
      },
    ]);
  });

  it("sliding down toward a frozen tile at the top does nothing for a bottom tile", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[3][0] = 9;
    const outcome = slide(grid, "down", maskWith([0, 0]));
    expect(outcome.moved).toBe(false);
    expect(outcome.grid).toEqual(grid);
  });

  it("works to the right: a frozen tile at the right edge stays put", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[1] = [3, null, null, 8];
    const outcome = slide(grid, "right", maskWith([1, 3]));
    expect(outcome.grid[1]).toEqual([null, null, 3, 8]);
  });

  it("a mask entry on an empty cell is ignored", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, null, 5, null];
    const outcome = slide(grid, "left", maskWith([0, 1]));
    expect(outcome.grid[0]).toEqual([5, null, null, null]);
  });

  it("two adjacent frozen tiles never eliminate each other", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [4, 6, null, null];
    const outcome = slide(grid, "left", maskWith([0, 0], [0, 1]));
    expect(outcome.grid[0]).toEqual([4, 6, null, null]);
    expect(outcome.scoreGained).toBe(0);
  });

  it("does not mutate the input grid or mask", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, 4, null, 6];
    const mask = maskWith([0, 1]);
    slide(grid, "left", mask);
    expect(grid[0]).toEqual([null, 4, null, 6]);
    expect(mask[0][1]).toBe(true);
  });

  it("an all-false mask behaves exactly like no mask (seeded random grids)", () => {
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const directions: Direction[] = ["up", "down", "left", "right"];
    for (let n = 0; n < 200; n++) {
      const grid: GameGrid = createEmptyGrid(4).map((row) =>
        row.map(() => (next() < 0.4 ? null : Math.floor(next() * 9) + 1)),
      );
      directions.forEach((direction) => {
        expect(slide(grid, direction, emptyMask())).toEqual(slide(grid, direction));
      });
    }
  });
});

describe("canMove / isGameOver with a frozen mask", () => {
  it("a lone frozen tile cannot move, so the board is stuck", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 5;
    expect(canMove(grid)).toBe(true);
    expect(canMove(grid, maskWith([0, 0]))).toBe(false);
    expect(isGameOver(grid, maskWith([0, 0]))).toBe(true);
    expect(isGameOver(grid)).toBe(false);
  });
});
