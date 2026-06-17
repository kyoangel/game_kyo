import { describe, it, expect } from "vitest";
import {
  slideRowLeft,
  slide,
  isGameOver,
  spawnRandomTile,
  applyMove,
  createEmptyGrid,
  type GameGrid,
  type GameState,
} from "../../src/grid";

// ─── 奇數個自配對 (5+5) ───────────────────────────────────────────────────────
// [5,5,5,null]: first pair merges, third tile survives — not covered elsewhere.
describe("slideRowLeft — odd count of self-pairable tiles", () => {
  it("[5,5,5,null] → [5,null,null,null]: first pair merges, third tile survives, score 10", () => {
    const result = slideRowLeft([5, 5, 5, null]);
    expect(result.row).toEqual([5, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("[9,1,9,null] → [9,null,null,null]: first pair merges (9+1=10), second 9 survives, score 10", () => {
    const result = slideRowLeft([9, 1, 9, null]);
    expect(result.row).toEqual([9, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });
});

// ─── spawnRandomTile 邊界值 ───────────────────────────────────────────────────
// Existing tests only use rng=()=>0 which always spawns value 1.
// Verify the upper bound: rng returning ~0.999 should produce value 9.
describe("spawnRandomTile — value range boundary", () => {
  it("spawns value 1 when rng returns 0 for both cell and value selection", () => {
    const grid = createEmptyGrid(4);
    const calls = [0, 0];
    const result = spawnRandomTile(grid, () => calls.shift() ?? 0);
    // Math.floor(0 * 16) = 0 → cell[0][0]; Math.floor(0 * 9) + 1 = 1
    expect(result[0][0]).toBe(1);
  });

  it("spawns value 9 when rng returns 0.999 for value selection", () => {
    const grid = createEmptyGrid(4);
    const calls = [0, 0.999];
    const result = spawnRandomTile(grid, () => calls.shift() ?? 0);
    // Math.floor(0 * 16) = 0 → cell[0][0]; Math.floor(0.999 * 9) + 1 = 8 + 1 = 9
    expect(result[0][0]).toBe(9);
  });

  it("spawns at the correct cell index determined by rng", () => {
    const grid = createEmptyGrid(4);
    // 16 empty cells. rng()=0.5 → Math.floor(0.5 * 16) = 8 → cell [2][0]
    const calls = [0.5, 0];
    const result = spawnRandomTile(grid, () => calls.shift() ?? 0);
    expect(result[2][0]).toBe(1);
    // All other cells remain null
    const filled = result.flat().filter((c) => c !== null);
    expect(filled).toHaveLength(1);
  });
});

// ─── isGameOver — 純對角配對 (不構成有效移動) ──────────────────────────────
// A grid where tiles that sum to 10 are only diagonally adjacent (not same row/col)
// must return isGameOver=true because diagonal slides don't exist.
describe("isGameOver — diagonal-only 10-sum pairs are not playable", () => {
  it("returns true when only diagonal neighbours sum to 10 but no row/col pair does", () => {
    // [0][0]=1 and [1][1]=9 are diagonal; no row/col neighbour pair sums to 10.
    // Row neighbours: 1+3=4, 3+1=4 …; Col neighbours: 1+3=4, 3+1=4 …
    const grid: GameGrid = [
      [1, 3, 1, 3],
      [3, 9, 3, 1],
      [1, 3, 1, 3],
      [3, 1, 3, 1],
    ];
    // No horizontal/vertical neighbour pair sums to 10: 1+3=4, 3+1=4, 3+9=12, 9+3=12.
    // The (1,[0][0]) and (9,[1][1]) pair that sums to 10 is diagonal → not reachable by any slide.
    expect(isGameOver(grid)).toBe(true);
  });
});

// ─── applyMove — 純移動無合併，所有四個方向 ──────────────────────────────────
// Compaction-only moves must not increase score in any direction.
describe("applyMove — compaction-only moves do not score in any direction", () => {
  it("right: single tile compacts rightward, score stays 0, tile count +1", () => {
    const state: GameState = {
      grid: [
        [null, 5, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    };
    const result = applyMove(state, "right", () => 0);
    expect(result.score).toBe(0);
    expect(result.grid[0][3]).toBe(5);
  });

  it("up: single tile at bottom compacts upward, score is unchanged (no merge)", () => {
    const state: GameState = {
      grid: [
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, 3, null, null],
      ],
      score: 7,
    };
    const result = applyMove(state, "up", () => 0);
    expect(result.score).toBe(7);
    expect(result.grid[0][1]).toBe(3);
  });

  it("down: single tile at top compacts downward, score is unchanged (no merge)", () => {
    const state: GameState = {
      grid: [
        [null, 2, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 15,
    };
    const result = applyMove(state, "down", () => 0);
    expect(result.score).toBe(15);
    expect(result.grid[3][1]).toBe(2);
  });
});

// ─── slide("left") — 全行合併後仍有殘餘非配對方塊 ────────────────────────────
// Verifies that [4,6,7,null] produces [7,null,null,null] and score 10:
// the first pair (4+6) merges while the trailing tile (7) survives.
describe("slideRowLeft — first pair merges, trailing non-pair survives", () => {
  it("[4,6,7,null] → [7,null,null,null], score 10", () => {
    const result = slideRowLeft([4, 6, 7, null]);
    expect(result.row).toEqual([7, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });

  it("[2,8,3,null] → [3,null,null,null], score 10", () => {
    const result = slideRowLeft([2, 8, 3, null]);
    expect(result.row).toEqual([3, null, null, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.moved).toBe(true);
  });
});

// ─── slide — 確認所有方向的 scoreGained 相互獨立 ─────────────────────────────
// A 4-direction smoke test: each direction correctly sums only the merges that
// occur in that direction, not from other directions.
describe("slide — scoreGained reflects only the merges in the chosen direction", () => {
  it("left: row [4,6,1,null] + [null,...] scores 10 (one merge)", () => {
    const grid: GameGrid = [
      [4, 6, 1, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "left");
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.grid[0]).toEqual([1, null, null, null]);
  });

  it("right: row [null,1,4,6] scores 10 (one merge after rightward compaction)", () => {
    const grid: GameGrid = [
      [null, 1, 4, 6],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "right");
    expect(outcome.scoreGained).toBe(10);
    // reversed=[6,4,1,null]; 6+4=10 → merge; remaining=[1]; un-reversed=[null,null,null,1]
    expect(outcome.grid[0]).toEqual([null, null, null, 1]);
  });
});
