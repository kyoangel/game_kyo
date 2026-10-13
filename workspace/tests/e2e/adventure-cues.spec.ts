import { test, expect, type Page } from "@playwright/test";
import { STONE, type GameGrid } from "../../src/grid";
import { createBattle } from "../../src/adventure/battle";
import { STARTER_RELIC_IDS } from "../../src/adventure/relics";
import { chooseOffer, createRun, type RunState } from "../../src/adventure/run";
import { mulberry32 } from "../../src/adventure/rng";
import { NO_DEBUG_START, pickOffer, setRun, startAdventure, waitIdle } from "./adventureHelpers";

test.use({ ...NO_DEBUG_START, viewport: { width: 390, height: 844 } });

function runWith(enemyId: string, battleIndex: number): RunState {
  const rng = mulberry32(99);
  const base = chooseOffer(createRun(rng, STARTER_RELIC_IDS), 0, rng).run;
  const grid: GameGrid = Array.from({ length: 4 }, () => [null, null, null, null]);
  grid[0][0] = 5;
  const battle = { ...createBattle({ enemyId, heroHp: 10, heroMaxHp: 10 }, rng).state, grid, countdown: 1 };
  return { ...base, battleIndex, battle, heroHp: 10 };
}

async function fireOnce(page: Page, enemyId: string, battleIndex: number): Promise<void> {
  await startAdventure(page, 4);
  await pickOffer(page, 0);
  await setRun(page, runWith(enemyId, battleIndex));
  await page.keyboard.press("ArrowRight");
}

test("a rockfall shows a banner and highlights the new stones", async ({ page }) => {
  await fireOnce(page, "stoneGolem", 1);
  await expect(page.locator("#adv-cue")).toBeVisible();
  await expect(page.locator("#adv-cue")).toContainText("落石");
  await expect(page.locator("#adv-cue-cells .adv-cue-cell").first()).toBeVisible();
  await waitIdle(page);
});

test("a freeze shows a banner", async ({ page }) => {
  await fireOnce(page, "snowSprite", 3);
  await expect(page.locator("#adv-cue")).toBeVisible();
  await expect(page.locator("#adv-cue")).toContainText("冰凍");
});

test("the cue never blocks input", async ({ page }) => {
  await fireOnce(page, "stoneGolem", 1);
  await expect(page.locator("#adv-cue")).toBeVisible();
  await expect(page.locator("#adv-cue")).toHaveCSS("pointer-events", "none");
});

test("a stuck board with mana shows a persistent banner and suggests spells until unstuck", async ({ page }) => {
  await startAdventure(page, 4);
  await pickOffer(page, 0);
  const run = runWith("slime", 0);
  const grid: GameGrid = Array.from({ length: 4 }, () => [STONE, STONE, STONE, STONE]);
  await setRun(page, { ...run, battle: { ...run.battle!, grid, mana: 5, countdown: 4 } });
  await expect(page.locator("#adv-stuck")).toBeVisible();
  await expect(page.locator(".adv-spell.suggested").first()).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.locator("#adv-stuck")).toBeVisible(); // does not fade
  await page.locator('.adv-spell[data-spell="hammer"]').click();
  await page.locator("#adv-board").click({ position: { x: 20, y: 20 } });
  await waitIdle(page);
  await expect(page.locator("#adv-stuck")).toBeHidden();
  await expect(page.locator(".adv-spell.suggested")).toHaveCount(0);
});

type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test("the stale cue does not replay after going home and continuing", async ({ page }) => {
  await fireOnce(page, "stoneGolem", 1);
  await expect(page.locator("#adv-cue")).toBeVisible();
  await page.locator("#adv-home").click();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await page.locator("#mode-continue").click();
  await expect(page.locator("#adv-board")).toBeVisible();
  await expect(page.locator("#adv-cue")).toBeHidden();
  await expect(page.locator("#adv-cue")).not.toHaveClass(/animate/);
  await expect(page.locator("#adv-cue-cells .adv-cue-cell")).toHaveCount(0);
});

test("the cue clears itself once its animation ends", async ({ page }) => {
  await fireOnce(page, "stoneGolem", 1);
  await expect(page.locator("#adv-cue")).toBeVisible();
  await expect(page.locator("#adv-cue")).not.toHaveClass(/animate/, { timeout: 4000 });
  await expect(page.locator("#adv-cue-cells .adv-cue-cell")).toHaveCount(0);
});

test("banners never cover the board", async ({ page }) => {
  await fireOnce(page, "stoneGolem", 1);
  await expect(page.locator("#adv-cue")).toBeVisible();
  const board = (await page.locator("#adv-board").boundingBox())!;
  const cue = (await page.locator("#adv-cue").boundingBox())!;
  expect(intersects(cue, board)).toBe(false);
  await waitIdle(page);

  const run = runWith("slime", 0);
  const grid: GameGrid = Array.from({ length: 4 }, () => [STONE, STONE, STONE, STONE]);
  await setRun(page, { ...run, battle: { ...run.battle!, grid, mana: 5, countdown: 4 } });
  await expect(page.locator("#adv-stuck")).toBeVisible();
  const stuck = (await page.locator("#adv-stuck").boundingBox())!;
  expect(intersects(stuck, (await page.locator("#adv-board").boundingBox())!)).toBe(false);
});
