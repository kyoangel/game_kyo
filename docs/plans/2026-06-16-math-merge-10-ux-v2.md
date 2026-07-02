# Math Merge 10 UX Enhancement v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add six player-experience features to Math Merge 10: HUD footer layout, redesigned pairHint palette, audio engine, collision animation, RWD + touch swipe, and a power-up system.

**Architecture:** All changes extend the existing TypeScript + Vite + Canvas 2D stack in `workspace/src/`. UI chrome (score, buttons) migrates from canvas overlay to HTML/CSS. Animation logic stays in `game.ts`. A new `audio.ts` module provides a self-contained `AudioEngine`. `grid.ts` gains `meetA`/`meetB` coordinates on eliminated pairs to drive collision animation.

**Tech Stack:** TypeScript, Vite, Canvas 2D API, Web Audio API, Playwright (E2E), Vitest (unit)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `workspace/index.html` | Modify | Add `#game-wrapper`, `#hud` with score/palette/mute/powerup slots; viewport meta |
| `workspace/src/game.ts` | Modify | DOM score sync, `resizeCanvas`, `handleMove`, touch events, audio calls, collision animation, powerup logic |
| `workspace/src/palettes.ts` | Modify | Redesign `pairHint` colors so pairs summing to 10 share a hue |
| `workspace/src/grid.ts` | Modify | Extend `EliminatedPair` with `meetA`/`meetB`; update `SlideResult`, `slideRowLeft`, `slide` |
| `workspace/src/audio.ts` | **Create** | `AudioEngine` class: programmatic Web Audio API sounds, mute toggle |
| `workspace/tests/unit/palettes.test.ts` | Modify | Add pairHint hue-pair assertions |
| `workspace/tests/unit/mergeAnimation.test.ts` | Modify | Update `eliminatedIndices` / `eliminatedPairs` tests to include `meetA`/`meetB` |
| `workspace/tests/unit/audio.test.ts` | **Create** | `AudioEngine` unit tests with mocked `AudioContext` |
| `workspace/tests/e2e/ux-v2.spec.ts` | **Create** | E2E tests for F1 DOM layout, F2 DOM score, F4 collision smoke, F5 powerup, F6 RWD+swipe |

---

## Phase A: F1 Layout + F2 Score + F2 pairHint

### Task 1: Add `#hud` footer bar (HTML + CSS)

**Files:**
- Modify: `workspace/index.html`
- Create: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write the failing E2E test**

Create `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("F1: #hud footer contains score, best, palette toggle, and mute button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#hud-score")).toBeVisible();
  await expect(page.locator("#hud-best")).toBeVisible();
  await expect(page.locator("#hud-palette-toggle")).toBeVisible();
  await expect(page.locator("#hud-mute")).toBeVisible();
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: FAIL — `Error: locator.toBeVisible: Locator: #hud` (element not found)

- [x] **Step 3: Implement — restructure `index.html`**

Replace `<div id="game-container">` block and related CSS in `index.html`. The full new `body` section and all relevant CSS changes:

In `<style>`, **replace** the existing `body` rule and add new rules:

```css
body {
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 16px;
  min-height: 100vh;
  background: #111;
  box-sizing: border-box;
}
#game-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}
#game-container {
  position: relative;
}
canvas {
  background: #222;
  border: 1px solid #444;
  display: block;
}
#hud {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #1a1a2e;
  border-radius: 0 0 8px 8px;
  box-sizing: border-box;
  gap: 8px;
}
#hud-score,
#hud-best {
  color: #fff;
  font-family: sans-serif;
  font-size: 15px;
  white-space: nowrap;
}
#hud-palette-toggle,
#hud-mute {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
}
#hud-powerups {
  display: flex;
  gap: 4px;
  align-items: center;
}
.hud-powerup-btn {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.25);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}
.hud-powerup-btn[data-active="true"] {
  border-color: #f59e0b;
  background: rgba(245,158,11,0.25);
}
.hud-powerup-count {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 10px;
  font-weight: bold;
  color: #fde047;
  pointer-events: none;
}
```

**Remove** the existing `#palette-toggle` CSS rule.

In `<body>`, **replace** the `<div id="game-container">...</div>` block with:

```html
<div id="game-wrapper">
  <div id="game-container">
    <canvas id="game" width="480" height="480"></canvas>
    <div id="score-popup"></div>
    <div id="combo-badge"></div>
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
  <div id="hud">
    <span id="hud-score">Score: 0</span>
    <span id="hud-best">Best: 0</span>
    <div id="hud-powerups"></div>
    <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
    <button id="hud-mute" aria-label="靜音">🔊</button>
  </div>
</div>
```

Also update canvas default size from `800` to `480` (RWD will override this at runtime anyway).

- [x] **Step 4: Run test to verify it passes**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: PASS — all 1 test passes

- [x] **Step 5: Commit**

```bash
git add workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: add #hud footer bar with score, palette, mute, and powerup slots"
```

---

### Task 2: Move score to DOM + remove canvas `ctx.fillText` score

**Files:**
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Add failing E2E test for DOM score**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("F1: score and best are shown in #hud-score and #hud-best DOM elements", async ({ page }) => {
  await page.goto("/");

  const mergeState = {
    grid: [
      [4, 6, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate(
    (s) => (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s),
    mergeState,
  );

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);

  const scoreText = await page.locator("#hud-score").textContent();
  expect(scoreText).toContain("10");
  const bestText = await page.locator("#hud-best").textContent();
  expect(bestText).toContain("10");
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "DOM elements"
```

Expected: FAIL — score DOM shows "Score: 0" even after move (DOM never updated)

- [x] **Step 3: Implement in `game.ts`**

At the top of `game.ts`, **update** the existing element references and **add** new ones. Replace:

```typescript
const paletteToggleEl = document.getElementById("palette-toggle") as HTMLButtonElement;
```

With:

```typescript
const paletteToggleEl = document.getElementById("hud-palette-toggle") as HTMLButtonElement;
const hudScoreEl = document.getElementById("hud-score") as HTMLSpanElement;
const hudBestEl = document.getElementById("hud-best") as HTMLSpanElement;
```

Add a helper function after the element declarations:

```typescript
function updateHudScore(): void {
  hudScoreEl.textContent = `Score: ${state.score}`;
  hudBestEl.textContent = `Best: ${bestScore}`;
}
```

In `render()`, **delete** lines 234–239 (the two `ctx.fillText` score lines):

```typescript
// DELETE these lines:
ctx.fillStyle = "#fff";
ctx.font = "20px sans-serif";
ctx.textAlign = "left";
ctx.textBaseline = "alphabetic";
ctx.fillText(`Score: ${state.score}`, 10, 20);
ctx.fillText(`Best: ${bestScore}`, 10, 45);
```

In `setState()`, add a call at the end:

```typescript
function setState(newState: GameState): void {
  state = newState;
  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  updateHudScore();  // ← ADD THIS
  render();
}
```

In `handleKeydown()`, after `state = { grid: newGrid, score: state.score + scoreGained }` and the best-score save:

```typescript
  updateHudScore();  // ← ADD after the bestScore localStorage.setItem block
```

Also call `updateHudScore()` once at the module level (at the bottom of the file, before `render()`), to initialize the DOM:

```typescript
updateHudScore();
render();
```

- [x] **Step 4: Run tests to verify pass**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all unit tests PASS, both ux-v2 E2E tests PASS

- [x] **Step 5: Commit**

```bash
git add workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: move score display from canvas to #hud DOM elements"
```

---

### Task 3: Redesign `pairHint` colors

**Files:**
- Modify: `workspace/src/palettes.ts`
- Modify: `workspace/tests/unit/palettes.test.ts`

- [x] **Step 1: Write failing unit test**

Append to `workspace/tests/unit/palettes.test.ts`:

```typescript
describe("pairHint palette — pairs summing to 10 share a hue family", () => {
  it("1 (light blue) and 9 (dark blue) use the specified colors", () => {
    expect(PALETTES.pairHint[1].bg).toBe("#bfdbfe");
    expect(PALETTES.pairHint[9].bg).toBe("#1d4ed8");
  });

  it("2 (light green) and 8 (dark green) use the specified colors", () => {
    expect(PALETTES.pairHint[2].bg).toBe("#bbf7d0");
    expect(PALETTES.pairHint[8].bg).toBe("#15803d");
  });

  it("3 (light orange) and 7 (dark orange) use the specified colors", () => {
    expect(PALETTES.pairHint[3].bg).toBe("#fed7aa");
    expect(PALETTES.pairHint[7].bg).toBe("#c2410c");
  });

  it("4 (light purple) and 6 (dark purple) use the specified colors", () => {
    expect(PALETTES.pairHint[4].bg).toBe("#e9d5ff");
    expect(PALETTES.pairHint[6].bg).toBe("#7c3aed");
  });

  it("5 uses mid-gold (self-pairs with itself to 10)", () => {
    expect(PALETTES.pairHint[5].bg).toBe("#fef08a");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npm run test:unit -- --reporter=verbose tests/unit/palettes.test.ts
```

Expected: FAIL — `expected '#7dd3fc' to be '#bfdbfe'` (current colors don't match)

- [x] **Step 3: Implement — update `pairHint` in `palettes.ts`**

Replace the `pairHint` entry in the `PALETTES` object:

```typescript
  pairHint: {
    1: { bg: "#bfdbfe", text: "#1e3a8a" },   // light blue  (pairs with 9)
    2: { bg: "#bbf7d0", text: "#14532d" },   // light green (pairs with 8)
    3: { bg: "#fed7aa", text: "#7c2d12" },   // light orange (pairs with 7)
    4: { bg: "#e9d5ff", text: "#4c1d95" },   // light purple (pairs with 6)
    5: { bg: "#fef08a", text: "#713f12" },   // mid gold (self-pair)
    6: { bg: "#7c3aed", text: "#ffffff" },   // dark purple (pairs with 4)
    7: { bg: "#c2410c", text: "#ffffff" },   // dark orange (pairs with 3)
    8: { bg: "#15803d", text: "#ffffff" },   // dark green (pairs with 2)
    9: { bg: "#1d4ed8", text: "#ffffff" },   // dark blue (pairs with 1)
  },
```

- [x] **Step 4: Run all unit tests to verify pass**

```bash
cd workspace && npm run test:unit
```

Expected: all tests PASS (including existing PALETTES structure test and new hue-pair tests)

- [x] **Step 5: Commit**

```bash
git add workspace/src/palettes.ts workspace/tests/unit/palettes.test.ts
git commit -m "feat: redesign pairHint palette so pairs summing to 10 share a hue family"
```

---

## Phase B: F6 RWD + Swipe

### Task 4: Canvas responsive resize

**Files:**
- Modify: `workspace/index.html`
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("F6: canvas width shrinks to fit a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await page.waitForTimeout(300);

  const canvasWidth = await page.evaluate(
    () => (document.getElementById("game") as HTMLCanvasElement).width,
  );

  expect(canvasWidth).toBeLessThan(360);
  expect(canvasWidth).toBeGreaterThan(280);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "narrow viewport"
```

Expected: FAIL — canvas.width is 480 regardless of viewport

- [x] **Step 3: Update viewport meta in `index.html`**

Replace:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

With:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
```

- [x] **Step 4: Add `resizeCanvas()` to `game.ts`**

After the constants section (after `SPAWN_DURATION_MS`), add:

```typescript
const HUD_HEIGHT = 64;
const CANVAS_PADDING = 16;
const CANVAS_MAX = 500;

function resizeCanvas(): void {
  const available = Math.min(
    window.innerWidth - CANVAS_PADDING,
    window.innerHeight - HUD_HEIGHT - CANVAS_PADDING,
  );
  const size = Math.min(available, CANVAS_MAX);
  canvas.width = size;
  canvas.height = size;
  render();
}

window.addEventListener("resize", resizeCanvas);
```

Replace the final `render()` call at the bottom of the file with:

```typescript
updateHudScore();
resizeCanvas();
```

- [x] **Step 5: Run tests to verify pass**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all tests PASS

- [x] **Step 6: Commit**

```bash
git add workspace/index.html workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: add responsive canvas resize and user-scalable=no viewport meta"
```

---

### Task 5: Extract `handleMove` + touch swipe controls

**Files:**
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("F6: touch swipe left eliminates a 4+6 pair and scores 10", async ({ page }) => {
  await page.goto("/");

  const touchState = {
    grid: [
      [null, null, 4, 6],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate(
    (s) => (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s),
    touchState,
  );

  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");

  const startX = box.x + box.width * 0.75;
  const endX   = box.x + box.width * 0.25;
  const midY   = box.y + box.height * 0.5;

  await page.evaluate(
    ({ sx, ex, y }) => {
      const el = document.getElementById("game")!;
      el.dispatchEvent(new TouchEvent("touchstart", {
        touches: [new Touch({ identifier: 1, target: el, clientX: sx, clientY: y })],
        bubbles: true, cancelable: true,
      }));
      el.dispatchEvent(new TouchEvent("touchend", {
        changedTouches: [new Touch({ identifier: 1, target: el, clientX: ex, clientY: y })],
        bubbles: true, cancelable: true,
      }));
    },
    { sx: startX, ex: endX, y: midY },
  );

  await page.waitForTimeout(100);
  const state = await page.evaluate(
    () => (window as unknown as { __getGameState: () => { score: number } }).__getGameState(),
  );
  expect(state.score).toBe(10);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "swipe left"
```

Expected: FAIL — score stays 0 (no touch handler exists)

- [x] **Step 3: Implement `handleMove` + touch in `game.ts`**

**Extract `handleMove` from `handleKeydown`**. In `game.ts`, replace the `handleKeydown` function with the following two functions:

```typescript
function handleMove(direction: Direction): void {
  if (isGameOver(state.grid)) return;

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const prevGrid = state.grid;
  const postSlideGrid = outcome.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);
  const scoreGained = outcome.scoreGained;

  const spawnedCells = changedCells(postSlideGrid, newGrid);

  const eliminatedPositionKeys = new Set(
    outcome.eliminatedPairs.flatMap((p) => [
      `${p.a.row},${p.a.col}`,
      `${p.b.row},${p.b.col}`,
    ]),
  );
  const spawnedKeys = new Set(spawnedCells.map((c) => `${c.row},${c.col}`));
  const allChanged = changedCells(prevGrid, newGrid);
  const movedCells = allChanged.filter((c) => {
    const key = `${c.row},${c.col}`;
    return (
      !eliminatedPositionKeys.has(key) &&
      !spawnedKeys.has(key) &&
      newGrid[c.row][c.col] !== null
    );
  });

  state = { grid: newGrid, score: state.score + scoreGained };

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  updateHudScore();

  if (scoreGained > 0) {
    showScorePopup(scoreGained);
  }

  const eliminatedPairs = outcome.eliminatedPairs;

  (window as unknown as {
    __lastAnimationHints: {
      eliminatedPairs: EliminatedPair[];
      spawnedCell: { row: number; col: number } | null;
      movedCells: Array<{ row: number; col: number }>;
      comboCount: number;
    };
  }).__lastAnimationHints = {
    eliminatedPairs,
    spawnedCell: spawnedCells[0] ?? null,
    movedCells,
    comboCount: eliminatedPairs.length,
  };

  if (eliminatedPairs.length >= 2) {
    setTimeout(() => showComboBadge(eliminatedPairs.length), 300);
  }

  startAnimations(prevGrid, eliminatedPairs, spawnedCells, movedCells, direction);
  startAnimationLoop();
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;
  handleMove(direction);
}
```

**Add touch swipe handler** after `window.addEventListener("keydown", handleKeydown)`:

```typescript
let touchStart: { x: number; y: number } | null = null;
const SWIPE_MIN_PX = 30;

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (activePowerup !== null) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (e) => {
    if (activePowerup !== null) {
      // powerup tap — handled by Task 11
      touchStart = null;
      return;
    }
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
    const direction: Direction =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
    handleMove(direction);
  },
  { passive: true },
);
```

Note: `activePowerup` is declared in Task 10. For now declare it as a placeholder at the module level before the touch handlers:

```typescript
let activePowerup: string | null = null;
```

- [x] **Step 4: Run tests to verify pass**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: extract handleMove and add touchstart/touchend swipe controls"
```

---

## Phase C: F3 Audio

### Task 6: `AudioEngine` class

**Files:**
- Create: `workspace/src/audio.ts`
- Create: `workspace/tests/unit/audio.test.ts`

- [x] **Step 1: Write failing unit test**

Create `workspace/tests/unit/audio.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioEngine } from "../../src/audio";

function makeMockCtx() {
  const mockGain = {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const mockOsc = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: "sine" as OscillatorType,
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  };
  return {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => mockOsc),
    createGain: vi.fn(() => mockGain),
  };
}

describe("AudioEngine", () => {
  beforeEach(() => {
    const ctx = makeMockCtx();
    vi.stubGlobal("AudioContext", vi.fn(() => ctx));
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it("play('move') does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("move")).not.toThrow();
  });

  it("play('eliminate') does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("eliminate")).not.toThrow();
  });

  it("play('gameOver') does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("gameOver")).not.toThrow();
  });

  it("play('combo', { comboCount: 3 }) does not throw", () => {
    const engine = new AudioEngine();
    expect(() => engine.play("combo", { comboCount: 3 })).not.toThrow();
  });

  it("toggleMute flips muted state", () => {
    const engine = new AudioEngine();
    expect(engine.isMuted).toBe(false);
    engine.toggleMute();
    expect(engine.isMuted).toBe(true);
    engine.toggleMute();
    expect(engine.isMuted).toBe(false);
  });

  it("play does not call AudioContext when muted", () => {
    const engine = new AudioEngine();
    engine.toggleMute();
    engine.play("move");
    expect(AudioContext).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npm run test:unit -- --reporter=verbose tests/unit/audio.test.ts
```

Expected: FAIL — `Cannot find module '../../src/audio'`

- [x] **Step 3: Create `workspace/src/audio.ts`**

```typescript
export type AudioEvent =
  | "move"
  | "eliminate"
  | "combo"
  | "spawn"
  | "gameOver"
  | "hammer"
  | "shuffle"
  | "addOne"
  | "bomb";

const MUTE_KEY = "mathMerge10Muted";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private _muted: boolean;

  constructor() {
    this._muted = localStorage.getItem(MUTE_KEY) === "true";
  }

  get isMuted(): boolean {
    return this._muted;
  }

  toggleMute(): void {
    this._muted = !this._muted;
    localStorage.setItem(MUTE_KEY, String(this._muted));
  }

  play(event: AudioEvent, options?: { comboCount?: number }): void {
    if (this._muted) return;
    const ctx = this.getCtx();
    switch (event) {
      case "move":      this.tone(ctx, 440, "sine", 0.08, 0.03); break;
      case "eliminate": this.rise(ctx, 523, 784, 0.2); break;
      case "combo":     this.combo(ctx, options?.comboCount ?? 2); break;
      case "spawn":     this.tone(ctx, 880, "triangle", 0.06, 0.02); break;
      case "gameOver":  this.fall(ctx, [784, 659, 523, 440], 0.6); break;
      case "hammer":    this.tone(ctx, 220, "square", 0.1, 0.04); break;
      case "shuffle":   this.shufflePops(ctx); break;
      case "addOne":    this.tone(ctx, 660, "sine", 0.1, 0.05); break;
      case "bomb":      this.boom(ctx); break;
    }
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    duration: number,
    attack: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + attack);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  private rise(ctx: AudioContext, from: number, to: number, duration: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.linearRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  private combo(ctx: AudioContext, count: number): void {
    const notes = count >= 3 ? [523, 659, 784, 1047] : [523, 659, 784];
    const step = 0.08;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.linearRampToValueAtTime(0, t + step);
      osc.start(t);
      osc.stop(t + step + 0.01);
    });
  }

  private fall(ctx: AudioContext, freqs: number[], total: number): void {
    const step = total / freqs.length;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0, t + step);
      osc.start(t);
      osc.stop(t + step + 0.01);
    });
  }

  private shufflePops(ctx: AudioContext): void {
    for (let i = 0; i < 5; i++) {
      const freq = 600 + i * 80;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.04;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.04);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  private boom(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.2);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}
```

- [x] **Step 4: Run tests to verify pass**

```bash
cd workspace && npm run test:unit -- --reporter=verbose tests/unit/audio.test.ts
```

Expected: all 6 tests PASS

- [x] **Step 5: Commit**

```bash
git add workspace/src/audio.ts workspace/tests/unit/audio.test.ts
git commit -m "feat: add AudioEngine class with Web Audio API programmatic sounds"
```

---

### Task 7: Wire audio into game events + mute button

**Files:**
- Modify: `workspace/src/game.ts`

- [x] **Step 1: Write E2E test (smoke: mute button toggles icon)**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("F3: mute button toggles between 🔊 and 🔇", async ({ page }) => {
  await page.goto("/");
  const muteBtn = page.locator("#hud-mute");
  await expect(muteBtn).toHaveText("🔊");
  await muteBtn.click();
  await expect(muteBtn).toHaveText("🔇");
  await muteBtn.click();
  await expect(muteBtn).toHaveText("🔊");
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "mute button"
```

Expected: FAIL — button text never changes (no click handler)

- [x] **Step 3: Wire audio in `game.ts`**

At the top of `game.ts`, add import:

```typescript
import { AudioEngine } from "./audio";
```

After the element declarations, add:

```typescript
const hudMuteEl = document.getElementById("hud-mute") as HTMLButtonElement;
const audio = new AudioEngine();

function updateMuteButton(): void {
  hudMuteEl.textContent = audio.isMuted ? "🔇" : "🔊";
}

hudMuteEl.addEventListener("click", () => {
  audio.toggleMute();
  updateMuteButton();
});
```

In `handleMove()`, after `if (!outcome.moved) return;` add:

```typescript
  if (scoreGained > 0) {
    audio.play("eliminate");
  } else {
    audio.play("move");
  }
```

(Move this block so it runs before `startAnimations`. Audio plays for all moves regardless of animation.)

After `spawnRandomTile`:

```typescript
  audio.play("spawn");
```

If the resulting newGrid is game over, play game over sound. Add after the `state = { ... }` assignment:

```typescript
  if (isGameOver(newGrid)) {
    setTimeout(() => audio.play("gameOver"), 400);
  }
```

In `showComboBadge()`, add at the start:

```typescript
function showComboBadge(count: number): void {
  audio.play("combo", { comboCount: count });  // ← ADD
  comboBadgeEl.textContent = `COMBO ×${count}`;
  // ... rest unchanged
```

Call `updateMuteButton()` once at module initialization (after the `hudMuteEl` + `audio` setup block), before `resizeCanvas()`.

- [x] **Step 4: Run all tests**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: wire AudioEngine into game events and add mute toggle button"
```

---

## Phase D: F4 Collision Animation

### Task 8: Extend `EliminatedPair` with `meetA`/`meetB` in `grid.ts`

**Files:**
- Modify: `workspace/src/grid.ts`
- Modify: `workspace/tests/unit/mergeAnimation.test.ts`

- [x] **Step 1: Update failing tests in `mergeAnimation.test.ts`**

The current tests assert exact `eliminatedIndices` and `eliminatedPairs` shapes that will break when we add `meetA`/`meetB`. Update them first:

**Replace** the `eliminatedIndices` `slideRowLeft` tests:

```typescript
describe("slideRowLeft eliminatedIndices", () => {
  it("returns [colA, colB, meetACol, meetBCol] for a single elimination at row start", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 3, null]);
    // 9(col0)+1(col1)=10; merged=[] before → meetACol=0, meetBCol=1
    expect(eliminatedIndices).toEqual([[0, 1, 0, 1]]);
  });

  it("returns two tuples when two pairs eliminated (combo)", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 5, 5]);
    // first pair: 9+1, meetA=0,meetB=1; second pair 5+5, meetA=0,meetB=1
    expect(eliminatedIndices).toEqual([[0, 1, 0, 1], [2, 3, 0, 1]]);
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
    const { eliminatedIndices } = slideRowLeft([null, 9, 1, 3]);
    // 9(col1)+1(col2)=10; merged=[] before → meetACol=0, meetBCol=1
    expect(eliminatedIndices).toEqual([[1, 2, 0, 1]]);
  });

  it("non-adjacent pair: meetA/meetB differ from original positions", () => {
    const { eliminatedIndices } = slideRowLeft([null, 3, null, 7]);
    // 3(col1)+7(col3)=10; merged=[] before → meetACol=0, meetBCol=1
    expect(eliminatedIndices).toEqual([[1, 3, 0, 1]]);
  });

  it("pair after a survivor: meetA at survivor count", () => {
    const { eliminatedIndices } = slideRowLeft([1, 2, 8, null]);
    // 2(col1)+8(col2)=10; merged=[1] before → meetACol=1, meetBCol=2
    expect(eliminatedIndices).toEqual([[1, 2, 1, 2]]);
  });
});
```

**Replace** the `slide eliminatedPairs` tests:

```typescript
describe("slide eliminatedPairs absolute grid coordinates", () => {
  const emptyRows = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ] as const;

  it("left slide: maps col indices and meetA/meetB to absolute coords", () => {
    const grid = [[9, 1, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 0 }, b: { row: 0, col: 1 },
        meetA: { row: 0, col: 0 }, meetB: { row: 0, col: 1 },
      },
    ]);
  });

  it("right slide: maps reversed col indices and meetA/meetB to absolute coords", () => {
    const grid = [[3, 9, 1, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "right");
    // reversed row = [null,1,9,3]; 1(pos1)+9(pos2)=10; meetACol=0,meetBCol=1 in reversed space
    // mirror: a.col=size-1-1=2, b.col=size-1-2=1, meetA.col=size-1-0=3, meetB.col=size-1-1=2
    expect(eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 2 }, b: { row: 0, col: 1 },
        meetA: { row: 0, col: 3 }, meetB: { row: 0, col: 2 },
      },
    ]);
  });

  it("up slide: maps transposed coords and meetA/meetB to absolute coords", () => {
    const grid = [
      [9, null, null, null],
      [1, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "up");
    // transposed: row0=[9,1,null,null]; meetACol=0,meetBCol=1 in transposed
    // transpose: a=(row:0,col:0), b=(row:1,col:0), meetA=(row:0,col:0), meetB=(row:1,col:0)
    expect(eliminatedPairs).toEqual([
      {
        a: { row: 0, col: 0 }, b: { row: 1, col: 0 },
        meetA: { row: 0, col: 0 }, meetB: { row: 1, col: 0 },
      },
    ]);
  });

  it("returns empty eliminatedPairs when no elimination occurs", () => {
    const grid = [[1, 2, 3, null], ...emptyRows];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([]);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd workspace && npm run test:unit -- --reporter=verbose tests/unit/mergeAnimation.test.ts
```

Expected: FAIL — `expected [ [0, 1] ] to equal [ [0, 1, 0, 1] ]` and structure mismatches

- [x] **Step 3: Update `grid.ts`**

**Update `EliminatedPair` interface**:

```typescript
export interface EliminatedPair {
  a: { row: number; col: number };
  b: { row: number; col: number };
  meetA: { row: number; col: number };
  meetB: { row: number; col: number };
}
```

**Update `SlideResult`** — `eliminatedIndices` now carries meeting column indices too:

```typescript
export interface SlideResult {
  row: Cell[];
  moved: boolean;
  scoreGained: number;
  eliminatedIndices: Array<[number, number, number, number]>;
}
```

**Update `slideRowLeft`** — when a pair is eliminated, record `merged.length` as `meetACol` and `merged.length + 1` as `meetBCol`:

```typescript
    if (next !== undefined && current + next === 10) {
      scoreGained += 10;
      eliminatedIndices.push([
        valuePositions[i],
        valuePositions[i + 1],
        merged.length,
        merged.length + 1,
      ]);
      i += 2;
```

**Update `applySlideRowLeftToGrid`** — destructure the 4-tuple:

```typescript
    result.eliminatedIndices.forEach(([colA, colB, meetACol, meetBCol]) => {
      eliminatedPairs.push({
        a: { row: rowIndex, col: colA },
        b: { row: rowIndex, col: colB },
        meetA: { row: rowIndex, col: meetACol },
        meetB: { row: rowIndex, col: meetBCol },
      });
    });
```

**Update `slide`** — add `meetA`/`meetB` to each direction's coordinate transform:

```typescript
    case "right": {
      const outcome = applySlideRowLeftToGrid(reverseRows(grid));
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.row, col: size - 1 - a.col },
        b: { row: b.row, col: size - 1 - b.col },
        meetA: { row: meetA.row, col: size - 1 - meetA.col },
        meetB: { row: meetB.row, col: size - 1 - meetB.col },
      }));
      return { ...outcome, grid: reverseRows(outcome.grid), eliminatedPairs: pairs };
    }
    case "up": {
      const outcome = applySlideRowLeftToGrid(transpose(grid));
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: a.col, col: a.row },
        b: { row: b.col, col: b.row },
        meetA: { row: meetA.col, col: meetA.row },
        meetB: { row: meetB.col, col: meetB.row },
      }));
      return { ...outcome, grid: transpose(outcome.grid), eliminatedPairs: pairs };
    }
    case "down": {
      const outcome = applySlideRowLeftToGrid(reverseRows(transpose(grid)));
      const pairs = outcome.eliminatedPairs.map(({ a, b, meetA, meetB }) => ({
        a: { row: size - 1 - a.col, col: a.row },
        b: { row: size - 1 - b.col, col: b.row },
        meetA: { row: size - 1 - meetA.col, col: meetA.row },
        meetB: { row: size - 1 - meetB.col, col: meetB.row },
      }));
      return { ...outcome, grid: transpose(reverseRows(outcome.grid)), eliminatedPairs: pairs };
    }
```

- [x] **Step 4: Run all unit tests to verify pass**

```bash
cd workspace && npm run test:unit
```

Expected: all tests PASS (including all pre-existing `grid.test.ts`, `specRequirements.test.ts`, `gameRules.test.ts`)

- [x] **Step 5: Commit**

```bash
git add workspace/src/grid.ts workspace/tests/unit/mergeAnimation.test.ts
git commit -m "feat: extend EliminatedPair with meetA/meetB collision positions"
```

---

### Task 9: Collision animation — slide-then-flash at meeting position

**Files:**
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("F4: collision animation — eliminated pair phantom moves to meeting position before flash", async ({
  page,
}) => {
  await page.goto("/");

  // Non-adjacent pair: 3 at col1, 7 at col3. After left slide they meet at col0 + col1.
  const animState = {
    grid: [
      [null, 3, null, 7],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate(
    (s) => (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s),
    animState,
  );

  await page.keyboard.press("ArrowLeft");

  // 50ms into animation: move phase should be active; no flash at col1/col3 (original positions)
  await page.waitForTimeout(50);
  const hints = await page.evaluate(
    () =>
      (
        window as unknown as {
          __lastAnimationHints: { eliminatedPairs: Array<{ meetA: { col: number }; meetB: { col: number } }> };
        }
      ).__lastAnimationHints,
  );

  // meetA.col should be 0 (not 1), meetB.col should be 1 (not 3)
  expect(hints.eliminatedPairs[0].meetA.col).toBe(0);
  expect(hints.eliminatedPairs[0].meetB.col).toBe(1);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "collision animation"
```

Expected: FAIL — `meetA` / `meetB` not on `__lastAnimationHints.eliminatedPairs` entries (old interface had only `a`/`b`)

- [x] **Step 3: Update `moveCells` type + `startAnimations` + `render` in `game.ts`**

**Update moveCells map type** (find the declaration and change):

```typescript
// OLD:
const moveCells = new Map<string, { startTime: number; direction: Direction }>();

// NEW:
const moveCells = new Map<
  string,
  {
    startTime: number;
    direction: Direction;
    value?: number;
    fromRow?: number;
    fromCol?: number;
    toRow?: number;
    toCol?: number;
  }
>();
```

**Update `startAnimations`** — replace the existing `eliminatedPairs.forEach` block and add phantom moveCells entries:

```typescript
function startAnimations(
  prevGrid: GameGrid,
  eliminatedPairs: EliminatedPair[],
  spawnedCells: Array<{ row: number; col: number }>,
  movedCellsList: Array<{ row: number; col: number }>,
  direction: Direction,
): void {
  const now = performance.now();

  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  // Regular moved tiles (non-eliminated): small spring animation
  movedCellsList.forEach(({ row, col }) => {
    moveCells.set(`${row},${col}`, { startTime: now, direction });
  });

  // Eliminated tiles: phase 1 = slide phantom from original → meeting position
  //                   phase 2 = flash at meeting position (delayed by MOVE_DURATION_MS)
  eliminatedPairs.forEach(({ a, b, meetA, meetB }) => {
    const valA = prevGrid[a.row][a.col];
    const valB = prevGrid[b.row][b.col];
    if (valA !== null) {
      moveCells.set(`${a.row},${a.col}`, {
        startTime: now,
        direction,
        value: valA,
        fromRow: a.row,
        fromCol: a.col,
        toRow: meetA.row,
        toCol: meetA.col,
      });
      eliminatingCells.set(`${meetA.row},${meetA.col}`, {
        value: valA,
        startTime: now + MOVE_DURATION_MS,
      });
    }
    if (valB !== null) {
      moveCells.set(`${b.row},${b.col}`, {
        startTime: now,
        direction,
        value: valB,
        fromRow: b.row,
        fromCol: b.col,
        toRow: meetB.row,
        toCol: meetB.col,
      });
      eliminatingCells.set(`${meetB.row},${meetB.col}`, {
        value: valB,
        startTime: now + MOVE_DURATION_MS,
      });
    }
  });

  spawnedCells.forEach(({ row, col }) => {
    spawnCells.set(`${row},${col}`, now + SPAWN_DELAY_MS);
  });
}
```

**Update `render`** — add a phantom-slide loop after the `state.grid.forEach` loop (and before the `eliminatingCells.forEach` loop):

```typescript
  // Draw phantom tiles for eliminated cells during their slide phase
  moveCells.forEach(({ value, startTime, fromRow, fromCol, toRow, toCol }, _key) => {
    if (value === undefined || fromRow === undefined) return;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / MOVE_DURATION_MS);
    if (t >= 1) return;
    const p = 1 - Math.pow(1 - t, 2); // ease-out
    const x = lerp(fromCol! * cellSize, toCol! * cellSize, p);
    const y = lerp(fromRow * cellSize, toRow! * cellSize, p);
    const scale = lerp(0.8, 1.0, p);
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    drawBaseTile(value, x, y, cellSize, padding, 0);
    ctx.restore();
  });
```

- [x] **Step 4: Run all tests**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: collision animation — tiles slide to meeting position before flash"
```

---

## Phase E: F5 Power-ups

### Task 10: `PowerupState` + unlock logic

**Files:**
- Modify: `workspace/src/game.ts`
- Create: `workspace/tests/unit/powerups.test.ts`

- [x] **Step 1: Write failing unit test**

Create `workspace/tests/unit/powerups.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the unlock functions exported from a helper module.
// Since game.ts is a browser entry point, we extract pure logic functions here
// as part of implementation (added in Step 3).
import {
  computePlayCountAward,
  computeBestScoreAward,
} from "../../src/powerups";

describe("computePlayCountAward", () => {
  it("returns null on plays not divisible by 5", () => {
    expect(computePlayCountAward(1)).toBeNull();
    expect(computePlayCountAward(3)).toBeNull();
    expect(computePlayCountAward(7)).toBeNull();
  });

  it("returns 'hammer' or 'shuffle' on every 5th play (non-10th)", () => {
    const award = computePlayCountAward(5);
    expect(["hammer", "shuffle"]).toContain(award);
    const award15 = computePlayCountAward(15);
    expect(["hammer", "shuffle"]).toContain(award15);
  });

  it("returns 'addOne' on every 10th play", () => {
    expect(computePlayCountAward(10)).toBe("addOne");
    expect(computePlayCountAward(20)).toBe("addOne");
    expect(computePlayCountAward(30)).toBe("addOne");
  });
});

describe("computeBestScoreAward", () => {
  it("returns 0 bombs when neither 50 threshold nor new 100-multiple crossed", () => {
    expect(computeBestScoreAward(40, 45)).toBe(0);
    expect(computeBestScoreAward(55, 70)).toBe(0);
  });

  it("returns 1 bomb when crossing 50 for the first time", () => {
    expect(computeBestScoreAward(40, 55)).toBe(1);
    expect(computeBestScoreAward(0, 50)).toBe(1);
  });

  it("returns 1 bomb when crossing a new 100-multiple (above 50)", () => {
    expect(computeBestScoreAward(60, 100)).toBe(1);
    expect(computeBestScoreAward(150, 210)).toBe(1);
  });

  it("returns 2 bombs when crossing both 50 threshold and a 100-multiple in one score jump", () => {
    // old=0, new=100: crosses 50 (+1) AND first 100-multiple (+1)
    expect(computeBestScoreAward(0, 100)).toBe(2);
  });

  it("returns multiple bombs when multiple 100-multiples crossed", () => {
    expect(computeBestScoreAward(60, 250)).toBe(2); // 100 and 200
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npm run test:unit -- --reporter=verbose tests/unit/powerups.test.ts
```

Expected: FAIL — `Cannot find module '../../src/powerups'`

- [x] **Step 3: Create `workspace/src/powerups.ts`** (pure logic, no DOM)

```typescript
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

/**
 * Returns which powerup (if any) is awarded at the given play count.
 * Every 10th play → addOne; every non-10th 5th play → hammer or shuffle (random).
 */
export function computePlayCountAward(
  playCount: number,
  rng: () => number = Math.random,
): PowerupId | null {
  if (playCount % 10 === 0) return "addOne";
  if (playCount % 5 === 0) return rng() < 0.5 ? "hammer" : "shuffle";
  return null;
}

/**
 * Returns how many bombs to award given the old and new best score.
 * +1 for first crossing of 50; +N for each new 100-multiple crossed.
 */
export function computeBestScoreAward(oldBest: number, newBest: number): number {
  let bombs = 0;
  if (oldBest < 50 && newBest >= 50) bombs += 1;
  const oldHundreds = Math.floor(oldBest / 100);
  const newHundreds = Math.floor(newBest / 100);
  if (newHundreds > oldHundreds) bombs += newHundreds - oldHundreds;
  return bombs;
}
```

**Add powerup state to `game.ts`**:

At the top of `game.ts`, import the new module:

```typescript
import {
  type PowerupId,
  type PowerupState,
  emptyPowerups,
  computePlayCountAward,
  computeBestScoreAward,
} from "./powerups";
```

Add constants and state after `PALETTE_KEY`:

```typescript
const POWERUP_KEY   = "mathMerge10Powerups";
const PLAY_COUNT_KEY = "mathMerge10PlayCount";
```

Add loader/saver functions:

```typescript
function loadPowerups(): PowerupState {
  try {
    const raw = localStorage.getItem(POWERUP_KEY);
    if (raw) return { ...emptyPowerups(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return emptyPowerups();
}

function savePowerups(): void {
  localStorage.setItem(POWERUP_KEY, JSON.stringify(powerups));
}

function loadPlayCount(): number {
  return parseInt(localStorage.getItem(PLAY_COUNT_KEY) ?? "0", 10);
}
```

Add state variables after `currentPalette`:

```typescript
let powerups: PowerupState = loadPowerups();
```

Replace the placeholder `let activePowerup: string | null = null;` from Task 5 with the typed version:

```typescript
let activePowerup: PowerupId | null = null;
```

Add the `incrementPlayCount` call inside `setState` (when score is 0 = new game started):

```typescript
function setState(newState: GameState): void {
  state = newState;
  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  if (state.score > bestScore) {
    const bombs = computeBestScoreAward(bestScore, state.score);
    if (bombs > 0) {
      powerups.bomb += bombs;
      savePowerups();
    }
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  if (newState.score === 0) {
    // New game started
    const newCount = loadPlayCount() + 1;
    localStorage.setItem(PLAY_COUNT_KEY, String(newCount));
    const award = computePlayCountAward(newCount);
    if (award) {
      powerups[award]++;
      savePowerups();
    }
  }

  updateHudScore();
  render();
}
```

Also update `handleMove` to call `computeBestScoreAward` when updating bestScore:

```typescript
  if (state.score > bestScore) {
    const bombs = computeBestScoreAward(bestScore, state.score);
    if (bombs > 0) {
      powerups.bomb += bombs;
      savePowerups();
    }
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
```

- [x] **Step 4: Run all tests**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add workspace/src/powerups.ts workspace/src/game.ts workspace/tests/unit/powerups.test.ts
git commit -m "feat: add PowerupState, unlock logic (play count + best score milestones)"
```

---

### Task 11: Power-up UI + canvas click/tap handler

**Files:**
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("F5: hammer powerup removes a tile when activated and clicked on canvas", async ({ page }) => {
  await page.goto("/");

  // Inject 1 hammer and set a known grid
  const hammerState = {
    grid: [
      [5, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate((s) => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s);
    (window as unknown as { __setPowerups: (p: unknown) => void }).__setPowerups({
      hammer: 1, shuffle: 0, addOne: 0, bomb: 0,
    });
  }, hammerState);

  // Click the hammer button in the HUD
  await page.locator(".hud-powerup-btn[data-powerup='hammer']").click();

  // Click on the canvas at row 0 col 0 (the tile with value 5)
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("No canvas");
  const cellSize = box.width / 4;
  await page.mouse.click(box.x + cellSize * 0.5, box.y + cellSize * 0.5);

  // Tile at row 0 col 0 should now be null
  const state = await page.evaluate(
    () => (window as unknown as { __getGameState: () => { grid: (number | null)[][] } }).__getGameState(),
  );
  expect(state.grid[0][0]).toBeNull();
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "hammer powerup"
```

Expected: FAIL — `Error: locator.click: .hud-powerup-btn[data-powerup='hammer']` (element not found, and `__setPowerups` not exposed)

- [x] **Step 3: Implement powerup UI in `game.ts`**

Add `renderHudPowerups` and apply functions. After the `savePowerups` function:

```typescript
function renderHudPowerups(): void {
  const container = document.getElementById("hud-powerups")!;
  container.innerHTML = "";
  const defs: Array<{ id: PowerupId; icon: string }> = [
    { id: "hammer", icon: "🔨" },
    { id: "shuffle", icon: "🔀" },
    { id: "addOne", icon: "➕" },
    { id: "bomb", icon: "💣" },
  ];
  defs.forEach(({ id, icon }) => {
    const count = powerups[id];
    if (count === 0) return;
    const btn = document.createElement("button");
    btn.className = "hud-powerup-btn";
    btn.dataset.powerup = id;
    btn.dataset.active = String(activePowerup === id);
    btn.title = id;
    btn.innerHTML = `${icon}<span class="hud-powerup-count">${count}</span>`;
    btn.addEventListener("click", () => {
      activePowerup = activePowerup === id ? null : id;
      canvas.style.outline = activePowerup ? "3px solid #f59e0b" : "";
      renderHudPowerups();
    });
    container.appendChild(btn);
  });
}
```

Add powerup application functions:

```typescript
function applyHammer(row: number, col: number): void {
  if (state.grid[row][col] === null) return;
  const newGrid = state.grid.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? null : c)),
  );
  setState({ ...state, grid: newGrid });
  powerups.hammer--;
  savePowerups();
  audio.play("hammer");
  renderHudPowerups();
}

function applyShuffle(): void {
  const tiles: Array<{ row: number; col: number; value: number }> = [];
  state.grid.forEach((r, ri) =>
    r.forEach((c, ci) => {
      if (c !== null) tiles.push({ row: ri, col: ci, value: c });
    }),
  );
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i].value, tiles[j].value] = [tiles[j].value, tiles[i].value];
  }
  const newGrid = state.grid.map((r) => r.map(() => null as number | null));
  tiles.forEach(({ row, col, value }) => {
    newGrid[row][col] = value;
  });
  setState({ ...state, grid: newGrid });
  powerups.shuffle--;
  savePowerups();
  audio.play("shuffle");
  renderHudPowerups();
}

function applyAddOne(row: number, col: number): void {
  const value = state.grid[row][col];
  if (value === null || value >= 9) return;
  const newGrid = state.grid.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? value + 1 : c)),
  );
  setState({ ...state, grid: newGrid });
  powerups.addOne--;
  savePowerups();
  audio.play("addOne");
  renderHudPowerups();
}

function applyBomb(row: number, col: number): void {
  const newGrid = state.grid.map((r, ri) =>
    r.map((c, ci) => {
      const isCenter = ri === row && ci === col;
      const isAdjacent =
        (ri === row - 1 && ci === col) ||
        (ri === row + 1 && ci === col) ||
        (ri === row && ci === col - 1) ||
        (ri === row && ci === col + 1);
      return isCenter || isAdjacent ? null : c;
    }),
  );
  setState({ ...state, grid: newGrid });
  powerups.bomb--;
  savePowerups();
  audio.play("bomb");
  renderHudPowerups();
}
```

Add canvas click handler (after the touch event listeners from Task 5):

```typescript
canvas.addEventListener("click", (e) => {
  if (activePowerup === null) return;
  const rect = canvas.getBoundingClientRect();
  const cs = canvas.width / GRID_SIZE;
  const col = Math.floor((e.clientX - rect.left) / cs);
  const row = Math.floor((e.clientY - rect.top) / cs);
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;

  const id = activePowerup;
  activePowerup = null;
  canvas.style.outline = "";

  switch (id) {
    case "hammer":  applyHammer(row, col); break;
    case "addOne":  applyAddOne(row, col); break;
    case "bomb":    applyBomb(row, col); break;
    case "shuffle": applyShuffle(); break;
  }
});
```

Update touchend handler so powerup tap mode uses click (already handled by click event above). Replace the `activePowerup !== null` early return in touchend with proper cell resolution:

```typescript
canvas.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;

    if (activePowerup !== null) {
      // Powerup tap: resolve cell from touch position
      const rect = canvas.getBoundingClientRect();
      const cs = canvas.width / GRID_SIZE;
      const col = Math.floor((e.changedTouches[0].clientX - rect.left) / cs);
      const row = Math.floor((e.changedTouches[0].clientY - rect.top) / cs);
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        const id = activePowerup;
        activePowerup = null;
        canvas.style.outline = "";
        switch (id) {
          case "hammer":  applyHammer(row, col); break;
          case "addOne":  applyAddOne(row, col); break;
          case "bomb":    applyBomb(row, col); break;
          case "shuffle": applyShuffle(); break;
        }
      }
      return;
    }

    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
    const direction: Direction =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0 ? "right" : "left"
        : dy > 0 ? "down" : "up";
    handleMove(direction);
  },
  { passive: true },
);
```

Expose `__setPowerups` for testing. At the bottom of `game.ts` (alongside the other test exports):

```typescript
(window as unknown as { __setPowerups: (p: PowerupState) => void }).__setPowerups = (p) => {
  powerups = p;
  renderHudPowerups();
};
```

Add `renderHudPowerups()` call during initialization (before the final `resizeCanvas()`).

- [x] **Step 4: Run all tests**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: add powerup UI (hammer, shuffle, addOne, bomb) with canvas click/tap activation"
```

---

## Final Verification

- [x] **Run full test suite**

```bash
cd workspace && npm run test:unit && npm run test:e2e
```

Expected: all unit tests PASS, all E2E tests PASS (including pre-existing tests in `math-merge.spec.ts`, `interaction.spec.ts`, `visual-effects.spec.ts`, `merge-animation.spec.ts`)

- [x] **Build check**

```bash
cd workspace && npm run build
```

Expected: build succeeds with no TypeScript errors

---

## Spec Coverage Checklist

| Feature | Task(s) | Spec Section |
|---------|---------|--------------|
| F1: #hud footer layout | 1, 2 | Feature 1 |
| F2: pairHint redesign | 3 | Feature 2 |
| F3: AudioEngine + mute | 6, 7 | Feature 3 |
| F4: Collision animation | 8, 9 | Feature 4 |
| F5: Power-up system | 10, 11 | Feature 5 |
| F6: RWD canvas resize | 4 | Feature 6 |
| F6: Touch swipe | 5 | Feature 6 |
| F6: `user-scalable=no` viewport | 4 | Feature 6 |
| F5: `rewardAd()` stub | — | Out of scope (placeholder only) |
