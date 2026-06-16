import { test, expect } from "@playwright/test";

test("F1: #hud footer contains score, best, palette toggle, and mute button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#hud-score")).toBeVisible();
  await expect(page.locator("#hud-best")).toBeVisible();
  await expect(page.locator("#hud-palette-toggle")).toBeVisible();
  await expect(page.locator("#hud-mute")).toBeVisible();
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
