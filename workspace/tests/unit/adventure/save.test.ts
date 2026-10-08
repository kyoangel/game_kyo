import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import {
  RUN_SAVE_KEY,
  RUN_SAVE_VERSION,
  clearRun,
  loadRun,
  parseRun,
  saveRun,
  serializeRun,
  validateRun,
} from "../../../src/adventure/save";
import { chooseOffer, createRun, runTurn, type RunState } from "../../../src/adventure/run";
import { STARTER_RELIC_IDS } from "../../../src/adventure/relics";
import { gridWith, seededRng } from "./battleHelpers";
import { runInBattle } from "./runHelpers";
import { memoryStore } from "./storeHelper";

const POOL = [...STARTER_RELIC_IDS];

/** A run in the middle of battle 2 with a stone, a freeze, relics and an upgrade. */
function busyRun(): RunState {
  return runInBattle(
    gridWith([[3, STONE, 0, 7], [null, 5, null, null], [9, null, null, null]]),
    { upgrades: { hammer: true, addOne: false, bomb: false, shuffle: false }, mana: 3, enemyShield: 5, freezes: [{ row: 1, col: 1, turns: 2 }], relicData: { forestHeartUsed: 1 }, turn: 12 },
    { relics: ["chainRing", "forestHeart"], upgrades: { hammer: true, addOne: false, bomb: false, shuffle: false }, stats: { stonesBroken: 2, maxChain: 2 } },
    1,
  );
}

function rewardRun(): RunState {
  const won = runTurn(runInBattle(gridWith([[4, 6]]), { enemyHp: 10 }), "left", seededRng(2));
  return won.run;
}

describe("round trip", () => {
  it("every phase survives serialize -> parse unchanged", () => {
    const opening = createRun(seededRng(1), POOL);
    const battling = chooseOffer(opening, 0, seededRng(2)).run;
    [opening, battling, busyRun(), rewardRun()].forEach((run) => {
      expect(parseRun(serializeRun(run))).toEqual(run);
    });
  });

  it("the stored text carries the version", () => {
    expect(JSON.parse(serializeRun(busyRun()))).toMatchObject({ version: RUN_SAVE_VERSION });
  });
});

describe("saveRun / loadRun / clearRun", () => {
  it("saves under mathMerge10AdventureRun and loads it back", () => {
    const store = memoryStore();
    saveRun(store, busyRun());
    expect(RUN_SAVE_KEY).toBe("mathMerge10AdventureRun");
    expect(store.data[RUN_SAVE_KEY]).toBeDefined();
    expect(loadRun(store)).toEqual(busyRun());
  });

  it("no save means null", () => {
    expect(loadRun(memoryStore())).toBeNull();
  });

  it("clearRun deletes the save", () => {
    const store = memoryStore();
    saveRun(store, busyRun());
    clearRun(store);
    expect(loadRun(store)).toBeNull();
  });

  it("a finished run (victory or defeat) deletes the save instead of writing it", () => {
    const store = memoryStore();
    saveRun(store, busyRun());
    saveRun(store, { ...busyRun(), phase: "defeat", battle: { ...busyRun().battle!, status: "defeat" } });
    expect(store.data[RUN_SAVE_KEY]).toBeUndefined();
  });

  it("a write error never throws", () => {
    expect(() => saveRun(memoryStore({}, true), busyRun())).not.toThrow();
  });

  it("corrupt data is discarded: loadRun returns null and removes the key", () => {
    const bad = ["", "{", "null", "[]", "42", '"x"', "{\"version\":1}", '{"version":99,"run":{}}'];
    bad.forEach((raw) => {
      const store = memoryStore({ [RUN_SAVE_KEY]: raw });
      expect(loadRun(store)).toBeNull();
      expect(store.data[RUN_SAVE_KEY]).toBeUndefined();
    });
  });

  it("a version mismatch discards the save", () => {
    const store = memoryStore({ [RUN_SAVE_KEY]: JSON.stringify({ version: RUN_SAVE_VERSION + 1, run: busyRun() }) });
    expect(loadRun(store)).toBeNull();
    expect(store.data[RUN_SAVE_KEY]).toBeUndefined();
  });

  it("a store whose getItem throws reads as no save", () => {
    const store = { getItem: () => { throw new Error("denied"); }, setItem: () => {}, removeItem: () => {} };
    expect(loadRun(store)).toBeNull();
  });
});

describe("validateRun rejects impossible data (never throws)", () => {
  const mutate = (change: (run: any) => void): unknown => {
    const run = JSON.parse(JSON.stringify(busyRun()));
    change(run);
    return run;
  };

  const cases: Array<[string, (run: any) => void]> = [
    ["unknown phase", (r) => { r.phase = "lobby"; }],
    ["battleIndex out of range", (r) => { r.battleIndex = 9; }],
    ["fractional battleIndex", (r) => { r.battleIndex = 1.5; }],
    ["enemy does not match battleIndex", (r) => { r.battleIndex = 0; }],
    ["unknown enemy id", (r) => { r.battle.enemyId = "dragon"; }],
    ["enemyMaxHp edited", (r) => { r.battle.enemyMaxHp = 9999; }],
    ["enemyHp above max", (r) => { r.battle.enemyHp = 51; }],
    ["negative heroHp", (r) => { r.heroHp = -1; r.battle.heroHp = -1; }],
    ["heroHp above max", (r) => { r.heroHp = 11; r.battle.heroHp = 11; }],
    ["run and battle HP disagree", (r) => { r.battle.heroHp = 4; }],
    ["grid too small", (r) => { r.battle.grid.pop(); }],
    ["grid row too short", (r) => { r.battle.grid[0].pop(); }],
    ["tile value 10", (r) => { r.battle.grid[0][0] = 10; }],
    ["tile value -2", (r) => { r.battle.grid[0][0] = -2; }],
    ["tile is a string", (r) => { r.battle.grid[0][0] = "3"; }],
    ["freeze on an empty cell", (r) => { r.battle.freezes = [{ row: 3, col: 3, turns: 2 }]; }],
    ["freeze on a stone", (r) => { r.battle.freezes = [{ row: 0, col: 1, turns: 2 }]; }],
    ["freeze turns 0", (r) => { r.battle.freezes[0].turns = 0; }],
    ["freeze turns 9", (r) => { r.battle.freezes[0].turns = 9; }],
    ["duplicate freeze", (r) => { r.battle.freezes.push({ ...r.battle.freezes[0] }); }],
    ["intentIndex beyond the cycle", (r) => { r.battle.intentIndex = 5; }],
    ["countdown 0", (r) => { r.battle.countdown = 0; }],
    ["countdown above the slot's length", (r) => { r.battle.countdown = 99; }],
    ["negative mana", (r) => { r.battle.mana = -1; }],
    ["status is a number", (r) => { r.battle.status = 3; }],
    ["battle status disagrees with the phase", (r) => { r.battle.status = "victory"; }],
    ["upgrade flag missing", (r) => { delete r.upgrades.bomb; }],
    ["unknown relic", (r) => { r.relics = ["nope"]; }],
    ["duplicate relic", (r) => { r.relics = ["chainRing", "chainRing"]; }],
    ["pool is not an array", (r) => { r.pool = "all"; }],
    ["relicData value not a number", (r) => { r.battle.relicData = { x: "1" }; }],
    ["stats missing", (r) => { delete r.stats; }],
    ["battle missing in battle phase", (r) => { r.battle = null; }],
    ["offers pending during a battle", (r) => { r.offers = [{ kind: "heal", amount: 3 }]; }],
    ["no offers in the reward phase", (r) => { r.phase = "reward"; r.battle.status = "victory"; }],
    ["victory before the last battle", (r) => { r.phase = "victory"; r.battle.status = "victory"; }],
  ];

  it.each(cases)("%s", (_name, change) => {
    expect(validateRun(mutate(change))).toBeNull();
  });

  it("non-objects are rejected", () => {
    [null, undefined, 3, "x", [], true].forEach((v) => expect(validateRun(v)).toBeNull());
  });

  it("a relic pick with a bad offer is rejected", () => {
    const run = JSON.parse(JSON.stringify(createRun(seededRng(1), POOL)));
    run.offers[0] = { kind: "relic", relicId: "ghost" };
    expect(validateRun(run)).toBeNull();
    run.offers = [{ kind: "upgrade", spell: "fireball" }];
    expect(validateRun(run)).toBeNull();
    run.offers = [];
    expect(validateRun(run)).toBeNull();
  });

  it("a valid run with the maximum-sized numbers still passes", () => {
    const run = mutate((r) => {
      r.stats.maxChain = 8;
      r.battle.turn = 5000;
    });
    expect(validateRun(run)).not.toBeNull();
  });
});
