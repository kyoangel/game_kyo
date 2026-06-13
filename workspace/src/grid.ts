export type Cell = number | null;
export type GameGrid = Cell[][];

export function createEmptyGrid(size: number): GameGrid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as Cell)
  );
}
