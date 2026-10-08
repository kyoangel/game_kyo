/**
 * Saving and loading a run (spec 6.1). The whole `RunState` is stored as JSON
 * under `mathMerge10AdventureRun` with a version number. Anything that does not
 * validate (bad JSON, wrong version, impossible values) is thrown away and
 * reported as "no save"; loading never throws. A finished run (victory or
 * defeat) is not worth resuming, so saving one deletes the save instead.
 */
import { STONE } from "../grid";
import { SPELL_IDS, type BattleState, type SpellId, type SpellUpgrades } from "./battle";
import { getEnemy } from "./enemies";
import { FREEZE_TURNS } from "./intents";
import { BATTLE_ORDER, HEAL_OPTION_AMOUNT, TOTAL_BATTLES, type RewardOption, type RunPhase, type RunState } from "./run";
import { getRelic } from "./relics";
import type { KeyValueStore } from "./storage";

export const RUN_SAVE_KEY = "mathMerge10AdventureRun";
export const RUN_SAVE_VERSION = 1;
const MAX_HP = 999;
const GRID_SIZE = 4;

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function parseUpgrades(value: unknown): SpellUpgrades | null {
  if (!isObj(value)) return null;
  const result = {} as SpellUpgrades;
  for (const spell of SPELL_IDS) {
    const flag = value[spell];
    if (typeof flag !== "boolean") return null;
    result[spell] = flag;
  }
  return result;
}

function parseGrid(value: unknown): BattleState["grid"] | null {
  if (!Array.isArray(value) || value.length !== GRID_SIZE) return null;
  const grid: BattleState["grid"] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== GRID_SIZE) return null;
    const out: Array<number | null> = [];
    for (const cell of row) {
      if (cell === null || cell === STONE || isInt(cell, 0, 9)) out.push(cell as number | null);
      else return null;
    }
    grid.push(out);
  }
  return grid;
}

function parseRelicData(value: unknown): Record<string, number> | null {
  if (!isObj(value)) return null;
  const keys = Object.keys(value);
  if (keys.length > 16) return null;
  const result: Record<string, number> = {};
  for (const key of keys) {
    const n = value[key];
    if (!isInt(n, -999999, 999999)) return null;
    result[key] = n;
  }
  return result;
}

function parseBattle(value: unknown): BattleState | null {
  if (!isObj(value)) return null;
  const enemy = typeof value.enemyId === "string" ? getEnemy(value.enemyId) : undefined;
  const grid = parseGrid(value.grid);
  const upgrades = parseUpgrades(value.upgrades);
  const relicData = parseRelicData(value.relicData);
  if (!enemy || !grid || !upgrades || !relicData) return null;
  if (!Array.isArray(value.freezes)) return null;

  const freezes: BattleState["freezes"] = [];
  const seen = new Set<string>();
  for (const entry of value.freezes) {
    if (!isObj(entry) || !isInt(entry.row, 0, GRID_SIZE - 1) || !isInt(entry.col, 0, GRID_SIZE - 1)) return null;
    if (!isInt(entry.turns, 1, FREEZE_TURNS)) return null;
    const cell = grid[entry.row][entry.col];
    const key = `${entry.row},${entry.col}`;
    if (cell === null || cell === STONE || seen.has(key)) return null; // a freeze needs a tile and is unique
    seen.add(key);
    freezes.push({ row: entry.row, col: entry.col, turns: entry.turns });
  }

  const { heroHp, heroMaxHp, mana, enemyHp, enemyMaxHp, enemyShield, intentIndex, countdown, turn, overloads, status } =
    value;
  if (
    !isInt(heroMaxHp, 1, MAX_HP) ||
    !isInt(heroHp, 0, heroMaxHp) ||
    !isInt(mana, 0, 9999) ||
    !isInt(enemyMaxHp, 1, 9999) ||
    enemyMaxHp !== enemy.maxHp ||
    !isInt(enemyHp, 0, enemyMaxHp) ||
    !isInt(enemyShield, 0, 99999) ||
    !isInt(intentIndex, 0, enemy.cycle.length - 1) ||
    !isInt(countdown, 1, enemy.cycle[intentIndex].countdown) ||
    !isInt(turn, 0, 999999) ||
    !isInt(overloads, 0, 999999) ||
    (status !== "ongoing" && status !== "victory" && status !== "defeat")
  ) {
    return null;
  }
  // status and hp must agree (the engine zeroes enemyHp on a win and heroHp on a loss)
  if (status === "ongoing" && (enemyHp === 0 || heroHp === 0)) return null;
  if (status === "victory" && enemyHp !== 0) return null;
  if (status === "defeat" && heroHp !== 0) return null;
  return {
    grid, freezes, heroHp, heroMaxHp, mana, enemyId: enemy.id, enemyHp, enemyMaxHp, enemyShield,
    intentIndex, countdown, upgrades, turn, overloads, relicData, status,
  };
}

function parseOffers(value: unknown): RewardOption[] | null {
  if (!Array.isArray(value) || value.length > 3) return null;
  const offers: RewardOption[] = [];
  for (const entry of value) {
    if (!isObj(entry)) return null;
    if (entry.kind === "relic" && typeof entry.relicId === "string" && getRelic(entry.relicId)) {
      offers.push({ kind: "relic", relicId: entry.relicId });
    } else if (entry.kind === "upgrade" && SPELL_IDS.includes(entry.spell as SpellId)) {
      offers.push({ kind: "upgrade", spell: entry.spell as SpellId });
    } else if (entry.kind === "heal" && entry.amount === HEAL_OPTION_AMOUNT) {
      offers.push({ kind: "heal", amount: entry.amount });
    } else {
      return null;
    }
  }
  return offers;
}

/** Offers must be ones the run could really have rolled (rollOffers): fresh relics from the pool, un-upgraded spells. */
function offersMatchRun(offers: RewardOption[], relics: readonly string[], pool: readonly string[], upgrades: SpellUpgrades): boolean {
  const seen = new Set<string>();
  for (const offer of offers) {
    const key = offer.kind === "relic" ? `r:${offer.relicId}` : offer.kind === "upgrade" ? `u:${offer.spell}` : "h";
    if (seen.has(key)) return false;
    seen.add(key);
    if (offer.kind === "relic" && (relics.includes(offer.relicId) || !pool.includes(offer.relicId))) return false;
    if (offer.kind === "upgrade" && upgrades[offer.spell]) return false;
  }
  return true;
}

const PHASES: readonly RunPhase[] = ["relicPick", "battle", "reward", "victory", "defeat"];

/** Validate untrusted data into a RunState, or null. Pure; never throws. */
export function validateRun(value: unknown): RunState | null {
  if (!isObj(value)) return null;
  const phase = PHASES.find((p) => p === value.phase);
  const upgrades = parseUpgrades(value.upgrades);
  const offers = parseOffers(value.offers);
  if (!phase || !upgrades || !offers) return null;
  if (!isInt(value.battleIndex, 0, TOTAL_BATTLES - 1)) return null;
  if (!isInt(value.heroMaxHp, 1, MAX_HP) || !isInt(value.heroHp, 0, value.heroMaxHp)) return null;

  const stats = value.stats;
  if (!isObj(stats) || !isInt(stats.stonesBroken, 0, 999999) || !isInt(stats.maxChain, 0, 16)) return null;

  const relics = value.relics;
  const pool = value.pool;
  if (!Array.isArray(relics) || !Array.isArray(pool)) return null;
  if (!relics.every((id) => typeof id === "string" && getRelic(id)) || new Set(relics).size !== relics.length) return null;
  if (!pool.every((id) => typeof id === "string" && getRelic(id)) || new Set(pool).size !== pool.length) return null;
  if (relics.length > 12 || pool.length > 12) return null;

  let battle: BattleState | null = null;
  if (value.battle !== null) {
    battle = parseBattle(value.battle);
    if (!battle) return null;
  }
  const picking = phase === "relicPick" || phase === "reward";
  if (picking !== (offers.length > 0)) return null; // choices exist exactly while a choice is pending
  if (!offersMatchRun(offers, relics as string[], pool as string[], upgrades)) return null;
  if (phase === "relicPick") {
    if (offers.some((offer) => offer.kind !== "relic")) return null;
    if (battle !== null || value.battleIndex !== 0 || relics.length !== 0) return null;
  } else {
    if (!battle) return null;
    if (battle.enemyId !== BATTLE_ORDER[value.battleIndex]) return null;
    const expected = phase === "battle" ? "ongoing" : phase === "defeat" ? "defeat" : "victory";
    if (battle.status !== expected) return null;
    if (battle.heroMaxHp !== value.heroMaxHp) return null;
    if (SPELL_IDS.some((spell) => battle.upgrades[spell] !== upgrades[spell])) return null;
    if (phase === "battle" && battle.heroHp !== value.heroHp) return null;
  }
  if (phase === "reward" && value.battleIndex === TOTAL_BATTLES - 1) return null; // the last boss ends the run
  if (phase === "victory" && value.battleIndex !== TOTAL_BATTLES - 1) return null;

  return {
    phase,
    battleIndex: value.battleIndex,
    heroHp: value.heroHp,
    heroMaxHp: value.heroMaxHp,
    relics: [...relics] as string[],
    upgrades,
    pool: [...pool] as string[],
    battle,
    stats: { stonesBroken: stats.stonesBroken, maxChain: stats.maxChain },
    offers,
  };
}

export function serializeRun(run: RunState): string {
  return JSON.stringify({ version: RUN_SAVE_VERSION, run });
}

/** Parse a stored string; null for null, bad JSON, a wrong version or an invalid run. */
export function parseRun(raw: string | null): RunState | null {
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isObj(data) || data.version !== RUN_SAVE_VERSION) return null;
    return validateRun(data.run);
  } catch {
    return null;
  }
}

export function clearRun(store: KeyValueStore): void {
  try {
    store.removeItem(RUN_SAVE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Save after a turn. A finished run deletes the save. Storage errors are swallowed (the run just is not saved). */
export function saveRun(store: KeyValueStore, run: RunState): void {
  if (run.phase === "victory" || run.phase === "defeat") {
    clearRun(store);
    return;
  }
  try {
    store.setItem(RUN_SAVE_KEY, serializeRun(run));
  } catch {
    /* storage full or blocked */
  }
}

/** The saved run, or null. A save that fails validation is deleted so it cannot trip the next launch. */
export function loadRun(store: KeyValueStore): RunState | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(RUN_SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const run = parseRun(raw);
  if (!run || run.phase === "victory" || run.phase === "defeat") {
    clearRun(store); // invalid, or a finished run that is not worth resuming
    return null;
  }
  return run;
}
