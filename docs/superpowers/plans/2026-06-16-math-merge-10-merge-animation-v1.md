# Math Merge 10 — Merge Animation & Combo Feedback v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visually distinct animations for tile elimination (flash + shrink), movement (direction-aware ease-in), and spawn (drop-in bounce), plus a "COMBO ×N" badge when two or more pairs are eliminated in one move.

**Architecture:** Extend `grid.ts`'s `slideRowLeft` / `slide` return types to expose eliminated-pair grid coordinates without changing the rule logic. In `game.ts`, replace the single `animatingCells` map with three typed maps (`eliminatingCells`, `spawnCells`, `moveCells`); rewrite `handleKeydown` to call `slide()` + `spawnRandomTile()` directly so it receives elimination metadata; extend `render()` to draw phantom eliminated tiles and apply per-event animation math in Canvas 2D. A `#combo-badge` DOM element (same pattern as `#score-popup`) handles the combo banner via CSS animation.

**Tech Stack:** TypeScript, Vite, Canvas 2D, Vitest (unit tests), Playwright (e2e tests).

---

## File Structure

| File | Change |
|------|--------|
| `workspace/src/grid.ts` | Add `EliminatedPair` interface; extend `SlideResult` with `eliminatedIndices`; extend `SlideOutcome` with `eliminatedPairs`; update `slideRowLeft`, `applySlideRowLeftToGrid`, and `slide` |
| `workspace/src/game.ts` | Replace `animatingCells` with three maps; rewrite `handleKeydown`, `render`, `tick`; add `startAnimations`, `drawTile`, `flashColor`, `spawnProgress` helpers; add `__lastAnimationHints` test hook |
| `workspace/index.html` | Add `#combo-badge` div + CSS inside `#game-container` |
| `workspace/tests/unit/mergeAnimation.test.ts` | New — unit tests for extended `grid.ts` return types |
| `workspace/tests/e2e/merge-animation.spec.ts` | New — E2E tests via `__lastAnimationHints` window hook |

`gridDiff.ts`, `palettes.ts`, `scoring.ts` are **unchanged**.

---

## Task 1: Unit tests for grid.ts extension (RED)

**Files:**
- Create: `workspace/tests/unit/mergeAnimation.test.ts`

- [ ] **Step 1.1: Write the failing unit tests**

```typescript
// workspace/tests/unit/mergeAnimation.test.ts
import { describe, it, expect } from "vitest";
import { slideRowLeft, slide } from "../../src/grid";

describe("slideRowLeft eliminatedIndices", () => {
  it("returns pair column indices for a single elimination", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 3, null]);
    expect(eliminatedIndices).toEqual([[0, 1]]);
  });

  it("returns two pair indices when two pairs eliminated (combo)", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 5, 5]);
    expect(eliminatedIndices).toEqual([[0, 1], [2, 3]]);
  });

  it("returns empty array when no elimination occurs", () => {
    const { eliminatedIndices } = slideRowLeft([1, 2, 3, null]);
    expect(eliminatedIndices).toEqual([]);
  });

  it("does not change scoreGained or row output", () => {
    const result = slideRowLeft([9, 1, 3, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.row).toEqual([3, null, null, null]);
  });

  it("tracks original column positions (not values-array positions)", () => {
    // null at col 0 — non-null values at cols 1,2,3
    const { eliminatedIndices } = slideRowLeft([null, 9, 1, 3]);
    expect(eliminatedIndices).toEqual([[1, 2]]);
  });
});

describe("slide eliminatedPairs absolute grid coordinates", () => {
  const emptyRows = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ] as const;

  it("maps col indices to absolute coords for left slide", () => {
    const grid = [[9, 1, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([
      { a: { row: 0, col: 0 }, b: { row: 0, col: 1 } },
    ]);
  });

  it("maps reversed col indices to absolute coords for right slide", () => {
    // reversed row → [null,1,9,3], 1 at reversed-col 1 (abs col 2), 9 at reversed-col 2 (abs col 1)
    const grid = [[3, 9, 1, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "right");
    expect(eliminatedPairs).toEqual([
      { a: { row: 0, col: 2 }, b: { row: 0, col: 1 } },
    ]);
  });

  it("maps transposed coords to absolute coords for up slide", () => {
    // column 0 has [9,1,null,null] → slideRowLeft eliminates at transposed (row 0, cols 0,1)
    // abs: (row=col=0, col=row=0) and (row=col=1, col=row=0)
    const grid = [
      [9, null, null, null],
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "up");
    expect(eliminatedPairs).toEqual([
      { a: { row: 0, col: 0 }, b: { row: 1, col: 0 } },
    ]);
  });

  it("returns empty eliminatedPairs when no elimination occurs", () => {
    const grid = [[1, 2, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([]);
  });
});
```

- [ ] **Step 1.2: Run tests and confirm they ALL FAIL**

```bash
cd workspace && npx vitest run tests/unit/mergeAnimation.test.ts --reporter=verbose
```

Expected output: every test **FAIL** with `TypeError: Cannot destructure property 'eliminatedIndices'` or similar — the property does not exist yet.

- [ ] **Step 1.3: Commit failing tests**

```bash
git add workspace/tests/unit/mergeAnimation.test.ts
git commit -m "test: add failing unit tests for grid.ts eliminatedPairs extension"
```

---

## Task 2: Extend grid.ts to make unit tests pass (GREEN)

**Files:**
- Modify: `workspace/src/grid.ts`

- [ ] **Step 2.1: Add `EliminatedPair` type and extend `SlideResult` / `SlideOutcome`**

Open `workspace/src/grid.ts`. Add `EliminatedPair` right after `export type GameGrid = Cell[][];`:

```typescript
export interface EliminatedPair {
  a: { row: number; col: number };
  b: { row: number; col: number };
}
```

Extend `SlideResult` (add one field — the rest of the interface is unchanged):

```typescript
export interface SlideResult {
  row: Cell[];
  moved: boolean;
  scoreGained: number;
  eliminatedIndices: Array<[number, number]>;
}
```

Extend `SlideOutcome` (add one field):

```typescript
export interface SlideOutcome {
  grid: GameGrid;
  moved: boolean;
  scoreGained: number;
  eliminatedPairs: EliminatedPair[];
}
```

- [ ] **Step 2.2: Update `slideRowLeft` to populate `eliminatedIndices`**

Replace the existing `slideRowLeft` implementation with:

```typescript
export function slideRowLeft(row: Cell[]): SlideResult {
  const valuePositions: number[] = [];
  const values: number[] = [];
  row.forEach((cell, index) => {
    if (cell !== null) {
      valuePositions.push(index);
      values.push(cell);
    }
  });

  const merged: number[] = [];
  let scoreGained = 0;
  const eliminatedIndices: Array<[number, number]> = [];

  let i = 0;
  while (i < values.length) {
    const current = values[i];
    const next = values[i + 1];

    if (next !== undefined && current + next === 10) {
      scoreGained += 10;
      eliminatedIndices.push([valuePositions[i], valuePositions[i + 1]]);
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }

  const finalRow = padToLength(merged, row.length);
  const moved = row.some((cell, index) => cell !== finalRow[index]);

  return { row: finalRow, moved, scoreGained, eliminatedIndices };
}
```

- [ ] **Step 2.3: Update `applySlideRowLeftToGrid` to build `eliminatedPairs`**

Replace the existing `applySlideRowLeftToGrid` with:

```typescript
function applySlideRowLeftToGrid(grid: GameGrid): SlideOutcome {
  let moved = false;
  let scoreGained = 0;
  const eliminatedPairs: EliminatedPair[] = [];

  const resultGrid = grid.map((row, rowIndex) => {
    const result = slideRowLeft(row);
    if (result.moved) moved = true;
    scoreGained += result.scoreGained;
    result.eliminatedIndices.forEach(([colA, colB]) => {
      eliminatedPairs.push({
        a: { row: rowIndex, col: colA },
        b: { row: rowIndex, col: colB },
      });
    });
    return result.row;
  });

  return { grid: resultGrid, moved, scoreGained, eliminatedPairs };
}
```

- [ ] **Step 2.4: Update `slide` to transform `eliminatedPairs` coordinates per direction**

Replace the existing `slide` function with:

```typescript
export function slide(grid: GameGrid, direction: Direction): SlideOutcome {
  const size = grid.length;

  switch (direction) {
    case "left": {
      return applySlideRowLeftToGrid(grid);
    }
    case "right": {
      const outcome = applySlideRowLeftToGrid(reverseRows(grid));
      const pairs = outcome.eliminatedPairs.map(({ a, b }) => ({
        a: { row: a.row, col: size - 1 - a.col },
        b: { row: b.row, col: size - 1 - b.col },
      }));
      return { ...outcome, grid: reverseRows(outcome.grid), eliminatedPairs: pairs };
    }
    case "up": {
      const outcome = applySlideRowLeftToGrid(transpose(grid));
      const pairs = outcome.eliminatedPairs.map(({ a, b }) => ({
        a: { row: a.col, col: a.row },
        b: { row: b.col, col: b.row },
      }));
      return { ...outcome, grid: transpose(outcome.grid), eliminatedPairs: pairs };
    }
    case "down": {
      const outcome = applySlideRowLeftToGrid(reverseRows(transpose(grid)));
      const pairs = outcome.eliminatedPairs.map(({ a, b }) => ({
        a: { row: size - 1 - a.col, col: a.row },
        b: { row: size - 1 - b.col, col: b.row },
      }));
      return { ...outcome, grid: transpose(reverseRows(outcome.grid)), eliminatedPairs: pairs };
    }
  }
}
```

**Why the coordinate transforms work:**

- `left`: no transform — row indices and col indices from `slideRowLeft` are already absolute.
- `right`: grid rows were reversed (`reverseRows`) before processing, so col index `c` in reversed grid = absolute col `size - 1 - c`.
- `up`: grid was transposed before processing, so `(row=r, col=c)` in transposed = `(row=c, col=r)` in absolute.
- `down`: grid was `reverseRows(transpose)` before processing, so `(row=r, col=c)` in that form = `(row=size-1-c, col=r)` in absolute.

- [ ] **Step 2.5: Run ALL unit tests to confirm 31 old + 9 new = 40 pass**

```bash
cd workspace && npx vitest run --reporter=verbose
```

Expected:
```
Test Files  5 passed (5)
     Tests  40 passed (40)
```

- [ ] **Step 2.6: Commit**

```bash
git add workspace/src/grid.ts
git commit -m "feat: extend grid.ts slide() to return eliminated pair coordinates"
```

---

## Task 3: Add #combo-badge to index.html

**Files:**
- Modify: `workspace/index.html`

- [ ] **Step 3.1: Add CSS for combo-badge**

Inside the existing `<style>` block in `workspace/index.html`, add after the `#play-again` rule:

```css
#combo-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.3);
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: #fff;
  font-family: sans-serif;
  font-size: 24px;
  font-weight: 900;
  padding: 10px 24px;
  border-radius: 999px;
  letter-spacing: 0.04em;
  pointer-events: none;
  opacity: 0;
  z-index: 20;
}
#combo-badge.show {
  animation: combo-appear 800ms ease-out forwards;
}
@keyframes combo-appear {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  30%  { transform: translate(-50%, -50%) scale(1.0); }
  75%  { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.0); }
}
```

- [ ] **Step 3.2: Add the #combo-badge element**

Inside `#game-container` in `workspace/index.html`, add `<div id="combo-badge"></div>` after `<div id="score-popup"></div>`:

```html
<div id="game-container">
  <canvas id="game" width="800" height="800"></canvas>
  <button id="palette-toggle" aria-label="切換配色">🎨</button>
  <div id="score-popup"></div>
  <div id="combo-badge"></div>
  <div id="game-over" hidden>
    <!-- ... existing game-over content unchanged ... -->
  </div>
</div>
```

- [ ] **Step 3.3: Commit**

```bash
git add workspace/index.html
git commit -m "feat: add combo-badge DOM element and CSS animation to index.html"
```

---

## Task 4: E2E tests for animation hints (RED)

**Files:**
- Create: `workspace/tests/e2e/merge-animation.spec.ts`

- [ ] **Step 4.1: Write the failing E2E tests**

```typescript
// workspace/tests/e2e/merge-animation.spec.ts
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

test("elimination produces correct eliminatedPairs hint", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState(
      {
        grid: [
          [9, 1, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
        score: 0,
      },
      () => 0
    );
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(1);
  expect(hints.eliminatedPairs[0].a).toEqual({ row: 0, col: 0 });
  expect(hints.eliminatedPairs[0].b).toEqual({ row: 0, col: 1 });
  expect(hints.comboCount).toBe(1);
  expect(hints.spawnedCell).not.toBeNull();
});

test("two simultaneous eliminations produce comboCount 2", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState(
      {
        grid: [
          [9, 1, 5, 5],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
        score: 0,
      },
      () => 0
    );
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(2);
  expect(hints.comboCount).toBe(2);
});

test("no elimination produces empty eliminatedPairs with spawn and move hints", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState(
      {
        grid: [
          [1, 2, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
        score: 0,
      },
      () => 0
    );
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(0);
  expect(hints.comboCount).toBe(0);
  expect(hints.spawnedCell).not.toBeNull();
  expect(hints.movedCells.length).toBeGreaterThan(0);
});
```

- [ ] **Step 4.2: Run E2E tests and confirm they FAIL**

```bash
cd workspace && npx playwright test tests/e2e/merge-animation.spec.ts --reporter=line
```

Expected: 3 tests **FAIL** — `(window as any).__lastAnimationHints` is `undefined`.

- [ ] **Step 4.3: Commit failing tests**

```bash
git add workspace/tests/e2e/merge-animation.spec.ts
git commit -m "test: add failing E2E tests for animation hints (merge-animation)"
```

---

## Task 5: Rewrite game.ts animation system (GREEN)

**Files:**
- Modify: `workspace/src/game.ts`

This task replaces the entire contents of `game.ts`. The new file introduces three typed animation maps, rewrites `handleKeydown` to call `slide()` directly, extends `render()` to draw phantom eliminated tiles and per-type animation math, and adds the `__lastAnimationHints` test hook.

- [ ] **Step 5.1: Replace workspace/src/game.ts with the complete new implementation**

```typescript
// workspace/src/game.ts
import {
  createInitialState,
  slide,
  spawnRandomTile,
  isGameOver,
  type Direction,
  type GameState,
  type GameGrid,
  type Rng,
  type EliminatedPair,
} from "./grid";
import {
  PALETTES,
  PALETTE_ORDER,
  nextPalette,
  isPaletteId,
  type PaletteId,
} from "./palettes";
import { changedCells } from "./gridDiff";
import { formatScorePopup, isNewRecord } from "./scoring";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";

// Animation durations (ms)
const ELIMINATE_DURATION_MS = 350;
const MOVE_DURATION_MS = 150;
const SPAWN_DELAY_MS = 350;   // spawn starts after elimination ends
const SPAWN_DURATION_MS = 400;

// DOM refs
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const gameOverScoreEl = document.getElementById("game-over-score") as HTMLParagraphElement;
const gameOverBestEl = document.getElementById("game-over-best") as HTMLParagraphElement;
const gameOverBadgeEl = document.getElementById("game-over-badge") as HTMLParagraphElement;
const playAgainEl = document.getElementById("play-again") as HTMLButtonElement;
const paletteToggleEl = document.getElementById("palette-toggle") as HTMLButtonElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;
const comboBadgeEl = document.getElementById("combo-badge") as HTMLDivElement;

// ── Persistence helpers ─────────────────────────────────────────────────────

function loadBestScore(): number {
  const value = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function loadPalette(): PaletteId {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
}

// ── Game state ──────────────────────────────────────────────────────────────

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();

// ── Animation maps ──────────────────────────────────────────────────────────
// eliminatingCells: phantom tiles from the previous grid that are mid-elimination.
// spawnCells:       new tile doing drop-in; startTime may be future (SPAWN_DELAY_MS).
// moveCells:        tiles that slid to a new position.

const eliminatingCells = new Map<string, { value: number; startTime: number }>();
const spawnCells = new Map<string, number>(); // key → startTime (possibly future)
const moveCells = new Map<string, { startTime: number; direction: Direction }>();
let animationFrameId: number | null = null;

// ── Canvas helpers ──────────────────────────────────────────────────────────

function flashColor(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * alpha)},${Math.round(g + (255 - g) * alpha)},${Math.round(b + (255 - b) * alpha)})`;
}

function spawnProgress(t: number): { scale: number; offsetY: number } {
  if (t < 0.5) {
    const s = t / 0.5;
    const ease = 1 - Math.pow(1 - s, 3);
    return { scale: 0.4 + 0.75 * ease, offsetY: -64 * (1 - ease) + 6 * ease };
  }
  if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return { scale: 1.15 - 0.18 * s, offsetY: 6 - 9 * s };
  }
  const s = (t - 0.75) / 0.25;
  return { scale: 0.97 + 0.03 * s, offsetY: -3 + 3 * s };
}

function drawTile(
  x: number,
  y: number,
  cellSize: number,
  value: number,
  bg: string,
  textColor: string,
  scale: number,
  offsetX: number,
  offsetY: number,
  alpha: number
): void {
  const padding = 4;
  const centerX = x + cellSize / 2;
  const centerY = y + cellSize / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(centerX + offsetX, centerY + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), centerX, centerY);

  ctx.restore();
}

// ── Render ──────────────────────────────────────────────────────────────────

function render(): void {
  const now = performance.now();
  const cellSize = canvas.width / GRID_SIZE;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid border lines
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      ctx.strokeStyle = "#444";
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }

  // Regular tiles (from current state.grid)
  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === null) return;

      const key = `${rowIndex},${colIndex}`;
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;
      const colors = PALETTES[currentPalette][cell];

      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;
      let glowAlpha = 0;

      // Spawn animation
      const spawnStart = spawnCells.get(key);
      if (spawnStart !== undefined) {
        const elapsed = Math.max(0, now - spawnStart);
        const t = Math.min(elapsed / SPAWN_DURATION_MS, 1);
        const p = spawnProgress(t);
        scale = p.scale;
        offsetY = p.offsetY;
        glowAlpha = Math.max(0, 1 - t * 2.5);
      }

      // Move animation (overrides spawn if both somehow present — shouldn't happen)
      const moveData = moveCells.get(key);
      if (moveData !== undefined) {
        const elapsed = now - moveData.startTime;
        const t = Math.min(elapsed / MOVE_DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - t, 2); // ease-out
        scale = 0.65 + 0.35 * eased;
        const maxOff = 16 * (1 - eased);
        switch (moveData.direction) {
          case "left":  offsetX = maxOff;  break;
          case "right": offsetX = -maxOff; break;
          case "up":    offsetY = maxOff;  break;
          case "down":  offsetY = -maxOff; break;
        }
      }

      if (glowAlpha > 0) {
        ctx.shadowColor = `rgba(74,222,128,${glowAlpha})`;
        ctx.shadowBlur = 20;
      }
      drawTile(x, y, cellSize, cell, colors.bg, colors.text, scale, offsetX, offsetY, 1);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    });
  });

  // Phantom eliminated tiles (no longer in state.grid — drawn on top)
  eliminatingCells.forEach(({ value, startTime }, key) => {
    const [rowIndex, colIndex] = key.split(",").map(Number);
    const x = colIndex * cellSize;
    const y = rowIndex * cellSize;
    const elapsed = now - startTime;
    const t = Math.min(elapsed / ELIMINATE_DURATION_MS, 1);
    const colors = PALETTES[currentPalette][value];

    let scale = 1;
    let flashAlpha = 0;
    let cellAlpha = 1;

    if (t < 0.17) {
      // 0–60ms: normal display
      scale = 1;
    } else if (t < 0.57) {
      // 60–200ms: grow + white flash
      const s = (t - 0.17) / 0.4;
      scale = 1 + 0.15 * s;
      flashAlpha = s;
    } else {
      // 200–350ms: shrink + fade out
      const s = (t - 0.57) / 0.43;
      scale = 1.15 * (1 - s);
      flashAlpha = 1 - s;
      cellAlpha = 1 - s;
    }

    const bg = flashAlpha > 0 ? flashColor(colors.bg, flashAlpha) : colors.bg;
    drawTile(x, y, cellSize, value, bg, colors.text, scale, 0, 0, cellAlpha);
  });

  // Score text
  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Score: ${state.score}`, 10, 20);
  ctx.fillText(`Best: ${bestScore}`, 10, 45);

  // Game over overlay
  const gameOver = isGameOver(state.grid);
  gameOverEl.hidden = !gameOver;
  if (gameOver) {
    gameOverScoreEl.textContent = `本次分數：${state.score}`;
    gameOverBestEl.textContent = `最高分：${bestScore}`;
    gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
  }
}

// ── Animation loop ──────────────────────────────────────────────────────────

function tick(): void {
  const now = performance.now();
  let stillAnimating = false;

  eliminatingCells.forEach(({ startTime }, key) => {
    if (now - startTime >= ELIMINATE_DURATION_MS) {
      eliminatingCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

  spawnCells.forEach((startTime, key) => {
    // startTime may be in the future (SPAWN_DELAY_MS offset)
    if (now >= startTime && now - startTime >= SPAWN_DURATION_MS) {
      spawnCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

  moveCells.forEach(({ startTime }, key) => {
    if (now - startTime >= MOVE_DURATION_MS) {
      moveCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

  render();

  if (stillAnimating) {
    animationFrameId = requestAnimationFrame(tick);
  } else {
    animationFrameId = null;
  }
}

function startAnimationLoop(): void {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(tick);
  }
}

// ── DOM feedback ────────────────────────────────────────────────────────────

function showScorePopup(amount: number): void {
  scorePopupEl.textContent = formatScorePopup(amount);
  scorePopupEl.classList.remove("animate");
  void scorePopupEl.offsetWidth;
  scorePopupEl.classList.add("animate");
}

function showComboBadge(count: number): void {
  comboBadgeEl.textContent = `COMBO ×${count}`;
  comboBadgeEl.classList.remove("show");
  void comboBadgeEl.offsetWidth;
  comboBadgeEl.classList.add("show");
}

// ── Animation hints type (exposed as window hook for E2E tests) ─────────────

interface AnimationHints {
  eliminatedPairs: EliminatedPair[];
  spawnedCell: { row: number; col: number } | null;
  movedCells: { row: number; col: number }[];
  comboCount: number;
}

// ── startAnimations ─────────────────────────────────────────────────────────

function startAnimations(
  prevGrid: GameGrid,
  eliminatedPairs: EliminatedPair[],
  spawnedCells: { row: number; col: number }[],
  movedCells: { row: number; col: number }[],
  direction: Direction
): AnimationHints {
  const now = performance.now();

  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  // Phantom tiles for eliminated pairs
  eliminatedPairs.forEach(({ a, b }) => {
    eliminatingCells.set(`${a.row},${a.col}`, {
      value: prevGrid[a.row][a.col] as number,
      startTime: now,
    });
    eliminatingCells.set(`${b.row},${b.col}`, {
      value: prevGrid[b.row][b.col] as number,
      startTime: now,
    });
  });

  // Move tiles slide in from opposite direction
  movedCells.forEach(({ row, col }) => {
    moveCells.set(`${row},${col}`, { startTime: now, direction });
  });

  // Spawn tile drops in after elimination finishes
  spawnedCells.forEach(({ row, col }) => {
    spawnCells.set(`${row},${col}`, now + SPAWN_DELAY_MS);
  });

  if (eliminatedPairs.length >= 2) {
    showComboBadge(eliminatedPairs.length);
  }

  return {
    eliminatedPairs,
    spawnedCell: spawnedCells[0] ?? null,
    movedCells,
    comboCount: eliminatedPairs.length,
  };
}

// ── setState (used by play-again and test hook) ─────────────────────────────

function setState(newState: GameState): void {
  const prevGrid = state.grid;
  const scoreGained = newState.score - state.score;
  state = newState;

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  // Clear any running animations and spawn all changed non-null tiles
  eliminatingCells.clear();
  moveCells.clear();
  spawnCells.clear();

  const now = performance.now();
  changedCells(prevGrid, state.grid).forEach(({ row, col }) => {
    if (state.grid[row][col] !== null) {
      spawnCells.set(`${row},${col}`, now);
    }
  });

  startAnimationLoop();
}

// ── Input handling ──────────────────────────────────────────────────────────

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const prevGrid = state.grid;
  const postSlideGrid = outcome.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);

  // Update state
  const scoreGained = outcome.scoreGained;
  state = { grid: newGrid, score: state.score + scoreGained };

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  // Detect spawned cell: was null in postSlideGrid, non-null in newGrid
  const spawnedCells = changedCells(postSlideGrid, newGrid);

  // Detect moved cells: non-null in newGrid, not eliminated, not spawned
  const eliminatedKeys = new Set(
    outcome.eliminatedPairs.flatMap(({ a, b }) => [
      `${a.row},${a.col}`,
      `${b.row},${b.col}`,
    ])
  );
  const spawnedKeys = new Set(spawnedCells.map(({ row, col }) => `${row},${col}`));
  const movedCells = changedCells(prevGrid, newGrid).filter(({ row, col }) => {
    const key = `${row},${col}`;
    return (
      !eliminatedKeys.has(key) &&
      !spawnedKeys.has(key) &&
      newGrid[row][col] !== null
    );
  });

  const hints = startAnimations(
    prevGrid,
    outcome.eliminatedPairs,
    spawnedCells,
    movedCells,
    direction
  );

  (window as unknown as { __lastAnimationHints: AnimationHints }).__lastAnimationHints = hints;

  startAnimationLoop();
}

// ── Event listeners ─────────────────────────────────────────────────────────

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

playAgainEl.addEventListener("click", () => {
  setState(createInitialState(GRID_SIZE, rng));
});

// ── Test hooks ──────────────────────────────────────────────────────────────

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  if (testRng) rng = testRng;
  setState(s);
};

(window as unknown as { __getCurrentPalette: () => PaletteId }).__getCurrentPalette =
  () => currentPalette;

// ── Boot ────────────────────────────────────────────────────────────────────

render();
```

- [ ] **Step 5.2: Run unit tests — must still be 40/40 green**

```bash
cd workspace && npx vitest run --reporter=verbose
```

Expected: `Tests  40 passed (40)`.

- [ ] **Step 5.3: Run E2E tests — all 3 new merge-animation tests must now pass**

```bash
cd workspace && npx playwright test tests/e2e/merge-animation.spec.ts --reporter=line
```

Expected: `3 passed`.

- [ ] **Step 5.4: Run the full E2E suite to confirm no regressions**

```bash
cd workspace && npx playwright test --reporter=line
```

Expected: all previously passing tests still pass (visual-effects.spec.ts: 3 tests, math-merge.spec.ts: 3 tests, plus the new 3 = 9 total E2E).

- [ ] **Step 5.5: Build check**

```bash
cd workspace && npm run build
```

Expected: `✓ built in` with no TypeScript errors.

- [ ] **Step 5.6: Commit**

```bash
git add workspace/src/game.ts
git commit -m "feat: add distinct eliminate/move/spawn animations and combo badge to Math Merge 10"
```

---

## Success Criteria

- [ ] `npm run test:unit` → 40 tests pass (31 original + 9 new)
- [ ] `npx playwright test` → 9 E2E tests pass (3 new + 6 existing)
- [ ] `npm run build` → clean build, no TypeScript errors
- [ ] Elimination: two tiles that sum to 10 flash white and shrink to nothing over 350ms (no text shown)
- [ ] Move: tiles ease in from the direction of the keypress over 150ms
- [ ] Spawn: new tile drops in from above with spring bounce + green glow over 400ms (starts 350ms after move, so after elimination)
- [ ] Combo: "COMBO ×2" badge appears when 2+ pairs eliminated in one move
- [ ] All existing Visual Effects v1 features unchanged: palette toggle, score popup, game over modal
