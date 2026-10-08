import { STONE, type Cell, type FrozenMask, type GameGrid, type Rng } from "./grid";
import type { CellPosition } from "./gridDiff";

export type PowerupId = "hammer" | "shuffle" | "addOne" | "bomb";

export interface PowerupState {
  hammer: number;
  shuffle: number;
  addOne: number;
  bomb: number;
}

export function emptyPowerups(): PowerupState {
  return { hammer: 0, shuffle: 0, addOne: 0, bomb: 0 };
}

export function computePlayCountAward(
  playCount: number,
  rng: () => number = Math.random,
): PowerupId | null {
  if (playCount % 3 === 0) return "addOne";
  if (playCount % 2 === 0) return rng() < 0.5 ? "hammer" : "shuffle";
  return null;
}

export function computeEliminationAward(
  oldTotal: number,
  newTotal: number,
): number {
  return Math.floor(newTotal / 30) - Math.floor(oldTotal / 30);
}

// ── Pure board effects (shared by endless mode and adventure mode) ───────────

export interface PowerupResult {
  /** New grid; the input grid is never mutated. Same object as the input when `applied` is false. */
  grid: GameGrid;
  /** False when the target was invalid (nothing happened, caller must not spend the powerup). */
  applied: boolean;
  /** Cells that held a tile/stone before and are empty now. */
  cleared: CellPosition[];
}

export interface AddOneResult extends PowerupResult {
  /** True when the target was a 9: it was removed and counts as one eliminated pair (10 points). */
  pairCleared: boolean;
}

function withCell(grid: GameGrid, row: number, col: number, value: Cell): GameGrid {
  return grid.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? value : c)));
}

/** Remove one cell (tile, 0 or stone). Empty or out-of-range target: not applied. */
export function hammerEffect(grid: GameGrid, row: number, col: number): PowerupResult {
  const cell: Cell | undefined = grid[row]?.[col];
  if (cell === undefined || cell === null) {
    return { grid, applied: false, cleared: [] };
  }
  return { grid: withCell(grid, row, col, null), applied: true, cleared: [{ row, col }] };
}

/**
 * Shuffle the contents of every occupied cell (stones and 0 included).
 * Cells flagged in `frozen` keep their content and do not take part.
 * rng call order is the Fisher-Yates order used by endless mode: for i = n-1 down to 1, one call.
 * Always applied (even with 0 or 1 tiles), like the original powerup.
 */
export function shuffleEffect(grid: GameGrid, rng: Rng, frozen?: FrozenMask): PowerupResult {
  const tiles: Array<{ row: number; col: number; value: number }> = [];
  grid.forEach((r, ri) =>
    r.forEach((c, ci) => {
      if (c !== null && !frozen?.[ri]?.[ci]) tiles.push({ row: ri, col: ci, value: c });
    }),
  );
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i].value, tiles[j].value] = [tiles[j].value, tiles[i].value];
  }
  const next: GameGrid = grid.map((r) => [...r]);
  tiles.forEach(({ row, col, value }) => {
    next[row][col] = value;
  });
  return { grid: next, applied: true, cleared: [] };
}

/**
 * +1 on one numeric cell. A 9 is removed instead and reported via `pairCleared`.
 * Empty, out-of-range or stone targets: not applied.
 */
export function addOneEffect(grid: GameGrid, row: number, col: number): AddOneResult {
  const cell: Cell | undefined = grid[row]?.[col];
  if (cell === undefined || cell === null || cell === STONE) {
    return { grid, applied: false, cleared: [], pairCleared: false };
  }
  if (cell === 9) {
    return {
      grid: withCell(grid, row, col, null),
      applied: true,
      cleared: [{ row, col }],
      pairCleared: true,
    };
  }
  return {
    grid: withCell(grid, row, col, cell + 1),
    applied: true,
    cleared: [],
    pairCleared: false,
  };
}

/** Clear the 5-cell cross (target plus up/down/left/right). Always applied, even on an empty centre. */
export function bombEffect(grid: GameGrid, row: number, col: number): PowerupResult {
  const cleared: CellPosition[] = [];
  const next = grid.map((r, ri) =>
    r.map((c, ci) => {
      const isCenter = ri === row && ci === col;
      const isAdjacent =
        (ri === row - 1 && ci === col) ||
        (ri === row + 1 && ci === col) ||
        (ri === row && ci === col - 1) ||
        (ri === row && ci === col + 1);
      if (isCenter || isAdjacent) {
        if (c !== null) cleared.push({ row: ri, col: ci });
        return null;
      }
      return c;
    }),
  );
  return { grid: next, applied: true, cleared };
}
