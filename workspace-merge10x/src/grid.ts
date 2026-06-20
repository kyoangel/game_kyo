export type Cell = number | null;
export type GameGrid = Cell[][];
export type Rng = () => number;
export type Direction = "up" | "down" | "left" | "right";

export interface GameState {
  grid: GameGrid;
  score: number;
}

export interface EliminatedGroup {
  positions: Array<{ row: number; col: number }>;
  length: 2 | 3 | 4;
  compactedStart: number;
  firstCompactedStart: number;
}

export interface SlideGroupInfo {
  originalCols: number[];
  length: 2 | 3 | 4;
  compactedStart: number;
  firstCompactedStart: number;
}

export interface SlideResult {
  row: Cell[];
  moved: boolean;
  scoreGained: number;
  groups: SlideGroupInfo[];
}

export interface SlideOutcome {
  grid: GameGrid;
  moved: boolean;
  scoreGained: number;
  eliminatedGroups: EliminatedGroup[];
}

function scoreForLength(len: 2 | 3 | 4): number {
  if (len === 4) return 50;
  if (len === 3) return 25;
  return 10;
}

function padToLength(values: number[], length: number): Cell[] {
  return Array.from({ length }, (_, i) => values[i] ?? null);
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
  const groups: SlideGroupInfo[] = [];

  let i = 0;
  while (i < values.length) {
    const v = values;
    const p = valuePositions;

    if (
      i + 3 < values.length &&
      v[i] + v[i + 1] + v[i + 2] + v[i + 3] === 10
    ) {
      groups.push({ originalCols: [p[i], p[i + 1], p[i + 2], p[i + 3]], length: 4, compactedStart: merged.length, firstCompactedStart: i });
      scoreGained += scoreForLength(4);
      i += 4;
    } else if (
      i + 2 < values.length &&
      v[i] + v[i + 1] + v[i + 2] === 10
    ) {
      groups.push({ originalCols: [p[i], p[i + 1], p[i + 2]], length: 3, compactedStart: merged.length, firstCompactedStart: i });
      scoreGained += scoreForLength(3);
      i += 3;
    } else if (
      i + 1 < values.length &&
      v[i] + v[i + 1] === 10
    ) {
      groups.push({ originalCols: [p[i], p[i + 1]], length: 2, compactedStart: merged.length, firstCompactedStart: i });
      scoreGained += scoreForLength(2);
      i += 2;
    } else {
      merged.push(v[i]);
      i += 1;
    }
  }

  const finalRow = padToLength(merged, row.length);
  const moved = row.some((cell, index) => cell !== finalRow[index]);
  return { row: finalRow, moved, scoreGained, groups };
}

function reverseRows(grid: GameGrid): GameGrid {
  return grid.map((row) => [...row].reverse());
}

function transpose(grid: GameGrid): GameGrid {
  const size = grid.length;
  return Array.from({ length: size }, (_, col) =>
    Array.from({ length: size }, (_, row) => grid[row][col]),
  );
}

function applySlideRowLeftToGrid(grid: GameGrid): SlideOutcome {
  let moved = false;
  let scoreGained = 0;
  const eliminatedGroups: EliminatedGroup[] = [];

  const resultGrid = grid.map((row, rowIndex) => {
    const result = slideRowLeft(row);
    if (result.moved) moved = true;
    scoreGained += result.scoreGained;
    result.groups.forEach((g) => {
      eliminatedGroups.push({
        positions: g.originalCols.map((col) => ({ row: rowIndex, col })),
        length: g.length,
        compactedStart: g.compactedStart,
        firstCompactedStart: g.firstCompactedStart,
      });
    });
    return result.row;
  });

  // Combo bonus: (N-1) × 10 for N > 1 groups in one swipe
  if (eliminatedGroups.length > 1) {
    scoreGained += (eliminatedGroups.length - 1) * 10;
  }

  return { grid: resultGrid, moved, scoreGained, eliminatedGroups };
}

export function slide(grid: GameGrid, direction: Direction): SlideOutcome {
  const size = grid.length;

  switch (direction) {
    case "left": {
      return applySlideRowLeftToGrid(grid);
    }
    case "right": {
      const outcome = applySlideRowLeftToGrid(reverseRows(grid));
      const groups = outcome.eliminatedGroups.map((g) => ({
        ...g,
        positions: g.positions.map(({ row, col }) => ({
          row,
          col: size - 1 - col,
        })),
        compactedStart: size - g.compactedStart - g.length,
        firstCompactedStart: size - g.firstCompactedStart - g.length,
      }));
      return { ...outcome, grid: reverseRows(outcome.grid), eliminatedGroups: groups };
    }
    case "up": {
      const outcome = applySlideRowLeftToGrid(transpose(grid));
      const groups = outcome.eliminatedGroups.map((g) => ({
        ...g,
        positions: g.positions.map(({ row, col }) => ({ row: col, col: row })),
      }));
      return { ...outcome, grid: transpose(outcome.grid), eliminatedGroups: groups };
    }

    case "down": {
      const outcome = applySlideRowLeftToGrid(reverseRows(transpose(grid)));
      const groups = outcome.eliminatedGroups.map((g) => ({
        ...g,
        positions: g.positions.map(({ row, col }) => ({
          row: size - 1 - col,
          col: row,
        })),
        compactedStart: size - g.compactedStart - g.length,
        firstCompactedStart: size - g.firstCompactedStart - g.length,
      }));
      return { ...outcome, grid: transpose(reverseRows(outcome.grid)), eliminatedGroups: groups };
    }
  }
}

export function canMove(grid: GameGrid): boolean {
  // If there are empty cells, tiles can still be spawned and moved
  const hasEmptyCell = grid.some((row) => row.some((cell) => cell === null));
  if (hasEmptyCell) return true;
  // Full board: check if any slide direction produces a match
  const directions: Direction[] = ["up", "down", "left", "right"];
  return directions.some((d) => slide(grid, d).moved);
}

export function isGameOver(grid: GameGrid): boolean {
  return !canMove(grid);
}

export function createEmptyGrid(size: number): GameGrid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as Cell),
  );
}

// Weighted spawn: biased toward smaller values to enable triple/quad matches
const SPAWN_WEIGHTS = [18, 18, 18, 15, 11, 8, 6, 3, 3]; // index 0 = value 1
const TOTAL_WEIGHT = SPAWN_WEIGHTS.reduce((s, w) => s + w, 0); // 100

export function spawnRandomTile(grid: GameGrid, rng: Rng = Math.random): GameGrid {
  const emptyCells: Array<[number, number]> = [];
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === null) emptyCells.push([r, c]);
    });
  });

  if (emptyCells.length === 0) return grid;

  const [targetRow, targetCol] =
    emptyCells[Math.floor(rng() * emptyCells.length)];

  let value = 1;
  const r = rng() * TOTAL_WEIGHT;
  let cumulative = 0;
  for (let i = 0; i < SPAWN_WEIGHTS.length; i++) {
    cumulative += SPAWN_WEIGHTS[i];
    if (r < cumulative) {
      value = i + 1;
      break;
    }
  }

  return grid.map((row, ri) =>
    row.map((cell, ci) =>
      ri === targetRow && ci === targetCol ? value : cell,
    ),
  );
}

// Initial state: 2 tiles for 4×4, 4 tiles for 5×5
export function createInitialState(size: number, rng: Rng = Math.random): GameState {
  const initialTileCount = size === 4 ? 2 : 4;
  let grid = createEmptyGrid(size);
  for (let i = 0; i < initialTileCount; i++) {
    grid = spawnRandomTile(grid, rng);
  }
  return { grid, score: 0 };
}
