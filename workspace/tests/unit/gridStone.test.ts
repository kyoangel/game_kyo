import { describe, it, expect } from "vitest";
import { STONE, canPair, slideRowLeft, slide, createEmptyGrid } from "../../src/grid";

describe("STONE", () => {
  it("is a negative number so it cannot collide with tile values 1-9 or 0", () => {
    expect(typeof STONE).toBe("number");
    expect(STONE).toBeLessThan(0);
  });

  it("canPair is true only for non-stone values summing to 10", () => {
    expect(canPair(4, 6)).toBe(true);
    expect(canPair(9, 1)).toBe(true);
    expect(canPair(5, 4)).toBe(false);
    expect(canPair(STONE, STONE)).toBe(false);
    for (let v = 0; v <= 10; v++) {
      expect(canPair(STONE, v)).toBe(false);
      expect(canPair(v, STONE)).toBe(false);
    }
  });

  it("0 never pairs with a tile 1-9", () => {
    for (let v = 1; v <= 9; v++) {
      expect(canPair(0, v)).toBe(false);
      expect(canPair(v, 0)).toBe(false);
    }
  });

  it("slideRowLeft never eliminates a stone, whatever sits next to it", () => {
    for (let v = 0; v <= 9; v++) {
      expect(slideRowLeft([STONE, v, null, null]).eliminatedIndices).toHaveLength(0);
      expect(slideRowLeft([v, STONE, null, null]).eliminatedIndices).toHaveLength(0);
    }
  });

  it("a stone sitting between 4 and 6 blocks their pairing", () => {
    const result = slideRowLeft([4, STONE, 6, null]);
    expect(result.row).toEqual([4, STONE, 6, null]);
    expect(result.moved).toBe(false);
    expect(result.scoreGained).toBe(0);
  });

  it("a stone moves with slides like a tile", () => {
    expect(slideRowLeft([null, STONE, null, 5]).row).toEqual([STONE, 5, null, null]);

    const grid = createEmptyGrid(4);
    grid[0][3] = STONE;
    const down = slide(grid, "down");
    expect(down.grid[3][3]).toBe(STONE);
    expect(down.grid[0][3]).toBeNull();
    expect(down.moved).toBe(true);
  });

  it("other pairs on the same row still merge around a stone", () => {
    const result = slideRowLeft([STONE, 5, 5, null]);
    expect(result.row).toEqual([STONE, null, null, null]);
    expect(result.scoreGained).toBe(10);
  });
});
