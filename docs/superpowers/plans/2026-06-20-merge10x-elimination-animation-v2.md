# merge10x Elimination Animation v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current simultaneous-group elimination animation with a 3-phase pipeline: C1 (all tiles compact together) → sequential H/F per group → C2 (remaining tiles fill the gap) → Spawn.

**Architecture:** `grid.ts` gains `firstCompactedStart` (the group's position in the pre-elimination compacted array, = scan index `i` at push time). `game.ts` gains `ElimPhaseState` with sequential group timing, a `recompactCells` Map that animates surviving tiles through two moves (orig→firstCompact in C1, firstCompact→final in C2), and updated `render()`/`tick()`. The old `PhantomGroup[]` state is replaced entirely.

**Tech Stack:** TypeScript, Canvas 2D API, Vitest (unit), Playwright (E2E).

---

## File Map

| File | Change |
|------|--------|
| `workspace-merge10x/src/grid.ts` | Add `firstCompactedStart: number` to `SlideGroupInfo` + `EliminatedGroup`; set as `i` at push time; same direction transforms as `compactedStart` |
| `workspace-merge10x/tests/unit/grid.test.ts` | Add `firstCompactedStart` assertions |
| `workspace-merge10x/src/game.ts` | Full animation refactor: new `ElimPhaseState`, `RecompactCell`, `SurvivorCell` types; new `recompactCells` Map; `buildElimPhaseState()`; sequential `render()`; updated `tick()`, `handleMove()`, `drawBracket()`, `startGame()`, `__setTestState` |
| `workspace-merge10x/tests/e2e/merge10x.spec.ts` | Update `waitForTimeout(900)` → `waitForTimeout(1000)` in elimination tests |

---

## Key Design Details

### `firstCompactedStart` vs `compactedStart`

| Field | Value | Meaning |
|-------|-------|---------|
| `firstCompactedStart` | `i` at push time in `slideRowLeft` | Position in the pre-elimination compacted row (where tile appears in C1/H/F) |
| `compactedStart` | `merged.length` at push time | Position in the post-elimination row (tile would be here if there were no re-compact) |

Example: `[3, 7, 3, 7]` left slide → two pairs:
- Group 0: `firstCompactedStart=0`, `compactedStart=0`
- Group 1: `firstCompactedStart=2`, `compactedStart=0` ← these DIFFER

### Timeline (N = number of groups)

```
C1:    [0,            150ms)              — all phantoms + survivors animate
H₀:    [150ms,        550ms)             — only group 0 highlighted
F₀:    [550ms,        750ms)             — only group 0 fading
H₁:    [750ms,        1150ms)            — only group 1 highlighted  (if N≥2)
F₁:    [1150ms,       1350ms)            — only group 1 fading
C2:    [150 + N×600,  300 + N×600)       — survivors slide to final positions
Done:  [300 + N×600,  ∞)
```

### `state.grid` during animation

`state.grid = outcome.grid` throughout (same as v1). Eliminated tiles are null in outcome.grid — not drawn by main loop. Survivor tiles are at their FINAL positions in outcome.grid. The `recompactCells` map intercepts their rendering and shows them at intermediate positions during C1/hold/C2.

### `recompactCells` Map

```
Key: "${finalRow},${finalCol}"
Value: { origRow, origCol, firstCompactRow, firstCompactCol }
```

Render logic for a tile at key `r,c` in state.grid:
- C1 (elapsed ≤ 150ms): lerp(origPos → firstCompactPos)
- Hold (150ms < elapsed < c2Start): draw at firstCompactPos
- C2 (c2Start ≤ elapsed < c2Start+150ms): lerp(firstCompactPos → finalPos)
- After C2: tick() clears recompactCells when eliminationPhase ends

---

## Task 1: Add `firstCompactedStart` to grid.ts

**Files:**
- Modify: `workspace-merge10x/src/grid.ts`

### Background

`firstCompactedStart = i` (the while-loop scan index) at the moment `groups.push()` is called in `slideRowLeft`. This is the group's leftmost position among ALL non-null tiles in the pre-elimination compacted row.

Direction transforms for `firstCompactedStart` in `slide()` are **identical** to those for `compactedStart`:
- `"left"`: no transform
- `"right"`: `size - firstCompactedStart - length`
- `"up"`: no transform
- `"down"`: `size - firstCompactedStart - length`

- [ ] **Step 1: Add `firstCompactedStart` to both interfaces**

In `workspace-merge10x/src/grid.ts`, update `SlideGroupInfo` (lines 17-20) and `EliminatedGroup` (lines 11-15):

```typescript
export interface EliminatedGroup {
  positions: Array<{ row: number; col: number }>;
  length: 2 | 3 | 4;
  compactedStart: number;
  firstCompactedStart: number;
}

export interface SlideGroupInfo {
  originalCols: number[];
  length: 2 | 3 | 4;
  compactedStart: number;
  firstCompactedStart: number;
}
```

- [ ] **Step 2: Set `firstCompactedStart: i` in `slideRowLeft`**

Update all three `groups.push(...)` calls (currently at lines 70, 77, 84) to include `firstCompactedStart: i`:

```typescript
// length 4 match
groups.push({ originalCols: [p[i], p[i + 1], p[i + 2], p[i + 3]], length: 4, compactedStart: merged.length, firstCompactedStart: i });

// length 3 match
groups.push({ originalCols: [p[i], p[i + 1], p[i + 2]], length: 3, compactedStart: merged.length, firstCompactedStart: i });

// length 2 match
groups.push({ originalCols: [p[i], p[i + 1]], length: 2, compactedStart: merged.length, firstCompactedStart: i });
```

- [ ] **Step 3: Propagate `firstCompactedStart` in `applySlideRowLeftToGrid`**

The `result.groups.forEach` call (currently around line 118) builds `EliminatedGroup` entries. Add `firstCompactedStart: g.firstCompactedStart`:

```typescript
result.groups.forEach((g) => {
  eliminatedGroups.push({
    positions: g.originalCols.map((col) => ({ row: rowIndex, col })),
    length: g.length,
    compactedStart: g.compactedStart,
    firstCompactedStart: g.firstCompactedStart,
  });
});
```

- [ ] **Step 4: Transform `firstCompactedStart` in `slide()` for right/down**

In the `"right"` case, add `firstCompactedStart: size - g.firstCompactedStart - g.length` alongside the existing `compactedStart` transform:

```typescript
case "right": {
  const outcome = applySlideRowLeftToGrid(reverseRows(grid));
  const groups = outcome.eliminatedGroups.map((g) => ({
    ...g,
    positions: g.positions.map(({ row, col }) => ({
      row,
      col: size - 1 - col,
    })),
    compactedStart: size - g.compactedStart - g.length,
    firstCompactedStart: size - g.firstCompactedStart - g.length,
  }));
  return { ...outcome, grid: reverseRows(outcome.grid), eliminatedGroups: groups };
}
```

In the `"up"` case, `firstCompactedStart` passes through via `...g` (no transform needed — same as `compactedStart` for "up"):

```typescript
case "up": {
  const outcome = applySlideRowLeftToGrid(transpose(grid));
  const groups = outcome.eliminatedGroups.map((g) => ({
    ...g,
    positions: g.positions.map(({ row, col }) => ({ row: col, col: row })),
  }));
  return { ...outcome, grid: transpose(outcome.grid), eliminatedGroups: groups };
}
```

In the `"down"` case, add `firstCompactedStart: size - g.firstCompactedStart - g.length`:

```typescript
case "down": {
  const outcome = applySlideRowLeftToGrid(reverseRows(transpose(grid)));
  const groups = outcome.eliminatedGroups.map((g) => ({
    ...g,
    positions: g.positions.map(({ row, col }) => ({
      row: size - 1 - col,
      col: row,
    })),
    compactedStart: size - g.compactedStart - g.length,
    firstCompactedStart: size - g.firstCompactedStart - g.length,
  }));
  return { ...outcome, grid: transpose(reverseRows(outcome.grid)), eliminatedGroups: groups };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd workspace-merge10x && npx tsc --noEmit 2>&1 | head -20
```

Expected: Zero errors in `src/grid.ts`. Tests may have type errors (fixed in Task 2).

---

## Task 2: Update `grid.test.ts` with `firstCompactedStart` assertions

**Files:**
- Modify: `workspace-merge10x/tests/unit/grid.test.ts`

### Expected `firstCompactedStart` values

`firstCompactedStart = i` at push time = position among ALL non-null tiles in the row:

| Input | Group(s) | firstCompactedStart(s) | Note |
|-------|----------|------------------------|------|
| `[1,9,null,null]` | 1 group | 0 | i=0 at push |
| `[2,3,5,null]` | 1 group | 0 | i=0 at push |
| `[1,2,3,4]` | 1 group | 0 | i=0 at push |
| `[2,3,5,5]` | 1 group | 0 | i=0 at push |
| `[5,5,null,null]` | 1 group | 0 | i=0 at push |
| `[3,7,3,7]` | 2 groups | **0, 2** | i=0 then i=2 |
| `[1,9,2,3,5,null]` | 2 groups | **0, 2** | i=0 then i=2 |
| `[1,2,1,9]` | 1 group | **2** | merged=[1,2] at i=2, but i=2 |

Note: `[3,7,3,7]` group 1 has `firstCompactedStart=2` but `compactedStart=0` — these differ.
Note: `[1,2,1,9]` has `firstCompactedStart=2` AND `compactedStart=2` — same here.

For `slide()` direction tests:
- "left" `[[1,9,null,null],...]`: `firstCompactedStart=0`
- "right" `[[null,null,1,9],...]`: reversed=[9,1,null,null], i=0 at push, size=4, len=2 → `4-0-2=2`
- "up" `[[1,...],[9,...],...]`: i=0 at push, no transform → `0`

- [ ] **Step 1: Add `firstCompactedStart` to `slideRowLeft` tests**

For each test that checks `result.groups[k].length`, add a `firstCompactedStart` assertion:

```typescript
// "eliminates a 2-tile pair summing to 10"
expect(result.groups[0].firstCompactedStart).toBe(0);

// "eliminates a 3-tile group summing to 10"
expect(result.groups[0].firstCompactedStart).toBe(0);

// "eliminates a 4-tile group summing to 10"
expect(result.groups[0].firstCompactedStart).toBe(0);

// "prefers 4-tile over 3-tile"
expect(result.groups[0].firstCompactedStart).toBe(0);

// "prefers 3-tile over 2-tile"
expect(result.groups[0].firstCompactedStart).toBe(0);

// "falls back to 2-tile when no 3/4-tile match"
expect(result.groups[0].firstCompactedStart).toBe(0);

// "handles two consecutive 2-tile pairs: [3,7,3,7]"
expect(result.groups[0].firstCompactedStart).toBe(0);
expect(result.groups[1].firstCompactedStart).toBe(2);  // ← differs from compactedStart!

// "handles mixed pair + triple in one row: [1,9,2,3,5,null]"
expect(result.groups[0].firstCompactedStart).toBe(0);
expect(result.groups[1].firstCompactedStart).toBe(2);  // ← i=2 at push
```

- [ ] **Step 2: Add `firstCompactedStart` to the `[1,2,1,9]` test**

The existing test "compactedStart reflects non-eliminated tiles preceding the group: [1,2,1,9]" (added in v1 plan) — extend it:

```typescript
it("compactedStart reflects non-eliminated tiles preceding the group: [1,2,1,9]", () => {
  const result = slideRowLeft([1, 2, 1, 9]);
  expect(result.row).toEqual([1, 2, null, null]);
  expect(result.groups).toHaveLength(1);
  expect(result.groups[0].compactedStart).toBe(2);
  expect(result.groups[0].firstCompactedStart).toBe(2);  // ADD THIS
  expect(result.groups[0].originalCols).toEqual([2, 3]);
});
```

- [ ] **Step 3: Add `firstCompactedStart` to `slide()` tests**

In the `describe("slide — 4-direction"` block:

```typescript
// "slides left and eliminates pair"
expect(outcome.eliminatedGroups[0].firstCompactedStart).toBe(0);

// "slides right and eliminates pair"
expect(outcome.eliminatedGroups[0].firstCompactedStart).toBe(2); // size=4, i=0, len=2 → 4-0-2=2

// "slides up and eliminates pair in column"
expect(outcome.eliminatedGroups[0].firstCompactedStart).toBe(0);
```

- [ ] **Step 4: Run tests and commit**

```bash
cd workspace-merge10x && npm run test:unit
```

Expected: All 57 tests pass (56 existing + 1 updated with firstCompactedStart assertion + implicit counts).

```bash
cd workspace-merge10x && git add src/grid.ts tests/unit/grid.test.ts && git commit -m "feat(merge10x): add firstCompactedStart to grid groups for v2 elimination animation"
```

---

## Task 3: game.ts — New types, state, and helpers

**Files:**
- Modify: `workspace-merge10x/src/game.ts`

Replace the current `PhantomGroup`/`eliminationPhase` types and add new state, timeline helpers, and `buildElimPhaseState()`.

- [ ] **Step 1: Add `HF_MS` constant**

After `const ELIM_FADE_MS = 200;` add:

```typescript
const HF_MS = ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;  // 600ms per group
```

- [ ] **Step 2: Replace `PhantomGroup` interface and add new types**

Remove the existing `PhantomGroup` interface (lines 105-111) and replace with:

```typescript
interface PhantomTile {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
  value: number;
}

interface PhantomGroup {
  tiles: PhantomTile[];
  firstCompactedStart: number;
  length: 2 | 3 | 4;
  direction: Direction;
  groupIndex: number;
}

interface SurvivorCell {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
  finalRow: number;
  finalCol: number;
}

interface ElimPhaseState {
  groups: PhantomGroup[];
  startTime: number;
  survivorCells: SurvivorCell[];
}

interface RecompactCell {
  origRow: number;
  origCol: number;
  firstCompactRow: number;
  firstCompactCol: number;
}
```

- [ ] **Step 3: Replace module-level animation state**

Remove the current:
```typescript
let eliminationPhase: PhantomGroup[] | null = null;
let deferredSlideOutcome: { outcome: SlideOutcome; prevScore: number; } | null = null;
```

Replace with:
```typescript
let eliminationPhase: ElimPhaseState | null = null;
let deferredSlideOutcome: { outcome: SlideOutcome; prevScore: number; } | null = null;
const recompactCells = new Map<string, RecompactCell>();
```

- [ ] **Step 4: Add timeline helper functions** (add after `lerp`)

```typescript
function c2StartMs(totalGroups: number): number {
  return MOVE_DURATION_MS + totalGroups * HF_MS;
}

function totalElimMs(totalGroups: number): number {
  return c2StartMs(totalGroups) + MOVE_DURATION_MS;
}
```

- [ ] **Step 5: Add `buildElimPhaseState()` function** (replace the old `buildPhantomGroups`)

```typescript
function buildElimPhaseState(
  eliminatedGroups: EliminatedGroup[],
  originalGrid: GameGrid,
  outcome: SlideOutcome,
  direction: Direction,
  startTime: number,
): ElimPhaseState {
  const size = originalGrid.length;
  const isVertical = direction === "up" || direction === "down";
  const isReverse = direction === "right" || direction === "down";

  const eliminatedSet = new Set(
    eliminatedGroups.flatMap((g) => g.positions.map((p) => `${p.row},${p.col}`)),
  );

  // Build phantom groups
  const groups: PhantomGroup[] = eliminatedGroups.map((g, groupIndex) => ({
    tiles: g.positions.map(({ row, col }, k) => ({
      origRow: row,
      origCol: col,
      firstCompactRow: isVertical ? g.firstCompactedStart + k : row,
      firstCompactCol: isVertical ? col : g.firstCompactedStart + k,
      value: originalGrid[row][col] as number,
    })),
    firstCompactedStart: g.firstCompactedStart,
    length: g.length,
    direction,
    groupIndex,
  }));

  // Build survivor cells
  // For each "line" (row for horizontal, column for vertical):
  // iterate positions in compaction order, tracking fcIdx (all non-nulls) and
  // finalIdx (surviving non-nulls only) to compute first-compact and final coords.
  const survivorCells: SurvivorCell[] = [];

  for (let lineIdx = 0; lineIdx < size; lineIdx++) {
    // Iterate positions in the compaction direction
    const positions: number[] = isReverse
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    let fcIdx = 0;
    let finalIdx = 0;

    for (const pos of positions) {
      // (pos, lineIdx) in normalized (row=pos, col=lineIdx for vertical) space
      const origRow = isVertical ? pos : lineIdx;
      const origCol = isVertical ? lineIdx : pos;

      if (originalGrid[origRow][origCol] === null) continue;

      const isElim = eliminatedSet.has(`${origRow},${origCol}`);

      if (!isElim) {
        // Compute first-compact coordinates
        let fcRow: number, fcCol: number;
        if (isVertical) {
          fcRow = isReverse ? size - 1 - fcIdx : fcIdx;
          fcCol = lineIdx;
        } else {
          fcRow = lineIdx;
          fcCol = isReverse ? size - 1 - fcIdx : fcIdx;
        }

        // Compute final coordinates from outcome.grid
        let finalRow: number, finalCol: number;
        if (isVertical) {
          finalRow = isReverse ? size - 1 - finalIdx : finalIdx;
          finalCol = lineIdx;
        } else {
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
```

- [ ] **Step 6: Verify TypeScript compiles (no errors in types)**

```bash
cd workspace-merge10x && npx tsc --noEmit 2>&1 | head -20
```

Expected: May have errors about `buildPhantomGroups` still referenced elsewhere — those will be fixed in Task 4. Types themselves should compile.

---

## Task 4: game.ts — Update `handleMove`, `startGame`, `__setTestState`, `drawBracket`

**Files:**
- Modify: `workspace-merge10x/src/game.ts`

- [ ] **Step 1: Update `drawBracket` to use `firstCompactedStart`**

The current `drawBracket` uses `group.compactedStart` and `firstTile.origRow`/`origCol` for arc positioning. Change to use first-compact coordinates (since the bracket appears during Phase H which is at the first-compact position):

```typescript
function drawBracket(group: PhantomGroup, cellSize: number, bracketAlpha: number): void {
  const isVertical = group.direction === "up" || group.direction === "down";
  const cs = group.firstCompactedStart;
  const len = group.length;
  const firstTile = group.tiles[0];

  let x1: number, y1: number, x2: number, y2: number, cpx: number, cpy: number, lx: number, ly: number;

  if (!isVertical) {
    const rowY = firstTile.firstCompactRow * cellSize;
    const arcY = rowY + cellSize + 8;
    x1 = cs * cellSize;
    x2 = (cs + len) * cellSize;
    y1 = arcY; y2 = arcY;
    cpx = (x1 + x2) / 2;
    cpy = arcY + 12;
    lx = cpx; ly = cpy + 10;
  } else {
    const colX = firstTile.firstCompactCol * cellSize;
    const arcX = colX + cellSize + 8;
    y1 = cs * cellSize;
    y2 = (cs + len) * cellSize;
    x1 = arcX; x2 = arcX;
    cpx = arcX + 12;
    cpy = (y1 + y2) / 2;
    lx = cpx + 10; ly = cpy;
  }

  ctx.save();
  ctx.globalAlpha = bracketAlpha;
  ctx.strokeStyle = "#fde047";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();

  ctx.fillStyle = "#fde047";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("= 10", lx, ly);
  ctx.restore();
}
```

- [ ] **Step 2: Replace the elimination path in `handleMove`**

Find the elimination path in `handleMove` — the block starting at `// Eliminations exist:` (around line 581). Replace everything from that comment to the end of `handleMove` with:

```typescript
  // Eliminations exist: set up phantom animation, defer spawn + score
  const postSlideGrid = outcome.grid;
  state = { grid: postSlideGrid, score: state.score };

  const startTime = performance.now();
  const phaseState = buildElimPhaseState(groups, originalGrid, outcome, direction, startTime);
  eliminationPhase = phaseState;
  deferredSlideOutcome = { outcome, prevScore: state.score };

  // Populate recompactCells for survivor tiles
  recompactCells.clear();
  for (const sc of phaseState.survivorCells) {
    recompactCells.set(`${sc.finalRow},${sc.finalCol}`, {
      origRow: sc.origRow,
      origCol: sc.origCol,
      firstCompactRow: sc.firstCompactRow,
      firstCompactCol: sc.firstCompactCol,
    });
  }

  spawnCells.clear();
  moveCells.clear();

  startAnimationLoop();
}
```

(Also remove the old `buildPhantomGroups` function if it still exists.)

- [ ] **Step 3: Update `startGame` to clear new state**

In `startGame()`, add `eliminationPhase = null; deferredSlideOutcome = null; recompactCells.clear();` alongside the existing clears:

```typescript
function startGame(size: 4 | 5): void {
  gridSize = size;
  saveGridSize(size);
  bestScore = loadBestScore(size);
  state = createInitialState(gridSize, rng);
  spawnCells.clear();
  moveCells.clear();
  eliminationPhase = null;
  deferredSlideOutcome = null;
  recompactCells.clear();
  sizePickerEl.setAttribute("hidden", "");
  gameOverEl.setAttribute("hidden", "");
  updateHudScore();
  resizeCanvas();
}
```

- [ ] **Step 4: Update `__setTestState` to clear new state**

Find the `__setTestState` hook (near the bottom of the file) and add the same clears:

```typescript
(window as unknown as { __setTestState: (s: GameState, rngFn?: Rng) => void }).__setTestState = (s, rngFn) => {
  if (rngFn) rng = rngFn;
  state = s;
  spawnCells.clear();
  moveCells.clear();
  eliminationPhase = null;
  deferredSlideOutcome = null;
  recompactCells.clear();
  gameOverEl.setAttribute("hidden", "");
  updateHudScore();
  render();
};
```

- [ ] **Step 5: Build and verify**

```bash
cd workspace-merge10x && npm run build 2>&1 | tail -10
```

Expected: Build succeeds (may have unused `buildPhantomGroups` warning — it should have been removed in Step 2).

---

## Task 5: game.ts — Update `render()`

**Files:**
- Modify: `workspace-merge10x/src/game.ts`

Two changes to `render()`:
1. Add a `recompactCells` branch in the `state.grid.forEach` tile loop (for survivor animation).
2. Replace the `eliminationPhase` rendering block with sequential H/F group logic.

- [ ] **Step 1: Add `recompactCells` branch in tile loop**

Inside `render()`, the `state.grid.forEach` loop currently has three branches for each tile: `spawnCells.has(key)`, `moveCells.has(key)`, and else. Add a fourth branch for `recompactCells` — insert it BETWEEN `moveCells.has` and `else`:

```typescript
      } else if (eliminationPhase !== null && recompactCells.has(key)) {
        const rc = recompactCells.get(key)!;
        const elapsed = now - eliminationPhase.startTime;
        const totalGroups = eliminationPhase.groups.length;
        const c2Start = c2StartMs(totalGroups);
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
          drawX = lerp(rc.firstCompactCol * cellSize, ci * cellSize, p);
          drawY = lerp(rc.firstCompactRow * cellSize, ri * cellSize, p);
        }
        drawTile(cell, drawX, drawY, cellSize);
      } else {
```

Note: in the C2 branch, `ci * cellSize` and `ri * cellSize` are the tile's final pixel position (since `ci` and `ri` are the loop indices = final col/row in `state.grid = outcome.grid`).

The full tile rendering block inside the forEach now looks like:

```typescript
      if (spawnCells.has(key)) {
        // ... existing spawn animation code unchanged ...
      } else if (moveCells.has(key)) {
        // ... existing moveCells animation code unchanged ...
      } else if (eliminationPhase !== null && recompactCells.has(key)) {
        const rc = recompactCells.get(key)!;
        const elapsed = now - eliminationPhase.startTime;
        const totalGroups = eliminationPhase.groups.length;
        const c2Start = c2StartMs(totalGroups);
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
          drawX = lerp(rc.firstCompactCol * cellSize, ci * cellSize, p);
          drawY = lerp(rc.firstCompactRow * cellSize, ri * cellSize, p);
        }
        drawTile(cell, drawX, drawY, cellSize);
      } else {
        drawTile(cell, x, y, cellSize);
      }
```

- [ ] **Step 2: Replace the `eliminationPhase` rendering block**

Find the block starting `if (eliminationPhase !== null) {` at the end of `render()` (currently lines 309-354). Replace the entire block with:

```typescript
  if (eliminationPhase !== null) {
    const elapsed = now - eliminationPhase.startTime;

    for (const group of eliminationPhase.groups) {
      const hStart = MOVE_DURATION_MS + group.groupIndex * HF_MS;
      const fStart = hStart + ELIM_HIGHLIGHT_MS;
      const fEnd = fStart + ELIM_FADE_MS;

      for (const tile of group.tiles) {
        const fcX = tile.firstCompactCol * cellSize;
        const fcY = tile.firstCompactRow * cellSize;
        const origX = tile.origCol * cellSize;
        const origY = tile.origRow * cellSize;

        if (elapsed <= MOVE_DURATION_MS) {
          // C1: all phantom groups animate orig → firstCompact
          const t = elapsed / MOVE_DURATION_MS;
          const p = 1 - Math.pow(1 - t, 2);
          drawPhantomTile(tile.value, lerp(origX, fcX, p), lerp(origY, fcY, p), cellSize, 1, 1.0);
        } else if (elapsed >= hStart && elapsed < fEnd) {
          // This group's H or F window
          if (elapsed < fStart) {
            drawPhantomTile(tile.value, fcX, fcY, cellSize, 1, 1.05);
          } else {
            const fadeT = (elapsed - fStart) / ELIM_FADE_MS;
            drawPhantomTile(tile.value, fcX, fcY, cellSize, Math.max(0, 1 - fadeT), lerp(1.05, 0.4, fadeT));
          }
        }
        // else: not in C1 and not in this group's H/F window → invisible
      }

      // Bracket arc: only during this group's H/F window
      if (elapsed >= hStart && elapsed < fEnd) {
        const bracketAlpha = elapsed < fStart
          ? 1
          : Math.max(0, 1 - (elapsed - fStart) / ELIM_FADE_MS);
        drawBracket(group, cellSize, bracketAlpha);
      }
    }
  }
```

- [ ] **Step 3: Build and verify**

```bash
cd workspace-merge10x && npm run build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

---

## Task 6: game.ts — Update `tick()`

**Files:**
- Modify: `workspace-merge10x/src/game.ts`

- [ ] **Step 1: Replace the `eliminationPhase` block in `tick()`**

Find the current `if (eliminationPhase !== null)` block in `tick()` (lines 377-387). Replace with:

```typescript
  if (eliminationPhase !== null) {
    const elapsed = now - eliminationPhase.startTime;
    const total = totalElimMs(eliminationPhase.groups.length);
    if (elapsed < total) {
      stillAnimating = true;
    } else {
      eliminationPhase = null;
      recompactCells.clear();
      finalizeDeferredSlide();
      stillAnimating = true;
    }
  }
```

- [ ] **Step 2: Run unit tests**

```bash
cd workspace-merge10x && npm run test:unit
```

Expected: All 57 tests pass (no game.ts changes affect grid logic).

- [ ] **Step 3: Build**

```bash
cd workspace-merge10x && npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit all game.ts changes**

```bash
cd workspace-merge10x && git add src/game.ts && git commit -m "feat(merge10x): elimination animation v2 — C1/sequential H·F/C2 pipeline"
```

---

## Task 7: Update E2E tests

**Files:**
- Modify: `workspace-merge10x/tests/e2e/merge10x.spec.ts`

In v2, a single elimination group takes C1(150) + H(400) + F(200) + C2(150) = 900ms. The score updates after C2 ends. The current E2E tests use `waitForTimeout(900)` — bump to `waitForTimeout(1000)` for safety (100ms buffer).

- [ ] **Step 1: Update `waitForTimeout` in all elimination tests**

Three tests currently use `waitForTimeout(900)` — update all three to `waitForTimeout(1000)`:

```typescript
// "eliminates a 2-tile pair on swipe left"
await page.waitForTimeout(1000);  // was 900

// "eliminates a 3-tile group on swipe left"
await page.waitForTimeout(1000);  // was 900

// "score is not updated immediately after eliminating swipe"
// The second wait (after checking score=0) stays correct — just update the timeout:
await page.waitForTimeout(1000);  // was 900
```

- [ ] **Step 2: Run E2E tests**

```bash
cd workspace-merge10x && npm run test:e2e
```

Expected: All 12 tests pass.

- [ ] **Step 3: Commit**

```bash
cd workspace-merge10x && git add tests/e2e/merge10x.spec.ts && git commit -m "test(merge10x): update E2E timing for v2 elimination animation (C2 adds 150ms)"
```

---

## Self-Review

**Spec coverage:**
- ✅ C1 (150ms, all tiles compact together): Task 5 render — `elapsed <= MOVE_DURATION_MS` branch for both phantoms and recompactCells
- ✅ Sequential H_k/F_k (400ms + 200ms per group): Task 5 render — `elapsed >= hStart && elapsed < fEnd` gating per `groupIndex`
- ✅ C2 (150ms, survivors fill gap): Task 5 render — `elapsed >= c2Start` branch in recompactCells; Task 6 tick — `totalElimMs` uses `c2StartMs + MOVE_DURATION_MS`
- ✅ `firstCompactedStart` field on `SlideGroupInfo` + `EliminatedGroup`: Task 1
- ✅ Same direction transforms as `compactedStart`: Task 1 Step 4
- ✅ `firstCompactedStart` = `i` at push time: Task 1 Step 2
- ✅ `drawBracket` uses first-compact position: Task 4 Step 1
- ✅ `state.grid = outcome.grid` throughout (no intermediate state): Task 4 Step 2
- ✅ recompactCells cleared on `startGame` and `__setTestState`: Task 4 Steps 3-4
- ✅ E2E timing updated: Task 7
- ✅ Unit test assertions: Task 2

**Placeholder check:** No TBDs. All code is complete.

**Type consistency:**
- `PhantomGroup.firstCompactedStart` used in `drawBracket` (Task 4) ✅
- `PhantomGroup.tiles[k].firstCompactRow/Col` used in render C1 and H/F phases (Task 5) ✅
- `ElimPhaseState.startTime` used in render via `eliminationPhase.startTime` (Task 5) ✅
- `c2StartMs(totalGroups)` defined in Task 3, used in render (Task 5) and tick (Task 6) ✅
- `totalElimMs(totalGroups)` defined in Task 3, used in tick (Task 6) ✅
- `RecompactCell` interface defined in Task 3, used in `recompactCells` Map (Tasks 4, 5, 6) ✅
- `buildElimPhaseState` returns `ElimPhaseState`, called in `handleMove` (Task 4) ✅
