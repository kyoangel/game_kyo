# Mobile UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three mobile UX bugs: pull-to-refresh blocking downward swipe, palette toggle misplaced on canvas, and powerup slots invisible until unlocked.

**Architecture:** All changes are in `workspace/index.html` (CSS + HTML structure) and `workspace/src/game.ts` (`renderHudPowerups` rewrite). No new files. Tests go in the existing `workspace/tests/e2e/ux-v2.spec.ts`.

**Tech Stack:** TypeScript, Vite, CSS, Playwright (E2E)

---

## File Structure

| File | Change |
|------|--------|
| `workspace/index.html` | Add `overscroll-behavior: none`; move `#hud-palette-toggle` into `#hud`; fix its CSS; add tooltip CSS + locked-state CSS |
| `workspace/src/game.ts` | Replace `renderHudPowerups()`; add `POWERUP_UNLOCK_TIPS`; add global dismiss listener |
| `workspace/tests/e2e/ux-v2.spec.ts` | Add 4 new tests covering all three fixes |

---

## Task 1: Fix pull-to-refresh (`overscroll-behavior: none`)

**Files:**
- Modify: `workspace/index.html` (CSS `<style>` block)
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("Fix1: html and body have overscroll-behavior none to prevent pull-to-refresh", async ({ page }) => {
  await page.goto("/");
  const htmlOverscroll = await page.evaluate(
    () => getComputedStyle(document.documentElement).overscrollBehavior,
  );
  const bodyOverscroll = await page.evaluate(
    () => getComputedStyle(document.body).overscrollBehavior,
  );
  expect(htmlOverscroll).toBe("none");
  expect(bodyOverscroll).toBe("none");
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "overscroll"
```

Expected: FAIL — `expect(received).toBe("none")` — value is `"auto"` or `""`

- [ ] **Step 3: Add CSS to `workspace/index.html`**

In the `<style>` block, add the following immediately before the existing `body {` rule (line 10):

```css
html, body {
  overscroll-behavior: none;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "overscroll"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "fix: prevent pull-to-refresh on mobile with overscroll-behavior none"
```

---

## Task 2: Move palette toggle into HUD

**Files:**
- Modify: `workspace/index.html` (HTML structure + CSS)
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("Fix2: palette toggle is inside #hud, not overlaid on canvas", async ({ page }) => {
  await page.goto("/");

  // Must be a descendant of #hud
  const insideHud = await page.evaluate(() => {
    const btn = document.getElementById("hud-palette-toggle")!;
    const hud = document.getElementById("hud")!;
    return hud.contains(btn);
  });
  expect(insideHud).toBe(true);

  // Must NOT be absolutely positioned (would indicate it's still floating on canvas)
  const position = await page.evaluate(
    () => getComputedStyle(document.getElementById("hud-palette-toggle")!).position,
  );
  expect(position).toBe("static");
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "palette toggle is inside"
```

Expected: FAIL — `insideHud` is `false` (button is inside `#game-container`, not `#hud`)

- [ ] **Step 3: Move the button in `index.html`**

**Remove** the button from inside `#game-container`. Currently at line 215:
```html
      <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
```
Delete this line.

**Add** the button inside `#hud`, between `#hud-powerups` and `#hud-mute`. The `#hud` block (currently lines 228–234) should become:

```html
    <div id="hud">
      <span id="hud-score">Score: 0</span>
      <span id="hud-best">Best: 0</span>
      <div id="hud-powerups"></div>
      <button id="hud-palette-toggle" aria-label="切換配色">🎨</button>
      <button id="hud-mute" aria-label="靜音">🔊</button>
    </div>
```

- [ ] **Step 4: Fix the CSS in `index.html`**

Replace the current `#hud-palette-toggle` rule (lines 62–75):

```css
#hud-palette-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  z-index: 10;
}
```

With this (merged with `#hud-mute` since they share style):

```css
#hud-palette-toggle,
#hud-mute {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
}
```

Note: the existing separate `#hud-mute` rule (lines 51–61) must also be removed since both buttons now share the combined rule above.

- [ ] **Step 5: Run all E2E tests**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all tests PASS (including the existing F1 test which already checks `#hud-palette-toggle` is visible — it will still pass since the button is still in the DOM)

- [ ] **Step 6: Commit**

```bash
git add workspace/index.html workspace/tests/e2e/ux-v2.spec.ts
git commit -m "fix: move palette toggle from canvas overlay into HUD flex bar"
```

---

## Task 3: Locked powerup slots with tooltip

**Files:**
- Modify: `workspace/index.html` (add CSS for locked state + tooltip)
- Modify: `workspace/src/game.ts` (replace `renderHudPowerups`, add `POWERUP_UNLOCK_TIPS`, add global dismiss listener)
- Modify: `workspace/tests/e2e/ux-v2.spec.ts`

- [ ] **Step 1: Write failing E2E tests**

Append to `workspace/tests/e2e/ux-v2.spec.ts`:

```typescript
test("Fix3: all 4 powerup slots are always visible, locked slots show lock badge", async ({ page }) => {
  await page.goto("/");
  // Ensure 0 powerups
  await page.evaluate(() => {
    (window as unknown as { __setPowerups: (p: unknown) => void }).__setPowerups(
      { hammer: 0, shuffle: 0, addOne: 0, bomb: 0 },
    );
  });

  const slots = page.locator(".hud-powerup-btn");
  await expect(slots).toHaveCount(4);

  // All locked
  for (const slot of await slots.all()) {
    expect(await slot.getAttribute("data-locked")).toBe("true");
  }
});

test("Fix3: clicking a locked powerup shows its tooltip, clicking outside dismisses it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { __setPowerups: (p: unknown) => void }).__setPowerups(
      { hammer: 0, shuffle: 0, addOne: 0, bomb: 0 },
    );
  });

  const hammerBtn = page.locator(".hud-powerup-btn[data-powerup='hammer']");
  const tooltip = hammerBtn.locator(".powerup-tooltip");

  // Tooltip hidden initially
  await expect(tooltip).toBeHidden();

  // Click locked button → tooltip appears
  await hammerBtn.click();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("每玩 5 局");

  // Click outside → tooltip hidden
  await page.locator("canvas#game").click({ position: { x: 10, y: 10 } });
  await expect(tooltip).toBeHidden();
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd workspace && npx playwright test tests/e2e/ux-v2.spec.ts --grep "Fix3"
```

Expected: FAIL — `expect(slots).toHaveCount(4)` fails (currently 0 slots when powerups are 0)

- [ ] **Step 3: Add CSS to `workspace/index.html`**

Inside the `<style>` block, after the `.hud-powerup-count` rule (around line 104), add:

```css
.hud-powerup-btn[data-locked="true"] {
  opacity: 0.4;
  cursor: pointer;
}
.powerup-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: #e5e7eb;
  font-size: 11px;
  white-space: nowrap;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #374151;
  pointer-events: none;
  z-index: 50;
}
.hud-powerup-btn[data-tooltip-open="true"] .powerup-tooltip {
  display: block;
}
```

- [ ] **Step 4: Replace `renderHudPowerups` in `workspace/src/game.ts`**

Find the existing `renderHudPowerups` function (starts around line 95). Replace the entire function, and add the `POWERUP_UNLOCK_TIPS` constant immediately before it:

```typescript
const POWERUP_UNLOCK_TIPS: Record<PowerupId, string> = {
  hammer:  "每玩 5 局隨機獲得",
  shuffle: "每玩 5 局隨機獲得",
  addOne:  "每玩 10 局獲得",
  bomb:    "分數突破 50 分獲得；每過 100 分再得一顆",
};

function renderHudPowerups(): void {
  const container = document.getElementById("hud-powerups")!;
  container.innerHTML = "";
  const defs: Array<{ id: PowerupId; icon: string }> = [
    { id: "hammer",  icon: "🔨" },
    { id: "shuffle", icon: "🔀" },
    { id: "addOne",  icon: "➕" },
    { id: "bomb",    icon: "💣" },
  ];

  defs.forEach(({ id, icon }) => {
    const count = powerups[id];
    const locked = count === 0;
    const btn = document.createElement("button");
    btn.className = "hud-powerup-btn";
    btn.dataset.powerup = id;
    btn.dataset.locked = String(locked);
    btn.dataset.active = String(activePowerup === id);

    const badge = locked
      ? `<span class="hud-powerup-count">🔒</span>`
      : `<span class="hud-powerup-count">${count}</span>`;
    const tooltip = locked
      ? `<span class="powerup-tooltip">${POWERUP_UNLOCK_TIPS[id]}</span>`
      : "";

    btn.innerHTML = `${icon}${badge}${tooltip}`;

    btn.addEventListener("click", (e) => {
      if (locked) {
        e.stopPropagation();
        const isOpen = btn.dataset.tooltipOpen === "true";
        container.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
          (el) => { delete el.dataset.tooltipOpen; },
        );
        if (!isOpen) btn.dataset.tooltipOpen = "true";
        return;
      }
      activePowerup = activePowerup === id ? null : id;
      canvas.style.outline = activePowerup ? "3px solid #f59e0b" : "";
      renderHudPowerups();
    });

    container.appendChild(btn);
  });
}
```

- [ ] **Step 5: Add global dismiss listener to `workspace/src/game.ts`**

Find where the module-level event listeners are set up (around the `paletteToggleEl.addEventListener` block, line 637). Add this **once** at module level, after `renderHudPowerups` is defined:

```typescript
document.addEventListener("click", () => {
  document.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
    (el) => { delete el.dataset.tooltipOpen; },
  );
});
```

- [ ] **Step 6: Run all tests**

```bash
cd workspace && npm run test:unit && npx playwright test tests/e2e/ux-v2.spec.ts
```

Expected: all unit tests PASS, all E2E tests PASS

- [ ] **Step 7: Run full E2E suite to check for regressions**

```bash
cd workspace && npm run test:e2e
```

Expected: all 33 E2E tests PASS (31 existing + 2 new Fix3 tests)

- [ ] **Step 8: Commit**

```bash
git add workspace/index.html workspace/src/game.ts workspace/tests/e2e/ux-v2.spec.ts
git commit -m "feat: show all powerup slots always; locked state with unlock tooltip"
```

---

## Final Verification

- [ ] **Full test suite**

```bash
cd workspace && npm run test:unit && npm run test:e2e
```

Expected: all tests PASS

- [ ] **Build check**

```bash
cd workspace && npm run build
```

Expected: build succeeds, no TypeScript errors

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| `overscroll-behavior: none` on `html, body` | Task 1 |
| Palette toggle inside `#hud` | Task 2 |
| Palette toggle not `position: absolute` | Task 2 |
| All 4 powerup slots always rendered | Task 3 |
| Locked state: `data-locked="true"`, 0.4 opacity, 🔒 badge | Task 3 |
| Tooltip appears on locked click | Task 3 |
| Tooltip shows correct unlock text per powerup | Task 3 |
| Global dismiss on outside click | Task 3 |
| Unlocked powerup still activates normally | Covered by existing `__setPowerups` hammer test |
