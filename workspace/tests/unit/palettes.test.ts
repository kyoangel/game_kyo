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

describe("pairHint palette — pairs summing to 10 share a hue family", () => {
  it("1 (light blue) and 9 (dark blue) use the specified colors", () => {
    expect(PALETTES.pairHint[1].bg).toBe("#bfdbfe");
    expect(PALETTES.pairHint[9].bg).toBe("#1d4ed8");
  });

  it("2 (light green) and 8 (dark green) use the specified colors", () => {
    expect(PALETTES.pairHint[2].bg).toBe("#bbf7d0");
    expect(PALETTES.pairHint[8].bg).toBe("#15803d");
  });

  it("3 (light orange) and 7 (dark orange) use the specified colors", () => {
    expect(PALETTES.pairHint[3].bg).toBe("#fed7aa");
    expect(PALETTES.pairHint[7].bg).toBe("#c2410c");
  });

  it("4 (light purple) and 6 (dark purple) use the specified colors", () => {
    expect(PALETTES.pairHint[4].bg).toBe("#e9d5ff");
    expect(PALETTES.pairHint[6].bg).toBe("#7c3aed");
  });

  it("5 uses mid-gold (self-pairs with itself to 10)", () => {
    expect(PALETTES.pairHint[5].bg).toBe("#fef08a");
  });
});
