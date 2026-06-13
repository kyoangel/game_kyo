import { describe, it, expect } from "vitest";
import { createEmptyGrid, compactRow } from "../../src/grid";

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
