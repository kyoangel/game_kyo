# Math Merge 10 Adventure Mode — Plan 1 of 3: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the shared foundation that adventure mode (spec `docs/specs/math-merge-10/adventure-mode.md` §9.2) needs, without changing endless mode (修練) in any way: (1) a reusable `src/boardRenderer.ts` extracted from `src/game.ts`, (2) pure powerup effect functions in `src/powerups.ts`, (3) backwards-compatible `src/grid.ts` extensions: `STONE`, frozen-cell mask for `slide`, complement-bias spawn strategy, and a stone-break helper.

**Architecture:** `game.ts` stops owning board animation state and drawing; a `BoardRenderer` class owns the canvas drawing plus spawn/move/elimination animation state and is driven through `begin*`/`advance`/`draw` calls (a second mode creates its own instance). Powerup board effects become pure `grid in -> result out` functions (rng injected); `game.ts` keeps only side effects (counters, localStorage, audio, HUD). `grid.ts` gains optional trailing parameters only; every existing call site and test stays valid, and when the optional parameters are omitted the old code paths run unchanged.

**Tech Stack:** Vanilla TypeScript + Canvas, Vite, vitest (`tests/unit`), Playwright (`tests/e2e`, dev server on `http://localhost:5173/game_kyo/merge10/` started by `playwright.config.ts`).

**Plan series:** #1 Foundation (this plan) -> #2 battle rules in `src/adventure/` -> #3 run flow, relics, UI, mode menu. Plans #2/#3 depend on the exact names in each task's **Interfaces / Produces** block.

---

## Global Constraints

- Work from `/Users/kyo.lai82/Projects/Personal/game-factory`; source code lives in `workspace/`. Run npm/npx commands from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`; run git commands from `/Users/kyo.lai82/Projects/Personal/game-factory`.
- Endless mode must behave exactly as today. No changes to `index.html`, no DOM/UI changes, no new modes, no `src/adventure/` files, no new tuning numbers beyond those in the spec.
- Existing tests are never edited. New tests go in new files.
- `Cell` stays `number | null`. `STONE` is a plain negative number constant.
- Every new `grid.ts` parameter is optional and trailing. Omitting it must run the pre-existing code path (same results, same rng call order).
- All new rule functions are pure: never mutate their input grid/mask, take randomness as an injected `Rng` (`() => number`).
- Verify commands (confirmed against `workspace/package.json` and `playwright.config.ts`):
  - unit: `npm run test:unit` (vitest, `tests/unit/**/*.test.ts`)
  - the two animation e2e specs: `npx playwright test tests/e2e/merge-animation.spec.ts tests/e2e/visual-effects.spec.ts` (6 tests)
  - full e2e: `npm run test:e2e` (54 tests at baseline)
  - types: `npx tsc --noEmit` (clean at baseline; only `src/**` is type-checked)
  - build: `npm run build`
- Recorded baseline (before any change): **15 unit test files, 195 unit tests passing**; **54 e2e tests passing**; `tsc --noEmit` clean.
- Expected unit-test count after each task: Task 1 -> 200, Task 2 -> 207, Task 3 -> 219, Task 4 -> 231, Task 5 -> 240, Task 6 -> 260.
- Line numbers below refer to the files at the start of the plan (git HEAD `8d38bee`, `workspace/src/game.ts` 1104 lines, `workspace/src/grid.ts` 214 lines). When a task says "locate by name", edit by function name instead of line number because earlier edits shift lines.
- Task order note: spec §9.2 lists powerups before grid, but `addOneEffect` must refuse stones and `shuffleEffect` takes the frozen mask type, so the `grid.ts` tasks (2-5) come before the powerups task (6). The renderer task is first, as it is the highest risk.
- Commit trailer for every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The working tree has an unrelated deleted file (`workspace-pixel-squad/public/sprites/character_rogue.png`); always `git add` explicit paths, never `git add -A`.

---

### Task 1: Extract board drawing and animation into `src/boardRenderer.ts`

Pure refactor, no behavior change. Highest risk, so it goes first and is gated by the two animation e2e specs run before and after.

**Files:**
- Create: `workspace/src/boardRenderer.ts`
- Create (characterization test): `workspace/tests/unit/boardRenderer.test.ts`
- Modify: `workspace/src/game.ts` (imports lines 1-29, constants 37-47, state 287-329, helpers 333-441, `finalizeDeferredSlide` 442-463, `drawBaseTile`/`render` 465-651, `tick` 761-803, `handleKeydown` guard 816 and animation branches 858-872 / 903-910, `setState` 1047-1052)

**Interfaces:**

Consumes:
```ts
// grid.ts (existing)
type Direction = "up" | "down" | "left" | "right";
interface EliminatedPair { a: {row:number;col:number}; b: {row:number;col:number}; meetA: {row:number;col:number}; meetB: {row:number;col:number} }
type GameGrid = (number | null)[][];
// gridDiff.ts (existing)
interface CellPosition { row: number; col: number }
// palettes.ts (existing)
type PaletteId = "pairHint" | "gradient" | "pastel";
const PALETTES: Record<PaletteId, Record<number, { bg: string; text: string }>>;
```

Produces (exported from `src/boardRenderer.ts`; plans #2/#3 call these names):
```ts
export const ELIM_HIGHLIGHT_MS = 400;
export const ELIM_FADE_MS = 200;
export const MOVE_DURATION_MS = 150;
export const SPAWN_DELAY_MS = 350;
export const SPAWN_DURATION_MS = 400;

export function c2StartMs(totalGroups: number): number;
export function totalElimMs(totalGroups: number): number;
export function buildElimPhaseState(
  eliminatedPairs: EliminatedPair[], prevGrid: GameGrid, direction: Direction, startTime: number,
): ElimPhaseState;

export interface BoardRendererOptions {
  canvas: HTMLCanvasElement;
  gridSize: number;
  getPalette: () => PaletteId;
}

export class BoardRenderer {
  constructor(options: BoardRendererOptions);
  get isEliminating(): boolean;
  reset(): void;
  beginElimination(eliminatedPairs: EliminatedPair[], prevGrid: GameGrid, direction: Direction, now?: number): void;
  beginSpawn(spawned: CellPosition[]): void;
  beginSlide(spawned: CellPosition[], moved: CellPosition[], direction: Direction): void;
  advance(now: number, onEliminationComplete: () => void): boolean; // true = request another frame
  draw(grid: GameGrid, now?: number): void;
}
// plus exported types PhantomTile, PhantomGroup, SurvivorCell, ElimPhaseState, RecompactCell
```

Usage contract for a mode: create one `BoardRenderer`; on a slide with eliminations call `beginElimination(...)` (input must then be ignored while `isEliminating`), deferring the spawn until `advance`'s callback fires; on a slide without eliminations call `beginSlide(...)`; call `advance(performance.now(), cb)` then `draw(grid)` every animation frame while `advance` returns true; call `reset()` when the board is replaced wholesale. The renderer holds no game rules and never touches the DOM other than the canvas. Known limitation (handled in plan #3): `draw` indexes `PALETTES[palette][value]`, so it only supports tile values 1-9 until a cell-drawing hook for `0`/`STONE`/frozen cells is added.

- [x] **Step 1.1: Record the green baseline (before touching anything)**

Run from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`:
```bash
npm run test:unit
npx playwright test tests/e2e/merge-animation.spec.ts tests/e2e/visual-effects.spec.ts
npx tsc --noEmit
```
Expected: unit `Tests  195 passed (195)`; e2e `6 passed`; `tsc` prints nothing. If anything is red, STOP and report; do not start the refactor on a red baseline.

- [x] **Step 1.2: Write the characterization test (fails first because the module does not exist)**

Create `workspace/tests/unit/boardRenderer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { slide, type GameGrid } from "../../src/grid";
import {
  buildElimPhaseState,
  c2StartMs,
  totalElimMs,
  MOVE_DURATION_MS,
} from "../../src/boardRenderer";

describe("elimination timing helpers", () => {
  it("c2StartMs = one move phase + one highlight/fade slot (600ms) per group", () => {
    expect(c2StartMs(0)).toBe(MOVE_DURATION_MS);
    expect(c2StartMs(1)).toBe(750);
    expect(c2StartMs(2)).toBe(1350);
  });

  it("totalElimMs adds the second compaction move after c2Start", () => {
    expect(totalElimMs(1)).toBe(900);
    expect(totalElimMs(2)).toBe(1500);
  });
});

describe("buildElimPhaseState", () => {
  it("one pair sliding left produces one phantom group and no survivors", () => {
    const grid: GameGrid = [
      [9, 1, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "left");
    const phase = buildElimPhaseState(outcome.eliminatedPairs, grid, "left", 1234);

    expect(phase.startTime).toBe(1234);
    expect(phase.survivorCells).toEqual([]);
    expect(phase.groups).toHaveLength(1);
    expect(phase.groups[0].groupIndex).toBe(0);
    expect(phase.groups[0].tiles).toEqual([
      { origRow: 0, origCol: 0, firstCompactRow: 0, firstCompactCol: 0, value: 9 },
      { origRow: 0, origCol: 1, firstCompactRow: 0, firstCompactCol: 1, value: 1 },
    ]);
  });

  it("tracks survivors through both compaction passes: [3,9,1,5] left", () => {
    const grid: GameGrid = [
      [3, 9, 1, 5],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "left");
    const phase = buildElimPhaseState(outcome.eliminatedPairs, grid, "left", 0);

    expect(phase.survivorCells).toEqual([
      { origRow: 0, origCol: 0, firstCompactRow: 0, firstCompactCol: 0, finalRow: 0, finalCol: 0 },
      { origRow: 0, origCol: 3, firstCompactRow: 0, firstCompactCol: 3, finalRow: 0, finalCol: 1 },
    ]);
  });

  it("mirrors indices for a right slide: [5,9,1,3] right", () => {
    const grid: GameGrid = [
      [5, 9, 1, 3],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const outcome = slide(grid, "right");
    const phase = buildElimPhaseState(outcome.eliminatedPairs, grid, "right", 0);

    expect(phase.survivorCells).toEqual([
      { origRow: 0, origCol: 3, firstCompactRow: 0, firstCompactCol: 3, finalRow: 0, finalCol: 3 },
      { origRow: 0, origCol: 0, firstCompactRow: 0, firstCompactCol: 0, finalRow: 0, finalCol: 2 },
    ]);
  });
});
```

- [x] **Step 1.3: Run it and see it fail**

```bash
npx vitest run tests/unit/boardRenderer.test.ts
```
Expected: FAIL with `Failed to resolve import "../../src/boardRenderer"` (module not found).

- [x] **Step 1.4: Create `workspace/src/boardRenderer.ts`**

The drawing and timing code below is a verbatim move of the code in `game.ts` (`lerp`, `HF_MS`, `c2StartMs`, `totalElimMs`, `buildElimPhaseState`, `drawPhantomTile`, `drawBaseTile`, the tile/phantom drawing in `render`, and the animation bookkeeping in `tick`), with module state turned into private class fields.

```ts
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
```

- [x] **Step 1.5: Run the characterization test and see it pass**

```bash
npx vitest run tests/unit/boardRenderer.test.ts
```
Expected: `Tests  5 passed (5)`.

- [x] **Step 1.6: Rewire `workspace/src/game.ts` to use the renderer**

Apply edits E1 to E10 in the order listed (bottom of the file to the top) so that the original line numbers stay valid. "Replace original lines A-B" means: delete those lines and put the given text in their place; "Delete" means remove those lines only. Confirm each range by reading it before replacing. After the edits, add the import described in E11.

**E1** (`setState`). Replace original lines 1047-1052 with:
```ts
  state = newState;
  board.reset();
  spawnPending = false;
```

**E2** (`handleKeydown`, no-elimination branch). Replace original lines 903-910 with:
```ts
    board.beginSlide(spawnedList, movedList, direction);
```

**E3** (`handleKeydown`, elimination branch: `const now = performance.now();` through `moveCells.clear();`). Replace original lines 858-872 with:
```ts
    board.beginElimination(eliminatedPairs, prevGrid, direction);
    spawnPending = true;
```

**E4** (`handleKeydown` guard `if (eliminationPhase !== null) return;`). Replace original line 816 with:
```ts
  if (board.isEliminating) return;
```

**E5** (`tick`). Replace original lines 761-803 with:
```ts
function tick(): void {
  const stillAnimating = board.advance(performance.now(), finalizeDeferredSlide);

  render();

  if (stillAnimating) {
    animationFrameId = requestAnimationFrame(tick);
  } else {
    animationFrameId = null;
  }
}
```

**E6** (`drawBaseTile` and `render`; the range is exactly those two functions, keep the blank lines at 464 and 652). Replace original lines 465-651 with:
```ts
function render(): void {
  board.draw(state.grid);

  if (!board.isEliminating) {
    const gameOver = isGameOver(state.grid);
    gameOverEl.hidden = !gameOver;
    if (gameOver) {
      gameOverScoreEl.textContent = `本次分數：${state.score}`;
      gameOverBestEl.textContent = `最高分：${bestScore}`;
      gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
    }
  }
}
```

**E7** (`finalizeDeferredSlide`: the `spawnCells.clear(); spawnedList.forEach(...)` tail; keep the closing `}` at 463). Replace original lines 459-462 with:
```ts
  board.beginSpawn(spawnedList);
```

**E8** (`lerp`, `HF_MS`, `c2StartMs`, `totalElimMs`, `buildElimPhaseState`, `drawPhantomTile`; keep `finalizeDeferredSlide`, which starts at 442). Delete original lines 333-441.

**E9** (`spawnCells`, `moveCells`, the animation interfaces, `eliminationPhase`, `spawnPending`, `recompactCells`). Replace original lines 287-329 with:
```ts
let spawnPending = false;
const board = new BoardRenderer({
  canvas,
  gridSize: GRID_SIZE,
  getPalette: () => currentPalette,
});
```

**E10a** (the unused `ctx` constant). Delete original line 47.

**E10b** (`ELIM_HIGHLIGHT_MS`, `ELIM_FADE_MS`, `MOVE_DURATION_MS`, `SPAWN_DELAY_MS`, `SPAWN_DURATION_MS`). Delete original lines 37-41.

**E10c** (`  PALETTES,` in the palettes import). Delete original line 13.

**E10d** (`  type GameGrid,` in the grid import). Delete original line 8.


**E11 (imports).** Directly after the existing line `import { checkTrophies, loadModalData, getTrophyDef } from "./trophies";` add:
```ts
import { BoardRenderer } from "./boardRenderer";
```

What E10 removed, for orientation: the `GameGrid` and `PALETTES` imports (only the deleted functions used them), the five `ELIM_*`/`MOVE_*`/`SPAWN_*` timing constants (now exported from `boardRenderer.ts`), and the unused `ctx` constant (line 47). `canvas` stays because `game.ts` still reads `canvas.width`, `getBoundingClientRect()` and styles it.

What stays in `game.ts` on purpose: `spawnPending` and `finalizeDeferredSlide` (game rules and side effects: spawn, game-over audio, trophies), the `window.__lastAnimationHints` writes, the game-over overlay update inside `render()`, and `startAnimationLoop`/`animationFrameId`.

- [x] **Step 1.7: Verify structure and behavior after the refactor**

```bash
npx tsc --noEmit
npm run test:unit
npx playwright test tests/e2e/merge-animation.spec.ts tests/e2e/visual-effects.spec.ts
npm run build
grep -n "spawnCells\|moveCells\|recompactCells\|eliminationPhase\|drawBaseTile\|drawPhantomTile\|SPAWN_DELAY_MS\|MOVE_DURATION_MS" src/game.ts
```
Expected: `tsc` prints nothing; unit `Tests  200 passed (200)`; e2e `6 passed`; build succeeds; the final `grep` prints nothing (no animation state or drawing helpers left in `game.ts`). If the e2e specs fail, compare behavior against Step 1.1, fix the renderer, do not weaken tests.

- [x] **Step 1.8: Commit**

Run from `/Users/kyo.lai82/Projects/Personal/game-factory`:
```bash
git add workspace/src/boardRenderer.ts workspace/src/game.ts workspace/tests/unit/boardRenderer.test.ts
git commit -m "$(cat <<'EOF'
refactor(merge10): extract board drawing and animation into boardRenderer

Structure-only move out of game.ts so a second mode can drive the same
board animations. Endless mode behavior is unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

**Execution notes (batch 1):** commit c9e0832. Unit 200 passed, animation e2e 6 passed, tsc clean, build ok, grep for animation state in game.ts empty. No deviations.

---

### Task 2: `STONE` constant and `canPair` in `grid.ts`

**Files:**
- Modify: `workspace/src/grid.ts` (lines 1-2 header; line 58 inside `slideRowLeft`)
- Create: `workspace/tests/unit/gridStone.test.ts`

**Interfaces:**

Consumes: `slideRowLeft(row: Cell[]): SlideResult`, `slide(grid, direction)` (existing); `CellPosition` from `./gridDiff` (type-only import, no runtime cycle).

Produces (exported from `src/grid.ts`):
```ts
export const STONE: number;                             // -1
export function canPair(a: number, b: number): boolean; // false if either is STONE; else a + b === 10
```
Pairing analysis (done while writing this plan): `slideRowLeft` pairs consecutive values with `current + next === 10`. `0` can never pair with 1-9 (max sum 9). `STONE = -1` could only reach 10 with an 11, which never exists, but `canPair` makes the exclusion explicit so it cannot regress. `Cell = number | null` is used as-is by all existing callers (`null` = empty, filtered by `cell !== null`), and `STONE` is non-null so stones are compacted and moved like tiles.

- [x] **Step 2.1: Write the failing test**

Create `workspace/tests/unit/gridStone.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE, canPair, slideRowLeft, slide, createEmptyGrid } from "../../src/grid";

describe("STONE", () => {
  it("is a negative number so it cannot collide with tile values 1-9 or 0", () => {
    expect(typeof STONE).toBe("number");
    expect(STONE).toBeLessThan(0);
  });

  it("canPair is true only for non-stone values summing to 10", () => {
    expect(canPair(4, 6)).toBe(true);
    expect(canPair(9, 1)).toBe(true);
    expect(canPair(5, 4)).toBe(false);
    expect(canPair(STONE, STONE)).toBe(false);
    for (let v = 0; v <= 10; v++) {
      expect(canPair(STONE, v)).toBe(false);
      expect(canPair(v, STONE)).toBe(false);
    }
  });

  it("0 never pairs with a tile 1-9", () => {
    for (let v = 1; v <= 9; v++) {
      expect(canPair(0, v)).toBe(false);
      expect(canPair(v, 0)).toBe(false);
    }
  });

  it("slideRowLeft never eliminates a stone, whatever sits next to it", () => {
    for (let v = 0; v <= 9; v++) {
      expect(slideRowLeft([STONE, v, null, null]).eliminatedIndices).toHaveLength(0);
      expect(slideRowLeft([v, STONE, null, null]).eliminatedIndices).toHaveLength(0);
    }
  });

  it("a stone sitting between 4 and 6 blocks their pairing", () => {
    const result = slideRowLeft([4, STONE, 6, null]);
    expect(result.row).toEqual([4, STONE, 6, null]);
    expect(result.moved).toBe(false);
    expect(result.scoreGained).toBe(0);
  });

  it("a stone moves with slides like a tile", () => {
    expect(slideRowLeft([null, STONE, null, 5]).row).toEqual([STONE, 5, null, null]);

    const grid = createEmptyGrid(4);
    grid[0][3] = STONE;
    const down = slide(grid, "down");
    expect(down.grid[3][3]).toBe(STONE);
    expect(down.grid[0][3]).toBeNull();
    expect(down.moved).toBe(true);
  });

  it("other pairs on the same row still merge around a stone", () => {
    const result = slideRowLeft([STONE, 5, 5, null]);
    expect(result.row).toEqual([STONE, null, null, null]);
    expect(result.scoreGained).toBe(10);
  });
});
```

- [x] **Step 2.2: Run it and see it fail**

```bash
npx vitest run tests/unit/gridStone.test.ts
```
Expected: FAIL (`canPair is not a function`, and `STONE` is `undefined`).

- [x] **Step 2.3: Implement**

In `workspace/src/grid.ts`, replace lines 1-2:
```ts
export type Cell = number | null;
export type GameGrid = Cell[][];
```
with:
```ts
import type { CellPosition } from "./gridDiff";

export type Cell = number | null;
export type GameGrid = Cell[][];

/**
 * Special cell value for a stone. It is a plain number so Cell stays
 * `number | null`, but it is negative so it can never be a tile value (1-9)
 * or a 0-tile, and `canPair` refuses to pair it with anything.
 */
export const STONE = -1;

/**
 * Whether two adjacent cell values eliminate each other (sum to 10).
 * A stone never pairs with anything. 0 + (1..9) is never 10, so 0 never pairs either.
 */
export function canPair(a: number, b: number): boolean {
  return a !== STONE && b !== STONE && a + b === 10;
}
```

Then in `slideRowLeft` (original line 58), replace the condition
```ts
    if (next !== undefined && current + next === 10) {
```
with
```ts
    if (next !== undefined && canPair(current, next)) {
```

- [x] **Step 2.4: Run and see it pass**

```bash
npx vitest run tests/unit/gridStone.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `7 passed`; full unit `Tests  207 passed (207)`; `tsc` clean (all pre-existing grid tests still pass, proving no behavior change).

- [x] **Step 2.5: Commit**

```bash
git add workspace/src/grid.ts workspace/tests/unit/gridStone.test.ts
git commit -m "$(cat <<'EOF'
feat(merge10): add STONE cell value and canPair to grid

Stones move with slides but never pair with any value.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

**Execution notes (batch 1):** commit ffe9a12. Unit 207 passed, tsc clean. No deviations.

---

### Task 3: Frozen-cell mask for `slide`, `canMove`, `isGameOver`

Spec §3.4: frozen cells cannot move, act as walls when sliding, and can still take part in elimination. The mask is board-shaped booleans; the remaining-turns counter lives in adventure state (plan #2), which converts to a boolean mask before calling.

Semantics implemented (plan #2 tests rely on these):
- A frozen cell holding a tile is a wall; a mask `true` on a `null` cell is ignored.
- Runs of cells between walls compact and merge independently, exactly like `slideRowLeft`.
- A wall is eliminated by (a) the first tile of the run on its far side after the run compacts against it, or (b) the last tile of the run on its near side when that run is completely full, i.e. already touching it. Left-to-right processing means a wall consumed by the left run cannot also pair with the right run.
- Two adjacent frozen cells never eliminate each other.
- Eliminated pairs use the same `EliminatedPair` shape; a consumed wall appears as `a` or `b`, so callers can clear that mask cell by checking the pair coordinates.

**Files:**
- Modify: `workspace/src/grid.ts` (add after `slideRowLeft`, original line 75; replace `applySlideRowLeftToGrid` through `isGameOver`, original lines 86-167)
- Create: `workspace/tests/unit/gridFrozen.test.ts`

**Interfaces:**

Consumes: `canPair`, `STONE` (Task 2), `SlideResult`, `SlideOutcome`, `EliminatedPair`, `Direction` (existing).

Produces (exported from `src/grid.ts`):
```ts
export type FrozenMask = boolean[][];
export function slideRowLeftFrozen(row: Cell[], frozenRow: boolean[]): SlideResult;
export function slide(grid: GameGrid, direction: Direction, frozen?: FrozenMask): SlideOutcome;
export function canMove(grid: GameGrid, frozen?: FrozenMask): boolean;
export function isGameOver(grid: GameGrid, frozen?: FrozenMask): boolean;
```

- [x] **Step 3.1: Write the failing test**

Create `workspace/tests/unit/gridFrozen.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  createEmptyGrid,
  slide,
  canMove,
  isGameOver,
  type Direction,
  type FrozenMask,
  type GameGrid,
} from "../../src/grid";

function emptyMask(size = 4): FrozenMask {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => false));
}

function maskWith(...cells: Array<[number, number]>): FrozenMask {
  const mask = emptyMask();
  cells.forEach(([row, col]) => {
    mask[row][col] = true;
  });
  return mask;
}

describe("slide with a frozen mask", () => {
  it("a frozen tile does not move and tiles stop against it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, 3, null, 5];
    const outcome = slide(grid, "left", maskWith([0, 1]));
    expect(outcome.grid[0]).toEqual([null, 3, 5, null]);
    expect(outcome.moved).toBe(true);
    expect(outcome.scoreGained).toBe(0);
  });

  it("a frozen tile can be eliminated by a tile sliding up against it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, 4, null, 6];
    const outcome = slide(grid, "left", maskWith([0, 1]));
    expect(outcome.grid[0]).toEqual([null, null, null, null]);
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 1 },
        b: { row: 0, col: 3 },
        meetA: { row: 0, col: 1 },
        meetB: { row: 0, col: 2 },
      },
    ]);
  });

  it("a frozen tile can be eliminated by a full run already touching it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [2, 6, 4, null];
    const outcome = slide(grid, "left", maskWith([0, 2]));
    expect(outcome.grid[0]).toEqual([2, null, null, null]);
    expect(outcome.scoreGained).toBe(10);
    expect(outcome.eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 1 },
        b: { row: 0, col: 2 },
        meetA: { row: 0, col: 1 },
        meetB: { row: 0, col: 2 },
      },
    ]);
  });

  it("a gap between a tile and the frozen wall prevents a left-side pairing", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [6, null, 4, null];
    const outcome = slide(grid, "left", maskWith([0, 2]));
    expect(outcome.grid[0]).toEqual([6, null, 4, null]);
    expect(outcome.moved).toBe(false);
  });

  it("works vertically: up eliminates a frozen tile at the top", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[3][0] = 9;
    const outcome = slide(grid, "up", maskWith([0, 0]));
    expect(outcome.grid).toEqual(createEmptyGrid(4));
    expect(outcome.eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 0 },
        b: { row: 3, col: 0 },
        meetA: { row: 0, col: 0 },
        meetB: { row: 1, col: 0 },
      },
    ]);
  });

  it("sliding down toward a frozen tile at the top does nothing for a bottom tile", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[3][0] = 9;
    const outcome = slide(grid, "down", maskWith([0, 0]));
    expect(outcome.moved).toBe(false);
    expect(outcome.grid).toEqual(grid);
  });

  it("works to the right: a frozen tile at the right edge stays put", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[1] = [3, null, null, 8];
    const outcome = slide(grid, "right", maskWith([1, 3]));
    expect(outcome.grid[1]).toEqual([null, null, 3, 8]);
  });

  it("a mask entry on an empty cell is ignored", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, null, 5, null];
    const outcome = slide(grid, "left", maskWith([0, 1]));
    expect(outcome.grid[0]).toEqual([5, null, null, null]);
  });

  it("two adjacent frozen tiles never eliminate each other", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [4, 6, null, null];
    const outcome = slide(grid, "left", maskWith([0, 0], [0, 1]));
    expect(outcome.grid[0]).toEqual([4, 6, null, null]);
    expect(outcome.scoreGained).toBe(0);
  });

  it("does not mutate the input grid or mask", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [null, 4, null, 6];
    const mask = maskWith([0, 1]);
    slide(grid, "left", mask);
    expect(grid[0]).toEqual([null, 4, null, 6]);
    expect(mask[0][1]).toBe(true);
  });

  it("an all-false mask behaves exactly like no mask (seeded random grids)", () => {
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const directions: Direction[] = ["up", "down", "left", "right"];
    for (let n = 0; n < 200; n++) {
      const grid: GameGrid = createEmptyGrid(4).map((row) =>
        row.map(() => (next() < 0.4 ? null : Math.floor(next() * 9) + 1)),
      );
      directions.forEach((direction) => {
        expect(slide(grid, direction, emptyMask())).toEqual(slide(grid, direction));
      });
    }
  });
});

describe("canMove / isGameOver with a frozen mask", () => {
  it("a lone frozen tile cannot move, so the board is stuck", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 5;
    expect(canMove(grid)).toBe(true);
    expect(canMove(grid, maskWith([0, 0]))).toBe(false);
    expect(isGameOver(grid, maskWith([0, 0]))).toBe(true);
    expect(isGameOver(grid)).toBe(false);
  });
});
```

- [x] **Step 3.2: Run it and see it fail**

```bash
npx vitest run tests/unit/gridFrozen.test.ts
```
Expected: FAIL (the mask argument is ignored, so most cases fail their assertions).

- [x] **Step 3.3: Implement**

In `workspace/src/grid.ts`:

1. Insert the following block immediately after the closing brace of `slideRowLeft` (and before `export type Direction`):
```ts
/**
 * Frozen-cell mask, same shape as the grid: `mask[row][col] === true` means the
 * cell is frozen. A frozen cell that holds a tile is a wall for slides: it does
 * not move and tiles do not move through it. A mask entry on an empty (null)
 * cell is ignored. Frozen cells can still be eliminated, see `slideRowLeftFrozen`.
 */
export type FrozenMask = boolean[][];

/**
 * Slide one row left with frozen cells acting as walls.
 *
 * - Each run of non-wall cells between walls compacts and merges independently,
 *   exactly like `slideRowLeft`.
 * - A wall (frozen tile) can be eliminated by a tile that ends up adjacent to it:
 *   the first tile of the run on its right (it slides up against the wall), or
 *   the last tile of the run on its left when that run is completely full
 *   (already touching the wall). The wall is processed left to right, so a wall
 *   consumed by the run on its left cannot also pair with the run on its right.
 * - Two frozen cells next to each other never eliminate each other (neither moves).
 */
export function slideRowLeftFrozen(row: Cell[], frozenRow: boolean[]): SlideResult {
  const size = row.length;
  const isWall = (index: number): boolean => frozenRow[index] === true && row[index] !== null;
  const out: Cell[] = [...row];
  const consumed = new Set<number>();
  const eliminatedIndices: Array<[number, number, number, number]> = [];
  let scoreGained = 0;

  let index = 0;
  while (index < size) {
    if (isWall(index)) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < size && !isWall(index)) index += 1;
    const end = index;
    const segmentLength = end - start;

    const entries: Array<{ value: number; from: number }> = [];
    for (let i = start; i < end; i++) {
      const cell = row[i];
      if (cell !== null) entries.push({ value: cell, from: i });
    }

    const headIndex = start - 1;
    const headValue =
      headIndex >= 0 && !consumed.has(headIndex) ? (row[headIndex] as number) : null;

    let next = 0;
    if (headValue !== null && entries.length > 0 && canPair(headValue, entries[0].value)) {
      scoreGained += 10;
      eliminatedIndices.push([headIndex, entries[0].from, headIndex, start]);
      consumed.add(headIndex);
      out[headIndex] = null;
      next = 1;
    }

    const merged: Array<{ value: number; from: number }> = [];
    while (next < entries.length) {
      const current = entries[next];
      const following = entries[next + 1];
      if (following !== undefined && canPair(current.value, following.value)) {
        scoreGained += 10;
        const meetA = start + merged.length;
        eliminatedIndices.push([current.from, following.from, meetA, meetA + 1]);
        next += 2;
      } else {
        merged.push(current);
        next += 1;
      }
    }

    if (end < size && merged.length > 0 && merged.length === segmentLength) {
      const last = merged[merged.length - 1];
      const wallValue = row[end] as number;
      if (canPair(last.value, wallValue)) {
        scoreGained += 10;
        eliminatedIndices.push([last.from, end, end - 1, end]);
        consumed.add(end);
        out[end] = null;
        merged.pop();
      }
    }

    for (let i = 0; i < segmentLength; i++) {
      out[start + i] = merged[i] !== undefined ? merged[i].value : null;
    }
  }

  const moved = row.some((cell, i) => cell !== out[i]);
  return { row: out, moved, scoreGained, eliminatedIndices };
}
```

2. Replace everything from `function applySlideRowLeftToGrid` through the end of `isGameOver` (original lines 86-167, i.e. up to but not including `export type Rng`) with:
```ts
function applySlideRowLeftToGrid(grid: GameGrid, frozen?: FrozenMask): SlideOutcome {
  let moved = false;
  let scoreGained = 0;
  const eliminatedPairs: EliminatedPair[] = [];

  const resultGrid = grid.map((row, rowIndex) => {
    const result = frozen
      ? slideRowLeftFrozen(row, frozen[rowIndex] ?? [])
      : slideRowLeft(row);
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

function reverseRows<T>(grid: T[][]): T[][] {
  return grid.map((row) => [...row].reverse());
}

function transpose<T>(grid: T[][]): T[][] {
  const size = grid.length;
  return Array.from({ length: size }, (_, col) =>
    Array.from({ length: size }, (_, row) => grid[row][col])
  );
}

export function slide(grid: GameGrid, direction: Direction, frozen?: FrozenMask): SlideOutcome {
  const size = grid.length;

  switch (direction) {
    case "left": {
      return applySlideRowLeftToGrid(grid, frozen);
    }
    case "right": {
      const outcome = applySlideRowLeftToGrid(
        reverseRows(grid),
        frozen && reverseRows(frozen),
      );
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.row, col: size - 1 - a.col },
        b: { row: b.row, col: size - 1 - b.col },
        meetA: { row: meetA.row, col: size - 1 - meetA.col },
        meetB: { row: meetB.row, col: size - 1 - meetB.col },
      }));
      return { ...outcome, grid: reverseRows(outcome.grid), eliminatedPairs: pairs };
    }
    case "up": {
      const outcome = applySlideRowLeftToGrid(
        transpose(grid),
        frozen && transpose(frozen),
      );
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.col, col: a.row },
        b: { row: b.col, col: b.row },
        meetA: { row: meetA.col, col: meetA.row },
        meetB: { row: meetB.col, col: meetB.row },
      }));
      return { ...outcome, grid: transpose(outcome.grid), eliminatedPairs: pairs };
    }
    case "down": {
      const outcome = applySlideRowLeftToGrid(
        reverseRows(transpose(grid)),
        frozen && reverseRows(transpose(frozen)),
      );
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

export function canMove(grid: GameGrid, frozen?: FrozenMask): boolean {
  const directions: Direction[] = ["up", "down", "left", "right"];
  return directions.some((direction) => slide(grid, direction, frozen).moved);
}

export function isGameOver(grid: GameGrid, frozen?: FrozenMask): boolean {
  return !canMove(grid, frozen);
}
```

`slideRowLeft` is untouched by this step, and when `frozen` is `undefined` `applySlideRowLeftToGrid` still calls it, so the no-mask path is the old logic.

- [x] **Step 3.4: Run and see it pass**

```bash
npx vitest run tests/unit/gridFrozen.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `12 passed`; full unit `Tests  219 passed (219)`; `tsc` clean.

- [x] **Step 3.5: Commit**

```bash
git add workspace/src/grid.ts workspace/tests/unit/gridFrozen.test.ts
git commit -m "$(cat <<'EOF'
feat(merge10): optional frozen-cell mask for slide, canMove and isGameOver

Frozen tiles act as walls but can still be eliminated. Omitting the mask
keeps the original code path.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

**Execution notes (batch 1):** commit 9c5d85a. Unit 219 passed, tsc clean, full e2e 54 passed, build ok. No deviations.

---

### Task 4: Complement-bias spawn strategy for `spawnRandomTile`

Spec §4.1: when empty cells < 4, 50% chance to spawn `10 - neighbour` adjacent to that neighbour. The 補數護符 relic (spec §7) later passes `{ emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 }`: 30% at any empty count, and the higher of the two when both apply.

rng contract (plan #2 tests depend on it): with no strategy, or when the effective chance is 0, rng is consumed exactly as before (cell pick, then value). With a chance > 0: one roll (`rng() < chance`); if it hits and a complement spawn is possible, one more call picks among the options; if the roll misses or no option exists (no empty cell touches a numeric 1-9 tile; stones and 0 are ignored), the plain spawn runs next (cell pick, then value).

**Files:**
- Modify: `workspace/src/grid.ts` (replace `spawnRandomTile`, original lines 171-193; locate by name)
- Create: `workspace/tests/unit/gridSpawnStrategy.test.ts`

**Interfaces:**

Consumes: `Cell`, `GameGrid`, `Rng` (existing).

Produces (exported from `src/grid.ts`):
```ts
export interface SpawnStrategy {
  emptyThreshold: number;     // "low-space" when emptyCount < emptyThreshold
  probability: number;        // chance when low-space
  baseProbability?: number;   // chance otherwise (default 0); when both apply the higher wins
}
export const COMPLEMENT_BIAS: SpawnStrategy;  // { emptyThreshold: 4, probability: 0.5 }
export function spawnRandomTile(grid: GameGrid, rng?: Rng, strategy?: SpawnStrategy): GameGrid;
```

- [ ] **Step 4.1: Write the failing test**

Create `workspace/tests/unit/gridSpawnStrategy.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  spawnRandomTile,
  createEmptyGrid,
  STONE,
  COMPLEMENT_BIAS,
  type GameGrid,
  type SpawnStrategy,
} from "../../src/grid";

/** rng that returns the scripted values in order, then 0 forever. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

// 3 empty cells (all in row 3). Complement options, in contract order:
// (3,1)<-up 1 => 9, (3,1)<-left 4 => 6, (3,2)<-up 2 => 8, (3,3)<-up 3 => 7
const threeEmpty: GameGrid = [
  [5, 1, 2, 3],
  [4, 6, 7, 8],
  [9, 1, 2, 3],
  [4, null, null, null],
];

// 4 empty cells in row 0, each with a numeric neighbour below: 5, 1, 2, 3
const fourEmpty: GameGrid = [
  [null, null, null, null],
  [5, 1, 2, 3],
  [4, 6, 7, 8],
  [9, 1, 2, 3],
];

describe("COMPLEMENT_BIAS", () => {
  it("matches spec 4.1: fewer than 4 empty cells, 50%", () => {
    expect(COMPLEMENT_BIAS).toEqual({ emptyThreshold: 4, probability: 0.5 });
  });
});

describe("spawnRandomTile without a strategy", () => {
  it("is unchanged: two rng calls (cell, value)", () => {
    expect(spawnRandomTile(fourEmpty, scripted(0, 0))[0][0]).toBe(1);
    expect(spawnRandomTile(fourEmpty, scripted(0.99, 0.99))[0][3]).toBe(9);
  });
});

describe("spawnRandomTile with complement bias", () => {
  it("below the threshold and roll < probability: spawns 10 - neighbour next to it", () => {
    const first = spawnRandomTile(threeEmpty, scripted(0.1, 0), COMPLEMENT_BIAS);
    expect(first[3][1]).toBe(9);

    const last = spawnRandomTile(threeEmpty, scripted(0.3, 0.99), COMPLEMENT_BIAS);
    expect(last[3][3]).toBe(7);

    const second = spawnRandomTile(threeEmpty, scripted(0.3, 0.25), COMPLEMENT_BIAS);
    expect(second[3][1]).toBe(6);
  });

  it("the spawned tile is always adjacent to a neighbour that sums to 10 with it", () => {
    for (const pick of [0, 0.25, 0.5, 0.75, 0.99]) {
      const result = spawnRandomTile(threeEmpty, scripted(0, pick), COMPLEMENT_BIAS);
      const spawned: Array<[number, number]> = [];
      result.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell !== null && threeEmpty[r][c] === null) spawned.push([r, c]);
        }),
      );
      expect(spawned).toHaveLength(1);
      const [r, c] = spawned[0];
      const value = result[r][c] as number;
      const neighbours = [result[r - 1]?.[c], result[r + 1]?.[c], result[r][c - 1], result[r][c + 1]];
      expect(neighbours.some((n) => typeof n === "number" && n + value === 10)).toBe(true);
    }
  });

  it("below the threshold but roll >= probability: falls back to the plain spawn", () => {
    const result = spawnRandomTile(threeEmpty, scripted(0.7, 0, 0), COMPLEMENT_BIAS);
    expect(result[3][1]).toBe(1);
  });

  it("at or above the threshold the bias is off and consumes no extra rng value", () => {
    const result = spawnRandomTile(fourEmpty, scripted(0, 0), COMPLEMENT_BIAS);
    expect(result[0][0]).toBe(1); // plain spawn; bias would have produced 10 - 5 = 5
  });

  it("falls back to the plain spawn when no empty cell touches a numeric tile", () => {
    const grid = createEmptyGrid(4);
    const strategy: SpawnStrategy = { emptyThreshold: 100, probability: 1 };
    const result = spawnRandomTile(grid, scripted(0, 0, 0.99), strategy);
    expect(result[0][0]).toBe(9);
  });

  it("ignores stones and 0 as neighbours", () => {
    const grid: GameGrid = [
      [STONE, null],
      [0, null],
    ];
    const strategy: SpawnStrategy = { emptyThreshold: 100, probability: 1 };
    const result = spawnRandomTile(grid, scripted(0, 0, 0), strategy);
    expect(result[0][1]).toBe(1);
  });

  it("baseProbability (relic) applies above the threshold", () => {
    const relic: SpawnStrategy = { emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 };
    expect(spawnRandomTile(fourEmpty, scripted(0.2, 0), relic)[0][0]).toBe(5);
    expect(spawnRandomTile(fourEmpty, scripted(0.4, 0, 0), relic)[0][0]).toBe(1);
  });

  it("below the threshold the higher of probability and baseProbability wins", () => {
    const relic: SpawnStrategy = { emptyThreshold: 4, probability: 0.5, baseProbability: 0.3 };
    expect(spawnRandomTile(threeEmpty, scripted(0.4, 0), relic)[3][1]).toBe(9);
    expect(spawnRandomTile(threeEmpty, scripted(0.6, 0, 0), relic)[3][1]).toBe(1);
  });

  it("returns the same grid object when there is no empty cell", () => {
    const full: GameGrid = [[1, 2], [3, 4]];
    expect(spawnRandomTile(full, scripted(0), COMPLEMENT_BIAS)).toBe(full);
  });

  it("does not mutate the input grid", () => {
    const before = JSON.stringify(threeEmpty);
    spawnRandomTile(threeEmpty, scripted(0, 0), COMPLEMENT_BIAS);
    expect(JSON.stringify(threeEmpty)).toBe(before);
  });
});
```

- [ ] **Step 4.2: Run it and see it fail**

```bash
npx vitest run tests/unit/gridSpawnStrategy.test.ts
```
Expected: FAIL (`COMPLEMENT_BIAS` is undefined, and the strategy argument is ignored).

- [ ] **Step 4.3: Implement**

In `workspace/src/grid.ts`, replace the whole existing `spawnRandomTile` function (from `export function spawnRandomTile(grid: GameGrid, rng: Rng = Math.random): GameGrid {` through its closing brace) with:
```ts
/**
 * Optional "complement bias" for `spawnRandomTile` (adventure-mode anti-stall layer).
 *
 * When the number of empty cells is below `emptyThreshold`, the spawn uses the
 * bias with chance `probability`; otherwise with chance `baseProbability`
 * (default 0). If both could apply the higher chance wins. A biased spawn
 * picks an empty cell that touches a numeric tile (1-9; stones and 0 do not
 * count) and spawns `10 - neighbour` there, so the new tile can pair with it.
 */
export interface SpawnStrategy {
  emptyThreshold: number;
  probability: number;
  baseProbability?: number;
}

/** Spec 4.1: fewer than 4 empty cells -> 50% complement spawn. */
export const COMPLEMENT_BIAS: SpawnStrategy = { emptyThreshold: 4, probability: 0.5 };

function biasChance(strategy: SpawnStrategy, emptyCount: number): number {
  const base = strategy.baseProbability ?? 0;
  return emptyCount < strategy.emptyThreshold ? Math.max(strategy.probability, base) : base;
}

interface PlannedSpawn {
  row: number;
  col: number;
  value: number;
}

// Order is part of the contract (tests use scripted rngs): empties in row-major
// order, neighbours in up, down, left, right order.
function complementSpawnOptions(grid: GameGrid, emptyCells: Array<[number, number]>): PlannedSpawn[] {
  const offsets: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const options: PlannedSpawn[] = [];
  emptyCells.forEach(([row, col]) => {
    offsets.forEach(([dr, dc]) => {
      const neighbour: Cell | undefined = grid[row + dr]?.[col + dc];
      if (typeof neighbour === "number" && neighbour >= 1 && neighbour <= 9) {
        options.push({ row, col, value: 10 - neighbour });
      }
    });
  });
  return options;
}

export function spawnRandomTile(
  grid: GameGrid,
  rng: Rng = Math.random,
  strategy?: SpawnStrategy,
): GameGrid {
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

  // rng call order: [bias roll (only if chance > 0)] [bias pick (only if rolled)], else cell pick, value.
  let planned: PlannedSpawn | null = null;
  if (strategy) {
    const chance = biasChance(strategy, emptyCells.length);
    if (chance > 0 && rng() < chance) {
      const options = complementSpawnOptions(grid, emptyCells);
      if (options.length > 0) {
        planned = options[Math.floor(rng() * options.length)];
      }
    }
  }

  if (planned === null) {
    const [emptyRow, emptyCol] = emptyCells[Math.floor(rng() * emptyCells.length)];
    planned = { row: emptyRow, col: emptyCol, value: Math.floor(rng() * 9) + 1 };
  }

  const { row: targetRow, col: targetCol, value } = planned;
  return grid.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      rowIndex === targetRow && colIndex === targetCol ? value : cell
    )
  );
}
```

`createInitialState` and `applyMove` call `spawnRandomTile(grid, rng)` and are unchanged.

- [ ] **Step 4.4: Run and see it pass**

```bash
npx vitest run tests/unit/gridSpawnStrategy.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `12 passed`; full unit `Tests  231 passed (231)`; `tsc` clean.

- [ ] **Step 4.5: Commit**

```bash
git add workspace/src/grid.ts workspace/tests/unit/gridSpawnStrategy.test.ts
git commit -m "$(cat <<'EOF'
feat(merge10): optional complement-bias spawn strategy for spawnRandomTile

Adventure-mode anti-stall layer; endless mode passes no strategy and is
unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Stone-break helper

Spec §3.4: a stone breaks when an orthogonally adjacent cell is eliminated this turn. Frame decision (see Risks in the plan footer): the helper is frame-agnostic; adventure mode passes the post-slide grid plus `eliminationSites(outcome.eliminatedPairs)` (every pair's `meetA`/`meetB` cell). Plan #2 may pass a different cell set without changing the helper.

**Files:**
- Modify: `workspace/src/grid.ts` (append at end of file)
- Create: `workspace/tests/unit/gridStoneBreak.test.ts`

**Interfaces:**

Consumes: `STONE`, `EliminatedPair`, `GameGrid`, `CellPosition` (from `./gridDiff`, already imported in Task 2).

Produces (exported from `src/grid.ts`):
```ts
export function eliminationSites(pairs: EliminatedPair[]): CellPosition[];
export interface StoneBreakResult { grid: GameGrid; broken: CellPosition[] }  // broken in row-major order
export function breakAdjacentStones(grid: GameGrid, eliminatedCells: CellPosition[]): StoneBreakResult;
```

- [ ] **Step 5.1: Write the failing test**

Create `workspace/tests/unit/gridStoneBreak.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  STONE,
  createEmptyGrid,
  breakAdjacentStones,
  eliminationSites,
  slide,
  type GameGrid,
} from "../../src/grid";

describe("breakAdjacentStones", () => {
  it("breaks a stone orthogonally adjacent to an eliminated cell", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][1] = STONE;
    const result = breakAdjacentStones(grid, [{ row: 0, col: 0 }]);
    expect(result.grid[0][1]).toBeNull();
    expect(result.broken).toEqual([{ row: 0, col: 1 }]);
  });

  it("checks all four directions", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][1] = STONE;
    grid[2][1] = STONE;
    grid[1][0] = STONE;
    grid[1][2] = STONE;
    const result = breakAdjacentStones(grid, [{ row: 1, col: 1 }]);
    expect(result.broken).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
    ]);
    expect(result.grid).toEqual(createEmptyGrid(4));
  });

  it("does not break diagonal stones or distant stones", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[1][1] = STONE;
    grid[3][3] = STONE;
    const result = breakAdjacentStones(grid, [{ row: 0, col: 0 }]);
    expect(result.broken).toEqual([]);
    expect(result.grid[1][1]).toBe(STONE);
    expect(result.grid[3][3]).toBe(STONE);
  });

  it("breaks a stone touching two eliminated cells only once", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][1] = STONE;
    const result = breakAdjacentStones(grid, [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ]);
    expect(result.broken).toEqual([{ row: 0, col: 1 }]);
  });

  it("leaves numeric tiles alone and does not mutate the input", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = 7;
    grid[0][1] = STONE;
    const before = JSON.stringify(grid);
    const result = breakAdjacentStones(grid, [{ row: 1, col: 1 }]);
    expect(JSON.stringify(grid)).toBe(before);
    expect(result.grid[0][0]).toBe(7);
    expect(result.broken).toEqual([{ row: 0, col: 1 }]);
  });

  it("tolerates eliminated cells outside the grid", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0][0] = STONE;
    const result = breakAdjacentStones(grid, [{ row: -5, col: 0 }, { row: 9, col: 9 }]);
    expect(result.broken).toEqual([]);
    expect(result.grid[0][0]).toBe(STONE);
  });

  it("returns no broken stones for an empty eliminated list", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[2][2] = STONE;
    const result = breakAdjacentStones(grid, []);
    expect(result.broken).toEqual([]);
    expect(result.grid[2][2]).toBe(STONE);
  });
});

describe("eliminationSites", () => {
  it("returns meetA and meetB of every pair, de-duplicated, in pair order", () => {
    const pairs = [
      {
        a: { row: 0, col: 0 },
        b: { row: 0, col: 1 },
        meetA: { row: 0, col: 0 },
        meetB: { row: 0, col: 1 },
      },
      {
        a: { row: 0, col: 2 },
        b: { row: 0, col: 3 },
        meetA: { row: 0, col: 0 },
        meetB: { row: 0, col: 1 },
      },
      {
        a: { row: 1, col: 0 },
        b: { row: 1, col: 1 },
        meetA: { row: 1, col: 0 },
        meetB: { row: 1, col: 1 },
      },
    ];
    expect(eliminationSites(pairs)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it("composes with slide: a pair that merges beside a stone breaks it", () => {
    const grid: GameGrid = createEmptyGrid(4);
    grid[0] = [9, 1, null, null];
    grid[1] = [STONE, null, null, null];
    const outcome = slide(grid, "left");
    const result = breakAdjacentStones(outcome.grid, eliminationSites(outcome.eliminatedPairs));
    expect(outcome.eliminatedPairs).toHaveLength(1);
    expect(result.broken).toEqual([{ row: 1, col: 0 }]);
    expect(result.grid[1][0]).toBeNull();
  });
});
```

- [ ] **Step 5.2: Run it and see it fail**

```bash
npx vitest run tests/unit/gridStoneBreak.test.ts
```
Expected: FAIL (`breakAdjacentStones is not a function`, `eliminationSites is not a function`).

- [ ] **Step 5.3: Implement**

Append to the end of `workspace/src/grid.ts`:
```ts

/** Cells where this turn's pairs vanished: every `meetA` and `meetB`, de-duplicated, in pair order. */
export function eliminationSites(pairs: EliminatedPair[]): CellPosition[] {
  const seen = new Set<string>();
  const sites: CellPosition[] = [];
  pairs.forEach(({ meetA, meetB }) => {
    [meetA, meetB].forEach(({ row, col }) => {
      const key = `${row},${col}`;
      if (!seen.has(key)) {
        seen.add(key);
        sites.push({ row, col });
      }
    });
  });
  return sites;
}

export interface StoneBreakResult {
  grid: GameGrid;
  /** Stones that were removed, in row-major order. */
  broken: CellPosition[];
}

/**
 * Break every stone that is orthogonally adjacent (up/down/left/right, not
 * diagonal) to at least one of `eliminatedCells`. Pure: the input grid is not
 * mutated. Cells outside the grid are ignored. Callers pass the eliminated
 * cells in the same frame as `grid` (adventure mode: the post-slide grid and
 * `eliminationSites(outcome.eliminatedPairs)`).
 */
export function breakAdjacentStones(
  grid: GameGrid,
  eliminatedCells: CellPosition[],
): StoneBreakResult {
  const offsets: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const breakKeys = new Set<string>();
  eliminatedCells.forEach(({ row, col }) => {
    offsets.forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;
      if (grid[r]?.[c] === STONE) breakKeys.add(`${r},${c}`);
    });
  });

  const broken: CellPosition[] = [];
  const next = grid.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (cell === STONE && breakKeys.has(`${rowIndex},${colIndex}`)) {
        broken.push({ row: rowIndex, col: colIndex });
        return null;
      }
      return cell;
    }),
  );
  return { grid: next, broken };
}
```

- [ ] **Step 5.4: Run and see it pass**

```bash
npx vitest run tests/unit/gridStoneBreak.test.ts && npm run test:unit && npx tsc --noEmit
```
Expected: new file `9 passed`; full unit `Tests  240 passed (240)`; `tsc` clean.

- [ ] **Step 5.5: Commit**

```bash
git add workspace/src/grid.ts workspace/tests/unit/gridStoneBreak.test.ts
git commit -m "$(cat <<'EOF'
feat(merge10): add stone-break helper and elimination sites to grid

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Pure powerup effects in `src/powerups.ts`

`src/powerups.ts` already exists (award helpers `computePlayCountAward`, `computeEliminationAward`; tested by `tests/unit/powerups.test.ts`). Add the four effects there; do not touch the existing exports. The pure functions are named `*Effect` so they do not collide with the `applyHammer`/`applyShuffle`/`applyAddOne`/`applyBomb` wrappers that remain in `game.ts` and keep all side effects (counter decrement, `savePowerups`, `audio.play`, `renderHudPowerups`, `setState`).

Behavior preserved from `game.ts`: hammer on an empty cell does nothing and spends nothing; addOne on an empty cell does nothing and spends nothing; addOne on 9 removes the tile and adds 10 score (reported as `pairCleared`, no combo multiplier); bomb always applies and clears the 5-cell cross; shuffle always applies and uses the same Fisher-Yates loop and rng call order. New (adventure-only, invisible to endless mode since stones/frozen cells never occur there): addOne refuses stones; shuffle accepts an optional frozen mask.

**Files:**
- Modify: `workspace/src/powerups.ts` (add imports at the top, append effects at the end)
- Modify: `workspace/src/game.ts` (powerups import block lines 22-28; replace `applyHammer` through `applyBomb`, lines 183-254, locate by name)
- Create: `workspace/tests/unit/powerupEffects.test.ts`

**Interfaces:**

Consumes: `STONE`, `Cell`, `GameGrid`, `FrozenMask`, `Rng` from `./grid`; `CellPosition` from `./gridDiff`.

Produces (exported from `src/powerups.ts`):
```ts
export interface PowerupResult {
  grid: GameGrid;            // new grid; same object as input when applied === false
  applied: boolean;          // false = invalid target, caller must not spend the powerup
  cleared: CellPosition[];   // cells that held something and are now empty
}
export interface AddOneResult extends PowerupResult { pairCleared: boolean } // true only for 9 -> removed (10 points)
export function hammerEffect(grid: GameGrid, row: number, col: number): PowerupResult;
export function shuffleEffect(grid: GameGrid, rng: Rng, frozen?: FrozenMask): PowerupResult;
export function addOneEffect(grid: GameGrid, row: number, col: number): AddOneResult;
export function bombEffect(grid: GameGrid, row: number, col: number): PowerupResult;
```

- [ ] **Step 6.1: Write the failing test**

Create `workspace/tests/unit/powerupEffects.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  hammerEffect,
  shuffleEffect,
  addOneEffect,
  bombEffect,
} from "../../src/powerups";
import { STONE, createEmptyGrid, type FrozenMask, type GameGrid } from "../../src/grid";

function sample(): GameGrid {
  return [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 1, 2, 3],
    [4, 5, 6, 7],
  ];
}

describe("hammerEffect", () => {
  it("clears the target cell and reports it", () => {
    const grid = sample();
    const result = hammerEffect(grid, 1, 2);
    expect(result.applied).toBe(true);
    expect(result.grid[1][2]).toBeNull();
    expect(result.cleared).toEqual([{ row: 1, col: 2 }]);
    expect(result.grid[1][1]).toBe(6);
  });

  it("clears a stone and a 0", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = STONE;
    grid[0][1] = 0;
    expect(hammerEffect(grid, 0, 0).grid[0][0]).toBeNull();
    expect(hammerEffect(grid, 0, 1).grid[0][1]).toBeNull();
  });

  it("an empty or out-of-range target is not applied and returns the same grid", () => {
    const grid = createEmptyGrid(4);
    const empty = hammerEffect(grid, 2, 2);
    expect(empty.applied).toBe(false);
    expect(empty.grid).toBe(grid);
    expect(empty.cleared).toEqual([]);
    expect(hammerEffect(grid, 9, 9).applied).toBe(false);
  });

  it("does not mutate the input", () => {
    const grid = sample();
    hammerEffect(grid, 0, 0);
    expect(grid).toEqual(sample());
  });
});

describe("addOneEffect", () => {
  it("adds 1 to a 1-8 tile", () => {
    const result = addOneEffect(sample(), 0, 0);
    expect(result.applied).toBe(true);
    expect(result.grid[0][0]).toBe(2);
    expect(result.pairCleared).toBe(false);
    expect(result.cleared).toEqual([]);
  });

  it("on a 9 removes the tile and reports a cleared pair", () => {
    const result = addOneEffect(sample(), 2, 0);
    expect(result.applied).toBe(true);
    expect(result.grid[2][0]).toBeNull();
    expect(result.pairCleared).toBe(true);
    expect(result.cleared).toEqual([{ row: 2, col: 0 }]);
  });

  it("on a 0 makes it a 1", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 0;
    expect(addOneEffect(grid, 0, 0).grid[0][0]).toBe(1);
  });

  it("refuses empty cells and stones", () => {
    const grid = createEmptyGrid(4);
    grid[1][1] = STONE;
    const onEmpty = addOneEffect(grid, 0, 0);
    const onStone = addOneEffect(grid, 1, 1);
    expect(onEmpty.applied).toBe(false);
    expect(onEmpty.grid).toBe(grid);
    expect(onStone.applied).toBe(false);
    expect(onStone.grid).toBe(grid);
    expect(onStone.grid[1][1]).toBe(STONE);
  });

  it("does not mutate the input", () => {
    const grid = sample();
    addOneEffect(grid, 0, 0);
    expect(grid).toEqual(sample());
  });
});

describe("bombEffect", () => {
  it("clears the 5-cell cross and nothing else", () => {
    const result = bombEffect(sample(), 1, 1);
    expect(result.applied).toBe(true);
    const clearedKeys = result.cleared.map(({ row, col }) => `${row},${col}`).sort();
    expect(clearedKeys).toEqual(["0,1", "1,0", "1,1", "1,2", "2,1"]);
    expect(result.grid[0][0]).toBe(1);
    expect(result.grid[0][1]).toBeNull();
    expect(result.grid[1][0]).toBeNull();
    expect(result.grid[1][1]).toBeNull();
    expect(result.grid[1][2]).toBeNull();
    expect(result.grid[2][1]).toBeNull();
    expect(result.grid[2][2]).toBe(2);
  });

  it("at a corner clears only the cells inside the grid", () => {
    const result = bombEffect(sample(), 0, 0);
    const clearedKeys = result.cleared.map(({ row, col }) => `${row},${col}`).sort();
    expect(clearedKeys).toEqual(["0,0", "0,1", "1,0"]);
  });

  it("only reports cells that held something, and still applies on an empty centre", () => {
    const grid = createEmptyGrid(4);
    grid[1][2] = 5;
    const result = bombEffect(grid, 1, 1);
    expect(result.applied).toBe(true);
    expect(result.cleared).toEqual([{ row: 1, col: 2 }]);
  });

  it("clears stones in the cross", () => {
    const grid = createEmptyGrid(4);
    grid[0][1] = STONE;
    expect(bombEffect(grid, 1, 1).grid[0][1]).toBeNull();
  });

  it("does not mutate the input", () => {
    const grid = sample();
    bombEffect(grid, 1, 1);
    expect(grid).toEqual(sample());
  });
});

describe("shuffleEffect", () => {
  function multiset(grid: GameGrid): number[] {
    return grid.flat().filter((c): c is number => c !== null).sort((a, b) => a - b);
  }

  it("keeps occupied positions and the multiset of values (stones and 0 included)", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 3;
    grid[1][2] = STONE;
    grid[2][1] = 0;
    grid[3][3] = 8;
    const result = shuffleEffect(grid, () => 0.5);
    expect(result.applied).toBe(true);
    expect(result.cleared).toEqual([]);
    result.grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        expect(cell === null).toBe(grid[r][c] === null);
      }),
    );
    expect(multiset(result.grid)).toEqual(multiset(grid));
  });

  it("uses the Fisher-Yates order of endless mode (rng() = 0 swaps every slot with index 0)", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[0][1] = 2;
    grid[0][2] = 3;
    // tiles [1,2,3]; i=2,j=0 -> [3,2,1]; i=1,j=0 -> [2,3,1]
    const result = shuffleEffect(grid, () => 0);
    expect(result.grid[0].slice(0, 3)).toEqual([2, 3, 1]);
  });

  it("calls rng exactly (occupied - 1) times", () => {
    let calls = 0;
    shuffleEffect(sample(), () => {
      calls += 1;
      return 0.3;
    });
    expect(calls).toBe(15);
  });

  it("frozen cells keep their content and do not take part", () => {
    const grid = createEmptyGrid(4);
    grid[0][0] = 1;
    grid[0][1] = 2;
    grid[0][2] = 3;
    const frozen: FrozenMask = createEmptyGrid(4).map((row) => row.map(() => false));
    frozen[0][1] = true;
    // movable tiles [1,3]; i=1,j=0 -> [3,1]
    const result = shuffleEffect(grid, () => 0, frozen);
    expect(result.grid[0].slice(0, 3)).toEqual([3, 2, 1]);
  });

  it("works on an empty board and a single tile without calling rng", () => {
    let calls = 0;
    const rng = (): number => {
      calls += 1;
      return 0;
    };
    const one = createEmptyGrid(4);
    one[2][2] = 4;
    expect(shuffleEffect(createEmptyGrid(4), rng).applied).toBe(true);
    expect(shuffleEffect(one, rng).grid[2][2]).toBe(4);
    expect(calls).toBe(0);
  });

  it("does not mutate the input", () => {
    const grid = sample();
    shuffleEffect(grid, () => 0);
    expect(grid).toEqual(sample());
  });
});
```

- [ ] **Step 6.2: Run it and see it fail**

```bash
npx vitest run tests/unit/powerupEffects.test.ts
```
Expected: FAIL (`hammerEffect is not a function`, and the same for the other three).

- [ ] **Step 6.3: Implement the pure functions**

At the very top of `workspace/src/powerups.ts` (above `export type PowerupId`), add:
```ts
import { STONE, type Cell, type FrozenMask, type GameGrid, type Rng } from "./grid";
import type { CellPosition } from "./gridDiff";

```
Then append the following to the end of the file (after `computeEliminationAward`):
```ts

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
```

- [ ] **Step 6.4: Run the new tests and see them pass**

```bash
npx vitest run tests/unit/powerupEffects.test.ts tests/unit/powerups.test.ts
```
Expected: `powerupEffects.test.ts (20 tests)` and `powerups.test.ts (6 tests)` pass.

- [ ] **Step 6.5: Make `game.ts` call the pure functions**

In `workspace/src/game.ts`:

1. Extend the powerups import block (original lines 22-28) so it reads:
```ts
import {
  type PowerupId,
  type PowerupState,
  emptyPowerups,
  computePlayCountAward,
  computeEliminationAward,
  hammerEffect,
  shuffleEffect,
  addOneEffect,
  bombEffect,
} from "./powerups";
```
2. Replace everything from `function applyHammer(row: number, col: number): void {` through the closing brace of `function applyBomb` (stop before `function loadPlayCount`) with:
```ts
function applyHammer(row: number, col: number): void {
  const result = hammerEffect(state.grid, row, col);
  if (!result.applied) return;
  setState({ ...state, grid: result.grid });
  powerups.hammer--;
  savePowerups();
  audio.play("hammer");
  renderHudPowerups();
}

function applyShuffle(): void {
  const result = shuffleEffect(state.grid, rng);
  setState({ ...state, grid: result.grid });
  powerups.shuffle--;
  savePowerups();
  audio.play("shuffle");
  renderHudPowerups();
}

function applyAddOne(row: number, col: number): void {
  const result = addOneEffect(state.grid, row, col);
  if (!result.applied) return;
  setState({
    ...state,
    grid: result.grid,
    score: result.pairCleared ? state.score + 10 : state.score,
  });
  powerups.addOne--;
  savePowerups();
  audio.play("addOne");
  renderHudPowerups();
}

function applyBomb(row: number, col: number): void {
  const result = bombEffect(state.grid, row, col);
  setState({ ...state, grid: result.grid });
  powerups.bomb--;
  savePowerups();
  audio.play("bomb");
  renderHudPowerups();
}
```
The touch/click handlers that call `applyHammer`/`applyAddOne`/`applyBomb`/`applyShuffle` are unchanged.

- [ ] **Step 6.6: Verify endless mode powerups still behave**

```bash
npx tsc --noEmit
npm run test:unit
npx playwright test tests/e2e/ux-v2.spec.ts
```
Expected: `tsc` clean; unit `Tests  260 passed (260)`; `ux-v2.spec.ts` passes entirely (it contains the hammer/powerup scenarios, e.g. "F5: hammer powerup removes a tile when activated and clicked on canvas").

- [ ] **Step 6.7: Commit**

```bash
git add workspace/src/powerups.ts workspace/src/game.ts workspace/tests/unit/powerupEffects.test.ts
git commit -m "$(cat <<'EOF'
refactor(merge10): extract powerup board effects into pure functions

hammerEffect, shuffleEffect, addOneEffect and bombEffect take a grid and
return a result; game.ts keeps counters, saving, audio and HUD updates.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Full verification

**Files:** none modified.

- [ ] **Step 7.1: Types, unit, e2e, build**

Run from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`:
```bash
npx tsc --noEmit
npm run test:unit
npm run test:e2e
npm run build
```
Expected: `tsc` clean; unit `Test Files  21 passed (21)` and `Tests  260 passed (260)`; e2e `54 passed`; build prints `built in ...` with no errors.

- [ ] **Step 7.2: Confirm the endless-mode surface did not move**

```bash
git -C /Users/kyo.lai82/Projects/Personal/game-factory diff --stat 8d38bee -- workspace/index.html workspace/src/trophies.ts workspace/src/audio.ts workspace/src/palettes.ts
git -C /Users/kyo.lai82/Projects/Personal/game-factory diff --name-only 8d38bee -- workspace/tests/unit workspace/tests/e2e
```
Expected: the first command prints nothing (those files untouched). The second lists only the new test files (`boardRenderer.test.ts`, `gridStone.test.ts`, `gridFrozen.test.ts`, `gridSpawnStrategy.test.ts`, `gridStoneBreak.test.ts`, `powerupEffects.test.ts`) and no pre-existing test file (committed changes only; run after Task 6's commit).

- [ ] **Step 7.3: Optional manual smoke (web)**

```bash
npm run dev
```
Open `http://localhost:5173/game_kyo/merge10/`, slide a few moves (spawn pop-in and slide animation play), make a pair (highlight, fade, recompact), then use a hammer powerup via the HUD. Behavior must look identical to before. Stop the dev server afterwards. No commit needed for this task.

---

## Self-Review (done against spec §3.4, §4.1, §9.2)

| Spec item | Covered by |
|---|---|
| §9.2 `boardRenderer.ts` (`render`, `drawBaseTile`, elimination animation; structure only) | Task 1 (renderer class, e2e gate before/after) |
| §9.2 `powerups.ts` pure functions; addOne on 9 = cleared pair; bomb = 5-cell cross; rng injected | Task 6 (`addOneEffect.pairCleared`, `bombEffect`, `shuffleEffect(grid, rng, frozen?)`) |
| §9.2 `spawnRandomTile` optional strategy; default unchanged | Task 4 (`SpawnStrategy`, trailing optional param; no-strategy path keeps the same rng order) |
| §4.1 `<4` empty cells, 50%, spawn `10 - neighbour` adjacent to that neighbour; relic 30% any count, higher wins | Task 4 (`COMPLEMENT_BIAS`, `baseProbability`, tests `baseProbability applies above the threshold`, `higher of ... wins`) |
| §9.2 `slide` optional frozen mask, frozen = wall | Task 3 (`FrozenMask`, `slide(..., frozen?)`, plus `canMove`/`isGameOver` so stuck detection respects walls) |
| §3.4 frozen cells still eliminable | Task 3 (head/tail wall pairing tests) |
| §9.2 / §3.4 `STONE` never pairs, moves with slides | Task 2 (`STONE`, `canPair`, slide tests) |
| §3.4 stone breaks when an orthogonal neighbour is eliminated this turn | Task 5 (`breakAdjacentStones`, `eliminationSites`) |
| §3.4 zero needs no special handling | Task 2 (`0 never pairs with a tile 1-9` test; no code needed) |
| §4.2 shuffle excludes frozen cells | Task 6 (`shuffleEffect` frozen parameter) |
| §9.1 endless mode and existing tests unchanged | Global constraint; Task 7 checks no existing test/UI file changed |

Type-name consistency check: the names in Interfaces blocks are exactly those in the code blocks: `BoardRenderer`, `BoardRendererOptions`, `STONE`, `canPair`, `FrozenMask`, `slideRowLeftFrozen`, `SpawnStrategy`, `COMPLEMENT_BIAS`, `eliminationSites`, `StoneBreakResult`, `breakAdjacentStones`, `PowerupResult`, `AddOneResult`, `hammerEffect`, `shuffleEffect`, `addOneEffect`, `bombEffect`. `CellPosition` (existing in `gridDiff.ts`) is reused instead of introducing a duplicate type; `grid.ts` and `powerups.ts` import it with `import type`, so there is no runtime cycle.

Pre-validation note: all code in this plan was applied to a scratch copy of `workspace/` (outside the repo) before the plan was written: `tsc --noEmit` clean, 260 unit tests and all 54 e2e tests green, `vite build` succeeds.

Risks and ambiguities for plans #2/#3:
1. Stone-break frame (spec §3.4 says "adjacent cell eliminated this turn" but not in which frame, since stones also slide). This plan evaluates adjacency on the post-slide grid against each pair's `meetA`/`meetB` cell (`grid.ts` `eliminationSites`). Plan #2 should confirm that is the desired feel; changing it only means passing a different cell list.
2. `BoardRenderer.draw` reads `PALETTES[palette][value]` (`palettes.ts` has keys 1-9 only), so drawing `0`, `STONE`, or frozen cells would throw. Plan #3 must add a cell-drawing hook (or palette entries) before the adventure board renders those cells; deliberately not done here because Task 1 is structure-only.
3. `setState` in `game.ts` (line ~1046) increments the play count whenever the new state has `score === 0`, so a powerup used at score 0 also counts as a new play. This quirk is pre-existing and deliberately preserved.
4. Frozen walls are eliminated through the same `eliminatedPairs` array, so plan #2 must clear the frozen-mask entry (and its remaining-turns record) for any pair endpoint that was frozen; the mask is positional and `slide` does not return an updated mask.
5. `addOneEffect` allows `0 -> 1` (spec §4.2 only forbids stones); confirm that is intended in plan #2.
