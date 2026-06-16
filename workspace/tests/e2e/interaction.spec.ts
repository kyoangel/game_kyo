import { test, expect } from "@playwright/test";
import type { GameState } from "../../src/grid";

// Verify WASD keys trigger moves (spec: "WASD 對應上/下/左/右滑動")
test("pressing A (left) merges adjacent tiles summing to 10 and increases score", async ({ page }) => {
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

  await page.keyboard.press("a");

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result.score).toBe(10);
});

test("pressing W (up) merges a column pair summing to 10 and increases score", async ({ page }) => {
  await page.goto("/");

  const columnMergeState: GameState = {
    grid: [
      [4, null, null, null],
      [6, null, null, null],
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
  }, columnMergeState);

  await page.keyboard.press("w");

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result.score).toBe(10);
});

test("pressing S (down) merges a column pair summing to 10 and increases score", async ({ page }) => {
  await page.goto("/");

  const columnMergeState: GameState = {
    grid: [
      [null, null, null, null],
      [null, null, null, null],
      [4, null, null, null],
      [6, null, null, null],
    ],
    score: 0,
  };

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState, rng: () => number) => void }).__setTestState(
      state,
      () => 0
    );
  }, columnMergeState);

  await page.keyboard.press("s");

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result.score).toBe(10);
});

test("pressing D (right) merges adjacent tiles summing to 10 and increases score", async ({ page }) => {
  await page.goto("/");

  const mergeState: GameState = {
    grid: [
      [null, null, 4, 6],
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

  await page.keyboard.press("d");

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result.score).toBe(10);
});

// Verify combo badge appears for 2+ simultaneous eliminations
test("two simultaneous eliminations set the combo badge text and add the animate class", async ({ page }) => {
  await page.goto("/");

  const comboState: GameState = {
    grid: [
      [9, 1, 5, 5],
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
  }, comboState);

  await page.keyboard.press("ArrowLeft");

  // __lastAnimationHints is set synchronously — verify comboCount first
  const hints = await page.evaluate(
    () => (window as unknown as { __lastAnimationHints: { comboCount: number } }).__lastAnimationHints
  );
  expect(hints.comboCount).toBe(2);

  // showComboBadge fires after 300 ms — wait for the animate class to appear
  await page.waitForFunction(
    () => document.getElementById("combo-badge")?.classList.contains("animate"),
    { timeout: 1000 }
  );

  const badgeText = await page.evaluate(
    () => document.getElementById("combo-badge")?.textContent
  );
  expect(badgeText).toBe("COMBO ×2");
});

// Invalid move — no WASD key should change state when no valid slide exists
test("pressing A (left) on an already-left-compacted board leaves state unchanged", async ({ page }) => {
  await page.goto("/");

  const frozenState: GameState = {
    grid: [
      [4, 7, null, null],
      [3, 8, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 42,
  };

  await page.evaluate((state) => {
    (window as unknown as { __setTestState: (s: GameState, rng: () => number) => void }).__setTestState(
      state,
      () => 0
    );
  }, frozenState);

  await page.keyboard.press("a");

  const result = await page.evaluate(
    () => (window as unknown as { __getGameState: () => GameState }).__getGameState()
  );

  expect(result).toEqual(frozenState);
});
