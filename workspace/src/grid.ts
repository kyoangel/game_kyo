export type Cell = number | null;
export type GameGrid = Cell[][];

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

    if (next !== undefined && current + next === 10) {
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

export type Direction = "up" | "down" | "left" | "right";

export interface SlideOutcome {
  grid: GameGrid;
  moved: boolean;
  scoreGained: number;
  eliminatedPairs: EliminatedPair[];
}

function applySlideRowLeftToGrid(grid: GameGrid): SlideOutcome {
  let moved = false;
  let scoreGained = 0;
  const eliminatedPairs: EliminatedPair[] = [];

  const resultGrid = grid.map((row, rowIndex) => {
    const result = slideRowLeft(row);
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

function reverseRows(grid: GameGrid): GameGrid {
  return grid.map((row) => [...row].reverse());
}

function transpose(grid: GameGrid): GameGrid {
  const size = grid.length;
  return Array.from({ length: size }, (_, col) =>
    Array.from({ length: size }, (_, row) => grid[row][col])
  );
}

export function slide(grid: GameGrid, direction: Direction): SlideOutcome {
  const size = grid.length;

  switch (direction) {
    case "left": {
      return applySlideRowLeftToGrid(grid);
    }
    case "right": {
      const outcome = applySlideRowLeftToGrid(reverseRows(grid));
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.row, col: size - 1 - a.col },
        b: { row: b.row, col: size - 1 - b.col },
        meetA: { row: meetA.row, col: size - 1 - meetA.col },
        meetB: { row: meetB.row, col: size - 1 - meetB.col },
      }));
      return { ...outcome, grid: reverseRows(outcome.grid), eliminatedPairs: pairs };
    }
    case "up": {
      const outcome = applySlideRowLeftToGrid(transpose(grid));
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.col, col: a.row },
        b: { row: b.col, col: b.row },
        meetA: { row: meetA.col, col: meetA.row },
        meetB: { row: meetB.col, col: meetB.row },
      }));
      return { ...outcome, grid: transpose(outcome.grid), eliminatedPairs: pairs };
    }
    case "down": {
      const outcome = applySlideRowLeftToGrid(reverseRows(transpose(grid)));
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

export function canMove(grid: GameGrid): boolean {
  const directions: Direction[] = ["up", "down", "left", "right"];
  return directions.some((direction) => slide(grid, direction).moved);
}

export function isGameOver(grid: GameGrid): boolean {
  return !canMove(grid);
}

export type Rng = () => number;

export function spawnRandomTile(grid: GameGrid, rng: Rng = Math.random): GameGrid {
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

  const [targetRow, targetCol] = emptyCells[Math.floor(rng() * emptyCells.length)];
  const value = Math.floor(rng() * 9) + 1;

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
