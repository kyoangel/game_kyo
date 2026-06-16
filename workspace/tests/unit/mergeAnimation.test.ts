import { describe, it, expect } from "vitest";
import { slideRowLeft, slide } from "../../src/grid";

describe("slideRowLeft eliminatedIndices", () => {
  it("returns [colA, colB, meetACol, meetBCol] for a single elimination at row start", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 3, null]);
    // 9(col0)+1(col1)=10; merged=[] before → meetACol=0, meetBCol=1
    expect(eliminatedIndices).toEqual([[0, 1, 0, 1]]);
  });

  it("returns two tuples when two pairs eliminated (combo)", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 5, 5]);
    // first pair: 9+1, merged=[] → meetA=0,meetB=1; second pair 5+5, merged=[] → meetA=0,meetB=1
    expect(eliminatedIndices).toEqual([[0, 1, 0, 1], [2, 3, 0, 1]]);
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
    const { eliminatedIndices } = slideRowLeft([null, 9, 1, 3]);
    // 9(col1)+1(col2)=10; merged=[] before → meetACol=0, meetBCol=1
    expect(eliminatedIndices).toEqual([[1, 2, 0, 1]]);
  });

  it("non-adjacent pair: meetA/meetB differ from original positions", () => {
    const { eliminatedIndices } = slideRowLeft([null, 3, null, 7]);
    // 3(col1)+7(col3)=10; merged=[] before → meetACol=0, meetBCol=1
    expect(eliminatedIndices).toEqual([[1, 3, 0, 1]]);
  });

  it("pair after a survivor: meetA at survivor count", () => {
    const { eliminatedIndices } = slideRowLeft([1, 2, 8, null]);
    // 2(col1)+8(col2)=10; merged=[1] before → meetACol=1, meetBCol=2
    expect(eliminatedIndices).toEqual([[1, 2, 1, 2]]);
  });
});

describe("slide eliminatedPairs absolute grid coordinates", () => {
  const emptyRows = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ] as const;

  it("left slide: maps col indices and meetA/meetB to absolute coords", () => {
    const grid = [[9, 1, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 0 }, b: { row: 0, col: 1 },
        meetA: { row: 0, col: 0 }, meetB: { row: 0, col: 1 },
      },
    ]);
  });

  it("right slide: maps reversed col indices and meetA/meetB to absolute coords", () => {
    const grid = [[3, 9, 1, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "right");
    // reversed=[null,1,9,3]; 1(pos1)+9(pos2)=10; meetACol=0,meetBCol=1 → mirror: meetA.col=3,meetB.col=2
    expect(eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 2 }, b: { row: 0, col: 1 },
        meetA: { row: 0, col: 3 }, meetB: { row: 0, col: 2 },
      },
    ]);
  });

  it("up slide: maps transposed coords and meetA/meetB to absolute coords", () => {
    const grid = [
      [9, null, null, null],
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "up");
    // transposed row0=[9,1,null,null]; meetACol=0,meetBCol=1 → (row:0,col:0) and (row:1,col:0)
    expect(eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 0 }, b: { row: 1, col: 0 },
        meetA: { row: 0, col: 0 }, meetB: { row: 1, col: 0 },
      },
    ]);
  });

  it("returns empty eliminatedPairs when no elimination occurs", () => {
    const grid = [[1, 2, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([]);
  });
});
