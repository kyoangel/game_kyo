import { test, expect } from "@playwright/test";

test("F1: #hud footer contains score, best, palette toggle, and mute button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#hud-score")).toBeVisible();
  await expect(page.locator("#hud-best")).toBeVisible();
  await expect(page.locator("#hud-palette-toggle")).toBeVisible();
  await expect(page.locator("#hud-mute")).toBeVisible();
});

test("F6: canvas width shrinks to fit a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await page.waitForTimeout(300);

  const canvasWidth = await page.evaluate(
    () => (document.getElementById("game") as HTMLCanvasElement).width,
  );
  expect(canvasWidth).toBeLessThan(360);
  expect(canvasWidth).toBeGreaterThan(280);
});

test("F6: touch swipe left eliminates a 4+6 pair and scores 10", async ({ page }) => {
  await page.goto("/");

  const touchState = {
    grid: [
      [null, null, 4, 6],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate(
    (s) => (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s),
    touchState,
  );

  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");

  const startX = box.x + box.width * 0.75;
  const endX = box.x + box.width * 0.25;
  const midY = box.y + box.height * 0.5;

  await page.evaluate(
    ({ sx, ex, y }) => {
      const el = document.getElementById("game")!;
      el.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [new Touch({ identifier: 1, target: el, clientX: sx, clientY: y })],
          bubbles: true,
          cancelable: true,
        }),
      );
      el.dispatchEvent(
        new TouchEvent("touchend", {
          changedTouches: [new Touch({ identifier: 1, target: el, clientX: ex, clientY: y })],
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { sx: startX, ex: endX, y: midY },
  );

  await page.waitForTimeout(100);
  const state = await page.evaluate(
    () =>
      (
        window as unknown as { __getGameState: () => { score: number } }
      ).__getGameState(),
  );
  expect(state.score).toBe(10);
});

test("F3: mute button toggles between 🔊 and 🔇", async ({ page }) => {
  await page.goto("/");
  const muteBtn = page.locator("#hud-mute");
  await expect(muteBtn).toHaveText("🔊");
  await muteBtn.click();
  await expect(muteBtn).toHaveText("🔇");
  await muteBtn.click();
  await expect(muteBtn).toHaveText("🔊");
});

test("F4: collision animation — eliminated pair records meetA/meetB collision positions", async ({
  page,
}) => {
  await page.goto("/");

  // Non-adjacent pair: 3 at col1, 7 at col3. After left slide they meet at col0 + col1.
  const animState = {
    grid: [
      [null, 3, null, 7],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate(
    (s) => (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s),
    animState,
  );

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(50);

  const hints = await page.evaluate(
    () =>
      (
        window as unknown as {
          __lastAnimationHints: {
            eliminatedPairs: Array<{ meetA: { col: number }; meetB: { col: number } }>;
          };
        }
      ).__lastAnimationHints,
  );

  expect(hints.eliminatedPairs[0].meetA.col).toBe(0);
  expect(hints.eliminatedPairs[0].meetB.col).toBe(1);
});

test("F5: hammer powerup removes a tile when activated and clicked on canvas", async ({ page }) => {
  await page.goto("/");

  const hammerState = {
    grid: [
      [5, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate((s) => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s);
    (window as unknown as { __setPowerups: (p: unknown) => void }).__setPowerups({
      hammer: 1, shuffle: 0, addOne: 0, bomb: 0,
    });
  }, hammerState);

  await page.locator(".hud-powerup-btn[data-powerup='hammer']").click();

  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("No canvas");
  const cellSize = box.width / 4;
  await page.mouse.click(box.x + cellSize * 0.5, box.y + cellSize * 0.5);

  const state = await page.evaluate(
    () => (window as unknown as { __getGameState: () => { grid: (number | null)[][] } }).__getGameState(),
  );
  expect(state.grid[0][0]).toBeNull();
});

test("F1: score and best are shown in #hud DOM elements after a move", async ({ page }) => {
  await page.goto("/");

  const mergeState = {
    grid: [
      [4, 6, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };
  await page.evaluate(
    (s) => (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s),
    mergeState,
  );

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);

  const scoreText = await page.locator("#hud-score").textContent();
  expect(scoreText).toContain("10");
  const bestText = await page.locator("#hud-best").textContent();
  expect(bestText).toContain("10");
});

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
  await expect(tooltip).toContainText("每 2 局隨機獲得");

  // Click outside → tooltip hidden
  await page.locator("canvas#game").click({ position: { x: 10, y: 10 } });
  await expect(tooltip).toBeHidden();
});

test("Fix-AddOne: Add One on a 9-tile eliminates it and scores +10", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(100);

  const addOneState = {
    grid: [
      [9, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };

  // Set up board with a 9 in top-left, 1 addOne powerup, score 0
  await page.evaluate((s) => {
    (window as unknown as { __setTestState: (s: unknown) => void }).__setTestState(s);
    (window as unknown as { __setPowerups: (p: unknown) => void }).__setPowerups(
      { hammer: 0, shuffle: 0, addOne: 1, bomb: 0 },
    );
  }, addOneState);

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

test("Trophy: 🏆 button is visible in HUD", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud-trophy")).toBeVisible();
});

test("Trophy: clicking 🏆 opens modal with trophy names from all 5 categories", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hud-trophy").click();
  await expect(page.locator("#trophy-modal")).toBeVisible();
  // Spot-check one trophy from each category (numbers, combos, scores, play, special)
  for (const name of [
    "一的洪流",    // numbers
    "連鎖初學",   // combos
    "百分首達",   // scores
    "新手冒險",   // play
    "空手而歸",   // special
  ]) {
    await expect(page.locator("#trophy-modal")).toContainText(name);
  }
});

test("trophy modal: shows 5 category headers", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.click("#hud-trophy");
  await expect(page.locator("#trophy-modal")).toBeVisible();

  const headers = page.locator(".tm-category-header");
  await expect(headers).toHaveCount(5);
  await expect(headers.first()).toHaveText("數字系列");
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
  // Pre-seed stats so that combo2Count is already 2 (threshold is 3)
  await page.evaluate(() => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ combo2Count: 2 }));
  });
  // Grid with 2 pairs (row 0: 1+9, row 1: 1+9) — ArrowLeft eliminates both (combo-2)
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
  // Pre-seed stats so that combo2Count is already 2 (threshold is 3), then do one more combo-2
  await page.evaluate(() => {
    localStorage.setItem("mathMerge10Stats", JSON.stringify({ combo2Count: 2 }));
  });
  // Unlock 連鎖初學 by reaching combo2Count=3
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
