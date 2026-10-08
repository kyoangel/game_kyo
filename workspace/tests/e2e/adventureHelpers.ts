import { expect, type Page } from "@playwright/test";
import { slide, type Direction } from "../../src/grid";
import { freezeMask } from "../../src/adventure/intents";
import type { RunState } from "../../src/adventure/run";

/** Clears the config's dev-start seed so the page opens on the start menu. */
export const NO_DEBUG_START = { storageState: { cookies: [], origins: [] } };

type AdvWindow = {
  __adv: {
    getRun: () => RunState | null;
    isBusy: () => boolean;
    setRun: (run: RunState) => void;
    patchBattle: (changes: Record<string, unknown>) => void;
  };
};

export const getRun = (page: Page): Promise<RunState> =>
  page.evaluate(() => (window as unknown as AdvWindow).__adv.getRun() as RunState);

export const setRun = (page: Page, run: RunState): Promise<void> =>
  page.evaluate((r) => (window as unknown as AdvWindow).__adv.setRun(r), run);

export const patchBattle = (page: Page, changes: Record<string, unknown>): Promise<void> =>
  page.evaluate((c) => (window as unknown as AdvWindow).__adv.patchBattle(c), changes);

/** Opens the page on the start menu (optionally with ?seed=) and enters a fresh adventure. */
export async function startAdventure(page: Page, seed = 1): Promise<void> {
  await page.goto(`./?seed=${seed}`);
  await page.locator("#mode-adventure").click();
  await expect(page.locator("#adv-offers")).toBeVisible();
}

/** Picks offer `index` in the open reward/relic modal. */
export async function pickOffer(page: Page, index = 0): Promise<void> {
  await page.locator(`.adv-offer[data-index="${index}"]`).click();
  await expect(page.locator("#adv-offers")).toBeHidden();
}

/** The direction that clears the most pairs right now (any legal one if none clears), or null when stuck. */
export function bestDirection(run: RunState): Direction | null {
  const battle = run.battle!;
  const mask = freezeMask(battle.grid.length, battle.freezes);
  let best: Direction | null = null;
  let bestPairs = -1;
  for (const direction of ["left", "right", "up", "down"] as Direction[]) {
    const outcome = slide(battle.grid, direction, mask);
    if (outcome.moved && outcome.eliminatedPairs.length > bestPairs) {
      best = direction;
      bestPairs = outcome.eliminatedPairs.length;
    }
  }
  return best;
}

const KEY: Record<Direction, string> = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };

/** Waits until the board animation has finished and input is accepted again. */
export const waitIdle = (page: Page) =>
  page.waitForFunction(() => !(window as unknown as AdvWindow).__adv.isBusy());

/** Plays greedy swipes until the run leaves the battle phase (or `maxTurns` is hit). Returns the turns played. */
export async function playBattleOut(page: Page, maxTurns = 120): Promise<number> {
  let turns = 0;
  while (turns < maxTurns) {
    await waitIdle(page);
    const run = await getRun(page);
    if (run.phase !== "battle") return turns;
    const direction = bestDirection(run) ?? "left"; // stuck: any swipe resolves the overload safety net
    await page.keyboard.press(KEY[direction]);
    turns += 1;
  }
  return turns;
}

/** Screen-space centre of board cell (row, col). */
export async function cellCenter(page: Page, row: number, col: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator("#adv-board").boundingBox())!;
  return { x: ((col + 0.5) * box.width) / 4, y: ((row + 0.5) * box.height) / 4 };
}
