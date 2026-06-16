import { describe, it, expect } from "vitest";
import { PALETTES, PALETTE_ORDER, nextPalette, isPaletteId } from "../../src/palettes";

describe("PALETTES", () => {
  it("defines a bg and text color for every tile value 1-9 in each palette", () => {
    PALETTE_ORDER.forEach((paletteId) => {
      for (let value = 1; value <= 9; value++) {
        const colors = PALETTES[paletteId][value];
        expect(colors).toBeDefined();
        expect(colors.bg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(colors.text).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });
});

describe("PALETTE_ORDER", () => {
  it("lists exactly the three designed palettes", () => {
    expect(PALETTE_ORDER).toEqual(["pairHint", "gradient", "pastel"]);
  });
});

describe("nextPalette", () => {
  it("cycles pairHint -> gradient -> pastel -> pairHint", () => {
    expect(nextPalette("pairHint")).toBe("gradient");
    expect(nextPalette("gradient")).toBe("pastel");
    expect(nextPalette("pastel")).toBe("pairHint");
  });
});

describe("isPaletteId", () => {
  it("returns true for known palette ids", () => {
    expect(isPaletteId("pairHint")).toBe(true);
    expect(isPaletteId("gradient")).toBe(true);
    expect(isPaletteId("pastel")).toBe(true);
  });

  it("returns false for unknown values or null", () => {
    expect(isPaletteId("unknown")).toBe(false);
    expect(isPaletteId(null)).toBe(false);
  });
});
