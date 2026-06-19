import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkTrophies, getTrophyDef, loadModalData } from "../../src/trophies";

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("getTrophyDef", () => {
  it("returns def for known id", () => {
    const def = getTrophyDef("first_triple");
    expect(def).toBeDefined();
    expect(def!.id).toBe("first_triple");
  });
  it("returns undefined for unknown id", () => {
    expect(getTrophyDef("nonexistent")).toBeUndefined();
  });
});

describe("checkTrophies — gameStart", () => {
  it("unlocks play_1 on first game", () => {
    const result = checkTrophies({ type: "gameStart", playCount: 1 });
    expect(result).toContain("play_1");
  });
  it("unlocks play_10 at 10 games", () => {
    const result = checkTrophies({ type: "gameStart", playCount: 10 });
    expect(result).toContain("play_10");
  });
  it("does not re-unlock already-unlocked trophy", () => {
    checkTrophies({ type: "gameStart", playCount: 1 });
    const second = checkTrophies({ type: "gameStart", playCount: 1 });
    expect(second).not.toContain("play_1");
  });
  it("unlocks multiple tiers at once if threshold reached", () => {
    const result = checkTrophies({ type: "gameStart", playCount: 10 });
    expect(result).toContain("play_1");
    expect(result).toContain("play_10");
  });
});

describe("checkTrophies — slide", () => {
  const emptyGrid = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => null as number | null),
  );

  it("unlocks first_triple on 3-tile match", () => {
    const result = checkTrophies({
      type: "slide",
      postSlideGrid: emptyGrid,
      eliminatedGroups: [{ positions: [], length: 3 }],
    });
    expect(result).toContain("first_triple");
  });

  it("unlocks first_quad on 4-tile match", () => {
    const result = checkTrophies({
      type: "slide",
      postSlideGrid: emptyGrid,
      eliminatedGroups: [{ positions: [], length: 4 }],
    });
    expect(result).toContain("first_quad");
  });

  it("unlocks big_combo when 3+ groups in one swipe", () => {
    const result = checkTrophies({
      type: "slide",
      postSlideGrid: emptyGrid,
      eliminatedGroups: [
        { positions: [], length: 2 },
        { positions: [], length: 2 },
        { positions: [], length: 2 },
      ],
    });
    expect(result).toContain("big_combo");
  });

  it("does NOT unlock big_combo for only 2 groups", () => {
    const result = checkTrophies({
      type: "slide",
      postSlideGrid: emptyGrid,
      eliminatedGroups: [
        { positions: [], length: 2 },
        { positions: [], length: 2 },
      ],
    });
    expect(result).not.toContain("big_combo");
  });

  it("unlocks board_clear when postSlideGrid is all null", () => {
    const result = checkTrophies({
      type: "slide",
      postSlideGrid: emptyGrid,
      eliminatedGroups: [{ positions: [], length: 2 }],
    });
    expect(result).toContain("board_clear");
  });

  it("does NOT unlock board_clear when grid still has tiles", () => {
    const gridWithTile = emptyGrid.map((r, ri) =>
      r.map((c, ci) => (ri === 0 && ci === 0 ? 5 : c)),
    );
    const result = checkTrophies({
      type: "slide",
      postSlideGrid: gridWithTile,
      eliminatedGroups: [{ positions: [], length: 2 }],
    });
    expect(result).not.toContain("board_clear");
  });
});

describe("checkTrophies — gameOver", () => {
  it("unlocks score_100 at score >= 100", () => {
    const result = checkTrophies({ type: "gameOver", score: 100 });
    expect(result).toContain("score_100");
  });
  it("unlocks score_500 and score_100 at score >= 500", () => {
    const result = checkTrophies({ type: "gameOver", score: 500 });
    expect(result).toContain("score_100");
    expect(result).toContain("score_500");
  });
  it("unlocks score_1000 at score >= 1000", () => {
    const result = checkTrophies({ type: "gameOver", score: 1000 });
    expect(result).toContain("score_1000");
  });
  it("does not unlock score trophies below threshold", () => {
    const result = checkTrophies({ type: "gameOver", score: 50 });
    expect(result).not.toContain("score_100");
  });
});

describe("loadModalData", () => {
  it("returns two sections: 遊玩成就 and 特殊成就", () => {
    const sections = loadModalData();
    expect(sections).toHaveLength(2);
    expect(sections[0].categoryLabel).toBe("遊玩成就");
    expect(sections[1].categoryLabel).toBe("特殊成就");
  });

  it("play section has 1 tiered group with 4 tiers", () => {
    const sections = loadModalData();
    const playSection = sections[0];
    expect(playSection.groups).toHaveLength(1);
    expect(playSection.groups[0].type).toBe("tiered");
    expect(playSection.groups[0].tiers).toHaveLength(4);
  });

  it("special section has 7 single groups", () => {
    const sections = loadModalData();
    const specialSection = sections[1];
    expect(specialSection.groups).toHaveLength(7);
    specialSection.groups.forEach((g) => expect(g.type).toBe("single"));
  });
});
