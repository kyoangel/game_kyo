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

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result.score).toBe(10);
  expect(result.grid[0][0]).toBe(1);
  expect(result.grid[0][1]).toBeNull();
});
