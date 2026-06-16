import type { GameGrid } from "./grid";

export interface CellPosition {
  row: number;
  col: number;
}

export function changedCells(prevGrid: GameGrid, nextGrid: GameGrid): CellPosition[] {
  const result: CellPosition[] = [];

  nextGrid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell !== prevGrid[rowIndex][colIndex]) {
        result.push({ row: rowIndex, col: colIndex });
      }
    });
  });

  return result;
}
