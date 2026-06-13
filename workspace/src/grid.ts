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

export function compactRow(row: Cell[]): CompactResult {
  const values = row.filter((cell): cell is number => cell !== null);
  const compacted: Cell[] = Array.from(
    { length: row.length },
    (_, index) => values[index] ?? null
  );
  const moved = row.some((cell, index) => cell !== compacted[index]);

  return { row: compacted, moved };
}
