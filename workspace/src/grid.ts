import type { CellPosition } from "./gridDiff";

export type Cell = number | null;
export type GameGrid = Cell[][];

/**
 * Special cell value for a stone. It is a plain number so Cell stays
 * `number | null`, but it is negative so it can never be a tile value (1-9)
 * or a 0-tile, and `canPair` refuses to pair it with anything.
 */
export const STONE = -1;

/**
 * Whether two adjacent cell values eliminate each other (sum to 10).
 * A stone never pairs with anything. 0 + (1..9) is never 10, so 0 never pairs either.
 */
export function canPair(a: number, b: number): boolean {
  return a !== STONE && b !== STONE && a + b === 10;
}

export interface EliminatedPair {
  a: { row: number; col: number };
  b: { row: number; col: number };
  meetA: { row: number; col: number };
  meetB: { row: number; col: number };
}

export function createEmptyGrid(size: number): GameGrid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as Cell)
  );
}

export interface CompactResult {
  row: Cell[];
  moved: boolean;
}

function padToLength(values: number[], length: number): Cell[] {
  return Array.from({ length }, (_, index) => values[index] ?? null);
}

export function compactRow(row: Cell[]): CompactResult {
  const values = row.filter((cell): cell is number => cell !== null);
  const compacted = padToLength(values, row.length);
  const moved = row.some((cell, index) => cell !== compacted[index]);

  return { row: compacted, moved };
}

export interface SlideResult {
  row: Cell[];
  moved: boolean;
  scoreGained: number;
  eliminatedIndices: Array<[number, number, number, number]>;
}

export function slideRowLeft(row: Cell[]): SlideResult {
  const valuePositions: number[] = [];
  const values: number[] = [];
  row.forEach((cell, index) => {
    if (cell !== null) {
      valuePositions.push(index);
      values.push(cell);
    }
  });

  const merged: number[] = [];
  let scoreGained = 0;
  const eliminatedIndices: Array<[number, number, number, number]> = [];

  let i = 0;
  while (i < values.length) {
    const current = values[i];
    const next = values[i + 1];

    if (next !== undefined && canPair(current, next)) {
      scoreGained += 10;
      const meetACol = merged.length;
      eliminatedIndices.push([valuePositions[i], valuePositions[i + 1], meetACol, meetACol + 1]);
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }

  const finalRow = padToLength(merged, row.length);
  const moved = row.some((cell, index) => cell !== finalRow[index]);

  return { row: finalRow, moved, scoreGained, eliminatedIndices };
}

/**
 * Frozen-cell mask, same shape as the grid: `mask[row][col] === true` means the
 * cell is frozen. A frozen cell that holds a tile is a wall for slides: it does
 * not move and tiles do not move through it. A mask entry on an empty (null)
 * cell is ignored. Frozen cells can still be eliminated, see `slideRowLeftFrozen`.
 */
export type FrozenMask = boolean[][];

/**
 * Slide one row left with frozen cells acting as walls.
 *
 * - Each run of non-wall cells between walls compacts and merges independently,
 *   exactly like `slideRowLeft`.
 * - A wall (frozen tile) can be eliminated by a tile that ends up adjacent to it:
 *   the first tile of the run on its right (it slides up against the wall), or
 *   the last tile of the run on its left when that run is completely full
 *   (already touching the wall). The wall is processed left to right, so a wall
 *   consumed by the run on its left cannot also pair with the run on its right.
 * - Two frozen cells next to each other never eliminate each other (neither moves).
 */
export function slideRowLeftFrozen(row: Cell[], frozenRow: boolean[]): SlideResult {
  const size = row.length;
  const isWall = (index: number): boolean => frozenRow[index] === true && row[index] !== null;
  const out: Cell[] = [...row];
  const consumed = new Set<number>();
  const eliminatedIndices: Array<[number, number, number, number]> = [];
  let scoreGained = 0;

  let index = 0;
  while (index < size) {
    if (isWall(index)) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < size && !isWall(index)) index += 1;
    const end = index;
    const segmentLength = end - start;

    const entries: Array<{ value: number; from: number }> = [];
    for (let i = start; i < end; i++) {
      const cell = row[i];
      if (cell !== null) entries.push({ value: cell, from: i });
    }

    const headIndex = start - 1;
    const headValue =
      headIndex >= 0 && !consumed.has(headIndex) ? (row[headIndex] as number) : null;

    let next = 0;
    if (headValue !== null && entries.length > 0 && canPair(headValue, entries[0].value)) {
      scoreGained += 10;
      eliminatedIndices.push([headIndex, entries[0].from, headIndex, start]);
      consumed.add(headIndex);
      out[headIndex] = null;
      next = 1;
    }

    const merged: Array<{ value: number; from: number }> = [];
    while (next < entries.length) {
      const current = entries[next];
      const following = entries[next + 1];
      if (following !== undefined && canPair(current.value, following.value)) {
        scoreGained += 10;
        const meetA = start + merged.length;
        eliminatedIndices.push([current.from, following.from, meetA, meetA + 1]);
        next += 2;
      } else {
        merged.push(current);
        next += 1;
      }
    }

    if (end < size && merged.length > 0 && merged.length === segmentLength) {
      const last = merged[merged.length - 1];
      const wallValue = row[end] as number;
      if (canPair(last.value, wallValue)) {
        scoreGained += 10;
        eliminatedIndices.push([last.from, end, end - 1, end]);
        consumed.add(end);
        out[end] = null;
        merged.pop();
      }
    }

    for (let i = 0; i < segmentLength; i++) {
      out[start + i] = merged[i] !== undefined ? merged[i].value : null;
    }
  }

  const moved = row.some((cell, i) => cell !== out[i]);
  return { row: out, moved, scoreGained, eliminatedIndices };
}

export type Direction = "up" | "down" | "left" | "right";

export interface SlideOutcome {
  grid: GameGrid;
  moved: boolean;
  scoreGained: number;
  eliminatedPairs: EliminatedPair[];
}

function applySlideRowLeftToGrid(grid: GameGrid, frozen?: FrozenMask): SlideOutcome {
  let moved = false;
  let scoreGained = 0;
  const eliminatedPairs: EliminatedPair[] = [];

  const resultGrid = grid.map((row, rowIndex) => {
    const result = frozen
      ? slideRowLeftFrozen(row, frozen[rowIndex] ?? [])
      : slideRowLeft(row);
    if (result.moved) moved = true;
    scoreGained += result.scoreGained;
    result.eliminatedIndices.forEach(([colA, colB, meetACol, meetBCol]) => {
      eliminatedPairs.push({
        a: { row: rowIndex, col: colA },
        b: { row: rowIndex, col: colB },
        meetA: { row: rowIndex, col: meetACol },
        meetB: { row: rowIndex, col: meetBCol },
      });
    });
    return result.row;
  });

  return { grid: resultGrid, moved, scoreGained, eliminatedPairs };
}

function reverseRows<T>(grid: T[][]): T[][] {
  return grid.map((row) => [...row].reverse());
}

function transpose<T>(grid: T[][]): T[][] {
  const size = grid.length;
  return Array.from({ length: size }, (_, col) =>
    Array.from({ length: size }, (_, row) => grid[row][col])
  );
}

export function slide(grid: GameGrid, direction: Direction, frozen?: FrozenMask): SlideOutcome {
  const size = grid.length;

  switch (direction) {
    case "left": {
      return applySlideRowLeftToGrid(grid, frozen);
    }
    case "right": {
      const outcome = applySlideRowLeftToGrid(
        reverseRows(grid),
        frozen && reverseRows(frozen),
      );
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.row, col: size - 1 - a.col },
        b: { row: b.row, col: size - 1 - b.col },
        meetA: { row: meetA.row, col: size - 1 - meetA.col },
        meetB: { row: meetB.row, col: size - 1 - meetB.col },
      }));
      return { ...outcome, grid: reverseRows(outcome.grid), eliminatedPairs: pairs };
    }
    case "up": {
      const outcome = applySlideRowLeftToGrid(
        transpose(grid),
        frozen && transpose(frozen),
      );
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.col, col: a.row },
        b: { row: b.col, col: b.row },
        meetA: { row: meetA.col, col: meetA.row },
        meetB: { row: meetB.col, col: meetB.row },
      }));
      return { ...outcome, grid: transpose(outcome.grid), eliminatedPairs: pairs };
    }
    case "down": {
      const outcome = applySlideRowLeftToGrid(
        reverseRows(transpose(grid)),
        frozen && reverseRows(transpose(frozen)),
      );
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: size - 1 - a.col, col: a.row },
        b: { row: size - 1 - b.col, col: b.row },
        meetA: { row: size - 1 - meetA.col, col: meetA.row },
        meetB: { row: size - 1 - meetB.col, col: meetB.row },
      }));
      return { ...outcome, grid: transpose(reverseRows(outcome.grid)), eliminatedPairs: pairs };
    }
  }
}

export function canMove(grid: GameGrid, frozen?: FrozenMask): boolean {
  const directions: Direction[] = ["up", "down", "left", "right"];
  return directions.some((direction) => slide(grid, direction, frozen).moved);
}

export function isGameOver(grid: GameGrid, frozen?: FrozenMask): boolean {
  return !canMove(grid, frozen);
}

export type Rng = () => number;

/**
 * Optional "complement bias" for `spawnRandomTile` (adventure-mode anti-stall layer).
 *
 * When the number of empty cells is below `emptyThreshold`, the spawn uses the
 * bias with chance `probability`; otherwise with chance `baseProbability`
 * (default 0). If both could apply the higher chance wins. A biased spawn
 * picks an empty cell that touches a numeric tile (1-9; stones and 0 do not
 * count) and spawns `10 - neighbour` there, so the new tile can pair with it.
 */
export interface SpawnStrategy {
  emptyThreshold: number;
  probability: number;
  baseProbability?: number;
}

/** Spec 4.1: fewer than 4 empty cells -> 50% complement spawn. */
export const COMPLEMENT_BIAS: SpawnStrategy = { emptyThreshold: 4, probability: 0.5 };

function biasChance(strategy: SpawnStrategy, emptyCount: number): number {
  const base = strategy.baseProbability ?? 0;
  return emptyCount < strategy.emptyThreshold ? Math.max(strategy.probability, base) : base;
}

interface PlannedSpawn {
  row: number;
  col: number;
  value: number;
}

// Order is part of the contract (tests use scripted rngs): empties in row-major
// order, neighbours in up, down, left, right order.
function complementSpawnOptions(grid: GameGrid, emptyCells: Array<[number, number]>): PlannedSpawn[] {
  const offsets: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const options: PlannedSpawn[] = [];
  emptyCells.forEach(([row, col]) => {
    offsets.forEach(([dr, dc]) => {
      const neighbour: Cell | undefined = grid[row + dr]?.[col + dc];
      if (typeof neighbour === "number" && neighbour >= 1 && neighbour <= 9) {
        options.push({ row, col, value: 10 - neighbour });
      }
    });
  });
  return options;
}

export function spawnRandomTile(
  grid: GameGrid,
  rng: Rng = Math.random,
  strategy?: SpawnStrategy,
): GameGrid {
  const emptyCells: Array<[number, number]> = [];
  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === null) {
        emptyCells.push([rowIndex, colIndex]);
      }
    });
  });

  if (emptyCells.length === 0) {
    return grid;
  }

  // rng call order: [bias roll (only if chance > 0)] [bias pick (only if rolled)], else cell pick, value.
  let planned: PlannedSpawn | null = null;
  if (strategy) {
    const chance = biasChance(strategy, emptyCells.length);
    if (chance > 0 && rng() < chance) {
      const options = complementSpawnOptions(grid, emptyCells);
      if (options.length > 0) {
        planned = options[Math.floor(rng() * options.length)];
      }
    }
  }

  if (planned === null) {
    const [emptyRow, emptyCol] = emptyCells[Math.floor(rng() * emptyCells.length)];
    planned = { row: emptyRow, col: emptyCol, value: Math.floor(rng() * 9) + 1 };
  }

  const { row: targetRow, col: targetCol, value } = planned;
  return grid.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      rowIndex === targetRow && colIndex === targetCol ? value : cell
    )
  );
}

export interface GameState {
  grid: GameGrid;
  score: number;
}

export function createInitialState(size: number, rng: Rng = Math.random): GameState {
  const empty = createEmptyGrid(size);
  const withFirstTile = spawnRandomTile(empty, rng);
  const grid = spawnRandomTile(withFirstTile, rng);
  return { grid, score: 0 };
}

export function applyMove(state: GameState, direction: Direction, rng: Rng = Math.random): GameState {
  const outcome = slide(state.grid, direction);
  if (!outcome.moved) {
    return state;
  }
  const grid = spawnRandomTile(outcome.grid, rng);
  return { grid, score: state.score + outcome.scoreGained };
}

/** Cells where this turn's pairs vanished: every `meetA` and `meetB`, de-duplicated, in pair order. */
export function eliminationSites(pairs: EliminatedPair[]): CellPosition[] {
  const seen = new Set<string>();
  const sites: CellPosition[] = [];
  pairs.forEach(({ meetA, meetB }) => {
    [meetA, meetB].forEach(({ row, col }) => {
      const key = `${row},${col}`;
      if (!seen.has(key)) {
        seen.add(key);
        sites.push({ row, col });
      }
    });
  });
  return sites;
}

export interface StoneBreakResult {
  grid: GameGrid;
  /** Stones that were removed, in row-major order. */
  broken: CellPosition[];
}

/**
 * Break every stone that is orthogonally adjacent (up/down/left/right, not
 * diagonal) to at least one of `eliminatedCells`. Pure: the input grid is not
 * mutated. Cells outside the grid are ignored. Callers pass the eliminated
 * cells in the same frame as `grid` (adventure mode: the post-slide grid and
 * `eliminationSites(outcome.eliminatedPairs)`).
 */
export function breakAdjacentStones(
  grid: GameGrid,
  eliminatedCells: CellPosition[],
): StoneBreakResult {
  const offsets: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const breakKeys = new Set<string>();
  eliminatedCells.forEach(({ row, col }) => {
    offsets.forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;
      if (grid[r]?.[c] === STONE) breakKeys.add(`${r},${c}`);
    });
  });

  const broken: CellPosition[] = [];
  const next = grid.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (cell === STONE && breakKeys.has(`${rowIndex},${colIndex}`)) {
        broken.push({ row: rowIndex, col: colIndex });
        return null;
      }
      return cell;
    }),
  );
  return { grid: next, broken };
}
