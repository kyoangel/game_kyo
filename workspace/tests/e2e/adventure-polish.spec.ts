import { test, expect } from "@playwright/test";
import { NO_DEBUG_START, pickOffer, startAdventure } from "./adventureHelpers";

test.describe("endless HUD", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the endless home button does not cover the score", async ({ page }) => {
    await page.goto("./"); // default storageState opens 修練 directly
    const home = (await page.locator("#endless-home").boundingBox())!;
    const score = (await page.locator("#hud-score").boundingBox())!;
    const overlaps =
      home.x < score.x + score.width &&
      home.x + home.width > score.x &&
      home.y < score.y + score.height &&
      home.y + home.height > score.y;
    expect(overlaps).toBe(false);
  });
});

test.describe("adventure on iPhone SE", () => {
  test.use({ ...NO_DEBUG_START, viewport: { width: 375, height: 667 } });

  test("board, spell bar and home button are reachable in a battle", async ({ page }) => {
    await startAdventure(page, 1);
    await pickOffer(page, 0);
    for (const sel of ["#adv-home", "#adv-board", "#adv-spells"]) {
      const loc = page.locator(sel);
      await loc.scrollIntoViewIfNeeded();
      const box = (await loc.boundingBox())!;
      expect(box.y, `${sel} top`).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, `${sel} bottom`).toBeLessThanOrEqual(667);
    }
    // everything fits without scrolling (the page never needs to move under a swipe)
    const overflowY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(overflowY).toBeLessThanOrEqual(0);
  });

  test("the board keeps touch-action none", async ({ page }) => {
    await startAdventure(page, 1);
    await pickOffer(page, 0);
    await expect(page.locator("#adv-board")).toHaveCSS("touch-action", "none");
  });
});

test.describe("offers modal exit", () => {
  test.use({ ...NO_DEBUG_START, viewport: { width: 390, height: 844 } });

  test("回首頁 returns to the menu and 繼續冒險 shows the offers again", async ({ page }) => {
    await startAdventure(page, 1);
    await page.locator("#adv-offers-home").click();
    await expect(page.locator("#mode-menu")).toBeVisible();
    await expect(page.locator("#adv-offers")).toBeHidden();
    await page.locator("#mode-continue").click();
    await expect(page.locator("#adv-offers")).toBeVisible();
  });
});

test.describe("touch behaviour", () => {
  test.use({ ...NO_DEBUG_START, viewport: { width: 390, height: 844 } });

  test("buttons disable double-tap zoom", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("#mode-adventure")).toHaveCSS("touch-action", "manipulation");
    await startAdventure(page, 1);
    await pickOffer(page, 0);
    await expect(page.locator('[data-spell="hammer"]')).toHaveCSS("touch-action", "manipulation");
  });
});
