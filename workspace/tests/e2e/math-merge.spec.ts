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
