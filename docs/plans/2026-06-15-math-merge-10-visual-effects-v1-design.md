# Math Merge 10 — Visual Effects v1 Design

## Status

Design approved. Ready for implementation planning.

## Context

Math Merge 10 (`workspace/`) is functionally complete per `specs/math-merge-10.md`: 4x4 grid, merge-to-10 with chain reactions, keyboard input, Canvas rendering, Score/Best display, and Best Score persisted to `localStorage`.

This is the first of a planned series of incremental enhancement specs for the game. The brainstorm scoped four candidate enhancement areas — visual effects/animation, scoring mechanics, early-childhood learning, and difficulty progression — and decomposed them into separate sub-projects, each to get its own brainstorm → spec → plan cycle. **This spec covers only the first sub-project: Visual Effects / Animation.**

### Target audience and framing

General/all-ages players. The focus is polish, game feel, and depth — not a learning-app pivot. Any learning-friendly side effects (e.g., the pair-hint color palette making sum-to-10 relationships visible) are a welcome bonus, not a design driver.

### Approach

**"Polish pass"**: improve the existing game's look and feel without changing game rules, scoring, or grid mechanics. `workspace/src/grid.ts` (the pure rule engine: `GameGrid`, `GameState`, `slide`, `applyMove`, `spawnRandomTile`, etc.) remains **completely unchanged**. All work happens in `workspace/src/game.ts` (the rendering/input layer) and new sibling files alongside it.

This keeps the change low-risk and independently testable, and leaves room for later sub-projects (scoring, difficulty, learning features) to build on a still-simple `grid.ts`.

## Features

### 1. Switchable tile color palettes

Three palettes, each mapping tile values 1-9 to a background + text color:

- **A. Pair-hint color families** (default) — values that sum to 10 share a hue family at different shades (1↔9 blue, 2↔8 green, 3↔7 amber, 4↔6 rose). 5 (self-pairing) gets its own purple. Makes mergeable pairs visually obvious at a glance.
- **B. Value gradient** — cool-to-hot gradient from 1 (blue) to 9 (red), classic 2048-style intensity ramp.
- **C. Soft pastel** — low-saturation pastel per value, calmer/cuter aesthetic, no pair signaling.

A small floating toggle button (🎨) sits in the **top-right corner**, overlaid on the canvas as a DOM element (same layering approach as the score popup and Game Over modal below). Clicking it cycles A → B → C → A. The selection persists to `localStorage` under `mathMerge10Palette`, following the same pattern as `mathMerge10BestScore`.

### 2. Score popup on merge

When a move causes one or more merges (including chain reactions), the **total points gained for that move** appears as a "+N" popup near the Score display, floats upward, and fades out via a CSS animation.

This is the "aggregated near Score" option — one popup per move showing the combined total, rather than a popup per individual merge. It's simpler to implement (no canvas-to-screen coordinate mapping needed) and reads cleanly even during multi-merge chain reactions.

### 3. Game Over overlay redesign

Replaces the current bare `<div id="game-over" hidden>Game Over</div>` (plain unstyled text, no stats, no restart) with a **centered modal card**:

- Semi-transparent dark backdrop over the board (board stays dimly visible behind it)
- Card shows: "Game Over" title, final score, best score
- **"★ 新紀錄！" badge** shown when `score === bestScore && score > 0`
- **"再玩一次" (Play Again) button** that calls `createInitialState()` to reset the game in place — no page reload

### 4. Spawn / merge tile animation

New tiles (from `spawnRandomTile`) and tiles resulting from a merge currently appear instantly. This adds a brief "grow from center" fade/scale-in (~150ms, ease-out) for any cell whose value changed as a result of a move.

**Implementation approach (no `grid.ts` changes):**

1. In `setState()`, before applying the new state, diff `prevState.grid` against `newState.grid` cell-by-cell. Any cell whose value differs is added to an `animatingCells` map with a start timestamp. This diff uses data `game.ts` already has — `grid.ts`'s public API and return types are untouched.
2. A `requestAnimationFrame` loop runs while `animatingCells` is non-empty. Each frame, it computes a 0→1 progress per animating cell (ease-out over ~150ms) and calls `render()` with that progress map. Cells are removed once their animation completes; the loop stops itself when the map is empty.
3. `render()` gains a new **optional** second parameter (animation progress map), defaulting to empty — existing calls and existing rendering behavior are unchanged when no animation is in progress.

The score popup and Game Over modal are plain DOM elements with CSS `@keyframes`/transitions, independent of this canvas rAF loop.

## Architecture / Files affected

- **`workspace/src/grid.ts`** — unchanged.
- **`workspace/src/game.ts`** — gains:
  - Cell-diff helper (pure function: `(prevGrid, newGrid) => changed cell positions`) — easy to unit test in isolation.
  - `requestAnimationFrame`-based animation loop, driving an optional progress map into `render()`.
  - `render()` signature extended with an optional animation-progress parameter (backward compatible).
  - Palette state (`currentPalette`), `localStorage` read/write for `mathMerge10Palette`, and palette lookup used when drawing tiles.
  - Score popup creation/update logic, triggered from `setState()` when score increases.
  - Game Over modal content rendering (reusing the existing `#game-over` element, restyled).
- **New `workspace/src/palettes.ts`** — the three palette definitions as `Record<paletteId, Record<tileValue, {bg: string; text: string}>>`, plus the ordered palette-cycle list.
- **`workspace/index.html`** — minor additions: styling/markup hooks for the palette toggle button, score popup container, and the restyled `#game-over` modal (can be done via inline `<style>` plus the existing `#game-over` div, extended with child elements for stats/badge/button).

## Testing Strategy

**Unit tests** (`workspace/tests/unit/`, vitest):
- `palettes.test.ts` — each of the 3 palettes defines an entry for every value 1-9.
- Score popup aggregation — given a move's total `scoreGained`, the popup text/value is computed correctly.
- "New record" badge condition — badge shows iff `score === bestScore && score > 0`.
- Cell-diff pure function — given a before/after `GameGrid` pair, returns the correct set of changed cell positions (covers: no change, single spawn, single merge, multi-merge chain reaction).

**E2E tests** (`workspace/tests/e2e/`, Playwright):
- Palette toggle: clicking 🎨 cycles tile colors through the three palettes; selection persists after page reload.
- Merge move: performing a move that merges tiles shows a "+N" popup with the correct total, which disappears after its animation.
- Game over: playing to a game-over state shows the modal with correct score/best and the "新紀錄" badge when applicable; clicking "再玩一次" resets the board (grid returns to initial state) without a page reload.

## Out of Scope

- Any change to `workspace/src/grid.ts` — grid size, merge rules, scoring formula, spawn logic, and game-over detection are all unchanged.
- Scoring mechanics changes, difficulty progression, and early-childhood learning features — each is a separate future sub-project per the original brainstorm decomposition, to be brainstormed independently.
- Sound effects / haptics.
- Per-merge (vs. aggregated) score popups, particle effects, screen shake — potential future v2 polish if v1 lands well.
