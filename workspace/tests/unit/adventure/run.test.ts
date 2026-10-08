import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import { NO_UPGRADES } from "../../../src/adventure/battle";
import {
  BATTLE_ORDER,
  HEAL_OPTION_AMOUNT,
  chooseOffer,
  createRun,
  rollOffers,
  runCast,
  runTurn,
  type RunState,
} from "../../../src/adventure/run";
import { STARTER_RELIC_IDS, UNLOCKABLE_RELIC_IDS } from "../../../src/adventure/relics";
import { gridWith, scripted, seededRng } from "./battleHelpers";
import { runInBattle } from "./runHelpers";

const POOL = [...STARTER_RELIC_IDS];

describe("createRun", () => {
  it("starts at the relic pick with full HP, no relics and 3 different opening relics from the pool", () => {
    const run = createRun(seededRng(1), POOL);
    expect(run.phase).toBe("relicPick");
    expect(run.battle).toBeNull();
    expect(run.heroHp).toBe(10);
    expect(run.heroMaxHp).toBe(10);
    expect(run.relics).toEqual([]);
    expect(run.upgrades).toEqual(NO_UPGRADES);
    expect(run.offers).toHaveLength(3);
    const ids = run.offers.map((o) => (o.kind === "relic" ? o.relicId : ""));
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(POOL).toContain(id));
  });

  it("is deterministic for a fixed seed and drops unknown pool ids", () => {
    expect(createRun(seededRng(7), POOL)).toEqual(createRun(seededRng(7), POOL));
    expect(createRun(seededRng(7), [...POOL, "ghost"]).pool).toEqual(POOL);
  });

  it("unlocked relics can show up in the opening offers", () => {
    const pool = [...POOL, ...UNLOCKABLE_RELIC_IDS];
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      createRun(seededRng(seed), pool).offers.forEach((o) => o.kind === "relic" && seen.add(o.relicId));
    }
    expect(UNLOCKABLE_RELIC_IDS.some((id) => seen.has(id))).toBe(true);
  });
});

describe("the battle order (spec 6)", () => {
  it("is 9 fights: normal, normal, boss in forest, ice cave and demon tower", () => {
    expect(BATTLE_ORDER).toEqual([
      "slime", "stoneGolem", "treeKing",
      "snowSprite", "crystalGuard", "iceQueen",
      "spiralMage", "shadowBlock", "zeroLord",
    ]);
  });
});

describe("chooseOffer at the relic pick", () => {
  it("takes the relic and starts battle 0 with it in play", () => {
    const run = createRun(seededRng(3), POOL);
    const pick = run.offers[1];
    const step = chooseOffer(run, 1, seededRng(4));
    expect(step.applied).toBe(true);
    expect(step.run.phase).toBe("battle");
    expect(step.run.battleIndex).toBe(0);
    expect(step.run.relics).toEqual([pick.kind === "relic" ? pick.relicId : ""]);
    expect(step.run.battle?.enemyId).toBe("slime");
    expect(step.run.offers).toEqual([]);
    expect(step.events.length).toBeGreaterThan(0);
  });

  it("魔力水晶 as the opening relic shows up as 2 mana at the start of battle 0", () => {
    const run: RunState = { ...createRun(seededRng(3), POOL), offers: [{ kind: "relic", relicId: "manaCrystal" }] };
    expect(chooseOffer(run, 0, seededRng(4)).run.battle?.mana).toBe(2);
  });

  it("a bad index or the wrong phase changes nothing", () => {
    const run = createRun(seededRng(3), POOL);
    expect(chooseOffer(run, 9, seededRng(4))).toMatchObject({ applied: false, reason: "badChoice", run });
    const inBattle = runInBattle(gridWith([[1, 2]]));
    expect(chooseOffer(inBattle, 0, seededRng(4))).toMatchObject({ applied: false, reason: "wrongPhase" });
  });
});

describe("rollOffers (spec 6)", () => {
  const base = runInBattle(gridWith([]), {}, { relics: ["chainRing"] });

  it("a normal win offers one unowned relic, one un-upgraded spell and the 3 HP heal", () => {
    const offers = rollOffers(base, false, seededRng(5));
    expect(offers.map((o) => o.kind)).toEqual(["relic", "upgrade", "heal"]);
    const relic = offers[0];
    expect(relic.kind === "relic" && relic.relicId).not.toBe("chainRing");
    expect(offers[2]).toEqual({ kind: "heal", amount: HEAL_OPTION_AMOUNT });
  });

  it("skips kinds that ran out: all spells upgraded, all pool relics owned", () => {
    const allUp = { hammer: true, addOne: true, bomb: true, shuffle: true };
    const run = { ...base, upgrades: allUp, relics: [...POOL] };
    expect(rollOffers(run, false, seededRng(5))).toEqual([{ kind: "heal", amount: 3 }]);
  });

  it("a boss win offers three different unowned relics", () => {
    const offers = rollOffers(base, true, seededRng(5));
    expect(offers).toHaveLength(3);
    const ids = offers.map((o) => (o.kind === "relic" ? o.relicId : "x"));
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain("chainRing");
  });

  it("a boss win with fewer than 3 relics left offers what is left, then falls back to the normal offers", () => {
    const fewLeft = { ...base, relics: POOL.slice(0, 5) };
    expect(rollOffers(fewLeft, true, seededRng(5))).toEqual([{ kind: "relic", relicId: POOL[5] }]);
    const none = { ...base, relics: [...POOL] };
    expect(rollOffers(none, true, seededRng(5)).map((o) => o.kind)).toEqual(["upgrade", "heal"]);
  });
});

describe("chooseOffer in the reward phase", () => {
  const rewardRun = (offer: RunState["offers"][number], changes: Partial<RunState> = {}): RunState => ({
    ...runInBattle(gridWith([]), { status: "victory", enemyHp: 0 }),
    phase: "reward",
    offers: [offer],
    ...changes,
  });

  it("a relic is added and the next enemy appears", () => {
    const step = chooseOffer(rewardRun({ kind: "relic", relicId: "iceShard" }), 0, seededRng(1));
    expect(step.run.relics).toEqual(["iceShard"]);
    expect(step.run.battleIndex).toBe(1);
    expect(step.run.battle?.enemyId).toBe("stoneGolem");
    expect(step.run.phase).toBe("battle");
  });

  it("a spell upgrade is stored and carried into the next battle", () => {
    const step = chooseOffer(rewardRun({ kind: "upgrade", spell: "bomb" }), 0, seededRng(1));
    expect(step.run.upgrades.bomb).toBe(true);
    expect(step.run.battle?.upgrades.bomb).toBe(true);
    expect(step.run.battle?.upgrades.hammer).toBe(false);
  });

  it("the heal is capped at max HP and HP carries into the next battle; mana, shield and freezes reset", () => {
    const hurt = rewardRun({ kind: "heal", amount: 3 }, { heroHp: 4 });
    const step = chooseOffer(hurt, 0, seededRng(1));
    expect(step.run.heroHp).toBe(7);
    expect(step.run.battle).toMatchObject({ heroHp: 7, mana: 0, enemyShield: 0, freezes: [], overloads: 0, turn: 0 });
    const nearFull = chooseOffer(rewardRun({ kind: "heal", amount: 3 }, { heroHp: 9 }), 0, seededRng(1));
    expect(nearFull.run.heroHp).toBe(10);
  });

  it("per-battle stats reset when the next battle starts", () => {
    const run = rewardRun({ kind: "heal", amount: 3 }, { stats: { stonesBroken: 5, maxChain: 3 } });
    expect(chooseOffer(run, 0, seededRng(1)).run.stats).toEqual({ stonesBroken: 0, maxChain: 0 });
  });
});

describe("runTurn", () => {
  it("an invalid swipe is not a turn", () => {
    const run = runInBattle(gridWith([[1, 2, 3, 4]]));
    const step = runTurn(run, "left", () => 0);
    expect(step.applied).toBe(false);
    expect(step.run).toBe(run);
  });

  it("a normal turn updates the battle and copies hero HP into the run", () => {
    const run = runInBattle(gridWith([[5]]), { countdown: 1, heroHp: 5 });
    const step = runTurn(run, "right", scripted(0, 0, 0));
    expect(step.applied).toBe(true);
    expect(step.run.heroHp).toBe(4); // slime attack 1
    expect(step.run.battle?.heroHp).toBe(4);
    expect(step.run.phase).toBe("battle");
    expect(step.trophyEvents).toEqual([]);
  });

  it("winning a normal fight moves to the reward phase with offers and reports battleWon", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10, overloads: 2 }, { stats: { stonesBroken: 4, maxChain: 2 } });
    const step = runTurn(run, "left", seededRng(2));
    expect(step.run.phase).toBe("reward");
    expect(step.run.battle?.status).toBe("victory");
    expect(step.run.offers.map((o) => o.kind)).toEqual(["relic", "upgrade", "heal"]);
    expect(step.trophyEvents).toEqual([
      { type: "battleWon", enemyId: "slime", overloads: 2, maxChain: 2, stonesBroken: 4 },
    ]);
  });

  it("生命之杖 heals after the win and the heal reaches the run", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10, heroHp: 5 }, { relics: ["lifeStaff"] });
    expect(runTurn(run, "left", seededRng(2)).run.heroHp).toBe(7);
  });

  it("a boss win heals half the max HP (floor) and offers three relics", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10, heroHp: 3 }, {}, 2);
    const step = runTurn(run, "left", seededRng(2));
    expect(step.run.heroHp).toBe(8);
    expect(step.run.offers.map((o) => o.kind)).toEqual(["relic", "relic", "relic"]);
    expect(step.trophyEvents[0]).toMatchObject({ type: "battleWon", enemyId: "treeKing" });
    const full = runTurn(runInBattle(gridWith([[4, 6]]), { enemyHp: 10, heroHp: 9 }, {}, 2), "left", seededRng(2));
    expect(full.run.heroHp).toBe(10);
  });

  it("beating the zero lord ends the run in victory with battleWon and runWon, and no offers", () => {
    const run = runInBattle(gridWith([[4, 6]]), { enemyHp: 10 }, {}, 8);
    const step = runTurn(run, "left", seededRng(2));
    expect(step.run.phase).toBe("victory");
    expect(step.run.offers).toEqual([]);
    expect(step.trophyEvents.map((e) => e.type)).toEqual(["battleWon", "runWon"]);
  });

  it("losing all HP ends the run in defeat but keeps the battle for the result screen", () => {
    const run = runInBattle(gridWith([[5]]), { heroHp: 1, countdown: 1 });
    const step = runTurn(run, "right", scripted(0, 0, 0));
    expect(step.run.phase).toBe("defeat");
    expect(step.run.heroHp).toBe(0);
    expect(step.run.battle?.status).toBe("defeat");
    expect(step.trophyEvents).toEqual([]);
  });

  it("tracks the biggest slide chain and the stones broken in the battle", () => {
    const run = runInBattle(gridWith([[4, 6, 4, 6, STONE]]), { enemyHp: 100 }, {}, 2);
    const step = runTurn(run, "left", scripted(0, 0, 0));
    expect(step.run.stats.maxChain).toBe(2);
    const stoneRun = runInBattle(gridWith([[4, 6, STONE]]), {}, { stats: { stonesBroken: 1, maxChain: 1 } });
    const after = runTurn(stoneRun, "left", scripted(0, 0, 0));
    expect(after.run.stats).toEqual({ stonesBroken: 2, maxChain: 1 });
  });

  it("does nothing outside the battle phase", () => {
    const run = createRun(seededRng(1), POOL);
    expect(runTurn(run, "left", () => 0)).toMatchObject({ applied: false, reason: "wrongPhase" });
  });
});

describe("runCast", () => {
  it("casts through the relic-merged hooks and reports failures", () => {
    const run = runInBattle(gridWith([[STONE, 5]]), { mana: 1 }, { relics: ["inlayHammer"] });
    const ok = runCast(run, "hammer", { row: 0, col: 0 }, () => 0);
    expect(ok.applied).toBe(true);
    expect(ok.run.battle?.mana).toBe(0);
    const poor = runCast(runInBattle(gridWith([[STONE, 5]]), { mana: 1 }), "hammer", { row: 0, col: 0 }, () => 0);
    expect(poor).toMatchObject({ applied: false, reason: "notEnoughMana" });
    const badTarget = runCast(runInBattle(gridWith([[5]]), { mana: 4 }), "hammer", { row: 3, col: 3 }, () => 0);
    expect(badTarget).toMatchObject({ applied: false, reason: "invalidTarget" });
  });

  it("a spell can win the fight (addOne on a 9 deals 10)", () => {
    const run = runInBattle(gridWith([[9]]), { mana: 2, enemyHp: 10 });
    const step = runCast(run, "addOne", { row: 0, col: 0 }, seededRng(1));
    expect(step.run.phase).toBe("reward");
  });

  it("does nothing outside the battle phase", () => {
    expect(runCast(createRun(seededRng(1), POOL), "shuffle", null, () => 0)).toMatchObject({
      applied: false,
      reason: "wrongPhase",
    });
  });
});
