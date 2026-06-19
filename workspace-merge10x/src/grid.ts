export type Cell = number | null;
export type GameGrid = Cell[][];
export type Rng = () => number;
export type Direction = "up" | "down" | "left" | "right";
export interface GameState { grid: GameGrid; score: number; }
export interface EliminatedGroup { positions: Array<{ row: number; col: number }>; length: 2 | 3 | 4; }
export interface SlideOutcome { grid: GameGrid; moved: boolean; scoreGained: number; eliminatedGroups: EliminatedGroup[]; }
export function createEmptyGrid(size: number): GameGrid { return Array.from({ length: size }, () => Array.from({ length: size }, () => null)); }
export function createInitialState(size: number, rng: Rng = Math.random): GameState { return { grid: createEmptyGrid(size), score: 0 }; }
export function slide(_grid: GameGrid, _dir: Direction): SlideOutcome { return { grid: _grid, moved: false, scoreGained: 0, eliminatedGroups: [] }; }
export function spawnRandomTile(grid: GameGrid, _rng: Rng = Math.random): GameGrid { return grid; }
export function isGameOver(_grid: GameGrid): boolean { return false; }
export function canMove(_grid: GameGrid): boolean { return true; }
