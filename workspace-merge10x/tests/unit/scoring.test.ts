import { describe, it, expect } from "vitest";
import { groupBaseScore, comboBonus, formatScorePopup, isNewRecord } from "../../src/scoring";

describe("groupBaseScore", () => {
  it("returns 10 for length 2", () => expect(groupBaseScore(2)).toBe(10));
  it("returns 25 for length 3", () => expect(groupBaseScore(3)).toBe(25));
  it("returns 50 for length 4", () => expect(groupBaseScore(4)).toBe(50));
});

describe("comboBonus", () => {
  it("returns 0 for 0 groups", () => expect(comboBonus(0)).toBe(0));
  it("returns 0 for 1 group", () => expect(comboBonus(1)).toBe(0));
  it("returns 10 for 2 groups", () => expect(comboBonus(2)).toBe(10));
  it("returns 20 for 3 groups", () => expect(comboBonus(3)).toBe(20));
  it("returns 30 for 4 groups", () => expect(comboBonus(4)).toBe(30));
});

describe("formatScorePopup", () => {
  it("formats positive score", () => expect(formatScorePopup(25)).toBe("+25"));
  it("formats zero", () => expect(formatScorePopup(0)).toBe("+0"));
});

describe("isNewRecord", () => {
  it("true when score exceeds best", () => expect(isNewRecord(100, 50)).toBe(true));
  it("false when score equals best", () => expect(isNewRecord(50, 50)).toBe(false));
  it("false when score less than best", () => expect(isNewRecord(30, 50)).toBe(false));
});
