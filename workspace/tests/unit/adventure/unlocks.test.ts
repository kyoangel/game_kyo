import { describe, it, expect } from "vitest";
import {
  ADVENTURE_TROPHIES,
  ADVENTURE_TROPHY_KEY,
  checkAdventureTrophies,
  getAdventureTrophy,
  loadAdventureTrophies,
  unlockedRelicIds,
  type AdventureTrophyEvent,
} from "../../../src/adventure/unlocks";
import { STARTER_RELIC_IDS, UNLOCKABLE_RELIC_IDS, getRelic } from "../../../src/adventure/relics";
import { memoryStore } from "./storeHelper";

const won = (extra: Partial<Extract<AdventureTrophyEvent, { type: "battleWon" }>> = {}): AdventureTrophyEvent => ({
  type: "battleWon",
  enemyId: "slime",
  overloads: 0,
  maxChain: 1,
  stonesBroken: 0,
  ...extra,
});

describe("adventure trophy table (spec 8)", () => {
  it("has 6 trophies, each unlocking a different one of the 6 non-starter relics", () => {
    expect(ADVENTURE_TROPHIES).toHaveLength(6);
    expect(new Set(ADVENTURE_TROPHIES.map((t) => t.id)).size).toBe(6);
    expect([...ADVENTURE_TROPHIES.map((t) => t.relicId)].sort()).toEqual([...UNLOCKABLE_RELIC_IDS].sort());
    ADVENTURE_TROPHIES.forEach((t) => expect(getRelic(t.relicId)?.starter).toBe(false));
  });

  it("includes the spec examples: treeKing, first clear, 3 overloads in one battle", () => {
    expect(getAdventureTrophy("adv_treeKing")?.relicId).toBe("forestHeart");
    expect(getAdventureTrophy("adv_clear")?.description).toContain("通關");
    expect(getAdventureTrophy("adv_overload3")?.relicId).toBe("surgeConduit");
  });
});

describe("checkAdventureTrophies", () => {
  it("beating the tree king unlocks adv_treeKing once", () => {
    const store = memoryStore();
    expect(checkAdventureTrophies(won({ enemyId: "treeKing" }), store, 111)).toEqual(["adv_treeKing"]);
    expect(checkAdventureTrophies(won({ enemyId: "treeKing" }), store, 222)).toEqual([]);
    expect(loadAdventureTrophies(store)).toEqual({ adv_treeKing: 111 });
  });

  it("the ice queen, the clear, 3 overloads, a 3-pair slide and 6 stones each unlock their own trophy", () => {
    const store = memoryStore();
    expect(checkAdventureTrophies(won({ enemyId: "iceQueen" }), store)).toEqual(["adv_iceQueen"]);
    expect(checkAdventureTrophies({ type: "runWon" }, store)).toEqual(["adv_clear"]);
    expect(checkAdventureTrophies(won({ overloads: 3 }), store)).toEqual(["adv_overload3"]);
    expect(checkAdventureTrophies(won({ maxChain: 3 }), store)).toEqual(["adv_chain3"]);
    expect(checkAdventureTrophies(won({ stonesBroken: 6 }), store)).toEqual(["adv_stones6"]);
  });

  it("thresholds are exact: 2 overloads, a 2-pair chain and 5 stones do not count", () => {
    const store = memoryStore();
    expect(checkAdventureTrophies(won({ overloads: 2, maxChain: 2, stonesBroken: 5 }), store)).toEqual([]);
  });

  it("one event can unlock several trophies", () => {
    const store = memoryStore();
    const ids = checkAdventureTrophies(won({ enemyId: "treeKing", overloads: 3, maxChain: 3, stonesBroken: 6 }), store);
    expect([...ids].sort()).toEqual(["adv_chain3", "adv_overload3", "adv_stones6", "adv_treeKing"]);
  });

  it("a failed storage write does not throw (the unlock is still reported)", () => {
    const store = memoryStore({}, true);
    expect(checkAdventureTrophies({ type: "runWon" }, store)).toEqual(["adv_clear"]);
  });
});

describe("loadAdventureTrophies / unlockedRelicIds", () => {
  it("corrupt or foreign storage reads as nothing unlocked", () => {
    expect(loadAdventureTrophies(memoryStore({ [ADVENTURE_TROPHY_KEY]: "{{{" }))).toEqual({});
    expect(loadAdventureTrophies(memoryStore({ [ADVENTURE_TROPHY_KEY]: "[1,2]" }))).toEqual({});
    expect(loadAdventureTrophies(memoryStore({ [ADVENTURE_TROPHY_KEY]: '{"bogus":1,"adv_clear":"x"}' }))).toEqual({});
  });

  it("the run pool is the 6 starters plus one relic per unlocked trophy", () => {
    const store = memoryStore();
    expect(unlockedRelicIds(store)).toEqual([...STARTER_RELIC_IDS]);
    checkAdventureTrophies(won({ enemyId: "treeKing" }), store);
    checkAdventureTrophies({ type: "runWon" }, store);
    expect(unlockedRelicIds(store)).toEqual([...STARTER_RELIC_IDS, "forestHeart", "voidEye"]);
  });
});
