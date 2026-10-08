import { describe, it, expect } from "vitest";
import { STONE, createEmptyGrid, type GameGrid } from "../../../src/grid";
import {
  NO_UPGRADES,
  applyTurn,
  castSpell,
  createBattle,
  hasPlayableSpell,
  shouldOverload,
  type BattleEvent,
} from "../../../src/adventure/battle";
import { gridWith, makeState, scripted } from "./battleHelpers";

const allStones: GameGrid = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => STONE));

describe("plan 2 review fix 1: the overload net fires when no affordable spell can act", () => {
  it("all stones, mana 1, only addOne upgraded (cost 1): addOne refuses stones, so the net fires", () => {
    const state = makeState(allStones, {
      mana: 1,
      upgrades: { hammer: false, addOne: true, bomb: false, shuffle: false },
    });
    expect(hasPlayableSpell(state)).toBe(false);
    expect(shouldOverload(state)).toBe(true);
  });

  it("the same board with enough mana for the hammer is not an overload", () => {
    const state = makeState(allStones, { mana: 2 });
    expect(hasPlayableSpell(state)).toBe(true);
    expect(shouldOverload(state)).toBe(false);
  });

  it("a numeric cell makes a cheap addOne playable again", () => {
    const grid = allStones.map((row) => [...row]);
    grid[2][2] = 5;
    const state = makeState(grid, {
      mana: 1,
      upgrades: { hammer: false, addOne: true, bomb: false, shuffle: false },
    });
    expect(hasPlayableSpell(state)).toBe(true);
  });

  it("an empty board has no playable spell", () => {
    expect(hasPlayableSpell(makeState(createEmptyGrid(4), { mana: 9 }))).toBe(false);
  });

  it("shuffle counts only with two unfrozen cells of different content", () => {
    const onlyShuffle = { spellCost: (_s: unknown, spell: string, base: number) => (spell === "shuffle" ? base : 99) };
    const twoSame = makeState(gridWith([[STONE, STONE]]), { mana: 9 });
    const twoDifferent = makeState(gridWith([[STONE, 5]]), { mana: 9 });
    const differentButFrozen = makeState(gridWith([[STONE, 5]]), { mana: 9, freezes: [{ row: 0, col: 1, turns: 2 }] });
    expect(hasPlayableSpell(twoSame, onlyShuffle)).toBe(false);
    expect(hasPlayableSpell(twoDifferent, onlyShuffle)).toBe(true);
    expect(hasPlayableSpell(differentButFrozen, onlyShuffle)).toBe(false);
  });

  it("respects the spellCost hook: a relic that raises every cost makes the net fire", () => {
    const state = makeState(allStones, { mana: 3 });
    const pricey = { spellCost: (_s: unknown, _spell: string, base: number) => base + 5 };
    expect(shouldOverload(state)).toBe(false);
    expect(shouldOverload(state, pricey)).toBe(true);
  });

  it("applyTurn resolves a stuck stone board through the swipe safety net", () => {
    const state = makeState(allStones, {
      mana: 1,
      upgrades: { hammer: false, addOne: true, bomb: false, shuffle: false },
    });
    const { state: next, events } = applyTurn(state, "left", () => 0);
    expect(next.overloads).toBe(1);
    expect(next.heroHp).toBe(8);
    expect(events.some((e) => e.type === "overload")).toBe(true);
  });
});

describe("plan 2 review fix 2: NO_UPGRADES is never shared", () => {
  it("the constant is frozen and each battle owns a copy", () => {
    expect(Object.isFrozen(NO_UPGRADES)).toBe(true);
    const { state } = createBattle({ enemyId: "slime", heroHp: 10, heroMaxHp: 10 }, () => 0);
    expect(state.upgrades).toEqual(NO_UPGRADES);
    expect(state.upgrades).not.toBe(NO_UPGRADES);
  });
});

describe("plan 2 review fix 3: an overload always clears at least one cell", () => {
  it("a lone frozen tile is cleared (and its freeze with it)", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { events } = applyTurn(state, "up", () => 0);
    const overload = events.find((e) => e.type === "overload") as Extract<BattleEvent, { type: "overload" }>;
    expect(overload.cleared).toHaveLength(1);
    expect(events).toContainEqual({ type: "thawed", cells: [{ row: 0, col: 0 }], cause: "cleared" });
  });
});

describe("plan 2 review fix 4: events report the amounts that really changed", () => {
  it("manaChanged.delta is the clamped change, and a no-op change emits nothing", () => {
    const state = makeState(gridWith([[4, 6]]));
    const { events } = applyTurn(state, "left", () => 0, { onPairCleared: () => ({ mana: -5 }) });
    const mana = events.filter((e) => e.type === "manaChanged");
    expect(mana).toEqual([
      { type: "manaChanged", delta: 1, mana: 1 },
      { type: "manaChanged", delta: -1, mana: 0 },
    ]);
    const { events: startEvents } = createBattle(
      { enemyId: "slime", heroHp: 10, heroMaxHp: 10 },
      () => 0,
      { onBattleStart: () => ({ mana: -3 }) },
    );
    expect(startEvents.some((e) => e.type === "manaChanged")).toBe(false);
  });

  it("overload.hpLost is capped by the HP the hero had", () => {
    const state = makeState(gridWith([[5]]), { heroHp: 1, freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next, events } = applyTurn(state, "up", () => 0);
    expect(events).toContainEqual({ type: "overload", hpLost: 1, cleared: [{ row: 0, col: 0 }] });
    expect(next.heroHp).toBe(0);
    expect(next.status).toBe("defeat");
  });
});

describe("plan 2 review fix 5: relic plumbing", () => {
  it("a new battle starts with empty relicData", () => {
    const { state } = createBattle({ enemyId: "slime", heroHp: 10, heroMaxHp: 10 }, () => 0);
    expect(state.relicData).toEqual({});
  });

  it("a hook effect can write relicData, and later writes win", () => {
    const { state } = createBattle(
      { enemyId: "slime", heroHp: 10, heroMaxHp: 10 },
      () => 0,
      { onBattleStart: () => ({ relicData: { a: 1, b: 2 } }) },
    );
    expect(state.relicData).toEqual({ a: 1, b: 2 });
    const next = applyTurn(
      { ...makeState(gridWith([[4, 6]])), relicData: state.relicData },
      "left",
      () => 0,
      { onPairCleared: () => ({ relicData: { b: 5 } }) },
    );
    expect(next.state.relicData).toEqual({ a: 1, b: 5 });
  });

  it("an explicit undefined hook falls back to the default instead of crashing", () => {
    const state = makeState(gridWith([[4, 6, 4, 6]]));
    const hooks = { chainMultiplier: undefined, onPairCleared: undefined, spellCost: undefined };
    const result = applyTurn(state, "left", () => 0, hooks);
    expect(result.events.find((e) => e.type === "pairCleared")).toMatchObject({ damagePerPair: 15 });
  });
});

describe("review follow-up: a spell that empties the board is not punished", () => {
  it("bombing the last tile refills one tile and costs no HP", () => {
    const state = makeState(gridWith([[5]]), { mana: 4 });
    const result = castSpell(state, "bomb", { row: 0, col: 0 }, scripted(0, 0));
    expect(result.applied).toBe(true);
    expect(result.state.heroHp).toBe(10);
    expect(result.state.overloads).toBe(0);
    expect(result.state.grid.flat().filter((c) => c !== null)).toHaveLength(1);
    expect(result.events.some((e) => e.type === "tileSpawned")).toBe(true);
  });
});
