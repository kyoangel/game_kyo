import { describe, it, expect } from "vitest";
import { formatScorePopup, isNewRecord } from "../../src/scoring";

describe("formatScorePopup", () => {
  it("formats a positive score gain with a leading plus sign", () => {
    expect(formatScorePopup(10)).toBe("+10");
    expect(formatScorePopup(20)).toBe("+20");
  });
});

describe("isNewRecord", () => {
  it("returns true when the current score equals the best score and is positive", () => {
    expect(isNewRecord(100, 100)).toBe(true);
  });

  it("returns false when the score is below the best score", () => {
    expect(isNewRecord(50, 100)).toBe(false);
  });

  it("returns false when both score and best score are zero", () => {
    expect(isNewRecord(0, 0)).toBe(false);
  });
});
