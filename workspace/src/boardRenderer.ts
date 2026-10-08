import type { Direction, EliminatedPair, GameGrid } from "./grid";
import type { CellPosition } from "./gridDiff";
import { PALETTES, type PaletteId } from "./palettes";

export const ELIM_HIGHLIGHT_MS = 400;
export const ELIM_FADE_MS = 200;
export const MOVE_DURATION_MS = 150;
export const SPAWN_DELAY_MS = 350;
export const SPAWN_DURATION_MS = 400;

const HF_MS = ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;

export interface PhantomTile {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
  value: number;
}

export interface PhantomGroup {
  tiles: PhantomTile[];
  length: 2;
  direction: Direction;
  groupIndex: number;
}

export interface SurvivorCell {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
  finalRow: number;
  finalCol: number;
}

export interface ElimPhaseState {
  groups: PhantomGroup[];
  startTime: number;
  survivorCells: SurvivorCell[];
}

export interface RecompactCell {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function c2StartMs(totalGroups: number): number {
  return MOVE_DURATION_MS + totalGroups * HF_MS;
}

export function totalElimMs(totalGroups: number): number {
  return c2StartMs(totalGroups) + MOVE_DURATION_MS;
}

export function buildElimPhaseState(
  eliminatedPairs: EliminatedPair[],
  prevGrid: GameGrid,
  direction: Direction,
  startTime: number,
): ElimPhaseState {
  const size = prevGrid.length;
  const isVertical = direction === "up" || direction === "down";
  const isReverse = direction === "right" || direction === "down";

  const eliminatedSet = new Set(
    eliminatedPairs.flatMap(({ a, b }) => [`${a.row},${a.col}`, `${b.row},${b.col}`]),
  );

  const groups: PhantomGroup[] = eliminatedPairs.map(({ a, b, meetA, meetB }, groupIndex) => ({
    tiles: [
      { origRow: a.row, origCol: a.col, firstCompactRow: meetA.row, firstCompactCol: meetA.col, value: prevGrid[a.row][a.col] as number },
      { origRow: b.row, origCol: b.col, firstCompactRow: meetB.row, firstCompactCol: meetB.col, value: prevGrid[b.row][b.col] as number },
    ],
    length: 2 as const,
    direction,
    groupIndex,
  }));

  const survivorCells: SurvivorCell[] = [];

  for (let lineIdx = 0; lineIdx < size; lineIdx++) {
    const positions: number[] = isReverse
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    let fcIdx = 0;
    let finalIdx = 0;

    for (const pos of positions) {
      const origRow = isVertical ? pos : lineIdx;
      const origCol = isVertical ? lineIdx : pos;

      if (prevGrid[origRow][origCol] === null) continue;

      const isElim = eliminatedSet.has(`${origRow},${origCol}`);

      if (!isElim) {
        let fcRow: number, fcCol: number, finalRow: number, finalCol: number;
        if (isVertical) {
          fcRow = isReverse ? size - 1 - fcIdx : fcIdx;
          fcCol = lineIdx;
          finalRow = isReverse ? size - 1 - finalIdx : finalIdx;
          finalCol = lineIdx;
        } else {
          fcRow = lineIdx;
          fcCol = isReverse ? size - 1 - fcIdx : fcIdx;
          finalRow = lineIdx;
          finalCol = isReverse ? size - 1 - finalIdx : finalIdx;
        }
        survivorCells.push({ origRow, origCol, firstCompactRow: fcRow, firstCompactCol: fcCol, finalRow, finalCol });
        finalIdx++;
      }
      fcIdx++;
    }
  }

  return { groups, startTime, survivorCells };
}

export interface BoardRendererOptions {
  canvas: HTMLCanvasElement;
  gridSize: number;
  /** Called on every draw so a palette change takes effect without re-creating the renderer. */
  getPalette: () => PaletteId;
}

/**
 * Draws a square tile board on a canvas and owns every board animation
 * (spawn pop-in, slide move, two-phase elimination). It holds no game rules:
 * a mode feeds it the grid to draw plus "begin*" notifications, and calls
 * `advance` once per animation frame.
 */
export class BoardRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly gridSize: number;
  private readonly getPalette: () => PaletteId;

  private readonly spawnCells = new Map<string, number>();
  private readonly moveCells = new Map<string, { startTime: number; direction: Direction }>();
  private readonly recompactCells = new Map<string, RecompactCell>();
  private eliminationPhase: ElimPhaseState | null = null;

  constructor(options: BoardRendererOptions) {
    this.canvas = options.canvas;
    this.ctx = options.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.gridSize = options.gridSize;
    this.getPalette = options.getPalette;
  }

  /** True while the elimination animation is playing (input should be ignored). */
  get isEliminating(): boolean {
    return this.eliminationPhase !== null;
  }

  /** Drops every running animation (used when the board is replaced wholesale). */
  reset(): void {
    this.eliminationPhase = null;
    this.recompactCells.clear();
    this.spawnCells.clear();
    this.moveCells.clear();
  }

  /** Start the elimination animation for a slide that cleared at least one pair. */
  beginElimination(
    eliminatedPairs: EliminatedPair[],
    prevGrid: GameGrid,
    direction: Direction,
    now: number = performance.now(),
  ): void {
    this.eliminationPhase = buildElimPhaseState(eliminatedPairs, prevGrid, direction, now);

    this.recompactCells.clear();
    for (const sc of this.eliminationPhase.survivorCells) {
      this.recompactCells.set(`${sc.finalRow},${sc.finalCol}`, {
        origRow: sc.origRow,
        origCol: sc.origCol,
        firstCompactRow: sc.firstCompactRow,
        firstCompactCol: sc.firstCompactCol,
      });
    }
    this.spawnCells.clear();
    this.moveCells.clear();
  }

  /** Start spawn pop-in for the given cells (replaces any pending spawn animation). */
  beginSpawn(spawned: CellPosition[]): void {
    this.spawnCells.clear();
    spawned.forEach(({ row, col }) => {
      this.spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
    });
  }

  /** Start move + spawn animation for a slide that cleared nothing. */
  beginSlide(spawned: CellPosition[], moved: CellPosition[], direction: Direction): void {
    this.spawnCells.clear();
    this.moveCells.clear();
    spawned.forEach(({ row, col }) => {
      this.spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
    });
    moved.forEach(({ row, col }) => {
      this.moveCells.set(`${row},${col}`, { startTime: performance.now(), direction });
    });
  }

  /**
   * Advance animation bookkeeping by one frame. `onEliminationComplete` runs
   * exactly once, at the moment the elimination animation ends (the caller
   * spawns the deferred tile there). Returns true while another frame is needed.
   */
  advance(now: number, onEliminationComplete: () => void): boolean {
    let stillAnimating = false;

    if (this.eliminationPhase !== null) {
      const elapsed = now - this.eliminationPhase.startTime;
      const total = totalElimMs(this.eliminationPhase.groups.length);
      if (elapsed < total) {
        stillAnimating = true;
      } else {
        this.eliminationPhase = null;
        this.recompactCells.clear();
        onEliminationComplete();
        stillAnimating = true; // spawn animation follows
      }
    }

    this.spawnCells.forEach((startTime, key) => {
      if (startTime > now) {
        stillAnimating = true;
      } else if (now - startTime >= SPAWN_DURATION_MS) {
        this.spawnCells.delete(key);
      } else {
        stillAnimating = true;
      }
    });

    this.moveCells.forEach((data, key) => {
      if (now - data.startTime >= MOVE_DURATION_MS) {
        this.moveCells.delete(key);
      } else {
        stillAnimating = true;
      }
    });

    return stillAnimating;
  }

  draw(grid: GameGrid, now: number = performance.now()): void {
    const { ctx, canvas, gridSize } = this;
    const cellSize = canvas.width / gridSize;
    const padding = 4;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        ctx.strokeStyle = "#444";
        ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    // Draw tiles from the grid with per-type animations
    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell === null) return;

        const key = `${rowIndex},${colIndex}`;
        const x = colIndex * cellSize;
        const y = rowIndex * cellSize;

        if (this.spawnCells.has(key)) {
          const startTime = this.spawnCells.get(key)!;
          const elapsed = now - startTime;
          if (elapsed < 0) return; // not started yet — tile stays invisible

          const t = Math.min(1, elapsed / SPAWN_DURATION_MS);
          let dy: number;
          let scale: number;
          let opacity: number;
          let glowAlpha: number;

          if (t <= 0.5) {
            const p = t / 0.5;
            dy = lerp(-64, 6, p);
            scale = lerp(0.4, 1.1, p);
            opacity = p;
            glowAlpha = p;
          } else if (t <= 0.75) {
            const p = (t - 0.5) / 0.25;
            dy = lerp(6, -3, p);
            scale = lerp(1.1, 0.97, p);
            opacity = 1;
            glowAlpha = lerp(1, 0, p);
          } else {
            const p = (t - 0.75) / 0.25;
            dy = lerp(-3, 0, p);
            scale = lerp(0.97, 1.0, p);
            opacity = 1;
            glowAlpha = 0;
          }

          const cx = x + cellSize / 2;
          const cy = y + dy + cellSize / 2;
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);
          if (glowAlpha > 0) {
            ctx.shadowColor = "#4ade80";
            ctx.shadowBlur = 20 * glowAlpha;
          }
          this.drawBaseTile(cell, x, y + dy, cellSize, padding, 0);
          ctx.restore();
        } else if (this.eliminationPhase !== null && this.recompactCells.has(key)) {
          const rc = this.recompactCells.get(key)!;
          const elapsed = now - this.eliminationPhase.startTime;
          const c2Start = c2StartMs(this.eliminationPhase.groups.length);
          let drawX: number, drawY: number;
          if (elapsed <= MOVE_DURATION_MS) {
            const t = Math.min(1, elapsed / MOVE_DURATION_MS);
            const p = 1 - Math.pow(1 - t, 2);
            drawX = lerp(rc.origCol * cellSize, rc.firstCompactCol * cellSize, p);
            drawY = lerp(rc.origRow * cellSize, rc.firstCompactRow * cellSize, p);
          } else if (elapsed < c2Start) {
            drawX = rc.firstCompactCol * cellSize;
            drawY = rc.firstCompactRow * cellSize;
          } else {
            const t = Math.min(1, (elapsed - c2Start) / MOVE_DURATION_MS);
            const p = 1 - Math.pow(1 - t, 2);
            drawX = lerp(rc.firstCompactCol * cellSize, colIndex * cellSize, p);
            drawY = lerp(rc.firstCompactRow * cellSize, rowIndex * cellSize, p);
          }
          this.drawBaseTile(cell, drawX, drawY, cellSize, padding, 0);
        } else if (this.moveCells.has(key)) {
          const { startTime, direction } = this.moveCells.get(key)!;
          const t = Math.min(1, (now - startTime) / MOVE_DURATION_MS);
          const p = 1 - Math.pow(1 - t, 2); // ease-out
          const scale = lerp(0.65, 1.0, p);
          const offset = lerp(16, 0, p);

          let dx = 0;
          let dy = 0;
          if (direction === "left") dx = offset;
          else if (direction === "right") dx = -offset;
          else if (direction === "up") dy = offset;
          else dy = -offset;

          const cx = x + dx + cellSize / 2;
          const cy = y + dy + cellSize / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);
          this.drawBaseTile(cell, x + dx, y + dy, cellSize, padding, 0);
          ctx.restore();
        } else {
          this.drawBaseTile(cell, x, y, cellSize, padding, 0);
        }
      });
    });

    // Elimination phase: phantom tiles C1→H→F; survivors are drawn in the tile loop via recompactCells
    if (this.eliminationPhase !== null) {
      const elapsed = now - this.eliminationPhase.startTime;

      for (const group of this.eliminationPhase.groups) {
        const hStart = MOVE_DURATION_MS + group.groupIndex * HF_MS;
        const fStart = hStart + ELIM_HIGHLIGHT_MS;
        const fEnd = fStart + ELIM_FADE_MS;

        for (const tile of group.tiles) {
          const fcX = tile.firstCompactCol * cellSize;
          const fcY = tile.firstCompactRow * cellSize;
          const origX = tile.origCol * cellSize;
          const origY = tile.origRow * cellSize;

          if (elapsed <= MOVE_DURATION_MS) {
            const t = elapsed / MOVE_DURATION_MS;
            const p = 1 - Math.pow(1 - t, 2);
            this.drawPhantomTile(tile.value, lerp(origX, fcX, p), lerp(origY, fcY, p), cellSize, 1, 1.0);
          } else if (elapsed < hStart) {
            this.drawBaseTile(tile.value, fcX, fcY, cellSize, padding, 0);
          } else if (elapsed < fEnd) {
            if (elapsed < fStart) {
              this.drawPhantomTile(tile.value, fcX, fcY, cellSize, 1, 1.05);
            } else {
              const fadeT = Math.min(1, (elapsed - fStart) / ELIM_FADE_MS);
              this.drawPhantomTile(tile.value, fcX, fcY, cellSize, Math.max(0, 1 - fadeT), lerp(1.05, 0.4, fadeT));
            }
          }
        }
      }
    }
  }

  private drawPhantomTile(
    value: number,
    x: number,
    y: number,
    cellSize: number,
    alpha: number,
    scale: number,
  ): void {
    const { ctx } = this;
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = "#fde047";
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, cellSize - 8, cellSize - 8, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#422006";
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
    ctx.restore();
  }

  private drawBaseTile(
    value: number,
    x: number,
    y: number,
    cellSize: number,
    padding: number,
    flashAlpha: number,
  ): void {
    const { ctx } = this;
    const colors = PALETTES[this.getPalette()][value];

    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
    ctx.fill();

    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.beginPath();
      ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
      ctx.fill();
    }

    ctx.fillStyle = colors.text;
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
  }
}
