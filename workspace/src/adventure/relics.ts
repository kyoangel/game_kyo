/**
 * The 12 adventure relics (spec 7) and the merge of owned relics into the one
 * `BattleHooks` object battle.ts consumes. Pure data and pure functions.
 *
 * Six relics are in the opening pool (`starter: true`); the other six are
 * unlocked one-to-one by adventure trophies (see unlocks.ts).
 */
import { COMPLEMENT_BIAS, type SpawnStrategy } from "../grid";
import {
  BASE_CHAIN_MULTIPLIER,
  DEFAULT_HOOKS,
  type BattleHooks,
  type BattleHooksInput,
  type BattleState,
  type HookEffect,
  type OverloadResponse,
  type SpellId,
} from "./battle";

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** True = in the opening pool; false = unlocked by an adventure trophy. */
  starter: boolean;
  hooks: BattleHooksInput;
}

export const RELICS: readonly RelicDef[] = [
  // ── opening pool (spec 7) ──
  { id: "manaCrystal", name: "魔力水晶", icon: "💎", starter: true,
    description: "每場戰鬥開始時魔力 +2",
    hooks: { onBattleStart: () => ({ mana: 2 }) } },
  { id: "chainRing", name: "連鎖之戒", icon: "💍", starter: true,
    description: "連鎖倍率由 ×1.5 變為 ×2",
    hooks: { chainMultiplier: () => 2 } },
  { id: "lifeStaff", name: "生命之杖", icon: "🪄", starter: true,
    description: "每場戰鬥勝利後回 2 血",
    hooks: { onBattleEnd: (_state, result) => (result === "victory" ? { heroHp: 2 } : undefined) } },
  { id: "surgeHeart", name: "暴走之心", icon: "🔥", starter: true,
    description: "魔力暴走時不扣血，改為對敵人造成 20 傷害",
    hooks: { onOverload: () => ({ cancelHpLoss: true, enemyDamage: 20 }) } },
  { id: "complementCharm", name: "補數護符", icon: "🧿", starter: true,
    description: "預防層在任何空格數下都有 30% 機率生效",
    hooks: { spawnStrategy: () => ({ emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 }) } },
  { id: "masonGloves", name: "石匠手套", icon: "🧤", starter: true,
    description: "每碎一塊石塊，對敵人造成 5 傷害",
    hooks: { onStoneBroken: (_state, cells) => ({ enemyDamage: 5 * cells.length }) } },

  // ── unlocked by adventure trophies ──
  { id: "forestHeart", name: "森林之心", icon: "🌳", starter: false,
    description: "每場戰鬥第一次消除時回 1 血",
    hooks: {
      onPairCleared: (state) =>
        state.relicData?.forestHeartUsed ? undefined : { heroHp: 1, relicData: { forestHeartUsed: 1 } },
    } },
  { id: "iceShard", name: "冰晶棱鏡", icon: "🔷", starter: false,
    description: "每消除一對，額外對敵人造成 2 傷害",
    hooks: { onPairCleared: (_state, info) => ({ enemyDamage: 2 * info.count }) } },
  { id: "voidEye", name: "虛無之眼", icon: "👁️", starter: false,
    description: "連鎖倍率變為 ×2.5（與連鎖之戒不疊加，取較高者）",
    hooks: { chainMultiplier: () => 2.5 } },
  { id: "surgeConduit", name: "暴走導管", icon: "🔌", starter: false,
    description: "魔力暴走時魔力 +3",
    hooks: { onOverload: () => ({ mana: 3 }) } },
  { id: "inlayHammer", name: "鑲嵌鎚", icon: "🔨", starter: false,
    description: "碎石與增幅的魔力消耗 -1",
    hooks: {
      spellCost: (_state, spell, baseCost) => (spell === "hammer" || spell === "addOne" ? baseCost - 1 : baseCost),
    } },
  { id: "magmaCore", name: "熔岩核心", icon: "🌋", starter: false,
    description: "每碎一塊石塊，魔力 +1",
    hooks: { onStoneBroken: (_state, cells) => ({ mana: cells.length }) } },
];

export const STARTER_RELIC_IDS: readonly string[] = RELICS.filter((r) => r.starter).map((r) => r.id);
export const UNLOCKABLE_RELIC_IDS: readonly string[] = RELICS.filter((r) => !r.starter).map((r) => r.id);

/** Look a relic up by id; undefined for unknown ids so save loading can reject corrupt data. */
export function getRelic(id: string): RelicDef | undefined {
  return RELICS.find((relic) => relic.id === id);
}

// ── merging owned relics into one BattleHooks ───────────────────────────────

function sumEffects(effects: Array<HookEffect | OverloadResponse | void>): OverloadResponse | undefined {
  let mana = 0;
  let heroHp = 0;
  let enemyDamage = 0;
  let cancelHpLoss = false;
  let relicData: Record<string, number> | undefined;
  let any = false;
  effects.forEach((effect) => {
    if (!effect) return;
    any = true;
    mana += effect.mana ?? 0;
    heroHp += effect.heroHp ?? 0;
    enemyDamage += effect.enemyDamage ?? 0;
    cancelHpLoss = cancelHpLoss || Boolean((effect as OverloadResponse).cancelHpLoss);
    if (effect.relicData) relicData = { ...relicData, ...effect.relicData };
  });
  if (!any) return undefined;
  const merged: OverloadResponse = {};
  if (mana) merged.mana = mana;
  if (heroHp) merged.heroHp = heroHp;
  if (enemyDamage) merged.enemyDamage = enemyDamage;
  if (cancelHpLoss) merged.cancelHpLoss = true;
  if (relicData) merged.relicData = relicData;
  return merged;
}

/**
 * Merge the hooks of the owned relics (unknown ids are skipped).
 * Rules: chain multiplier = highest of the base 1.5 and every relic's; spawn
 * strategy = field-wise highest of the default bias and every relic's; spell
 * cost = base cost plus the sum of every relic's delta (never below 0); event
 * hooks = sum of every relic's effect (`cancelHpLoss` is true if any says so).
 */
export function mergeRelicHooks(relicIds: readonly string[]): BattleHooks {
  const hooks = relicIds.flatMap((id) => {
    const relic = getRelic(id);
    return relic ? [relic.hooks] : [];
  });
  if (hooks.length === 0) return DEFAULT_HOOKS;

  const chainHooks = hooks.flatMap((h) => (h.chainMultiplier ? [h.chainMultiplier] : []));
  const spawnHooks = hooks.flatMap((h) => (h.spawnStrategy ? [h.spawnStrategy] : []));
  const costHooks = hooks.flatMap((h) => (h.spellCost ? [h.spellCost] : []));
  const startHooks = hooks.flatMap((h) => (h.onBattleStart ? [h.onBattleStart] : []));
  const pairHooks = hooks.flatMap((h) => (h.onPairCleared ? [h.onPairCleared] : []));
  const stoneHooks = hooks.flatMap((h) => (h.onStoneBroken ? [h.onStoneBroken] : []));
  const overloadHooks = hooks.flatMap((h) => (h.onOverload ? [h.onOverload] : []));
  const endHooks = hooks.flatMap((h) => (h.onBattleEnd ? [h.onBattleEnd] : []));

  return {
    chainMultiplier: (state: BattleState) =>
      Math.max(BASE_CHAIN_MULTIPLIER, ...chainHooks.map((hook) => hook(state))),
    spawnStrategy: (state: BattleState): SpawnStrategy => {
      const all = [COMPLEMENT_BIAS, ...spawnHooks.map((hook) => hook(state))];
      return {
        emptyThreshold: Math.max(...all.map((s) => s.emptyThreshold)),
        probability: Math.max(...all.map((s) => s.probability)),
        baseProbability: Math.max(...all.map((s) => s.baseProbability ?? 0)),
      };
    },
    spellCost: (state: BattleState, spell: SpellId, baseCost: number) =>
      Math.max(0, baseCost + costHooks.reduce((sum, hook) => sum + (hook(state, spell, baseCost) - baseCost), 0)),
    onBattleStart: (state) => sumEffects(startHooks.map((hook) => hook(state))),
    onPairCleared: (state, info) => sumEffects(pairHooks.map((hook) => hook(state, info))),
    onStoneBroken: (state, cells, cause) => sumEffects(stoneHooks.map((hook) => hook(state, cells, cause))),
    onOverload: (state) => sumEffects(overloadHooks.map((hook) => hook(state))),
    onBattleEnd: (state, result) => sumEffects(endHooks.map((hook) => hook(state, result))),
  };
}
