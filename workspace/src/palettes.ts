export interface TileColors {
  bg: string;
  text: string;
}

export type Palette = Record<number, TileColors>;

export type PaletteId = "pairHint" | "gradient" | "pastel";

export const PALETTES: Record<PaletteId, Palette> = {
  pairHint: {
    1: { bg: "#bfdbfe", text: "#1e3a8a" },   // light blue   (pairs with 9)
    2: { bg: "#bbf7d0", text: "#14532d" },   // light green  (pairs with 8)
    3: { bg: "#fef3c7", text: "#78350f" },   // light amber  (pairs with 7)
    4: { bg: "#fce7f3", text: "#831843" },   // light rose   (pairs with 6)
    5: { bg: "#a855f7", text: "#ffffff" },   // purple       (self-pair)
    6: { bg: "#be185d", text: "#ffffff" },   // dark rose    (pairs with 4)
    7: { bg: "#d97706", text: "#ffffff" },   // dark amber   (pairs with 3)
    8: { bg: "#15803d", text: "#ffffff" },   // dark green   (pairs with 2)
    9: { bg: "#1d4ed8", text: "#ffffff" },   // dark blue    (pairs with 1)
  },
  gradient: {
    1: { bg: "#60a5fa", text: "#1e3a8a" },
    2: { bg: "#38bdf8", text: "#0c4a6e" },
    3: { bg: "#34d399", text: "#022c22" },
    4: { bg: "#a3e635", text: "#1a2e05" },
    5: { bg: "#facc15", text: "#422006" },
    6: { bg: "#fb923c", text: "#431407" },
    7: { bg: "#f97316", text: "#431407" },
    8: { bg: "#ef4444", text: "#ffffff" },
    9: { bg: "#dc2626", text: "#ffffff" },
  },
  pastel: {
    1: { bg: "#e0f2fe", text: "#0c4a6e" },
    2: { bg: "#fef9c3", text: "#713f12" },
    3: { bg: "#fce7f3", text: "#831843" },
    4: { bg: "#dcfce7", text: "#14532d" },
    5: { bg: "#ede9fe", text: "#4c1d95" },
    6: { bg: "#ffedd5", text: "#7c2d12" },
    7: { bg: "#e0e7ff", text: "#3730a3" },
    8: { bg: "#fee2e2", text: "#7f1d1d" },
    9: { bg: "#f1f5f9", text: "#334155" },
  },
};

export const PALETTE_ORDER: PaletteId[] = ["pairHint", "gradient", "pastel"];

export function nextPalette(current: PaletteId): PaletteId {
  const index = PALETTE_ORDER.indexOf(current);
  return PALETTE_ORDER[(index + 1) % PALETTE_ORDER.length];
}

export function isPaletteId(value: string | null): value is PaletteId {
  return value !== null && (PALETTE_ORDER as string[]).includes(value);
}
