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
