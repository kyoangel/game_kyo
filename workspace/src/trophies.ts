import { type GameGrid } from "./grid";

// ── Public types ──────────────────────────────────────────────────────────────

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "numbers" | "combos" | "scores" | "play" | "special";
}

export interface TrophyStatus {
  def: TrophyDef;
  unlocked: boolean;
  unlockedAt: number | null;
}

export type TrophyCheckEvent =
  | { type: "slide"; grid: GameGrid; comboCount: number }
  | { type: "gameOver"; score: number };

// ── Internal types ────────────────────────────────────────────────────────────

interface GameStats {
  playCount: number;
  combo1Count: number;
  combo2Count: number;
  combo3Count: number;
  combo4Count: number;
  score100Count: number;
  score300Count: number;
  score500Count: number;
  score1000Count: number;
}

interface CheckPayload {
  event: TrophyCheckEvent;
  stats: GameStats;
}

interface TrophyRule extends TrophyDef {
  check: (payload: CheckPayload) => boolean;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const TROPHY_KEY = "mathMerge10Trophies";
const STATS_KEY = "mathMerge10Stats";

const EMPTY_STATS: GameStats = {
  playCount: 0,
  combo1Count: 0,
  combo2Count: 0,
  combo3Count: 0,
  combo4Count: 0,
  score100Count: 0,
  score300Count: 0,
  score500Count: 0,
  score1000Count: 0,
};

function loadUnlocked(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function loadStats(): GameStats {
  try {
    return {
      ...EMPTY_STATS,
      ...(JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") as Partial<GameStats>),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function saveStats(stats: GameStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

function countValue(grid: GameGrid, value: number): number {
  return grid.flat().filter((c) => c === value).length;
}

function countNonNull(grid: GameGrid): number {
  return grid.flat().filter((c) => c !== null).length;
}

// ── Trophy definition generators ─────────────────────────────────────────────

const NUM_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

function numTrophies(value: number): TrophyRule[] {
  const n = NUM_NAMES[value - 1];
  const tiers: Array<[string, string, string, number]> = [
    ["bronze", "🥉", `${n}的初現`, 3],
    ["silver", "🥈", `${n}的聚集`, 4],
    ["gold", "🥇", `${n}的洪流`, 5],
    ["diamond", "💎", `${n}的霸主`, 6],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `num_${value}_${tier}`,
    name,
    icon,
    category: "numbers" as const,
    description: `版面上同時出現 ${threshold} 個或以上的「${value}」`,
    check: ({ event }) =>
      event.type === "slide" && countValue(event.grid, value) >= threshold,
  }));
}

function comboCountTrophies(
  n: number,
  thresholds: [number, number, number, number],
  names: [string, string, string, string],
  getCount: (stats: GameStats) => number,
): TrophyRule[] {
  const tiers: Array<[string, string, string, number]> = [
    ["bronze", "🥉", names[0], thresholds[0]],
    ["silver", "🥈", names[1], thresholds[1]],
    ["gold", "🥇", names[2], thresholds[2]],
    ["diamond", "💎", names[3], thresholds[3]],
  ];
  const desc = n === 1 ? "消除任意對數" : `達到 ${n} 連鎖`;
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `combo_${n}_${tier}`,
    name,
    icon,
    category: "combos" as const,
    description: `${desc} ${threshold} 次`,
    check: ({ stats }) => getCount(stats) >= threshold,
  }));
}

function scoreTrophies(
  score: number,
  thresholds: [number, number, number, number],
  label: string,
  getCount: (stats: GameStats) => number,
): TrophyRule[] {
  const tiers: Array<[string, string, string, number]> = [
    ["bronze", "🥉", `${label}首達`, thresholds[0]],
    ["silver", "🥈", `${label}常客`, thresholds[1]],
    ["gold", "🥇", `${label}習慣`, thresholds[2]],
    ["diamond", "💎", `${label}大師`, thresholds[3]],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `score_${score}_${tier}`,
    name,
    icon,
    category: "scores" as const,
    description: `得分達到 ${score} 分 ${threshold} 次`,
    check: ({ stats }) => getCount(stats) >= threshold,
  }));
}

// ── Trophy definitions ────────────────────────────────────────────────────────

const TROPHY_DEFS: TrophyRule[] = [
  // 數字系列 (36)
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(numTrophies),

  // 連鎖系列 (17)
  ...comboCountTrophies(1, [10, 50, 200, 500], ["消除初手", "消除熟手", "消除達人", "消除傳說"], (s) => s.combo1Count),
  ...comboCountTrophies(2, [3, 15, 50, 100],   ["連鎖初學", "連鎖進階", "連鎖精通", "連鎖宗師"], (s) => s.combo2Count),
  ...comboCountTrophies(3, [1, 5, 20, 50],     ["連鎖高手", "連鎖大將", "連鎖傳奇", "連鎖神話"], (s) => s.combo3Count),
  ...comboCountTrophies(4, [1, 3, 8, 20],      ["連鎖達人", "連鎖精英", "連鎖王者", "連鎖霸主"], (s) => s.combo4Count),
  {
    id: "combo_5", name: "連鎖大師", icon: "🌟", category: "combos" as const,
    description: "一次消除 5 對或以上",
    check: ({ event }) => event.type === "slide" && event.comboCount >= 5,
  },

  // 分數里程碑 (16)
  ...scoreTrophies(100,  [1, 5, 20, 50], "百分", (s) => s.score100Count),
  ...scoreTrophies(300,  [1, 3, 10, 25], "三百", (s) => s.score300Count),
  ...scoreTrophies(500,  [1, 2, 5, 15],  "五百", (s) => s.score500Count),
  ...scoreTrophies(1000, [1, 2, 5, 10],  "千分", (s) => s.score1000Count),

  // 遊玩成就 (5)
  { id: "play_bronze",  name: "新手冒險", icon: "🥉", category: "play" as const, description: "遊玩 10 局",  check: ({ stats }) => stats.playCount >= 10 },
  { id: "play_silver",  name: "進階玩家", icon: "🥈", category: "play" as const, description: "遊玩 50 局",  check: ({ stats }) => stats.playCount >= 50 },
  { id: "play_gold",    name: "資深玩家", icon: "🥇", category: "play" as const, description: "遊玩 100 局", check: ({ stats }) => stats.playCount >= 100 },
  { id: "play_diamond", name: "遊戲達人", icon: "💎", category: "play" as const, description: "遊玩 500 局", check: ({ stats }) => stats.playCount >= 500 },
  {
    id: "board_clear", name: "天地清明", icon: "✨", category: "play" as const,
    description: "一局遊戲中將盤面完全清空",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) === 0,
  },

  // 特殊成就 (2)
  {
    id: "zero_score", name: "空手而歸", icon: "🕊️", category: "special" as const,
    description: "完成一場遊戲，得分為零",
    check: ({ event }) => event.type === "gameOver" && event.score === 0,
  },
  {
    id: "almost_full", name: "滿溢邊緣", icon: "💥", category: "special" as const,
    description: "版面上同時有 15 格或以上非空的格子",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) >= 15,
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function checkTrophies(event: TrophyCheckEvent): string[] {
  const stats = loadStats();
  let statsChanged = false;

  if (event.type === "slide") {
    if (event.comboCount >= 1) { stats.combo1Count++; statsChanged = true; }
    if (event.comboCount >= 2) { stats.combo2Count++; statsChanged = true; }
    if (event.comboCount >= 3) { stats.combo3Count++; statsChanged = true; }
    if (event.comboCount >= 4) { stats.combo4Count++; statsChanged = true; }
  } else {
    stats.playCount++;
    if (event.score >= 100)  stats.score100Count++;
    if (event.score >= 300)  stats.score300Count++;
    if (event.score >= 500)  stats.score500Count++;
    if (event.score >= 1000) stats.score1000Count++;
    statsChanged = true;
  }

  if (statsChanged) saveStats(stats);

  const unlocked = loadUnlocked();
  const newlyUnlocked: string[] = [];
  const payload: CheckPayload = { event, stats };

  for (const def of TROPHY_DEFS) {
    if (unlocked[def.id] !== undefined) continue;
    if (def.check(payload)) {
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
