/**
 * Adventure-mode battle rules (spec 3-5). Pure: no DOM, no Canvas, no module
 * state. Every function takes a `BattleState`, returns a new one plus the
 * `BattleEvent`s the view layer plays back, and gets randomness as an injected
 * `Rng`. `BattleState` is plain JSON-serialisable data (the enemy is referenced
 * by id) so the run layer can save and load it.
 *
 * Relics plug in through `BattleHooks` (all optional, default no-op); nothing in
 * this file knows about individual relics.
 */
import {
  COMPLEMENT_BIAS,
  STONE,
  breakAdjacentStones,
  slide,
  spawnRandomTile,
  type Direction,
  type EliminatedPair,
  type GameGrid,
  type Rng,
  type SpawnStrategy,
} from "../grid";
import { changedCells, type CellPosition } from "../gridDiff";
import type { PowerupId } from "../powerups";
import { getEnemy, type EnemyDef, type Intent } from "./enemies";
import {
  freezeMask,
  pruneFreezes,
  resolveIntent,
  tickFreezes,
  type FreezeEntry,
  type IntentEffect,
} from "./intents";

// ── constants (spec 3.2 / 4.3) ──────────────────────────────────────────────

export const GRID_SIZE = 4;
export const HERO_START_HP = 10;
export const PAIR_DAMAGE = 10;
export const PAIR_MANA = 1;
/** Chain multiplier (>= 2 pairs in one slide) before relics. */
export const BASE_CHAIN_MULTIPLIER = 1.5;
export const OVERLOAD_HP_LOSS = 2;

// ── spells (spec 4.2; upgrades: spec 6, "初版 4 個法術各 1 級強化") ───────────

/** Spell ids are the powerup ids, so the pure effects in powerups.ts are shared. */
export type SpellId = PowerupId;
export const SPELL_IDS: readonly SpellId[] = ["hammer", "addOne", "bomb", "shuffle"];

export interface SpellDef {
  name: string;
  cost: number;
  /** Cost once the spell's single upgrade has been taken. */
  upgradedCost: number;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  hammer: { name: "碎石", cost: 2, upgradedCost: 1 },
  addOne: { name: "增幅", cost: 2, upgradedCost: 1 },
  bomb: { name: "爆裂", cost: 4, upgradedCost: 3 },
  shuffle: { name: "洗牌", cost: 3, upgradedCost: 2 },
};

export type SpellUpgrades = Record<SpellId, boolean>;
export const NO_UPGRADES: SpellUpgrades = { hammer: false, addOne: false, bomb: false, shuffle: false };

// ── state ───────────────────────────────────────────────────────────────────

export type BattleStatus = "ongoing" | "victory" | "defeat";

export interface BattleState {
  grid: GameGrid;
  freezes: FreezeEntry[];
  heroHp: number;
  heroMaxHp: number;
  mana: number;
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyShield: number;
  /** Index into the enemy's action cycle of the intent currently telegraphed. */
  intentIndex: number;
  /** Turns until the telegraphed intent fires (fires when it reaches 0). */
  countdown: number;
  upgrades: SpellUpgrades;
  /** Number of resolved turns (valid slides and overloads on an invalid swipe). */
  turn: number;
  /** Overloads so far this battle (adventure trophy: 3 in one battle and win). */
  overloads: number;
  status: BattleStatus;
}

export interface BattleSetup {
  enemyId: string;
  heroHp: number;
  heroMaxHp: number;
  upgrades?: SpellUpgrades;
  size?: number;
}

// ── events ──────────────────────────────────────────────────────────────────

export type DamageSource = "pair" | "relic";
export type HeroHpCause = "attack" | "overload" | "relic";
export type StoneBreakCause = "adjacent" | "spell";
export type ThawCause = "expired" | "cleared";

export type BattleEvent =
  /** A valid slide. The view feeds `prevGrid`/`direction`/`eliminatedPairs` to BoardRenderer. */
  | { type: "slid"; direction: Direction; prevGrid: GameGrid; grid: GameGrid; eliminatedPairs: EliminatedPair[] }
  | { type: "pairCleared"; count: number; chain: boolean; damagePerPair: number; source: "slide" | "addOne" }
  | { type: "damageDealt"; amount: number; absorbed: number; hpDamage: number; source: DamageSource }
  | { type: "manaChanged"; delta: number; mana: number }
  | { type: "heroHpChanged"; delta: number; hp: number; cause: HeroHpCause }
  /** `cell` is the stone's position on the board after the turn's slide. */
  | { type: "stoneBroken"; cell: CellPosition; cause: StoneBreakCause }
  | { type: "thawed"; cells: CellPosition[]; cause: ThawCause }
  | { type: "intentFired"; intent: Intent; effect: IntentEffect }
  | { type: "tileSpawned"; cell: CellPosition; value: number }
  | { type: "spellCast"; spell: SpellId; cost: number; target: CellPosition | null }
  | { type: "overload"; hpLost: number; cleared: CellPosition[] }
  | { type: "battleEnded"; result: "victory" | "defeat" };

export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
}

// ── hooks (spec 7) ──────────────────────────────────────────────────────────

/** What a hook may change. Applied by battle.ts; damage is absorbed by shield like any other. */
export interface HookEffect {
  mana?: number;
  /** Signed: positive heals (capped at max HP), negative hurts. */
  heroHp?: number;
  enemyDamage?: number;
}

export interface OverloadResponse extends HookEffect {
  /** True = the hero does not lose the usual 2 HP (暴走之心). */
  cancelHpLoss?: boolean;
}

export interface PairInfo {
  count: number;
  chain: boolean;
  damagePerPair: number;
}

export interface BattleHooks {
  /** Multiplier for chains (>= 2 pairs in one slide). Default 1.5. */
  chainMultiplier(state: BattleState): number;
  /** Spawn strategy for the new tile each turn. Default COMPLEMENT_BIAS. */
  spawnStrategy(state: BattleState): SpawnStrategy;
  /** Final mana cost of a spell (base cost already reflects the upgrade). Default: unchanged. */
  spellCost(state: BattleState, spell: SpellId, baseCost: number): number;
  onBattleStart(state: BattleState): HookEffect | void;
  /** After the damage/mana of a pair group is applied. A 9 hit by 增幅 counts as 1 pair, chain false. */
  onPairCleared(state: BattleState, info: PairInfo): HookEffect | void;
  /** `cells` were just broken (pair adjacency, or a spell that removed stones). */
  onStoneBroken(state: BattleState, cells: CellPosition[], cause: StoneBreakCause): HookEffect | void;
  onOverload(state: BattleState): OverloadResponse | void;
  /** Fires once when the battle ends; effects are applied only on victory (e.g. heal). */
  onBattleEnd(state: BattleState, result: "victory" | "defeat"): HookEffect | void;
}

export const DEFAULT_HOOKS: BattleHooks = {
  chainMultiplier: () => BASE_CHAIN_MULTIPLIER,
  spawnStrategy: () => COMPLEMENT_BIAS,
  spellCost: (_state, _spell, baseCost) => baseCost,
  onBattleStart: () => {},
  onPairCleared: () => {},
  onStoneBroken: () => {},
  onOverload: () => {},
  onBattleEnd: () => {},
};

export type BattleHooksInput = Partial<BattleHooks>;

function resolveHooks(input: BattleHooksInput): BattleHooks {
  return { ...DEFAULT_HOOKS, ...input };
}

// ── draft helpers (internal; mutate only the local draft, never the caller's state) ──

interface Draft {
  state: BattleState;
  events: BattleEvent[];
  hooks: BattleHooks;
}

function makeDraft(state: BattleState, hooks: BattleHooksInput): Draft {
  return { state, events: [], hooks: resolveHooks(hooks) };
}

function done(d: Draft): TurnResult {
  return { state: d.state, events: d.events };
}

function patch(d: Draft, changes: Partial<BattleState>): void {
  d.state = { ...d.state, ...changes };
}

function enemyOf(state: BattleState): EnemyDef {
  const enemy = getEnemy(state.enemyId);
  if (!enemy) throw new Error(`Unknown enemy id: ${state.enemyId}`);
  return enemy;
}

/** The intent the enemy is currently telegraphing (for the UI). */
export function currentIntent(state: BattleState): Intent {
  return enemyOf(state).cycle[state.intentIndex].intent;
}

function dealDamage(d: Draft, amount: number, source: DamageSource): void {
  if (amount <= 0) return;
  const absorbed = Math.min(d.state.enemyShield, amount);
  const hpDamage = amount - absorbed;
  patch(d, {
    enemyShield: d.state.enemyShield - absorbed,
    enemyHp: Math.max(0, d.state.enemyHp - hpDamage),
  });
  d.events.push({ type: "damageDealt", amount, absorbed, hpDamage, source });
}

function changeMana(d: Draft, delta: number): void {
  if (delta === 0) return;
  const mana = Math.max(0, d.state.mana + delta);
  patch(d, { mana });
  d.events.push({ type: "manaChanged", delta, mana });
}

function changeHeroHp(d: Draft, delta: number, cause: HeroHpCause): void {
  const hp = Math.min(d.state.heroMaxHp, Math.max(0, d.state.heroHp + delta));
  const actual = hp - d.state.heroHp;
  if (actual === 0) return;
  patch(d, { heroHp: hp });
  d.events.push({ type: "heroHpChanged", delta: actual, hp, cause });
}

function applyHookEffect(d: Draft, effect: HookEffect | void): void {
  if (!effect) return;
  if (effect.mana) changeMana(d, effect.mana);
  if (effect.heroHp) changeHeroHp(d, effect.heroHp, "relic");
  if (effect.enemyDamage) dealDamage(d, effect.enemyDamage, "relic");
}

/**
 * Win/lose check (spec 3.1 step 7). Enemy first: if both would hit 0 the hero
 * wins. Returns true when the battle is over (and fires onBattleEnd once).
 */
function settle(d: Draft): boolean {
  if (d.state.status !== "ongoing") return true;
  const result = d.state.enemyHp <= 0 ? "victory" : d.state.heroHp <= 0 ? "defeat" : null;
  if (result === null) return false;
  patch(d, { status: result });
  d.events.push({ type: "battleEnded", result });
  const effect = d.hooks.onBattleEnd(d.state, result);
  if (result === "victory") applyHookEffect(d, effect);
  return true;
}

function clearCells(grid: GameGrid, cells: readonly CellPosition[]): GameGrid {
  const next = grid.map((row) => [...row]);
  cells.forEach(({ row, col }) => {
    next[row][col] = null;
  });
  return next;
}

/** Drop freezes whose tile is gone (eliminated by a pair, cleared by a spell or overload). */
function dropDeadFreezes(d: Draft): void {
  const { freezes, removed } = pruneFreezes(d.state.grid, d.state.freezes);
  if (removed.length === 0) return;
  patch(d, { freezes });
  d.events.push({ type: "thawed", cells: removed, cause: "cleared" });
}

function resolvePairs(d: Draft, count: number, source: "slide" | "addOne"): void {
  const chain = source === "slide" && count >= 2;
  const damagePerPair = chain
    ? Math.floor(PAIR_DAMAGE * d.hooks.chainMultiplier(d.state))
    : PAIR_DAMAGE;
  d.events.push({ type: "pairCleared", count, chain, damagePerPair, source });
  changeMana(d, count * PAIR_MANA);
  dealDamage(d, count * damagePerPair, "pair");
  applyHookEffect(d, d.hooks.onPairCleared(d.state, { count, chain, damagePerPair }));
}

function reportBrokenStones(d: Draft, cells: CellPosition[], cause: StoneBreakCause): void {
  if (cells.length === 0) return;
  cells.forEach((cell) => d.events.push({ type: "stoneBroken", cell, cause }));
  applyHookEffect(d, d.hooks.onStoneBroken(d.state, cells, cause));
}

// ── spells: cost ────────────────────────────────────────────────────────────

/** Mana cost of a spell right now (upgrade, then the `spellCost` hook; never below 0). */
export function spellCost(state: BattleState, spell: SpellId, hooks: BattleHooksInput = {}): number {
  const def = SPELLS[spell];
  const base = state.upgrades[spell] ? def.upgradedCost : def.cost;
  return Math.max(0, resolveHooks(hooks).spellCost(state, spell, base));
}

/** Cheapest spell right now; the overload check compares mana against it. */
export function minSpellCost(state: BattleState, hooks: BattleHooksInput = {}): number {
  return Math.min(...SPELL_IDS.map((spell) => spellCost(state, spell, hooks)));
}

// ── stone break (spec 3.4) ──────────────────────────────────────────────────

function stonesPerLine(grid: GameGrid, direction: Direction): CellPosition[][] {
  const vertical = direction === "up" || direction === "down";
  const lines: CellPosition[][] = Array.from({ length: grid.length }, () => []);
  grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell === STONE) lines[vertical ? c : r].push({ row: r, col: c });
    }),
  );
  return lines;
}

/**
 * Which stones break after a slide that eliminated `pairs`, as positions on
 * the post-slide grid. Rule (decision D1): a stone breaks if, on the board the
 * player swiped (`prevGrid`), it was orthogonally adjacent to a tile that took
 * part in an eliminated pair (either endpoint, a frozen wall included).
 * Stones never reorder or vanish in a slide, so the k-th stone of each line
 * before the slide is the k-th stone of that line after it.
 */
function stonesBrokenBySlide(
  prevGrid: GameGrid,
  nextGrid: GameGrid,
  direction: Direction,
  pairs: readonly EliminatedPair[],
): CellPosition[] {
  const endpoints = pairs.flatMap((pair) => [pair.a, pair.b]);
  const hit = breakAdjacentStones(prevGrid, endpoints).broken;
  if (hit.length === 0) return [];
  const hitKeys = new Set(hit.map(({ row, col }) => `${row},${col}`));
  const before = stonesPerLine(prevGrid, direction);
  const after = stonesPerLine(nextGrid, direction);
  const result: CellPosition[] = [];
  before.forEach((line, lineIndex) =>
    line.forEach((pos, k) => {
      const target = after[lineIndex][k];
      if (hitKeys.has(`${pos.row},${pos.col}`) && target) result.push(target);
    }),
  );
  return result.sort((x, y) => x.row - y.row || x.col - y.col);
}

// ── enemy phase (spec 3.1 step 4) ───────────────────────────────────────────

/**
 * Freezes tick down, then the intent countdown drops by 1; at 0 the intent
 * fires and the next one in the cycle is telegraphed. Order matters: a freeze
 * created by this turn's intent is added after the tick, so it blocks the next
 * 3 slides.
 */
function runEnemyPhase(d: Draft, rng: Rng): void {
  const ticked = tickFreezes(d.state.freezes);
  if (ticked.thawed.length > 0) {
    d.events.push({ type: "thawed", cells: ticked.thawed, cause: "expired" });
  }
  patch(d, { freezes: ticked.freezes });

  const countdown = d.state.countdown - 1;
  if (countdown > 0) {
    patch(d, { countdown });
    return;
  }

  const enemy = enemyOf(d.state);
  const slot = enemy.cycle[d.state.intentIndex];
  const resolution = resolveIntent(
    {
      grid: d.state.grid,
      freezes: d.state.freezes,
      heroHp: d.state.heroHp,
      enemyShield: d.state.enemyShield,
    },
    slot.intent,
    rng,
  );
  const nextIndex = (d.state.intentIndex + 1) % enemy.cycle.length;
  patch(d, {
    grid: resolution.board.grid,
    freezes: resolution.board.freezes,
    enemyShield: resolution.board.enemyShield,
    intentIndex: nextIndex,
    countdown: enemy.cycle[nextIndex].countdown,
  });
  d.events.push({ type: "intentFired", intent: slot.intent, effect: resolution.effect });
  if (resolution.effect.kind === "attack") {
    changeHeroHp(d, -resolution.effect.damage, "attack");
  }
}

// ── spawn (spec 3.1 step 5, 4.1) ────────────────────────────────────────────

function spawnTile(d: Draft, rng: Rng): void {
  const before = d.state.grid;
  const after = spawnRandomTile(before, rng, d.hooks.spawnStrategy(d.state));
  if (after === before) return;
  patch(d, { grid: after });
  changedCells(before, after).forEach((cell) =>
    d.events.push({ type: "tileSpawned", cell, value: after[cell.row][cell.col] as number }),
  );
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Start a battle: empty grid, two spawned tiles (same spawn path as a normal
 * turn), mana 0, first intent telegraphed, then the `onBattleStart` hook.
 * Throws on an unknown `enemyId` (the run layer validates ids when loading a save).
 */
export function createBattle(setup: BattleSetup, rng: Rng, hooks: BattleHooksInput = {}): TurnResult {
  const enemy = getEnemy(setup.enemyId);
  if (!enemy) throw new Error(`Unknown enemy id: ${setup.enemyId}`);
  const size = setup.size ?? GRID_SIZE;
  const state: BattleState = {
    grid: Array.from({ length: size }, () => Array.from({ length: size }, () => null)),
    freezes: [],
    heroHp: setup.heroHp,
    heroMaxHp: setup.heroMaxHp,
    mana: 0,
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    enemyShield: 0,
    intentIndex: 0,
    countdown: enemy.cycle[0].countdown,
    upgrades: setup.upgrades ?? NO_UPGRADES,
    turn: 0,
    overloads: 0,
    status: "ongoing",
  };
  const d = makeDraft(state, hooks);
  spawnTile(d, rng);
  spawnTile(d, rng);
  applyHookEffect(d, d.hooks.onBattleStart(d.state));
  settle(d);
  return done(d);
}

/**
 * One turn (spec 3.1). A slide that changes nothing is not a turn: the state
 * comes back untouched with no events. Order: slide (frozen tiles are walls),
 * damage + mana, stone break, enemy phase, spawn, win/lose. If the enemy dies
 * from the slide's damage it does not act and nothing spawns.
 *
 * rng order: intent (if one fires), then spawn.
 */
export function applyTurn(
  state: BattleState,
  direction: Direction,
  rng: Rng,
  hooks: BattleHooksInput = {},
): TurnResult {
  const d = makeDraft(state, hooks);
  if (state.status !== "ongoing") return done(d);

  const outcome = slide(state.grid, direction, freezeMask(state.grid.length, state.freezes));
  if (!outcome.moved) {
    return done(d);
  }

  patch(d, { grid: outcome.grid, turn: state.turn + 1 });
  d.events.push({
    type: "slid",
    direction,
    prevGrid: state.grid,
    grid: outcome.grid,
    eliminatedPairs: outcome.eliminatedPairs,
  });
  dropDeadFreezes(d); // a frozen tile that was eliminated (as a wall) is no longer frozen

  const pairs = outcome.eliminatedPairs;
  if (pairs.length > 0) {
    resolvePairs(d, pairs.length, "slide");
    if (settle(d)) return done(d);

    const broken = stonesBrokenBySlide(state.grid, outcome.grid, direction, pairs);
    patch(d, { grid: clearCells(d.state.grid, broken) });
    reportBrokenStones(d, broken, "adjacent");
    if (settle(d)) return done(d);
  }

  runEnemyPhase(d, rng);
  if (settle(d)) return done(d);

  spawnTile(d, rng);
  // [overload check goes here]
  settle(d);
  return done(d);
}
