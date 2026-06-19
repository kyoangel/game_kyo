import { test, expect, Page } from "@playwright/test";

async function selectSize(page: Page, size: 4 | 5): Promise<void> {
  await page.click(`button[data-size="${size}"]`);
  await expect(page.locator("#size-picker")).toBeHidden();
}

async function swipe(page: Page, direction: "left" | "right" | "up" | "down"): Promise<void> {
  const keyMap = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };
  await page.keyboard.press(keyMap[direction]);
}

async function setTestState(
  page: Page,
  grid: (number | null)[][],
  score = 0,
): Promise<void> {
  await page.evaluate(
    ({ grid, score }) => {
      (window as any).__setTestState({ grid, score });
    },
    { grid, score },
  );
}

// Sets up a deterministic game-over state using rng=()=>0:
// Board [null,1,2,1],[2,1,2,1],[1,2,1,2],[2,1,2,1]
// After swipe left: row 0 compacts to [1,2,1,null], spawns value 1 at [0][3]
// Result: [[1,2,1,1],[2,1,2,1],[1,2,1,2],[2,1,2,1]] — all values ≤2, max quad sum=8 → game over
async function triggerGameOver(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__setTestState(
      {
        grid: [
          [null, 1, 2, 1],
          [2, 1, 2, 1],
          [1, 2, 1, 2],
          [2, 1, 2, 1],
        ],
        score: 0,
      },
      () => 0,
    );
  });
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#game-over")).toBeVisible({ timeout: 3000 });
}

test.describe("Size picker", () => {
  test("shows size picker on first load", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#size-picker")).toBeVisible();
  });

  test("hides size picker after selecting 5x5", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 5);
    await expect(page.locator("#size-picker")).toBeHidden();
    const gridSize = await page.evaluate(() => (window as any).__getGridSize());
    expect(gridSize).toBe(5);
  });

  test("hides size picker after selecting 4x4", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await expect(page.locator("#size-picker")).toBeHidden();
    const gridSize = await page.evaluate(() => (window as any).__getGridSize());
    expect(gridSize).toBe(4);
  });

  test("remembers size across reload", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await page.reload();
    await expect(page.locator("#size-picker")).toBeHidden();
    const gridSize = await page.evaluate(() => (window as any).__getGridSize());
    expect(gridSize).toBe(4);
  });
});

test.describe("Swipe and elimination", () => {
  test("eliminates a 2-tile pair on swipe left", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await setTestState(page, [
      [1, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    await swipe(page, "left");
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => (window as any).__getGameState());
    expect(state.score).toBeGreaterThanOrEqual(10);
    const nonNull = (state.grid as (number | null)[][]).flat().filter((c: number | null) => c !== null);
    expect(nonNull.length).toBeLessThanOrEqual(2);
  });

  test("eliminates a 3-tile group on swipe left", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await setTestState(page, [
      [2, 3, 5, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    await swipe(page, "left");
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => (window as any).__getGameState());
    expect(state.score).toBeGreaterThanOrEqual(25);
  });

  test("score is not updated immediately after eliminating swipe (deferred during animation)", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await setTestState(page, [
      [1, 9, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    await swipe(page, "left");

    // Immediately after swipe: score deferred — still 0
    const stateDuring = await page.evaluate(() => (window as any).__getGameState());
    expect(stateDuring.score).toBe(0);

    // After full animation (M 150ms + H 400ms + F 200ms + buffer = 900ms)
    await page.waitForTimeout(900);
    const stateAfter = await page.evaluate(() => (window as any).__getGameState());
    expect(stateAfter.score).toBeGreaterThanOrEqual(10);
  });

  test("shows game over when no moves remain", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await triggerGameOver(page);
  });
});

test.describe("Game over screen", () => {
  test("play again restarts game", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await triggerGameOver(page);
    await page.click("#play-again");
    await expect(page.locator("#game-over")).toBeHidden();
    const state = await page.evaluate(() => (window as any).__getGameState());
    expect(state.score).toBe(0);
  });

  test("change size button shows size picker", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 4);
    await triggerGameOver(page);
    await page.click("#change-size");
    await expect(page.locator("#size-picker")).toBeVisible();
  });
});

test.describe("Trophy modal", () => {
  test("trophy button opens modal", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 5);
    await page.click("#hud-trophy");
    await expect(page.locator("#trophy-modal")).toBeVisible();
  });

  test("close button dismisses modal", async ({ page }) => {
    await page.goto("/");
    await selectSize(page, 5);
    await page.click("#hud-trophy");
    await page.click("#trophy-modal-close");
    await expect(page.locator("#trophy-modal")).toBeHidden();
  });
});
