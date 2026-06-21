import { test, expect } from "@playwright/test";
import type { GameState } from "../../src/grid";

test("renders the initial board with two tiles and score 0", async ({ page }) => {
  await page.goto("/");

  const state = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(state.score).toBe(0);
  expect(state.grid).toHaveLength(4);
  const filled = state.grid.flat().filter((cell) => cell !== null);
  expect(filled).toHaveLength(2);
});

test("pressing ArrowLeft merges adjacent tiles summing to 10, increases score, and spawns a new tile", async ({ page }) => {
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
  await page.waitForTimeout(1500); // spawn is deferred until after elimination animation

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result.score).toBe(10);
  expect(result.grid[0][0]).toBe(1);
  expect(result.grid[0][1]).toBeNull();
});

test("pressing a slide key resolves a chain reaction in a single move (e.g. [4,6,4,6] all merge for 20 points)", async ({ page }) => {
  await page.goto("/");

  const chainState: GameState = {
    grid: [
      [4, 6, 4, 6],
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
  }, chainState);

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(2500); // spawn is deferred; 2 groups × 600ms HF = 1500ms total + buffer

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result.score).toBe(40); // 2 pairs × base 20pts × combo multiplier 2 = 40
  expect(result.grid[0]).toEqual([1, null, null, null]);
});

test("an invalid slide (one that does not change the board) leaves the GameGrid state unchanged", async ({ page }) => {
  await page.goto("/");

  const unchangedState: GameState = {
    grid: [
      [null, null, 4, 7],
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
  }, unchangedState);

  await page.keyboard.press("ArrowRight");

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result).toEqual(unchangedState);
});

test("persists the best score to localStorage under mathMerge10BestScore and never lowers it on a new game", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("mathMerge10BestScore"));
  await page.reload();

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

  const bestAfterFirstGame = await page.evaluate(() =>
    localStorage.getItem("mathMerge10BestScore")
  );
  expect(bestAfterFirstGame).toBe("10");

  // Simulate a higher best score recorded in an earlier session.
  await page.evaluate(() => localStorage.setItem("mathMerge10BestScore", "100"));
  await page.reload();

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState, rng: () => number) => void }).__setTestState(
      state,
      () => 0
    );
  }, mergeState);

  await page.keyboard.press("ArrowLeft");

  const bestAfterSecondGame = await page.evaluate(() =>
    localStorage.getItem("mathMerge10BestScore")
  );
  expect(bestAfterSecondGame).toBe("100");
});

test("shows the Game Over overlay when no moves remain", async ({ page }) => {
  await page.goto("/");

  const gameOverState: GameState = {
    grid: [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 1],
    ],
    score: 0,
  };

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState) => void }).__setTestState(state);
  }, gameOverState);

  await expect(page.locator("#game-over")).toBeVisible();
});
