import { type GameGrid } from "./grid";

// ── Public types ──────────────────────────────────────────────────────────────

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "numbers" | "combos" | "scores" | "play" | "cumulative" | "special";
}

export interface TrophyStatus {
  def: TrophyDef;
  unlocked: boolean;
  unlockedAt: number | null;
}

export type TrophyCheckEvent =
  | { type: "slide"; grid: GameGrid; comboCount: number }
  | { type: "gameOver"; score: number };

export interface ModalGroup {
  label: string;
  type: "tiered" | "single";
  tiers?: TrophyStatus[];
  single?: TrophyStatus;
  progressValue?: number;
  progressCeiling?: number;
  thresholds?: number[];
  thresholdDisplays?: string[];
  beyondDiamond?: boolean;
  progressDisplay?: string;
  beyondDisplay?: string;
  beyondSubDisplay?: string;
}

export interface ModalSection {
  categoryLabel: string;
  category: TrophyDef["category"];
  groups: ModalGroup[];
}

// ── Internal types ────────────────────────────────────────────────────────────

interface GameStats {
  playCount: number;
  maxCombo: number;
  maxNum1: number; maxNum2: number; maxNum3: number;
  maxNum4: number; maxNum5: number; maxNum6: number;
  maxNum7: number; maxNum8: number; maxNum9: number;
  score100Count: number;
  score300Count: number;
  score500Count: number;
  score1000Count: number;
  totalScore: number;
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
const STATS_KEY  = "mathMerge10Stats";

const EMPTY_STATS: GameStats = {
  playCount: 0, maxCombo: 0,
  maxNum1: 0, maxNum2: 0, maxNum3: 0, maxNum4: 0, maxNum5: 0,
  maxNum6: 0, maxNum7: 0, maxNum8: 0, maxNum9: 0,
  score100Count: 0, score300Count: 0, score500Count: 0, score1000Count: 0,
  totalScore: 0,
};

function loadUnlocked(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "{}") as Record<string, number>; }
  catch { return {}; }
}

function loadStats(): GameStats {
  try {
    return { ...EMPTY_STATS, ...(JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") as Partial<GameStats>) };
  } catch { return { ...EMPTY_STATS }; }
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
    ["bronze", "🥉", `${n}的初現`, 6],
    ["silver", "🥈", `${n}的聚集`, 10],
    ["gold",   "🥇", `${n}的洪流`, 14],
    ["diamond","💎", `${n}的霸主`, 16],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `num_${value}_${tier}`, name, icon,
    category: "numbers" as const,
    description: `版面上同時出現 ${threshold} 個或以上的「${value}」`,
    check: ({ event }) => event.type === "slide" && countValue(event.grid, value) >= threshold,
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
    ["gold",   "🥇", `${label}習慣`, thresholds[2]],
    ["diamond","💎", `${label}大師`, thresholds[3]],
  ];
  return tiers.map(([tier, icon, name, threshold]) => ({
    id: `score_${score}_${tier}`, name, icon,
    category: "scores" as const,
    description: `得分達到 ${score} 分 ${threshold} 次`,
    check: ({ stats }) => getCount(stats) >= threshold,
  }));
}

// ── Trophy definitions (67 total) ────────────────────────────────────────────

const TROPHY_DEFS: TrophyRule[] = [
  // 數字系列 (36) — thresholds 6/10/14/16
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(numTrophies),

  // 連鎖系列 (4) — maxCombo based, thresholds 2/3/5/8
  { id: "combo_bronze",  name: "連鎖初現", icon: "🥉", category: "combos" as const,
    description: "單次消除 2 對以上", check: ({ stats }) => stats.maxCombo >= 2 },
  { id: "combo_silver",  name: "連鎖進階", icon: "🥈", category: "combos" as const,
    description: "單次消除 3 對以上", check: ({ stats }) => stats.maxCombo >= 3 },
  { id: "combo_gold",    name: "連鎖高手", icon: "🥇", category: "combos" as const,
    description: "單次消除 5 對以上", check: ({ stats }) => stats.maxCombo >= 5 },
  { id: "combo_diamond", name: "連鎖大師", icon: "💎", category: "combos" as const,
    description: "單次消除 8 對以上", check: ({ stats }) => stats.maxCombo >= 8 },

  // 分數里程碑 (16) — unchanged
  ...scoreTrophies(100,  [1, 5, 20, 50], "百分", (s) => s.score100Count),
  ...scoreTrophies(300,  [1, 3, 10, 25], "三百", (s) => s.score300Count),
  ...scoreTrophies(500,  [1, 2, 5,  15], "五百", (s) => s.score500Count),
  ...scoreTrophies(1000, [1, 2, 5,  10], "千分", (s) => s.score1000Count),

  // 遊玩成就 (4) — unchanged
  { id: "play_bronze",  name: "新手冒險", icon: "🥉", category: "play" as const,
    description: "遊玩 10 局",  check: ({ stats }) => stats.playCount >= 10 },
  { id: "play_silver",  name: "進階玩家", icon: "🥈", category: "play" as const,
    description: "遊玩 50 局",  check: ({ stats }) => stats.playCount >= 50 },
  { id: "play_gold",    name: "資深玩家", icon: "🥇", category: "play" as const,
    description: "遊玩 100 局", check: ({ stats }) => stats.playCount >= 100 },
  { id: "play_diamond", name: "遊戲達人", icon: "💎", category: "play" as const,
    description: "遊玩 500 局", check: ({ stats }) => stats.playCount >= 500 },

  // 累積成就 (4) — NEW
  { id: "score_total_bronze",  name: "千分旅程",   icon: "🥉", category: "cumulative" as const,
    description: "累積總分達到 1,000 分",    check: ({ stats }) => stats.totalScore >= 1000 },
  { id: "score_total_silver",  name: "萬分修煉",   icon: "🥈", category: "cumulative" as const,
    description: "累積總分達到 10,000 分",   check: ({ stats }) => stats.totalScore >= 10000 },
  { id: "score_total_gold",    name: "五萬精通",   icon: "🥇", category: "cumulative" as const,
    description: "累積總分達到 50,000 分",   check: ({ stats }) => stats.totalScore >= 50000 },
  { id: "score_total_diamond", name: "二十萬傳說", icon: "💎", category: "cumulative" as const,
    description: "累積總分達到 200,000 分",  check: ({ stats }) => stats.totalScore >= 200000 },

  // 特殊成就 (3) — unchanged
  { id: "zero_score",  name: "空手而歸", icon: "🕊️", category: "special" as const,
    description: "完成一場遊戲，得分為零",
    check: ({ event }) => event.type === "gameOver" && event.score === 0 },
  { id: "board_clear", name: "天地清明", icon: "✨", category: "special" as const,
    description: "一局遊戲中將盤面完全清空",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) === 0  },
  { id: "almost_full", name: "滿溢邊緣", icon: "💥", category: "special" as const,
    description: "版面上同時有 16 格或以上非空的格子",
    check: ({ event }) => event.type === "slide" && countNonNull(event.grid) == 16 },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function checkTrophies(event: TrophyCheckEvent): string[] {
  const stats = loadStats();

  if (event.type === "slide") {
    stats.maxCombo = Math.max(stats.maxCombo, event.comboCount);
    stats.maxNum1  = Math.max(stats.maxNum1,  countValue(event.grid, 1));
    stats.maxNum2  = Math.max(stats.maxNum2,  countValue(event.grid, 2));
    stats.maxNum3  = Math.max(stats.maxNum3,  countValue(event.grid, 3));
    stats.maxNum4  = Math.max(stats.maxNum4,  countValue(event.grid, 4));
    stats.maxNum5  = Math.max(stats.maxNum5,  countValue(event.grid, 5));
    stats.maxNum6  = Math.max(stats.maxNum6,  countValue(event.grid, 6));
    stats.maxNum7  = Math.max(stats.maxNum7,  countValue(event.grid, 7));
    stats.maxNum8  = Math.max(stats.maxNum8,  countValue(event.grid, 8));
    stats.maxNum9  = Math.max(stats.maxNum9,  countValue(event.grid, 9));
  } else {
    stats.playCount++;
    stats.totalScore += event.score;
    if (event.score >= 100)  stats.score100Count++;
    if (event.score >= 300)  stats.score300Count++;
    if (event.score >= 500)  stats.score500Count++;
    if (event.score >= 1000) stats.score1000Count++;
  }

  saveStats(stats);

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

  if (newlyUnlocked.length > 0) localStorage.setItem(TROPHY_KEY, JSON.stringify(unlocked));
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

export function loadModalData(): ModalSection[] {
  const gs = loadStats();
  const unlocked = loadUnlocked();

  function makeStatus(id: string): TrophyStatus {
    const def = TROPHY_DEFS.find((d) => d.id === id)!;
    return { def, unlocked: id in unlocked, unlockedAt: unlocked[id] ?? null };
  }

  function firstLockedIdx(tierIds: string[]): number {
    return tierIds.findIndex((id) => !(id in unlocked));
  }

  function nextThreshold(tierIds: string[], rawThresholds: number[]): number {
    const idx = firstLockedIdx(tierIds);
    return idx === -1 ? rawThresholds[rawThresholds.length - 1] : rawThresholds[idx];
  }

  // ── 數字系列 ──
  const maxNums = [gs.maxNum1, gs.maxNum2, gs.maxNum3, gs.maxNum4, gs.maxNum5, gs.maxNum6, gs.maxNum7, gs.maxNum8, gs.maxNum9];
  const numRawThresholds = [6, 10, 14, 16];
  const numberGroups: ModalGroup[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => {
    const tierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `num_${v}_${t}`);
    const maxV = maxNums[v - 1];
    const allDone = tierIds.every((id) => id in unlocked);
    const next = nextThreshold(tierIds, numRawThresholds);
    return {
      label: `數字 ${v}`,
      type: "tiered",
      tiers: tierIds.map(makeStatus),
      progressValue: maxV,
      progressCeiling: 16,
      thresholds: numRawThresholds,
      thresholdDisplays: numRawThresholds.map((n) => `×${n}`),
      beyondDiamond: false,
      progressDisplay: allDone ? `最多 ${maxV} 個` : `最多 ${maxV} 個 / 目標 ${next}`,
    } as ModalGroup;
  });

  // ── 連鎖系列 ──
  const comboTierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `combo_${t}`);
  const comboThresholds = [2, 3, 5, 8];
  const allComboDone = comboTierIds.every((id) => id in unlocked);
  const nextCombo = nextThreshold(comboTierIds, comboThresholds);
  const comboGroup: ModalGroup = {
    label: "最高連鎖",
    type: "tiered",
    tiers: comboTierIds.map(makeStatus),
    progressValue: gs.maxCombo,
    progressCeiling: 8,
    thresholds: comboThresholds,
    thresholdDisplays: comboThresholds.map((n) => `×${n}`),
    beyondDiamond: false,
    progressDisplay: allComboDone ? `×${gs.maxCombo}` : `目前 ×${gs.maxCombo} / 目標 ×${nextCombo}`,
  };

  // ── 分數里程碑 ──
  const scoreMilestoneGroups: ModalGroup[] = (
    [
      { score: 100,  label: "單場 ≥100 分",  thresholds: [1, 5, 20, 50] as [number,number,number,number], count: gs.score100Count },
      { score: 300,  label: "單場 ≥300 分",  thresholds: [1, 3, 10, 25] as [number,number,number,number], count: gs.score300Count },
      { score: 500,  label: "單場 ≥500 分",  thresholds: [1, 2, 5,  15] as [number,number,number,number], count: gs.score500Count },
      { score: 1000, label: "單場 ≥1000 分", thresholds: [1, 2, 5,  10] as [number,number,number,number], count: gs.score1000Count },
    ]
  ).map(({ score, label, thresholds, count }) => {
    const tierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `score_${score}_${t}`);
    const allDone = tierIds.every((id) => id in unlocked);
    const next = nextThreshold(tierIds, [...thresholds]);
    return {
      label,
      type: "tiered",
      tiers: tierIds.map(makeStatus),
      progressValue: count,
      progressCeiling: thresholds[3],
      thresholds: [...thresholds],
      thresholdDisplays: [...thresholds].map((n) => `${n}次`),
      beyondDiamond: false,
      progressDisplay: allDone ? `${count} 次` : `${count} 次 / 目標 ${next}`,
    } as ModalGroup;
  });

  // ── 遊玩成就 ──
  const playTierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `play_${t}`);
  const playThresholds = [10, 50, 100, 500];
  const allPlayDone = playTierIds.every((id) => id in unlocked);
  const nextPlay = nextThreshold(playTierIds, playThresholds);
  const playCountGroup: ModalGroup = allPlayDone
    ? {
        label: "遊玩次數",
        type: "tiered",
        tiers: playTierIds.map(makeStatus),
        progressValue: gs.playCount,
        progressCeiling: 500,
        thresholds: playThresholds,
        thresholdDisplays: playThresholds.map((n) => `${n}局`),
        beyondDiamond: true,
        beyondDisplay: `${gs.playCount} 局 🔄`,
        beyondSubDisplay: `超越鑽石 +${gs.playCount - 500} 局`,
      }
    : {
        label: "遊玩次數",
        type: "tiered",
        tiers: playTierIds.map(makeStatus),
        progressValue: gs.playCount,
        progressCeiling: 500,
        thresholds: playThresholds,
        thresholdDisplays: playThresholds.map((n) => `${n}局`),
        beyondDiamond: false,
        progressDisplay: `${gs.playCount} 局 / 目標 ${nextPlay}`,
      };

  // ── 累積成就 ──
  const totalTierIds = ["bronze", "silver", "gold", "diamond"].map((t) => `score_total_${t}`);
  const totalThresholds = [1000, 10000, 50000, 200000];
  const allTotalDone = totalTierIds.every((id) => id in unlocked);
  const nextTotal = nextThreshold(totalTierIds, totalThresholds);
  const cumulativeGroup: ModalGroup = allTotalDone
    ? {
        label: "累積總分",
        type: "tiered",
        tiers: totalTierIds.map(makeStatus),
        progressValue: gs.totalScore,
        progressCeiling: 200000,
        thresholds: totalThresholds,
        thresholdDisplays: totalThresholds.map((n) => n.toLocaleString()),
        beyondDiamond: true,
        beyondDisplay: `${gs.totalScore.toLocaleString()} 分 🔄`,
        beyondSubDisplay: `超越鑽石 +${(gs.totalScore - 200000).toLocaleString()} 分`,
      }
    : {
        label: "累積總分",
        type: "tiered",
        tiers: totalTierIds.map(makeStatus),
        progressValue: gs.totalScore,
        progressCeiling: 200000,
        thresholds: totalThresholds,
        thresholdDisplays: totalThresholds.map((n) => n.toLocaleString()),
        beyondDiamond: false,
        progressDisplay: `${gs.totalScore.toLocaleString()} 分 / 目標 ${nextTotal.toLocaleString()}`,
      };

  return [
    { categoryLabel: "數字系列",  category: "numbers",    groups: numberGroups },
    { categoryLabel: "連鎖系列",  category: "combos",     groups: [comboGroup] },
    { categoryLabel: "分數里程碑", category: "scores",    groups: scoreMilestoneGroups },
    { categoryLabel: "遊玩成就",  category: "play",       groups: [playCountGroup] },
    { categoryLabel: "累積成就",  category: "cumulative", groups: [cumulativeGroup] },
    { categoryLabel: "特殊成就",  category: "special",    groups: [
      { label: "天地清明", type: "single", single: makeStatus("board_clear") },
      { label: "空手而歸", type: "single", single: makeStatus("zero_score") },
      { label: "滿溢邊緣", type: "single", single: makeStatus("almost_full") },
    ]},
  ];
}
