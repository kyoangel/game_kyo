import { describe, it, expect } from "vitest";
import {
  STONE,
  createEmptyGrid,
  breakAdjacentStones,
  eliminationSites,
  slide,
  type GameGrid,
} from "../../src/grid";

describe("breakAdjacentStones", () => {
  it("breaks a stone orthogonally adjacent to an eliminated cell", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][1] = STONE;
    const result = breakAdjacentStones(grid, [{ row: 0, col: 0 }]);
    expect(result.grid[0][1]).toBeNull();
    expect(result.broken).toEqual([{ row: 0, col: 1 }]);
  });

  it("checks all four directions", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][1] = STONE;
    grid[2][1] = STONE;
    grid[1][0] = STONE;
    grid[1][2] = STONE;
    const result = breakAdjacentStones(grid, [{ row: 1, col: 1 }]);
    expect(result.broken).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
    ]);
    expect(result.grid).toEqual(createEmptyGrid(4));
  });

  it("does not break diagonal stones or distant stones", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[1][1] = STONE;
    grid[3][3] = STONE;
    const result = breakAdjacentStones(grid, [{ row: 0, col: 0 }]);
    expect(result.broken).toEqual([]);
    expect(result.grid[1][1]).toBe(STONE);
    expect(result.grid[3][3]).toBe(STONE);
  });

  it("breaks a stone touching two eliminated cells only once", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][1] = STONE;
    const result = breakAdjacentStones(grid, [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ]);
    expect(result.broken).toEqual([{ row: 0, col: 1 }]);
  });

  it("leaves numeric tiles alone and does not mutate the input", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 7;
    grid[0][1] = STONE;
    const before = JSON.stringify(grid);
    const result = breakAdjacentStones(grid, [{ row: 1, col: 1 }]);
    expect(JSON.stringify(grid)).toBe(before);
    expect(result.grid[0][0]).toBe(7);
    expect(result.broken).toEqual([{ row: 0, col: 1 }]);
  });

  it("tolerates eliminated cells outside the grid", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = STONE;
    const result = breakAdjacentStones(grid, [{ row: -5, col: 0 }, { row: 9, col: 9 }]);
    expect(result.broken).toEqual([]);
    expect(result.grid[0][0]).toBe(STONE);
  });

  it("returns no broken stones for an empty eliminated list", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[2][2] = STONE;
    const result = breakAdjacentStones(grid, []);
    expect(result.broken).toEqual([]);
    expect(result.grid[2][2]).toBe(STONE);
  });
});

describe("eliminationSites", () => {
  it("returns meetA and meetB of every pair, de-duplicated, in pair order", () => {
    const pairs = [
      {
        a: { row: 0, col: 0 },
        b: { row: 0, col: 1 },
        meetA: { row: 0, col: 0 },
        meetB: { row: 0, col: 1 },
      },
      {
        a: { row: 0, col: 2 },
        b: { row: 0, col: 3 },
        meetA: { row: 0, col: 0 },
        meetB: { row: 0, col: 1 },
      },
      {
        a: { row: 1, col: 0 },
        b: { row: 1, col: 1 },
        meetA: { row: 1, col: 0 },
        meetB: { row: 1, col: 1 },
      },
    ];
    expect(eliminationSites(pairs)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it("composes with slide: a pair that merges beside a stone breaks it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [9, 1, null, null];
    grid[1] = [STONE, null, null, null];
    const outcome = slide(grid, "left");
    const result = breakAdjacentStones(outcome.grid, eliminationSites(outcome.eliminatedPairs));
    expect(outcome.eliminatedPairs).toHaveLength(1);
    expect(result.broken).toEqual([{ row: 1, col: 0 }]);
    expect(result.grid[1][0]).toBeNull();
  });
});
