import { describe, it, expect } from "vitest";
import { createEmptyGrid, STONE, type GameGrid } from "../../../src/grid";
import { applyTurn, shouldOverload } from "../../../src/adventure/battle";
import { gridWith, makeState } from "./battleHelpers";

// One empty cell at (3,3). Sliding row 3 right moves the tiles; the spawn then
// fills (3,0) with a 1 (plain spawn, rng 0), leaving a board of 1s and 2s with no legal move.
const nearlyStuck: GameGrid = [
  [1, 2, 1, 2],
  [2, 1, 2, 1],
  [1, 2, 1, 2],
  [2, 1, 2, null],
];
const plainSpawn = { spawnStrategy: () => ({ emptyThreshold: 0, probability: 0 }) };

describe("shouldOverload (layer 3 condition, spec 4.3)", () => {
  const stuck: GameGrid = [
    [1, 2, 1, 2],
    [2, 1, 2, 1],
    [1, 2, 1, 2],
    [2, 1, 2, 1],
  ];

  it("true when no slide is legal and mana is below the cheapest spell (2)", () => {
    expect(shouldOverload(makeState(stuck, { mana: 0 }))).toBe(true);
    expect(shouldOverload(makeState(stuck, { mana: 1 }))).toBe(true);
  });

  it("false once mana covers the cheapest spell", () => {
    expect(shouldOverload(makeState(stuck, { mana: 2 }))).toBe(false);
  });

  it("the cheapest cost follows upgrades and the spellCost hook", () => {
    const upgraded = makeState(stuck, {
      mana: 1,
      upgrades: { hammer: true, addOne: false, bomb: false, shuffle: false },
    });
    expect(shouldOverload(upgraded)).toBe(false);
    expect(shouldOverload(makeState(stuck, { mana: 1 }), { spellCost: () => 1 })).toBe(false);
  });

  it("false while a legal slide exists", () => {
    expect(shouldOverload(makeState(gridWith([[1, null]]), { mana: 0 }))).toBe(false);
  });

  it("respects the frozen mask: a lone frozen tile has no legal slide", () => {
    const grid = gridWith([[5]]);
    expect(shouldOverload(makeState(grid))).toBe(false);
    expect(shouldOverload(makeState(grid, { freezes: [{ row: 0, col: 0, turns: 2 }] }))).toBe(true);
  });

  it("false once the battle is over", () => {
    expect(shouldOverload(makeState(stuck, { status: "defeat" }))).toBe(false);
  });
});

describe("overload at the end of a turn", () => {
  it("costs 2 HP, clears half the occupied cells, counts the overload, and does not tick the intent twice", () => {
    const state = makeState(nearlyStuck);
    const { state: next, events } = applyTurn(state, "right", () => 0, plainSpawn);
    expect(next.heroHp).toBe(8);
    expect(next.overloads).toBe(1);
    expect(next.countdown).toBe(3); // 4 -> 3 once, not twice
    // rng 0 picks the first 8 occupied cells in row-major order: rows 0 and 1
    expect(next.grid[0]).toEqual([null, null, null, null]);
    expect(next.grid[1]).toEqual([null, null, null, null]);
    expect(next.grid[2]).toEqual([1, 2, 1, 2]);
    const overload = events.find((e) => e.type === "overload");
    expect(overload).toMatchObject({ type: "overload", hpLost: 2 });
    expect((overload as { cleared: unknown[] }).cleared).toHaveLength(8);
    expect(events).toContainEqual({ type: "heroHpChanged", delta: -2, hp: 8, cause: "overload" });
  });

  it("rounds the cleared half down (3 frozen tiles -> 1 cleared)", () => {
    const grid = gridWith([[5, 5, 5, null]]);
    const freezes = [0, 1, 2].map((col) => ({ row: 0, col, turns: 3 }));
    const { events } = applyTurn(makeState(grid, { freezes }), "left", () => 0);
    const overload = events.find((e) => e.type === "overload") as { cleared: unknown[] };
    expect(overload.cleared).toHaveLength(1);
  });

  it("does nothing while mana can still pay for a spell", () => {
    const { state: next, events } = applyTurn(makeState(nearlyStuck, { mana: 2 }), "right", () => 0, plainSpawn);
    expect(next.heroHp).toBe(10);
    expect(events.some((e) => e.type === "overload")).toBe(false);
  });

  it("the onOverload hook can cancel the HP loss and hit the enemy (暴走之心)", () => {
    const { state: next, events } = applyTurn(makeState(nearlyStuck), "right", () => 0, {
      ...plainSpawn,
      onOverload: () => ({ cancelHpLoss: true, enemyDamage: 20 }),
    });
    expect(next.heroHp).toBe(10);
    expect(next.enemyHp).toBe(20);
    expect(events).toContainEqual({
      type: "damageDealt", amount: 20, absorbed: 0, hpDamage: 20, source: "relic",
    });
    expect(events.find((e) => e.type === "overload")).toMatchObject({ hpLost: 0 });
  });

  it("an overload that takes the last HP is a defeat (spec 4.3)", () => {
    const { state: next, events } = applyTurn(makeState(nearlyStuck, { heroHp: 2 }), "right", () => 0, plainSpawn);
    expect(next.heroHp).toBe(0);
    expect(next.status).toBe("defeat");
    expect(events[events.length - 1]).toEqual({ type: "battleEnded", result: "defeat" });
  });

  it("relic damage from an overload can win the battle", () => {
    const { state: next } = applyTurn(makeState(nearlyStuck, { enemyHp: 20 }), "right", () => 0, {
      ...plainSpawn,
      onOverload: () => ({ cancelHpLoss: true, enemyDamage: 20 }),
    });
    expect(next.status).toBe("victory");
  });

  it("clearing ignores freezes and drops the freeze entries of cleared tiles", () => {
    const state = makeState(nearlyStuck, { freezes: [{ row: 0, col: 0, turns: 3 }, { row: 3, col: 1, turns: 3 }] });
    // (3,1) holds a tile that moves? it is frozen so it is a wall; sliding right still moves (3,2) -> (3,3)
    const { state: next } = applyTurn(state, "right", () => 0, plainSpawn);
    expect(next.overloads).toBe(1);
    // (0,0) was cleared, so its freeze is gone; (3,1) survived and ticked 3 -> 2
    expect(next.freezes).toEqual([{ row: 3, col: 1, turns: 2 }]);
  });
});

describe("overload as a safety net on an invalid swipe", () => {
  it("a stuck board with too little mana resolves the overload when the player swipes", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next, events } = applyTurn(state, "up", () => 0);
    expect(next.heroHp).toBe(8);
    expect(next.turn).toBe(1);
    expect(next.overloads).toBe(1);
    expect(next.countdown).toBe(3); // the enemy phase runs for this overload
    expect(next.freezes).toEqual([]); // the overload now clears at least one cell, so the lone frozen tile goes
    expect(events.some((e) => e.type === "overload")).toBe(true);
  });

  it("an empty board gets a fresh tile after the overload so play can continue", () => {
    const state = makeState(createEmptyGrid(4));
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.heroHp).toBe(8);
    expect(next.grid.flat().filter((c) => c !== null)).toHaveLength(1);
    expect(events.some((e) => e.type === "tileSpawned")).toBe(true);
  });

  it("an invalid swipe on a board that still has a legal move is just ignored", () => {
    const state = makeState(gridWith([[5]]));
    const result = applyTurn(state, "left", () => 0);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });
});
