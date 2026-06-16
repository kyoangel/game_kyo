import { describe, it, expect } from "vitest";
import { changedCells } from "../../src/gridDiff";
import type { GameGrid } from "../../src/grid";

describe("changedCells", () => {
  it("returns an empty array when no cells changed", () => {
    const grid: GameGrid = [
      [1, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    expect(changedCells(grid, grid)).toEqual([]);
  });

  it("reports a newly spawned tile", () => {
    const prev: GameGrid = [
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const next: GameGrid = [
      [1, null, null, null],
      [null, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    expect(changedCells(prev, next)).toEqual([{ row: 1, col: 1 }]);
  });

  it("reports both the merge result cell and the cell that became empty", () => {
    const prev: GameGrid = [
      [4, 6, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const next: GameGrid = [
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    expect(changedCells(prev, next)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });
});
