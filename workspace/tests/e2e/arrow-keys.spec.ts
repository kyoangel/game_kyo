import { test, expect } from "@playwright/test";
import type { GameState } from "../../src/grid";

// Spec: "方向鍵（↑↓←→）…對應上/下/左/右滑動"
// Existing E2E suites cover ArrowLeft and ArrowRight but never ArrowUp or
// ArrowDown. These tests fill that gap.

test("ArrowUp merges an adjacent column pair summing to 10 and increases score", async ({
  page,
}) => {
  await page.goto("/");

  const state: GameState = {
    grid: [
      [4, null, null, null],
      [6, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 0,
  };

  await page.evaluate(
    (s) =>
      (
        window as unknown as {
          __setTestState: (s: GameState, rng: () => number) => void;
        }
      ).__setTestState(s, () => 0),
    state,
  );

  await page.keyboard.press("ArrowUp");

  const result = await page.evaluate(
    () =>
      (
        window as unknown as { __getGameState: () => GameState }
      ).__getGameState(),
  );

  expect(result.score).toBe(10);
  // 4+6 merge removes 2 tiles, spawn adds 1 → net 1 tile remains
  const tiles = result.grid.flat().filter((c) => c !== null);
  expect(tiles).toHaveLength(1);
});

test("ArrowUp merges a non-adjacent column pair (tiles separated by nulls) and increases score", async ({
  page,
}) => {
  await page.goto("/");

  const state: GameState = {
    grid: [
      [3, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [7, null, null, null],
    ],
    score: 0,
  };

  await page.evaluate(
    (s) =>
      (
        window as unknown as {
          __setTestState: (s: GameState, rng: () => number) => void;
        }
      ).__setTestState(s, () => 0),
    state,
  );

  await page.keyboard.press("ArrowUp");

  const result = await page.evaluate(
    () =>
      (
        window as unknown as { __getGameState: () => GameState }
      ).__getGameState(),
  );

  expect(result.score).toBe(10);
  const tiles = result.grid.flat().filter((c) => c !== null);
  expect(tiles).toHaveLength(1);
});

test("ArrowDown merges an adjacent column pair summing to 10 and increases score", async ({
  page,
}) => {
  await page.goto("/");

  const state: GameState = {
    grid: [
      [null, null, null, null],
      [null, null, null, null],
      [4, null, null, null],
      [6, null, null, null],
    ],
    score: 0,
  };

  await page.evaluate(
    (s) =>
      (
        window as unknown as {
          __setTestState: (s: GameState, rng: () => number) => void;
        }
      ).__setTestState(s, () => 0),
    state,
  );

  await page.keyboard.press("ArrowDown");

  const result = await page.evaluate(
    () =>
      (
        window as unknown as { __getGameState: () => GameState }
      ).__getGameState(),
  );

  expect(result.score).toBe(10);
  expect(result.grid[2][0]).toBeNull();
  expect(result.grid[3][0]).toBeNull();
});

test("ArrowDown merges a non-adjacent column pair (tiles separated by nulls) and increases score", async ({
  page,
}) => {
  await page.goto("/");

  const state: GameState = {
    grid: [
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [8, null, null, null],
    ],
    score: 0,
  };

  await page.evaluate(
    (s) =>
      (
        window as unknown as {
          __setTestState: (s: GameState, rng: () => number) => void;
        }
      ).__setTestState(s, () => 0),
    state,
  );

  await page.keyboard.press("ArrowDown");

  const result = await page.evaluate(
    () =>
      (
        window as unknown as { __getGameState: () => GameState }
      ).__getGameState(),
  );

  expect(result.score).toBe(10);
  const tiles = result.grid.flat().filter((c) => c !== null);
  expect(tiles).toHaveLength(1);
});

test("ArrowUp on an already-top-compacted board leaves state unchanged (invalid move)", async ({
  page,
}) => {
  await page.goto("/");

  const frozenState: GameState = {
    grid: [
      [1, 2, 3, 4],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    score: 15,
  };

  await page.evaluate(
    (s) =>
      (
        window as unknown as {
          __setTestState: (s: GameState, rng: () => number) => void;
        }
      ).__setTestState(s, () => 0),
    frozenState,
  );

  await page.keyboard.press("ArrowUp");

  const result = await page.evaluate(
    () =>
      (
        window as unknown as { __getGameState: () => GameState }
      ).__getGameState(),
  );

  expect(result).toEqual(frozenState);
});

test("ArrowDown on an already-bottom-compacted board leaves state unchanged (invalid move)", async ({
  page,
}) => {
  await page.goto("/");

  const frozenState: GameState = {
    grid: [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [1, 2, 3, 4],
    ],
    score: 15,
  };

  await page.evaluate(
    (s) =>
      (
        window as unknown as {
          __setTestState: (s: GameState, rng: () => number) => void;
        }
      ).__setTestState(s, () => 0),
    frozenState,
  );

  await page.keyboard.press("ArrowDown");

  const result = await page.evaluate(
    () =>
      (
        window as unknown as { __getGameState: () => GameState }
      ).__getGameState(),
  );

  expect(result).toEqual(frozenState);
});
