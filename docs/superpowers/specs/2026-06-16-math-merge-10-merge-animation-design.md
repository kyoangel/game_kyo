# Math Merge 10 — Merge Animation & Combo Feedback v1 Design

**Date:** 2026-06-16
**Status:** Approved

---

## Goal

Give players clear visual feedback that distinguishes the three types of tile events that happen on every move:

1. **Eliminate** — two tiles that sum to 10 flash white and shrink to nothing
2. **Move** — tiles that slide to a new position ease in from the direction of the keypress
3. **Spawn** — the newly generated tile drops in from above with a spring bounce and brief green glow
4. **Combo** — when 2 or more pairs are eliminated in a single move, a "COMBO ×N" badge appears over the board

The existing score popup ("+10" DOM element from Visual Effects v1) is unchanged and still handles score feedback. The elimination animation does **not** display any text.

---

## Constraint

`workspace/src/grid.ts` **may be modified** for this feature — specifically to extend return types. The pure rule logic (elimination condition `a + b === 10`, compaction, score) must not change.

---

## Architecture

### Problem

`grid.ts`'s `slide()` currently returns `{ grid, moved, scoreGained }`. It does not expose which cells were eliminated. From the outside, a moved tile and an eliminated tile both look like a "changed cell" in `changedCells(prevGrid, nextGrid)` — they cannot be distinguished.

### Solution: extend grid.ts return types

Add `eliminatedIndices` to `SlideResult` and `eliminatedPairs` to `SlideOutcome`. No existing fields change. The pure rule logic in `slideRowLeft` is unchanged — only the return value gains extra data.

**New exported type in `grid.ts`:**
```typescript
export interface EliminatedPair {
  a: CellPosition;  // { row, col } of first tile
  b: CellPosition;  // { row, col } of second tile
}
```

`CellPosition` is already exported from `gridDiff.ts`. Import it there, or duplicate the two-field interface in `grid.ts` to avoid a circular dependency — prefer duplication to keep `grid.ts` self-contained.

**`SlideResult` extension:**
```typescript
export interface SlideResult {
  row: Cell[];
  moved: boolean;
  scoreGained: number;
  eliminatedIndices: Array<[number, number]>;  // pairs of column indices within the row
}
```

**`SlideOutcome` extension:**
```typescript
export interface SlideOutcome {
  grid: GameGrid;
  moved: boolean;
  scoreGained: number;
  eliminatedPairs: EliminatedPair[];  // absolute grid coordinates
}
```

`applyMove` signature and behaviour are **unchanged** — it still returns `GameState`. `game.ts` calls `slide()` directly (it already imported it) to access `eliminatedPairs`, then calls `spawnRandomTile` itself to rebuild the equivalent of `applyMove`. This avoids adding animation metadata to pure game state.

### New animation state in game.ts

Three new `Map`s replace the single `animatingCells` map from Visual Effects v1:

| Map | Purpose | Value type |
|-----|---------|------------|
| `eliminatingCells` | Phantom tiles being eliminated (no longer in `state.grid`) | `{ value: number; startTime: number }` |
| `spawnCells` | Tile doing the drop-in spawn animation | `number` (startTime) |
| `moveCells` | Tiles that slid to a new position | `{ startTime: number; direction: Direction }` |

The old `animatingCells` map is removed. Its grow-in animation is replaced by the three distinct animations above.

`render()` draws `state.grid` first, then iterates `eliminatingCells` to draw phantom tiles on top — this is required because eliminated cells are already `null` in `state.grid` by the time the animation runs.

### Event detection in handleKeydown

```typescript
function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const prevGrid = state.grid;
  const postSlideGrid = outcome.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);

  const scoreGained = outcome.scoreGained;
  const newState: GameState = { grid: newGrid, score: state.score + scoreGained };

  // Detect spawned cell: null in postSlideGrid, non-null in newGrid
  const spawnedCells = changedCells(postSlideGrid, newGrid);  // always 0 or 1

  // Detect moved cells: non-null in newGrid, not an eliminated position, not spawned
  const eliminatedPositionKeys = new Set(
    outcome.eliminatedPairs.flatMap(p => [
      `${p.a.row},${p.a.col}`,
      `${p.b.row},${p.b.col}`,
    ])
  );
  const spawnedKeys = new Set(spawnedCells.map(c => `${c.row},${c.col}`));
  const allChanged = changedCells(prevGrid, newGrid);
  const movedCells = allChanged.filter(c => {
    const key = `${c.row},${c.col}`;
    return !eliminatedPositionKeys.has(key) && !spawnedKeys.has(key)
           && newGrid[c.row][c.col] !== null;
  });

  startAnimations(outcome.eliminatedPairs, spawnedCells, movedCells, direction);
  updateState(newState, scoreGained);
}
```

`startAnimations` and `updateState` are internal helpers that set up the animation maps and update `state`/`bestScore`/score popup respectively.

---

## Animation Specs

### 1. Eliminate — 350 ms

Both tiles in the pair animate identically and simultaneously.

```
0 ms   : phantom tile drawn at normal scale, normal palette colour
60 ms  : scale → 1.15, background → rgba(255,255,255,0.5), box glow #facc15
200 ms : scale → 0, opacity → 0
350 ms : phantom removed from eliminatingCells
```

Easing: `ease-in`. No text is displayed. The background colour transitions to a bright white flash before shrinking.

### 2. Move — 150 ms

Tile appears at its new position and eases in from the direction of the keypress (opposite edge).

| Keypress | Initial offset |
|----------|---------------|
| Left     | `translateX(+16px) scale(0.65)` |
| Right    | `translateX(-16px) scale(0.65)` |
| Up       | `translateY(+16px) scale(0.65)` |
| Down     | `translateY(-16px) scale(0.65)` |

```
0 ms   : offset + scale 0.65
150 ms : translateX/Y(0) scale(1.0)
```

Easing: `ease-out`. No colour change — tile uses its normal palette colour.

### 3. Spawn — 400 ms

```
0 ms   : translateY(-64px) scale(0.4) opacity 0
200 ms : translateY(+6px)  scale(1.1) opacity 1   ← overshoot
300 ms : translateY(-3px)  scale(0.97)
400 ms : translateY(0)     scale(1.0)
```

Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (spring feel). A green glow (`box-shadow: 0 0 20px 6px #4ade80`) fades in at 0 ms and fades out by 400 ms.

### 4. Combo badge — appears at 300 ms, gone by 800 ms

Condition: `outcome.eliminatedPairs.length >= 2`

Badge text: `"COMBO ×N"` where N = `eliminatedPairs.length`.

```
300 ms : badge appears, scale 0.3 → 1.1 → 1.0 over 150 ms
         board container gets a single orange pulse (box-shadow #f59e0b)
800 ms : badge opacity 1 → 0 over 150 ms
```

The badge is an absolutely-positioned DOM element inside `#game-container` (same pattern as `#score-popup`). It does not overlap the score popup — it is centred over the canvas.

---

## Files Changed

| File | Change |
|------|--------|
| `workspace/src/grid.ts` | Add `EliminatedPair`, extend `SlideResult.eliminatedIndices`, extend `SlideOutcome.eliminatedPairs` |
| `workspace/src/game.ts` | Replace `animatingCells` with three maps; rewrite `handleKeydown`; extend `render()` for phantom tiles and per-event animation |
| `workspace/index.html` | Add `#combo-badge` div (absolute, centred, hidden by default) and its CSS |
| `workspace/tests/unit/mergeAnimation.test.ts` | New — unit tests for extended `grid.ts` return values |
| `workspace/tests/e2e/merge-animation.spec.ts` | New — E2E tests via `__lastAnimationHints` test hook |

`gridDiff.ts`, `palettes.ts`, `scoring.ts` are **unchanged**.

---

## Test Hook

`game.ts` exposes a test hook after every move:

```typescript
(window as unknown as {
  __lastAnimationHints: {
    eliminatedPairs: EliminatedPair[];
    spawnedCell: CellPosition | null;
    movedCells: CellPosition[];
    comboCount: number;
  };
}).__lastAnimationHints = { eliminatedPairs, spawnedCell: spawnedCells[0] ?? null, movedCells, comboCount: eliminatedPairs.length };
```

---

## Unit Tests (mergeAnimation.test.ts)

```typescript
import { slideRowLeft, slide, createEmptyGrid } from "../../src/grid";

describe("slideRowLeft eliminatedIndices", () => {
  it("returns pair indices for a single elimination", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 3, null]);
    expect(eliminatedIndices).toEqual([[0, 1]]);
  });
  it("returns pair indices for two eliminations (combo)", () => {
    const { eliminatedIndices } = slideRowLeft([9, 1, 5, 5]);
    expect(eliminatedIndices).toEqual([[0, 1], [2, 3]]);
  });
  it("returns empty when no elimination", () => {
    const { eliminatedIndices } = slideRowLeft([1, 2, 3, null]);
    expect(eliminatedIndices).toEqual([]);
  });
  it("does not change scoreGained or row output", () => {
    const result = slideRowLeft([9, 1, 3, null]);
    expect(result.scoreGained).toBe(10);
    expect(result.row).toEqual([3, null, null, null]);
  });
});

describe("slide eliminatedPairs absolute coordinates", () => {
  it("maps row indices to absolute grid coords for left slide", () => {
    const grid = [
      [9, 1, 3, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([{ a: { row: 0, col: 0 }, b: { row: 0, col: 1 } }]);
  });
  it("maps correctly for right slide (reversed row)", () => {
    const grid = [
      [3, 9, 1, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    // sliding right: row reversed → [null,1,9,3] → 1+9 eliminated at reversed indices [1,2]
    // absolute col: grid cols reversed → reversed[1]=col2, reversed[2]=col1
    const { eliminatedPairs } = slide(grid, "right");
    expect(eliminatedPairs).toEqual([{ a: { row: 0, col: 2 }, b: { row: 0, col: 1 } }]);
  });
  it("returns empty eliminatedPairs when no elimination occurs", () => {
    const grid = [
      [1, 2, 3, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    const { eliminatedPairs } = slide(grid, "left");
    expect(eliminatedPairs).toEqual([]);
  });
});
```

---

## E2E Tests (merge-animation.spec.ts)

```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

test("elimination triggers eliminatedPairs hint", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState({
      grid: [[9,1,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]],
      score: 0,
    }, () => 0);
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(1);
  expect(hints.eliminatedPairs[0].a).toEqual({ row: 0, col: 0 });
  expect(hints.eliminatedPairs[0].b).toEqual({ row: 0, col: 1 });
  expect(hints.comboCount).toBe(1);
});

test("two simultaneous eliminations produce comboCount 2", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState({
      grid: [[9,1,5,5],[null,null,null,null],[null,null,null,null],[null,null,null,null]],
      score: 0,
    }, () => 0);
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(2);
  expect(hints.comboCount).toBe(2);
});

test("no elimination produces empty eliminatedPairs", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState({
      grid: [[1,2,3,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]],
      score: 0,
    }, () => 0);
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(0);
  expect(hints.spawnedCell).not.toBeNull();
  expect(hints.movedCells.length).toBeGreaterThan(0);
});
```

---

## Out of Scope

- Sound effects
- Particle burst / sparkle effects beyond the glow
- Per-tile trail effects during movement
- Number display on tiles during elimination animation (tiles show their value until they vanish)
