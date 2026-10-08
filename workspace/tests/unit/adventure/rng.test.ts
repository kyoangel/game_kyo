import { describe, it, expect } from "vitest";
import { mulberry32, seededRngFromSearch } from "../../../src/adventure/rng";

describe("mulberry32", () => {
  it("is deterministic per seed and stays inside [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    expect(seqA).toEqual(Array.from({ length: 50 }, () => b()));
    seqA.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    });
  });

  it("different seeds give different sequences", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("seededRngFromSearch (?seed=, dev only)", () => {
  it("returns a generator for a numeric seed in dev", () => {
    const rng = seededRngFromSearch("?seed=7", true)!;
    expect(rng()).toBe(mulberry32(7)());
  });

  it("is ignored in production builds", () => {
    expect(seededRngFromSearch("?seed=7", false)).toBeNull();
  });

  it("ignores a missing, empty or non-numeric seed", () => {
    expect(seededRngFromSearch("", true)).toBeNull();
    expect(seededRngFromSearch("?seed=", true)).toBeNull();
    expect(seededRngFromSearch("?seed=abc", true)).toBeNull();
    expect(seededRngFromSearch("?seed=1.5", true)).toBeNull();
    expect(seededRngFromSearch("?other=3", true)).toBeNull();
  });
});
