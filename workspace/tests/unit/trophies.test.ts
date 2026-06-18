import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { checkTrophies, loadTrophyStatuses, getTrophyDef, loadModalData } from "../../src/trophies";

function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
}
const localStorageMock = makeLocalStorageMock();

const EMPTY_GRID = Array.from({ length: 4 }, () => Array(4).fill(null)) as (number | null)[][];
const ONE_TILE_GRID: (number | null)[][] = [
  [1, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
  [null, null, null, null],
];

describe("trophies", () => {
  beforeAll(() => { vi.stubGlobal("localStorage", localStorageMock); });
  afterAll(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { localStorage.clear(); });

  // ── loadTrophyStatuses ────────────────────────────────────────────────────────

  it("loadTrophyStatuses returns exactly 67 entries", () => {
    expect(loadTrophyStatuses()).toHaveLength(67);
  });

  it("loadTrophyStatuses has 6 distinct categories including cumulative", () => {
    const cats = new Set(loadTrophyStatuses().map((s) => s.def.category));
    expect(cats).toEqual(new Set(["numbers", "combos", "scores", "play", "cumulative", "special"]));
  });

  it("loadTrophyStatuses all entries start unlocked: false", () => {
    expect(loadTrophyStatuses().every((s) => !s.unlocked)).toBe(true);
  });

  // ── Number series: thresholds 6/10/14/16 ─────────────────────────────────────

  it("num_1_bronze does NOT unlock with 5 tiles (threshold is now 6)", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("num_1_bronze");
  });

  it("num_1_bronze unlocks with exactly 6 tiles of value 1", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).not.toContain("num_1_silver");
  });

  it("num_1_silver unlocks with 10 tiles", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, null, null],
      [null, null, null, null],
    ];
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).toContain("num_1_silver");
    expect(r).not.toContain("num_1_gold");
  });

  it("num_1_gold unlocks with 14 tiles", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, null, null],
    ];
    const r = checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(r).toContain("num_1_gold");
    expect(r).not.toContain("num_1_diamond");
  });

  it("num_1_diamond unlocks with 16 tiles (full board)", () => {
    const full1: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ];
    const r = checkTrophies({ type: "slide", grid: full1, comboCount: 0 });
    expect(r).toContain("num_1_bronze");
    expect(r).toContain("num_1_silver");
    expect(r).toContain("num_1_gold");
    expect(r).toContain("num_1_diamond");
  });

  it("num_9_bronze unlocks with 6 tiles of value 9", () => {
    const grid: (number | null)[][] = [
      [9, 9, 9, 9],
      [9, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("num_9_bronze");
  });

  // ── maxCombo tracking ─────────────────────────────────────────────────────────

  it("combo_bronze unlocks on first slide with comboCount >= 2", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 2 });
    expect(r).toContain("combo_bronze");
    expect(r).not.toContain("combo_silver");
  });

  it("combo_bronze does NOT unlock when comboCount < 2", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 1 });
    expect(r).not.toContain("combo_bronze");
  });

  it("combo_silver unlocks on first slide with comboCount >= 3", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 3 });
    expect(r).toContain("combo_bronze");
    expect(r).toContain("combo_silver");
    expect(r).not.toContain("combo_gold");
  });

  it("combo_gold unlocks on first slide with comboCount >= 5", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    expect(r).toContain("combo_bronze");
    expect(r).toContain("combo_silver");
    expect(r).toContain("combo_gold");
    expect(r).not.toContain("combo_diamond");
  });

  it("combo_diamond unlocks on first slide with comboCount >= 8", () => {
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 8 });
    expect(r).toContain("combo_bronze");
    expect(r).toContain("combo_silver");
    expect(r).toContain("combo_gold");
    expect(r).toContain("combo_diamond");
  });

  it("maxCombo persists: combo_silver unlocks on later slide without re-unlocking bronze", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 2 });
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 3 });
    expect(r).toContain("combo_silver");
    expect(r).not.toContain("combo_bronze");
  });

  it("maxCombo does NOT regress: combo_gold stays unlocked after lower comboCount slide", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 1 });
    expect(loadTrophyStatuses().find((s) => s.def.id === "combo_gold")!.unlocked).toBe(true);
  });

  // ── totalScore tracking ───────────────────────────────────────────────────────

  it("score_total_bronze does NOT unlock with totalScore < 1000", () => {
    const r = checkTrophies({ type: "gameOver", score: 500 });
    expect(r).not.toContain("score_total_bronze");
  });

  it("score_total_bronze unlocks when totalScore accumulates to >= 1000", () => {
    checkTrophies({ type: "gameOver", score: 500 });
    const r = checkTrophies({ type: "gameOver", score: 600 });
    expect(r).toContain("score_total_bronze");
    expect(r).not.toContain("score_total_silver");
  });

  it("score_total_silver unlocks once totalScore >= 10000", () => {
    // 16 × 600 = 9600 (< 10000), 17th = 10200 (≥ 10000) → unlocks on this call
    for (let i = 0; i < 16; i++) checkTrophies({ type: "gameOver", score: 600 });
    const r = checkTrophies({ type: "gameOver", score: 600 });
    expect(r).toContain("score_total_silver");
  });

  it("score_total trophy IDs are in cumulative category via loadModalData", () => {
    const sections = loadModalData();
    const cumSection = sections.find((s) => s.category === "cumulative")!;
    expect(cumSection.groups[0].tiers!.map((t) => t.def.id)).toEqual([
      "score_total_bronze",
      "score_total_silver",
      "score_total_gold",
      "score_total_diamond",
    ]);
  });

  // ── Score milestones (unchanged behavior) ─────────────────────────────────────

  it("score_100_bronze still unlocks on first game with score >= 100", () => {
    expect(checkTrophies({ type: "gameOver", score: 100 })).toContain("score_100_bronze");
  });

  it("gameOver score=0 unlocks zero_score but not score_100_bronze", () => {
    const r = checkTrophies({ type: "gameOver", score: 0 });
    expect(r).toContain("zero_score");
    expect(r).not.toContain("score_100_bronze");
  });

  it("gameOver score=350 unlocks score_100_bronze + score_300_bronze, not score_500_bronze", () => {
    const r = checkTrophies({ type: "gameOver", score: 350 });
    expect(r).toContain("score_100_bronze");
    expect(r).toContain("score_300_bronze");
    expect(r).not.toContain("score_500_bronze");
  });

  // ── Play count ────────────────────────────────────────────────────────────────

  it("play_bronze unlocks after exactly 10 gameOver events", () => {
    for (let i = 0; i < 9; i++) {
      expect(checkTrophies({ type: "gameOver", score: 0 })).not.toContain("play_bronze");
    }
    expect(checkTrophies({ type: "gameOver", score: 0 })).toContain("play_bronze");
  });

  // ── board_clear / almost_full ─────────────────────────────────────────────────

  it("board_clear unlocks when slide produces an all-null grid", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 0 })).toContain("board_clear");
  });

  it("almost_full unlocks with 15 non-null tiles on board", () => {
    const grid: (number | null)[][] = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, 6, null],
    ];
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("almost_full");
  });

  // ── loadModalData structure ───────────────────────────────────────────────────

  it("loadModalData returns 6 sections in order: numbers/combos/scores/play/cumulative/special", () => {
    const sections = loadModalData();
    expect(sections).toHaveLength(6);
    expect(sections.map((s) => s.category)).toEqual(
      ["numbers", "combos", "scores", "play", "cumulative", "special"]
    );
  });

  it("數字系列 section has 9 groups with thresholds [6,10,14,16]", () => {
    const sections = loadModalData();
    expect(sections[0].groups).toHaveLength(9);
    expect(sections[0].groups[0].thresholds).toEqual([6, 10, 14, 16]);
    expect(sections[0].groups[8].thresholds).toEqual([6, 10, 14, 16]);
  });

  it("連鎖系列 section has 1 group with thresholds [2,3,5,8] and progressCeiling 8", () => {
    const sections = loadModalData();
    expect(sections[1].groups).toHaveLength(1);
    expect(sections[1].groups[0].thresholds).toEqual([2, 3, 5, 8]);
    expect(sections[1].groups[0].progressCeiling).toBe(8);
  });

  it("累積成就 section has 1 group with thresholds [1000,10000,50000,200000]", () => {
    const sections = loadModalData();
    const cum = sections[4];
    expect(cum.categoryLabel).toBe("累積成就");
    expect(cum.groups).toHaveLength(1);
    expect(cum.groups[0].thresholds).toEqual([1000, 10000, 50000, 200000]);
    expect(cum.groups[0].progressCeiling).toBe(200000);
  });

  it("遊玩成就 section has 2 groups: tiered play count + single board_clear", () => {
    const sections = loadModalData();
    const play = sections[3];
    expect(play.groups).toHaveLength(2);
    expect(play.groups[0].type).toBe("tiered");
    expect(play.groups[1].type).toBe("single");
    expect(play.groups[1].single!.def.id).toBe("board_clear");
  });

  it("play group beyondDiamond is false before play_diamond unlocked", () => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ playCount: 10 }));
    localStorage.setItem("mathMerge10Trophies", JSON.stringify({ play_bronze: 1 }));
    expect(loadModalData()[3].groups[0].beyondDiamond).toBe(false);
  });

  it("play group beyondDiamond is true when all 4 play tiers unlocked", () => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ playCount: 510 }));
    localStorage.setItem("mathMerge10Trophies", JSON.stringify({
      play_bronze: 1, play_silver: 2, play_gold: 3, play_diamond: 4,
    }));
    const playGroup = loadModalData()[3].groups[0];
    expect(playGroup.beyondDiamond).toBe(true);
    expect(playGroup.progressValue).toBe(510);
  });

  it("cumulative group beyondDiamond is true when all 4 score_total tiers unlocked", () => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ totalScore: 250000 }));
    localStorage.setItem("mathMerge10Trophies", JSON.stringify({
      score_total_bronze: 1, score_total_silver: 2, score_total_gold: 3, score_total_diamond: 4,
    }));
    const cumGroup = loadModalData()[4].groups[0];
    expect(cumGroup.beyondDiamond).toBe(true);
    expect(cumGroup.progressValue).toBe(250000);
  });

  it("loadModalData progressValue for maxCombo reflects latest slide", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    expect(loadModalData()[1].groups[0].progressValue).toBe(5);
  });

  it("loadModalData progressValue for maxNum1 reflects latest slide", () => {
    const grid: (number | null)[][] = [
      [1, 1, 1, 1],
      [1, 1, 1, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    checkTrophies({ type: "slide", grid, comboCount: 0 });
    expect(loadModalData()[0].groups[0].progressValue).toBe(7);
  });

  it("loadModalData totalScore reflects gameOver accumulation", () => {
    checkTrophies({ type: "gameOver", score: 300 });
    checkTrophies({ type: "gameOver", score: 200 });
    expect(loadModalData()[4].groups[0].progressValue).toBe(500);
  });

  // ── getTrophyDef ──────────────────────────────────────────────────────────────

  it("getTrophyDef works for new combo_bronze ID", () => {
    const def = getTrophyDef("combo_bronze");
    expect(def).toBeDefined();
    expect(def!.name).toBe("連鎖初現");
    expect(def!.category).toBe("combos");
  });

  it("getTrophyDef works for score_total_diamond", () => {
    const def = getTrophyDef("score_total_diamond");
    expect(def).toBeDefined();
    expect(def!.name).toBe("二十萬傳說");
    expect(def!.category).toBe("cumulative");
  });

  it("getTrophyDef returns undefined for retired combo_5", () => {
    expect(getTrophyDef("combo_5")).toBeUndefined();
  });

  it("getTrophyDef returns undefined for retired combo_1_bronze", () => {
    expect(getTrophyDef("combo_1_bronze")).toBeUndefined();
  });

  // ── Deduplication ─────────────────────────────────────────────────────────────

  it("already-unlocked trophy is NOT returned again", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    const r = checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 5 });
    expect(r).not.toContain("combo_gold");
  });

  it("loadTrophyStatuses reflects unlocked state after checkTrophies", () => {
    checkTrophies({ type: "slide", grid: ONE_TILE_GRID, comboCount: 3 });
    const statuses = loadTrophyStatuses();
    const bronze = statuses.find((s) => s.def.id === "combo_bronze")!;
    expect(bronze.unlocked).toBe(true);
    expect(bronze.unlockedAt).toBeTypeOf("number");
    const gold = statuses.find((s) => s.def.id === "combo_gold")!;
    expect(gold.unlocked).toBe(false);
  });
});
