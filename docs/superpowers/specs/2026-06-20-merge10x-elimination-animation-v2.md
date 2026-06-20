# merge10x — Elimination Animation v2

**Date:** 2026-06-20  
**Status:** Approved for implementation planning

---

## 1. Problem

The current elimination animation (v1) has two issues:

1. **Unintuitive gap-fill:** After eliminated tiles disappear, surviving tiles appear to teleport into their final positions. Players expect them to slide and fill the gap.
2. **Combo groups shown simultaneously:** When two or more groups are eliminated in one swipe, all groups flash gold at the same time — players can't distinguish which pair/triple caused which elimination.

---

## 2. Solution

Replace the current M → H/F → Spawn pipeline with a sequential, 3-step pipeline:

```
C1 — all tiles compact together (150ms)
 ↓
H₁/F₁ — group 1 highlights + fades (400ms + 200ms)
 ↓
H₂/F₂ — group 2 (if combo) (400ms + 200ms)
 ↓  ...
C2 — surviving tiles slide to fill gaps (150ms)
 ↓
Spawn — new tile appears (existing 350ms delay + 400ms duration)
```

Only eliminating swipes trigger this pipeline. Pure-movement swipes are unchanged.

---

## 3. Animation Pipeline (full timing)

### Phase C1 — First compaction (150ms)

All non-null tiles in the pre-slide grid (including to-be-eliminated tiles) animate from their original positions to their **first-compacted positions** — where they'd land if all non-null tiles simply packed to the slide direction, ignoring any matches.

For left slide of `[null, 5, 5, 3]`:
- 5 at col 1 → first-compact col 0
- 5 at col 2 → first-compact col 1  
- 3 at col 3 → first-compact col 2

Eliminated tiles animate as **phantoms** (same gold style as v1). Surviving tiles animate via `moveCells` to their first-compact positions (not their final positions yet).

### Phase H_k / F_k — Sequential group highlights

For each elimination group k (k = 0, 1, …, N−1):
- **H_k (400ms):** Group k's phantom tiles render gold at their first-compact positions; bracket arc + "= 10" label drawn. All other groups' phantoms are invisible.
- **F_k (200ms):** Group k's phantoms shrink + fade to 0.

Per-group duration: 600ms. Total for N groups: 600 × N ms.

### Phase C2 — Second compaction (150ms)

Surviving tiles slide from their **first-compact positions** to their **final positions** (where they end up in `outcome.grid`). Uses a new `recompactCells` Map (same ease-out quadratic as `moveCells`).

If all tiles in a row/column were eliminated, C2 has nothing to do for that row/column.

### Phase Spawn — existing behavior

New tile spawns with existing drop-in animation. Score and HUD update at the start of Spawn (same as v1 — after C2 ends).

### Total timing per swipe

| Groups | Total before Spawn |
|--------|-------------------|
| 1 | 150 + 600 + 150 = **900ms** |
| 2 (combo) | 150 + 1200 + 150 = **1500ms** |
| 3 (triple combo) | 150 + 1800 + 150 = **2100ms** |

---

## 4. First-Compacted Positions

### Definition

The **first-compacted position** of a tile is its index among all non-null tiles in that row/column after packing toward the slide direction, before any eliminations.

For left: `firstCompactedStart` of a group = number of non-null tiles to the LEFT of the group's leftmost original tile in the original row. This equals `i` (the `values[]` scan index) at the time `groups.push()` is called in `slideRowLeft`.

### New field in `grid.ts`

Add `firstCompactedStart: number` to both `SlideGroupInfo` and `EliminatedGroup`:

```typescript
export interface SlideGroupInfo {
  originalCols: number[];
  length: 2 | 3 | 4;
  compactedStart: number;       // final position (after elimination) — existing
  firstCompactedStart: number;  // position during C1 (before elimination) — NEW
}

export interface EliminatedGroup {
  positions: Array<{ row: number; col: number }>;
  length: 2 | 3 | 4;
  compactedStart: number;       // existing
  firstCompactedStart: number;  // NEW
}
```

In `slideRowLeft`, set `firstCompactedStart: i` (the scan index at push time):

```typescript
groups.push({ originalCols: [...], length: 4, compactedStart: merged.length, firstCompactedStart: i });
```

Direction transforms in `slide()` for `firstCompactedStart` — **same transforms as `compactedStart`**:
- `"left"`: no transform
- `"right"`: `size - firstCompactedStart - length`
- `"up"`: no transform
- `"down"`: `size - firstCompactedStart - length`

---

## 5. Architecture — `game.ts` changes

### 5.1 Updated `PhantomGroup`

```typescript
interface PhantomGroup {
  tiles: Array<{ origRow: number; origCol: number; firstCompactRow: number; firstCompactCol: number; value: number }>;
  firstCompactedStart: number;
  length: 2 | 3 | 4;
  direction: Direction;
  groupIndex: number;    // 0-based position in the sequence
}
```

`firstCompactRow`/`firstCompactCol` are the pixel-grid coordinates during Phase C1/H/F.

### 5.2 Updated `ElimPhaseState`

Replace the current `PhantomGroup[] | null` with a richer state object:

```typescript
interface ElimPhaseState {
  groups: PhantomGroup[];
  startTime: number;            // when C1 started
  survivorCells: Array<{
    finalRow: number; finalCol: number;        // position in outcome.grid
    firstCompactRow: number; firstCompactCol: number;  // position at end of C1
  }>;
}

let eliminationPhase: ElimPhaseState | null = null;
```

### 5.3 Timeline helpers

```typescript
const C1_MS = MOVE_DURATION_MS;   // 150
const HF_MS = ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;  // 600

function groupHStartMs(groupIndex: number): number {
  return C1_MS + groupIndex * HF_MS;
}
function groupFStartMs(groupIndex: number): number {
  return groupHStartMs(groupIndex) + ELIM_HIGHLIGHT_MS;
}
function c2StartMs(totalGroups: number): number {
  return C1_MS + totalGroups * HF_MS;
}
function totalElimMs(totalGroups: number): number {
  return c2StartMs(totalGroups) + MOVE_DURATION_MS;  // + C2 duration
}
```

### 5.4 `buildElimPhaseState()`

Replaces `buildPhantomGroups()`. Computes phantom tiles and survivor cells:

```typescript
function buildElimPhaseState(
  eliminatedGroups: EliminatedGroup[],
  originalGrid: GameGrid,
  outcome: SlideOutcome,
  direction: Direction,
  startTime: number,
): ElimPhaseState
```

For each `EliminatedGroup`:
- `firstCompactRow/Col` for tile k:
  - Horizontal (left/right): `firstCompactRow = positions[0].row`, `firstCompactCol = group.firstCompactedStart + k`
  - Vertical (up/down): `firstCompactRow = group.firstCompactedStart + k`, `firstCompactCol = positions[0].col`

For survivor cells: scan `outcome.grid` for non-null tiles and find their matching first-compact position from `originalGrid` (count non-nulls to the left/top in the original row/col).

### 5.5 `handleMove()` changes

Same deferred-spawn structure as v1, with these differences:
1. Set `state.grid = firstCompactGrid(originalGrid, direction)` at the start (instead of `outcome.grid`). This ensures `moveCells` keys (survivor tile destinations) exist in `state.grid` so tiles render at their first-compact positions during C1.
2. `moveCells` targets first-compact positions (not final positions).
3. At end of Phase C2, `finalizeDeferredSlide()` updates `state.grid` to the spawned grid (same as v1).

### 5.6 `render()` additions

**During C1 (elapsed ≤ C1_MS):**
- Phantom tiles animate `origPos → firstCompactPos` (lerp + ease-out).
- Survivor tiles animate via `moveCells` to their first-compact positions.

**During H_k/F_k (C1_MS + k×HF_MS ≤ elapsed < C1_MS + (k+1)×HF_MS):**
- Only group k renders gold at `firstCompactPos`; others invisible.
- Bracket arc at group k's first-compact span.

**During C2 (c2StartMs ≤ elapsed < totalElimMs):**
- Phantom groups invisible.
- Survivor cells animate `firstCompactPos → finalPos` via `recompactCells`.
  
`recompactCells` is populated at Phase C2 start (inside `tick()` when C2 begins).

### 5.7 `tick()` changes

```
C1 phase   → stillAnimating = true
H_k/F_k    → stillAnimating = true; kick off C2 setup when last F ends
C2 phase   → stillAnimating = true
C2 done    → eliminationPhase = null; finalizeDeferredSlide(); stillAnimating = true (for spawn)
```

C2 setup (when transitioning from F_{N-1} to C2): populate `recompactCells` from `eliminationPhase.survivorCells`.

---

## 6. `moveCells` behavior change

Currently `moveCells` maps surviving tiles to their **final** positions. In v2, `moveCells` maps them to their **first-compact** positions instead. After C2, `recompactCells` handles the second slide.

The render code for `moveCells` is unchanged — tiles animate from an offset toward their keyed position. The key difference is that the map is built from `changedCells(originalGrid, firstCompactGrid)` instead of `changedCells(originalGrid, newGrid)`.

`firstCompactGrid` is computed by applying only the compaction (no elimination) to `originalGrid`. It can be computed as:

```typescript
function firstCompactGrid(originalGrid: GameGrid, direction: Direction): GameGrid {
  // Pack non-null tiles in each row/col toward the direction, no elimination
  // For left: for each row, filter non-nulls and pad right with nulls
}
```

This is a new helper in `game.ts` (not in `grid.ts` — it doesn't need the elimination logic).

---

## 7. Unit Tests

`grid.ts` changes:
- Add `firstCompactedStart` assertions to all existing `slideRowLeft` and `slide()` tests.
- Key values: for groups at the start of a row, `firstCompactedStart = 0`. For `[3,7,3,7]`, group 0: `firstCompactedStart = 0`, group 1: `firstCompactedStart = 2`.
- One new test: `[1,2,1,9]` → `firstCompactedStart = 2`, `compactedStart = 2` (same in this case since no elimination before it).

---

## 8. E2E Tests

Update the score-deferral test's `waitForTimeout` to use 1600ms (covers combo-2 total: 1500ms + 100ms buffer):

```typescript
// Old: await page.waitForTimeout(900)
await page.waitForTimeout(1600);
```

The existing tests that wait 900ms for single-group eliminations stay at 900ms (still correct for N=1).

---

## 9. Out of Scope

- Difficulty changes (still deferred)
- Sound changes (existing `eliminate` sound plays at C1 start, unchanged)
- Animation for non-eliminating swipes
- Per-combo timing shortening (all groups use the same 400ms+200ms regardless of combo count)
