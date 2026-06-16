import { describe, it, expect } from "vitest";
import {
  computePlayCountAward,
  computeBestScoreAward,
} from "../../src/powerups";

describe("computePlayCountAward", () => {
  it("returns null on plays not divisible by 5", () => {
    expect(computePlayCountAward(1)).toBeNull();
    expect(computePlayCountAward(3)).toBeNull();
    expect(computePlayCountAward(7)).toBeNull();
  });

  it("returns 'hammer' or 'shuffle' on every 5th play (non-10th)", () => {
    const award = computePlayCountAward(5);
    expect(["hammer", "shuffle"]).toContain(award);
    const award15 = computePlayCountAward(15);
    expect(["hammer", "shuffle"]).toContain(award15);
  });

  it("returns 'addOne' on every 10th play", () => {
    expect(computePlayCountAward(10)).toBe("addOne");
    expect(computePlayCountAward(20)).toBe("addOne");
    expect(computePlayCountAward(30)).toBe("addOne");
  });
});

describe("computeBestScoreAward", () => {
  it("returns 0 bombs when neither 50 threshold nor new 100-multiple crossed", () => {
    expect(computeBestScoreAward(40, 45)).toBe(0);
    expect(computeBestScoreAward(55, 70)).toBe(0);
  });

  it("returns 1 bomb when crossing 50 for the first time", () => {
    expect(computeBestScoreAward(40, 55)).toBe(1);
    expect(computeBestScoreAward(0, 50)).toBe(1);
  });

  it("returns 1 bomb when crossing a new 100-multiple (above 50)", () => {
    expect(computeBestScoreAward(60, 100)).toBe(1);
    expect(computeBestScoreAward(150, 210)).toBe(1);
  });

  it("returns 2 bombs when crossing both 50 threshold and a 100-multiple in one score jump", () => {
    expect(computeBestScoreAward(0, 100)).toBe(2);
  });

  it("returns multiple bombs when multiple 100-multiples crossed", () => {
    expect(computeBestScoreAward(60, 250)).toBe(2); // 100 and 200
  });
});
