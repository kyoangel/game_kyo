import { describe, it, expect } from "vitest";
import { createEmptyGrid } from "../../src/grid";

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
