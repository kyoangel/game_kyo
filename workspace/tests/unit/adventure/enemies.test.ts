import { describe, it, expect } from "vitest";
import { ENEMIES, getEnemy, type IntentKind } from "../../../src/adventure/enemies";

describe("ENEMIES roster (spec 5.2)", () => {
  it("has 9 enemies in run order: forest, ice, tower; normal, normal, boss", () => {
    expect(ENEMIES.map((e) => e.id)).toEqual([
      "slime", "stoneGolem", "treeKing",
      "snowSprite", "crystalGuard", "iceQueen",
      "spiralMage", "shadowBlock", "zeroLord",
    ]);
    expect(ENEMIES.map((e) => e.zone)).toEqual([
      "forest", "forest", "forest", "ice", "ice", "ice", "tower", "tower", "tower",
    ]);
    expect(ENEMIES.map((e) => e.boss)).toEqual([
      false, false, true, false, false, true, false, false, true,
    ]);
  });

  it("ids are unique", () => {
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(9);
  });

  it("normal enemies have 40-80 HP and bosses 150-250 HP (spec 3.2)", () => {
    ENEMIES.forEach((e) => {
      if (e.boss) {
        expect(e.maxHp).toBeGreaterThanOrEqual(150);
        expect(e.maxHp).toBeLessThanOrEqual(250);
      } else {
        expect(e.maxHp).toBeGreaterThanOrEqual(40);
        expect(e.maxHp).toBeLessThanOrEqual(80);
      }
    });
  });

  it("every enemy has a non-empty action cycle with positive integer countdowns", () => {
    ENEMIES.forEach((e) => {
      expect(e.cycle.length).toBeGreaterThan(0);
      e.cycle.forEach((slot) => {
        expect(Number.isInteger(slot.countdown)).toBe(true);
        expect(slot.countdown).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(slot.intent.amount)).toBe(true);
        expect(slot.intent.amount).toBeGreaterThanOrEqual(1);
      });
    });
  });

  it("every enemy has a shape name and a #rrggbb colour", () => {
    ENEMIES.forEach((e) => {
      expect(e.shape.length).toBeGreaterThan(0);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it("normal enemies follow their spec theme", () => {
    const kinds = (id: string): IntentKind[] => getEnemy(id)!.cycle.map((s) => s.intent.kind);
    expect(kinds("slime")).toEqual(["attack"]);
    expect(kinds("stoneGolem")).toEqual(["rockfall"]);
    expect(kinds("snowSprite")).toEqual(["freeze"]);
    expect(kinds("crystalGuard")).toEqual(["shield"]);
    expect(kinds("spiralMage")).toEqual(["scramble"]);
    // 暗影方陣 is the mixed enemy: at least 3 different intent kinds
    expect(new Set(kinds("shadowBlock")).size).toBeGreaterThanOrEqual(3);
  });

  it("bosses alternate as in the spec", () => {
    const kinds = (id: string): IntentKind[] => getEnemy(id)!.cycle.map((s) => s.intent.kind);
    expect(kinds("treeKing")).toEqual(["attack", "rockfall"]);
    expect(kinds("iceQueen")).toEqual(["freeze", "shield"]);
    expect(kinds("zeroLord")).toContain("zero");
  });

  it("only the zero lord has the 歸零 intent, and it zeroes 2 cells", () => {
    ENEMIES.forEach((e) => {
      const hasZero = e.cycle.some((s) => s.intent.kind === "zero");
      expect(hasZero).toBe(e.id === "zeroLord");
    });
    const zero = getEnemy("zeroLord")!.cycle.find((s) => s.intent.kind === "zero")!;
    expect(zero.intent.amount).toBe(2);
  });
});

describe("getEnemy", () => {
  it("looks an enemy up by id", () => {
    expect(getEnemy("slime")?.name).toBe("圓史萊姆");
  });

  it("returns undefined for an unknown id (corrupt save data)", () => {
    expect(getEnemy("nope")).toBeUndefined();
    expect(getEnemy("")).toBeUndefined();
  });
});
