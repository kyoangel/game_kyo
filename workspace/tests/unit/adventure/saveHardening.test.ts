import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import { RUN_SAVE_KEY, loadRun, serializeRun, validateRun } from "../../../src/adventure/save";
import { TOTAL_BATTLES, chooseOffer, rollOffers, runTurn, type RunState } from "../../../src/adventure/run";
import { STARTER_RELIC_IDS, UNLOCKABLE_RELIC_IDS } from "../../../src/adventure/relics";
import { gridWith, seededRng } from "./battleHelpers";
import { runInBattle } from "./runHelpers";
import { memoryStore } from "./storeHelper";

const POOL = [...STARTER_RELIC_IDS];
const LAST = TOTAL_BATTLES - 1;

/** Deep copy through JSON so a test can poke at the plain data. */
function clone(run: RunState): any {
  return JSON.parse(JSON.stringify(run));
}

function ongoing(): RunState {
  return runInBattle(gridWith([[3, STONE, 0, 7]]), {}, {}, 1);
}

function reward(changes: Partial<RunState> = {}, battleIndex = 0): RunState {
  const base = runInBattle(gridWith([[1]]), { status: "victory", enemyHp: 0 }, {}, battleIndex);
  return { ...base, phase: "reward", offers: [{ kind: "heal", amount: 3 }], ...changes };
}

describe("last battle reward (finding 1)", () => {
  it("validateRun rejects a reward phase after the last battle", () => {
    expect(validateRun(clone(reward({}, LAST)))).toBeNull();
    expect(validateRun(clone(reward({}, LAST - 1)))).not.toBeNull();
  });

  it("chooseOffer never advances past the last battle", () => {
    const run = reward({}, LAST);
    const step = chooseOffer(run, 0, seededRng(1));
    expect(step.applied).toBe(false);
    expect(step.run).toBe(run);
  });
});

describe("battle status vs hp (finding 2)", () => {
  it("accepts what the engine produces: a won battle and a lost battle", () => {
    const won = runTurn(runInBattle(gridWith([[4, 6]]), { enemyHp: 10 }), "left", seededRng(2)).run;
    expect(won.phase).toBe("reward");
    expect(validateRun(clone(won))).not.toBeNull();
    const lost = runInBattle(gridWith([[1]]), { status: "defeat", heroHp: 0 }, { phase: "defeat", heroHp: 0 });
    expect(validateRun(clone(lost))).not.toBeNull();
  });

  it.each([
    ["ongoing with enemyHp 0", (r: any) => { r.battle.enemyHp = 0; }],
    ["ongoing with heroHp 0", (r: any) => { r.battle.heroHp = 0; r.heroHp = 0; }],
    ["battle heroMaxHp differs from the run", (r: any) => { r.battle.heroMaxHp = 5; r.battle.heroHp = 5; r.heroHp = 5; }],
    ["battle upgrades differ from the run", (r: any) => { r.battle.upgrades.hammer = true; }],
  ])("rejects %s", (_name, mutate) => {
    const run = clone(ongoing());
    expect(validateRun(run)).not.toBeNull();
    mutate(run);
    expect(validateRun(run)).toBeNull();
  });

  it("rejects a victory with enemy hp left and a defeat with hero hp left", () => {
    const victory = clone(reward());
    victory.battle.enemyHp = 5;
    expect(validateRun(victory)).toBeNull();
    const defeat = clone(runInBattle(gridWith([[1]]), { status: "defeat", heroHp: 0 }, { phase: "defeat", heroHp: 0 }));
    defeat.battle.heroHp = 3;
    defeat.heroHp = 3;
    expect(validateRun(defeat)).toBeNull();
  });
});

describe("offers vs run state (finding 3)", () => {
  const opening = (offers: unknown): any => ({
    ...clone(runInBattle(gridWith([]), {}, { relics: [] })),
    phase: "relicPick",
    battle: null,
    battleIndex: 0,
    offers,
  });

  it("relicPick accepts three pool relics", () => {
    const offers = POOL.slice(0, 3).map((relicId) => ({ kind: "relic", relicId }));
    expect(validateRun(opening(offers))).not.toBeNull();
  });

  it("relicPick rejects non-relic offers, relics outside the pool and duplicates", () => {
    expect(validateRun(opening([{ kind: "heal", amount: 3 }]))).toBeNull();
    expect(validateRun(opening([{ kind: "upgrade", spell: "bomb" }]))).toBeNull();
    const locked = UNLOCKABLE_RELIC_IDS[0];
    expect(validateRun(opening([{ kind: "relic", relicId: locked }]))).toBeNull();
    expect(validateRun(opening([{ kind: "relic", relicId: POOL[0] }, { kind: "relic", relicId: POOL[0] }]))).toBeNull();
  });

  it("reward accepts a legitimate normal offer set", () => {
    const run = reward({ relics: [POOL[0]] });
    const offers = rollOffers(run, false, seededRng(3));
    expect(validateRun(clone({ ...run, offers }))).not.toBeNull();
  });

  it("reward rejects an owned relic, a locked relic, an upgraded spell and a wrong heal amount", () => {
    const owned = reward({ relics: [POOL[0]], offers: [{ kind: "relic", relicId: POOL[0] }] });
    expect(validateRun(clone(owned))).toBeNull();
    const locked = reward({ offers: [{ kind: "relic", relicId: UNLOCKABLE_RELIC_IDS[0] }] });
    expect(validateRun(clone(locked))).toBeNull();
    const upgraded = reward({
      upgrades: { hammer: true, addOne: false, bomb: false, shuffle: false },
      battleIndex: 0,
      offers: [{ kind: "upgrade", spell: "hammer" }],
    });
    upgraded.battle = { ...upgraded.battle!, upgrades: upgraded.upgrades };
    expect(validateRun(clone(upgraded))).toBeNull();
    expect(validateRun(clone(reward({ offers: [{ kind: "heal", amount: 99 }] })))).toBeNull();
  });
});

describe("loadRun on finished runs (finding 4)", () => {
  it("returns null and clears the key for victory and defeat saves", () => {
    const defeat = runInBattle(gridWith([[1]]), { status: "defeat", heroHp: 0 }, { phase: "defeat", heroHp: 0 });
    const victory = runInBattle(gridWith([[1]]), { status: "victory", enemyHp: 0 }, { phase: "victory" }, LAST);
    [defeat, victory].forEach((run) => {
      const store = memoryStore({ [RUN_SAVE_KEY]: serializeRun(run) });
      expect(loadRun(store)).toBeNull();
      expect(store.data[RUN_SAVE_KEY]).toBeUndefined();
    });
  });
});

describe("boss reward with the relic pool exhausted (check 5)", () => {
  it("a boss win with every pool relic owned still reaches a reward with upgrade and heal, and chooseOffer proceeds", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10 }, { relics: [...POOL] }, 2);
    const won = runTurn(run, "left", seededRng(2)).run;
    expect(won.phase).toBe("reward");
    expect(won.offers.map((o) => o.kind)).toEqual(["upgrade", "heal"]);
    const next = chooseOffer(won, 1, seededRng(3));
    expect(next.applied).toBe(true);
    expect(next.run.battleIndex).toBe(3);
  });
});
