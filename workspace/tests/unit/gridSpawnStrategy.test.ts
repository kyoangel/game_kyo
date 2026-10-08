import { describe, it, expect } from "vitest";
import {
  spawnRandomTile,
  createEmptyGrid,
  STONE,
  COMPLEMENT_BIAS,
  type GameGrid,
  type SpawnStrategy,
} from "../../src/grid";

/** rng that returns the scripted values in order, then 0 forever. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

// 3 empty cells (all in row 3). Complement options, in contract order:
// (3,1)<-up 1 => 9, (3,1)<-left 4 => 6, (3,2)<-up 2 => 8, (3,3)<-up 3 => 7
const threeEmpty: GameGrid = [
  [5, 1, 2, 3],
  [4, 6, 7, 8],
  [9, 1, 2, 3],
  [4, null, null, null],
];

// 4 empty cells in row 0, each with a numeric neighbour below: 5, 1, 2, 3
const fourEmpty: GameGrid = [
  [null, null, null, null],
  [5, 1, 2, 3],
  [4, 6, 7, 8],
  [9, 1, 2, 3],
];

describe("COMPLEMENT_BIAS", () => {
  it("matches spec 4.1: fewer than 4 empty cells, 50%", () => {
    expect(COMPLEMENT_BIAS).toEqual({ emptyThreshold: 4, probability: 0.5 });
  });
});

describe("spawnRandomTile without a strategy", () => {
  it("is unchanged: two rng calls (cell, value)", () => {
    expect(spawnRandomTile(fourEmpty, scripted(0, 0))[0][0]).toBe(1);
    expect(spawnRandomTile(fourEmpty, scripted(0.99, 0.99))[0][3]).toBe(9);
  });
});

describe("spawnRandomTile with complement bias", () => {
  it("below the threshold and roll < probability: spawns 10 - neighbour next to it", () => {
    const first = spawnRandomTile(threeEmpty, scripted(0.1, 0), COMPLEMENT_BIAS);
    expect(first[3][1]).toBe(9);

    const last = spawnRandomTile(threeEmpty, scripted(0.3, 0.99), COMPLEMENT_BIAS);
    expect(last[3][3]).toBe(7);

    const second = spawnRandomTile(threeEmpty, scripted(0.3, 0.25), COMPLEMENT_BIAS);
    expect(second[3][1]).toBe(6);
  });

  it("the spawned tile is always adjacent to a neighbour that sums to 10 with it", () => {
    for (const pick of [0, 0.25, 0.5, 0.75, 0.99]) {
      const result = spawnRandomTile(threeEmpty, scripted(0, pick), COMPLEMENT_BIAS);
      const spawned: Array<[number, number]> = [];
      result.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell !== null && threeEmpty[r][c] === null) spawned.push([r, c]);
        }),
      );
      expect(spawned).toHaveLength(1);
      const [r, c] = spawned[0];
      const value = result[r][c] as number;
      const neighbours = [result[r - 1]?.[c], result[r + 1]?.[c], result[r][c - 1], result[r][c + 1]];
      expect(neighbours.some((n) => typeof n === "number" && n + value === 10)).toBe(true);
    }
  });

  it("below the threshold but roll >= probability: falls back to the plain spawn", () => {
    const result = spawnRandomTile(threeEmpty, scripted(0.7, 0, 0), COMPLEMENT_BIAS);
    expect(result[3][1]).toBe(1);
  });

  it("at or above the threshold the bias is off and consumes no extra rng value", () => {
    const result = spawnRandomTile(fourEmpty, scripted(0, 0), COMPLEMENT_BIAS);
    expect(result[0][0]).toBe(1); // plain spawn; bias would have produced 10 - 5 = 5
  });

  it("falls back to the plain spawn when no empty cell touches a numeric tile", () => {
    const grid = createEmptyGrid(4);
    const strategy: SpawnStrategy = { emptyThreshold: 100, probability: 1 };
    const result = spawnRandomTile(grid, scripted(0, 0, 0.99), strategy);
    expect(result[0][0]).toBe(9);
  });

  it("ignores stones and 0 as neighbours", () => {
    const grid: GameGrid = [
      [STONE, null],
      [0, null],
    ];
    const strategy: SpawnStrategy = { emptyThreshold: 100, probability: 1 };
    const result = spawnRandomTile(grid, scripted(0, 0, 0), strategy);
    expect(result[0][1]).toBe(1);
  });

  it("baseProbability (relic) applies above the threshold", () => {
    const relic: SpawnStrategy = { emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 };
    expect(spawnRandomTile(fourEmpty, scripted(0.2, 0), relic)[0][0]).toBe(5);
    expect(spawnRandomTile(fourEmpty, scripted(0.4, 0, 0), relic)[0][0]).toBe(1);
  });

  it("below the threshold the higher of probability and baseProbability wins", () => {
    const relic: SpawnStrategy = { emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 };
    expect(spawnRandomTile(threeEmpty, scripted(0.4, 0), relic)[3][1]).toBe(9);
    expect(spawnRandomTile(threeEmpty, scripted(0.6, 0, 0), relic)[3][1]).toBe(1);
  });

  it("returns the same grid object when there is no empty cell", () => {
    const full: GameGrid = [[1, 2], [3, 4]];
    expect(spawnRandomTile(full, scripted(0), COMPLEMENT_BIAS)).toBe(full);
  });

  it("does not mutate the input grid", () => {
    const before = JSON.stringify(threeEmpty);
    spawnRandomTile(threeEmpty, scripted(0, 0), COMPLEMENT_BIAS);
    expect(JSON.stringify(threeEmpty)).toBe(before);
  });
});
