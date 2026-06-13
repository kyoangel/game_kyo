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
