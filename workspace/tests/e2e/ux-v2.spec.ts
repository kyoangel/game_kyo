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
  await expect(tooltip).toContainText("每玩 5 局");

  // Click outside → tooltip hidden
  await page.locator("canvas#game").click({ position: { x: 10, y: 10 } });
  await expect(tooltip).toBeHidden();
});
