import { describe, it, expect } from "vitest";
import {
  computePlayCountAward,
  computeEliminationAward,
} from "../../src/powerups";

describe("computePlayCountAward", () => {
  it("returns null for play counts not hitting any threshold (1, 5, 7)", () => {
    expect(computePlayCountAward(1)).toBeNull();
    expect(computePlayCountAward(5)).toBeNull();
    expect(computePlayCountAward(7)).toBeNull();
  });

  it("returns 'hammer' or 'shuffle' on every 2nd play (non-3rd)", () => {
    const award2 = computePlayCountAward(2);
    expect(["hammer", "shuffle"]).toContain(award2);
    const award4 = computePlayCountAward(4);
    expect(["hammer", "shuffle"]).toContain(award4);
    const award8 = computePlayCountAward(8);
    expect(["hammer", "shuffle"]).toContain(award8);
  });

  it("returns 'addOne' on every 3rd play (takes priority over 2nd)", () => {
    expect(computePlayCountAward(3)).toBe("addOne");
    expect(computePlayCountAward(6)).toBe("addOne"); // divisible by both 2 and 3 → addOne wins
    expect(computePlayCountAward(9)).toBe("addOne");
  });
});

describe("computeEliminationAward", () => {
  it("returns 0 when not crossing a 30-multiple", () => {
    expect(computeEliminationAward(0, 29)).toBe(0);
    expect(computeEliminationAward(30, 59)).toBe(0);
    expect(computeEliminationAward(10, 25)).toBe(0);
  });

  it("returns 1 when crossing one 30-multiple boundary", () => {
    expect(computeEliminationAward(0, 30)).toBe(1);
    expect(computeEliminationAward(29, 31)).toBe(1);
    expect(computeEliminationAward(28, 30)).toBe(1);
  });

  it("returns 2 when crossing two 30-multiple boundaries", () => {
    expect(computeEliminationAward(0, 60)).toBe(2);
    expect(computeEliminationAward(29, 61)).toBe(2);
  });
});
