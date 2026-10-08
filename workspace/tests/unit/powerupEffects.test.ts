import { describe, it, expect } from "vitest";
import {
  hammerEffect,
  shuffleEffect,
  addOneEffect,
  bombEffect,
} from "../../src/powerups";
import { STONE, createEmptyGrid, type FrozenMask, type GameGrid } from "../../src/grid";

function sample(): GameGrid {
  return [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 1, 2, 3],
    [4, 5, 6, 7],
  ];
}

describe("hammerEffect", () => {
  it("clears the target cell and reports it", () => {
    const grid = sample();
    const result = hammerEffect(grid, 1, 2);
    expect(result.applied).toBe(true);
    expect(result.grid[1][2]).toBeNull();
    expect(result.cleared).toEqual([{ row: 1, col: 2 }]);
    expect(result.grid[1][1]).toBe(6);
  });

  it("clears a stone and a 0", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 0;
    expect(hammerEffect(grid, 0, 0).grid[0][0]).toBeNull();
    expect(hammerEffect(grid, 0, 1).grid[0][1]).toBeNull();
  });

  it("an empty or out-of-range target is not applied and returns the same grid", () => {
    const grid = createEmptyGrid(4);
    const empty = hammerEffect(grid, 2, 2);
    expect(empty.applied).toBe(false);
    expect(empty.grid).toBe(grid);
    expect(empty.cleared).toEqual([]);
    expect(hammerEffect(grid, 9, 9).applied).toBe(false);
  });

  it("does not mutate the input", () => {
    const grid = sample();
    hammerEffect(grid, 0, 0);
    expect(grid).toEqual(sample());
  });
});

describe("addOneEffect", () => {
  it("adds 1 to a 1-8 tile", () => {
    const result = addOneEffect(sample(), 0, 0);
    expect(result.applied).toBe(true);
    expect(result.grid[0][0]).toBe(2);
    expect(result.pairCleared).toBe(false);
    expect(result.cleared).toEqual([]);
  });

  it("on a 9 removes the tile and reports a cleared pair", () => {
    const result = addOneEffect(sample(), 2, 0);
    expect(result.applied).toBe(true);
    expect(result.grid[2][0]).toBeNull();
    expect(result.pairCleared).toBe(true);
    expect(result.cleared).toEqual([{ row: 2, col: 0 }]);
  });

  it("on a 0 makes it a 1", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 0;
    expect(addOneEffect(grid, 0, 0).grid[0][0]).toBe(1);
  });

  it("refuses empty cells and stones", () => {
    const grid = createEmptyGrid(4);
    grid[1][1] = STONE;
    const onEmpty = addOneEffect(grid, 0, 0);
    const onStone = addOneEffect(grid, 1, 1);
    expect(onEmpty.applied).toBe(false);
    expect(onEmpty.grid).toBe(grid);
    expect(onStone.applied).toBe(false);
    expect(onStone.grid).toBe(grid);
    expect(onStone.grid[1][1]).toBe(STONE);
  });

  it("does not mutate the input", () => {
    const grid = sample();
    addOneEffect(grid, 0, 0);
    expect(grid).toEqual(sample());
  });
});

describe("bombEffect", () => {
  it("clears the 5-cell cross and nothing else", () => {
    const result = bombEffect(sample(), 1, 1);
    expect(result.applied).toBe(true);
    const clearedKeys = result.cleared.map(({ row, col }) => `${row},${col}`).sort();
    expect(clearedKeys).toEqual(["0,1", "1,0", "1,1", "1,2", "2,1"]);
    expect(result.grid[0][0]).toBe(1);
    expect(result.grid[0][1]).toBeNull();
    expect(result.grid[1][0]).toBeNull();
    expect(result.grid[1][1]).toBeNull();
    expect(result.grid[1][2]).toBeNull();
    expect(result.grid[2][1]).toBeNull();
    expect(result.grid[2][2]).toBe(2);
  });

  it("at a corner clears only the cells inside the grid", () => {
    const result = bombEffect(sample(), 0, 0);
    const clearedKeys = result.cleared.map(({ row, col }) => `${row},${col}`).sort();
    expect(clearedKeys).toEqual(["0,0", "0,1", "1,0"]);
  });

  it("only reports cells that held something, and still applies on an empty centre", () => {
    const grid = createEmptyGrid(4);
    grid[1][2] = 5;
    const result = bombEffect(grid, 1, 1);
    expect(result.applied).toBe(true);
    expect(result.cleared).toEqual([{ row: 1, col: 2 }]);
  });

  it("clears stones in the cross", () => {
    const grid = createEmptyGrid(4);
    grid[0][1] = STONE;
    expect(bombEffect(grid, 1, 1).grid[0][1]).toBeNull();
  });

  it("does not mutate the input", () => {
    const grid = sample();
    bombEffect(grid, 1, 1);
    expect(grid).toEqual(sample());
  });
});

describe("shuffleEffect", () => {
  function multiset(grid: GameGrid): number[] {
    return grid.flat().filter((c): c is number => c !== null).sort((a, b) => a - b);
  }

  it("keeps occupied positions and the multiset of values (stones and 0 included)", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 3;
    grid[1][2] = STONE;
    grid[2][1] = 0;
    grid[3][3] = 8;
    const result = shuffleEffect(grid, () => 0.5);
    expect(result.applied).toBe(true);
    expect(result.cleared).toEqual([]);
    result.grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        expect(cell === null).toBe(grid[r][c] === null);
      }),
    );
    expect(multiset(result.grid)).toEqual(multiset(grid));
  });

  it("uses the Fisher-Yates order of endless mode (rng() = 0 swaps every slot with index 0)", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[0][1] = 2;
    grid[0][2] = 3;
    // tiles [1,2,3]; i=2,j=0 -> [3,2,1]; i=1,j=0 -> [2,3,1]
    const result = shuffleEffect(grid, () => 0);
    expect(result.grid[0].slice(0, 3)).toEqual([2, 3, 1]);
  });

  it("calls rng exactly (occupied - 1) times", () => {
    let calls = 0;
    shuffleEffect(sample(), () => {
      calls += 1;
      return 0.3;
    });
    expect(calls).toBe(15);
  });

  it("frozen cells keep their content and do not take part", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[0][1] = 2;
    grid[0][2] = 3;
    const frozen: FrozenMask = createEmptyGrid(4).map((row) => row.map(() => false));
    frozen[0][1] = true;
    // movable tiles [1,3]; i=1,j=0 -> [3,1]
    const result = shuffleEffect(grid, () => 0, frozen);
    expect(result.grid[0].slice(0, 3)).toEqual([3, 2, 1]);
  });

  it("works on an empty board and a single tile without calling rng", () => {
    let calls = 0;
    const rng = (): number => {
      calls += 1;
      return 0;
    };
    const one = createEmptyGrid(4);
    one[2][2] = 4;
    expect(shuffleEffect(createEmptyGrid(4), rng).applied).toBe(true);
    expect(shuffleEffect(one, rng).grid[2][2]).toBe(4);
    expect(calls).toBe(0);
  });

  it("does not mutate the input", () => {
    const grid = sample();
    shuffleEffect(grid, () => 0);
    expect(grid).toEqual(sample());
  });
});
