export type Cell = number | null;
export type GameGrid = Cell[][];

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
}

export function slideRowLeft(row: Cell[]): SlideResult {
  const values = row.filter((cell): cell is number => cell !== null);
  const merged: number[] = [];
  let scoreGained = 0;

  let i = 0;
  while (i < values.length) {
    const current = values[i];
    const next = values[i + 1];

    if (next !== undefined && current + next === 10) {
      scoreGained += 10;
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }

  const finalRow = padToLength(merged, row.length);
  const moved = row.some((cell, index) => cell !== finalRow[index]);

  return { row: finalRow, moved, scoreGained };
}

export type Direction = "up" | "down" | "left" | "right";

export interface SlideOutcome {
  grid: GameGrid;
  moved: boolean;
  scoreGained: number;
}

function applySlideRowLeftToGrid(grid: GameGrid): SlideOutcome {
  let moved = false;
  let scoreGained = 0;

  const resultGrid = grid.map((row) => {
    const result = slideRowLeft(row);
    if (result.moved) moved = true;
    scoreGained += result.scoreGained;
    return result.row;
  });

  return { grid: resultGrid, moved, scoreGained };
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
  switch (direction) {
    case "left":
      return applySlideRowLeftToGrid(grid);
    case "right": {
      const outcome = applySlideRowLeftToGrid(reverseRows(grid));
      return { ...outcome, grid: reverseRows(outcome.grid) };
    }
    case "up": {
      const outcome = applySlideRowLeftToGrid(transpose(grid));
      return { ...outcome, grid: transpose(outcome.grid) };
    }
    case "down": {
      const outcome = applySlideRowLeftToGrid(reverseRows(transpose(grid)));
      return { ...outcome, grid: transpose(reverseRows(outcome.grid)) };
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
