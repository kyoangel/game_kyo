# merge10x Elimination Highlight Animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 600ms two-phase highlight animation (gold glow + bracket arc, then fade) that plays after eliminated tiles compact but before they disappear, so players can see exactly which tiles formed a group.

**Architecture:** Three changes: (1) `grid.ts` gains `compactedStart` on group info so game.ts knows where to render phantoms; (2) `game.ts` gains a `PhantomGroup` state machine that owns eliminated-tile rendering across Phase M (move, 150ms), Phase H (highlight, 400ms), and Phase F (fade, 200ms), and defers the spawn + score update until Phase F ends; (3) one new E2E assertion verifies score is not updated during Phase H.

**Tech Stack:** TypeScript, Canvas 2D API, Vitest (unit), Playwright (E2E).

---

## File Map

| File | Change |
|------|--------|
| `workspace-merge10x/src/grid.ts` | Add `compactedStart: number` to `SlideGroupInfo` + `EliminatedGroup`; set it in `slideRowLeft`; transform it in `slide()` for right/down |
| `workspace-merge10x/tests/unit/grid.test.ts` | Add `compactedStart` assertions to existing tests |
| `workspace-merge10x/src/game.ts` | Add `PhantomGroup` state, `buildPhantomGroups()`, `drawBracket()`, phantom rendering in `render()`, elimination-phase logic in `tick()`, deferred spawn in `handleMove()` |
| `workspace-merge10x/tests/e2e/merge10x.spec.ts` | Add one test: score deferred during elimination animation |

---

## Task 1: Add `compactedStart` to grid.ts

**Files:**
- Modify: `workspace-merge10x/src/grid.ts`

### Background

`compactedStart` = the index in the compacted (post-elimination) row/column where a matched group's first tile lands. In `slideRowLeft`, this equals `merged.length` at the moment each group is pushed (because `merged` accumulates the non-eliminated tiles to the left of the current group).

Direction transforms in `slide()`:
- `"left"`: no transform — compactedStart is already a real col index
- `"right"`: rows are reversed before sliding; `compactedStart_real = size − compactedStart − length`
- `"up"`: grid is transposed; compactedStart is a row index in transposed space = real row index — no transform
- `"down"`: reversed then transposed; `compactedStart_real = size − compactedStart − length` (for the row axis)

- [ ] **Step 1: Update interfaces**

In `grid.ts`, change the two interfaces:

```typescript
export interface SlideGroupInfo {
  originalCols: number[];
  length: 2 | 3 | 4;
  compactedStart: number;
}

export interface EliminatedGroup {
  positions: Array<{ row: number; col: number }>;
  length: 2 | 3 | 4;
  compactedStart: number;
}
```

- [ ] **Step 2: Set `compactedStart` in `slideRowLeft`**

Each `groups.push(...)` call currently pushes `{ originalCols, length }`. Change all three push sites to also pass `compactedStart: merged.length`:

```typescript
if (
  i + 3 < values.length &&
  v[i] + v[i + 1] + v[i + 2] + v[i + 3] === 10
) {
  groups.push({ originalCols: [p[i], p[i + 1], p[i + 2], p[i + 3]], length: 4, compactedStart: merged.length });
  scoreGained += scoreForLength(4);
  i += 4;
} else if (
  i + 2 < values.length &&
  v[i] + v[i + 1] + v[i + 2] === 10
) {
  groups.push({ originalCols: [p[i], p[i + 1], p[i + 2]], length: 3, compactedStart: merged.length });
  scoreGained += scoreForLength(3);
  i += 3;
} else if (
  i + 1 < values.length &&
  v[i] + v[i + 1] === 10
) {
  groups.push({ originalCols: [p[i], p[i + 1]], length: 2, compactedStart: merged.length });
  scoreGained += scoreForLength(2);
  i += 2;
} else {
  merged.push(v[i]);
  i += 1;
}
```

- [ ] **Step 3: Propagate `compactedStart` in `applySlideRowLeftToGrid`**

Change the `result.groups.forEach` in `applySlideRowLeftToGrid` to propagate `compactedStart` directly (no transform — it's always "left" here):

```typescript
result.groups.forEach((g) => {
  eliminatedGroups.push({
    positions: g.originalCols.map((col) => ({ row: rowIndex, col })),
    length: g.length,
    compactedStart: g.compactedStart,
  });
});
```

- [ ] **Step 4: Transform `compactedStart` in `slide()` for non-left directions**

In the `"right"` case, add `compactedStart` to the group map:

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
  }));
  return { ...outcome, grid: reverseRows(outcome.grid), eliminatedGroups: groups };
}
```

In the `"up"` case (no transform needed — compactedStart is a row index that stays correct):

```typescript
case "up": {
  const outcome = applySlideRowLeftToGrid(transpose(grid));
  const groups = outcome.eliminatedGroups.map((g) => ({
    ...g,
    positions: g.positions.map(({ row, col }) => ({ row: col, col: row })),
    // compactedStart unchanged: it's a row index in real space
  }));
  return { ...outcome, grid: transpose(outcome.grid), eliminatedGroups: groups };
}
```

In the `"down"` case:

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
  }));
  return { ...outcome, grid: transpose(reverseRows(outcome.grid)), eliminatedGroups: groups };
}
```

- [ ] **Step 5: Run unit tests (expect TS compile error only — types changed)**

```bash
cd workspace-merge10x && npm run test:unit 2>&1 | head -30
```

Expected: TypeScript errors about missing `compactedStart` in test assertions (we haven't updated tests yet). The logic itself compiles after the interface changes.

---

## Task 2: Update unit tests with `compactedStart` assertions

**Files:**
- Modify: `workspace-merge10x/tests/unit/grid.test.ts`

### Expected `compactedStart` values for each existing test

`compactedStart = merged.length` at push time:

| Input | Groups | compactedStart(s) | Reason |
|-------|--------|-------------------|--------|
| `[1,9,null,null]` | 1 group len=2 | `0` | merged=[] at i=0 |
| `[2,3,5,null]` | 1 group len=3 | `0` | merged=[] at i=0 |
| `[1,2,3,4]` | 1 group len=4 | `0` | merged=[] at i=0 |
| `[2,3,5,5]` | 1 group len=3 | `0` | merged=[] at i=0 |
| `[5,5,null,null]` | 1 group len=2 | `0` | merged=[] at i=0 |
| `[3,7,3,7]` | 2 groups len=2 | `0, 0` | Both pushed with merged=[] |
| `[1,9,2,3,5,null]` | 2 groups len=2,3 | `0, 0` | Both pushed with merged=[] |
| `[null,1,9,3]` | 1 group len=2 at i=0 | `0` | merged=[] when [1,9] matched |

For `slide()` direction tests:
- `slide(grid, "left")` with `[[1,9,null,null],...]`: `eliminatedGroups[0].compactedStart = 0`
- `slide(grid, "right")` with `[[null,null,1,9],...]`: reversed row = `[9,1,null,null]` → internal cs=0, size=4, len=2 → `4 - 0 - 2 = 2`
- `slide(grid, "up")` with `[[1,null,null,null],[9,null,null,null],...]`: internal cs=0 → `0`

- [ ] **Step 1: Add `compactedStart` assertions to `slideRowLeft` tests**

In the `describe("slideRowLeft — greedy longest-match"` block, add to each test that checks `groups`:

```typescript
// "eliminates a 2-tile pair summing to 10"
expect(result.groups[0].compactedStart).toBe(0);

// "eliminates a 3-tile group summing to 10"
expect(result.groups[0].compactedStart).toBe(0);

// "eliminates a 4-tile group summing to 10"
expect(result.groups[0].compactedStart).toBe(0);

// "prefers 4-tile over 3-tile"
expect(result.groups[0].compactedStart).toBe(0);

// "prefers 3-tile over 2-tile"
expect(result.groups[0].compactedStart).toBe(0);

// "falls back to 2-tile when no 3/4-tile match"
expect(result.groups[0].compactedStart).toBe(0);

// "handles two consecutive 2-tile pairs: [3,7,3,7]"
expect(result.groups[0].compactedStart).toBe(0);
expect(result.groups[1].compactedStart).toBe(0);

// "handles mixed pair + triple in one row"
expect(result.groups[0].compactedStart).toBe(0);
expect(result.groups[1].compactedStart).toBe(0);
```

- [ ] **Step 2: Add a new explicit test for non-zero compactedStart**

Add this test after "records original column positions in groups":

```typescript
it("compactedStart = 0 for first group, non-zero if non-matched tiles precede", () => {
  // [1,2,1,9]: 1+2 doesn't match, 2+1 doesn't match, 1+9=10 → pair at compacted pos 2
  const result = slideRowLeft([1, 2, 1, 9]);
  expect(result.row).toEqual([1, 2, null, null]);
  expect(result.groups).toHaveLength(1);
  expect(result.groups[0].compactedStart).toBe(2); // merged=[1,2] before the group
  expect(result.groups[0].originalCols).toEqual([2, 3]);
});
```

- [ ] **Step 3: Add `compactedStart` assertions to `slide()` tests**

```typescript
// "slides left and eliminates pair"
expect(outcome.eliminatedGroups[0].compactedStart).toBe(0);

// "slides right and eliminates pair"
expect(outcome.eliminatedGroups[0].compactedStart).toBe(2); // size=4, cs=0, len=2 → 4-0-2=2

// "slides up and eliminates pair in column"
expect(outcome.eliminatedGroups[0].compactedStart).toBe(0);
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
cd workspace-merge10x && npm run test:unit
```

Expected: All tests pass (no more TypeScript errors, all assertions green).

- [ ] **Step 5: Commit**

```bash
cd workspace-merge10x && git add src/grid.ts tests/unit/grid.test.ts && git commit -m "feat(merge10x): add compactedStart to grid groups for elimination animation"
```

---

## Task 3: Add PhantomGroup state and `buildPhantomGroups()` to game.ts

**Files:**
- Modify: `workspace-merge10x/src/game.ts`

### Design

A `PhantomGroup` holds all data needed to render eliminated tiles through all three animation phases. The `eliminationPhase` variable is non-null whenever we're in Phase M/H/F.

The spawn and score update are deferred: `deferredSlideOutcome` stores the `SlideOutcome` until Phase F ends, at which point `finalizeDeferredSlide()` applies spawn + score + HUD + game-over.

- [ ] **Step 1: Add animation constants after existing constants**

After `const MOVE_DURATION_MS = 150;` add:

```typescript
const ELIM_HIGHLIGHT_MS = 400;
const ELIM_FADE_MS = 200;
```

- [ ] **Step 2: Add PhantomGroup interface and module-level state**

After the `moveCells` declaration block add:

```typescript
interface PhantomGroup {
  tiles: Array<{ origRow: number; origCol: number; value: number }>;
  compactedStart: number;
  length: 2 | 3 | 4;
  direction: Direction;
  startTime: number;  // when Phase M started (= when handleMove was called)
}

let eliminationPhase: PhantomGroup[] | null = null;
let deferredSlideOutcome: {
  outcome: import("./grid").SlideOutcome;
  prevScore: number;
} | null = null;
```

- [ ] **Step 3: Add `buildPhantomGroups()` helper function**

Add after the `lerp` function:

```typescript
function buildPhantomGroups(
  eliminatedGroups: import("./grid").EliminatedGroup[],
  originalGrid: import("./grid").GameGrid,
  direction: Direction,
  startTime: number,
): PhantomGroup[] {
  return eliminatedGroups.map((g) => ({
    tiles: g.positions.map(({ row, col }) => ({
      origRow: row,
      origCol: col,
      value: originalGrid[row][col] as number,
    })),
    compactedStart: g.compactedStart,
    length: g.length,
    direction,
    startTime,
  }));
}
```

- [ ] **Step 4: Modify `handleMove` to create phantoms and defer spawn**

Replace the current `handleMove` function body with this:

```typescript
function handleMove(direction: Direction): void {
  if (isGameOver(state.grid)) return;
  if (eliminationPhase !== null) return;  // block input during elimination animation

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const originalGrid = state.grid;
  const { scoreGained } = outcome;
  const groups = outcome.eliminatedGroups;

  audio.play(groups.length > 0 ? "eliminate" : "move");
  audio.play("spawn");

  if (groups.length > 0) {
    showScorePopup(scoreGained);
    if (groups.length >= 2) {
      setTimeout(() => showComboBadge(groups.length), 300);
    }
  }

  // Trophy check for slide event
  const slideTrophies = checkTrophies({
    type: "slide",
    postSlideGrid: outcome.grid,
    eliminatedGroups: groups,
  });
  slideTrophies.forEach((id) => showTrophyToast(id));

  if (groups.length === 0) {
    // No eliminations: existing immediate behavior
    const postSlideGrid = outcome.grid;
    const newGrid = spawnRandomTile(postSlideGrid, rng);
    const spawnedCells = changedCells(postSlideGrid, newGrid).filter(
      ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
    );
    const spawnedKeys = new Set(spawnedCells.map(({ row, col }) => `${row},${col}`));
    const allChanged = changedCells(originalGrid, newGrid);
    const movedTiles = allChanged.filter(({ row, col }) => {
      const key = `${row},${col}`;
      return !spawnedKeys.has(key) && newGrid[row][col] !== null;
    });

    const prevState = state;
    state = { grid: newGrid, score: state.score + scoreGained };
    if (state.score > bestScore) { bestScore = state.score; saveBestScore(gridSize, bestScore); }
    updateHudScore();

    if (isGameOver(newGrid)) {
      showGameOver(prevState.score);
    }

    spawnCells.clear();
    moveCells.clear();
    spawnedCells.forEach(({ row, col }) => {
      spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
    });
    movedTiles.forEach(({ row, col }) => {
      moveCells.set(`${row},${col}`, { startTime: performance.now(), direction });
    });
    startAnimationLoop();
    return;
  }

  // Eliminations exist: set up phantom animation, defer spawn + score
  // Update grid to post-elimination immediately (removed tiles gone from state.grid)
  // so non-eliminated moved tiles can use moveCells normally.
  const postSlideGrid = outcome.grid;
  state = { grid: postSlideGrid, score: state.score };  // score deferred

  // moveCells for non-eliminated moved tiles (destination non-null in postSlideGrid)
  const movedTiles = changedCells(originalGrid, postSlideGrid).filter(
    ({ row, col }) => postSlideGrid[row][col] !== null,
  );

  spawnCells.clear();
  moveCells.clear();
  movedTiles.forEach(({ row, col }) => {
    moveCells.set(`${row},${col}`, { startTime: performance.now(), direction });
  });

  eliminationPhase = buildPhantomGroups(groups, originalGrid, direction, performance.now());
  deferredSlideOutcome = { outcome, prevScore: state.score };

  startAnimationLoop();
}
```

- [ ] **Step 5: Extract `showGameOver` helper** (needed since handleMove now calls it from two paths)

Add before `handleMove`:

```typescript
function showGameOver(prevScore: number): void {
  gameOverScoreEl.textContent = `本次分數：${state.score}`;
  gameOverBestEl.textContent = `最高分：${bestScore}`;
  gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, prevScore > bestScore ? prevScore : bestScore));
  gameOverEl.removeAttribute("hidden");
  setTimeout(() => audio.play("gameOver"), 400);
  const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
  gameOverTrophies.forEach((id) => showTrophyToast(id));
}
```

Remove the inline game-over block from the old `handleMove` body (it's now in the no-elimination path and called via `showGameOver`).

- [ ] **Step 6: Add `finalizeDeferredSlide()` helper**

Add after `buildPhantomGroups`:

```typescript
function finalizeDeferredSlide(): void {
  if (!deferredSlideOutcome) return;
  const { outcome, prevScore } = deferredSlideOutcome;
  deferredSlideOutcome = null;

  const postSlideGrid = outcome.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);
  const spawnedCells = changedCells(postSlideGrid, newGrid).filter(
    ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
  );

  const newScore = prevScore + outcome.scoreGained;
  state = { grid: newGrid, score: newScore };
  if (state.score > bestScore) { bestScore = state.score; saveBestScore(gridSize, bestScore); }
  updateHudScore();

  if (isGameOver(newGrid)) {
    showGameOver(prevScore);
  }

  spawnCells.clear();
  spawnedCells.forEach(({ row, col }) => {
    spawnCells.set(`${row},${col}`, performance.now() + SPAWN_DELAY_MS);
  });
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd workspace-merge10x && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only errors about missing render/tick changes, which come in Task 4).

---

## Task 4: Add phantom rendering and `drawBracket()` to game.ts

**Files:**
- Modify: `workspace-merge10x/src/game.ts`

### Phantom tile positions

For each phantom tile at index `k` within a group:
- Horizontal group (left/right): rendered at `col = group.compactedStart + k`, `row = tile.origRow`
- Vertical group (up/down): rendered at `row = group.compactedStart + k`, `col = tile.origCol`

The pixel position = `(col * cellSize, row * cellSize)`.

### Phase M phantom animation (0–150ms)

During Phase M, each phantom tile animates from its original pixel position toward its compacted pixel position. Uses the same ease-out quadratic as moveCells.

### Phase H phantom rendering (150–550ms elapsed)

Tile rendered at compacted position with gold background `#fde047`, dark brown text `#422006`, scale `1.05`.

### Phase F fade (550–750ms elapsed)

Alpha and scale animate: alpha `1→0`, scale `1.05→0.4`.

### Bracket arc

Drawn after all phantom tiles for a group, only during Phase H and F.
- Horizontal: arc below the tile row, from left edge of first tile to right edge of last tile
- Vertical: arc to the right of the tile column
- Quadratic bezier with a 12px bow
- Label "= 10" at arc center

- [ ] **Step 1: Add `drawPhantomTile` helper**

Add after `drawTile`:

```typescript
function drawPhantomTile(value: number, x: number, y: number, cellSize: number, alpha: number, scale: number): void {
  const cx = x + cellSize / 2, cy = y + cellSize / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
  const padding = gridSize === 5 ? 3 : 4;
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#422006";
  ctx.font = `${gridSize === 5 ? 22 : 30}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
  ctx.restore();
}
```

- [ ] **Step 2: Add `drawBracket` helper**

Add after `drawPhantomTile`:

```typescript
function drawBracket(
  group: PhantomGroup,
  cellSize: number,
  bracketAlpha: number,
): void {
  const isVertical = group.direction === "up" || group.direction === "down";
  const cs = group.compactedStart;
  const len = group.length;
  const firstTile = group.tiles[0];

  let x1: number, y1: number, x2: number, y2: number, cpx: number, cpy: number, lx: number, ly: number;

  if (!isVertical) {
    // Horizontal: arc below tile row
    const row = firstTile.origRow;
    const rowY = row * cellSize;
    const arcY = rowY + cellSize + 8;          // 8px below bottom edge
    x1 = cs * cellSize;
    x2 = (cs + len) * cellSize;
    y1 = arcY; y2 = arcY;
    cpx = (x1 + x2) / 2;
    cpy = arcY + 12;                           // 12px bow downward
    lx = cpx; ly = cpy + 10;
  } else {
    // Vertical: arc to the right of the tile column
    const col = firstTile.origCol;
    const colX = col * cellSize;
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

- [ ] **Step 3: Add phantom rendering in `render()`**

At the end of `render()`, after the `state.grid.forEach` loop, add:

```typescript
  if (eliminationPhase !== null) {
    const now = performance.now();
    for (const group of eliminationPhase) {
      const elapsed = now - group.startTime;
      const isVertical = group.direction === "up" || group.direction === "down";

      for (let k = 0; k < group.tiles.length; k++) {
        const tile = group.tiles[k];
        const origX = tile.origCol * cellSize;
        const origY = tile.origRow * cellSize;

        let compRow: number, compCol: number;
        if (!isVertical) {
          compRow = tile.origRow;
          compCol = group.compactedStart + k;
        } else {
          compRow = group.compactedStart + k;
          compCol = tile.origCol;
        }
        const compX = compCol * cellSize;
        const compY = compRow * cellSize;

        if (elapsed <= MOVE_DURATION_MS) {
          // Phase M: animate from original → compacted
          const t = elapsed / MOVE_DURATION_MS;
          const p = 1 - Math.pow(1 - t, 2);  // ease-out quadratic
          const x = lerp(origX, compX, p);
          const y = lerp(origY, compY, p);
          drawPhantomTile(tile.value, x, y, cellSize, 1, 1.0);
        } else if (elapsed <= MOVE_DURATION_MS + ELIM_HIGHLIGHT_MS) {
          // Phase H: stationary gold highlight
          drawPhantomTile(tile.value, compX, compY, cellSize, 1, 1.05);
        } else {
          // Phase F: fade out
          const fadeElapsed = elapsed - MOVE_DURATION_MS - ELIM_HIGHLIGHT_MS;
          const alpha = Math.max(0, 1 - fadeElapsed / ELIM_FADE_MS);
          const scale = lerp(1.05, 0.4, fadeElapsed / ELIM_FADE_MS);
          drawPhantomTile(tile.value, compX, compY, cellSize, alpha, scale);
        }
      }

      // Draw bracket during Phase H and F
      if (elapsed > MOVE_DURATION_MS) {
        const bracketAlpha = elapsed <= MOVE_DURATION_MS + ELIM_HIGHLIGHT_MS
          ? 1
          : Math.max(0, 1 - (elapsed - MOVE_DURATION_MS - ELIM_HIGHLIGHT_MS) / ELIM_FADE_MS);
        drawBracket(group, cellSize, bracketAlpha);
      }
    }
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd workspace-merge10x && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (minor cast warnings for `roundRect` are OK).

---

## Task 5: Add elimination phase timing to `tick()`

**Files:**
- Modify: `workspace-merge10x/src/game.ts`

- [ ] **Step 1: Add elimination phase check to `tick()`**

In `tick()`, add before the final `render()` call:

```typescript
  if (eliminationPhase !== null) {
    const now = performance.now();
    const totalPhaseDuration = MOVE_DURATION_MS + ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;
    const elapsed = now - eliminationPhase[0].startTime;
    if (elapsed < totalPhaseDuration) {
      stillAnimating = true;
    } else {
      eliminationPhase = null;
      finalizeDeferredSlide();
      // finalizeDeferredSlide sets spawnCells; re-enter loop for spawn animation
      startAnimationLoop();
      return;
    }
  }
```

Full updated `tick()`:

```typescript
function tick(): void {
  const now = performance.now();
  let stillAnimating = false;

  spawnCells.forEach((startTime, key) => {
    if (startTime > now || now - startTime < SPAWN_DURATION_MS) {
      stillAnimating = true;
    } else {
      spawnCells.delete(key);
    }
  });

  moveCells.forEach((data, key) => {
    if (now - data.startTime < MOVE_DURATION_MS) {
      stillAnimating = true;
    } else {
      moveCells.delete(key);
    }
  });

  if (eliminationPhase !== null) {
    const totalPhaseDuration = MOVE_DURATION_MS + ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;
    const elapsed = now - eliminationPhase[0].startTime;
    if (elapsed < totalPhaseDuration) {
      stillAnimating = true;
    } else {
      eliminationPhase = null;
      finalizeDeferredSlide();
      startAnimationLoop();
      return;
    }
  }

  render();
  if (stillAnimating) {
    animationFrameId = requestAnimationFrame(tick);
  } else {
    animationFrameId = null;
  }
}
```

- [ ] **Step 2: Run unit tests**

```bash
cd workspace-merge10x && npm run test:unit
```

Expected: All pass (game.ts changes don't affect grid unit tests).

- [ ] **Step 3: Build to catch any remaining TS errors**

```bash
cd workspace-merge10x && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd workspace-merge10x && git add src/game.ts && git commit -m "feat(merge10x): add elimination highlight animation (Phase M/H/F)"
```

---

## Task 6: Add E2E test for score deferral during animation

**Files:**
- Modify: `workspace-merge10x/tests/e2e/merge10x.spec.ts`

The test verifies that immediately after a swipe that causes elimination, the score has NOT yet been updated (it's deferred until after Phase F ends, 750ms later).

- [ ] **Step 1: Add test to "Swipe and elimination" describe block**

Add after the "eliminates a 3-tile group on swipe left" test:

```typescript
  test("score is not updated immediately after eliminating swipe (deferred during animation)", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await setTestState(page, [
      [1, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    await swipe(page, "left");

    // Immediately after swipe: score deferred — still 0
    const stateDuring = await page.evaluate(() => (window as any).__getGameState());
    expect(stateDuring.score).toBe(0);

    // After full animation (M 150ms + H 400ms + F 200ms + buffer = 900ms)
    await page.waitForTimeout(900);
    const stateAfter = await page.evaluate(() => (window as any).__getGameState());
    expect(stateAfter.score).toBeGreaterThanOrEqual(10);
  });
```

- [ ] **Step 2: Run E2E tests**

```bash
cd workspace-merge10x && npm run test:e2e 2>&1 | tail -30
```

Expected: All 12 tests pass (11 existing + 1 new).

- [ ] **Step 3: Commit**

```bash
cd workspace-merge10x && git add tests/e2e/merge10x.spec.ts && git commit -m "test(merge10x): verify score is deferred during elimination animation"
```

---

## Self-Review

**Spec coverage:**
- ✅ Phase M (150ms move): Task 3 + Task 4 phantom Phase M rendering
- ✅ Phase H (400ms highlight gold + bracket): Task 4 `drawPhantomTile` + `drawBracket`
- ✅ Phase F (200ms fade): Task 4 fade rendering
- ✅ `compactedStart` on both interfaces: Task 1
- ✅ Direction transforms (right/down = `size - cs - len`): Task 1 Step 4
- ✅ Non-eliminating swipes unaffected: Task 3 early-return when `groups.length === 0`
- ✅ Deferred score + spawn: Task 3 + Task 5
- ✅ Input blocked during animation: Task 3 `if (eliminationPhase !== null) return`
- ✅ E2E test for score deferral: Task 6

**Placeholder check:** None. All code is complete.

**Type consistency check:**
- `PhantomGroup.tiles` is `Array<{origRow, origCol, value}>` — used consistently in `buildPhantomGroups`, `render`, `drawBracket`
- `finalizeDeferredSlide` references `deferredSlideOutcome.outcome.grid` and `.scoreGained` — both on `SlideOutcome`
- `showGameOver(prevScore)` called with `state.score` (before update) or `prevScore` — check: in no-elim path `prevState.score` = old score before update; in deferred path `prevScore` = score before deferred (same thing). ✅
