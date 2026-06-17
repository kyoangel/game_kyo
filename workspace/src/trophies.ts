import { type GameGrid } from "./grid";

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (event: TrophyCheckEvent) => boolean;
}

export type TrophyCheckEvent =
  | { type: "slide"; grid: GameGrid; comboCount: number }
  | { type: "gameOver"; score: number };

export interface TrophyStatus {
  def: TrophyDef;
  unlocked: boolean;
  unlockedAt: number | null;
}

const TROPHY_KEY = "mathMerge10Trophies";

function countValue(grid: GameGrid, value: number): number {
  return grid.flat().filter((c) => c === value).length;
}

function countNonNull(grid: GameGrid): number {
  return grid.flat().filter((c) => c !== null).length;
}

const TROPHY_DEFS: TrophyDef[] = [
  {
    id: "zero_score",
    name: "空手而歸",
    icon: "🕊️",
    description: "完成一場遊戲，得分為零",
    check: (e) => e.type === "gameOver" && e.score === 0,
  },
  {
    id: "one_flood",
    name: "一的洪流",
    icon: "🌊",
    description: "版面上同時出現 5 個或以上的「1」",
    check: (e) => e.type === "slide" && countValue(e.grid, 1) >= 5,
  },
  {
    id: "nine_feast",
    name: "九的盛宴",
    icon: "🍱",
    description: "版面上同時出現 3 個或以上的「9」",
    check: (e) => e.type === "slide" && countValue(e.grid, 9) >= 3,
  },
  {
    id: "almost_full",
    name: "滿溢邊緣",
    icon: "💥",
    description: "版面上同時有 15 格或以上非空的格子",
    check: (e) => e.type === "slide" && countNonNull(e.grid) >= 15,
  },
  {
    id: "combo_2",
    name: "連鎖初學",
    icon: "⚡",
    description: "一次消除 2 對",
    check: (e) => e.type === "slide" && e.comboCount >= 2,
  },
  {
    id: "combo_3",
    name: "連鎖高手",
    icon: "⚡⚡",
    description: "一次消除 3 對",
    check: (e) => e.type === "slide" && e.comboCount >= 3,
  },
  {
    id: "combo_4",
    name: "連鎖達人",
    icon: "⚡⚡⚡",
    description: "一次消除 4 對",
    check: (e) => e.type === "slide" && e.comboCount >= 4,
  },
  {
    id: "combo_5",
    name: "連鎖大師",
    icon: "🌟",
    description: "一次消除 5 對或以上",
    check: (e) => e.type === "slide" && e.comboCount >= 5,
  },
];

function loadUnlocked(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function checkTrophies(event: TrophyCheckEvent): string[] {
  const unlocked = loadUnlocked();
  const newlyUnlocked: string[] = [];
  for (const def of TROPHY_DEFS) {
    if (unlocked[def.id] !== undefined) continue;
    if (def.check(event)) {
      unlocked[def.id] = Date.now();
      newlyUnlocked.push(def.id);
    }
  }
  if (newlyUnlocked.length > 0) {
    localStorage.setItem(TROPHY_KEY, JSON.stringify(unlocked));
  }
  return newlyUnlocked;
}

export function loadTrophyStatuses(): TrophyStatus[] {
  const unlocked = loadUnlocked();
  return TROPHY_DEFS.map((def) => ({
    def,
    unlocked: def.id in unlocked,
    unlockedAt: unlocked[def.id] ?? null,
  }));
}

export function getTrophyDef(id: string): TrophyDef | undefined {
  return TROPHY_DEFS.find((d) => d.id === id);
}
