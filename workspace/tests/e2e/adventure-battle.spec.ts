import { test, expect } from "@playwright/test";
import { STONE, type GameGrid } from "../../src/grid";
import { createBattle } from "../../src/adventure/battle";
import { STARTER_RELIC_IDS } from "../../src/adventure/relics";
import { chooseOffer, createRun, type RunState } from "../../src/adventure/run";
import { mulberry32 } from "../../src/adventure/rng";
import {
  NO_DEBUG_START,
  bestDirection,
  cellCenter,
  getRun,
  patchBattle,
  pickOffer,
  playBattleOut,
  setRun,
  startAdventure,
  waitIdle,
} from "./adventureHelpers";

test.use(NO_DEBUG_START);

/** A run in battle `battleIndex` built with the pure layer, so a test can jump straight to it. */
function runAt(battleIndex: number, battleChanges: Record<string, unknown> = {}, runChanges: Partial<RunState> = {}): RunState {
  const rng = mulberry32(99);
  const base = chooseOffer(createRun(rng, STARTER_RELIC_IDS), 0, rng).run;
  const enemyId = ["slime", "stoneGolem", "treeKing", "snowSprite", "crystalGuard", "iceQueen", "spiralMage", "shadowBlock", "zeroLord"][battleIndex];
  const battle = { ...createBattle({ enemyId, heroHp: 10, heroMaxHp: 10 }, rng).state, ...battleChanges };
  return { ...base, battleIndex, battle, heroHp: battle.heroHp, ...runChanges };
}

const gridOf = (cells: Record<string, number>): GameGrid => {
  const grid: GameGrid = Array.from({ length: 4 }, () => [null, null, null, null]);
  Object.entries(cells).forEach(([key, value]) => {
    const [r, c] = key.split(",").map(Number);
    grid[r][c] = value;
  });
  return grid;
};

test("plays a whole battle to victory, picks a reward, and meets the second enemy", async ({ page }) => {
  test.setTimeout(120_000);
  await startAdventure(page, 3);
  await pickOffer(page, 0);
  await patchBattle(page, { enemyHp: 20 });

  const turns = await playBattleOut(page);
  expect(turns).toBeGreaterThan(0);
  await expect(page.locator("#adv-offers")).toBeVisible();
  await expect(page.locator("#adv-offers-title")).toHaveText("戰鬥勝利！選擇一個獎勵");
  expect((await getRun(page)).phase).toBe("reward");
  expect(await page.locator(".adv-offer").count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.adv-offer[data-kind="heal"]')).toBeVisible();

  await page.locator('.adv-offer[data-kind="heal"]').click();
  await expect(page.locator("#adv-offers")).toBeHidden();
  await expect(page.locator("#adv-screen")).toHaveAttribute("data-battle-index", "1");
  await expect(page.locator("#adv-enemy-name")).toHaveText("方塊石像");
  const run = await getRun(page);
  expect(run.phase).toBe("battle");
  expect(run.battle!.mana).toBeLessThanOrEqual(2); // a new battle starts from the relic bonus only
});

test("the enemy's telegraphed attack lands: HP drops, the log says so, and the countdown restarts", async ({ page }) => {
  await startAdventure(page, 4);
  await pickOffer(page, 0);
  await setRun(page, runAt(0, { countdown: 1, grid: gridOf({ "0,0": 5 }) }));
  await page.keyboard.press("ArrowRight");
  await waitIdle(page);
  await expect(page.locator("#adv-hp")).toContainText("9/10");
  await expect(page.locator("#adv-log")).toContainText("敵人攻擊");
  await expect(page.locator("#adv-intent")).toContainText("· 4");
});

test("losing all HP shows the defeat screen, deletes the save, and 回首頁 offers no 繼續冒險", async ({ page }) => {
  await startAdventure(page, 5);
  await pickOffer(page, 0);
  await patchBattle(page, { heroHp: 1, countdown: 1 });
  const run = await getRun(page);
  await page.keyboard.press(`Arrow${{ left: "Left", right: "Right", up: "Up", down: "Down" }[bestDirection(run)!]}`);
  await expect(page.locator("#adv-result")).toBeVisible();
  await expect(page.locator("#adv-result-title")).toHaveText("💀 冒險失敗");
  await expect(page.locator("#adv-result-lines")).toContainText("到達第 1 場");
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10AdventureRun"))).toBeNull();

  await page.locator("#adv-result-home").click();
  await expect(page.locator("#mode-menu")).toBeVisible();
  await expect(page.locator("#mode-continue")).toBeHidden();
});

test("再來一次 after a defeat starts a fresh run at the relic pick", async ({ page }) => {
  await startAdventure(page, 6);
  await pickOffer(page, 0);
  await patchBattle(page, { heroHp: 1, countdown: 1 });
  await page.keyboard.press(`Arrow${{ left: "Left", right: "Right", up: "Up", down: "Down" }[bestDirection(await getRun(page))!]}`);
  await expect(page.locator("#adv-result")).toBeVisible();
  await page.locator("#adv-result-again").click();
  await expect(page.locator("#adv-result")).toBeHidden();
  await expect(page.locator("#adv-offers-title")).toHaveText("選擇一個起始遺物");
  expect((await getRun(page)).phase).toBe("relicPick");
});

test("beating the zero lord shows 通關, unlocks the first-clear trophy and its relic", async ({ page }) => {
  test.setTimeout(120_000);
  await startAdventure(page, 7);
  await pickOffer(page, 0);
  await setRun(page, runAt(8, { enemyHp: 10, grid: gridOf({ "0,0": 4, "0,1": 6 }) }));
  await expect(page.locator("#adv-enemy-name")).toHaveText("👑 零之魔王");
  await playBattleOut(page);
  await expect(page.locator("#adv-result")).toBeVisible();
  await expect(page.locator("#adv-result-title")).toHaveText("🏆 通關！");
  await expect(page.locator("#adv-toast")).toContainText("歸零者");
  const stored = await page.evaluate(() => localStorage.getItem("mathMerge10AdventureTrophies"));
  expect(JSON.parse(stored!)).toHaveProperty("adv_clear");
  expect(await page.evaluate(() => localStorage.getItem("mathMerge10AdventureRun"))).toBeNull();

  await page.locator("#adv-result-home").click();
  await page.locator("#mode-trophies").click();
  await expect(page.locator('#adv-trophy-list li[data-trophy="adv_clear"]')).toHaveAttribute("data-unlocked", "true");
});

test("killing the tree king grants a boss reward of three relics and heals half the max HP", async ({ page }) => {
  test.setTimeout(120_000);
  await startAdventure(page, 8);
  await pickOffer(page, 0);
  await setRun(page, runAt(2, { enemyHp: 10, heroHp: 3, grid: gridOf({ "0,0": 4, "0,1": 6 }) }));
  await playBattleOut(page);
  await expect(page.locator("#adv-offers-title")).toHaveText("Boss 討伐！選擇一個遺物");
  await expect(page.locator('.adv-offer[data-kind="relic"]')).toHaveCount(3);
  const run = await getRun(page);
  expect(run.heroHp).toBe(8);
  await expect(page.locator("#adv-hp")).toContainText("8/10");
  await expect(page.locator("#adv-toast")).toContainText("森林征服者");
});

test("spells: 💣 needs mana, then targets a cell and clears the cross", async ({ page }) => {
  await startAdventure(page, 9);
  await pickOffer(page, 0);
  const grid = gridOf({ "1,1": 5, "0,1": 3, "1,0": 8, "2,1": 2, "1,2": 7, "3,3": 9 });
  await setRun(page, runAt(0, { mana: 0, grid }));
  await expect(page.locator('[data-spell="bomb"]')).toBeDisabled();

  await patchBattle(page, { mana: 4 });
  await expect(page.locator('[data-spell="bomb"]')).toBeEnabled();
  await page.locator('[data-spell="bomb"]').click();
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "true");
  await page.locator("#adv-board").click({ position: await cellCenter(page, 1, 1) });

  const run = await getRun(page);
  expect(run.battle!.mana).toBe(0);
  expect(run.battle!.grid[1][1]).toBeNull();
  expect(run.battle!.grid[0][1]).toBeNull();
  expect(run.battle!.grid[3][3]).toBe(9);
  expect(run.battle!.turn).toBe(0); // casting is not a turn
  await expect(page.locator("#adv-mana")).toContainText("0");
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "false");
});

test("spells: 🔀 casts at once; 🔨 can be cancelled by tapping it again", async ({ page }) => {
  await startAdventure(page, 10);
  await pickOffer(page, 0);
  await setRun(page, runAt(0, { mana: 5, grid: gridOf({ "0,0": 1, "0,1": 2, "3,3": 3 }) }));
  await page.locator('[data-spell="hammer"]').click();
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "true");
  await page.locator('[data-spell="hammer"]').click();
  await expect(page.locator("#adv-board")).toHaveAttribute("data-targeting", "false");

  await page.locator('[data-spell="shuffle"]').click();
  const run = await getRun(page);
  expect(run.battle!.mana).toBe(2);
  expect(run.battle!.grid.flat().filter((c) => c !== null).sort()).toEqual([1, 2, 3]);
});

test("stones, zeros and frozen tiles draw without errors and show the freeze counter state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startAdventure(page, 11);
  await pickOffer(page, 0);
  await setRun(
    page,
    runAt(3, {
      grid: gridOf({ "0,0": STONE, "0,1": 0, "1,1": 5, "2,2": 7 }),
      freezes: [{ row: 1, col: 1, turns: 3 }],
    }),
  );
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
  const run = await getRun(page);
  expect(run.battle!.freezes).toEqual([{ row: 1, col: 1, turns: 3 }]);
  await page.keyboard.press("ArrowLeft"); // a slide next to a frozen wall (simple slide animation path)
  await waitIdle(page);
  expect(errors).toEqual([]);
});

test("?seed= makes a run reproducible: same seed, same offers and the same first board", async ({ browser, baseURL }) => {
  const snapshot = async (seed: number) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto(`./?seed=${seed}`);
    await page.locator("#mode-adventure").click();
    const offers = (await getRun(page)).offers;
    await pickOffer(page, 0);
    const grid = (await getRun(page)).battle!.grid;
    await context.close();
    return { offers, grid };
  };
  const a = await snapshot(21);
  const b = await snapshot(21);
  const c = await snapshot(22);
  expect(a).toEqual(b);
  expect(c).not.toEqual(a);
});
