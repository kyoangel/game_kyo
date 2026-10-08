# Math Merge 10 Adventure Mode — Plan 3b of 3: Renderer, Adventure Screen, Menu, e2e, iOS Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adventure mode (spec `docs/specs/math-merge-10/adventure-mode.md` §2, §3.4, §5.2, §9.2, §9.3 `view.ts`, §10, §11 P1 items 1 and 7) playable end to end in a browser and in the iOS wrapper: (1) fix `boardRenderer.ts` for stones, 0 tiles and frozen cells and settle the elimination-animation-vs-frozen-walls question, (2) simple canvas-drawn enemies and the pure view-model helpers, (3) the screen switch (`mode.ts`), `?seed=` and the one-line gate in `game.ts`, (4) the e2e specs written first (red), (5) the adventure screen (`index.html`, `view.ts`), the start menu (`menu.ts`), `main.ts` wiring and the Playwright seed key, (6) `npm run sync-web` plus an iOS simulator build in `merge10-ios`, (7) full verification. Endless mode keeps behaving identically; all 54 existing e2e specs and all unit tests stay green without being edited.

**Architecture:** The rules are finished (plans #1-#3a). `view.ts` is a thin controller: keyboard/swipe/click -> `runTurn` / `runCast` / `chooseOffer` -> `saveRun` -> play the returned battle events back (board animation through the shared `BoardRenderer`, floating numbers, log lines, sound, trophy toasts). Everything computable without a DOM (text, icons, sizes, swipe maths, progress strip) is in `viewModel.ts` and unit-tested; the enemy portraits are drawn by `enemyArt.ts` onto a plain canvas context. `menu.ts` owns the start menu and the three-way screen switch (`mode.ts`: menu / endless / adventure, mirrored into `<body data-screen>` for CSS). The page loads `game.ts` exactly as before; only `handleKeydown` gained a `getScreen() !== "endless"` guard.

**Tech Stack:** Vanilla TypeScript, Canvas 2D, vitest, Playwright, Vite, Capacitor (iOS wrapper at `/Users/kyo.lai82/Projects/Personal/merge10-ios`).

**Plan series:** #1 foundation (done) -> #2 battle rules (done) -> #3a run flow / relics / save / unlocks (must be done: HEAD contains its Task 6) -> #3b renderer, UI, menu, e2e, iOS (this plan).

---

## Global Constraints

- Work from `/Users/kyo.lai82/Projects/Personal/game-factory`; source code lives in `workspace/`. Run npm/npx commands from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`; run git commands from `/Users/kyo.lai82/Projects/Personal/game-factory`. The iOS task runs in `/Users/kyo.lai82/Projects/Personal/merge10-ios`.
- Existing files modified by this plan (each by exact `Edit` blocks): `src/boardRenderer.ts` (Task 1, six edits, additive: endless output is unchanged), `src/game.ts` (Task 3, three edits: import the screen mode, `export` the audio engine, one early return in `handleKeydown`), `src/main.ts` (Task 5), `index.html` (Task 5, two edits: CSS, DOM), `playwright.config.ts` (Task 5, one edit). **No existing test file is edited** (the 54 e2e specs and every unit test run as they are).
- Existing UI text is Traditional Chinese; all new UI text is too.
- Every adventure rule stays in `src/adventure/` pure modules; `view.ts` and `menu.ts` are the only new files that touch the DOM.
- Verify commands:
  - unit: `npm run test:unit`; types: `npx tsc --noEmit`; build: `npm run build`; e2e: `npm run test:e2e` (Playwright starts its own Vite dev server on port 5173 via `playwright.config.ts`; `reuseExistingServer` is on outside CI, so stop any other `npm run dev` that serves a different tree before running e2e).
- Baseline (after plan #3a): **33 unit test files, 514 unit tests passing**; `tsc --noEmit` clean; **54 e2e tests passing**.
- Expected counts after each task: unit Task 1 -> 521 (34 files), Task 2 -> 553 (36), Task 3 -> 561 (38 files), Tasks 4-7 unchanged; e2e Task 3 -> 54, Task 5 -> **79** (54 existing + 9 menu + 10 battle + 6 layout).
- Task order: renderer first (spec 11 calls it the riskiest; `merge-animation` and `visual-effects` e2e run before and after), then pure helpers, then screen mode and `game.ts` gate, then the e2e specs (red), then the UI that turns them green, then iOS, then full verification.
- Commit trailer for every commit (both repos): `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Always `git add` explicit paths, never `git add -A` (untracked `verify*.png` files and unrelated changes exist).
- Use `Edit` find/replace blocks exactly as written; each "find" string occurs exactly once in the file at that point.

---

## Decisions made

The spec is silent or ambiguous on these; the simplest option consistent with the spec was taken. Each is pinned by a test or an e2e spec unless marked "doc".

| # | Decision | Rationale |
|---|---|---|
| U1 | **The start menu is shown at every launch** (spec 2: 冒險 primary, 修練, plus 繼續冒險 when a valid save exists and a 🏆 冒險獎盃 link). Only dev builds (`import.meta.env.DEV`) honour `localStorage.mathMerge10DebugStart = "endless"`, which skips the menu and opens 修練; `playwright.config.ts` seeds that key through `use.storageState`, so the 54 existing specs (all `page.goto("/")` then play endless) pass unedited. Menu specs clear it with `test.use(NO_DEBUG_START)`. A production build contains no trace of the key. | Honours "adventure is the default" for real users and reviewers while keeping the existing specs' contract without editing them. The three iOS-UA contexts in `pwa.spec.ts` open without the key, land on the menu, and still pass (the iOS hint has `z-index: 100`, the menu 90). |
| U2 | **`src/mode.ts`** (`getScreen` / `setScreen`, default `"endless"`) is the only shared state. `game.ts` ignores keystrokes unless the screen is `"endless"` (also covers its touch-swipe path, which calls `handleKeydown`). `game.ts` also `export`s its existing `audio` engine so the adventure screen shares mute state. | Smallest possible change to `game.ts`; before `main.ts` runs the default keeps the page behaving as before. |
| U3 | **Screens switch with `body[data-screen]` + the `hidden` attribute.** `#game-wrapper` is `display: none` for `menu` and `adventure`. The endless screen gets a small fixed 🏠 button (`#endless-home`, 36px, top-left) instead of a new HUD button, so the HUD row (already full at 390px) is untouched. | Plan #3b must not change the endless layout (`ux-v2` asserts it at 390px). |
| U4 | **Renderer.** `drawBaseTile` draws a stone (grey block with a facet and cracks, no number) and a 0 tile (dark `ZERO_TILE_COLORS`, text "0"); `setFrozenCells` adds an ice tint, border and "❄N" (turns left) over every frozen cell that still holds a tile. Resolves plan #2 risk 1's `PALETTES[palette][0 / STONE]` throw and the missing overlay. | Additive; endless boards contain only 1-9 and never set frozen cells (a unit test pins the unchanged call sequence). |
| U5 | **Elimination animation vs frozen walls (plan #2 risk 1, review point):** the two-phase animation is used only when nothing was frozen at the start of the turn (`canAnimateElimination(freezes.length)`); otherwise the view plays the plain slide animation (`beginSlide`) and the eliminated pair simply vanishes. A property test (400 seeded boards with stones and 0s) proves `buildElimPhaseState` agrees with `slide()` on every survivor when nothing is frozen, so stones need no special handling. | Fixing the animation for walls means modelling segment compaction and wall endpoints; the documented simple fallback is correct, small and only costs polish while a freeze is active. |
| U6 | **What animates.** The rules resolve a whole turn at once; for an animated elimination the turn's spawned tile is hidden until the animation ends (`hiddenCells` + `beginSpawn`), input is ignored while `board.isEliminating` (like endless), and everything else (stone breaks, rockfall stones, freezes, scrambles, overload clears) appears at once. Feedback: floating "-N" on the enemy and on the hero, red board flash when the hero is hurt, a three-line event log, sounds from the existing `AudioEngine` (move / eliminate / combo / spawn / the four spells / overload = bomb / defeat = gameOver). No stone pop animation (plan #2 risk 1 asked for a decision: skipped for P1). | "Keep it modest — this is P1". |
| U7 | **Spell UX.** The four spell buttons show the live cost (upgrades and relics included) and are disabled when mana is short. 洗牌 casts at once; 碎石 / 增幅 / 爆裂 are armed by tapping the button (board outline turns orange, a one-line help text appears) and cast by tapping a cell; tapping the button again cancels. A swipe cancels nothing: swipes are ignored while a spell is armed on touch and playing a turn disarms it. | Matches endless mode's powerup interaction. |
| U8 | **Screen layout.** Top bar (🏠, "森林 1/3", the 9-pip run strip with taller boss pips, 🔊), enemy card (96px canvas portrait, name with 👑 for bosses, HP bar and numbers, 🛡 shield, intent pill "⚔ 攻擊 2 · 3" = icon, text, turns left), the square board, hero row (❤ hp/max, 🔷 mana), spell bar, relic row (tap an icon for its description), log. Board side = `min(width - 24, height - 350, 440)`, at least 200 (366px at 390x844, 406px at 430x932). Verified by e2e at both sizes: every block inside the viewport, no page scroll, spell buttons >= 44px. | Fits iPhone portrait; one formula, unit-tested. |
| U9 | **Flow screens.** Reward / relic pick = a modal with 1-3 `.adv-offer` buttons (icon, name, description). Victory / defeat = a modal with the title, reached battle and enemy, relics, and 再來一次 (new run) / 回首頁. 🏠 mid-run keeps the save (so the menu shows 繼續冒險); 冒險 on the menu always starts a new run and overwrites the save without asking (the 繼續冒險 button sits directly above). A stuck board shows the hint from `stuckHint` in the log. | Simplest consistent options; plan #2 risk 8. |
| U10 | **Adventure trophies UI.** The menu's 🏆 link opens a modal listing the six trophies (locked ones greyed, each with the relic it unlocks); an unlock during play shows a toast "🏆 name！解鎖遺物「…」（下一局起）". The endless 🏆 modal is untouched (plan #3a E8). | Spec 8 with the existing look. |
| U11 | **Test hooks (dev builds only, `import.meta.env.DEV`):** `?seed=N` seeds the adventure `Rng` (`mulberry32`; endless mode is untouched, existing specs set their own rng); `window.__adv` = `{ getRun, isBusy, setRun, patchBattle }`. e2e specs build whole `RunState`s with the pure layer (imported straight from `src/`) and jump to them with `setRun`, and play real swipes with a greedy bot (`bestDirection`). The production bundle keeps the (inert) hook code but never sets `window.__adv` and contains no `mathMerge10DebugStart`. | Spec 10; keeps each spec under a few seconds. |
| U12 | **iOS.** `npm run sync-web` (already present in `merge10-ios/package.json`) runs `build:ios`, copies `dist-ios` to `www/` and `npx cap sync ios`; `www/` and `ios/App/App/public/` are git-ignored, so the iOS repo has nothing new to commit. Verification = simulator build (`xcodebuild ... -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max'`), install, launch and a screenshot; no Swift change, no new leaderboard (spec puts that in P2), the native donation-link hiding and Game Center button stay endless-only exactly as before. | Spec 11 P1 item 7. |
| U13 | **Not changed (doc):** `public/sw.js` (cache name `math-merge-10-v1`) is left alone; see Risks. The dev-only `__adv` code path stays in the production bundle (tree-shaking does not remove a runtime flag), inert. | Out of scope; flagged for the release checklist. |

## Open questions for the user

None.

---

### Task 1: Renderer support for stones, 0 tiles and frozen cells

**Files:**
- Modify: `workspace/src/boardRenderer.ts` (six edits)
- Create: `workspace/tests/unit/fakeCanvas.ts` (test helper)
- Create: `workspace/tests/unit/boardRendererSpecial.test.ts`

**Interfaces:**

Consumes: `grid.ts` (`STONE`, `slide`), existing `BoardRenderer`, `buildElimPhaseState`.

Produces (additions to `src/boardRenderer.ts`):
```ts
export const ZERO_TILE_COLORS: { bg: string; text: string };
export interface FrozenCell { row: number; col: number; turns: number }
export function canAnimateElimination(frozenCount: number): boolean;      // true only while nothing is frozen
// class BoardRenderer { setFrozenCells(cells: readonly FrozenCell[]): void; ... }
// drawBaseTile: STONE -> stone block (no text), 0 -> ZERO_TILE_COLORS; 1-9 unchanged
```
Test helper `fakeCanvas(size?)` returns `{ canvas, ctx, calls }`: a canvas whose 2D context records every call and the `fillStyle` at that moment.

- [ ] **Step 1.1: Run the guarded e2e specs before touching the renderer**

```bash
npx playwright test merge-animation visual-effects --reporter=line
```

Expected: `6 passed`.

- [ ] **Step 1.2: Write the failing test and its helper**

Create `workspace/tests/unit/fakeCanvas.ts`:
```ts
export interface Call {
  op: string;
  args: unknown[];
  fillStyle: unknown;
}

/** A canvas whose 2D context records every call (and the fillStyle at that moment). */
export function fakeCanvas(size = 400) {
  const calls: Call[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get: (target, prop: string) =>
      prop in target
        ? target[prop]
        : (...args: unknown[]) => {
            calls.push({ op: prop, args, fillStyle: target.fillStyle });
          },
    set: (target, prop: string, value) => {
      target[prop] = value;
      return true;
    },
  });
  const canvas = { width: size, height: size, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
```
Create `workspace/tests/unit/boardRendererSpecial.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE, slide, type Direction, type GameGrid } from "../../src/grid";
import {
  BoardRenderer,
  ZERO_TILE_COLORS,
  buildElimPhaseState,
  canAnimateElimination,
} from "../../src/boardRenderer";
import { fakeCanvas, type Call } from "./fakeCanvas";

function makeRenderer() {
  const { canvas, calls } = fakeCanvas();
  const renderer = new BoardRenderer({ canvas, gridSize: 4, getPalette: () => "pairHint" });
  return { renderer, calls };
}

const texts = (calls: Call[]) => calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);

function grid(rows: Array<Array<number | null>>): GameGrid {
  const g: GameGrid = Array.from({ length: 4 }, () => [null, null, null, null]);
  rows.forEach((row, r) => row.forEach((v, c) => (g[r][c] = v)));
  return g;
}

describe("BoardRenderer draws the adventure-only cells", () => {
  it("draws a 0 tile with the dull colours and a '0'", () => {
    const { renderer, calls } = makeRenderer();
    expect(() => renderer.draw(grid([[0]]), 0)).not.toThrow();
    expect(texts(calls)).toEqual(["0"]);
    expect(calls.some((c) => c.op === "fill" && c.fillStyle === ZERO_TILE_COLORS.bg)).toBe(true);
  });

  it("draws a stone without any text (never the raw value -1)", () => {
    const { renderer, calls } = makeRenderer();
    expect(() => renderer.draw(grid([[STONE, 5]]), 0)).not.toThrow();
    expect(texts(calls)).toEqual(["5"]);
  });

  it("ordinary 1-9 tiles draw exactly as before: one number each, no overlay", () => {
    const { renderer, calls } = makeRenderer();
    renderer.draw(grid([[1, 9], [4, 6]]), 0);
    expect(texts(calls)).toEqual(["1", "9", "4", "6"]);
  });
});

describe("frozen overlay", () => {
  it("draws the remaining turns on a frozen cell that holds a tile", () => {
    const { renderer, calls } = makeRenderer();
    renderer.setFrozenCells([{ row: 0, col: 1, turns: 2 }]);
    renderer.draw(grid([[3, 7]]), 0);
    expect(texts(calls)).toEqual(["3", "7", "❄2"]);
  });

  it("skips frozen cells that are empty or hidden, and clearing removes the overlay", () => {
    const { renderer, calls } = makeRenderer();
    renderer.setFrozenCells([{ row: 2, col: 2, turns: 3 }]);
    renderer.draw(grid([[3]]), 0);
    expect(texts(calls)).toEqual(["3"]);
    renderer.setFrozenCells([]);
    renderer.draw(grid([[3, 7]]), 0);
    expect(texts(calls)).toEqual(["3", "3", "7"]);
  });
});

describe("canAnimateElimination", () => {
  it("is true only while nothing is frozen", () => {
    expect(canAnimateElimination(0)).toBe(true);
    expect(canAnimateElimination(1)).toBe(false);
  });
});

describe("the elimination animation matches slide() on boards with stones and 0s (no freezes)", () => {
  function seeded(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it("every survivor's animated end cell holds the same tile in the real post-slide grid", () => {
    const rng = seeded(2024);
    const directions: Direction[] = ["left", "right", "up", "down"];
    const values = [null, null, 0, STONE, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let checkedBoards = 0;
    for (let n = 0; n < 400; n++) {
      const board: GameGrid = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => values[Math.floor(rng() * values.length)]),
      );
      for (const direction of directions) {
        const outcome = slide(board, direction);
        if (outcome.eliminatedPairs.length === 0) continue;
        checkedBoards += 1;
        const phase = buildElimPhaseState(outcome.eliminatedPairs, board, direction, 0);
        phase.survivorCells.forEach((s) => {
          expect(outcome.grid[s.finalRow][s.finalCol]).toBe(board[s.origRow][s.origCol]);
        });
        const occupiedAfter = outcome.grid.flat().filter((c) => c !== null).length;
        expect(phase.survivorCells.length).toBe(occupiedAfter);
      }
    }
    expect(checkedBoards).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 1.3: Run and see it fail**

```bash
npx vitest run tests/unit/boardRendererSpecial.test.ts
```

Expected: `Tests  5 failed | 2 passed (7)`: drawing a 0 or a stone throws `TypeError: Cannot read properties of undefined (reading 'bg')` (`PALETTES[palette][0]` does not exist), `renderer.setFrozenCells is not a function` (2 tests) and `canAnimateElimination is not a function`. The two that already pass pin existing behaviour (ordinary 1-9 tiles draw exactly as before, and the `buildElimPhaseState` property test).

- [ ] **Step 1.4: Apply the six `boardRenderer.ts` edits**

In `workspace/src/boardRenderer.ts`:

1. Import `STONE`:

Edit `workspace/src/boardRenderer.ts`. Find (must occur exactly once):
```ts
import type { Direction, EliminatedPair, GameGrid } from "./grid";
```
Replace with:
```ts
import { STONE, type Direction, type EliminatedPair, type GameGrid } from "./grid";
```

2. Constants, `FrozenCell`, `canAnimateElimination`:

Edit `workspace/src/boardRenderer.ts`. Find (must occur exactly once):
```ts
const HF_MS = ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;
```
Replace with:
```ts
const HF_MS = ELIM_HIGHLIGHT_MS + ELIM_FADE_MS;

/** Colours of a 0 tile (adventure mode): dark and dull, so it reads as dead. Palettes only cover 1-9. */
export const ZERO_TILE_COLORS = { bg: "#111827", text: "#6b7280" };

/** A frozen cell to overlay with ice (adventure mode); `turns` is shown on it. */
export interface FrozenCell {
  row: number;
  col: number;
  turns: number;
}

/**
 * The two-phase elimination animation models plain rows and columns only. A
 * frozen tile is a wall (the line is cut in segments, the wall tile can be one
 * end of a pair), which `buildElimPhaseState` does not know, so while anything
 * is frozen the adventure view uses the simple slide animation instead.
 */
export function canAnimateElimination(frozenCount: number): boolean {
  return frozenCount === 0;
}
```

3. State for the overlay:

Edit `workspace/src/boardRenderer.ts`. Find (must occur exactly once):
```ts
  private eliminationPhase: ElimPhaseState | null = null;
```
Replace with:
```ts
  private eliminationPhase: ElimPhaseState | null = null;
  private frozenCells: FrozenCell[] = [];
```

4. The setter:

Edit `workspace/src/boardRenderer.ts`. Find (must occur exactly once):
```ts
  /** Drops every running animation (used when the board is replaced wholesale). */
```
Replace with:
```ts
  /** Cells to draw under an ice overlay (adventure mode). Endless mode never sets any. */
  setFrozenCells(cells: readonly FrozenCell[]): void {
    this.frozenCells = [...cells];
  }

  /** Drops every running animation (used when the board is replaced wholesale). */
```

5. Overlay drawing, called at the end of `draw`, plus the stone drawing:

Edit `workspace/src/boardRenderer.ts`. Find (must occur exactly once):
```ts
              this.drawPhantomTile(tile.value, fcX, fcY, cellSize, Math.max(0, 1 - fadeT), lerp(1.05, 0.4, fadeT));
            }
          }
        }
      }
    }
  }
```
Replace with:
```ts
              this.drawPhantomTile(tile.value, fcX, fcY, cellSize, Math.max(0, 1 - fadeT), lerp(1.05, 0.4, fadeT));
            }
          }
        }
      }
    }

    this.drawFrozenOverlays(grid, cellSize);
  }

  /** Ice tint, border and the remaining turns on every frozen cell that still holds a tile. */
  private drawFrozenOverlays(grid: GameGrid, cellSize: number): void {
    const { ctx } = this;
    const padding = 4;
    this.frozenCells.forEach(({ row, col, turns }) => {
      if (grid[row]?.[col] == null) return;
      const x = col * cellSize;
      const y = row * cellSize;
      ctx.save();
      ctx.fillStyle = "rgba(125,211,252,0.5)";
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0c4a6e";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`❄${turns}`, x + cellSize - padding - 4, y + cellSize - padding - 2);
      ctx.restore();
    });
  }

  /** A stone: grey rounded block with a lighter facet and two cracks. No number. */
  private drawStoneTile(x: number, y: number, cellSize: number, padding: number): void {
    const { ctx } = this;
    const left = x + padding;
    const top = y + padding;
    const size = cellSize - padding * 2;
    ctx.fillStyle = "#78716c";
    ctx.beginPath();
    ctx.roundRect(left, top, size, size, 8);
    ctx.fill();
    ctx.fillStyle = "#a8a29e";
    ctx.beginPath();
    ctx.moveTo(left + size * 0.12, top + size * 0.12);
    ctx.lineTo(left + size * 0.55, top + size * 0.12);
    ctx.lineTo(left + size * 0.12, top + size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#44403c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + size * 0.55, top + size * 0.2);
    ctx.lineTo(left + size * 0.45, top + size * 0.5);
    ctx.lineTo(left + size * 0.7, top + size * 0.7);
    ctx.moveTo(left + size * 0.2, top + size * 0.8);
    ctx.lineTo(left + size * 0.4, top + size * 0.65);
    ctx.stroke();
  }
```

6. `drawBaseTile` handles stones and 0:

Edit `workspace/src/boardRenderer.ts`. Find (must occur exactly once):
```ts
    const colors = PALETTES[this.getPalette()][value];
```
Replace with:
```ts
    if (value === STONE) {
      this.drawStoneTile(x, y, cellSize, padding);
      return;
    }
    const colors = value === 0 ? ZERO_TILE_COLORS : PALETTES[this.getPalette()][value];
```

- [ ] **Step 1.5: Run and see it pass; re-run the guarded e2e**

```bash
npx vitest run tests/unit/boardRendererSpecial.test.ts && npm run test:unit && npx tsc --noEmit
npx playwright test merge-animation visual-effects --reporter=line
```

Expected: new file `7 passed`; full unit `Test Files  34 passed (34)`, `Tests  521 passed (521)`; `tsc` clean; e2e `6 passed` (the endless renderer is unchanged).

- [ ] **Step 1.6: Commit**

```bash
git add workspace/src/boardRenderer.ts workspace/tests/unit/fakeCanvas.ts workspace/tests/unit/boardRendererSpecial.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): board renderer draws stones, zero tiles and frozen cells

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 2: Enemy portraits and the pure view-model helpers

**Files:**
- Create: `workspace/src/adventure/enemyArt.ts`
- Create: `workspace/src/adventure/viewModel.ts`
- Create: `workspace/tests/unit/adventure/enemyArt.test.ts`
- Create: `workspace/tests/unit/adventure/viewModel.test.ts`

**Interfaces:**

Consumes: `enemies.ts` (`ENEMIES`, `EnemyShape`, `getEnemy`, `Intent`, `Zone`), `battle.ts` (`SPELLS`, `hasPlayableSpell`, `shouldOverload`, `BattleEvent`, ...), `run.ts` (`TOTAL_BATTLES`, `RewardOption`, `RunState`), `relics.ts` (`getRelic`), `intents.ts` (`freezeMask`), `grid.ts` (`canMove`), plus `tests/unit/fakeCanvas.ts` and `tests/unit/adventure/runHelpers.ts` in tests.

Produces:
```ts
// enemyArt.ts
export function drawEnemyArt(ctx: CanvasRenderingContext2D, shape: EnemyShape, color: string, size: number, time?: number): void;
// viewModel.ts
export const SWIPE_MIN_PX: number;                                  // 30
export const KEY_TO_DIRECTION: Record<string, Direction>;           // arrows + WASD
export function swipeDirection(dx: number, dy: number, minPx?: number): Direction | null;
export function boardPixelSize(viewportWidth: number, viewportHeight: number): number;   // min(w-24, h-350, 440), >= 200
export const ZONE_NAMES: Record<Zone, string>;  export const SPELL_ICONS: Record<SpellId, string>;  export const SPELL_HELP: Record<SpellId, string>;
export function stageLabel(battleIndex: number): string;            // "森林 1/3"
export interface Pip { state: "done" | "current" | "todo"; boss: boolean }
export function progressPips(run: RunState): Pip[];                 // 9 entries
export function intentView(intent: Intent): { icon: string; text: string };
export function describeEvent(event: BattleEvent): string | null;
export function logLines(events: BattleEvent[]): string[];
export function damageTotal(events: BattleEvent[]): number;  export function heroDamageTotal(events: BattleEvent[]): number;
export interface OfferView { icon: string; title: string; desc: string }
export function offerView(option: RewardOption): OfferView;
export function offerTitle(run: RunState): string;
export function stuckHint(state: BattleState, hooks?: BattleHooksInput): string | null;
export function resultView(run: RunState): { title: string; lines: string[] };
export function continueSummary(run: RunState): string;            // "第 4/9 場 · 冰窟 1/3 · ❤ 7/10"
```

- [ ] **Step 2.1: Write the failing tests**

Create `workspace/tests/unit/adventure/enemyArt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ENEMIES } from "../../../src/adventure/enemies";
import { drawEnemyArt } from "../../../src/adventure/enemyArt";
import { fakeCanvas } from "../fakeCanvas";

describe("drawEnemyArt", () => {
  it.each(ENEMIES.map((e) => [e.id, e.shape, e.color] as const))(
    "%s (%s) draws something without throwing",
    (_id, shape, color) => {
      const { ctx, calls } = fakeCanvas(96);
      expect(() => drawEnemyArt(ctx, shape, color, 96, 1234)).not.toThrow();
      expect(calls.filter((c) => ["fill", "stroke"].includes(c.op)).length).toBeGreaterThan(0);
      expect(calls[0].op).toBe("save");
      expect(calls[calls.length - 1].op).toBe("restore");
    },
  );

  it("covers all 9 distinct shapes", () => {
    expect(new Set(ENEMIES.map((e) => e.shape)).size).toBe(9);
  });

  it("uses the enemy colour for its body", () => {
    const { ctx, calls } = fakeCanvas(96);
    drawEnemyArt(ctx, "circle", "#86efac", 96);
    expect(calls.find((c) => c.op === "fill")?.fillStyle).toBe("#86efac");
  });
});
```
Create `workspace/tests/unit/adventure/viewModel.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STONE } from "../../../src/grid";
import type { BattleEvent } from "../../../src/adventure/battle";
import { ENEMIES } from "../../../src/adventure/enemies";
import {
  boardPixelSize,
  continueSummary,
  damageTotal,
  describeEvent,
  heroDamageTotal,
  KEY_TO_DIRECTION,
  intentView,
  logLines,
  offerTitle,
  offerView,
  progressPips,
  resultView,
  stageLabel,
  stuckHint,
  swipeDirection,
} from "../../../src/adventure/viewModel";
import { gridWith, makeState } from "./battleHelpers";
import { runInBattle } from "./runHelpers";

describe("swipeDirection", () => {
  it("picks the dominant axis", () => {
    expect(swipeDirection(60, 10)).toBe("right");
    expect(swipeDirection(-60, 10)).toBe("left");
    expect(swipeDirection(5, 80)).toBe("down");
    expect(swipeDirection(5, -80)).toBe("up");
  });
  it("short drags are taps, not swipes", () => {
    expect(swipeDirection(10, -10)).toBeNull();
    expect(swipeDirection(29, 0)).toBeNull();
    expect(swipeDirection(30, 0)).toBe("right");
  });
});

describe("KEY_TO_DIRECTION", () => {
  it("maps arrows and WASD like endless mode", () => {
    expect(KEY_TO_DIRECTION.ArrowUp).toBe("up");
    expect(KEY_TO_DIRECTION.d).toBe("right");
    expect(Object.keys(KEY_TO_DIRECTION)).toHaveLength(8);
  });
});

describe("boardPixelSize", () => {
  it("fits iPhone portrait: 390x844 -> 366, 430x932 -> 406", () => {
    expect(boardPixelSize(390, 844)).toBe(366);
    expect(boardPixelSize(430, 932)).toBe(406);
  });
  it("is capped on big screens and floored on tiny ones", () => {
    expect(boardPixelSize(1920, 1400)).toBe(440);
    expect(boardPixelSize(300, 400)).toBe(200);
  });
  it("leaves room for the 350px of other controls", () => {
    expect(boardPixelSize(500, 700)).toBe(350);
  });
});

describe("stageLabel and progressPips", () => {
  it("names the zone and the place inside it", () => {
    expect(stageLabel(0)).toBe("森林 1/3");
    expect(stageLabel(2)).toBe("森林 3/3");
    expect(stageLabel(4)).toBe("冰窟 2/3");
    expect(stageLabel(8)).toBe("魔王塔 3/3");
  });

  it("marks done, current and todo, with a boss flag every third pip", () => {
    const run = runInBattle(gridWith([]), {}, {}, 4);
    const pips = progressPips(run);
    expect(pips).toHaveLength(9);
    expect(pips.map((p) => p.state)).toEqual([
      "done", "done", "done", "done", "current", "todo", "todo", "todo", "todo",
    ]);
    expect(pips.map((p) => p.boss)).toEqual(ENEMIES.map((e) => e.boss));
  });

  it("after a win (reward phase) the next fight is the current one; victory fills all 9", () => {
    const reward = { ...runInBattle(gridWith([]), {}, {}, 1), phase: "reward" as const };
    expect(progressPips(reward).map((p) => p.state).slice(0, 4)).toEqual(["done", "done", "current", "todo"]);
    const won = { ...runInBattle(gridWith([]), {}, {}, 8), phase: "victory" as const };
    expect(progressPips(won).every((p) => p.state === "done")).toBe(true);
  });
});

describe("intentView", () => {
  it("shows an icon and Traditional Chinese text for all 6 intents", () => {
    expect(intentView({ kind: "attack", amount: 2 })).toEqual({ icon: "⚔", text: "攻擊 2" });
    expect(intentView({ kind: "rockfall", amount: 3 })).toEqual({ icon: "🪨", text: "落石 3" });
    expect(intentView({ kind: "freeze", amount: 1 })).toEqual({ icon: "❄", text: "冰凍" });
    expect(intentView({ kind: "freeze", amount: 2 }).text).toBe("冰凍 ×2");
    expect(intentView({ kind: "shield", amount: 10 })).toEqual({ icon: "🛡", text: "護盾 10" });
    expect(intentView({ kind: "scramble", amount: 1 })).toEqual({ icon: "🌀", text: "擾亂" });
    expect(intentView({ kind: "zero", amount: 2 })).toEqual({ icon: "⭕", text: "歸零" });
  });
});

describe("describeEvent / logLines", () => {
  const cell = { row: 0, col: 0 };
  it("describes the interesting events", () => {
    expect(describeEvent({ type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "slide" })).toBe("消除 1 對");
    expect(describeEvent({ type: "pairCleared", count: 2, chain: true, damagePerPair: 15, source: "slide" })).toBe("連鎖！消除 2 對，每對 15 傷害");
    expect(describeEvent({ type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "addOne" })).toBe("增幅消除 1 對");
    expect(describeEvent({ type: "stoneBroken", cell, cause: "adjacent" })).toBe("石塊碎裂");
    expect(describeEvent({ type: "thawed", cells: [cell], cause: "expired" })).toBe("冰凍解除");
    expect(describeEvent({ type: "thawed", cells: [cell], cause: "cleared" })).toBeNull();
    expect(describeEvent({ type: "spellCast", spell: "bomb", cost: 4, target: cell })).toBe("施放爆裂");
    expect(describeEvent({ type: "overload", hpLost: 2, cleared: [cell, cell] })).toBe("魔力暴走！-2 血，清除 2 格");
    expect(describeEvent({ type: "overload", hpLost: 0, cleared: [cell] })).toBe("魔力暴走！清除 1 格");
    expect(describeEvent({ type: "battleEnded", result: "victory" })).toBe("勝利！");
    expect(describeEvent({ type: "battleEnded", result: "defeat" })).toBe("你被擊敗了…");
  });

  it("describes every intent effect", () => {
    const fired = (intent: any, effect: any): BattleEvent => ({ type: "intentFired", intent, effect });
    expect(describeEvent(fired({ kind: "attack", amount: 2 }, { kind: "attack", damage: 2 }))).toBe("敵人攻擊！-2 血");
    expect(describeEvent(fired({ kind: "rockfall", amount: 2 }, { kind: "rockfall", placed: [cell, cell] }))).toBe("落石！2 塊石頭掉落");
    expect(describeEvent(fired({ kind: "freeze", amount: 1 }, { kind: "freeze", frozen: [cell] }))).toBe("冰凍！1 格被凍住");
    expect(describeEvent(fired({ kind: "shield", amount: 10 }, { kind: "shield", gained: 10 }))).toBe("敵人獲得 10 點護盾");
    expect(describeEvent(fired({ kind: "scramble", amount: 1 }, { kind: "scramble", changed: [{ row: 0, col: 0, from: 3, to: 4 }] }))).toBe("擾亂！1 格數字改變");
    expect(describeEvent(fired({ kind: "zero", amount: 2 }, { kind: "zero", zeroed: [cell, cell] }))).toBe("歸零！2 格變成 0");
  });

  it("animation-only events have no text, and logLines drops them", () => {
    const events: BattleEvent[] = [
      { type: "manaChanged", delta: 1, mana: 1 },
      { type: "pairCleared", count: 1, chain: false, damagePerPair: 10, source: "slide" },
      { type: "tileSpawned", cell, value: 3 },
    ];
    expect(describeEvent(events[0])).toBeNull();
    expect(logLines(events)).toEqual(["消除 1 對"]);
  });

  it("damageTotal and heroDamageTotal add up the numbers for the floating text", () => {
    const events: BattleEvent[] = [
      { type: "damageDealt", amount: 30, absorbed: 10, hpDamage: 20, source: "pair" },
      { type: "damageDealt", amount: 5, absorbed: 0, hpDamage: 5, source: "relic" },
      { type: "heroHpChanged", delta: -2, hp: 8, cause: "attack" },
      { type: "heroHpChanged", delta: 1, hp: 9, cause: "relic" },
    ];
    expect(damageTotal(events)).toBe(35);
    expect(heroDamageTotal(events)).toBe(2);
  });
});

describe("offerView / offerTitle", () => {
  it("describes relic, upgrade and heal offers", () => {
    expect(offerView({ kind: "relic", relicId: "manaCrystal" })).toEqual({ icon: "💎", title: "魔力水晶", desc: "每場戰鬥開始時魔力 +2" });
    expect(offerView({ kind: "upgrade", spell: "bomb" })).toEqual({ icon: "💣", title: "爆裂強化", desc: "魔力消耗 4 → 3" });
    expect(offerView({ kind: "heal", amount: 3 }).title).toBe("回復 3 血");
  });

  it("titles the modal by phase and boss-ness", () => {
    expect(offerTitle({ ...runInBattle(gridWith([])), phase: "relicPick", battle: null })).toBe("選擇一個起始遺物");
    expect(offerTitle({ ...runInBattle(gridWith([])), phase: "reward" })).toBe("戰鬥勝利！選擇一個獎勵");
    expect(offerTitle({ ...runInBattle(gridWith([]), {}, {}, 2), phase: "reward" })).toBe("Boss 討伐！選擇一個遺物");
  });
});

describe("stuckHint", () => {
  it("says nothing while a move exists", () => {
    expect(stuckHint(makeState(gridWith([[1, 2]])))).toBeNull();
  });
  it("tells the player to cast when stuck with a playable spell, and warns about the overload when not", () => {
    const stones = Array.from({ length: 4 }, () => [STONE, STONE, STONE, STONE]);
    expect(stuckHint(makeState(stones, { mana: 2 }))).toBe("盤面卡住了，請施放法術");
    expect(stuckHint(makeState(stones, { mana: 0 }))).toBe("魔力不足，再滑動會觸發魔力暴走");
  });
});

describe("resultView / continueSummary", () => {
  it("defeat shows how far the hero got and who won", () => {
    const run = { ...runInBattle(gridWith([]), {}, { relics: ["chainRing"] }, 5), phase: "defeat" as const };
    expect(resultView(run)).toEqual({
      title: "💀 冒險失敗",
      lines: ["到達第 6 場（冰窟 3/3）", "敗給了六角冰后", "遺物：💍連鎖之戒"],
    });
  });
  it("victory congratulates", () => {
    const run = { ...runInBattle(gridWith([]), {}, {}, 8), phase: "victory" as const };
    const view = resultView(run);
    expect(view.title).toBe("🏆 通關！");
    expect(view.lines[1]).toBe("沒有取得遺物");
  });
  it("the menu button summary", () => {
    expect(continueSummary(runInBattle(gridWith([]), { heroHp: 7 }, {}, 3))).toBe("第 4/9 場 · 冰窟 1/3 · ❤ 7/10");
  });
});
```

- [ ] **Step 2.2: Run and see them fail**

```bash
npx vitest run tests/unit/adventure/enemyArt.test.ts tests/unit/adventure/viewModel.test.ts
```

Expected: both files fail to load (`Failed to load url ... src/adventure/enemyArt` / `viewModel`), `Test Files  2 failed (2)`.

- [ ] **Step 2.3: Implement `enemyArt.ts` and `viewModel.ts`**

Create `workspace/src/adventure/enemyArt.ts`:
```ts
/**
 * Simple geometric enemy portraits (spec 5.2), drawn straight onto a canvas.
 * No DOM access: callers pass the 2D context and the square size in pixels.
 */
import type { EnemyShape } from "./enemies";

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, sides: number, rotation: number): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function eyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, spread: number, radius: number): void {
  [-1, 1].forEach((side) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx + side * spread, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(cx + side * spread, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Draw `shape` filled with `color` inside a `size` x `size` box at the origin.
 * `time` (ms) makes it bob gently; pass 0 for a still frame.
 */
export function drawEnemyArt(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape,
  color: string,
  size: number,
  time = 0,
): void {
  const c = size / 2;
  const r = size * 0.38;
  const bob = Math.sin(time / 350) * size * 0.02;
  ctx.save();
  ctx.translate(0, bob);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (shape) {
    case "circle":
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, c, c - r * 0.1, r * 0.35, r * 0.2);
      break;
    case "square":
      ctx.beginPath();
      ctx.roundRect(c - r, c - r, r * 2, r * 2, size * 0.06);
      ctx.fill();
      eyes(ctx, c, c - r * 0.1, r * 0.4, r * 0.2);
      break;
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(c, c - r * 1.05);
      ctx.lineTo(c + r * 1.05, c + r * 0.85);
      ctx.lineTo(c - r * 1.05, c + r * 0.85);
      ctx.closePath();
      ctx.fill();
      eyes(ctx, c, c + r * 0.2, r * 0.3, r * 0.17);
      break;
    case "snowflake":
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI) / 3;
        ctx.moveTo(c - r * Math.cos(angle), c - r * Math.sin(angle));
        ctx.lineTo(c + r * Math.cos(angle), c + r * Math.sin(angle));
      }
      ctx.stroke();
      eyes(ctx, c, c, r * 0.22, r * 0.14);
      break;
    case "diamond":
      polygon(ctx, c, c, r * 1.1, 4, 0);
      ctx.fill();
      eyes(ctx, c, c, r * 0.3, r * 0.17);
      break;
    case "hexagon":
      polygon(ctx, c, c, r, 6, 0);
      ctx.fill();
      eyes(ctx, c, c - r * 0.05, r * 0.35, r * 0.18);
      break;
    case "spiral":
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI * 4;
        const rad = (t / (Math.PI * 4)) * r;
        const px = c + rad * Math.cos(t + time / 900);
        const py = c + rad * Math.sin(t + time / 900);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    case "shadowSquare":
      ctx.beginPath();
      ctx.roundRect(c - r, c - r, r * 2, r * 2, size * 0.04);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.beginPath();
      ctx.roundRect(c - r * 0.6, c - r * 0.6, r * 1.2, r * 1.2, size * 0.03);
      ctx.stroke();
      eyes(ctx, c, c, r * 0.28, r * 0.15);
      break;
    case "ring":
      ctx.lineWidth = size * 0.12;
      ctx.beginPath();
      ctx.arc(c, c, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(c, c, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}
```
Create `workspace/src/adventure/viewModel.ts`:
```ts
/**
 * Pure helpers for the adventure screen: text, icons, sizes and swipe maths.
 * No DOM, no Canvas, so all of it is unit-tested; `view.ts` only wires these
 * into elements. All player-facing text is Traditional Chinese.
 */
import { canMove, type Direction } from "../grid";
import {
  SPELLS,
  hasPlayableSpell,
  shouldOverload,
  type BattleEvent,
  type BattleHooksInput,
  type BattleState,
  type SpellId,
} from "./battle";
import { ENEMIES, getEnemy, type Intent, type Zone } from "./enemies";
import { freezeMask } from "./intents";
import { getRelic } from "./relics";
import { TOTAL_BATTLES, type RewardOption, type RunState } from "./run";

export const SWIPE_MIN_PX = 30;

/** Same keys as endless mode: arrows and WASD. */
export const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

/** Dominant axis of a drag, or null when it is too short to count as a swipe. */
export function swipeDirection(dx: number, dy: number, minPx: number = SWIPE_MIN_PX): Direction | null {
  if (Math.abs(dx) < minPx && Math.abs(dy) < minPx) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Height of everything on the adventure screen except the board (top bar, enemy card, hero row, spells, relics, log). */
export const ADV_CHROME_HEIGHT = 350;
export const ADV_SIDE_MARGIN = 24;
export const ADV_BOARD_MAX = 440;
export const ADV_BOARD_MIN = 200;

/** Square board size so that the whole adventure screen fits the viewport (iPhone 390x844 -> 366). */
export function boardPixelSize(viewportWidth: number, viewportHeight: number): number {
  const size = Math.min(viewportWidth - ADV_SIDE_MARGIN, viewportHeight - ADV_CHROME_HEIGHT, ADV_BOARD_MAX);
  return Math.max(ADV_BOARD_MIN, Math.floor(size));
}

export const ZONE_NAMES: Record<Zone, string> = { forest: "森林", ice: "冰窟", tower: "魔王塔" };
export const SPELL_ICONS: Record<SpellId, string> = { hammer: "🔨", addOne: "➕", bomb: "💣", shuffle: "🔀" };
export const SPELL_HELP: Record<SpellId, string> = {
  hammer: "點一格打碎（數字、石塊、0 都可以）",
  addOne: "點一格數字 +1（9 直接消除，算一對）",
  bomb: "點一格，清除它和上下左右共 5 格",
  shuffle: "重新排列盤面上的格子（冰凍格不動）",
};

/** "森林 1/3": zone name and the fight's place within the zone. */
export function stageLabel(battleIndex: number): string {
  const enemy = ENEMIES[battleIndex];
  return `${ZONE_NAMES[enemy.zone]} ${(battleIndex % 3) + 1}/3`;
}

export interface Pip {
  state: "done" | "current" | "todo";
  boss: boolean;
}

/** The 9-step progress strip: fights already won, the current one, and those still ahead. */
export function progressPips(run: RunState): Pip[] {
  const cleared = run.phase === "victory" ? TOTAL_BATTLES : run.phase === "reward" ? run.battleIndex + 1 : run.battleIndex;
  return ENEMIES.map((enemy, i) => ({
    boss: enemy.boss,
    state: i < cleared ? "done" : i === cleared && run.phase !== "victory" ? "current" : "todo",
  }));
}

export function intentView(intent: Intent): { icon: string; text: string } {
  switch (intent.kind) {
    case "attack":
      return { icon: "⚔", text: `攻擊 ${intent.amount}` };
    case "rockfall":
      return { icon: "🪨", text: `落石 ${intent.amount}` };
    case "freeze":
      return { icon: "❄", text: intent.amount > 1 ? `冰凍 ×${intent.amount}` : "冰凍" };
    case "shield":
      return { icon: "🛡", text: `護盾 ${intent.amount}` };
    case "scramble":
      return { icon: "🌀", text: "擾亂" };
    case "zero":
      return { icon: "⭕", text: "歸零" };
  }
}

/** One log line for an event, or null for events that only drive animation. */
export function describeEvent(event: BattleEvent): string | null {
  switch (event.type) {
    case "pairCleared":
      if (event.source === "addOne") return "增幅消除 1 對";
      return event.chain ? `連鎖！消除 ${event.count} 對，每對 ${event.damagePerPair} 傷害` : `消除 ${event.count} 對`;
    case "stoneBroken":
      return "石塊碎裂";
    case "thawed":
      return event.cause === "expired" ? "冰凍解除" : null;
    case "intentFired": {
      const effect = event.effect;
      switch (effect.kind) {
        case "attack":
          return `敵人攻擊！-${effect.damage} 血`;
        case "rockfall":
          return `落石！${effect.placed.length} 塊石頭掉落`;
        case "freeze":
          return `冰凍！${effect.frozen.length} 格被凍住`;
        case "shield":
          return `敵人獲得 ${effect.gained} 點護盾`;
        case "scramble":
          return `擾亂！${effect.changed.length} 格數字改變`;
        case "zero":
          return `歸零！${effect.zeroed.length} 格變成 0`;
      }
      return null;
    }
    case "spellCast":
      return `施放${SPELLS[event.spell].name}`;
    case "overload":
      return event.hpLost > 0
        ? `魔力暴走！-${event.hpLost} 血，清除 ${event.cleared.length} 格`
        : `魔力暴走！清除 ${event.cleared.length} 格`;
    case "battleEnded":
      return event.result === "victory" ? "勝利！" : "你被擊敗了…";
    default:
      return null;
  }
}

export function logLines(events: BattleEvent[]): string[] {
  return events.flatMap((event) => {
    const line = describeEvent(event);
    return line ? [line] : [];
  });
}

/** Total damage the hero dealt in a batch of events (for the floating "-N"). */
export function damageTotal(events: BattleEvent[]): number {
  return events.reduce((sum, e) => (e.type === "damageDealt" ? sum + e.amount : sum), 0);
}

/** HP the hero lost in a batch of events (for the floating "-N" on the hero). */
export function heroDamageTotal(events: BattleEvent[]): number {
  return events.reduce((sum, e) => (e.type === "heroHpChanged" && e.delta < 0 ? sum - e.delta : sum), 0);
}

export interface OfferView {
  icon: string;
  title: string;
  desc: string;
}

export function offerView(option: RewardOption): OfferView {
  switch (option.kind) {
    case "relic": {
      const relic = getRelic(option.relicId);
      return { icon: relic?.icon ?? "❓", title: relic?.name ?? option.relicId, desc: relic?.description ?? "" };
    }
    case "upgrade": {
      const spell = SPELLS[option.spell];
      return {
        icon: SPELL_ICONS[option.spell],
        title: `${spell.name}強化`,
        desc: `魔力消耗 ${spell.cost} → ${spell.upgradedCost}`,
      };
    }
    case "heal":
      return { icon: "❤️", title: `回復 ${option.amount} 血`, desc: "回復血量（不超過上限）" };
  }
}

/** Modal heading for the pending choice. */
export function offerTitle(run: RunState): string {
  if (run.phase === "relicPick") return "選擇一個起始遺物";
  const boss = Boolean(getEnemy(run.battle?.enemyId ?? "")?.boss);
  return boss ? "Boss 討伐！選擇一個遺物" : "戰鬥勝利！選擇一個獎勵";
}

/** A hint under the board when the player is stuck (spec 4.3 / plan 2 risk 8). */
export function stuckHint(state: BattleState, hooks: BattleHooksInput = {}): string | null {
  if (state.status !== "ongoing") return null;
  if (canMove(state.grid, freezeMask(state.grid.length, state.freezes))) return null;
  if (shouldOverload(state, hooks)) return "魔力不足，再滑動會觸發魔力暴走";
  return hasPlayableSpell(state, hooks) ? "盤面卡住了，請施放法術" : null;
}

export function resultView(run: RunState): { title: string; lines: string[] } {
  const relics = run.relics.map((id) => getRelic(id)).flatMap((r) => (r ? [`${r.icon}${r.name}`] : []));
  const relicLine = relics.length > 0 ? `遺物：${relics.join(" ")}` : "沒有取得遺物";
  if (run.phase === "victory") {
    return { title: "🏆 通關！", lines: ["你擊敗了零之魔王！", relicLine] };
  }
  const enemy = getEnemy(run.battle?.enemyId ?? "");
  return {
    title: "💀 冒險失敗",
    lines: [
      `到達第 ${run.battleIndex + 1} 場（${stageLabel(run.battleIndex)}）`,
      enemy ? `敗給了${enemy.name}` : "",
      relicLine,
    ].filter((line) => line !== ""),
  };
}

/** One-line summary for the "繼續冒險" button on the menu. */
export function continueSummary(run: RunState): string {
  return `第 ${run.battleIndex + 1}/${TOTAL_BATTLES} 場 · ${stageLabel(run.battleIndex)} · ❤ ${run.heroHp}/${run.heroMaxHp}`;
}
```

- [ ] **Step 2.4: Run and see them pass**

```bash
npx vitest run tests/unit/adventure/enemyArt.test.ts tests/unit/adventure/viewModel.test.ts && npm run test:unit && npx tsc --noEmit
```

Expected: `enemyArt` `11 passed` (9 enemies + 2), `viewModel` `21 passed`; full unit `Test Files  36 passed (36)`, `Tests  553 passed (553)`; `tsc` clean.

- [ ] **Step 2.5: Commit**

```bash
git add workspace/src/adventure/enemyArt.ts workspace/src/adventure/viewModel.ts workspace/tests/unit/adventure/enemyArt.test.ts workspace/tests/unit/adventure/viewModel.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): geometric enemy portraits and adventure view-model helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 3: Screen mode, `?seed=` generator and the `game.ts` gate

**Files:**
- Create: `workspace/src/mode.ts`
- Create: `workspace/src/adventure/rng.ts`
- Create: `workspace/tests/unit/mode.test.ts`
- Create: `workspace/tests/unit/adventure/rng.test.ts`
- Modify: `workspace/src/game.ts` (three edits)

**Interfaces:**

Produces:
```ts
// mode.ts
export type Screen = "menu" | "endless" | "adventure";
export function getScreen(): Screen;                // default "endless"
export function setScreen(screen: Screen): void;    // also sets document.body.dataset.screen when a DOM exists
// adventure/rng.ts
export function mulberry32(seed: number): Rng;
export function seededRngFromSearch(search: string, dev: boolean): Rng | null;   // "?seed=42" -> Rng, only when dev
// game.ts: `export const audio` (was a private const); handleKeydown returns early unless getScreen() === "endless"
```

- [ ] **Step 3.1: Write the failing tests**

Create `workspace/tests/unit/mode.test.ts`:
```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { getScreen, setScreen } from "../../src/mode";

describe("screen mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setScreen("endless");
  });

  it("defaults to endless so the page behaves as before until main.ts decides", () => {
    expect(getScreen()).toBe("endless");
  });

  it("setScreen updates the value and mirrors it into body[data-screen]", () => {
    const body = { dataset: {} as Record<string, string> };
    vi.stubGlobal("document", { body });
    setScreen("adventure");
    expect(getScreen()).toBe("adventure");
    expect(body.dataset.screen).toBe("adventure");
    setScreen("menu");
    expect(body.dataset.screen).toBe("menu");
  });

  it("works without a DOM", () => {
    expect(() => setScreen("menu")).not.toThrow();
    expect(getScreen()).toBe("menu");
  });
});
```
Create `workspace/tests/unit/adventure/rng.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mulberry32, seededRngFromSearch } from "../../../src/adventure/rng";

describe("mulberry32", () => {
  it("is deterministic per seed and stays inside [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    expect(seqA).toEqual(Array.from({ length: 50 }, () => b()));
    seqA.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    });
  });

  it("different seeds give different sequences", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("seededRngFromSearch (?seed=, dev only)", () => {
  it("returns a generator for a numeric seed in dev", () => {
    const rng = seededRngFromSearch("?seed=7", true)!;
    expect(rng()).toBe(mulberry32(7)());
  });

  it("is ignored in production builds", () => {
    expect(seededRngFromSearch("?seed=7", false)).toBeNull();
  });

  it("ignores a missing, empty or non-numeric seed", () => {
    expect(seededRngFromSearch("", true)).toBeNull();
    expect(seededRngFromSearch("?seed=", true)).toBeNull();
    expect(seededRngFromSearch("?seed=abc", true)).toBeNull();
    expect(seededRngFromSearch("?seed=1.5", true)).toBeNull();
    expect(seededRngFromSearch("?other=3", true)).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run and see them fail**

```bash
npx vitest run tests/unit/mode.test.ts tests/unit/adventure/rng.test.ts
```

Expected: both fail to load (`Failed to load url ... src/mode` / `src/adventure/rng`), `Test Files  2 failed (2)`.

- [ ] **Step 3.3: Implement `mode.ts` and `rng.ts`**

Create `workspace/src/mode.ts`:
```ts
/**
 * Which top-level screen is showing. The endless game (game.ts) reads this to
 * ignore keystrokes while the menu or the adventure screen is up. It also
 * mirrors the value into `<body data-screen>` so CSS can hide/show the screens.
 * Default is "endless": until main.ts says otherwise the page behaves exactly
 * as it did before adventure mode existed.
 */
export type Screen = "menu" | "endless" | "adventure";

let current: Screen = "endless";

export function getScreen(): Screen {
  return current;
}

export function setScreen(screen: Screen): void {
  current = screen;
  if (typeof document !== "undefined" && document.body) document.body.dataset.screen = screen;
}
```
Create `workspace/src/adventure/rng.ts`:
```ts
import type { Rng } from "../grid";

/** Small deterministic generator (mulberry32): the same seed always gives the same sequence in [0, 1). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `?seed=N` support for e2e tests (spec 10). Only honoured in dev builds
 * (`dev` = `import.meta.env.DEV`): a production build ignores the parameter.
 * Returns null when there is no usable seed.
 */
export function seededRngFromSearch(search: string, dev: boolean): Rng | null {
  if (!dev) return null;
  const raw = new URLSearchParams(search).get("seed");
  if (raw === null || !/^-?\d+$/.test(raw)) return null;
  return mulberry32(Number(raw));
}
```

- [ ] **Step 3.4: Apply the three `game.ts` edits**

In `workspace/src/game.ts`:

1. Import the screen mode:

Edit `workspace/src/game.ts`. Find (must occur exactly once):
```ts
import { BoardRenderer } from "./boardRenderer";
```
Replace with:
```ts
import { BoardRenderer } from "./boardRenderer";
import { getScreen } from "./mode";
```

2. Export the audio engine (the adventure screen shares mute state):

Edit `workspace/src/game.ts`. Find (must occur exactly once):
```ts
const audio = new AudioEngine();
```
Replace with:
```ts
export const audio = new AudioEngine();
```

3. Ignore keys unless the endless screen is showing:

Edit `workspace/src/game.ts`. Find (must occur exactly once):
```ts
  if (!direction) return;

  if (isGameOver(state.grid)) return;
```
Replace with:
```ts
  if (!direction) return;
  if (getScreen() !== "endless") return; // the menu or the adventure screen is showing

  if (isGameOver(state.grid)) return;
```

- [ ] **Step 3.5: Run unit, types, build and the whole existing e2e suite**

```bash
npx vitest run tests/unit/mode.test.ts tests/unit/adventure/rng.test.ts && npm run test:unit && npx tsc --noEmit
npm run build
npx playwright test --reporter=line
```

Expected: new files `3 passed` (`mode`) and `5 passed` (`rng`); full unit `Test Files  38 passed (38)`, `Tests  561 passed (561)`; `tsc` clean; build ok; e2e `54 passed` (nothing sets the screen yet, so the default `"endless"` keeps every existing spec working).

- [ ] **Step 3.6: Commit**

```bash
git add workspace/src/mode.ts workspace/src/adventure/rng.ts workspace/src/game.ts workspace/tests/unit/mode.test.ts workspace/tests/unit/adventure/rng.test.ts
git commit -m "$(cat <<'EOT'
feat(merge10): screen mode, dev-only seeded rng and endless key gate

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 4: The e2e specs, written first (red)

**Files:**
- Create: `workspace/tests/e2e/adventureHelpers.ts`
- Create: `workspace/tests/e2e/adventure-menu.spec.ts` (9 tests)
- Create: `workspace/tests/e2e/adventure-battle.spec.ts` (10 tests)
- Create: `workspace/tests/e2e/adventure-layout.spec.ts` (6 tests: 3 per phone size)

**Interfaces:**

Consumes the DOM contract that Task 5 builds (ids used by the specs): `#mode-menu`, `#mode-adventure`, `#mode-continue`, `#mode-continue-info`, `#mode-endless`, `#mode-trophies`, `#endless-home`, `#adv-screen[data-phase][data-battle-index]`, `#adv-home`, `#adv-stage`, `#adv-progress .adv-pip`, `#adv-enemy-name`, `#adv-enemy-hptext`, `#adv-hp`, `#adv-mana`, `#adv-intent`, `#adv-board[data-targeting]`, `.adv-spell[data-spell]`, `.adv-relic`, `#adv-log`, `#adv-toast`, `#adv-offers`, `#adv-offers-title`, `.adv-offer[data-index][data-kind]`, `#adv-result`, `#adv-result-title`, `#adv-result-lines`, `#adv-result-again`, `#adv-result-home`, `#adv-trophy-modal`, `#adv-trophy-list li[data-trophy][data-unlocked]`, `#adv-trophy-close`; and the dev hooks `window.__adv` (`getRun`, `isBusy`, `setRun`, `patchBattle`) and `?seed=`.

Helpers exported by `adventureHelpers.ts`: `NO_DEBUG_START`, `getRun`, `setRun`, `patchBattle`, `startAdventure(page, seed?)`, `pickOffer(page, index?)`, `bestDirection(run)`, `waitIdle(page)`, `playBattleOut(page, maxTurns?)`, `cellCenter(page, row, col)`. The specs import the pure layer straight from `src/` (`slide`, `freezeMask`, `createBattle`, `createRun`, `chooseOffer`, `mulberry32`, ...) to build states and to drive a greedy bot.

What the specs pin (one line each):
- menu: fresh launch shows the menu with no 繼續冒險; 修練 opens the unchanged endless game and 🏠 goes back; arrow keys do nothing to the endless board while the menu or the adventure screen is up; 冒險 -> relic pick (3 offers) -> battle 1 against 圓史萊姆 (40/40, intent pill, 9 pips, 1 relic, 4 spells); 🏠 then 繼續冒險 survives a reload and restores the exact run; a corrupt save is discarded without a page error; the trophy modal lists 6 locked trophies.
- battle: a whole real battle is played with swipes (enemy HP lowered to 20 for speed) -> reward modal -> next enemy; the telegraphed attack lands; defeat screen deletes the save; 再來一次; beating the zero lord -> 通關 + first-clear trophy + toast + trophy list; killing the tree king -> boss modal with 3 relics and half-max-HP heal; 爆裂 needs mana, arms, targets and clears the cross without spending a turn; 洗牌 is instant and 碎石 can be cancelled; stones / zeros / frozen tiles draw without page errors; `?seed=` reproduces offers and the first board.
- layout: at 390x844 and 430x932 the menu, every battle block and the reward modal fit the viewport, the page does not scroll, the board is at least 340px and spell buttons are at least 44px.

- [ ] **Step 4.1: Write the specs**

Create `workspace/tests/e2e/adventureHelpers.ts`:
```ts
import { expect, type Page } from "@playwright/test";
import { slide, type Direction } from "../../src/grid";
import { freezeMask } from "../../src/adventure/intents";
import type { RunState } from "../../src/adventure/run";

/** Clears the config's dev-start seed so the page opens on the start menu. */
export const NO_DEBUG_START = { storageState: { cookies: [], origins: [] } };

type AdvWindow = {
  __adv: {
    getRun: () => RunState | null;
    isBusy: () => boolean;
    setRun: (run: RunState) => void;
    patchBattle: (changes: Record<string, unknown>) => void;
  };
};

export const getRun = (page: Page): Promise<RunState> =>
  page.evaluate(() => (window as unknown as AdvWindow).__adv.getRun() as RunState);

export const setRun = (page: Page, run: RunState): Promise<void> =>
  page.evaluate((r) => (window as unknown as AdvWindow).__adv.setRun(r), run);

export const patchBattle = (page: Page, changes: Record<string, unknown>): Promise<void> =>
  page.evaluate((c) => (window as unknown as AdvWindow).__adv.patchBattle(c), changes);

/** Opens the page on the start menu (optionally with ?seed=) and enters a fresh adventure. */
export async function startAdventure(page: Page, seed = 1): Promise<void> {
  await page.goto(`./?seed=${seed}`);
  await page.locator("#mode-adventure").click();
  await expect(page.locator("#adv-offers")).toBeVisible();
}

/** Picks offer `index` in the open reward/relic modal. */
export async function pickOffer(page: Page, index = 0): Promise<void> {
  await page.locator(`.adv-offer[data-index="${index}"]`).click();
  await expect(page.locator("#adv-offers")).toBeHidden();
}

/** The direction that clears the most pairs right now (any legal one if none clears), or null when stuck. */
export function bestDirection(run: RunState): Direction | null {
  const battle = run.battle!;
  const mask = freezeMask(battle.grid.length, battle.freezes);
  let best: Direction | null = null;
  let bestPairs = -1;
  for (const direction of ["left", "right", "up", "down"] as Direction[]) {
    const outcome = slide(battle.grid, direction, mask);
    if (outcome.moved && outcome.eliminatedPairs.length > bestPairs) {
      best = direction;
      bestPairs = outcome.eliminatedPairs.length;
    }
  }
  return best;
}

const KEY: Record<Direction, string> = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };

/** Waits until the board animation has finished and input is accepted again. */
export const waitIdle = (page: Page) =>
  page.waitForFunction(() => !(window as unknown as AdvWindow).__adv.isBusy());

/** Plays greedy swipes until the run leaves the battle phase (or `maxTurns` is hit). Returns the turns played. */
export async function playBattleOut(page: Page, maxTurns = 120): Promise<number> {
  let turns = 0;
  while (turns < maxTurns) {
    await waitIdle(page);
    const run = await getRun(page);
    if (run.phase !== "battle") return turns;
    const direction = bestDirection(run) ?? "left"; // stuck: any swipe resolves the overload safety net
    await page.keyboard.press(KEY[direction]);
    turns += 1;
  }
  return turns;
}

/** Screen-space centre of board cell (row, col). */
export async function cellCenter(page: Page, row: number, col: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator("#adv-board").boundingBox())!;
  return { x: ((col + 0.5) * box.width) / 4, y: ((row + 0.5) * box.height) / 4 };
}
```
Create `workspace/tests/e2e/adventure-menu.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import type { GameState } from "../../src/grid";
import { NO_DEBUG_START, getRun, pickOffer, startAdventure } from "./adventureHelpers";

test.use(NO_DEBUG_START);

type EndlessWindow = {
  __getGameState: () => GameState;
  __setTestState: (s: GameState, rng?: () => number) => void;
};

const mergeable: GameState = {
  grid: [
    [4, 6, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ],
  score: 0,
};

test("a fresh launch shows the start menu with 冒險, 修練 and 冒險獎盃 and no 繼續冒險", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-adventure")).toContainText("冒險");
  await expect(page.locator("#mode-endless")).toContainText("修練");
  await expect(page.locator("#mode-trophies")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "menu");
  await expect(page.locator("#game")).toBeHidden();
  await expect(page.locator("#adv-screen")).toBeHidden();
});

test("修練 opens the unchanged endless game, and 🏠 returns to the menu", async ({ page }) => {
  await page.goto("./");
  await page.locator("#mode-endless").click();
  await expect(page.locator("#mode-menu")).toBeHidden();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator("#endless-home")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "endless");

  await page.evaluate((s) => (window as unknown as EndlessWindow).__setTestState(s, () => 0), mergeable);
  await page.keyboard.press("ArrowLeft");
  const state = await page.evaluate(() => (window as unknown as EndlessWindow).__getGameState());
  expect(state.score).toBe(10);

  await page.locator("#endless-home").click();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#game")).toBeHidden();
});

test("arrow keys do nothing to the endless board while the menu is showing", async ({ page }) => {
  await page.goto("./");
  await page.evaluate((s) => (window as unknown as EndlessWindow).__setTestState(s, () => 0), mergeable);
  await page.keyboard.press("ArrowLeft");
  const state = await page.evaluate(() => (window as unknown as EndlessWindow).__getGameState());
  expect(state).toEqual(mergeable);
});

test("冒險 opens the opening relic pick, then the first battle against the slime", async ({ page }) => {
  await startAdventure(page, 1);
  await expect(page.locator("body")).toHaveAttribute("data-screen", "adventure");
  await expect(page.locator("#adv-screen")).toBeVisible();
  await expect(page.locator("#game")).toBeHidden();
  await expect(page.locator("#adv-offers-title")).toHaveText("選擇一個起始遺物");
  await expect(page.locator(".adv-offer")).toHaveCount(3);

  await pickOffer(page, 0);
  await expect(page.locator("#adv-screen")).toHaveAttribute("data-phase", "battle");
  await expect(page.locator("#adv-enemy-name")).toHaveText("圓史萊姆");
  await expect(page.locator("#adv-enemy-hptext")).toHaveText("40/40");
  await expect(page.locator("#adv-hp")).toContainText("10/10");
  await expect(page.locator("#adv-intent")).toContainText("攻擊");
  await expect(page.locator(".adv-pip")).toHaveCount(9);
  await expect(page.locator(".adv-relic")).toHaveCount(1);
  await expect(page.locator(".adv-spell")).toHaveCount(4);
});

test("keys pressed on the adventure screen do not move the hidden endless board", async ({ page }) => {
  await startAdventure(page, 1);
  await pickOffer(page, 0);
  await page.evaluate((s) => (window as unknown as EndlessWindow).__setTestState(s, () => 0), mergeable);
  await page.keyboard.press("ArrowLeft");
  const state = await page.evaluate(() => (window as unknown as EndlessWindow).__getGameState());
  expect(state).toEqual(mergeable);
});

test("🏠 from a battle goes to the menu, which then offers 繼續冒險; continuing restores the exact run", async ({ page }) => {
  await startAdventure(page, 2);
  await pickOffer(page, 0);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1500);
  const before = await getRun(page);

  await page.locator("#adv-home").click();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeVisible();
  await expect(page.locator("#mode-continue-info")).toContainText("第 1/9 場");

  await page.reload();
  await expect(page.locator("#mode-continue")).toBeVisible(); // survives a page reload
  await page.locator("#mode-continue").click();
  await expect(page.locator("#adv-screen")).toBeVisible();
  expect(await getRun(page)).toEqual(before);
});

test("a corrupt save is discarded: no 繼續冒險, no crash, and the key is cleaned up", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.evaluate(() => localStorage.setItem("mathMerge10AdventureRun", '{"version":1,"run":{"phase":"battle"}}'));
  await page.reload();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10AdventureRun"))).toBeNull();
  await page.evaluate(() => localStorage.setItem("mathMerge10AdventureRun", "not json at all"));
  await page.reload();
  await expect(page.locator("#mode-continue")).toBeHidden();
  expect(errors).toEqual([]);
});

test("the trophies button lists the six adventure trophies, all locked at first", async ({ page }) => {
  await page.goto("./");
  await page.locator("#mode-trophies").click();
  await expect(page.locator("#adv-trophy-modal")).toBeVisible();
  await expect(page.locator("#adv-trophy-list li")).toHaveCount(6);
  await expect(page.locator('#adv-trophy-list li[data-unlocked="true"]')).toHaveCount(0);
  await expect(page.locator("#adv-trophy-list")).toContainText("擊敗三角樹王");
  await page.locator("#adv-trophy-close").click();
  await expect(page.locator("#adv-trophy-modal")).toBeHidden();
});

test("a fresh window never leaks the dev start key: the menu is the product default", async ({ page }) => {
  await page.goto("./");
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10DebugStart"))).toBeNull();
});
```
Create `workspace/tests/e2e/adventure-battle.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { STONE, type GameGrid } from "../../src/grid";
import { createBattle } from "../../src/adventure/battle";
import { STARTER_RELIC_IDS } from "../../src/adventure/relics";
import { chooseOffer, createRun, type RunState } from "../../src/adventure/run";
import { mulberry32 } from "../../src/adventure/rng";
import {
  NO_DEBUG_START,
  bestDirection,
  cellCenter,
  getRun,
  patchBattle,
  pickOffer,
  playBattleOut,
  setRun,
  startAdventure,
  waitIdle,
} from "./adventureHelpers";

test.use(NO_DEBUG_START);

/** A run in battle `battleIndex` built with the pure layer, so a test can jump straight to it. */
function runAt(battleIndex: number, battleChanges: Record<string, unknown> = {}, runChanges: Partial<RunState> = {}): RunState {
  const rng = mulberry32(99);
  const base = chooseOffer(createRun(rng, STARTER_RELIC_IDS), 0, rng).run;
  const enemyId = ["slime", "stoneGolem", "treeKing", "snowSprite", "crystalGuard", "iceQueen", "spiralMage", "shadowBlock", "zeroLord"][battleIndex];
  const battle = { ...createBattle({ enemyId, heroHp: 10, heroMaxHp: 10 }, rng).state, ...battleChanges };
  return { ...base, battleIndex, battle, heroHp: battle.heroHp, ...runChanges };
}

const gridOf = (cells: Record<string, number>): GameGrid => {
  const grid: GameGrid = Array.from({ length: 4 }, () => [null, null, null, null]);
  Object.entries(cells).forEach(([key, value]) => {
    const [r, c] = key.split(",").map(Number);
    grid[r][c] = value;
  });
  return grid;
};

test("plays a whole battle to victory, picks a reward, and meets the second enemy", async ({ page }) => {
  test.setTimeout(120_000);
  await startAdventure(page, 3);
  await pickOffer(page, 0);
  await patchBattle(page, { enemyHp: 20 });

  const turns = await playBattleOut(page);
  expect(turns).toBeGreaterThan(0);
  await expect(page.locator("#adv-offers")).toBeVisible();
  await expect(page.locator("#adv-offers-title")).toHaveText("戰鬥勝利！選擇一個獎勵");
  expect((await getRun(page)).phase).toBe("reward");
  expect(await page.locator(".adv-offer").count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.adv-offer[data-kind="heal"]')).toBeVisible();

  await page.locator('.adv-offer[data-kind="heal"]').click();
  await expect(page.locator("#adv-offers")).toBeHidden();
  await expect(page.locator("#adv-screen")).toHaveAttribute("data-battle-index", "1");
  await expect(page.locator("#adv-enemy-name")).toHaveText("方塊石像");
  const run = await getRun(page);
  expect(run.phase).toBe("battle");
  expect(run.battle!.mana).toBeLessThanOrEqual(2); // a new battle starts from the relic bonus only
});

test("the enemy's telegraphed attack lands: HP drops, the log says so, and the countdown restarts", async ({ page }) => {
  await startAdventure(page, 4);
  await pickOffer(page, 0);
  await setRun(page, runAt(0, { countdown: 1, grid: gridOf({ "0,0": 5 }) }));
  await page.keyboard.press("ArrowRight");
  await waitIdle(page);
  await expect(page.locator("#adv-hp")).toContainText("9/10");
  await expect(page.locator("#adv-log")).toContainText("敵人攻擊");
  await expect(page.locator("#adv-intent")).toContainText("· 4");
});

test("losing all HP shows the defeat screen, deletes the save, and 回首頁 offers no 繼續冒險", async ({ page }) => {
  await startAdventure(page, 5);
  await pickOffer(page, 0);
  await patchBattle(page, { heroHp: 1, countdown: 1 });
  const run = await getRun(page);
  await page.keyboard.press(`Arrow${{ left: "Left", right: "Right", up: "Up", down: "Down" }[bestDirection(run)!]}`);
  await expect(page.locator("#adv-result")).toBeVisible();
  await expect(page.locator("#adv-result-title")).toHaveText("💀 冒險失敗");
  await expect(page.locator("#adv-result-lines")).toContainText("到達第 1 場");
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10AdventureRun"))).toBeNull();

  await page.locator("#adv-result-home").click();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeHidden();
});

test("再來一次 after a defeat starts a fresh run at the relic pick", async ({ page }) => {
  await startAdventure(page, 6);
  await pickOffer(page, 0);
  await patchBattle(page, { heroHp: 1, countdown: 1 });
  await page.keyboard.press(`Arrow${{ left: "Left", right: "Right", up: "Up", down: "Down" }[bestDirection(await getRun(page))!]}`);
  await expect(page.locator("#adv-result")).toBeVisible();
  await page.locator("#adv-result-again").click();
  await expect(page.locator("#adv-result")).toBeHidden();
  await expect(page.locator("#adv-offers-title")).toHaveText("選擇一個起始遺物");
  expect((await getRun(page)).phase).toBe("relicPick");
});

test("beating the zero lord shows 通關, unlocks the first-clear trophy and its relic", async ({ page }) => {
  test.setTimeout(120_000);
  await startAdventure(page, 7);
  await pickOffer(page, 0);
  await setRun(page, runAt(8, { enemyHp: 10, grid: gridOf({ "0,0": 4, "0,1": 6 }) }));
  await expect(page.locator("#adv-enemy-name")).toHaveText("👑 零之魔王");
  await playBattleOut(page);
  await expect(page.locator("#adv-result")).toBeVisible();
  await expect(page.locator("#adv-result-title")).toHaveText("🏆 通關！");
  await expect(page.locator("#adv-toast")).toContainText("歸零者");
  const stored = await page.evaluate(() => localStorage.getItem("mathMerge10AdventureTrophies"));
  expect(JSON.parse(stored!)).toHaveProperty("adv_clear");
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10AdventureRun"))).toBeNull();

  await page.locator("#adv-result-home").click();
  await page.locator("#mode-trophies").click();
  await expect(page.locator('#adv-trophy-list li[data-trophy="adv_clear"]')).toHaveAttribute("data-unlocked", "true");
});

test("killing the tree king grants a boss reward of three relics and heals half the max HP", async ({ page }) => {
  test.setTimeout(120_000);
  await startAdventure(page, 8);
  await pickOffer(page, 0);
  await setRun(page, runAt(2, { enemyHp: 10, heroHp: 3, grid: gridOf({ "0,0": 4, "0,1": 6 }) }));
  await playBattleOut(page);
  await expect(page.locator("#adv-offers-title")).toHaveText("Boss 討伐！選擇一個遺物");
  await expect(page.locator('.adv-offer[data-kind="relic"]')).toHaveCount(3);
  const run = await getRun(page);
  expect(run.heroHp).toBe(8);
  await expect(page.locator("#adv-hp")).toContainText("8/10");
  await expect(page.locator("#adv-toast")).toContainText("森林征服者");
});

test("spells: 💣 needs mana, then targets a cell and clears the cross", async ({ page }) => {
  await startAdventure(page, 9);
  await pickOffer(page, 0);
  const grid = gridOf({ "1,1": 5, "0,1": 3, "1,0": 8, "2,1": 2, "1,2": 7, "3,3": 9 });
  await setRun(page, runAt(0, { mana: 0, grid }));
  await expect(page.locator('[data-spell="bomb"]')).toBeDisabled();

  await patchBattle(page, { mana: 4 });
  await expect(page.locator('[data-spell="bomb"]')).toBeEnabled();
  await page.locator('[data-spell="bomb"]').click();
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "true");
  await page.locator("#adv-board").click({ position: await cellCenter(page, 1, 1) });

  const run = await getRun(page);
  expect(run.battle!.mana).toBe(0);
  expect(run.battle!.grid[1][1]).toBeNull();
  expect(run.battle!.grid[0][1]).toBeNull();
  expect(run.battle!.grid[3][3]).toBe(9);
  expect(run.battle!.turn).toBe(0); // casting is not a turn
  await expect(page.locator("#adv-mana")).toContainText("0");
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "false");
});

test("spells: 🔀 casts at once; 🔨 can be cancelled by tapping it again", async ({ page }) => {
  await startAdventure(page, 10);
  await pickOffer(page, 0);
  await setRun(page, runAt(0, { mana: 5, grid: gridOf({ "0,0": 1, "0,1": 2, "3,3": 3 }) }));
  await page.locator('[data-spell="hammer"]').click();
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "true");
  await page.locator('[data-spell="hammer"]').click();
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "false");

  await page.locator('[data-spell="shuffle"]').click();
  const run = await getRun(page);
  expect(run.battle!.mana).toBe(2);
  expect(run.battle!.grid.flat().filter((c) => c !== null).sort()).toEqual([1, 2, 3]);
});

test("stones, zeros and frozen tiles draw without errors and show the freeze counter state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startAdventure(page, 11);
  await pickOffer(page, 0);
  await setRun(
    page,
    runAt(3, {
      grid: gridOf({ "0,0": STONE, "0,1": 0, "1,1": 5, "2,2": 7 }),
      freezes: [{ row: 1, col: 1, turns: 3 }],
    }),
  );
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
  const run = await getRun(page);
  expect(run.battle!.freezes).toEqual([{ row: 1, col: 1, turns: 3 }]);
  await page.keyboard.press("ArrowLeft"); // a slide next to a frozen wall (simple slide animation path)
  await waitIdle(page);
  expect(errors).toEqual([]);
});

test("?seed= makes a run reproducible: same seed, same offers and the same first board", async ({ browser, baseURL }) => {
  const snapshot = async (seed: number) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto(`./?seed=${seed}`);
    await page.locator("#mode-adventure").click();
    const offers = (await getRun(page)).offers;
    await pickOffer(page, 0);
    const grid = (await getRun(page)).battle!.grid;
    await context.close();
    return { offers, grid };
  };
  const a = await snapshot(21);
  const b = await snapshot(21);
  const c = await snapshot(22);
  expect(a).toEqual(b);
  expect(c).not.toEqual(a);
});
```
Create `workspace/tests/e2e/adventure-layout.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { NO_DEBUG_START, pickOffer, startAdventure } from "./adventureHelpers";

test.use(NO_DEBUG_START);

const PHONES = [
  { name: "iPhone 390x844", width: 390, height: 844 },
  { name: "iPhone Pro Max 430x932", width: 430, height: 932 },
];

for (const phone of PHONES) {
  test.describe(phone.name, () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    test("the start menu fits without scrolling", async ({ page }) => {
      await page.goto("./");
      for (const id of ["#mode-adventure", "#mode-endless", "#mode-trophies"]) {
        const box = (await page.locator(id).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(phone.width);
        expect(box.y + box.height).toBeLessThanOrEqual(phone.height);
      }
    });

    test("every part of the battle screen fits the viewport, with no page scrolling", async ({ page }) => {
      await startAdventure(page, 1);
      await pickOffer(page, 0);
      for (const id of ["#adv-top", "#adv-enemy-card", "#adv-board", "#adv-hero", "#adv-spells", "#adv-relics", "#adv-log"]) {
        const box = (await page.locator(id).boundingBox())!;
        expect(box.x, `${id} left`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(phone.width);
        expect(box.y, `${id} top`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(phone.height);
      }
      const board = (await page.locator("#adv-board").boundingBox())!;
      expect(board.width).toBeCloseTo(board.height, 0);
      expect(board.width).toBeGreaterThanOrEqual(340); // big enough to play on a phone
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
      }));
      expect(overflow.x).toBeLessThanOrEqual(0);
      expect(overflow.y).toBeLessThanOrEqual(0);
    });

    test("the four spell buttons are at least 44px tall and the reward modal fits", async ({ page }) => {
      await startAdventure(page, 1);
      const card = (await page.locator("#adv-offers .adv-modal-card").boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(phone.width);
      expect(card.y + card.height).toBeLessThanOrEqual(phone.height);
      await pickOffer(page, 0);
      for (const spell of ["hammer", "addOne", "bomb", "shuffle"]) {
        const box = (await page.locator(`[data-spell="${spell}"]`).boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
```

- [ ] **Step 4.2: Run the first spec and see it fail**

```bash
npx playwright test tests/e2e/adventure-menu.spec.ts --max-failures=1 --reporter=line
```

Expected: `1 failed`, `8 did not run`: the first test fails on `locator('#mode-menu')` (`element(s) not found`: the page still opens straight into endless), and `--max-failures=1` stops there. (Do not run the whole new set red: each of the 25 failing specs waits out a 30 s timeout.) The 54 existing specs are unaffected; they run again in Task 5.

- [ ] **Step 4.3: Commit**

```bash
git add workspace/tests/e2e/adventureHelpers.ts workspace/tests/e2e/adventure-menu.spec.ts workspace/tests/e2e/adventure-battle.spec.ts workspace/tests/e2e/adventure-layout.spec.ts
git commit -m "$(cat <<'EOT'
test(merge10): e2e specs for the adventure menu, battles and phone layout (red)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 5: The adventure screen, the start menu and the wiring

**Files:**
- Modify: `workspace/index.html` (two edits: CSS, DOM)
- Create: `workspace/src/adventure/view.ts`
- Create: `workspace/src/adventure/menu.ts`
- Modify: `workspace/src/main.ts`
- Modify: `workspace/playwright.config.ts`

**Interfaces:**

Consumes: everything from plans #3a and Tasks 1-3 plus the DOM ids listed in Task 4.

Produces:
```ts
// view.ts
export interface AdventureViewDeps { store: KeyValueStore; rng: Rng; audio: AudioEngine; goHome: () => void; devHooks: boolean }
export interface AdventureView { startNew(): void; resume(run: RunState): void; hide(): void; openTrophies(): void }
export function createAdventureView(deps: AdventureViewDeps): AdventureView;
// menu.ts
export interface MenuDeps { store: KeyValueStore; adventure: AdventureView; devStart: "endless" | null }
export interface Menu { showMenu(): void; start(): void }
export function initMenu(deps: MenuDeps): Menu;
```
How `view.ts` plays a step (`commit`): `run = step.run` -> `saveRun` -> `checkAdventureTrophies` for each `trophyEvent` (toast per unlock) -> floating numbers / log / sound from `step.events` -> if the events contain a `slid`: with pairs and no freeze at the start of the turn, hide the turn's spawned cells and `board.beginElimination(...)` (spawn is revealed by `onEliminationDone`), otherwise `board.beginSlide(...)` -> redraw HUD -> animation loop; when the loop goes idle `syncPhase()` opens the reward modal (relicPick / reward phases) or the result modal (victory / defeat). Input (`keydown`, swipe on `#adv-board`, spell buttons, board click) is ignored while `board.isEliminating` or a loop frame is pending.

- [ ] **Step 5.1: Add the CSS to `index.html`**

In `workspace/index.html`:

Edit `workspace/index.html`. Find (must occur exactly once):
```html
  </style>
</head>
```
Replace with:
```html
    /* ── Adventure mode: start menu, battle screen, modals ───────────────── */
    #endless-home[hidden], #mode-menu[hidden], .mm-btn[hidden], #adv-screen[hidden], .adv-modal[hidden] { display: none !important; }
    body[data-screen="menu"] #game-wrapper,
    body[data-screen="adventure"] #game-wrapper { display: none; }
    body[data-screen="adventure"] { align-items: flex-start; }
    #endless-home {
      position: fixed; top: 6px; left: 6px; z-index: 40;
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.3);
      color: #fff; font-size: 16px; cursor: pointer; opacity: 0.85;
    }
    #mode-menu {
      position: fixed; inset: 0; z-index: 90; background: #111;
      display: flex; align-items: center; justify-content: center;
      font-family: sans-serif; color: #e5e7eb;
    }
    #mode-menu-card { width: min(340px, 88vw); display: flex; flex-direction: column; gap: 12px; text-align: center; }
    #mode-menu-card h1 { margin: 0; font-size: 30px; color: #fde047; letter-spacing: 0.02em; }
    #mode-menu-sub { margin: 0 0 12px; font-size: 14px; color: #9ca3af; }
    .mm-btn {
      display: flex; flex-direction: column; gap: 2px; align-items: center;
      padding: 14px 16px; border-radius: 12px; border: 1px solid #374151;
      background: #1f2937; color: #f9fafb; font-size: 18px; font-weight: bold; cursor: pointer;
    }
    .mm-btn small { font-size: 12px; font-weight: normal; color: #9ca3af; }
    .mm-btn.mm-primary { background: #7c3aed; border-color: #a78bfa; }
    .mm-btn.mm-primary small { color: #ddd6fe; }
    .mm-link { background: none; border: none; color: #9ca3af; font-size: 14px; padding: 8px; cursor: pointer; }
    #adv-screen {
      width: 100%; max-width: 460px; box-sizing: border-box; padding: 6px 12px;
      display: flex; flex-direction: column; gap: 6px; font-family: sans-serif; color: #e5e7eb;
      position: relative;
    }
    #adv-top { display: flex; align-items: center; gap: 8px; }
    .adv-icon-btn {
      width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.3);
      color: #fff; font-size: 18px; cursor: pointer;
    }
    #adv-stage-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    #adv-stage { font-size: 13px; color: #d1d5db; }
    #adv-progress { display: flex; gap: 3px; align-items: center; }
    .adv-pip { flex: 1; height: 8px; border-radius: 4px; background: #374151; }
    .adv-pip[data-boss="true"] { flex: 1.6; height: 11px; }
    .adv-pip[data-state="done"] { background: #4ade80; }
    .adv-pip[data-state="current"] { background: #f59e0b; }
    #adv-enemy-card {
      position: relative; display: flex; gap: 10px; align-items: center;
      background: #1f2937; border-radius: 12px; padding: 8px;
    }
    #adv-enemy { width: 96px; height: 96px; flex-shrink: 0; }
    #adv-enemy-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    #adv-enemy-name { font-weight: bold; font-size: 15px; }
    .adv-bar { height: 12px; border-radius: 6px; background: #374151; overflow: hidden; }
    #adv-enemy-hpfill { height: 100%; width: 100%; background: #ef4444; transition: width 250ms; }
    #adv-enemy-row { display: flex; justify-content: space-between; font-size: 12px; color: #d1d5db; }
    #adv-enemy-shield { color: #93c5fd; }
    #adv-intent {
      align-self: flex-start; background: #111827; border: 1px solid #4b5563;
      border-radius: 999px; padding: 3px 10px; font-size: 13px; font-weight: bold;
    }
    .adv-pop {
      position: absolute; pointer-events: none; opacity: 0; font-weight: bold; font-size: 22px; z-index: 10;
    }
    .adv-pop.animate { animation: adv-pop-float 900ms ease-out forwards; }
    @keyframes adv-pop-float {
      0% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-28px); }
    }
    #adv-enemy-pop { right: 14px; top: 8px; color: #fde047; }
    #adv-hero-pop { right: 8px; top: -6px; color: #fca5a5; }
    #adv-board-wrap { position: relative; display: flex; justify-content: center; }
    #adv-board { touch-action: none; }
    #adv-board[data-targeting="true"] { outline: 3px solid #f59e0b; }
    #adv-board-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; background: rgba(239,68,68,0.5); }
    #adv-board-flash.animate { animation: adv-flash 500ms ease-out; }
    @keyframes adv-flash { 0% { opacity: 0.7; } 100% { opacity: 0; } }
    #adv-hero { position: relative; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold; padding: 0 4px; }
    #adv-mana { color: #93c5fd; }
    #adv-spells { display: flex; gap: 6px; }
    .adv-spell {
      position: relative; flex: 1; min-height: 52px; border-radius: 8px;
      background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.25);
      color: #fff; font-size: 12px; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    }
    .adv-spell-ico { font-size: 20px; }
    .adv-spell-cost { position: absolute; top: 2px; right: 5px; font-size: 11px; font-weight: bold; color: #93c5fd; }
    .adv-spell[data-active="true"] { border-color: #f59e0b; background: rgba(245,158,11,0.25); }
    .adv-spell:disabled { opacity: 0.4; cursor: default; }
    #adv-relics { display: flex; gap: 4px; flex-wrap: wrap; min-height: 32px; align-items: center; }
    .adv-relic { width: 32px; height: 32px; border-radius: 8px; background: #1f2937; border: 1px solid #374151; font-size: 16px; cursor: pointer; padding: 0; }
    #adv-relic-info { font-size: 12px; color: #d1d5db; min-height: 16px; }
    #adv-log { font-size: 12px; color: #9ca3af; min-height: 32px; line-height: 1.35; }
    #adv-toast {
      position: fixed; top: 54px; left: 50%; transform: translateX(-50%); z-index: 60;
      background: #fde047; color: #422006; font-weight: bold; font-size: 13px;
      border-radius: 8px; padding: 8px 14px; pointer-events: none; opacity: 0; white-space: nowrap;
    }
    #adv-toast.animate { animation: trophy-toast-appear 2400ms ease-out forwards; }
    .adv-modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; }
    .adv-modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); }
    .adv-modal-card {
      position: relative; z-index: 1; width: min(340px, 90vw); max-height: 85vh; overflow-y: auto; box-sizing: border-box;
      background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 18px 20px;
      color: #e5e7eb; font-family: sans-serif;
    }
    .adv-modal-card h2, .adv-modal-card h3 { margin: 0 0 12px; color: #f9fafb; }
    .adv-close { position: absolute; top: 8px; right: 12px; background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; }
    #adv-offers-list { display: flex; flex-direction: column; gap: 8px; }
    .adv-offer {
      display: flex; gap: 12px; align-items: center; text-align: left; width: 100%;
      background: #111827; border: 1px solid #4b5563; border-radius: 10px; padding: 10px 12px;
      color: #f9fafb; cursor: pointer; font-size: 14px;
    }
    .adv-offer:hover { border-color: #a78bfa; }
    .adv-offer-icon { font-size: 26px; }
    .adv-offer-body { display: flex; flex-direction: column; gap: 2px; }
    .adv-offer-body small { color: #9ca3af; font-size: 12px; }
    #adv-result-lines { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 14px; color: #cbd5e1; }
    .adv-result-buttons { display: flex; flex-direction: column; gap: 8px; }
    #adv-trophy-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  </style>
</head>
```

- [ ] **Step 5.2: Add the DOM to `index.html`**

Edit `workspace/index.html`. Find (must occur exactly once):
```html
  <script type="module" src="/src/main.ts"></script>
```
Replace with:
```html
  <button id="endless-home" aria-label="回首頁" hidden>🏠</button>
  <div id="mode-menu" hidden>
    <div id="mode-menu-card">
      <h1>Math Merge 10</h1>
      <p id="mode-menu-sub">湊 10，施展魔法</p>
      <button id="mode-adventure" class="mm-btn mm-primary">⚔ 冒險<small>回合制戰鬥 · 魔法師對決怪物</small></button>
      <button id="mode-continue" class="mm-btn" hidden>▶ 繼續冒險<small id="mode-continue-info"></small></button>
      <button id="mode-endless" class="mm-btn">🎯 修練<small>無盡模式 · 挑戰最高分</small></button>
      <button id="mode-trophies" class="mm-link">🏆 冒險獎盃</button>
    </div>
  </div>
  <div id="adv-screen" hidden>
    <div id="adv-top">
      <button id="adv-home" class="adv-icon-btn" aria-label="回首頁">🏠</button>
      <div id="adv-stage-wrap">
        <div id="adv-stage"></div>
        <div id="adv-progress"></div>
      </div>
      <button id="adv-mute" class="adv-icon-btn" aria-label="靜音">🔊</button>
    </div>
    <div id="adv-enemy-card">
      <canvas id="adv-enemy" width="192" height="192"></canvas>
      <div id="adv-enemy-info">
        <div id="adv-enemy-name"></div>
        <div class="adv-bar"><div id="adv-enemy-hpfill"></div></div>
        <div id="adv-enemy-row"><span id="adv-enemy-hptext"></span><span id="adv-enemy-shield"></span></div>
        <div id="adv-intent"></div>
      </div>
      <div id="adv-enemy-pop" class="adv-pop"></div>
    </div>
    <div id="adv-board-wrap">
      <canvas id="adv-board" width="360" height="360"></canvas>
      <div id="adv-board-flash"></div>
    </div>
    <div id="adv-hero">
      <span id="adv-hp"></span>
      <span id="adv-mana"></span>
      <div id="adv-hero-pop" class="adv-pop"></div>
    </div>
    <div id="adv-spells">
      <button class="adv-spell" data-spell="hammer"><span class="adv-spell-ico">🔨</span><span>碎石</span><span class="adv-spell-cost"></span></button>
      <button class="adv-spell" data-spell="addOne"><span class="adv-spell-ico">➕</span><span>增幅</span><span class="adv-spell-cost"></span></button>
      <button class="adv-spell" data-spell="bomb"><span class="adv-spell-ico">💣</span><span>爆裂</span><span class="adv-spell-cost"></span></button>
      <button class="adv-spell" data-spell="shuffle"><span class="adv-spell-ico">🔀</span><span>洗牌</span><span class="adv-spell-cost"></span></button>
    </div>
    <div id="adv-relics"></div>
    <div id="adv-relic-info"></div>
    <div id="adv-log" aria-live="polite"></div>
  </div>
  <div id="adv-toast"></div>
  <div id="adv-offers" class="adv-modal" hidden>
    <div class="adv-modal-overlay"></div>
    <div class="adv-modal-card">
      <h3 id="adv-offers-title"></h3>
      <div id="adv-offers-list"></div>
    </div>
  </div>
  <div id="adv-result" class="adv-modal" hidden>
    <div class="adv-modal-overlay"></div>
    <div class="adv-modal-card" style="text-align:center">
      <h2 id="adv-result-title"></h2>
      <div id="adv-result-lines"></div>
      <div class="adv-result-buttons">
        <button id="adv-result-again" class="mm-btn mm-primary">再來一次</button>
        <button id="adv-result-home" class="mm-btn">回首頁</button>
      </div>
    </div>
  </div>
  <div id="adv-trophy-modal" class="adv-modal" hidden>
    <div id="adv-trophy-overlay" class="adv-modal-overlay"></div>
    <div class="adv-modal-card">
      <button id="adv-trophy-close" class="adv-close" aria-label="關閉">✕</button>
      <h3>冒險獎盃</h3>
      <ul id="adv-trophy-list"></ul>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
```

- [ ] **Step 5.3: Create `view.ts` and `menu.ts`**

Create `workspace/src/adventure/view.ts`:
```ts
/**
 * The adventure screen (spec 9.3 `view.ts`): wires the pure run/battle layer
 * to the DOM and to the shared `BoardRenderer`. All rules live in run.ts and
 * battle.ts; this file only turns clicks/swipes into `runTurn` / `runCast` /
 * `chooseOffer` calls and plays the returned events back (animation, popups,
 * sound, log lines). Element ids come from index.html.
 *
 * Animation: the rules resolve a whole turn at once. For a slide with
 * eliminations and nothing frozen the endless-mode two-phase animation plays
 * and the spawned tile is held back until it ends; otherwise (no pairs, or
 * frozen walls the animation does not model) the simple slide animation plays.
 */
import type { AudioEngine } from "../audio";
import { BoardRenderer, canAnimateElimination } from "../boardRenderer";
import type { Direction, GameGrid, Rng } from "../grid";
import { changedCells, type CellPosition } from "../gridDiff";
import { PALETTE_ORDER, isPaletteId, type PaletteId } from "../palettes";
import { SPELL_IDS, SPELLS, currentIntent, spellCost, type BattleEvent, type BattleState, type SpellId } from "./battle";
import { getEnemy } from "./enemies";
import { drawEnemyArt } from "./enemyArt";
import { getRelic, mergeRelicHooks } from "./relics";
import { chooseOffer, createRun, runCast, runTurn, type RunState, type RunStep } from "./run";
import { saveRun } from "./save";
import type { KeyValueStore } from "./storage";
import {
  ADVENTURE_TROPHIES,
  checkAdventureTrophies,
  getAdventureTrophy,
  loadAdventureTrophies,
  unlockedRelicIds,
  type AdventureTrophyEvent,
} from "./unlocks";
import {
  KEY_TO_DIRECTION,
  SPELL_HELP,
  boardPixelSize,
  damageTotal,
  heroDamageTotal,
  intentView,
  logLines,
  offerTitle,
  offerView,
  progressPips,
  resultView,
  stageLabel,
  stuckHint,
  swipeDirection,
} from "./viewModel";

const GRID_SIZE = 4;
const PALETTE_KEY = "mathMerge10Palette";

export interface AdventureViewDeps {
  store: KeyValueStore;
  rng: Rng;
  audio: AudioEngine;
  /** Called by the 🏠 button and the result screen. */
  goHome: () => void;
  /** Dev builds only: expose `window.__adv` for the e2e tests. */
  devHooks: boolean;
}

export interface AdventureView {
  /** Begin a fresh run (shows the opening relic pick). */
  startNew(): void;
  /** Continue a run loaded from the save. */
  resume(run: RunState): void;
  /** Hide the screen and stop reacting to input. */
  hide(): void;
  /** Open the adventure-trophy list. */
  openTrophies(): void;
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function emptyGrid(): GameGrid {
  return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));
}

export function createAdventureView(deps: AdventureViewDeps): AdventureView {
  const { store, rng, audio } = deps;

  const screenEl = el<HTMLDivElement>("adv-screen");
  const boardCanvas = el<HTMLCanvasElement>("adv-board");
  const enemyCanvas = el<HTMLCanvasElement>("adv-enemy");
  const stageEl = el<HTMLDivElement>("adv-stage");
  const progressEl = el<HTMLDivElement>("adv-progress");
  const enemyNameEl = el<HTMLDivElement>("adv-enemy-name");
  const hpFillEl = el<HTMLDivElement>("adv-enemy-hpfill");
  const hpTextEl = el<HTMLSpanElement>("adv-enemy-hptext");
  const shieldEl = el<HTMLSpanElement>("adv-enemy-shield");
  const intentEl = el<HTMLDivElement>("adv-intent");
  const enemyPopEl = el<HTMLDivElement>("adv-enemy-pop");
  const heroPopEl = el<HTMLDivElement>("adv-hero-pop");
  const hpEl = el<HTMLSpanElement>("adv-hp");
  const manaEl = el<HTMLSpanElement>("adv-mana");
  const flashEl = el<HTMLDivElement>("adv-board-flash");
  const spellsEl = el<HTMLDivElement>("adv-spells");
  const relicsEl = el<HTMLDivElement>("adv-relics");
  const relicInfoEl = el<HTMLDivElement>("adv-relic-info");
  const logEl = el<HTMLDivElement>("adv-log");
  const toastEl = el<HTMLDivElement>("adv-toast");
  const offersEl = el<HTMLDivElement>("adv-offers");
  const offersTitleEl = el<HTMLHeadingElement>("adv-offers-title");
  const offersListEl = el<HTMLDivElement>("adv-offers-list");
  const resultEl = el<HTMLDivElement>("adv-result");
  const resultTitleEl = el<HTMLHeadingElement>("adv-result-title");
  const resultLinesEl = el<HTMLDivElement>("adv-result-lines");
  const trophyModalEl = el<HTMLDivElement>("adv-trophy-modal");
  const trophyListEl = el<HTMLUListElement>("adv-trophy-list");
  const muteEl = el<HTMLButtonElement>("adv-mute");

  let run: RunState | null = null;
  let active = false;
  let activeSpell: SpellId | null = null;
  let hiddenCells = new Set<string>();
  let pendingSpawn: CellPosition[] = [];
  let frameId: number | null = null;
  let touchStart: { x: number; y: number } | null = null;

  function palette(): PaletteId {
    const stored = store.getItem(PALETTE_KEY);
    return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
  }

  const board = new BoardRenderer({ canvas: boardCanvas, gridSize: GRID_SIZE, getPalette: palette });
  const enemyCtx = enemyCanvas.getContext("2d") as CanvasRenderingContext2D;

  const hooks = () => mergeRelicHooks(run?.relics ?? []);

  // ── drawing ───────────────────────────────────────────────────────────────

  function displayGrid(): GameGrid {
    const battle = run?.battle;
    if (!battle) return emptyGrid();
    if (hiddenCells.size === 0) return battle.grid;
    return battle.grid.map((row, r) => row.map((cell, c) => (hiddenCells.has(`${r},${c}`) ? null : cell)));
  }

  function drawEnemy(now: number): void {
    enemyCtx.clearRect(0, 0, enemyCanvas.width, enemyCanvas.height);
    const enemy = getEnemy(run?.battle?.enemyId ?? "");
    if (!enemy) return;
    const dead = run?.battle?.status === "victory";
    enemyCtx.globalAlpha = dead ? 0.25 : 1;
    drawEnemyArt(enemyCtx, enemy.shape, enemy.color, enemyCanvas.width, dead ? 0 : now);
    enemyCtx.globalAlpha = 1;
  }

  function drawFrame(now: number = performance.now()): void {
    board.setFrozenCells(run?.battle?.freezes ?? []);
    board.draw(displayGrid(), now);
    drawEnemy(now);
  }

  function resizeBoard(): void {
    const size = boardPixelSize(window.innerWidth, window.innerHeight);
    boardCanvas.width = size;
    boardCanvas.height = size;
    boardCanvas.style.width = `${size}px`;
    boardCanvas.style.height = `${size}px`;
    drawFrame();
  }

  // ── HUD (rebuilt only when the run changes) ────────────────────────────────

  function updateHud(): void {
    if (!run) return;
    const battle = run.battle;
    screenEl.dataset.phase = run.phase;
    screenEl.dataset.battleIndex = String(run.battleIndex);

    stageEl.textContent = `${stageLabel(run.battleIndex)}${run.phase === "relicPick" ? " · 準備出發" : ""}`;
    progressEl.innerHTML = "";
    progressPips(run).forEach((pip) => {
      const div = document.createElement("div");
      div.className = "adv-pip";
      div.dataset.state = pip.state;
      div.dataset.boss = String(pip.boss);
      progressEl.appendChild(div);
    });

    hpEl.textContent = `❤ ${run.heroHp}/${run.heroMaxHp}`;
    manaEl.textContent = `🔷 ${battle?.mana ?? 0}`;

    if (battle) {
      const enemy = getEnemy(battle.enemyId)!;
      enemyNameEl.textContent = `${enemy.boss ? "👑 " : ""}${enemy.name}`;
      hpFillEl.style.width = `${Math.max(0, (battle.enemyHp / battle.enemyMaxHp) * 100)}%`;
      hpTextEl.textContent = `${battle.enemyHp}/${battle.enemyMaxHp}`;
      shieldEl.textContent = battle.enemyShield > 0 ? `🛡 ${battle.enemyShield}` : "";
      if (battle.status === "ongoing") {
        const view = intentView(currentIntent(battle));
        intentEl.textContent = `${view.icon} ${view.text} · ${battle.countdown}`;
        intentEl.dataset.kind = currentIntent(battle).kind;
      } else {
        intentEl.textContent = battle.status === "victory" ? "已擊敗" : "—";
        intentEl.dataset.kind = "";
      }
    } else {
      enemyNameEl.textContent = "";
      hpTextEl.textContent = "";
      shieldEl.textContent = "";
      intentEl.textContent = "";
    }

    updateSpellBar(battle);
    relicsEl.innerHTML = "";
    run.relics.forEach((id) => {
      const relic = getRelic(id);
      if (!relic) return;
      const button = document.createElement("button");
      button.className = "adv-relic";
      button.dataset.relic = id;
      button.title = `${relic.name}：${relic.description}`;
      button.textContent = relic.icon;
      button.addEventListener("click", () => {
        relicInfoEl.textContent = `${relic.icon} ${relic.name}：${relic.description}`;
      });
      relicsEl.appendChild(button);
    });
    muteEl.textContent = audio.isMuted ? "🔇" : "🔊";
  }

  function updateSpellBar(battle: BattleState | null): void {
    const inBattle = run?.phase === "battle" && battle !== null;
    spellsEl.querySelectorAll<HTMLButtonElement>(".adv-spell").forEach((button) => {
      const spell = button.dataset.spell as SpellId;
      const cost = battle ? spellCost(battle, spell, hooks()) : SPELLS[spell].cost;
      const costEl = button.querySelector(".adv-spell-cost");
      if (costEl) costEl.textContent = String(cost);
      button.disabled = !inBattle || battle.mana < cost;
      button.dataset.active = String(activeSpell === spell);
    });
    boardCanvas.dataset.targeting = String(activeSpell !== null);
  }

  function setLog(lines: string[]): void {
    const hint = run?.battle ? stuckHint(run.battle, hooks()) : null;
    logEl.textContent = [...lines.slice(-3), ...(hint ? [hint] : [])].join("　");
  }

  // ── feedback: popups, sound, toasts ────────────────────────────────────────

  function pop(target: HTMLElement, text: string): void {
    target.textContent = text;
    target.classList.remove("animate");
    void target.offsetWidth;
    target.classList.add("animate");
  }

  function flashBoard(): void {
    flashEl.classList.remove("animate");
    void flashEl.offsetWidth;
    flashEl.classList.add("animate");
  }

  function playSounds(events: BattleEvent[]): void {
    const slid = events.find((e) => e.type === "slid");
    if (slid && slid.type === "slid") audio.play(slid.eliminatedPairs.length > 0 ? "eliminate" : "move");
    const chain = events.find((e) => e.type === "pairCleared" && e.chain);
    if (chain && chain.type === "pairCleared") audio.play("combo", { comboCount: chain.count });
    const cast = events.find((e) => e.type === "spellCast");
    if (cast && cast.type === "spellCast") audio.play(cast.spell);
    if (events.some((e) => e.type === "overload")) audio.play("bomb");
    if (events.some((e) => e.type === "tileSpawned")) audio.play("spawn");
    if (events.some((e) => e.type === "battleEnded" && e.result === "defeat")) {
      setTimeout(() => audio.play("gameOver"), 400);
    }
  }

  function feedback(events: BattleEvent[]): void {
    const dealt = damageTotal(events);
    if (dealt > 0) pop(enemyPopEl, `-${dealt}`);
    const hurt = heroDamageTotal(events);
    if (hurt > 0) {
      pop(heroPopEl, `-${hurt}`);
      flashBoard();
    }
    playSounds(events);
    setLog(logLines(events));
  }

  const toastQueue: string[] = [];
  let toastBusy = false;

  function drainToasts(): void {
    const text = toastQueue.shift();
    if (text === undefined) {
      toastBusy = false;
      return;
    }
    toastBusy = true;
    toastEl.textContent = text;
    toastEl.classList.remove("animate");
    void toastEl.offsetWidth;
    toastEl.classList.add("animate");
    setTimeout(drainToasts, 2500);
  }

  function processTrophies(events: AdventureTrophyEvent[]): void {
    events.forEach((event) => {
      checkAdventureTrophies(event, store).forEach((id) => {
        const trophy = getAdventureTrophy(id);
        const relic = trophy ? getRelic(trophy.relicId) : undefined;
        if (!trophy) return;
        toastQueue.push(`🏆 ${trophy.icon} ${trophy.name}！解鎖遺物「${relic?.name ?? ""}」（下一局起）`);
      });
    });
    if (!toastBusy && toastQueue.length > 0) drainToasts();
  }

  // ── the animation loop ─────────────────────────────────────────────────────

  function onEliminationDone(): void {
    hiddenCells = new Set();
    board.beginSpawn(pendingSpawn);
    pendingSpawn = [];
  }

  function tick(): void {
    frameId = null;
    const now = performance.now();
    const animating = board.advance(now, onEliminationDone);
    drawFrame(now);
    if (animating) frameId = requestAnimationFrame(tick);
    else syncPhase();
  }

  function startLoop(): void {
    if (frameId === null) frameId = requestAnimationFrame(tick);
  }

  function isBusy(): boolean {
    return board.isEliminating || frameId !== null;
  }

  function animateSlide(events: BattleEvent[], frozenBefore: number): void {
    const slid = events.find((e) => e.type === "slid");
    board.reset();
    hiddenCells = new Set();
    pendingSpawn = [];
    if (!slid || slid.type !== "slid" || !run?.battle) return;
    const spawned = events.flatMap((e) => (e.type === "tileSpawned" ? [e.cell] : []));
    if (slid.eliminatedPairs.length > 0 && canAnimateElimination(frozenBefore)) {
      spawned.forEach(({ row, col }) => hiddenCells.add(`${row},${col}`));
      pendingSpawn = spawned;
      board.beginElimination(slid.eliminatedPairs, slid.prevGrid, slid.direction);
    } else {
      const spawnedKeys = new Set(spawned.map(({ row, col }) => `${row},${col}`));
      const grid = run.battle.grid;
      const moved = changedCells(slid.prevGrid, grid).filter(
        ({ row, col }) => grid[row][col] !== null && !spawnedKeys.has(`${row},${col}`),
      );
      board.beginSlide(spawned, moved, slid.direction);
    }
  }

  // ── one step of the run ────────────────────────────────────────────────────

  function commit(step: RunStep, frozenBefore = 0): void {
    run = step.run;
    saveRun(store, run);
    processTrophies(step.trophyEvents);
    feedback(step.events);
    animateSlide(step.events, frozenBefore);
    updateHud();
    drawFrame();
    startLoop();
  }

  function onDirection(direction: Direction): void {
    if (!active || !run || run.phase !== "battle" || isBusy()) return;
    const frozenBefore = run.battle?.freezes.length ?? 0;
    const step = runTurn(run, direction, rng);
    if (!step.applied) return;
    activeSpell = null;
    commit(step, frozenBefore);
  }

  function castSelected(spell: SpellId, target: CellPosition | null): void {
    if (!run) return;
    const step = runCast(run, spell, target, rng);
    activeSpell = null;
    if (!step.applied) {
      setLog([step.reason === "notEnoughMana" ? "魔力不足" : "這裡不能施放"]);
      updateSpellBar(run.battle);
      return;
    }
    commit(step, run.battle?.freezes.length ?? 0);
  }

  function onSpellClick(spell: SpellId): void {
    if (!active || !run || run.phase !== "battle" || isBusy() || !run.battle) return;
    if (run.battle.mana < spellCost(run.battle, spell, hooks())) return;
    if (spell === "shuffle") {
      castSelected(spell, null);
      return;
    }
    activeSpell = activeSpell === spell ? null : spell;
    setLog(activeSpell ? [`${SPELLS[spell].name}：${SPELL_HELP[spell]}`] : []);
    updateSpellBar(run.battle);
  }

  function onBoardClick(event: MouseEvent): void {
    if (!active || activeSpell === null || isBusy()) return;
    const rect = boardCanvas.getBoundingClientRect();
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * GRID_SIZE);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * GRID_SIZE);
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
    castSelected(activeSpell, { row, col });
  }

  // ── modals: reward pick and result ─────────────────────────────────────────

  function renderOffers(): void {
    if (!run) return;
    offersTitleEl.textContent = offerTitle(run);
    offersListEl.innerHTML = "";
    run.offers.forEach((option, index) => {
      const view = offerView(option);
      const button = document.createElement("button");
      button.className = "adv-offer";
      button.dataset.index = String(index);
      button.dataset.kind = option.kind;
      button.innerHTML = `<span class="adv-offer-icon">${view.icon}</span><span class="adv-offer-body"><strong>${view.title}</strong><small>${view.desc}</small></span>`;
      button.addEventListener("click", () => {
        if (!run) return;
        const step = chooseOffer(run, index, rng);
        if (!step.applied) return;
        offersEl.hidden = true;
        commit(step);
        syncPhase();
      });
      offersListEl.appendChild(button);
    });
  }

  function renderResult(): void {
    if (!run) return;
    const view = resultView(run);
    resultTitleEl.textContent = view.title;
    resultLinesEl.innerHTML = "";
    view.lines.forEach((line) => {
      const div = document.createElement("div");
      div.textContent = line;
      resultLinesEl.appendChild(div);
    });
  }

  /** Show the modal that matches the run's phase (called when no animation is running). */
  function syncPhase(): void {
    if (!active || !run) return;
    const picking = run.phase === "relicPick" || run.phase === "reward";
    const finished = run.phase === "victory" || run.phase === "defeat";
    if (picking && offersEl.hidden) renderOffers();
    offersEl.hidden = !picking;
    if (finished && resultEl.hidden) renderResult();
    resultEl.hidden = !finished;
  }

  function showScreen(): void {
    active = true;
    screenEl.hidden = false;
    offersEl.hidden = true;
    resultEl.hidden = true;
    activeSpell = null;
    board.reset();
    hiddenCells = new Set();
    pendingSpawn = [];
    relicInfoEl.textContent = "";
    resizeBoard();
    updateHud();
    setLog([]);
    drawFrame();
    syncPhase();
  }

  // ── trophies list ──────────────────────────────────────────────────────────

  function openTrophies(): void {
    const unlocked = loadAdventureTrophies(store);
    trophyListEl.innerHTML = "";
    ADVENTURE_TROPHIES.forEach((trophy) => {
      const got = trophy.id in unlocked;
      const relic = getRelic(trophy.relicId);
      const li = document.createElement("li");
      li.className = `tm-single${got ? "" : " locked"}`;
      li.dataset.trophy = trophy.id;
      li.dataset.unlocked = String(got);
      li.innerHTML = `<span class="tm-single-ico">${trophy.icon}</span><div class="tm-single-body"><strong>${trophy.name}</strong><small>${trophy.description}</small><small>解鎖遺物：${relic?.icon ?? ""} ${relic?.name ?? ""}</small></div>`;
      trophyListEl.appendChild(li);
    });
    trophyModalEl.hidden = false;
  }

  // ── events ─────────────────────────────────────────────────────────────────

  window.addEventListener("keydown", (event) => {
    const direction = KEY_TO_DIRECTION[event.key];
    if (!direction || !active) return;
    event.preventDefault();
    onDirection(direction);
  });

  boardCanvas.addEventListener(
    "touchstart",
    (event) => {
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    },
    { passive: true },
  );
  boardCanvas.addEventListener(
    "touchend",
    (event) => {
      if (!touchStart) return;
      const direction = swipeDirection(
        event.changedTouches[0].clientX - touchStart.x,
        event.changedTouches[0].clientY - touchStart.y,
      );
      touchStart = null;
      if (direction && activeSpell === null) onDirection(direction);
    },
    { passive: true },
  );
  boardCanvas.addEventListener("click", onBoardClick);
  spellsEl.querySelectorAll<HTMLButtonElement>(".adv-spell").forEach((button) => {
    button.addEventListener("click", () => onSpellClick(button.dataset.spell as SpellId));
  });
  el<HTMLButtonElement>("adv-home").addEventListener("click", () => deps.goHome());
  muteEl.addEventListener("click", () => {
    audio.toggleMute();
    muteEl.textContent = audio.isMuted ? "🔇" : "🔊";
  });
  el<HTMLButtonElement>("adv-result-home").addEventListener("click", () => deps.goHome());
  el<HTMLButtonElement>("adv-result-again").addEventListener("click", () => startNew());
  el<HTMLButtonElement>("adv-trophy-close").addEventListener("click", () => {
    trophyModalEl.hidden = true;
  });
  el<HTMLDivElement>("adv-trophy-overlay").addEventListener("click", () => {
    trophyModalEl.hidden = true;
  });
  window.addEventListener("resize", () => {
    if (active) resizeBoard();
  });

  // ── public API ─────────────────────────────────────────────────────────────

  function startNew(): void {
    run = createRun(rng, unlockedRelicIds(store));
    saveRun(store, run);
    showScreen();
  }

  function resume(saved: RunState): void {
    run = saved;
    showScreen();
  }

  function hide(): void {
    active = false;
    screenEl.hidden = true;
    offersEl.hidden = true;
    resultEl.hidden = true;
  }

  if (deps.devHooks) {
    (window as unknown as { __adv: unknown }).__adv = {
      getRun: () => run,
      isBusy,
      /** Replace the whole run (e2e builds states with the pure run layer). */
      setRun: (next: RunState) => {
        run = next;
        saveRun(store, run);
        showScreen();
      },
      /** Merge changes into the current battle (e.g. lower the enemy's HP so a test can win quickly). */
      patchBattle: (changes: Partial<BattleState>) => {
        if (!run?.battle) return;
        const battle = { ...run.battle, ...changes };
        run = { ...run, battle, heroHp: changes.heroHp !== undefined ? changes.heroHp : run.heroHp };
        saveRun(store, run);
        updateHud();
        drawFrame();
      },
      spells: SPELL_IDS,
    };
  }

  return { startNew, resume, hide, openTrophies };
}
```
Create `workspace/src/adventure/menu.ts`:
```ts
/**
 * The start menu (spec 2): 冒險 (default) / 繼續冒險 (only when a valid save
 * exists) / 修練 (the unchanged endless mode) / 冒險獎盃. Also owns switching
 * between the three screens through `setScreen`.
 */
import { setScreen } from "../mode";
import { continueSummary } from "./viewModel";
import { loadRun } from "./save";
import type { KeyValueStore } from "./storage";
import type { AdventureView } from "./view";

export interface MenuDeps {
  store: KeyValueStore;
  adventure: AdventureView;
  /**
   * Dev builds only: skip the menu and open this mode at startup. The 54
   * existing endless e2e specs rely on it (playwright.config.ts seeds it).
   */
  devStart: "endless" | null;
}

export interface Menu {
  /** Go to the start menu (also the 🏠 buttons). */
  showMenu(): void;
  /** First screen after page load. */
  start(): void;
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function initMenu(deps: MenuDeps): Menu {
  const { store, adventure } = deps;
  const menuEl = el<HTMLDivElement>("mode-menu");
  const continueEl = el<HTMLButtonElement>("mode-continue");
  const continueInfoEl = el<HTMLElement>("mode-continue-info");
  const endlessHomeEl = el<HTMLButtonElement>("endless-home");

  function showMenu(): void {
    adventure.hide();
    setScreen("menu");
    endlessHomeEl.hidden = true;
    const saved = loadRun(store); // an invalid save is deleted here and reads as "no save"
    continueEl.hidden = saved === null;
    if (saved) continueInfoEl.textContent = continueSummary(saved);
    menuEl.hidden = false;
  }

  function enterEndless(): void {
    menuEl.hidden = true;
    adventure.hide();
    setScreen("endless");
    endlessHomeEl.hidden = false;
  }

  function enterAdventure(): void {
    menuEl.hidden = true;
    endlessHomeEl.hidden = true;
    setScreen("adventure");
  }

  el<HTMLButtonElement>("mode-adventure").addEventListener("click", () => {
    enterAdventure();
    adventure.startNew();
  });
  continueEl.addEventListener("click", () => {
    const saved = loadRun(store);
    if (!saved) {
      showMenu();
      return;
    }
    enterAdventure();
    adventure.resume(saved);
  });
  el<HTMLButtonElement>("mode-endless").addEventListener("click", enterEndless);
  el<HTMLButtonElement>("mode-trophies").addEventListener("click", () => adventure.openTrophies());
  endlessHomeEl.addEventListener("click", showMenu);

  return {
    showMenu,
    start: () => (deps.devStart === "endless" ? enterEndless() : showMenu()),
  };
}
```

- [ ] **Step 5.4: Wire `main.ts`**

In `workspace/src/main.ts` (it currently contains only `import "./game";`):

Edit `workspace/src/main.ts`. Find (must occur exactly once):
```ts
import "./game";
```
Replace with:
```ts
import { audio } from "./game";
import { initMenu } from "./adventure/menu";
import { seededRngFromSearch } from "./adventure/rng";
import { createAdventureView } from "./adventure/view";

const dev = import.meta.env.DEV;

// Dev builds only (never in production): `?seed=N` fixes the adventure rng, and the
// localStorage key below skips the start menu so the endless-mode e2e specs can run unchanged.
const rng = seededRngFromSearch(window.location.search, dev) ?? Math.random;
const devStart = dev && localStorage.getItem("mathMerge10DebugStart") === "endless" ? "endless" : null;

const adventure = createAdventureView({
  store: localStorage,
  rng,
  audio,
  goHome: () => menu.showMenu(),
  devHooks: dev,
});
const menu = initMenu({ store: localStorage, adventure, devStart });
menu.start();
```

- [ ] **Step 5.5: Seed the dev start key for the existing specs**

In `workspace/playwright.config.ts`:

Edit `workspace/playwright.config.ts`. Find (must occur exactly once):
```ts
  use: {
    baseURL: "http://localhost:5173/game_kyo/merge10/",
  },
```
Replace with:
```ts
  use: {
    baseURL: "http://localhost:5173/game_kyo/merge10/",
    // Adventure mode adds a start menu. The existing specs were written for the endless
    // board at "/", so every page starts with this dev-only key, which makes src/main.ts
    // skip the menu and open 修練. Specs about the menu clear it with test.use(NO_DEBUG_START).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:5173",
          localStorage: [{ name: "mathMerge10DebugStart", value: "endless" }],
        },
      ],
    },
  },
```

- [ ] **Step 5.6: Types, unit, build**

```bash
npx tsc --noEmit
npm run test:unit
npm run build
```

Expected: `tsc` clean; `Test Files  38 passed (38)`, `Tests  561 passed (561)`; build ok.

- [ ] **Step 5.7: Run the new e2e specs, then the whole suite**

```bash
npx playwright test tests/e2e/adventure-menu.spec.ts tests/e2e/adventure-battle.spec.ts tests/e2e/adventure-layout.spec.ts --reporter=line
npx playwright test --reporter=line
```

Expected: first run `25 passed`; full run `79 passed` (54 existing + 25 new). If a layout spec fails on a bounding box, reduce the fixed heights in the CSS (`#adv-log` min-height, spell-button `min-height`, enemy card padding) rather than the 340px board floor.

- [ ] **Step 5.8: Look at it once (manual, 2 minutes)**

```bash
npm run dev
```
Open `http://localhost:5173/game_kyo/merge10/` in a 390x844 device-mode window: the menu appears; 冒險 -> pick a relic -> swipe with arrow keys or drag; try a spell (tap 💣, tap a cell); open 🏠 and 繼續冒險; 修練 still plays the old game. Stop the dev server.

- [ ] **Step 5.9: Commit**

```bash
git add workspace/index.html workspace/src/adventure/view.ts workspace/src/adventure/menu.ts workspace/src/main.ts workspace/playwright.config.ts
git commit -m "$(cat <<'EOT'
feat(merge10): adventure screen, start menu and mode switch

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 6: iOS sync and simulator build

**Files:** none modified in either repo (`www/` and `ios/App/App/public/` are git-ignored build output).

Run from `/Users/kyo.lai82/Projects/Personal/merge10-ios`. This task needs Xcode and the iPhone 16 Pro Max simulator (`xcrun simctl list devices available` shows it; use another installed iPhone if it is missing and adjust the name).

- [ ] **Step 6.1: Sync the web build into the wrapper**

```bash
cd /Users/kyo.lai82/Projects/Personal/merge10-ios
npm run sync-web
```
Expected: `build:ios` prints `built in ...` and `Fixed dist-ios/manifest.json paths for native bundling`, then `npx cap sync ios` ends with `Sync finished`. The bundle must not contain the dev start key or enable the hooks:

```bash
grep -c "mathMerge10DebugStart" www/assets/*.js
```
Expected: `0`.

- [ ] **Step 6.2: Build for the simulator**

```bash
cd /Users/kyo.lai82/Projects/Personal/merge10-ios/ios/App
xcodebuild -scheme App -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' -derivedDataPath build/sim build
```
Expected: ends with `** BUILD SUCCEEDED **`. (`ios/App/build/` is git-ignored.)

- [ ] **Step 6.3: Install, launch, look**

```bash
xcrun simctl boot "iPhone 16 Pro Max" 2>/dev/null || true
open -a Simulator
xcrun simctl install booted build/sim/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.kyoangel.mathmerge10
xcrun simctl io booted screenshot /Users/kyo.lai82/Projects/Personal/merge10-ios/verify-adventure-menu.png
```
Open the screenshot: the start menu with ⚔ 冒險 / 🎯 修練 / 🏆 冒險獎盃. Then, by hand in the Simulator window: 冒險 -> pick a relic -> swipe the board (a drag with the mouse) -> cast a spell -> 🏠 -> 繼續冒險 -> 修練 -> its ❓ modal still shows the App Store tip jar and no external donation link, and its 🎮 button is present. Delete the screenshot afterwards (`verify*.png` files are untracked and must not be committed).

- [ ] **Step 6.4: Nothing to commit**

```bash
git -C /Users/kyo.lai82/Projects/Personal/merge10-ios status --short
```
Expected: only the pre-existing untracked `verify*.png` files. If you changed something (for example a version bump the review needs), commit it with the usual trailer:

```bash
git add <explicit paths>
git commit -m "$(cat <<'EOT'
chore(ios): <what changed>

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOT
)"
```

---

### Task 7: Full verification

**Files:** none modified.

- [ ] **Step 7.1: Types, unit, build**

Run from `/Users/kyo.lai82/Projects/Personal/game-factory/workspace`:
```bash
npx tsc --noEmit
npm run test:unit
npm run build
```

Expected: `tsc` clean; `Test Files  38 passed (38)` and `Tests  561 passed (561)`; build prints `built in ...`.

- [ ] **Step 7.2: Full e2e**

```bash
npm run test:e2e -- --reporter=line
```

Expected: `79 passed`.

- [ ] **Step 7.3: Footprint and production-bundle checks**

```bash
git -C /Users/kyo.lai82/Projects/Personal/game-factory diff --name-status HEAD~6 -- workspace | sort
```
(adjust `HEAD~6` to the commit before Task 1). Expected modified files: `index.html`, `playwright.config.ts`, `src/boardRenderer.ts`, `src/game.ts`, `src/main.ts`; everything else `A` (new): `src/mode.ts`, `src/adventure/{enemyArt,menu,rng,view,viewModel}.ts`, `tests/e2e/adventure*.ts`, `tests/unit/{fakeCanvas.ts,boardRendererSpecial.test.ts,mode.test.ts}`, `tests/unit/adventure/{enemyArt,rng,viewModel}.test.ts`. No existing test file appears as `M`.

```bash
grep -c "mathMerge10DebugStart" dist/assets/*.js
```

Expected: `0` (the dev start key never reaches a production bundle).

---

## Self-Review (done against spec §2, §3.4, §5.2, §9.2, §9.3, §10, §11 P1 and the Plan 2 hand-off)

| Spec / hand-off item | Covered by |
|---|---|
| §11 P1 item 1: `boardRenderer.ts` refactor, `merge-animation` + `visual-effects` e2e before and after | Plan #1 did the extraction; Task 1 Steps 1.1 and 1.5 run both specs (6 tests) before and after the renderer edits |
| §11 P1 items 2-6 (powerups, grid, battle, enemies, spells, relics, run flow, save, trophies) | Plans #1, #2, #3a |
| §11 P1 item 7: mode menu | Task 5 (`menu.ts`, DOM), Task 4 menu specs |
| §11 P1 item 7: iOS `sync-web` and simulator verification | Task 6 (build, install, launch, screenshot, hand checklist) |
| §2 mode menu 冒險 (primary, default) / 修練 unchanged; both on web and iOS | Task 5 (menu), Task 3 (`game.ts` gate), Task 4 specs "修練 opens the unchanged endless game", U1 |
| §2 native features unaffected (`window.Capacitor`) | Task 5 changes no script block; Task 6 checklist re-checks tip jar / donation hiding / Game Center in endless |
| §3.4 stone / frozen / 0 on the board | Task 1 (stone block, 0 tile, ice overlay + remaining turns), Task 4 spec "stones, zeros and frozen tiles draw without errors" |
| §5.2 simple canvas-drawn enemies, 9 shapes | Task 2 (`enemyArt.ts`, 9 draw tests), Task 5 (`#adv-enemy`) |
| §6.1 continue shows 繼續冒險 when a save exists; corrupt save discarded without a crash | Task 5 (`menu.ts` uses `loadRun`), Task 4 specs (continue restores the exact run after reload; corrupt save) |
| §8 adventure trophies visible, unlocks shown | Task 5 (`openTrophies`, toast), Task 4 specs (trophy list, first-clear toast + unlocked flag, tree-king toast) |
| §9.2 `index.html` mode menu + adventure DOM | Task 5 Steps 5.1-5.2 |
| §9.2 `trophies.ts` change | Deliberately not done (plan #3a E8: the 67-entry test); the adventure group has its own module and modal |
| §9.3 `view.ts`: monsters, HP bar, shield, intent mark, spell bar, 3-pick modal | Task 5 (`view.ts`), Task 2 (`intentView`, `offerView`, `progressPips`), Task 4 specs |
| §9.1 rules only in pure modules, view plays `events` | `view.ts` calls only `run.ts` functions and plays `RunStep.events` (Task 5 interface note) |
| §10 e2e: `?seed=`, at least one whole battle, both modes from the menu | Task 3 (`seededRngFromSearch`), Task 4 specs ("plays a whole battle", "?seed= makes a run reproducible", menu specs for both modes) |
| §10 all existing unit and e2e tests keep passing | Task 3 Step 3.5 and Task 5 Step 5.7/Task 7: `54 passed` inside `79 passed`; no existing test file edited |
| Design brief: phone portrait 390x844 and 430x932 | Task 4 layout specs (6 tests) |
| Plan 2 risk 1: `PALETTES[palette][0/STONE]` throws | Task 1 (U4, unit tests drawing 0 and stones) |
| Plan 2 risk 1: no frozen overlay | Task 1 (`setFrozenCells`, "❄N" test), Task 5 (`drawFrame` feeds `battle.freezes`) |
| Plan 2 risk 1: elimination animation ignores frozen walls | U5: `canAnimateElimination` + plain slide animation while frozen (Task 1 helper, Task 5 `animateSlide`); property test shows the stone case needs nothing |
| Plan 2 risk 1: stones have no pop animation | U6: documented decision, stones vanish at once |
| Plan 2 risk 2: `slid` event -> `beginElimination`/`beginSlide`, `tileSpawned` -> `beginSpawn`, render from the returned state | Task 5 (`animateSlide`, `hiddenCells`, `onEliminationDone`) |
| Plan 2 risks 3-5, 6, 7 | Plan #3a (E5, E4/E12, E14); unchanged here |
| Plan 2 risk 8: stuck-state affordance | Task 2 (`stuckHint`, unit tests), Task 5 (`setLog` appends it) |
| Hidden: existing endless e2e must reach the endless board at `/` | U1 + Task 5 Step 5.5 (`storageState` seed) + Task 5 Step 5.7 (`79 passed`) |

Type-name consistency check: names in the Interfaces blocks are exactly those in the code: `ZERO_TILE_COLORS`, `FrozenCell`, `canAnimateElimination`, `setFrozenCells`, `drawEnemyArt`, `swipeDirection`, `boardPixelSize`, `stageLabel`, `progressPips`, `intentView`, `describeEvent`, `logLines`, `damageTotal`, `heroDamageTotal`, `offerView`, `offerTitle`, `stuckHint`, `resultView`, `continueSummary`, `getScreen`, `setScreen`, `mulberry32`, `seededRngFromSearch`, `createAdventureView`, `AdventureView`, `initMenu`, `Menu`.

Pre-validation note: plans #3a and #3b were replayed in order on a scratch copy of `workspace/` outside the repo (HEAD `0288303` tree, `node_modules` symlinked): `npx tsc --noEmit` clean after every task; unit tests 514 -> 521 -> 553 -> 561 (38 files); the existing 54 e2e specs still pass after Tasks 1, 3 and 5 (the guarded `merge-animation` + `visual-effects` pair: 6 passed before and after the renderer edits); the three new specs fail red as described in Task 4 and then pass (`25 passed`), the whole suite `79 passed`; `vite build` and `build:ios` succeed and the production bundle has no `mathMerge10DebugStart`. The exact code blocks in this plan were generated from the validated files; e2e ran with the dev server moved to port 5183 in the scratch copy only (the plan itself keeps 5173). The iOS task was not run in pre-validation (only `npm run build:ios`, `xcodebuild -list` and the simulator listing were checked).

## Risks and ambiguities after this plan

1. **Balance is a first draft** (plan #3a E14): a greedy bot reaches the end in about 1 of 3 runs and mostly dies at the tree king; hero HP 10 for nine fights is tight. P2's balance script should drive `runTurn` with a bot like `tests/unit/adventure/runSimulation.test.ts`. No rule change should be needed; tune `enemies.ts`, `PAIR_DAMAGE`, or offer a heal more often.
2. **Service worker.** `public/sw.js` is cache-first with the fixed name `math-merge-10-v1`. Web visitors with the old worker may keep seeing the old `index.html` after deploy. Bump the cache name (and delete old caches in an `activate` handler) before shipping to the web; it does not affect the iOS bundle. Left out here because it is unrelated to the review rejection and no spec covers it.
3. **Elimination animation while frozen** falls back to the plain slide animation (U5); if the polish matters, model wall segments in `buildElimPhaseState` and drop `canAnimateElimination`.
4. **No confirmation before 冒險 overwrites a save** (U9). Cheap to add a `confirm()` if players complain.
5. **Haptics, screen shake, particle effects, adventure leaderboard, App Store screenshots and description** are P2 (spec 11).
6. **Real-device touch.** The simulator check uses mouse drags; the swipe code path is the same as endless mode (touchstart/touchend with a 30px threshold) but has only been exercised by keyboard in e2e. A quick on-device pass is part of the resubmission checklist.
7. **Dev hooks in the production bundle.** `window.__adv` is guarded by `import.meta.env.DEV` at runtime; it is never set in a production build, but the code is present (U13).
