# HUD Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the HUD into two rows so the game never causes horizontal scroll on narrow mobile screens.

**Architecture:** Pure HTML/CSS change to `workspace/index.html` — wrap score spans in `#hud-scores`, wrap all buttons in `#hud-buttons`, update `#hud` flex direction to column. No JS changes needed because all element IDs are unchanged. One E2E test added first to drive the change.

**Tech Stack:** HTML, CSS, Playwright (E2E tests in `workspace/tests/e2e/ux-v2.spec.ts`)

---

### Task 1: Write failing E2E test for two-row HUD

**Files:**
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [ ] **Step 1: Append the new test**

Open `workspace/tests/e2e/ux-v2.spec.ts` and add this test at the end of the file (inside the existing `test.describe` block if one exists, or as a top-level `test`):

```typescript
test("HUD: renders in two rows without horizontal overflow at 390px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForSelector("canvas");

  // Two-row wrapper elements exist
  await expect(page.locator("#hud-scores")).toBeVisible();
  await expect(page.locator("#hud-buttons")).toBeVisible();

  // Score and best are inside the scores row
  await expect(page.locator("#hud-scores #hud-score")).toBeVisible();
  await expect(page.locator("#hud-scores #hud-best")).toBeVisible();

  // Buttons are inside the buttons row
  await expect(page.locator("#hud-buttons #hud-trophy")).toBeVisible();
  await expect(page.locator("#hud-buttons #hud-mute")).toBeVisible();

  // No horizontal overflow
  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyScrollWidth).toBeLessThanOrEqual(390);
});
```

- [ ] **Step 2: Run to confirm it FAILS**

```bash
cd /Users/kyo.lai82/Projects/Personal/game-factory/workspace
npm run test:e2e -- --grep "HUD: renders in two rows"
```

Expected: FAIL — `#hud-scores` locator not found (element doesn't exist yet).

---

### Task 2: Implement two-row HUD in index.html

**Files:**
- Modify: `workspace/index.html`

- [ ] **Step 1: Add `overflow-x: hidden` to the `html, body` rule**

In `workspace/index.html`, find:

```css
    html, body {
      overscroll-behavior: none;
    }
```

Replace with:

```css
    html, body {
      overscroll-behavior: none;
      overflow-x: hidden;
    }
```

- [ ] **Step 2: Replace the `#hud` CSS block**

Find this block (lines ~36–46):

```css
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
```

Replace with:

```css
    #hud {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      padding: 8px 12px;
      background: #1a1a2e;
      border-radius: 0 0 8px 8px;
      box-sizing: border-box;
      gap: 6px;
    }
    #hud-scores {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
    #hud-buttons {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 4px;
    }
```

- [ ] **Step 3: Restructure the HUD HTML**

Find the `<div id="hud">` block in the `<body>` (lines ~422–430):

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

Replace with:

```html
    <div id="hud">
      <div id="hud-scores">
        <span id="hud-score">Score: 0</span>
        <span id="hud-best">Best: 0</span>
      </div>
      <div id="hud-buttons">
        <div id="hud-powerups"></div>
        <button id="hud-powerup-info" aria-label="道具說明">❓</button>
        <button id="hud-trophy" aria-label="生涯獎盃">🏆</button>
        <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
        <button id="hud-mute" aria-label="靜音">🔊</button>
      </div>
    </div>
```

- [ ] **Step 4: Run the new E2E test to confirm it passes**

```bash
cd /Users/kyo.lai82/Projects/Personal/game-factory/workspace
npm run test:e2e -- --grep "HUD: renders in two rows"
```

Expected: PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm run test:unit && npm run test:e2e
```

Expected: all tests green.

- [ ] **Step 6: Commit**

```bash
git add workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: restructure HUD into two rows to fix mobile horizontal overflow"
```
