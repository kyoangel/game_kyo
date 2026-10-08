import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import { applyTurn, castSpell, createBattle, spellCost, type BattleState } from "../../../src/adventure/battle";
import {
  RELICS,
  STARTER_RELIC_IDS,
  UNLOCKABLE_RELIC_IDS,
  getRelic,
  mergeRelicHooks,
} from "../../../src/adventure/relics";
import { gridWith, makeState, scripted } from "./battleHelpers";

const fresh = (changes: Partial<BattleState> = {}, enemyId = "treeKing") =>
  makeState(gridWith([[4, 6, 4, 6]]), changes, enemyId);

describe("relic roster (spec 7)", () => {
  it("has 12 relics with unique ids: 6 in the opening pool, 6 unlocked by trophies", () => {
    expect(RELICS).toHaveLength(12);
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(12);
    expect(STARTER_RELIC_IDS).toEqual([
      "manaCrystal", "chainRing", "lifeStaff", "surgeHeart", "complementCharm", "masonGloves",
    ]);
    expect(UNLOCKABLE_RELIC_IDS).toHaveLength(6);
  });

  it("every relic has a name, icon and description, and defines at least one hook", () => {
    RELICS.forEach((r) => {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.icon.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect(Object.keys(r.hooks).length).toBeGreaterThan(0);
    });
  });

  it("getRelic finds ids and returns undefined for unknown ones", () => {
    expect(getRelic("chainRing")?.name).toBe("連鎖之戒");
    expect(getRelic("nope")).toBeUndefined();
  });
});

describe("mergeRelicHooks: the composer", () => {
  it("no relics behaves like the defaults", () => {
    const hooks = mergeRelicHooks([]);
    expect(hooks.chainMultiplier(fresh())).toBe(1.5);
    expect(hooks.spellCost(fresh(), "bomb", 4)).toBe(4);
    expect(hooks.onBattleStart(fresh())).toBeUndefined();
  });

  it("unknown ids are skipped", () => {
    const hooks = mergeRelicHooks(["ghost", "manaCrystal"]);
    expect(hooks.onBattleStart(fresh())).toEqual({ mana: 2 });
  });

  it("two relics on the same event hook add up instead of overwriting", () => {
    const hooks = mergeRelicHooks(["manaCrystal", "surgeConduit", "surgeHeart"]);
    expect(hooks.onOverload(fresh())).toEqual({ mana: 3, enemyDamage: 20, cancelHpLoss: true });
    const stones = mergeRelicHooks(["masonGloves", "magmaCore"]);
    expect(stones.onStoneBroken(fresh(), [{ row: 0, col: 0 }, { row: 1, col: 1 }], "adjacent")).toEqual({
      mana: 2,
      enemyDamage: 10,
    });
  });

  it("chain multiplier takes the highest relic value (ring 2, eye 2.5), never below 1.5", () => {
    expect(mergeRelicHooks(["chainRing"]).chainMultiplier(fresh())).toBe(2);
    expect(mergeRelicHooks(["chainRing", "voidEye"]).chainMultiplier(fresh())).toBe(2.5);
    expect(mergeRelicHooks(["manaCrystal"]).chainMultiplier(fresh())).toBe(1.5);
  });

  it("spawn strategy merges field-wise with the default bias", () => {
    expect(mergeRelicHooks(["complementCharm"]).spawnStrategy(fresh())).toEqual({
      emptyThreshold: 4,
      probability: 0.5,
      baseProbability: 0.3,
    });
    expect(mergeRelicHooks(["manaCrystal"]).spawnStrategy(fresh())).toEqual({
      emptyThreshold: 4,
      probability: 0.5,
      baseProbability: 0,
    });
  });

  it("spell cost deltas add up and never go below 0", () => {
    const hooks = mergeRelicHooks(["inlayHammer"]);
    expect(hooks.spellCost(fresh(), "hammer", 2)).toBe(1);
    expect(hooks.spellCost(fresh(), "addOne", 1)).toBe(0);
    expect(hooks.spellCost(fresh(), "bomb", 4)).toBe(4);
    expect(spellCost(fresh(), "hammer", hooks)).toBe(1);
  });

  it("relicData writes from several relics merge", () => {
    const hooks = mergeRelicHooks(["forestHeart"]);
    expect(hooks.onPairCleared(fresh(), { count: 1, chain: false, damagePerPair: 10 })).toEqual({
      heroHp: 1,
      relicData: { forestHeartUsed: 1 },
    });
  });
});

describe("the 6 opening relics inside real battles", () => {
  it("魔力水晶: +2 mana when the battle starts", () => {
    const { state } = createBattle({ enemyId: "slime", heroHp: 10, heroMaxHp: 10 }, () => 0, mergeRelicHooks(["manaCrystal"]));
    expect(state.mana).toBe(2);
  });

  it("連鎖之戒: two pairs in one slide deal 20 each instead of 15", () => {
    const base = applyTurn(fresh(), "left", () => 0, mergeRelicHooks([]));
    const ring = applyTurn(fresh(), "left", () => 0, mergeRelicHooks(["chainRing"]));
    expect(base.state.enemyHp).toBe(150 - 30);
    expect(ring.state.enemyHp).toBe(150 - 40);
  });

  it("生命之杖: +2 HP after a victory only", () => {
    const hooks = mergeRelicHooks(["lifeStaff"]);
    const win = applyTurn(
      makeState(gridWith([[4, 6]]), { heroHp: 5, enemyHp: 10 }, "slime"),
      "left",
      () => 0,
      hooks,
    );
    expect(win.state.status).toBe("victory");
    expect(win.state.heroHp).toBe(7);
    const lose = applyTurn(
      makeState(gridWith([[5]]), { heroHp: 1, countdown: 1 }, "slime"),
      "right",
      () => 0,
      hooks,
    );
    expect(lose.state.status).toBe("defeat");
    expect(lose.state.heroHp).toBe(0);
  });

  it("暴走之心: an overload costs no HP and deals 20 damage", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next } = applyTurn(state, "up", () => 0, mergeRelicHooks(["surgeHeart"]));
    expect(next.heroHp).toBe(10);
    expect(next.enemyHp).toBe(20);
  });

  it("補數護符: a complement spawn can happen with plenty of room (30%)", () => {
    // 15 empty cells; rng 0 rolls under 30%, picks the first complement option (cell above/left of the 3 -> value 7)
    const state = makeState(gridWith([[null, 3, 4, 6]]), { countdown: 4 });
    const plain = applyTurn(state, "down", scripted(0, 0, 0), mergeRelicHooks([]));
    const charm = applyTurn(state, "down", scripted(0, 0, 0), mergeRelicHooks(["complementCharm"]));
    const spawned = (s: BattleState) => s.grid.flat().filter((c) => c !== null).length;
    expect(spawned(plain.state)).toBe(spawned(charm.state));
    const spawnEvent = (r: { events: Array<{ type: string; value?: number }> }) =>
      r.events.find((e) => e.type === "tileSpawned")?.value;
    expect(spawnEvent(plain)).toBe(1); // unbiased rng 0 -> value 1
    expect(spawnEvent(charm)).toBe(7); // biased: complement of the 3 above
  });

  it("石匠手套: each stone broken by a pair deals 5 damage", () => {
    const state = makeState(gridWith([[4, 6, STONE]]), {}, "treeKing");
    const { state: next } = applyTurn(state, "left", () => 0, mergeRelicHooks(["masonGloves"]));
    expect(next.enemyHp).toBe(150 - 10 - 5);
  });
});

describe("the 6 trophy relics inside real battles", () => {
  it("森林之心: heals 1 on the first elimination of a battle only", () => {
    const hooks = mergeRelicHooks(["forestHeart"]);
    const first = applyTurn(fresh({ heroHp: 5 }), "left", () => 0, hooks);
    expect(first.state.heroHp).toBe(6);
    expect(first.state.relicData).toEqual({ forestHeartUsed: 1 });
    const again = applyTurn(
      makeState(gridWith([[4, 6]]), { heroHp: 6, relicData: first.state.relicData }, "treeKing"),
      "left",
      () => 0,
      hooks,
    );
    expect(again.state.heroHp).toBe(6);
  });

  it("冰晶棱鏡: +2 damage per pair", () => {
    const { state } = applyTurn(fresh(), "left", () => 0, mergeRelicHooks(["iceShard"]));
    expect(state.enemyHp).toBe(150 - 30 - 4);
  });

  it("虛無之眼: chains deal floor(10 x 2.5) = 25 per pair", () => {
    const { state } = applyTurn(fresh(), "left", () => 0, mergeRelicHooks(["voidEye"]));
    expect(state.enemyHp).toBe(150 - 50);
  });

  it("暴走導管: an overload gives +3 mana (and still costs the 2 HP)", () => {
    const state = makeState(gridWith([[5]]), { freezes: [{ row: 0, col: 0, turns: 3 }] });
    const { state: next } = applyTurn(state, "up", () => 0, mergeRelicHooks(["surgeConduit"]));
    expect(next.mana).toBe(3);
    expect(next.heroHp).toBe(8);
  });

  it("鑲嵌鎚: hammer costs 1 and addOne costs 1 less; bomb is unchanged", () => {
    const hooks = mergeRelicHooks(["inlayHammer"]);
    const state = makeState(gridWith([[5, 6]]), { mana: 1 });
    const cast = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0, hooks);
    expect(cast.applied).toBe(true);
    expect(cast.state.mana).toBe(0);
    expect(castSpell(state, "bomb", { row: 0, col: 0 }, () => 0, hooks).reason).toBe("notEnoughMana");
  });

  it("熔岩核心: each stone broken gives +1 mana (also via the hammer)", () => {
    const hooks = mergeRelicHooks(["magmaCore"]);
    const state = makeState(gridWith([[STONE, 5]]), { mana: 2 });
    const cast = castSpell(state, "hammer", { row: 0, col: 0 }, () => 0, hooks);
    expect(cast.state.mana).toBe(1); // 2 - 2 + 1
  });
});
