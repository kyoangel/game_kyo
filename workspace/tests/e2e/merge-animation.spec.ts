import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

test("elimination triggers eliminatedPairs hint", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState({
      grid: [
        [9, 1, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    }, () => 0);
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(1);
  expect(hints.eliminatedPairs[0].a).toEqual({ row: 0, col: 0 });
  expect(hints.eliminatedPairs[0].b).toEqual({ row: 0, col: 1 });
  expect(hints.comboCount).toBe(1);
});

test("two simultaneous eliminations produce comboCount 2", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState({
      grid: [
        [9, 1, 5, 5],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    }, () => 0);
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(2);
  expect(hints.comboCount).toBe(2);
});

test("no elimination produces empty eliminatedPairs with spawn and moved hints", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__setTestState({
      grid: [
        [null, 1, 2, 3],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      score: 0,
    }, () => 0);
  });
  await page.keyboard.press("ArrowLeft");
  const hints = await page.evaluate(() => (window as any).__lastAnimationHints);
  expect(hints.eliminatedPairs).toHaveLength(0);
  expect(hints.spawnedCell).not.toBeNull();
  expect(hints.movedCells.length).toBeGreaterThan(0);
});
