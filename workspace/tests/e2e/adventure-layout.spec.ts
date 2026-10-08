import { test, expect } from "@playwright/test";
import { NO_DEBUG_START, pickOffer, startAdventure } from "./adventureHelpers";

test.use(NO_DEBUG_START);

const PHONES = [
  { name: "iPhone 390x844", width: 390, height: 844 },
  { name: "iPhone Pro Max 430x932", width: 430, height: 932 },
];

for (const phone of PHONES) {
  test.describe(phone.name, () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    test("the start menu fits without scrolling", async ({ page }) => {
      await page.goto("./");
      for (const id of ["#mode-adventure", "#mode-endless", "#mode-trophies"]) {
        const box = (await page.locator(id).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(phone.width);
        expect(box.y + box.height).toBeLessThanOrEqual(phone.height);
      }
    });

    test("every part of the battle screen fits the viewport, with no page scrolling", async ({ page }) => {
      await startAdventure(page, 1);
      await pickOffer(page, 0);
      for (const id of ["#adv-top", "#adv-enemy-card", "#adv-board", "#adv-hero", "#adv-spells", "#adv-relics", "#adv-log"]) {
        const box = (await page.locator(id).boundingBox())!;
        expect(box.x, `${id} left`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(phone.width);
        expect(box.y, `${id} top`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(phone.height);
      }
      const board = (await page.locator("#adv-board").boundingBox())!;
      expect(board.width).toBeCloseTo(board.height, 0);
      expect(board.width).toBeGreaterThanOrEqual(340); // big enough to play on a phone
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
      }));
      expect(overflow.x).toBeLessThanOrEqual(0);
      expect(overflow.y).toBeLessThanOrEqual(0);
    });

    test("the four spell buttons are at least 44px tall and the reward modal fits", async ({ page }) => {
      await startAdventure(page, 1);
      const card = (await page.locator("#adv-offers .adv-modal-card").boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(phone.width);
      expect(card.y + card.height).toBeLessThanOrEqual(phone.height);
      await pickOffer(page, 0);
      for (const spell of ["hammer", "addOne", "bomb", "shuffle"]) {
        const box = (await page.locator(`[data-spell="${spell}"]`).boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
