import { test, expect } from "@playwright/test";
import type { GameState } from "../../src/grid";

test("clicking the palette toggle cycles through palettes and persists the choice across reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("mathMerge10Palette"));
  await page.reload();

  const getPalette = () =>
    page.evaluate(
      () => (window as unknown as { __getCurrentPalette: () => string }).__getCurrentPalette()
    );

  expect(await getPalette()).toBe("pairHint");

  await page.click("#palette-toggle");
  expect(await getPalette()).toBe("gradient");

  await page.click("#palette-toggle");
  expect(await getPalette()).toBe("pastel");

  await page.reload();
  expect(await getPalette()).toBe("pastel");
});

test("a merge move shows a '+N' score popup that fades out", async ({ page }) => {
  await page.goto("/");

  const mergeState: GameState = {
    grid: [
      [4, 6, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState, rng: () => number) => void }).__setTestState(
      state,
      () => 0
    );
  }, mergeState);

  await page.keyboard.press("ArrowLeft");

  const popup = page.locator("#score-popup");
  await expect(popup).toHaveText("+10");
  await expect(popup).toHaveClass(/animate/);
  await expect(popup).toHaveCSS("opacity", "0", { timeout: 2000 });
});

test("game over shows score/best and a new-record badge; Play Again resets the board", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("mathMerge10BestScore"));
  await page.reload();

  const gameOverState: GameState = {
    grid: [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 1],
    ],
    score: 50,
  };

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState) => void }).__setTestState(state);
  }, gameOverState);

  await expect(page.locator("#game-over")).toBeVisible();
  await expect(page.locator("#game-over-score")).toHaveText("本次分數：50");
  await expect(page.locator("#game-over-best")).toHaveText("最高分：50");
  await expect(page.locator("#game-over-badge")).toBeVisible();

  await page.click("#play-again");

  await expect(page.locator("#game-over")).toBeHidden();

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );
  expect(result.score).toBe(0);
  const filled = result.grid.flat().filter((cell) => cell !== null);
  expect(filled).toHaveLength(2);
});
