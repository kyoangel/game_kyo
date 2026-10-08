/**
 * The enemy intents (spec 5.1) and the zero-lord's 歸零 as pure functions.
 * Each takes an `IntentBoard` (the slice of battle state an intent may touch)
 * and returns a new board plus an `IntentEffect` describing what happened, for
 * the view layer's events. Randomness is an injected `Rng`; inputs are never mutated.
 */
import { STONE, type GameGrid, type Rng, type FrozenMask } from "../grid";
import type { CellPosition } from "../gridDiff";
import type { Intent } from "./enemies";

/** How many turns a freeze intent freezes a tile (spec 5.1). */
export const FREEZE_TURNS = 3;

/** One frozen tile. `turns` is the number of remaining turns it stays frozen. */
export interface FreezeEntry {
  row: number;
  col: number;
  turns: number;
}

export interface IntentBoard {
  grid: GameGrid;
  freezes: FreezeEntry[];
  heroHp: number;
  enemyShield: number;
}

export type IntentEffect =
  | { kind: "attack"; damage: number }
  | { kind: "rockfall"; placed: CellPosition[] }
  | { kind: "freeze"; frozen: CellPosition[] }
  | { kind: "shield"; gained: number }
  | { kind: "scramble"; changed: Array<{ row: number; col: number; from: number; to: number }> }
  | { kind: "zero"; zeroed: CellPosition[] };

export interface IntentResolution {
  board: IntentBoard;
  effect: IntentEffect;
}

// ── freeze bookkeeping ──────────────────────────────────────────────────────

/** Board-shaped boolean mask for `slide` / `canMove` / `isGameOver` / `shuffleEffect`. */
export function freezeMask(size: number, freezes: readonly FreezeEntry[]): FrozenMask {
  const mask: FrozenMask = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  freezes.forEach(({ row, col }) => {
    if (mask[row]?.[col] !== undefined) mask[row][col] = true;
  });
  return mask;
}

/** Lower every counter by one; entries that reach 0 thaw. */
export function tickFreezes(freezes: readonly FreezeEntry[]): {
  freezes: FreezeEntry[];
  thawed: CellPosition[];
} {
  const next: FreezeEntry[] = [];
  const thawed: CellPosition[] = [];
  freezes.forEach((entry) => {
    if (entry.turns - 1 > 0) next.push({ ...entry, turns: entry.turns - 1 });
    else thawed.push({ row: entry.row, col: entry.col });
  });
  return { freezes: next, thawed };
}

/** Drop freezes whose cell no longer holds a tile (eliminated, cleared) or holds a stone. */
export function pruneFreezes(
  grid: GameGrid,
  freezes: readonly FreezeEntry[],
): { freezes: FreezeEntry[]; removed: CellPosition[] } {
  const kept: FreezeEntry[] = [];
  const removed: CellPosition[] = [];
  freezes.forEach((entry) => {
    const cell = grid[entry.row]?.[entry.col];
    if (cell === null || cell === undefined || cell === STONE) {
      removed.push({ row: entry.row, col: entry.col });
    } else {
      kept.push(entry);
    }
  });
  return { freezes: kept, removed };
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Pick `count` distinct items (partial Fisher-Yates): one rng call per pick,
 * for i in 0..count-1: j = i + floor(rng() * (n - i)). Does not mutate `items`.
 */
export function pickDistinct<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const take = Math.min(count, pool.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}

function cellsWhere(grid: GameGrid, test: (cell: number | null) => boolean): CellPosition[] {
  const cells: CellPosition[] = [];
  grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (test(cell)) cells.push({ row: r, col: c });
    }),
  );
  return cells;
}

function withCells(grid: GameGrid, cells: CellPosition[], valueAt: (p: CellPosition) => number): GameGrid {
  const next = grid.map((row) => [...row]);
  cells.forEach((p) => {
    next[p.row][p.col] = valueAt(p);
  });
  return next;
}

// ── the intents ─────────────────────────────────────────────────────────────

/** ⚔ Attack N: the hero loses N HP (never below 0). */
export function resolveAttack(board: IntentBoard, amount: number): IntentResolution {
  const heroHp = Math.max(0, board.heroHp - amount);
  return {
    board: { ...board, heroHp },
    effect: { kind: "attack", damage: board.heroHp - heroHp },
  };
}

/** 🪨 Rockfall K: stones on K random empty cells (all of them if fewer are empty). */
export function resolveRockfall(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const empties = cellsWhere(board.grid, (cell) => cell === null);
  const placed = pickDistinct(empties, count, rng);
  if (placed.length === 0) {
    return { board, effect: { kind: "rockfall", placed: [] } };
  }
  return {
    board: { ...board, grid: withCells(board.grid, placed, () => STONE) },
    effect: { kind: "rockfall", placed },
  };
}

/** ❄ Freeze: `count` random tiles (anything but stones, empty cells and already frozen tiles) for 3 turns. */
export function resolveFreeze(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const alreadyFrozen = new Set(board.freezes.map(({ row, col }) => `${row},${col}`));
  const candidates = cellsWhere(
    board.grid,
    (cell) => cell !== null && cell !== STONE,
  ).filter(({ row, col }) => !alreadyFrozen.has(`${row},${col}`));
  const frozen = pickDistinct(candidates, count, rng);
  return {
    board: {
      ...board,
      freezes: [...board.freezes, ...frozen.map(({ row, col }) => ({ row, col, turns: FREEZE_TURNS }))],
    },
    effect: { kind: "freeze", frozen },
  };
}

/** 🛡 Shield N: shield points stack. */
export function resolveShield(board: IntentBoard, amount: number): IntentResolution {
  return {
    board: { ...board, enemyShield: board.enemyShield + amount },
    effect: { kind: "shield", gained: amount },
  };
}

/**
 * 🌀 Scramble: `count` random 1-9 tiles change by +-1, staying in 1-9.
 * rng per tile: one call to pick the tile, one for the sign (>= 0.5 means +1);
 * a sign that would leave 1-9 is flipped (1 can only go up, 9 only down).
 */
export function resolveScramble(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const candidates = cellsWhere(board.grid, (cell) => cell !== null && cell >= 1 && cell <= 9);
  const changed: Array<{ row: number; col: number; from: number; to: number }> = [];
  const pool = [...candidates];
  const take = Math.min(count, pool.length);
  for (let n = 0; n < take; n++) {
    const index = Math.floor(rng() * pool.length);
    const [pos] = pool.splice(index, 1);
    const from = board.grid[pos.row][pos.col] as number;
    let delta = rng() >= 0.5 ? 1 : -1;
    if (from + delta < 1 || from + delta > 9) delta = -delta;
    changed.push({ row: pos.row, col: pos.col, from, to: from + delta });
  }
  if (changed.length === 0) {
    return { board, effect: { kind: "scramble", changed } };
  }
  const grid = board.grid.map((row) => [...row]);
  changed.forEach(({ row, col, to }) => {
    grid[row][col] = to;
  });
  return { board: { ...board, grid }, effect: { kind: "scramble", changed } };
}

/** ⭕ 歸零 (zero lord only): `count` random 1-9 tiles become 0, which can never pair with 1-9. */
export function resolveZero(board: IntentBoard, count: number, rng: Rng): IntentResolution {
  const candidates = cellsWhere(board.grid, (cell) => cell !== null && cell >= 1 && cell <= 9);
  const zeroed = pickDistinct(candidates, count, rng);
  if (zeroed.length === 0) {
    return { board, effect: { kind: "zero", zeroed } };
  }
  return {
    board: { ...board, grid: withCells(board.grid, zeroed, () => 0) },
    effect: { kind: "zero", zeroed },
  };
}

/** Run one intent against the board. */
export function resolveIntent(board: IntentBoard, intent: Intent, rng: Rng): IntentResolution {
  switch (intent.kind) {
    case "attack":
      return resolveAttack(board, intent.amount);
    case "rockfall":
      return resolveRockfall(board, intent.amount, rng);
    case "freeze":
      return resolveFreeze(board, intent.amount, rng);
    case "shield":
      return resolveShield(board, intent.amount);
    case "scramble":
      return resolveScramble(board, intent.amount, rng);
    case "zero":
      return resolveZero(board, intent.amount, rng);
  }
}
