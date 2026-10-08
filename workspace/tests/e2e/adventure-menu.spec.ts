import { test, expect } from "@playwright/test";
import type { GameState } from "../../src/grid";
import { NO_DEBUG_START, getRun, pickOffer, startAdventure } from "./adventureHelpers";

test.use(NO_DEBUG_START);

type EndlessWindow = {
  __getGameState: () => GameState;
  __setTestState: (s: GameState, rng?: () => number) => void;
};

const mergeable: GameState = {
  grid: [
    [4, 6, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ],
  score: 0,
};

test("a fresh launch shows the start menu with 冒險, 修練 and 冒險獎盃 and no 繼續冒險", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-adventure")).toContainText("冒險");
  await expect(page.locator("#mode-endless")).toContainText("修練");
  await expect(page.locator("#mode-trophies")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "menu");
  await expect(page.locator("#game")).toBeHidden();
  await expect(page.locator("#adv-screen")).toBeHidden();
});

test("修練 opens the unchanged endless game, and 🏠 returns to the menu", async ({ page }) => {
  await page.goto("./");
  await page.locator("#mode-endless").click();
  await expect(page.locator("#mode-menu")).toBeHidden();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator("#endless-home")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "endless");

  await page.evaluate((s) => (window as unknown as EndlessWindow).__setTestState(s, () => 0), mergeable);
  await page.keyboard.press("ArrowLeft");
  const state = await page.evaluate(() => (window as unknown as EndlessWindow).__getGameState());
  expect(state.score).toBe(10);

  await page.locator("#endless-home").click();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#game")).toBeHidden();
});

test("arrow keys do nothing to the endless board while the menu is showing", async ({ page }) => {
  await page.goto("./");
  await page.evaluate((s) => (window as unknown as EndlessWindow).__setTestState(s, () => 0), mergeable);
  await page.keyboard.press("ArrowLeft");
  const state = await page.evaluate(() => (window as unknown as EndlessWindow).__getGameState());
  expect(state).toEqual(mergeable);
});

test("冒險 opens the opening relic pick, then the first battle against the slime", async ({ page }) => {
  await startAdventure(page, 1);
  await expect(page.locator("body")).toHaveAttribute("data-screen", "adventure");
  await expect(page.locator("#adv-screen")).toBeVisible();
  await expect(page.locator("#game")).toBeHidden();
  await expect(page.locator("#adv-offers-title")).toHaveText("選擇一個起始遺物");
  await expect(page.locator(".adv-offer")).toHaveCount(3);

  await pickOffer(page, 0);
  await expect(page.locator("#adv-screen")).toHaveAttribute("data-phase", "battle");
  await expect(page.locator("#adv-enemy-name")).toHaveText("圓史萊姆");
  await expect(page.locator("#adv-enemy-hptext")).toHaveText("40/40");
  await expect(page.locator("#adv-hp")).toContainText("10/10");
  await expect(page.locator("#adv-intent")).toContainText("攻擊");
  await expect(page.locator(".adv-pip")).toHaveCount(9);
  await expect(page.locator(".adv-relic")).toHaveCount(1);
  await expect(page.locator(".adv-spell")).toHaveCount(4);
});

test("keys pressed on the adventure screen do not move the hidden endless board", async ({ page }) => {
  await startAdventure(page, 1);
  await pickOffer(page, 0);
  await page.evaluate((s) => (window as unknown as EndlessWindow).__setTestState(s, () => 0), mergeable);
  await page.keyboard.press("ArrowLeft");
  const state = await page.evaluate(() => (window as unknown as EndlessWindow).__getGameState());
  expect(state).toEqual(mergeable);
});

test("🏠 from a battle goes to the menu, which then offers 繼續冒險; continuing restores the exact run", async ({ page }) => {
  await startAdventure(page, 2);
  await pickOffer(page, 0);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1500);
  const before = await getRun(page);

  await page.locator("#adv-home").click();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeVisible();
  await expect(page.locator("#mode-continue-info")).toContainText("第 1/9 場");

  await page.reload();
  await expect(page.locator("#mode-continue")).toBeVisible(); // survives a page reload
  await page.locator("#mode-continue").click();
  await expect(page.locator("#adv-screen")).toBeVisible();
  expect(await getRun(page)).toEqual(before);
});

test("a corrupt save is discarded: no 繼續冒險, no crash, and the key is cleaned up", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.evaluate(() => localStorage.setItem("mathMerge10AdventureRun", '{"version":1,"run":{"phase":"battle"}}'));
  await page.reload();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10AdventureRun"))).toBeNull();
  await page.evaluate(() => localStorage.setItem("mathMerge10AdventureRun", "not json at all"));
  await page.reload();
  await expect(page.locator("#mode-continue")).toBeHidden();
  expect(errors).toEqual([]);
});

test("the trophies button lists the six adventure trophies, all locked at first", async ({ page }) => {
  await page.goto("./");
  await page.locator("#mode-trophies").click();
  await expect(page.locator("#adv-trophy-modal")).toBeVisible();
  await expect(page.locator("#adv-trophy-list li")).toHaveCount(6);
  await expect(page.locator('#adv-trophy-list li[data-unlocked="true"]')).toHaveCount(0);
  await expect(page.locator("#adv-trophy-list")).toContainText("擊敗三角樹王");
  await page.locator("#adv-trophy-close").click();
  await expect(page.locator("#adv-trophy-modal")).toBeHidden();
});

test("a fresh window never leaks the dev start key: the menu is the product default", async ({ page }) => {
  await page.goto("./");
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10DebugStart"))).toBeNull();
});
