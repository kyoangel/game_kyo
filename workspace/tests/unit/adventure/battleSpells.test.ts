import { describe, it, expect } from "vitest";
import { STONE, type GameGrid } from "../../../src/grid";
import {
  SPELLS,
  SPELL_IDS,
  castSpell,
  minSpellCost,
  spellCost,
  type BattleEvent,
} from "../../../src/adventure/battle";
import { gridWith, makeState, seededRng } from "./battleHelpers";

const upgradedAll = { hammer: true, addOne: true, bomb: true, shuffle: true };

describe("spell costs (spec 4.2) and upgrades", () => {
  it("base costs are 2 / 2 / 4 / 3 for hammer, addOne, bomb, shuffle", () => {
    const state = makeState();
    expect(spellCost(state, "hammer")).toBe(2);
    expect(spellCost(state, "addOne")).toBe(2);
    expect(spellCost(state, "bomb")).toBe(4);
    expect(spellCost(state, "shuffle")).toBe(3);
  });

  it("each spell has one upgrade that makes it 1 cheaper", () => {
    const state = makeState(undefined, { upgrades: upgradedAll });
    SPELL_IDS.forEach((id) => {
      expect(spellCost(state, id)).toBe(SPELLS[id].cost - 1);
    });
    const onlyBomb = makeState(undefined, { upgrades: { ...upgradedAll, hammer: false, addOne: false, shuffle: false } });
    expect(spellCost(onlyBomb, "bomb")).toBe(3);
    expect(spellCost(onlyBomb, "hammer")).toBe(2);
  });

  it("the spellCost hook adjusts the cost and the result never goes below 0", () => {
    const state = makeState();
    expect(spellCost(state, "bomb", { spellCost: (_s, _id, base) => base - 1 })).toBe(3);
    expect(spellCost(state, "bomb", { spellCost: () => -5 })).toBe(0);
  });

  it("minSpellCost is the cheapest of the four", () => {
    expect(minSpellCost(makeState())).toBe(2);
    expect(minSpellCost(makeState(undefined, { upgrades: upgradedAll }))).toBe(1);
  });
});

describe("castSpell: shared rules", () => {
  const board = gridWith([[1, 2, 3, 4], [5, 6, 7, 8], [9, 1, 2, 3]]);

  it("casting is not a turn: no enemy action, no spawn, turn counter unchanged", () => {
    const state = makeState(board, { mana: 5, countdown: 1 });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result.applied).toBe(true);
    expect(result.state.turn).toBe(0);
    expect(result.state.countdown).toBe(1);
    expect(result.state.heroHp).toBe(10);
    expect(result.state.grid.flat().filter((c) => c !== null)).toHaveLength(11);
  });

  it("rejects with notEnoughMana and returns the very same state, spending nothing", () => {
    const state = makeState(board, { mana: 1 });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result).toMatchObject({ applied: false, reason: "notEnoughMana", events: [] });
    expect(result.state).toBe(state);
  });

  it("rejects after the battle is over", () => {
    const state = makeState(board, { mana: 9, status: "victory" });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result).toMatchObject({ applied: false, reason: "battleOver" });
    expect(result.state).toBe(state);
  });

  it("rejects off-board and missing targets (except shuffle, which needs none)", () => {
    const state = makeState(board, { mana: 9 });
    ["hammer", "addOne", "bomb"].forEach((spell) => {
      expect(castSpell(state, spell as "hammer", { row: 4, col: 0 }, () => 0).reason).toBe("invalidTarget");
      expect(castSpell(state, spell as "hammer", { row: 0, col: -1 }, () => 0).reason).toBe("invalidTarget");
      expect(castSpell(state, spell as "hammer", null, () => 0).reason).toBe("invalidTarget");
    });
    expect(castSpell(state, "shuffle", null, () => 0).applied).toBe(true);
  });

  it("emits spellCast then a negative manaChanged", () => {
    const state = makeState(board, { mana: 5 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(events).toEqual([
      { type: "spellCast", spell: "hammer", cost: 2, target: { row: 0, col: 0 } },
      { type: "manaChanged", delta: -2, mana: 3 },
    ]);
  });

  it("uses the upgraded cost", () => {
    const state = makeState(board, { mana: 1, upgrades: upgradedAll });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result.applied).toBe(true);
    expect(result.state.mana).toBe(0);
  });

  it("does not mutate the input state", () => {
    const state = makeState(board, { mana: 9 });
    const before = JSON.stringify(state);
    castSpell(state, "bomb", { row: 1, col: 1 }, () => 0);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("castSpell: 碎石 hammer", () => {
  it("removes a number, a stone or a 0", () => {
    const state = makeState(gridWith([[3, STONE, 0, null]]), { mana: 9 });
    [0, 1, 2].forEach((col) => {
      const result = castSpell(state, "hammer", { row: 0, col }, () => 0);
      expect(result.applied).toBe(true);
      expect(result.state.grid[0][col]).toBeNull();
    });
  });

  it("an empty cell is an invalid target and costs nothing", () => {
    const state = makeState(gridWith([[3, null]]), { mana: 9 });
    const result = castSpell(state, "hammer", { row: 0, col: 1 }, () => 0);
    expect(result).toMatchObject({ applied: false, reason: "invalidTarget" });
    expect(result.state).toBe(state);
  });

  it("breaking a stone with it fires stoneBroken (cause spell) and the onStoneBroken hook", () => {
    let seen: unknown;
    const state = makeState(gridWith([[STONE, 4]]), { mana: 2 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0, {
      onStoneBroken: (_s, cells, cause) => {
        seen = { cells, cause };
        return { enemyDamage: 5 };
      },
    });
    expect(events).toContainEqual({ type: "stoneBroken", cell: { row: 0, col: 0 }, cause: "spell" });
    expect(seen).toEqual({ cells: [{ row: 0, col: 0 }], cause: "spell" });
    expect(events).toContainEqual({ type: "damageDealt", amount: 5, absorbed: 0, hpDamage: 5, source: "relic" });
  });

  it("hammering a number is not a stone break", () => {
    const state = makeState(gridWith([[3, 4]]), { mana: 2 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(events.some((e: BattleEvent) => e.type === "stoneBroken")).toBe(false);
  });

  it("smashing a frozen tile removes its freeze", () => {
    const state = makeState(gridWith([[3, 4]]), { mana: 2, freezes: [{ row: 0, col: 0, turns: 2 }] });
    const result = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(result.state.freezes).toEqual([]);
    expect(result.events).toContainEqual({ type: "thawed", cells: [{ row: 0, col: 0 }], cause: "cleared" });
  });
});

describe("castSpell: 增幅 addOne", () => {
  it("adds 1 to a number; 0 becomes 1", () => {
    const state = makeState(gridWith([[4, 0]]), { mana: 4 });
    expect(castSpell(state, "addOne", { row: 0, col: 0 }, () => 0).state.grid[0][0]).toBe(5);
    expect(castSpell(state, "addOne", { row: 0, col: 1 }, () => 0).state.grid[0][1]).toBe(1);
  });

  it("refuses stones and empty cells without spending mana", () => {
    const state = makeState(gridWith([[STONE, null]]), { mana: 4 });
    expect(castSpell(state, "addOne", { row: 0, col: 0 }, () => 0)).toMatchObject({ applied: false, reason: "invalidTarget" });
    expect(castSpell(state, "addOne", { row: 0, col: 1 }, () => 0)).toMatchObject({ applied: false, reason: "invalidTarget" });
  });

  it("on a 9 the tile is removed and it counts as one cleared pair: 10 damage, +1 mana, no chain bonus", () => {
    const calls: unknown[] = [];
    const state = makeState(gridWith([[9, 3]]), { mana: 2 });
    const { state: next, events } = castSpell(state, "addOne", { row: 0, col: 0 }, () => 0, {
      onPairCleared: (_s, info) => {
        calls.push(info);
      },
    });
    expect(next.grid[0][0]).toBeNull();
    expect(next.enemyHp).toBe(30);
    expect(next.mana).toBe(1); // 2 - 2 + 1
    expect(events).toContainEqual({ type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "addOne" });
    expect(calls).toEqual([{ count: 1, chain: false, damagePerPair: 10 }]);
  });

  it("a 9 cleared by addOne can win the battle", () => {
    const state = makeState(gridWith([[9, 3]]), { mana: 2, enemyHp: 10 });
    const { state: next, events } = castSpell(state, "addOne", { row: 0, col: 0 }, () => 0);
    expect(next.status).toBe("victory");
    expect(events[events.length - 1]).toEqual({ type: "battleEnded", result: "victory" });
  });
});

describe("castSpell: 爆裂 bomb", () => {
  it("clears the target and its four neighbours, stones included", () => {
    const grid = gridWith([[1, 2, 3, 4], [5, STONE, 7, 8], [9, 1, 2, 3], [4, 5, 6, 7]]);
    const { state: next } = castSpell(makeState(grid, { mana: 4 }), "bomb", { row: 1, col: 1 }, () => 0);
    const cleared = [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]];
    cleared.forEach(([r, c]) => expect(next.grid[r][c]).toBeNull());
    expect(next.grid[0][0]).toBe(1);
    expect(next.grid[2][2]).toBe(2);
    expect(next.mana).toBe(0);
  });

  it("can be cast on an empty centre", () => {
    const state = makeState(gridWith([[null, 5]]), { mana: 4 });
    const result = castSpell(state, "bomb", { row: 0, col: 0 }, () => 0);
    expect(result.applied).toBe(true);
    expect(result.state.grid[0][1]).toBeNull();
  });

  it("reports every stone it removed", () => {
    const state = makeState(gridWith([[STONE, STONE, null]]), { mana: 4 });
    const { events } = castSpell(state, "bomb", { row: 0, col: 0 }, () => 0);
    expect(events.filter((e) => e.type === "stoneBroken")).toHaveLength(2);
  });
});

describe("castSpell: 洗牌 shuffle", () => {
  function multiset(grid: GameGrid): number[] {
    return grid.flat().filter((c): c is number => c !== null).sort((a, b) => a - b);
  }

  it("keeps occupied positions and the values (stones and 0 included)", () => {
    const grid = gridWith([[1, STONE, 0, null], [4, 5, null, 9]]);
    const state = makeState(grid, { mana: 3 });
    const { state: next } = castSpell(state, "shuffle", null, seededRng(5));
    expect(multiset(next.grid)).toEqual(multiset(grid));
    next.grid.forEach((row, r) => row.forEach((cell, c) => expect(cell === null).toBe(grid[r][c] === null)));
    expect(next.mana).toBe(0);
  });

  it("frozen tiles keep their value and position", () => {
    const grid = gridWith([[1, 2, 3, 4]]);
    const state = makeState(grid, { mana: 3, freezes: [{ row: 0, col: 1, turns: 2 }] });
    for (let seed = 1; seed <= 20; seed++) {
      const { state: next } = castSpell(state, "shuffle", null, seededRng(seed));
      expect(next.grid[0][1]).toBe(2);
      expect(multiset(next.grid)).toEqual([1, 2, 3, 4]);
    }
  });
});

describe("castSpell: overload right after a cast (no soft-lock)", () => {
  it("a cast that leaves the board stuck with too little mana triggers the overload at once", () => {
    // Only 1s and 2s: nothing can ever pair, so shuffling keeps the board stuck.
    const stuck: GameGrid = [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 1],
    ];
    const state = makeState(stuck, { mana: 3 });
    const { state: next, events } = castSpell(state, "shuffle", null, () => 0);
    expect(events.some((e) => e.type === "overload")).toBe(true);
    expect(next.heroHp).toBe(8);
    expect(next.mana).toBe(0);
    expect(next.countdown).toBe(3); // the overload counts the enemy down once
    expect(next.grid.flat().filter((c) => c !== null)).toHaveLength(8);
  });

  it("no overload when the cast leaves a legal move", () => {
    const state = makeState(gridWith([[1, 2, null, null]]), { mana: 9 });
    const { events } = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0);
    expect(events.some((e) => e.type === "overload")).toBe(false);
  });
});
