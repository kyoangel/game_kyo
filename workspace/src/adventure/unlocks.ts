/**
 * Adventure trophies and the relic unlocks they grant (spec 8). Kept apart
 * from `trophies.ts` (the endless-mode career trophies and their 67-entry
 * contract); the storage key is its own too. Each trophy unlocks exactly one
 * of the six non-starter relics.
 */
import { STARTER_RELIC_IDS } from "./relics";
import type { KeyValueStore } from "./storage";

export const ADVENTURE_TROPHY_KEY = "mathMerge10AdventureTrophies";

export interface AdventureTrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** The relic this trophy adds to the opening pool. */
  relicId: string;
}

/** What the run layer reports; `maxChain` = most pairs cleared by one slide this battle. */
export type AdventureTrophyEvent =
  | { type: "battleWon"; enemyId: string; overloads: number; maxChain: number; stonesBroken: number }
  | { type: "runWon" };

interface TrophyRule extends AdventureTrophyDef {
  check: (event: AdventureTrophyEvent) => boolean;
}

const RULES: readonly TrophyRule[] = [
  { id: "adv_treeKing", name: "森林征服者", icon: "🌳", relicId: "forestHeart",
    description: "擊敗三角樹王",
    check: (e) => e.type === "battleWon" && e.enemyId === "treeKing" },
  { id: "adv_iceQueen", name: "冰窟征服者", icon: "❄️", relicId: "iceShard",
    description: "擊敗六角冰后",
    check: (e) => e.type === "battleWon" && e.enemyId === "iceQueen" },
  { id: "adv_clear", name: "歸零者", icon: "👑", relicId: "voidEye",
    description: "首次通關（擊敗零之魔王）",
    check: (e) => e.type === "runWon" },
  { id: "adv_overload3", name: "暴走大師", icon: "🔥", relicId: "surgeConduit",
    description: "單場戰鬥觸發 3 次魔力暴走並獲勝",
    check: (e) => e.type === "battleWon" && e.overloads >= 3 },
  { id: "adv_chain3", name: "連鎖法師", icon: "⚡", relicId: "inlayHammer",
    description: "單次滑動消除 3 對以上並贏得該場戰鬥",
    check: (e) => e.type === "battleWon" && e.maxChain >= 3 },
  { id: "adv_stones6", name: "碎石工", icon: "🪨", relicId: "magmaCore",
    description: "單場戰鬥碎掉 6 塊石塊並獲勝",
    check: (e) => e.type === "battleWon" && e.stonesBroken >= 6 },
];

export const ADVENTURE_TROPHIES: readonly AdventureTrophyDef[] = RULES.map(
  ({ check: _check, ...def }) => def,
);

export function getAdventureTrophy(id: string): AdventureTrophyDef | undefined {
  return ADVENTURE_TROPHIES.find((t) => t.id === id);
}

/** trophy id -> unlock timestamp. Corrupt storage reads as "nothing unlocked". */
export function loadAdventureTrophies(store: KeyValueStore): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(store.getItem(ADVENTURE_TROPHY_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    Object.entries(parsed).forEach(([id, at]) => {
      if (getAdventureTrophy(id) && typeof at === "number") result[id] = at;
    });
    return result;
  } catch {
    return {};
  }
}

/** Record an event; returns the ids of the trophies it unlocked for the first time. */
export function checkAdventureTrophies(
  event: AdventureTrophyEvent,
  store: KeyValueStore,
  now: number = Date.now(),
): string[] {
  const unlocked = loadAdventureTrophies(store);
  const fresh = RULES.filter((rule) => !(rule.id in unlocked) && rule.check(event)).map((rule) => rule.id);
  if (fresh.length === 0) return [];
  fresh.forEach((id) => {
    unlocked[id] = now;
  });
  try {
    store.setItem(ADVENTURE_TROPHY_KEY, JSON.stringify(unlocked));
  } catch {
    /* storage full or unavailable: the unlock just will not persist */
  }
  return fresh;
}

/** The relic pool for a new run: the 6 opening relics plus one per unlocked trophy. */
export function unlockedRelicIds(store: KeyValueStore): string[] {
  const unlocked = loadAdventureTrophies(store);
  const earned = ADVENTURE_TROPHIES.filter((t) => t.id in unlocked).map((t) => t.relicId);
  return [...STARTER_RELIC_IDS, ...earned];
}
