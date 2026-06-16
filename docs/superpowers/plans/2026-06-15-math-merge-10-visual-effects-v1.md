# Math Merge 10 — Visual Effects v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved design in `docs/superpowers/specs/2026-06-15-math-merge-10-visual-effects-v1-design.md` — switchable tile color palettes, an aggregated score popup, a redesigned Game Over modal, and spawn/merge tile animations — for Math Merge 10, without changing `workspace/src/grid.ts`.

**Architecture:** Three new pure, unit-tested modules (`palettes.ts`, `gridDiff.ts`, `scoring.ts`) hold palette data, grid-diffing, and small scoring helpers. `index.html` gains new DOM overlay elements (palette toggle button, score popup, redesigned Game Over card) inside a positioned `#game-container`. `game.ts` wires these together: `render()` is extended to draw palette-colored rounded tiles and an optional animation-progress map; `setState()` triggers the score popup and a `requestAnimationFrame` animation loop via a before/after grid diff.

**Tech Stack:** TypeScript, Vite, Canvas 2D, Vitest (unit tests), Playwright (e2e tests).

**Status:** Complete

---

## File Structure

- **`workspace/src/palettes.ts`** (new) — 3 palette color tables (`pairHint`, `gradient`, `pastel`) mapping tile values 1-9 to `{bg, text}`, plus `PALETTE_ORDER`, `nextPalette()`, `isPaletteId()`.
- **`workspace/src/gridDiff.ts`** (new) — `changedCells(prevGrid, nextGrid)`, a pure function returning the `{row, col}` positions whose value changed.
- **`workspace/src/scoring.ts`** (new) — `formatScorePopup(scoreGained)` and `isNewRecord(score, bestScore)`.
- **`workspace/index.html`** (modified) — adds `#game-container` (positioning wrapper), `#palette-toggle`, `#score-popup`, and restructures `#game-over` into a card with score/best/badge/button, plus the CSS for all of these.
- **`workspace/src/game.ts`** (modified) — palette state + toggle handler, `render()` extended (palette colors, rounded tiles, game-over card content, animation progress), score popup trigger, "再玩一次" handler, cell-diff-driven animation loop, new `__getCurrentPalette` test hook.
- **`workspace/tests/unit/palettes.test.ts`** (new)
- **`workspace/tests/unit/gridDiff.test.ts`** (new)
- **`workspace/tests/unit/scoring.test.ts`** (new)
- **`workspace/tests/e2e/visual-effects.spec.ts`** (new) — palette toggle, score popup, Game Over modal + Play Again.

All commands below assume the working directory is `workspace/`.

---

## Task 1: `palettes.ts` — palette color tables

**Files:**
- Create: `workspace/src/palettes.ts`
- Test: `workspace/tests/unit/palettes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workspace/tests/unit/palettes.test.ts
import { describe, it, expect } from "vitest";
import { PALETTES, PALETTE_ORDER, nextPalette, isPaletteId } from "../../src/palettes";

describe("PALETTES", () => {
  it("defines a bg and text color for every tile value 1-9 in each palette", () => {
    PALETTE_ORDER.forEach((paletteId) => {
      for (let value = 1; value <= 9; value++) {
        const colors = PALETTES[paletteId][value];
        expect(colors).toBeDefined();
        expect(colors.bg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(colors.text).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });
});

describe("PALETTE_ORDER", () => {
  it("lists exactly the three designed palettes", () => {
    expect(PALETTE_ORDER).toEqual(["pairHint", "gradient", "pastel"]);
  });
});

describe("nextPalette", () => {
  it("cycles pairHint -> gradient -> pastel -> pairHint", () => {
    expect(nextPalette("pairHint")).toBe("gradient");
    expect(nextPalette("gradient")).toBe("pastel");
    expect(nextPalette("pastel")).toBe("pairHint");
  });
});

describe("isPaletteId", () => {
  it("returns true for known palette ids", () => {
    expect(isPaletteId("pairHint")).toBe(true);
    expect(isPaletteId("gradient")).toBe(true);
    expect(isPaletteId("pastel")).toBe(true);
  });

  it("returns false for unknown values or null", () => {
    expect(isPaletteId("unknown")).toBe(false);
    expect(isPaletteId(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:unit -- tests/unit/palettes.test.ts`
Expected: FAIL with `Cannot find module '../../src/palettes'` (or similar resolution error), because `src/palettes.ts` does not exist yet.

- [ ] **Step 3: Implement `palettes.ts`**

```typescript
// workspace/src/palettes.ts
export interface TileColors {
  bg: string;
  text: string;
}

export type Palette = Record<number, TileColors>;

export type PaletteId = "pairHint" | "gradient" | "pastel";

export const PALETTES: Record<PaletteId, Palette> = {
  pairHint: {
    1: { bg: "#7dd3fc", text: "#0c4a6e" },
    2: { bg: "#86efac", text: "#14532d" },
    3: { bg: "#fde68a", text: "#78350f" },
    4: { bg: "#fda4af", text: "#7f1d1d" },
    5: { bg: "#c084fc", text: "#3b0764" },
    6: { bg: "#be123c", text: "#ffffff" },
    7: { bg: "#b45309", text: "#ffffff" },
    8: { bg: "#15803d", text: "#ffffff" },
    9: { bg: "#0369a1", text: "#ffffff" },
  },
  gradient: {
    1: { bg: "#60a5fa", text: "#1e3a8a" },
    2: { bg: "#38bdf8", text: "#0c4a6e" },
    3: { bg: "#34d399", text: "#022c22" },
    4: { bg: "#a3e635", text: "#1a2e05" },
    5: { bg: "#facc15", text: "#422006" },
    6: { bg: "#fb923c", text: "#431407" },
    7: { bg: "#f97316", text: "#431407" },
    8: { bg: "#ef4444", text: "#ffffff" },
    9: { bg: "#dc2626", text: "#ffffff" },
  },
  pastel: {
    1: { bg: "#e0f2fe", text: "#0c4a6e" },
    2: { bg: "#fef9c3", text: "#713f12" },
    3: { bg: "#fce7f3", text: "#831843" },
    4: { bg: "#dcfce7", text: "#14532d" },
    5: { bg: "#ede9fe", text: "#4c1d95" },
    6: { bg: "#ffedd5", text: "#7c2d12" },
    7: { bg: "#e0e7ff", text: "#3730a3" },
    8: { bg: "#fee2e2", text: "#7f1d1d" },
    9: { bg: "#f1f5f9", text: "#334155" },
  },
};

export const PALETTE_ORDER: PaletteId[] = ["pairHint", "gradient", "pastel"];

export function nextPalette(current: PaletteId): PaletteId {
  const index = PALETTE_ORDER.indexOf(current);
  return PALETTE_ORDER[(index + 1) % PALETTE_ORDER.length];
}

export function isPaletteId(value: string | null): value is PaletteId {
  return value !== null && (PALETTE_ORDER as string[]).includes(value);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test:unit -- tests/unit/palettes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/palettes.ts tests/unit/palettes.test.ts
git commit -m "feat: add tile color palette tables for Visual Effects v1"
```

---

## Task 2: `gridDiff.ts` — cell-diff pure function

**Files:**
- Create: `workspace/src/gridDiff.ts`
- Test: `workspace/tests/unit/gridDiff.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workspace/tests/unit/gridDiff.test.ts
import { describe, it, expect } from "vitest";
import { changedCells } from "../../src/gridDiff";
import type { GameGrid } from "../../src/grid";

describe("changedCells", () => {
  it("returns an empty array when no cells changed", () => {
    const grid: GameGrid = [
      [1, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    expect(changedCells(grid, grid)).toEqual([]);
  });

  it("reports a newly spawned tile", () => {
    const prev: GameGrid = [
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const next: GameGrid = [
      [1, null, null, null],
      [null, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    expect(changedCells(prev, next)).toEqual([{ row: 1, col: 1 }]);
  });

  it("reports both the merge result cell and the cell that became empty", () => {
    const prev: GameGrid = [
      [4, 6, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const next: GameGrid = [
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    expect(changedCells(prev, next)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:unit -- tests/unit/gridDiff.test.ts`
Expected: FAIL with `Cannot find module '../../src/gridDiff'`, because `src/gridDiff.ts` does not exist yet.

- [ ] **Step 3: Implement `gridDiff.ts`**

```typescript
// workspace/src/gridDiff.ts
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
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test:unit -- tests/unit/gridDiff.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/gridDiff.ts tests/unit/gridDiff.test.ts
git commit -m "feat: add pure grid-diff helper for tile animations"
```

---

## Task 3: `scoring.ts` — score popup + new-record helpers

**Files:**
- Create: `workspace/src/scoring.ts`
- Test: `workspace/tests/unit/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// workspace/tests/unit/scoring.test.ts
import { describe, it, expect } from "vitest";
import { formatScorePopup, isNewRecord } from "../../src/scoring";

describe("formatScorePopup", () => {
  it("formats a positive score gain with a leading plus sign", () => {
    expect(formatScorePopup(10)).toBe("+10");
    expect(formatScorePopup(20)).toBe("+20");
  });
});

describe("isNewRecord", () => {
  it("returns true when the current score equals the best score and is positive", () => {
    expect(isNewRecord(100, 100)).toBe(true);
  });

  it("returns false when the score is below the best score", () => {
    expect(isNewRecord(50, 100)).toBe(false);
  });

  it("returns false when both score and best score are zero", () => {
    expect(isNewRecord(0, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:unit -- tests/unit/scoring.test.ts`
Expected: FAIL with `Cannot find module '../../src/scoring'`, because `src/scoring.ts` does not exist yet.

- [ ] **Step 3: Implement `scoring.ts`**

```typescript
// workspace/src/scoring.ts
export function formatScorePopup(scoreGained: number): string {
  return `+${scoreGained}`;
}

export function isNewRecord(score: number, bestScore: number): boolean {
  return score === bestScore && score > 0;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test:unit -- tests/unit/scoring.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring.ts tests/unit/scoring.test.ts
git commit -m "feat: add score popup formatting and new-record helpers"
```

---

## Task 4: Switchable tile palettes (palette toggle button)

**Files:**
- Modify: `workspace/index.html`
- Modify: `workspace/src/game.ts`
- Create: `workspace/tests/e2e/visual-effects.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

```typescript
// workspace/tests/e2e/visual-effects.spec.ts
import { test, expect } from "@playwright/test";

test("clicking the palette toggle cycles through palettes and persists the choice across reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("mathMerge10Palette"));
  await page.reload();

  const getPalette = () =>
    page.evaluate(
      () => (window as unknown as { __getCurrentPalette: () => string }).__getCurrentPalette()
    );

  expect(await getPalette()).toBe("pairHint");

  await page.click("#palette-toggle");
  expect(await getPalette()).toBe("gradient");

  await page.click("#palette-toggle");
  expect(await getPalette()).toBe("pastel");

  await page.reload();
  expect(await getPalette()).toBe("pastel");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:e2e -- tests/e2e/visual-effects.spec.ts`
Expected: FAIL — `page.click("#palette-toggle")` times out because no element with id `palette-toggle` exists yet, and/or `__getCurrentPalette` is undefined.

- [ ] **Step 3: Update `index.html`**

Replace the entire file contents with:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Factory</title>
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
  <style>
    body {
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #111;
    }
    canvas {
      background: #222;
      border: 1px solid #444;
      display: block;
    }
    #game-container {
      position: relative;
    }
    #palette-toggle {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      z-index: 10;
    }
  </style>
</head>
<body>
  <div id="game-container">
    <canvas id="game" width="800" height="800"></canvas>
    <button id="palette-toggle" aria-label="切換配色">🎨</button>
    <div id="game-over" hidden>Game Over</div>
  </div>
  <script type="module" src="/src/main.ts"></script>
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js");
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 4: Update `game.ts`**

Replace the entire file contents with:

```typescript
// workspace/src/game.ts
import {
  createInitialState,
  applyMove,
  isGameOver,
  type Direction,
  type GameState,
  type Rng,
} from "./grid";
import {
  PALETTES,
  PALETTE_ORDER,
  nextPalette,
  isPaletteId,
  type PaletteId,
} from "./palettes";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const paletteToggleEl = document.getElementById("palette-toggle") as HTMLButtonElement;

function loadBestScore(): number {
  const value = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function loadPalette(): PaletteId {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
}

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();

function render(): void {
  const cellSize = canvas.width / GRID_SIZE;
  const padding = 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      ctx.strokeStyle = "#444";
      ctx.strokeRect(x, y, cellSize, cellSize);

      if (cell !== null) {
        const colors = PALETTES[currentPalette][cell];

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cell), x + cellSize / 2, y + cellSize / 2);
      }
    });
  });

  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Score: ${state.score}`, 10, 20);
  ctx.fillText(`Best: ${bestScore}`, 10, 45);

  gameOverEl.hidden = !isGameOver(state.grid);
}

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

function setState(newState: GameState): void {
  state = newState;
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
  render();
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  setState(applyMove(state, direction, rng));
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  if (testRng) rng = testRng;
  setState(s);
};

(window as unknown as { __getCurrentPalette: () => PaletteId }).__getCurrentPalette = () =>
  currentPalette;

render();
```

- [ ] **Step 5: Run the new e2e test and verify it passes**

Run: `npm run test:e2e -- tests/e2e/visual-effects.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Run the full test suite and verify no regressions**

Run: `npm run test:unit && npm run test:e2e`
Expected: PASS — all existing unit tests (Task 1 + `grid.test.ts`) and all e2e tests in `math-merge.spec.ts` plus `visual-effects.spec.ts` pass.

- [ ] **Step 7: Commit**

```bash
git add index.html src/game.ts tests/e2e/visual-effects.spec.ts
git commit -m "feat: add switchable tile color palettes with toggle button"
```

---

## Task 5: Score popup on merge

**Files:**
- Modify: `workspace/index.html`
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/visual-effects.spec.ts`

- [ ] **Step 1: Add the failing e2e test**

Append to `workspace/tests/e2e/visual-effects.spec.ts` (add the `GameState` import at the top alongside the existing import):

```typescript
import { test, expect } from "@playwright/test";
import type { GameState } from "../../src/grid";
```

Then append this test at the end of the file:

```typescript
test("a merge move shows a '+N' score popup that fades out", async ({ page }) => {
  await page.goto("/");

  const mergeState: GameState = {
    grid: [
      [4, 6, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState, rng: () => number) => void }).__setTestState(
      state,
      () => 0
    );
  }, mergeState);

  await page.keyboard.press("ArrowLeft");

  const popup = page.locator("#score-popup");
  await expect(popup).toHaveText("+10");
  await expect(popup).toHaveClass(/animate/);
  await expect(popup).toHaveCSS("opacity", "0", { timeout: 2000 });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:e2e -- tests/e2e/visual-effects.spec.ts`
Expected: FAIL — `page.locator("#score-popup")` finds no element, so `toHaveText("+10")` times out.

- [ ] **Step 3: Update `index.html`**

Replace the entire file contents with:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Factory</title>
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
  <style>
    body {
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #111;
    }
    canvas {
      background: #222;
      border: 1px solid #444;
      display: block;
    }
    #game-container {
      position: relative;
    }
    #palette-toggle {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      z-index: 10;
    }
    #score-popup {
      position: absolute;
      top: 30px;
      left: 12px;
      color: #fde047;
      font-family: sans-serif;
      font-weight: bold;
      font-size: 20px;
      pointer-events: none;
      opacity: 0;
      z-index: 10;
    }
    #score-popup.animate {
      animation: score-popup-float 800ms ease-out forwards;
    }
    @keyframes score-popup-float {
      0% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(-30px);
      }
    }
  </style>
</head>
<body>
  <div id="game-container">
    <canvas id="game" width="800" height="800"></canvas>
    <button id="palette-toggle" aria-label="切換配色">🎨</button>
    <div id="score-popup"></div>
    <div id="game-over" hidden>Game Over</div>
  </div>
  <script type="module" src="/src/main.ts"></script>
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js");
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 4: Update `game.ts`**

Replace the entire file contents with:

```typescript
// workspace/src/game.ts
import {
  createInitialState,
  applyMove,
  isGameOver,
  type Direction,
  type GameState,
  type Rng,
} from "./grid";
import {
  PALETTES,
  PALETTE_ORDER,
  nextPalette,
  isPaletteId,
  type PaletteId,
} from "./palettes";
import { formatScorePopup } from "./scoring";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const paletteToggleEl = document.getElementById("palette-toggle") as HTMLButtonElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;

function loadBestScore(): number {
  const value = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function loadPalette(): PaletteId {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
}

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();

function render(): void {
  const cellSize = canvas.width / GRID_SIZE;
  const padding = 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      ctx.strokeStyle = "#444";
      ctx.strokeRect(x, y, cellSize, cellSize);

      if (cell !== null) {
        const colors = PALETTES[currentPalette][cell];

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cell), x + cellSize / 2, y + cellSize / 2);
      }
    });
  });

  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Score: ${state.score}`, 10, 20);
  ctx.fillText(`Best: ${bestScore}`, 10, 45);

  gameOverEl.hidden = !isGameOver(state.grid);
}

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

function showScorePopup(amount: number): void {
  scorePopupEl.textContent = formatScorePopup(amount);
  scorePopupEl.classList.remove("animate");
  // Force a reflow so re-adding "animate" restarts the CSS animation.
  void scorePopupEl.offsetWidth;
  scorePopupEl.classList.add("animate");
}

function setState(newState: GameState): void {
  const scoreGained = newState.score - state.score;
  state = newState;

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  render();
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  setState(applyMove(state, direction, rng));
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  if (testRng) rng = testRng;
  setState(s);
};

(window as unknown as { __getCurrentPalette: () => PaletteId }).__getCurrentPalette = () =>
  currentPalette;

render();
```

- [ ] **Step 5: Run the new e2e test and verify it passes**

Run: `npm run test:e2e -- tests/e2e/visual-effects.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full test suite and verify no regressions**

Run: `npm run test:unit && npm run test:e2e`
Expected: PASS — all unit tests and all e2e tests pass.

- [ ] **Step 7: Commit**

```bash
git add index.html src/game.ts tests/e2e/visual-effects.spec.ts
git commit -m "feat: show an aggregated +N score popup on merges"
```

---

## Task 6: Game Over modal redesign + Play Again

**Files:**
- Modify: `workspace/index.html`
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/visual-effects.spec.ts`

- [ ] **Step 1: Add the failing e2e test**

Append this test to the end of `workspace/tests/e2e/visual-effects.spec.ts`:

```typescript
test("game over shows score/best and a new-record badge; Play Again resets the board", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("mathMerge10BestScore"));
  await page.reload();

  const gameOverState: GameState = {
    grid: [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 1],
    ],
    score: 50,
  };

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState) => void }).__setTestState(state);
  }, gameOverState);

  await expect(page.locator("#game-over")).toBeVisible();
  await expect(page.locator("#game-over-score")).toHaveText("本次分數：50");
  await expect(page.locator("#game-over-best")).toHaveText("最高分：50");
  await expect(page.locator("#game-over-badge")).toBeVisible();

  await page.click("#play-again");

  await expect(page.locator("#game-over")).toBeHidden();

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );
  expect(result.score).toBe(0);
  const filled = result.grid.flat().filter((cell) => cell !== null);
  expect(filled).toHaveLength(2);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:e2e -- tests/e2e/visual-effects.spec.ts`
Expected: FAIL — `page.locator("#game-over-score")` finds no element (the current `#game-over` is still a plain text div), so `toHaveText(...)` times out.

- [ ] **Step 3: Update `index.html`**

Replace the entire file contents with:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Factory</title>
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
  <style>
    body {
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #111;
    }
    canvas {
      background: #222;
      border: 1px solid #444;
      display: block;
    }
    #game-container {
      position: relative;
    }
    #palette-toggle {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      z-index: 10;
    }
    #score-popup {
      position: absolute;
      top: 30px;
      left: 12px;
      color: #fde047;
      font-family: sans-serif;
      font-weight: bold;
      font-size: 20px;
      pointer-events: none;
      opacity: 0;
      z-index: 10;
    }
    #score-popup.animate {
      animation: score-popup-float 800ms ease-out forwards;
    }
    @keyframes score-popup-float {
      0% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(-30px);
      }
    }
    #game-over {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
    }
    #game-over[hidden] {
      display: none;
    }
    #game-over-card {
      background: #1f2937;
      border-radius: 12px;
      padding: 24px 32px;
      text-align: center;
      font-family: sans-serif;
      color: #fff;
    }
    #game-over-card h2 {
      margin: 0 0 12px;
    }
    #game-over-card p {
      margin: 4px 0;
      font-size: 14px;
      color: #cbd5e1;
    }
    #game-over-badge {
      display: inline-block;
      margin-top: 8px;
      background: #fde047;
      color: #422006;
      font-size: 12px;
      font-weight: bold;
      border-radius: 999px;
      padding: 2px 10px;
    }
    #game-over-badge.hidden {
      display: none;
    }
    #play-again {
      margin-top: 16px;
      background: #4ade80;
      color: #052e16;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      font-size: 14px;
      padding: 8px 20px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="game-container">
    <canvas id="game" width="800" height="800"></canvas>
    <button id="palette-toggle" aria-label="切換配色">🎨</button>
    <div id="score-popup"></div>
    <div id="game-over" hidden>
      <div id="game-over-card">
        <h2>Game Over</h2>
        <p id="game-over-score"></p>
        <p id="game-over-best"></p>
        <p id="game-over-badge" class="hidden">★ 新紀錄！</p>
        <button id="play-again">再玩一次</button>
      </div>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js");
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 4: Update `game.ts`**

Replace the entire file contents with:

```typescript
// workspace/src/game.ts
import {
  createInitialState,
  applyMove,
  isGameOver,
  type Direction,
  type GameState,
  type Rng,
} from "./grid";
import {
  PALETTES,
  PALETTE_ORDER,
  nextPalette,
  isPaletteId,
  type PaletteId,
} from "./palettes";
import { formatScorePopup, isNewRecord } from "./scoring";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const gameOverScoreEl = document.getElementById("game-over-score") as HTMLParagraphElement;
const gameOverBestEl = document.getElementById("game-over-best") as HTMLParagraphElement;
const gameOverBadgeEl = document.getElementById("game-over-badge") as HTMLParagraphElement;
const playAgainEl = document.getElementById("play-again") as HTMLButtonElement;
const paletteToggleEl = document.getElementById("palette-toggle") as HTMLButtonElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;

function loadBestScore(): number {
  const value = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function loadPalette(): PaletteId {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
}

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();

function render(): void {
  const cellSize = canvas.width / GRID_SIZE;
  const padding = 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      ctx.strokeStyle = "#444";
      ctx.strokeRect(x, y, cellSize, cellSize);

      if (cell !== null) {
        const colors = PALETTES[currentPalette][cell];

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cell), x + cellSize / 2, y + cellSize / 2);
      }
    });
  });

  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Score: ${state.score}`, 10, 20);
  ctx.fillText(`Best: ${bestScore}`, 10, 45);

  const gameOver = isGameOver(state.grid);
  gameOverEl.hidden = !gameOver;
  if (gameOver) {
    gameOverScoreEl.textContent = `本次分數：${state.score}`;
    gameOverBestEl.textContent = `最高分：${bestScore}`;
    gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
  }
}

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

function showScorePopup(amount: number): void {
  scorePopupEl.textContent = formatScorePopup(amount);
  scorePopupEl.classList.remove("animate");
  // Force a reflow so re-adding "animate" restarts the CSS animation.
  void scorePopupEl.offsetWidth;
  scorePopupEl.classList.add("animate");
}

function setState(newState: GameState): void {
  const scoreGained = newState.score - state.score;
  state = newState;

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  render();
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  setState(applyMove(state, direction, rng));
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

playAgainEl.addEventListener("click", () => {
  setState(createInitialState(GRID_SIZE, rng));
});

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  if (testRng) rng = testRng;
  setState(s);
};

(window as unknown as { __getCurrentPalette: () => PaletteId }).__getCurrentPalette = () =>
  currentPalette;

render();
```

- [ ] **Step 5: Run the new e2e test and verify it passes**

Run: `npm run test:e2e -- tests/e2e/visual-effects.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full test suite and verify no regressions**

Run: `npm run test:unit && npm run test:e2e`
Expected: PASS — including the existing `math-merge.spec.ts` test "shows the Game Over overlay when no moves remain", which still locates `#game-over` by id and checks `toBeVisible()`.

- [ ] **Step 7: Commit**

```bash
git add index.html src/game.ts tests/e2e/visual-effects.spec.ts
git commit -m "feat: redesign Game Over as a modal with stats and Play Again"
```

---

## Task 7: Spawn/merge tile animation

**Files:**
- Modify: `workspace/src/game.ts`

**Note on testing strategy for this task:** Per the design spec's testing strategy, animation *timing* is intentionally not covered by a new automated test (the underlying `changedCells` diff is already unit-tested in Task 2). This task is verified by (a) the full existing test suite staying green — `render()`'s new parameter is optional and defaults to producing the same output as before, and (b) a manual check in the dev server.

- [ ] **Step 1: Run the full test suite to confirm the starting point is green**

Run: `npm run test:unit && npm run test:e2e`
Expected: PASS (baseline from Task 6).

- [ ] **Step 2: Update `game.ts`**

Replace the entire file contents with:

```typescript
// workspace/src/game.ts
import {
  createInitialState,
  applyMove,
  isGameOver,
  type Direction,
  type GameState,
  type Rng,
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
const ANIMATION_DURATION_MS = 150;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const gameOverScoreEl = document.getElementById("game-over-score") as HTMLParagraphElement;
const gameOverBestEl = document.getElementById("game-over-best") as HTMLParagraphElement;
const gameOverBadgeEl = document.getElementById("game-over-badge") as HTMLParagraphElement;
const playAgainEl = document.getElementById("play-again") as HTMLButtonElement;
const paletteToggleEl = document.getElementById("palette-toggle") as HTMLButtonElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;

function loadBestScore(): number {
  const value = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function loadPalette(): PaletteId {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
}

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();
const animatingCells = new Map<string, number>();
let animationFrameId: number | null = null;

function render(progress: Map<string, number> = new Map()): void {
  const cellSize = canvas.width / GRID_SIZE;
  const padding = 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      ctx.strokeStyle = "#444";
      ctx.strokeRect(x, y, cellSize, cellSize);

      if (cell !== null) {
        const colors = PALETTES[currentPalette][cell];
        const rawProgress = progress.get(`${rowIndex},${colIndex}`);
        const scale = rawProgress === undefined ? 1 : 1 - Math.pow(1 - rawProgress, 2);
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cell), centerX, centerY);

        ctx.restore();
      }
    });
  });

  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Score: ${state.score}`, 10, 20);
  ctx.fillText(`Best: ${bestScore}`, 10, 45);

  const gameOver = isGameOver(state.grid);
  gameOverEl.hidden = !gameOver;
  if (gameOver) {
    gameOverScoreEl.textContent = `本次分數：${state.score}`;
    gameOverBestEl.textContent = `最高分：${bestScore}`;
    gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
  }
}

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

function showScorePopup(amount: number): void {
  scorePopupEl.textContent = formatScorePopup(amount);
  scorePopupEl.classList.remove("animate");
  // Force a reflow so re-adding "animate" restarts the CSS animation.
  void scorePopupEl.offsetWidth;
  scorePopupEl.classList.add("animate");
}

function tick(): void {
  const now = performance.now();
  const progress = new Map<string, number>();
  let stillAnimating = false;

  animatingCells.forEach((startTime, key) => {
    const elapsed = now - startTime;
    if (elapsed >= ANIMATION_DURATION_MS) {
      animatingCells.delete(key);
    } else {
      progress.set(key, elapsed / ANIMATION_DURATION_MS);
      stillAnimating = true;
    }
  });

  render(progress);

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

function setState(newState: GameState): void {
  const prevState = state;
  const scoreGained = newState.score - prevState.score;
  state = newState;

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  const diff = changedCells(prevState.grid, state.grid);
  if (diff.length > 0) {
    const now = performance.now();
    diff.forEach(({ row, col }) => {
      animatingCells.set(`${row},${col}`, now);
    });
    startAnimationLoop();
  } else {
    render();
  }
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  setState(applyMove(state, direction, rng));
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

playAgainEl.addEventListener("click", () => {
  setState(createInitialState(GRID_SIZE, rng));
});

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  if (testRng) rng = testRng;
  setState(s);
};

(window as unknown as { __getCurrentPalette: () => PaletteId }).__getCurrentPalette = () =>
  currentPalette;

render();
```

- [ ] **Step 3: Run the full test suite and verify it is still green**

Run: `npm run test:unit && npm run test:e2e`
Expected: PASS — all unit tests (Tasks 1-3 + `grid.test.ts`) and all e2e tests (`math-merge.spec.ts` + `visual-effects.spec.ts`) pass. `render()`'s new `progress` parameter defaults to an empty map, so every existing call site renders exactly as before.

- [ ] **Step 4: Manual verification in the dev server**

Run: `npm run dev`, open the printed URL (usually `http://localhost:5173`), and play a few moves with the arrow keys.

Expected:
- Tiles use the "配對提示色系" (pairHint) palette by default — colored, rounded tiles.
- Clicking the 🎨 button in the top-right cycles through the three palettes.
- A move that merges tiles shows a "+N" popup near the top-left that floats up and fades.
- The newly spawned tile and any merge-result tile briefly grow in from the center (~150ms).
- Playing until no moves remain shows the Game Over card with score, best score, the "新紀錄" badge (on a first/record run), and a working "再玩一次" button.

- [ ] **Step 5: Commit**

```bash
git add src/game.ts
git commit -m "feat: animate spawned and merged tiles with a grow-in effect"
```

---

## Self-Review Notes

- **Spec coverage:** All 4 design features map to tasks — palettes (Task 4), score popup (Task 5), Game Over redesign (Task 6), spawn/merge animation (Task 7). The 3 supporting pure modules (Tasks 1-3) are each covered by their own unit tests, matching the design's testing strategy.
- **`grid.ts` untouched:** No task modifies `workspace/src/grid.ts`; `gridDiff.ts` only imports its `GameGrid` type.
- **Type/name consistency:** `PaletteId`, `PALETTE_ORDER`, `nextPalette`, `isPaletteId`, `PALETTES` (Task 1) are used identically in Tasks 4-7. `changedCells`/`CellPosition` (Task 2) match their use in Task 7's `setState`. `formatScorePopup`/`isNewRecord` (Task 3) match their use in Tasks 5-7. `__getCurrentPalette` is introduced in Task 4 and remains through Task 7.
- **No placeholders:** every task shows complete file contents or complete new code blocks; no "TBD"/"similar to above" references.
