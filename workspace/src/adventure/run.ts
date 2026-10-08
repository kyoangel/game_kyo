/**
 * One adventure run (spec 6): 9 battles in a fixed line, HP carried between
 * them, a three-pick reward after every win. Pure: every function takes a
 * `RunState` and returns a new one, with randomness injected as an `Rng`.
 * `RunState` is plain JSON (see save.ts). Relic effects reach battle.ts only
 * through `mergeRelicHooks(run.relics)`.
 *
 * Phases: relicPick (choose the opening relic) -> battle -> reward (not after
 * the last boss) -> battle -> ... -> victory | defeat.
 */
import type { Direction, Rng } from "../grid";
import type { CellPosition } from "../gridDiff";
import {
  HERO_START_HP,
  NO_UPGRADES,
  SPELL_IDS,
  applyTurn,
  castSpell,
  createBattle,
  type BattleEvent,
  type BattleState,
  type SpellFailure,
  type SpellId,
  type SpellUpgrades,
} from "./battle";
import { ENEMIES, getEnemy } from "./enemies";
import { pickDistinct } from "./intents";
import { getRelic, mergeRelicHooks } from "./relics";
import type { AdventureTrophyEvent } from "./unlocks";

/** Enemy ids in fight order: forest, ice cave, demon tower; normal, normal, boss. */
export const BATTLE_ORDER: readonly string[] = ENEMIES.map((enemy) => enemy.id);
export const TOTAL_BATTLES = BATTLE_ORDER.length;
/** Heal offered by the "回 3 血" reward. */
export const HEAL_OPTION_AMOUNT = 3;
export const OPENING_RELIC_CHOICES = 3;
export const BOSS_RELIC_CHOICES = 3;

export type RunPhase = "relicPick" | "battle" | "reward" | "victory" | "defeat";

export type RewardOption =
  | { kind: "relic"; relicId: string }
  | { kind: "upgrade"; spell: SpellId }
  | { kind: "heal"; amount: number };

/** Per-battle counters the trophies need (reset when a battle starts). */
export interface BattleStats {
  stonesBroken: number;
  /** Most pairs cleared by a single slide. */
  maxChain: number;
}

export interface RunState {
  phase: RunPhase;
  /** Index into BATTLE_ORDER of the current (or just finished) battle. */
  battleIndex: number;
  heroHp: number;
  heroMaxHp: number;
  relics: string[];
  upgrades: SpellUpgrades;
  /** Relic ids this run may offer: starter pool plus trophy unlocks at run start. */
  pool: string[];
  /** The current battle; null only in the relicPick phase. Kept after the win/loss for display. */
  battle: BattleState | null;
  stats: BattleStats;
  /** Choices while phase is relicPick or reward; empty otherwise. */
  offers: RewardOption[];
}

export interface RunStep {
  run: RunState;
  events: BattleEvent[];
  trophyEvents: AdventureTrophyEvent[];
  /** False = nothing happened (invalid swipe, illegal spell, wrong phase); `run` is the same object. */
  applied: boolean;
  reason?: SpellFailure | "wrongPhase" | "badChoice";
}

function noop(run: RunState, reason?: RunStep["reason"]): RunStep {
  return { run, events: [], trophyEvents: [], applied: false, reason };
}

const NO_STATS: BattleStats = { stonesBroken: 0, maxChain: 0 };

/** A new run: full HP, no relics, choosing 1 of 3 opening relics from `pool`. */
export function createRun(rng: Rng, pool: readonly string[]): RunState {
  const known = pool.filter((id) => getRelic(id));
  const offers = pickDistinct(known, OPENING_RELIC_CHOICES, rng).map(
    (relicId): RewardOption => ({ relicId, kind: "relic" }),
  );
  return {
    phase: "relicPick",
    battleIndex: 0,
    heroHp: HERO_START_HP,
    heroMaxHp: HERO_START_HP,
    relics: [],
    upgrades: { ...NO_UPGRADES },
    pool: [...known],
    battle: null,
    stats: { ...NO_STATS },
    offers,
  };
}

// ── rewards (spec 6) ────────────────────────────────────────────────────────

/**
 * Offers after a win. Normal fight: one random unowned relic, one random
 * not-yet-upgraded spell, and "回 3 血" (missing kinds are skipped, the heal
 * is always there). Boss: up to three different unowned relics; if none are
 * left it falls back to the normal offers. rng order: relics, then the spell.
 */
export function rollOffers(run: RunState, boss: boolean, rng: Rng): RewardOption[] {
  const owned = new Set(run.relics);
  const relicIds = run.pool.filter((id) => !owned.has(id));
  if (boss && relicIds.length > 0) {
    return pickDistinct(relicIds, BOSS_RELIC_CHOICES, rng).map((relicId): RewardOption => ({ kind: "relic", relicId }));
  }
  const offers: RewardOption[] = [];
  pickDistinct(relicIds, 1, rng).forEach((relicId) => offers.push({ kind: "relic", relicId }));
  pickDistinct(SPELL_IDS.filter((spell) => !run.upgrades[spell]), 1, rng).forEach((spell) =>
    offers.push({ kind: "upgrade", spell }),
  );
  offers.push({ kind: "heal", amount: HEAL_OPTION_AMOUNT });
  return offers;
}

function applyOffer(run: RunState, option: RewardOption): RunState {
  switch (option.kind) {
    case "relic":
      return { ...run, relics: [...run.relics, option.relicId] };
    case "upgrade":
      return { ...run, upgrades: { ...run.upgrades, [option.spell]: true } };
    case "heal":
      return { ...run, heroHp: Math.min(run.heroMaxHp, run.heroHp + option.amount) };
  }
}

function beginBattle(run: RunState, rng: Rng): { run: RunState; events: BattleEvent[] } {
  const created = createBattle(
    {
      enemyId: BATTLE_ORDER[run.battleIndex],
      heroHp: run.heroHp,
      heroMaxHp: run.heroMaxHp,
      upgrades: run.upgrades,
    },
    rng,
    mergeRelicHooks(run.relics),
  );
  return {
    run: { ...run, phase: "battle", battle: created.state, stats: { ...NO_STATS }, offers: [] },
    events: created.events,
  };
}

/**
 * Pick offer `index` in the relicPick or reward phase, then start the next
 * battle (battle 0 for relicPick).
 */
export function chooseOffer(run: RunState, index: number, rng: Rng): RunStep {
  if (run.phase !== "relicPick" && run.phase !== "reward") return noop(run, "wrongPhase");
  const option = run.offers[index];
  if (!option) return noop(run, "badChoice");
  if (run.phase === "reward" && run.battleIndex >= TOTAL_BATTLES - 1) return noop(run, "wrongPhase"); // no battle after the last
  const chosen = applyOffer(run, option);
  const next: RunState = run.phase === "reward" ? { ...chosen, battleIndex: run.battleIndex + 1 } : chosen;
  const started = beginBattle(next, rng);
  return { ...settleBattle(started.run, started.run.battle, started.events, rng), applied: true };
}

// ── playing a battle ────────────────────────────────────────────────────────

function largestSlideChain(events: BattleEvent[]): number {
  return events.reduce(
    (best, e) => (e.type === "pairCleared" && e.source === "slide" ? Math.max(best, e.count) : best),
    0,
  );
}

/**
 * Fold a battle state back into the run: copy HP, update the trophy counters,
 * and when the battle is over move the run to reward / victory / defeat
 * (a boss win first heals half the max HP, spec 6; the last boss ends the run).
 * rng is only used to roll the reward offers.
 */
function settleBattle(
  run: RunState,
  battle: BattleState | null,
  events: BattleEvent[],
  rng: Rng,
): Omit<RunStep, "applied"> {
  if (!battle) return { run, events, trophyEvents: [] };
  const stats: BattleStats = {
    stonesBroken: run.stats.stonesBroken + events.filter((e) => e.type === "stoneBroken").length,
    maxChain: Math.max(run.stats.maxChain, largestSlideChain(events)),
  };
  const next: RunState = { ...run, battle, stats, heroHp: battle.heroHp };
  if (battle.status === "ongoing") return { run: next, events, trophyEvents: [] };
  if (battle.status === "defeat") return { run: { ...next, phase: "defeat", offers: [] }, events, trophyEvents: [] };

  const enemy = getEnemy(battle.enemyId)!;
  const trophyEvents: AdventureTrophyEvent[] = [
    {
      type: "battleWon",
      enemyId: enemy.id,
      overloads: battle.overloads,
      maxChain: stats.maxChain,
      stonesBroken: stats.stonesBroken,
    },
  ];
  if (run.battleIndex === TOTAL_BATTLES - 1) {
    trophyEvents.push({ type: "runWon" });
    return { run: { ...next, phase: "victory", offers: [] }, events, trophyEvents };
  }
  const healed = enemy.boss
    ? { ...next, heroHp: Math.min(next.heroMaxHp, next.heroHp + Math.floor(next.heroMaxHp / 2)) }
    : next;
  return { run: { ...healed, phase: "reward", offers: rollOffers(healed, enemy.boss, rng) }, events, trophyEvents };
}

/** One turn (a swipe). An invalid swipe changes nothing (`applied: false`). */
export function runTurn(run: RunState, direction: Direction, rng: Rng): RunStep {
  if (run.phase !== "battle" || !run.battle) return noop(run, "wrongPhase");
  const result = applyTurn(run.battle, direction, rng, mergeRelicHooks(run.relics));
  if (result.state === run.battle) return noop(run);
  return { ...settleBattle(run, result.state, result.events, rng), applied: true };
}

/** Cast a spell (not a turn). Failures come back as `applied: false` with the reason. */
export function runCast(run: RunState, spell: SpellId, target: CellPosition | null, rng: Rng): RunStep {
  if (run.phase !== "battle" || !run.battle) return noop(run, "wrongPhase");
  const result = castSpell(run.battle, spell, target, rng, mergeRelicHooks(run.relics));
  if (!result.applied) return noop(run, result.reason);
  return { ...settleBattle(run, result.state, result.events, rng), applied: true };
}
