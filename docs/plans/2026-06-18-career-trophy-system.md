# Career Trophy System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 permanent lifetime achievements that unlock via gameplay milestones, show a toast on unlock, and are viewable in a 🏆 HUD modal.

**Architecture:** New `workspace/src/trophies.ts` holds all definitions, persistence (`mathMerge10Trophies` in localStorage), and public API. `game.ts` calls `checkTrophies()` at two points (after each slide, at game-over) and wires up the UI. HTML/CSS adds the 🏆 HUD button, toast element, and trophy modal — mirroring the existing `#powerup-modal` pattern.

**Tech Stack:** TypeScript, Vite, Vitest (unit), Playwright (E2E).

---

## File Structure

| File | Change |
|------|--------|
| `workspace/src/trophies.ts` | **Create** — trophy defs, `checkTrophies`, `loadTrophyStatuses`, `getTrophyDef` |
| `workspace/src/game.ts` | Modify — import; element refs; modal listeners; `showTrophyToast`; `renderTrophyModal`; 2 `checkTrophies` callpoints |
| `workspace/index.html` | Modify — 🏆 button in `#hud`; toast element + CSS + keyframes; trophy modal markup + CSS |
| `workspace/tests/unit/trophies.test.ts` | **Create** — full unit test suite for all 8 trophy conditions + deduplication + persistence |
| `workspace/tests/e2e/ux-v2.spec.ts` | Modify — 5 new E2E tests |

---

## Task 1: `trophies.ts` — core module + unit tests

**Files:**
- Create: `workspace/src/trophies.ts`
- Create: `workspace/tests/unit/trophies.test.ts`

- [x] **Step 1: Write the failing unit tests**

Create `workspace/tests/unit/trophies.test.ts` with this full content:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { checkTrophies, loadTrophyStatuses, getTrophyDef } from "../../src/trophies";

const EMPTY_GRID = Array.from({ length: 4 }, () => Array(4).fill(null)) as (number | null)[][];

function makeGrid(values: (number | null)[][]): (number | null)[][] {
  return values;
}

describe("trophies", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // zero_score
  it("zero_score unlocks when gameOver with score 0", () => {
    const result = checkTrophies({ type: "gameOver", score: 0 });
    expect(result).toContain("zero_score");
  });

  it("zero_score does NOT unlock when score > 0", () => {
    const result = checkTrophies({ type: "gameOver", score: 10 });
    expect(result).not.toContain("zero_score");
  });

  // one_flood
  it("one_flood unlocks when grid has ≥ 5 tiles of value 1", () => {
    const grid = makeGrid([
      [1, 1, 1, 1],
      [1, 2, 3, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("one_flood");
  });

  it("one_flood does NOT unlock with 4 tiles of 1", () => {
    const grid = makeGrid([
      [1, 1, 1, 1],
      [2, 3, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("one_flood");
  });

  // nine_feast
  it("nine_feast unlocks when grid has ≥ 3 tiles of value 9", () => {
    const grid = makeGrid([
      [9, 9, 9, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("nine_feast");
  });

  it("nine_feast does NOT unlock with 2 tiles of 9", () => {
    const grid = makeGrid([
      [9, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("nine_feast");
  });

  // almost_full
  it("almost_full unlocks when grid has ≥ 15 non-null tiles", () => {
    const grid = makeGrid([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, 6, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).toContain("almost_full");
  });

  it("almost_full does NOT unlock with 14 non-null tiles", () => {
    const grid = makeGrid([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 1, 2, 3],
      [4, 5, null, null],
    ]);
    expect(checkTrophies({ type: "slide", grid, comboCount: 0 })).not.toContain("almost_full");
  });

  // combo trophies
  it("combo_2 unlocks at comboCount 2", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 })).toContain("combo_2");
  });

  it("combo_2 does NOT unlock at comboCount 1", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 1 })).not.toContain("combo_2");
  });

  it("combo_3 unlocks at comboCount 3", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 3 })).toContain("combo_3");
  });

  it("combo_4 unlocks at comboCount 4", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 4 })).toContain("combo_4");
  });

  it("combo_5 unlocks at comboCount 5", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 })).toContain("combo_5");
  });

  it("combo_5 also unlocks at comboCount 7 (≥ 5)", () => {
    expect(checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 7 })).toContain("combo_5");
  });

  it("comboCount 5 unlocks all four combo trophies at once", () => {
    const result = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 5 });
    expect(result).toContain("combo_2");
    expect(result).toContain("combo_3");
    expect(result).toContain("combo_4");
    expect(result).toContain("combo_5");
  });

  // deduplication
  it("already-unlocked trophy is NOT returned again by checkTrophies", () => {
    checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    const result = checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    expect(result).not.toContain("combo_2");
  });

  // loadTrophyStatuses
  it("loadTrophyStatuses returns exactly 8 entries", () => {
    expect(loadTrophyStatuses()).toHaveLength(8);
  });

  it("loadTrophyStatuses reflects unlocked state after checkTrophies", () => {
    checkTrophies({ type: "slide", grid: EMPTY_GRID, comboCount: 2 });
    const statuses = loadTrophyStatuses();
    const combo2 = statuses.find((s) => s.def.id === "combo_2")!;
    expect(combo2.unlocked).toBe(true);
    expect(combo2.unlockedAt).toBeTypeOf("number");
    const zeroScore = statuses.find((s) => s.def.id === "zero_score")!;
    expect(zeroScore.unlocked).toBe(false);
    expect(zeroScore.unlockedAt).toBeNull();
  });

  // getTrophyDef
  it("getTrophyDef returns correct def by id", () => {
    const def = getTrophyDef("combo_5");
    expect(def).toBeDefined();
    expect(def!.name).toBe("連鎖大師");
  });

  it("getTrophyDef returns undefined for unknown id", () => {
    expect(getTrophyDef("unknown")).toBeUndefined();
  });
});
```

- [x] **Step 2: Run to verify tests fail**

```bash
cd workspace && npm run test:unit 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../../src/trophies'`

- [x] **Step 3: Create `workspace/src/trophies.ts`**

```typescript
import { type GameGrid } from "./grid";

export interface TrophyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (event: TrophyCheckEvent) => boolean;
}

export type TrophyCheckEvent =
  | { type: "slide"; grid: GameGrid; comboCount: number }
  | { type: "gameOver"; score: number };

export interface TrophyStatus {
  def: TrophyDef;
  unlocked: boolean;
  unlockedAt: number | null;
}

const TROPHY_KEY = "mathMerge10Trophies";

function countValue(grid: GameGrid, value: number): number {
  return grid.flat().filter((c) => c === value).length;
}

function countNonNull(grid: GameGrid): number {
  return grid.flat().filter((c) => c !== null).length;
}

const TROPHY_DEFS: TrophyDef[] = [
  {
    id: "zero_score",
    name: "空手而歸",
    icon: "🕊️",
    description: "完成一場遊戲，得分為零",
    check: (e) => e.type === "gameOver" && e.score === 0,
  },
  {
    id: "one_flood",
    name: "一的洪流",
    icon: "🌊",
    description: "版面上同時出現 5 個或以上的「1」",
    check: (e) => e.type === "slide" && countValue(e.grid, 1) >= 5,
  },
  {
    id: "nine_feast",
    name: "九的盛宴",
    icon: "🍱",
    description: "版面上同時出現 3 個或以上的「9」",
    check: (e) => e.type === "slide" && countValue(e.grid, 9) >= 3,
  },
  {
    id: "almost_full",
    name: "滿溢邊緣",
    icon: "💥",
    description: "版面上同時有 15 格或以上非空的格子",
    check: (e) => e.type === "slide" && countNonNull(e.grid) >= 15,
  },
  {
    id: "combo_2",
    name: "連鎖初學",
    icon: "⚡",
    description: "一次消除 2 對",
    check: (e) => e.type === "slide" && e.comboCount >= 2,
  },
  {
    id: "combo_3",
    name: "連鎖高手",
    icon: "⚡⚡",
    description: "一次消除 3 對",
    check: (e) => e.type === "slide" && e.comboCount >= 3,
  },
  {
    id: "combo_4",
    name: "連鎖達人",
    icon: "⚡⚡⚡",
    description: "一次消除 4 對",
    check: (e) => e.type === "slide" && e.comboCount >= 4,
  },
  {
    id: "combo_5",
    name: "連鎖大師",
    icon: "🌟",
    description: "一次消除 5 對或以上",
    check: (e) => e.type === "slide" && e.comboCount >= 5,
  },
];

function loadUnlocked(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function checkTrophies(event: TrophyCheckEvent): string[] {
  const unlocked = loadUnlocked();
  const newlyUnlocked: string[] = [];
  for (const def of TROPHY_DEFS) {
    if (unlocked[def.id] !== undefined) continue;
    if (def.check(event)) {
      unlocked[def.id] = Date.now();
      newlyUnlocked.push(def.id);
    }
  }
  if (newlyUnlocked.length > 0) {
    localStorage.setItem(TROPHY_KEY, JSON.stringify(unlocked));
  }
  return newlyUnlocked;
}

export function loadTrophyStatuses(): TrophyStatus[] {
  const unlocked = loadUnlocked();
  return TROPHY_DEFS.map((def) => ({
    def,
    unlocked: def.id in unlocked,
    unlockedAt: unlocked[def.id] ?? null,
  }));
}

export function getTrophyDef(id: string): TrophyDef | undefined {
  return TROPHY_DEFS.find((d) => d.id === id);
}
```

- [x] **Step 4: Run to verify tests pass**

```bash
cd workspace && npm run test:unit 2>&1 | tail -15
```

Expected: all tests PASS. The new trophies suite adds ~20 tests on top of the existing 142.

- [x] **Step 5: Commit**

```bash
git add workspace/src/trophies.ts workspace/tests/unit/trophies.test.ts
git commit -m "feat: add trophies module with 8 trophy definitions and persistence"
```

---

## Task 2: HTML/CSS — 🏆 button, toast, trophy modal

**Files:**
- Modify: `workspace/index.html`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write the failing E2E tests**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("Trophy: 🏆 button is visible in HUD", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud-trophy")).toBeVisible();
});

test("Trophy: clicking 🏆 opens modal with all 8 trophy names", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  for (const name of [
    "空手而歸", "一的洪流", "九的盛宴", "滿溢邊緣",
    "連鎖初學", "連鎖高手", "連鎖達人", "連鎖大師",
  ]) {
    await expect(page.locator("#trophy-modal")).toContainText(name);
  }
});

test("Trophy: clicking overlay closes trophy modal", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  await page.locator("#trophy-modal-overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("#trophy-modal")).toBeHidden();
});

test("Trophy: combo_2 slide unlocks 連鎖初學 and shows toast", async ({ page }) => {
  await page.goto("/");
  // Grid with 2 pairs (row 0: 1+9, row 1: 1+9) — ArrowLeft eliminates both
  await page.evaluate(() => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [1, 9, null, null],
        [1, 9, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  await expect(page.locator("#trophy-toast")).toContainText("連鎖初學");
});

test("Trophy: unlocked trophy shows ✓ in modal", async ({ page }) => {
  await page.goto("/");
  // Unlock combo_2 first
  await page.evaluate(() => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [1, 9, null, null],
        [1, 9, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  // Open trophy modal
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  // 連鎖初學 row should have ✓
  const combo2Item = page.locator("#trophy-modal-list li").filter({ hasText: "連鎖初學" });
  await expect(combo2Item).toContainText("✓");
});
```

- [x] **Step 2: Run to verify tests fail**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Trophy" 2>&1 | tail -20
```

Expected: FAIL — `#hud-trophy` not found, `#trophy-modal` not found.

- [x] **Step 3: Add `#hud-trophy` to the shared button CSS selector**

In `workspace/index.html`, find (around line 54):
```css
    #hud-palette-toggle,
    #hud-mute,
    #hud-powerup-info {
```

Replace with:
```css
    #hud-palette-toggle,
    #hud-mute,
    #hud-powerup-info,
    #hud-trophy {
```

- [x] **Step 4: Add `#trophy-toast` CSS + keyframes**

In `workspace/index.html`, in the `<style>` block, after the `@keyframes combo-appear` block and before the `#powerup-modal` CSS (around line 222), add:

```css
    #trophy-toast {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: #fde047;
      color: #422006;
      font-family: sans-serif;
      font-weight: bold;
      font-size: 14px;
      border-radius: 8px;
      padding: 8px 16px;
      pointer-events: none;
      opacity: 0;
      z-index: 30;
      white-space: nowrap;
    }
    #trophy-toast.animate {
      animation: trophy-toast-appear 2200ms ease-out forwards;
    }
    @keyframes trophy-toast-appear {
      0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
      70%  { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    }
```

- [x] **Step 5: Add trophy modal CSS**

In `workspace/index.html`, in the `<style>` block, after the `#powerup-modal-list .pm-body small` block and before `</style>`, add:

```css
    #trophy-modal {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #trophy-modal[hidden] {
      display: none;
    }
    #trophy-modal-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
    }
    #trophy-modal-card {
      position: relative;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 20px 24px;
      max-width: 320px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      color: #e5e7eb;
      font-family: sans-serif;
      z-index: 1;
    }
    #trophy-modal-card h3 {
      margin: 0 0 14px;
      font-size: 15px;
      color: #f9fafb;
    }
    #trophy-modal-close {
      position: absolute;
      top: 10px;
      right: 12px;
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    #trophy-modal-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #trophy-modal-list li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    #trophy-modal-list li.tm-locked {
      opacity: 0.4;
    }
    .tm-icon {
      font-size: 20px;
      flex-shrink: 0;
      line-height: 1.3;
    }
    .tm-body {
      font-size: 13px;
      line-height: 1.5;
    }
    .tm-body small {
      display: block;
      color: #9ca3af;
      font-size: 11px;
    }
    .tm-check {
      color: #4ade80;
      font-weight: bold;
      margin-left: 4px;
    }
```

- [x] **Step 6: Add HTML — 🏆 button, toast div, trophy modal**

In `workspace/index.html`, find the `#hud` block (around line 313):
```html
    <div id="hud">
      <span id="hud-score">Score: 0</span>
      <span id="hud-best">Best: 0</span>
      <div id="hud-powerups"></div>
      <button id="hud-powerup-info" aria-label="道具說明">❓</button>
      <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
      <button id="hud-mute" aria-label="靜音">🔊</button>
    </div>
```

Replace with:
```html
    <div id="hud">
      <span id="hud-score">Score: 0</span>
      <span id="hud-best">Best: 0</span>
      <div id="hud-powerups"></div>
      <button id="hud-powerup-info" aria-label="道具說明">❓</button>
      <button id="hud-trophy" aria-label="生涯獎盃">🏆</button>
      <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
      <button id="hud-mute" aria-label="靜音">🔊</button>
    </div>
```

Also find `<div id="score-popup"></div>` inside `#game-container` (around line 300) and add the toast after it:

Find:
```html
      <div id="score-popup"></div>
      <div id="combo-badge"></div>
```

Replace with:
```html
      <div id="score-popup"></div>
      <div id="combo-badge"></div>
      <div id="trophy-toast"></div>
```

Then, after `</div>` closing `#powerup-modal` (around line 357), add the trophy modal:

```html
    <div id="trophy-modal" hidden>
      <div id="trophy-modal-overlay"></div>
      <div id="trophy-modal-card">
        <button id="trophy-modal-close" aria-label="關閉">✕</button>
        <h3>生涯獎盃</h3>
        <ul id="trophy-modal-list"></ul>
      </div>
    </div>
```

- [x] **Step 7: Run the Trophy E2E tests**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Trophy" 2>&1 | tail -20
```

Expected: "🏆 button", "modal opens", and "overlay closes" PASS. The "toast" and "shows ✓" tests still FAIL (no JS yet). That's expected.

- [x] **Step 8: Run full E2E suite to check for regressions**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts 2>&1 | tail -10
```

Expected: existing tests all PASS, 3 new Trophy tests PASS, 2 Trophy tests FAIL (toast + ✓ — JS not wired yet).

- [x] **Step 9: Commit**

```bash
git add workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: add trophy HUD button, toast element, and trophy modal HTML/CSS"
```

---

## Task 3: `game.ts` — JS integration

**Files:**
- Modify: `workspace/src/game.ts`

- [x] **Step 1: Add import for `trophies` module**

In `workspace/src/game.ts`, after the existing powerups import (after line 27):

```typescript
import { checkTrophies, loadTrophyStatuses, getTrophyDef } from "./trophies";
```

- [x] **Step 2: Add element refs**

In `workspace/src/game.ts`, after line 61 (`const powerupModalCloseEl = ...`):

```typescript
const hudTrophyEl = document.getElementById("hud-trophy") as HTMLButtonElement;
const trophyModalEl = document.getElementById("trophy-modal") as HTMLDivElement;
const trophyModalOverlayEl = document.getElementById("trophy-modal-overlay") as HTMLDivElement;
const trophyModalCloseEl = document.getElementById("trophy-modal-close") as HTMLButtonElement;
const trophyModalListEl = document.getElementById("trophy-modal-list") as HTMLUListElement;
const trophyToastEl = document.getElementById("trophy-toast") as HTMLDivElement;
```

- [x] **Step 3: Add modal listeners**

In `workspace/src/game.ts`, after the existing powerup modal listeners (after line 81 — after `powerupModalCloseEl.addEventListener`):

```typescript
hudTrophyEl.addEventListener("click", () => {
  renderTrophyModal();
  trophyModalEl.removeAttribute("hidden");
});
trophyModalOverlayEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});
trophyModalCloseEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});
```

- [x] **Step 4: Add `showTrophyToast` and `renderTrophyModal` functions**

In `workspace/src/game.ts`, after `showComboBadge` (after line 497, before `function tick()`):

```typescript
const trophyToastQueue: string[] = [];
let trophyToastTimer: ReturnType<typeof setTimeout> | null = null;

function drainTrophyToastQueue(): void {
  const id = trophyToastQueue.shift();
  if (id === undefined) { trophyToastTimer = null; return; }
  const def = getTrophyDef(id);
  if (!def) { drainTrophyToastQueue(); return; }
  trophyToastEl.textContent = `${def.icon} ${def.name}！`;
  trophyToastEl.classList.remove("animate");
  void trophyToastEl.offsetWidth;
  trophyToastEl.classList.add("animate");
  trophyToastTimer = setTimeout(() => {
    trophyToastEl.classList.remove("animate");
    drainTrophyToastQueue();
  }, 2200);
}

function showTrophyToast(id: string): void {
  trophyToastQueue.push(id);
  if (trophyToastTimer === null) drainTrophyToastQueue();
}

function renderTrophyModal(): void {
  trophyModalListEl.innerHTML = "";
  loadTrophyStatuses().forEach(({ def, unlocked }) => {
    const li = document.createElement("li");
    if (!unlocked) li.classList.add("tm-locked");
    li.innerHTML = `<span class="tm-icon">${def.icon}</span><span class="tm-body"><strong>${def.name}</strong>${unlocked ? '<span class="tm-check">✓</span>' : ""}<small>${def.description}</small></span>`;
    trophyModalListEl.appendChild(li);
  });
}
```

- [x] **Step 5: Add `checkTrophies` callpoint after each slide**

In `workspace/src/game.ts`, in `handleKeydown`, after `startAnimationLoop()` (after line 692):

```typescript
  const newlyUnlockedTrophies = checkTrophies({
    type: "slide",
    grid: state.grid,
    comboCount: eliminatedPairs.length,
  });
  newlyUnlockedTrophies.forEach((id) => showTrophyToast(id));
```

- [x] **Step 6: Add `checkTrophies` callpoint at game-over**

In `workspace/src/game.ts`, in `handleKeydown`, find the game-over block (around line 655):

```typescript
  if (isGameOver(newGrid)) {
    setTimeout(() => audio.play("gameOver"), 400);
  }
```

Replace with:

```typescript
  if (isGameOver(newGrid)) {
    setTimeout(() => audio.play("gameOver"), 400);
    const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
    gameOverTrophies.forEach((id) => showTrophyToast(id));
  }
```

- [x] **Step 7: Run TypeScript check**

```bash
cd workspace && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [x] **Step 8: Run full unit test suite**

```bash
cd workspace && npm run test:unit 2>&1 | tail -5
```

Expected: all tests PASS.

- [x] **Step 9: Run all Trophy E2E tests**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Trophy" 2>&1 | tail -20
```

Expected: all 5 Trophy tests PASS.

- [x] **Step 10: Run full E2E suite**

```bash
cd workspace && npm run test:e2e 2>&1 | tail -10
```

Expected: all tests PASS (41 existing + 5 new = 46 total).

- [x] **Step 11: Commit**

```bash
git add workspace/src/game.ts
git commit -m "feat: wire trophy unlock checks, toast notifications, and modal into game"
```

---

## Final Verification

- [x] **Full test suite**

```bash
cd workspace && npm run test:unit && npm run test:e2e
```

Expected: all tests PASS.

- [x] **Build check**

```bash
cd workspace && npm run build 2>&1 | tail -5
```

Expected: build succeeds, no TypeScript errors.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| `trophies.ts` with `TrophyDef`, `TrophyCheckEvent`, `TrophyStatus` types | Task 1 |
| `TROPHY_DEFS` — 8 trophy definitions | Task 1 |
| `checkTrophies(event)` — checks unlocked, persists, returns newly-unlocked IDs | Task 1 |
| `loadTrophyStatuses()` — all 8 with unlock state | Task 1 |
| `getTrophyDef(id)` — lookup by ID | Task 1 |
| localStorage key `mathMerge10Trophies` | Task 1 |
| Already-unlocked trophy not returned again | Task 1 |
| 🏆 HUD button `#hud-trophy` | Task 2 |
| `#trophy-toast` with CSS animation | Task 2 |
| `#trophy-modal` markup (overlay + card + list) | Task 2 |
| Trophy modal list populated dynamically by `renderTrophyModal` | Task 3 |
| Modal open/close listeners | Task 3 |
| `showTrophyToast` queues sequential toasts | Task 3 |
| `checkTrophies` called after each slide | Task 3 |
| `checkTrophies` called at game-over | Task 3 |
| Unlocked trophies show ✓ in modal, locked ones greyed out | Task 3 |
