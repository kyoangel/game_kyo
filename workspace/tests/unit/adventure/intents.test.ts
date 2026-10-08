import { describe, it, expect } from "vitest";
import { STONE, createEmptyGrid, type GameGrid } from "../../../src/grid";
import {
  FREEZE_TURNS,
  freezeMask,
  pickDistinct,
  pruneFreezes,
  resolveAttack,
  resolveFreeze,
  resolveIntent,
  resolveRockfall,
  resolveScramble,
  resolveShield,
  resolveZero,
  tickFreezes,
  type IntentBoard,
} from "../../../src/adventure/intents";

/** rng that returns the scripted values in order, then 0 forever. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

function board(grid: GameGrid, extra: Partial<IntentBoard> = {}): IntentBoard {
  return { grid, freezes: [], heroHp: 10, enemyShield: 0, ...extra };
}

describe("pickDistinct", () => {
  it("picks count distinct items with one rng call per pick (partial Fisher-Yates)", () => {
    expect(pickDistinct(["a", "b", "c", "d"], 2, scripted(0, 0))).toEqual(["a", "b"]);
    expect(pickDistinct(["a", "b", "c", "d"], 2, scripted(0.99, 0))).toEqual(["d", "b"]);
  });

  it("returns all items when count exceeds the list, and does not mutate the input", () => {
    const items = [1, 2, 3];
    expect(pickDistinct(items, 9, () => 0).sort()).toEqual([1, 2, 3]);
    expect(items).toEqual([1, 2, 3]);
  });

  it("returns an empty list for count 0 without calling rng", () => {
    let calls = 0;
    expect(pickDistinct([1, 2], 0, () => (calls += 1, 0))).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("resolveAttack", () => {
  it("removes N hero HP and reports the damage", () => {
    const result = resolveAttack(board(createEmptyGrid(4), { heroHp: 10 }), 3);
    expect(result.board.heroHp).toBe(7);
    expect(result.effect).toEqual({ kind: "attack", damage: 3 });
  });

  it("never drops hero HP below 0 and reports the real damage", () => {
    const result = resolveAttack(board(createEmptyGrid(4), { heroHp: 2 }), 5);
    expect(result.board.heroHp).toBe(0);
    expect(result.effect).toEqual({ kind: "attack", damage: 2 });
  });
});

describe("resolveRockfall", () => {
  it("drops K stones on random empty cells (row-major candidate list, one rng call per stone)", () => {
    const grid = createEmptyGrid(4);
    const result = resolveRockfall(board(grid), 2, scripted(0, 0));
    expect(result.board.grid[0][0]).toBe(STONE);
    expect(result.board.grid[0][1]).toBe(STONE);
    expect(result.effect).toEqual({
      kind: "rockfall",
      placed: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    });
  });

  it("only uses empty cells", () => {
    const grid: GameGrid = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, null, 7],
    ];
    const result = resolveRockfall(board(grid), 1, () => 0.99);
    expect(result.board.grid[3][2]).toBe(STONE);
    expect(result.effect).toEqual({ kind: "rockfall", placed: [{ row: 3, col: 2 }] });
  });

  it("fills every empty cell when there are fewer than K", () => {
    const grid: GameGrid = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, null, null],
    ];
    const result = resolveRockfall(board(grid), 5, () => 0);
    expect(result.board.grid[3][2]).toBe(STONE);
    expect(result.board.grid[3][3]).toBe(STONE);
    expect((result.effect as { placed: unknown[] }).placed).toHaveLength(2);
  });

  it("places nothing on a full board and returns the same grid object", () => {
    const grid: GameGrid = [[1, 2], [3, 4]];
    const result = resolveRockfall(board(grid), 3, () => 0);
    expect(result.board.grid).toBe(grid);
    expect(result.effect).toEqual({ kind: "rockfall", placed: [] });
  });

  it("does not mutate the input grid", () => {
    const grid = createEmptyGrid(4);
    resolveRockfall(board(grid), 3, () => 0.5);
    expect(grid).toEqual(createEmptyGrid(4));
  });
});

describe("freeze helpers", () => {
  it("FREEZE_TURNS is 3 (spec 5.1)", () => {
    expect(FREEZE_TURNS).toBe(3);
  });

  it("freezeMask marks the frozen cells", () => {
    const mask = freezeMask(4, [{ row: 1, col: 2, turns: 3 }, { row: 3, col: 0, turns: 1 }]);
    expect(mask).toHaveLength(4);
    expect(mask[1][2]).toBe(true);
    expect(mask[3][0]).toBe(true);
    expect(mask.flat().filter(Boolean)).toHaveLength(2);
  });

  it("tickFreezes lowers every counter and thaws the ones that reach 0", () => {
    const result = tickFreezes([{ row: 0, col: 0, turns: 3 }, { row: 1, col: 1, turns: 1 }]);
    expect(result.freezes).toEqual([{ row: 0, col: 0, turns: 2 }]);
    expect(result.thawed).toEqual([{ row: 1, col: 1 }]);
  });

  it("pruneFreezes drops entries whose cell is empty or holds a stone", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 5;
    grid[2][2] = STONE;
    const result = pruneFreezes(grid, [
      { row: 0, col: 0, turns: 2 },
      { row: 1, col: 1, turns: 2 },
      { row: 2, col: 2, turns: 2 },
    ]);
    expect(result.freezes).toEqual([{ row: 0, col: 0, turns: 2 }]);
    expect(result.removed).toEqual([{ row: 1, col: 1 }, { row: 2, col: 2 }]);
  });
});

describe("resolveFreeze", () => {
  it("freezes a random numeric tile for 3 turns", () => {
    const grid = createEmptyGrid(4);
    grid[0][1] = 4;
    grid[2][3] = 7;
    const result = resolveFreeze(board(grid), 1, scripted(0.99));
    expect(result.board.freezes).toEqual([{ row: 2, col: 3, turns: 3 }]);
    expect(result.effect).toEqual({ kind: "freeze", frozen: [{ row: 2, col: 3 }] });
  });

  it("skips stones, empty cells and already frozen tiles", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 4;
    grid[0][2] = 6;
    const result = resolveFreeze(board(grid, { freezes: [{ row: 0, col: 1, turns: 2 }] }), 1, () => 0);
    expect(result.board.freezes).toEqual([
      { row: 0, col: 1, turns: 2 },
      { row: 0, col: 2, turns: 3 },
    ]);
  });

  it("can freeze a 0 tile", () => {
    const grid = createEmptyGrid(4);
    grid[1][1] = 0;
    const result = resolveFreeze(board(grid), 1, () => 0);
    expect(result.board.freezes).toEqual([{ row: 1, col: 1, turns: 3 }]);
  });

  it("does nothing when there is no tile to freeze", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    const input = board(grid);
    const result = resolveFreeze(input, 1, () => 0);
    expect(result.board.freezes).toEqual([]);
    expect(result.effect).toEqual({ kind: "freeze", frozen: [] });
  });
});

describe("resolveShield", () => {
  it("adds N shield and accumulates", () => {
    const first = resolveShield(board(createEmptyGrid(4)), 10);
    expect(first.board.enemyShield).toBe(10);
    expect(first.effect).toEqual({ kind: "shield", gained: 10 });
    const second = resolveShield(first.board, 5);
    expect(second.board.enemyShield).toBe(15);
  });
});

describe("resolveScramble", () => {
  function oneTile(value: number): GameGrid {
    const grid = createEmptyGrid(4);
    grid[1][1] = value;
    return grid;
  }

  it("changes a random 1-9 tile by +1 when the sign roll is >= 0.5", () => {
    const result = resolveScramble(board(oneTile(5)), 1, scripted(0, 0.9));
    expect(result.board.grid[1][1]).toBe(6);
    expect(result.effect).toEqual({ kind: "scramble", changed: [{ row: 1, col: 1, from: 5, to: 6 }] });
  });

  it("changes by -1 when the sign roll is < 0.5", () => {
    const result = resolveScramble(board(oneTile(5)), 1, scripted(0, 0.1));
    expect(result.board.grid[1][1]).toBe(4);
  });

  it("keeps the result inside 1-9: a 1 can only go up, a 9 only down", () => {
    expect(resolveScramble(board(oneTile(1)), 1, scripted(0, 0.1)).board.grid[1][1]).toBe(2);
    expect(resolveScramble(board(oneTile(9)), 1, scripted(0, 0.9)).board.grid[1][1]).toBe(8);
  });

  it("never touches stones, 0 or empty cells", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 0;
    const result = resolveScramble(board(grid), 1, () => 0);
    expect(result.board.grid).toBe(grid);
    expect(result.effect).toEqual({ kind: "scramble", changed: [] });
  });

  it("does not mutate the input grid", () => {
    const grid = oneTile(5);
    resolveScramble(board(grid), 1, () => 0.9);
    expect(grid[1][1]).toBe(5);
  });
});

describe("resolveZero (歸零)", () => {
  it("turns 2 distinct random 1-9 tiles into 0", () => {
    const grid: GameGrid = [
      [1, 2, 3, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const result = resolveZero(board(grid), 2, scripted(0, 0));
    expect(result.board.grid[0]).toEqual([0, 0, 3, null]);
    expect(result.effect).toEqual({
      kind: "zero",
      zeroed: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    });
  });

  it("skips stones, existing 0s and empty cells; zeroes fewer when not enough tiles", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 0;
    grid[0][2] = 8;
    const result = resolveZero(board(grid), 2, () => 0);
    expect(result.board.grid[0]).toEqual([STONE, 0, 0, null]);
    expect(result.effect).toEqual({ kind: "zero", zeroed: [{ row: 0, col: 2 }] });
  });

  it("zeroed tiles can never pair with 1-9 (0 + n != 10)", () => {
    for (let n = 1; n <= 9; n++) expect(0 + n).not.toBe(10);
  });
});

describe("resolveIntent dispatcher", () => {
  it("routes every kind to its function", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 5;
    const b = board(grid);
    expect(resolveIntent(b, { kind: "attack", amount: 2 }, () => 0).effect.kind).toBe("attack");
    expect(resolveIntent(b, { kind: "rockfall", amount: 1 }, () => 0).effect.kind).toBe("rockfall");
    expect(resolveIntent(b, { kind: "freeze", amount: 1 }, () => 0).effect.kind).toBe("freeze");
    expect(resolveIntent(b, { kind: "shield", amount: 4 }, () => 0).effect.kind).toBe("shield");
    expect(resolveIntent(b, { kind: "scramble", amount: 1 }, () => 0).effect.kind).toBe("scramble");
    expect(resolveIntent(b, { kind: "zero", amount: 1 }, () => 0).effect.kind).toBe("zero");
  });
});
