import { createEmptyGrid, type GameGrid } from "../../../src/grid";
import { NO_UPGRADES, type BattleState } from "../../../src/adventure/battle";
import { getEnemy } from "../../../src/adventure/enemies";

/** rng that returns the scripted values in order, then 0 forever. */
export function scripted(...values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

/** Deterministic LCG in [0, 1), for seeded random-play tests. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A battle state at turn 0 against `enemyId`, built directly (no rng, no spawns). */
export function makeState(
  grid: GameGrid = createEmptyGrid(4),
  changes: Partial<BattleState> = {},
  enemyId = "slime",
): BattleState {
  const enemy = getEnemy(enemyId)!;
  return {
    grid,
    freezes: [],
    heroHp: 10,
    heroMaxHp: 10,
    mana: 0,
    enemyId,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    enemyShield: 0,
    intentIndex: 0,
    countdown: enemy.cycle[0].countdown,
    upgrades: NO_UPGRADES,
    turn: 0,
    overloads: 0,
    status: "ongoing",
    ...changes,
  };
}

export function gridWith(rows: Array<Array<number | null>>): GameGrid {
  const grid = createEmptyGrid(4);
  rows.forEach((row, r) => row.forEach((v, c) => (grid[r][c] = v)));
  return grid;
}
