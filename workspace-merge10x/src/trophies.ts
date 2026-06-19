import type { GameGrid, EliminatedGroup } from "./grid";

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "play" | "special";
}

const TROPHY_DEFS: TrophyDef[] = [
  { id: "play_1",       name: "初次嘗試", icon: "🌱", description: "遊玩 1 局",           category: "play" },
  { id: "play_10",      name: "初嚐滋味", icon: "🎮", description: "遊玩 10 局",          category: "play" },
  { id: "play_50",      name: "上癮了吧", icon: "🔥", description: "遊玩 50 局",          category: "play" },
  { id: "play_100",     name: "資深玩家", icon: "👑", description: "遊玩 100 局",         category: "play" },
  { id: "first_triple", name: "三合一",   icon: "⚡", description: "第一次 3-tile 消除",  category: "special" },
  { id: "first_quad",   name: "四合一",   icon: "💥", description: "第一次 4-tile 消除",  category: "special" },
  { id: "big_combo",    name: "連鎖爆發", icon: "🌀", description: "單次滑動消除 3 組以上", category: "special" },
  { id: "score_100",    name: "百分出擊", icon: "💯", description: "累積 100 分",         category: "special" },
  { id: "score_500",    name: "五百強",   icon: "🎯", description: "累積 500 分",         category: "special" },
  { id: "score_1000",   name: "破千",     icon: "🏆", description: "累積 1000 分",        category: "special" },
  { id: "board_clear",  name: "天地清明", icon: "✨", description: "消除所有格子",         category: "special" },
];

const TROPHY_KEY = "merge10xTrophies";
const PLAY_COUNT_KEY = "merge10xPlayCount";

function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(TROPHY_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveUnlocked(set: Set<string>): void {
  localStorage.setItem(TROPHY_KEY, JSON.stringify([...set]));
}

export function getTrophyDef(id: string): TrophyDef | undefined {
  return TROPHY_DEFS.find((d) => d.id === id);
}

export type TrophyEvent =
  | { type: "gameStart"; playCount: number }
  | { type: "slide"; postSlideGrid: GameGrid; eliminatedGroups: Pick<EliminatedGroup, "positions" | "length">[] }
  | { type: "gameOver"; score: number };

export function checkTrophies(event: TrophyEvent): string[] {
  const unlocked = loadUnlocked();
  const newlyUnlocked: string[] = [];

  function tryUnlock(id: string): void {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  }

  if (event.type === "gameStart") {
    const count = event.playCount;
    if (count >= 1)   tryUnlock("play_1");
    if (count >= 10)  tryUnlock("play_10");
    if (count >= 50)  tryUnlock("play_50");
    if (count >= 100) tryUnlock("play_100");
  }

  if (event.type === "slide") {
    const { eliminatedGroups, postSlideGrid } = event;
    if (eliminatedGroups.some((g) => g.length === 3)) tryUnlock("first_triple");
    if (eliminatedGroups.some((g) => g.length === 4)) tryUnlock("first_quad");
    if (eliminatedGroups.length >= 3) tryUnlock("big_combo");
    if (postSlideGrid.every((row) => row.every((c) => c === null))) tryUnlock("board_clear");
  }

  if (event.type === "gameOver") {
    const { score } = event;
    if (score >= 100)  tryUnlock("score_100");
    if (score >= 500)  tryUnlock("score_500");
    if (score >= 1000) tryUnlock("score_1000");
  }

  if (newlyUnlocked.length > 0) saveUnlocked(unlocked);
  return newlyUnlocked;
}

// Modal data types
export interface TrophyTierEntry { def: TrophyDef; unlocked: boolean; }
export interface TrophyModalGroup {
  type: "single" | "tiered";
  single?: { def: TrophyDef; unlocked: boolean };
  label?: string;
  tiers?: TrophyTierEntry[];
  progressValue?: number;
  progressCeiling?: number;
  progressDisplay?: string;
  thresholdDisplays?: string[];
}
export interface TrophyModalSection {
  categoryLabel: string;
  groups: TrophyModalGroup[];
}

const PLAY_THRESHOLDS = [1, 10, 50, 100];

export function loadModalData(): TrophyModalSection[] {
  const unlocked = loadUnlocked();
  const playCount = parseInt(localStorage.getItem(PLAY_COUNT_KEY) ?? "0", 10);

  const playDefs = TROPHY_DEFS.filter((d) => d.category === "play");
  const specialDefs = TROPHY_DEFS.filter((d) => d.category === "special");

  const tiers: TrophyTierEntry[] = playDefs.map((def) => ({
    def,
    unlocked: unlocked.has(def.id),
  }));

  const ceiling = PLAY_THRESHOLDS.find((t) => playCount < t) ?? PLAY_THRESHOLDS[PLAY_THRESHOLDS.length - 1];

  return [
    {
      categoryLabel: "遊玩成就",
      groups: [
        {
          type: "tiered",
          label: "遊玩場次",
          tiers,
          progressValue: playCount,
          progressCeiling: ceiling,
          progressDisplay: `${playCount} 局`,
          thresholdDisplays: PLAY_THRESHOLDS.map(String),
        },
      ],
    },
    {
      categoryLabel: "特殊成就",
      groups: specialDefs.map((def) => ({
        type: "single" as const,
        single: { def, unlocked: unlocked.has(def.id) },
      })),
    },
  ];
}
