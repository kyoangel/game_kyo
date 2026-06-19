# merge10x — Elimination Highlight Animation

**Date:** 2026-06-19  
**Status:** Approved for implementation planning

---

## 1. Problem

Tiles disappear too fast after a swipe. Players can't tell which tiles formed the eliminated group or why they were removed. The game feels opaque.

---

## 2. Solution

Add a two-sub-phase elimination animation that plays after tiles compact but before they disappear:

1. **Highlight phase (400ms):** Eliminated tiles glow gold; a bracket arc is drawn spanning them with a `= 10` label.
2. **Fade phase (200ms):** Highlighted tiles shrink and fade to 0.

Only swipes that produce at least one elimination trigger this animation. Pure-movement swipes are unaffected.

---

## 3. Animation Pipeline (full sequence)

```
Player swipes
  → slide() computes outcome (eliminatedGroups + new grid)
  → if no groups: existing behavior unchanged
  → if groups exist:
      Phase M  — tile move animation (existing 150ms)
                 state.grid = original; all tiles (including eliminated) animate
                 to compacted positions via existing moveCells mechanism
      Phase H  — highlight + bracket (400ms)
                 state.grid updated to post-elimination grid (eliminated tiles gone)
                 phantom eliminated tiles rendered in gold at their compacted positions
                 bracket arc + "= 10" drawn on canvas
      Phase F  — fade-out (200ms)
                 eliminated phantoms scale + alpha → 0
      Phase S  — spawn (existing 350ms delay + 400ms duration)
                 new tile appears; state.grid already set at start of Phase H
```

**Total added latency per eliminating swipe:** ~600ms (Phase H + Phase F).  
**Non-eliminating swipes:** no change.

---

## 4. Visual Specification

### 4.1 Highlighted tiles

During Phase H:
- Cell background: `#fde047` (yellow-gold), replacing the normal tile color
- Cell border: 2px solid `#f59e0b`
- Text color: `#422006` (dark brown for contrast)
- Scale: `1.05` (slight pop)

During Phase F:
- Alpha and scale animate from `{1.0, 1.05}` → `{0, 0.4}`

### 4.2 Bracket arc

Drawn on the canvas below (or to the right of) the highlighted group.

**Horizontal groups** (left/right swipes):
```
┌─────┐ ┌─────┐ ┌─────┐
│  2  │ │  3  │ │  5  │
└─────┘ └─────┘ └─────┘
  ╰───────────────╯
          = 10
```
- Arc drawn 8px below the tile bottom edge
- Arc height: 12px (quadratic bezier, opening upward)
- `= 10` label centered below the arc, font size 11px, color `#fde047`

**Vertical groups** (up/down swipes): same shape rotated 90°, drawn 8px to the right of the tile right edge.

### 4.3 Multiple groups in one swipe

Each group gets its own bracket independently. Score popup and combo badge are unchanged (they still appear as before).

---

## 5. Architecture

### 5.1 `grid.ts` change (minimal)

Add `compactedStart: number` to `SlideGroupInfo`:

```typescript
export interface SlideGroupInfo {
  originalCols: number[];
  length: 2 | 3 | 4;
  compactedStart: number;   // index of first tile in this group within the compacted row
}
```

In `slideRowLeft`, set `compactedStart = i` (the current scan position when a match is found). No other changes.

`EliminatedGroup` (returned by `slide()`) gains a corresponding field:

```typescript
export interface EliminatedGroup {
  positions: Array<{ row: number; col: number }>;  // original positions (unchanged)
  length: 2 | 3 | 4;
  compactedStart: number;   // compacted position of first tile in group
}
```

### 5.2 `game.ts` changes

**New constants:**
```typescript
const ELIM_HIGHLIGHT_MS = 400;
const ELIM_FADE_MS = 200;
```

**New state:**
```typescript
interface PhantomGroup {
  row: number;              // grid row (in swipe-normalised coordinates → actual row)
  col: number;              // compacted start column (actual col after direction transform)
  length: 2 | 3 | 4;
  values: number[];         // tile values for rendering
  startTime: number;
  direction: Direction;     // needed to orient the bracket
}

let eliminationPhase: PhantomGroup[] | null = null;
```

**`handleMove` change:**

After `slide()`:
1. Compute `PhantomGroup[]` from `outcome.eliminatedGroups` (map compacted positions through the same direction transforms used by `slide()`).
2. Set `eliminationPhase = groups`.
3. Defer state update: do NOT call `spawnRandomTile` or update `state` yet.
4. Start animation loop.

State update + spawn happen in `tick()` when `eliminationPhase` finishes.

**`render()` additions:**

When `eliminationPhase` is set:
- For each `PhantomGroup`, render phantom tiles at their compacted positions using the gold highlight style.
- After rendering tiles, call `drawBracket(group, cellSize, now)`.

```typescript
function drawBracket(group: PhantomGroup, cellSize: number, now: number): void {
  const elapsed = now - group.startTime;
  const alpha = elapsed < ELIM_HIGHLIGHT_MS
    ? 1
    : 1 - (elapsed - ELIM_HIGHLIGHT_MS) / ELIM_FADE_MS;
  // draw quadratic bezier arc below (horizontal) or right (vertical) of the group
  // draw "= 10" label at arc midpoint
}
```

**`tick()` addition:**

```typescript
if (eliminationPhase !== null) {
  const elapsed = now - eliminationPhase[0].startTime;
  if (elapsed < ELIM_HIGHLIGHT_MS + ELIM_FADE_MS) {
    stillAnimating = true;
  } else {
    // Phase complete: apply state update and kick off spawn
    eliminationPhase = null;
    applyDeferredSlide();  // sets state.grid, calls spawnRandomTile, sets spawnCells/moveCells
  }
}
```

---

## 6. Unit Tests

`grid.ts` change has a small test impact:

- Existing `slideRowLeft` tests: add assertion that `groups[i].compactedStart` equals the expected compacted index.
- Example: row `[2, null, 3, 5]` → compacted `[2,3,5]` → match at index 0 → `compactedStart = 0`.
- Example: row `[1, 9, 3, 7]` → match `[1,9]` at index 0, match `[3,7]` at index 2 → `compactedStart` values: `0`, `2`.

No new unit tests needed for `game.ts` (canvas/animation code is covered by E2E).

---

## 7. E2E Tests

Add one E2E test to `merge10x.spec.ts`:

- After a swipe that causes elimination, assert the canvas still shows tiles briefly (i.e., the game-over overlay is NOT immediately visible, and `__getGameState().score` is NOT yet updated during Phase H).

_Note: exact canvas pixel checks are out of scope; behavioural timing check is sufficient._

---

## 8. Out of Scope

- Sound effect changes (existing `eliminate` sound plays at swipe time, unchanged)
- Changing difficulty rules (deferred — observe gameplay after animation lands)
- Animation for non-eliminating swipes
