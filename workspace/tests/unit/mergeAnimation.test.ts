import { describe, it, expect } from "vitest";
import { slideRowLeft, slide } from "../../src/grid";

describe("slideRowLeft eliminatedIndices", () => {
  it("returns pair column indices for a single elimination", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 3, null]);
    expect(eliminatedIndices).toEqual([[0, 1]]);
  });

  it("returns two pair indices when two pairs eliminated (combo)", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 5, 5]);
    expect(eliminatedIndices).toEqual([[0, 1], [2, 3]]);
  });

  it("returns empty array when no elimination occurs", () => {
    const { eliminatedIndices } = slideRowLeft([1, 2, 3, null]);
    expect(eliminatedIndices).toEqual([]);
  });

  it("does not change scoreGained or row output", () => {
    const result = slideRowLeft([9, 1, 3, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.row).toEqual([3, null, null, null]);
  });

  it("tracks original column positions (not values-array positions)", () => {
    // null at col 0 — non-null values at cols 1,2,3
    const { eliminatedIndices } = slideRowLeft([null, 9, 1, 3]);
    expect(eliminatedIndices).toEqual([[1, 2]]);
  });
});

describe("slide eliminatedPairs absolute grid coordinates", () => {
  const emptyRows = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ] as const;

  it("maps col indices to absolute coords for left slide", () => {
    const grid = [[9, 1, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([
      { a: { row: 0, col: 0 }, b: { row: 0, col: 1 } },
    ]);
  });

  it("maps reversed col indices to absolute coords for right slide", () => {
    // reversed row → [null,1,9,3], 1 at reversed-col 1 (abs col 2), 9 at reversed-col 2 (abs col 1)
    const grid = [[3, 9, 1, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "right");
    expect(eliminatedPairs).toEqual([
      { a: { row: 0, col: 2 }, b: { row: 0, col: 1 } },
    ]);
  });

  it("maps transposed coords to absolute coords for up slide", () => {
    const grid = [
      [9, null, null, null],
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "up");
    expect(eliminatedPairs).toEqual([
      { a: { row: 0, col: 0 }, b: { row: 1, col: 0 } },
    ]);
  });

  it("returns empty eliminatedPairs when no elimination occurs", () => {
    const grid = [[1, 2, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([]);
  });
});
