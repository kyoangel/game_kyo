# Powerup UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mobile viewport height, add a powerup description modal, fix Add One on tile-9, rebalance powerup unlock conditions, and track lifetime eliminations for bomb awards.

**Architecture:** All changes are within `workspace/src/powerups.ts` (logic), `workspace/src/game.ts` (game mechanics, modal JS, tips text), and `workspace/index.html` (CSS, HTML structure). No new files. Tests go in the existing `workspace/tests/unit/powerups.test.ts` and `workspace/tests/e2e/ux-v2.spec.ts`.

**Tech Stack:** TypeScript, Vite, Vitest (unit), Playwright (E2E).

---

## File Structure

| File | Change |
|------|--------|
| `workspace/src/powerups.ts` | Replace `computePlayCountAward` thresholds; add `computeEliminationAward`; remove `computeBestScoreAward` |
| `workspace/src/game.ts` | Fix `applyAddOne`; add lifetime-elim tracking; add modal JS; update `POWERUP_UNLOCK_TIPS`; remove `computeBestScoreAward` import and calls |
| `workspace/index.html` | `100dvh`; `#powerup-modal` markup + CSS; `❓` button in `#hud` |
| `workspace/tests/unit/powerups.test.ts` | Replace all tests to match new logic |
| `workspace/tests/e2e/ux-v2.spec.ts` | Add tests for viewport, Add One on 9, bomb award, modal |

---

## Task 1: Rebalance `powerups.ts` — new unlock thresholds + `computeEliminationAward`

**Files:**
- Modify: `workspace/src/powerups.ts`
- Modify: `workspace/tests/unit/powerups.test.ts`

- [x] **Step 1: Write the failing unit tests**

Replace the entire contents of `workspace/tests/unit/powerups.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  computePlayCountAward,
  computeEliminationAward,
} from "../../src/powerups";

describe("computePlayCountAward", () => {
  it("returns null for play counts not hitting any threshold (1, 5, 7)", () => {
    expect(computePlayCountAward(1)).toBeNull();
    expect(computePlayCountAward(5)).toBeNull();
    expect(computePlayCountAward(7)).toBeNull();
  });

  it("returns 'hammer' or 'shuffle' on every 2nd play (non-3rd)", () => {
    const award2 = computePlayCountAward(2);
    expect(["hammer", "shuffle"]).toContain(award2);
    const award4 = computePlayCountAward(4);
    expect(["hammer", "shuffle"]).toContain(award4);
    const award8 = computePlayCountAward(8);
    expect(["hammer", "shuffle"]).toContain(award8);
  });

  it("returns 'addOne' on every 3rd play (takes priority over 2nd)", () => {
    expect(computePlayCountAward(3)).toBe("addOne");
    expect(computePlayCountAward(6)).toBe("addOne"); // divisible by both 2 and 3 → addOne wins
    expect(computePlayCountAward(9)).toBe("addOne");
  });
});

describe("computeEliminationAward", () => {
  it("returns 0 when not crossing a 30-multiple", () => {
    expect(computeEliminationAward(0, 29)).toBe(0);
    expect(computeEliminationAward(30, 59)).toBe(0);
    expect(computeEliminationAward(10, 25)).toBe(0);
  });

  it("returns 1 when crossing one 30-multiple boundary", () => {
    expect(computeEliminationAward(0, 30)).toBe(1);
    expect(computeEliminationAward(29, 31)).toBe(1);
    expect(computeEliminationAward(28, 30)).toBe(1);
  });

  it("returns 2 when crossing two 30-multiple boundaries", () => {
    expect(computeEliminationAward(0, 60)).toBe(2);
    expect(computeEliminationAward(29, 61)).toBe(2);
  });
});
```

- [x] **Step 2: Run to verify tests fail**

```bash
cd workspace && npm run test:unit
```

Expected: FAIL — `computeEliminationAward is not a function`, and the `computePlayCountAward` threshold tests fail (old thresholds are 5/10, not 2/3).

- [x] **Step 3: Replace `workspace/src/powerups.ts`**

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

export function computePlayCountAward(
  playCount: number,
  rng: () => number = Math.random,
): PowerupId | null {
  if (playCount % 3 === 0) return "addOne";
  if (playCount % 2 === 0) return rng() < 0.5 ? "hammer" : "shuffle";
  return null;
}

export function computeEliminationAward(
  oldTotal: number,
  newTotal: number,
): number {
  return Math.floor(newTotal / 30) - Math.floor(oldTotal / 30);
}
```

- [x] **Step 4: Run to verify tests pass**

```bash
cd workspace && npm run test:unit
```

Expected: all tests PASS (including old tests that still reference `computePlayCountAward`).

- [x] **Step 5: Commit**

```bash
git add workspace/src/powerups.ts workspace/tests/unit/powerups.test.ts
git commit -m "feat: rebalance powerup unlock thresholds and add elimination-based bomb award"
```

---

## Task 2: Fix `applyAddOne` on tile-9 (eliminate instead of no-op)

**Files:**
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write the failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("Fix-AddOne: Add One on a 9-tile eliminates it and scores +10", async ({ page }) => {
  await page.goto("/");

  // Set up board with a 9 in top-left, 1 addOne powerup, score 0
  await page.evaluate(() => {
    (window as unknown as { __setPowerups: (p: unknown) => void }).__setPowerups(
      { hammer: 0, shuffle: 0, addOne: 1, bomb: 0 },
    );
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [9, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });

  // Activate Add One powerup
  await page.locator(".hud-powerup-btn[data-powerup='addOne']").click();

  // Click the 9-tile on canvas (top-left quadrant)
  const canvas = page.locator("canvas#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");
  await canvas.click({ position: { x: box.width * 0.125, y: box.height * 0.125 } });

  // Score should be 10
  await expect(page.locator("#hud-score")).toContainText("10");

  // addOne count should be 0 (consumed)
  const addOneCount = await page.evaluate(() => {
    const btn = document.querySelector(".hud-powerup-btn[data-powerup='addOne']") as HTMLElement;
    return btn?.dataset.locked;
  });
  expect(addOneCount).toBe("true");
});
```

- [x] **Step 2: Run to verify test fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Fix-AddOne"
```

Expected: FAIL — score remains 0 (current code does nothing on tile-9).

- [x] **Step 3: Fix `applyAddOne` in `workspace/src/game.ts`**

Find the existing `applyAddOne` function (around line 183) and replace it:

```typescript
function applyAddOne(row: number, col: number): void {
  const value = state.grid[row][col];
  if (value === null) return;
  if (value === 9) {
    const newGrid = state.grid.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? null : c)),
    );
    setState({ ...state, grid: newGrid, score: state.score + 10 });
  } else {
    const newGrid = state.grid.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? value + 1 : c)),
    );
    setState({ ...state, grid: newGrid });
  }
  powerups.addOne--;
  savePowerups();
  audio.play("addOne");
  renderHudPowerups();
}
```

- [x] **Step 4: Run to verify test passes**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Fix-AddOne"
```

Expected: PASS.

- [x] **Step 5: Run full unit + ux-v2 E2E suite**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all PASS.

- [x] **Step 6: Commit**

```bash
git add workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "fix: Add One on tile-9 now eliminates it and scores +10"
```

---

## Task 3: Lifetime elimination tracking + bomb award, remove `computeBestScoreAward`

**Files:**
- Modify: `workspace/src/game.ts`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write the failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("Fix-Bomb: bomb awarded when lifetime eliminations cross a 30-pair multiple", async ({ page }) => {
  await page.goto("/");

  // Start with 0 bombs
  await page.evaluate(() => {
    (window as unknown as { __setPowerups: (p: unknown) => void }).__setPowerups(
      { hammer: 0, shuffle: 0, addOne: 0, bomb: 0 },
    );
    // Set lifetime counter to 29 (one away from first bomb)
    (window as unknown as { __setLifetimeElim: (n: number) => void }).__setLifetimeElim(29);
  });

  // Set up board with a pair that sums to 10 (4 and 6 in same row)
  await page.evaluate(() => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState({
      grid: [
        [4, 6, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    });
  });

  // Swipe left to eliminate the pair (4+6=10)
  const canvas = page.locator("canvas#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");
  await page.evaluate(
    ({ sx, ex, y }) => {
      const el = document.getElementById("game")!;
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [new Touch({ identifier: 1, target: el, clientX: sx, clientY: y })] }));
      el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [new Touch({ identifier: 1, target: el, clientX: ex, clientY: y })] }));
    },
    { sx: box.x + box.width * 0.75, ex: box.x + box.width * 0.25, y: box.y + box.height * 0.1 },
  );

  // Wait a frame for state to update
  await page.waitForTimeout(100);

  // Bomb button should now be unlocked (count = 1)
  const bombLocked = await page.evaluate(() => {
    const btn = document.querySelector(".hud-powerup-btn[data-powerup='bomb']") as HTMLElement;
    return btn?.dataset.locked;
  });
  expect(bombLocked).toBe("false");
});
```

- [x] **Step 2: Run to verify test fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Fix-Bomb"
```

Expected: FAIL — `__setLifetimeElim is not a function` (hook doesn't exist yet).

- [x] **Step 3: Update `workspace/src/game.ts`**

**3a. Update the import from `./powerups`** — replace `computeBestScoreAward` with `computeEliminationAward`:

Find (around line 22–28):
```typescript
import {
  type PowerupId,
  type PowerupState,
  emptyPowerups,
  computePlayCountAward,
  computeBestScoreAward,
} from "./powerups";
```

Replace with:
```typescript
import {
  type PowerupId,
  type PowerupState,
  emptyPowerups,
  computePlayCountAward,
  computeEliminationAward,
} from "./powerups";
```

**3b. Add `LIFETIME_ELIM_KEY` constant and `loadLifetimeElim` function** — after `PLAY_COUNT_KEY` (around line 34):

```typescript
const LIFETIME_ELIM_KEY = "mathMerge10LifetimeElim";
```

After `loadPlayCount` function (around line 216):
```typescript
function loadLifetimeElim(): number {
  return parseInt(localStorage.getItem(LIFETIME_ELIM_KEY) ?? "0", 10);
}
```

**3c. Remove `computeBestScoreAward` calls from `handleKeydown`** — find and remove this block (around line 613–621):

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

Replace with (keep best score tracking, just remove bomb award):
```typescript
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
```

**3d. Add lifetime elimination tracking after `eliminatedPairs` is set** — find `const eliminatedPairs = outcome.eliminatedPairs;` (around line 638) and insert after it:

```typescript
  if (eliminatedPairs.length > 0) {
    const oldElim = loadLifetimeElim();
    const newElim = oldElim + eliminatedPairs.length;
    localStorage.setItem(LIFETIME_ELIM_KEY, String(newElim));
    const bombs = computeEliminationAward(oldElim, newElim);
    if (bombs > 0) {
      powerups.bomb += bombs;
      savePowerups();
      renderHudPowerups();
    }
  }
```

**3e. Remove `computeBestScoreAward` call from `setState`** — find and remove this block (around line 771–779):

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

Replace with:
```typescript
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
```

**3f. Add `__setLifetimeElim` test hook** — after `__setPowerups` (around line 811–814):

```typescript
(window as unknown as { __setLifetimeElim: (n: number) => void }).__setLifetimeElim = (n) => {
  localStorage.setItem(LIFETIME_ELIM_KEY, String(n));
};
```

- [x] **Step 4: Run to verify TypeScript compiles**

```bash
cd workspace && npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 5: Run the new E2E test**

Make sure dev server is running (`lsof -i :5173`; if not: `cd workspace && npm run dev &` then wait 3s).

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Fix-Bomb"
```

Expected: PASS.

- [x] **Step 6: Run full suite**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all PASS.

- [x] **Step 7: Commit**

```bash
git add workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: track lifetime eliminations for bomb award; remove best-score-based bomb award"
```

---

## Task 4: Viewport fix + powerup modal HTML/CSS + ❓ button

**Files:**
- Modify: `workspace/index.html`
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [x] **Step 1: Write the failing E2E tests**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("Fix-Viewport: body min-height uses 100dvh so page does not scroll on mobile", async ({ page }) => {
  await page.goto("/");
  const minHeight = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText === "body") {
            return rule.style.minHeight;
          }
        }
      } catch { /* cross-origin */ }
    }
    return "";
  });
  expect(minHeight).toBe("100dvh");
});

test("Fix-Modal: ❓ button visible in HUD", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud-powerup-info")).toBeVisible();
});

test("Fix-Modal: clicking ❓ opens modal with all 4 powerup names", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-powerup-info").click();
  await expect(page.locator("#powerup-modal")).toBeVisible();
  await expect(page.locator("#powerup-modal")).toContainText("Hammer");
  await expect(page.locator("#powerup-modal")).toContainText("Shuffle");
  await expect(page.locator("#powerup-modal")).toContainText("Add One");
  await expect(page.locator("#powerup-modal")).toContainText("Bomb");
});

test("Fix-Modal: clicking overlay closes modal", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-powerup-info").click();
  await expect(page.locator("#powerup-modal")).toBeVisible();
  // Click the overlay (not the card)
  await page.locator("#powerup-modal-overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("#powerup-modal")).toBeHidden();
});
```

- [x] **Step 2: Run to verify tests fail**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Fix-Viewport|Fix-Modal"
```

Expected: FAIL — `minHeight` is `"100vh"`, `#hud-powerup-info` not found, modal elements not found.

- [x] **Step 3: Update `workspace/index.html` — viewport fix**

Find `min-height: 100vh;` in the `body {}` rule and change it to:

```css
min-height: 100dvh;
```

- [x] **Step 4: Update `workspace/index.html` — add ❓ button to selector**

Find:
```css
    #hud-palette-toggle,
    #hud-mute {
```

Replace with:
```css
    #hud-palette-toggle,
    #hud-mute,
    #hud-powerup-info {
```

- [x] **Step 5: Update `workspace/index.html` — add modal CSS**

Inside the `<style>` block, after the `#combo-badge` keyframes (after line 221, before `</style>`), add:

```css
    #powerup-modal {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #powerup-modal[hidden] {
      display: none;
    }
    #powerup-modal-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
    }
    #powerup-modal-card {
      position: relative;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 20px 24px;
      max-width: 320px;
      width: 90%;
      color: #e5e7eb;
      font-family: sans-serif;
      z-index: 1;
    }
    #powerup-modal-card h3 {
      margin: 0 0 14px;
      font-size: 15px;
      color: #f9fafb;
    }
    #powerup-modal-close {
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
    #powerup-modal-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    #powerup-modal-list li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .pm-icon {
      font-size: 22px;
      flex-shrink: 0;
      line-height: 1.3;
    }
    .pm-body {
      font-size: 13px;
      line-height: 1.5;
    }
    .pm-body small {
      display: block;
      color: #9ca3af;
      font-size: 11px;
    }
```

- [x] **Step 6: Update `workspace/index.html` — add ❓ button and modal markup**

Find the `#hud` block (around line 240–246):
```html
    <div id="hud">
      <span id="hud-score">Score: 0</span>
      <span id="hud-best">Best: 0</span>
      <div id="hud-powerups"></div>
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
      <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
      <button id="hud-mute" aria-label="靜音">🔊</button>
    </div>
    <div id="powerup-modal" hidden>
      <div id="powerup-modal-overlay"></div>
      <div id="powerup-modal-card">
        <button id="powerup-modal-close" aria-label="關閉">✕</button>
        <h3>道具說明</h3>
        <ul id="powerup-modal-list">
          <li>
            <span class="pm-icon">🔨</span>
            <span class="pm-body">
              <strong>Hammer</strong> — 點選任一格直接刪除
              <small>每 2 局隨機獲得</small>
            </span>
          </li>
          <li>
            <span class="pm-icon">🔀</span>
            <span class="pm-body">
              <strong>Shuffle</strong> — 隨機重排全盤數字
              <small>每 2 局隨機獲得</small>
            </span>
          </li>
          <li>
            <span class="pm-icon">➕</span>
            <span class="pm-body">
              <strong>Add One</strong> — 點選格子 +1（9 直接消除，得 10 分）
              <small>每 3 局獲得</small>
            </span>
          </li>
          <li>
            <span class="pm-icon">💣</span>
            <span class="pm-body">
              <strong>Bomb</strong> — 點選清除該格及上下左右共 5 格
              <small>每累計消除 30 對獲得一顆</small>
            </span>
          </li>
        </ul>
      </div>
    </div>
```

- [x] **Step 7: Run the failing E2E tests**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Fix-Viewport|Fix-Modal"
```

Expected: viewport and modal-visible tests PASS; the overlay-close test likely still fails (no JS yet).

- [x] **Step 8: Commit**

```bash
git add workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: fix mobile viewport height (100dvh) and add powerup description modal HTML/CSS"
```

---

## Task 5: Modal JS + update `POWERUP_UNLOCK_TIPS`

**Files:**
- Modify: `workspace/src/game.ts`

- [x] **Step 1: Add modal element refs to `workspace/src/game.ts`**

After the line `const hudMuteEl = document.getElementById("hud-mute") as HTMLButtonElement;` (around line 56), add:

```typescript
const hudPowerupInfoEl = document.getElementById("hud-powerup-info") as HTMLButtonElement;
const powerupModalEl = document.getElementById("powerup-modal") as HTMLDivElement;
const powerupModalOverlayEl = document.getElementById("powerup-modal-overlay") as HTMLDivElement;
const powerupModalCloseEl = document.getElementById("powerup-modal-close") as HTMLButtonElement;
```

- [x] **Step 2: Add modal open/close event listeners**

After `hudMuteEl.addEventListener(...)` (after line 66), add:

```typescript
hudPowerupInfoEl.addEventListener("click", () => {
  powerupModalEl.removeAttribute("hidden");
});
powerupModalOverlayEl.addEventListener("click", () => {
  powerupModalEl.setAttribute("hidden", "");
});
powerupModalCloseEl.addEventListener("click", () => {
  powerupModalEl.setAttribute("hidden", "");
});
```

- [x] **Step 3: Update `POWERUP_UNLOCK_TIPS`**

Find (around line 95–100):
```typescript
const POWERUP_UNLOCK_TIPS: Record<PowerupId, string> = {
  hammer:  "每玩 5 局隨機獲得",
  shuffle: "每玩 5 局隨機獲得",
  addOne:  "每玩 10 局獲得",
  bomb:    "分數突破 50 分獲得；每過 100 分再得一顆",
};
```

Replace with:
```typescript
const POWERUP_UNLOCK_TIPS: Record<PowerupId, string> = {
  hammer:  "每 2 局隨機獲得",
  shuffle: "每 2 局隨機獲得",
  addOne:  "每 3 局獲得",
  bomb:    "每累計消除 30 對獲得一顆",
};
```

- [x] **Step 4: Run TypeScript check**

```bash
cd workspace && npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 5: Run all E2E tests**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all PASS (including `Fix-Modal: clicking overlay closes modal`).

- [x] **Step 6: Run full suite (unit + all E2E)**

```bash
cd workspace && npm run test:unit && npm run test:e2e
```

Expected: all PASS.

- [x] **Step 7: Commit**

```bash
git add workspace/src/game.ts
git commit -m "feat: add powerup modal JS, update unlock tips text"
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
cd workspace && npm run build
```

Expected: build succeeds, no TypeScript errors.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| `min-height: 100dvh` on `body` | Task 4 |
| ❓ button in `#hud` as flex item | Task 4 |
| Modal with all 4 powerup descriptions | Task 4 |
| Modal closes on overlay click and ✕ | Task 5 |
| Add One on 9 eliminates tile, scores +10 | Task 2 |
| `computePlayCountAward` every 2 for HS, every 3 for addOne | Task 1 |
| `computeEliminationAward` every 30 pairs → 1 bomb | Task 1 |
| Lifetime elim counter in localStorage | Task 3 |
| Bomb awarded in-game on crossing 30-multiple | Task 3 |
| `computeBestScoreAward` removed | Task 3 |
| `POWERUP_UNLOCK_TIPS` updated to new conditions | Task 5 |
