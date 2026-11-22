// Device/locale sweep that writes screenshots to .superpowers/sdd/meta/mobile/ and asserts basic layout sanity.
// Not part of the pre-push smoke set: run with `npm run test:rwd`.
import { devices, expect, test, type Page } from '@playwright/test';

const OUT = '.superpowers/sdd/meta/mobile';
const GAME = 'http://localhost:5180/dodge-drop/';
const SITE = 'http://localhost:5183/dodge-drop/';

const strip = <T extends { defaultBrowserType?: unknown }>(d: T): Omit<T, 'defaultBrowserType'> => {
  const { defaultBrowserType: _d, ...rest } = d;
  return rest;
};
const DEVICES = {
  'iphone-se': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'iphone-13': strip(devices['iPhone 13']),
  'pixel-7': strip(devices['Pixel 7']),
  'ipad-mini': strip(devices['iPad Mini']),
  desktop: { viewport: { width: 1440, height: 900 } },
} as const;
const LOCALES = ['en-US', 'zh-TW'] as const;

type W = { __gk?: { activeScenes: string[]; endRound(s?: number): Promise<void> } };

async function scene(page: Page, name: string): Promise<void> {
  await page.waitForFunction((n) => (window as unknown as W).__gk!.activeScenes.includes(n), name);
}

for (const [dev, ctxOpts] of Object.entries(DEVICES)) {
  for (const locale of LOCALES) {
    test(`rwd ${dev} ${locale}`, async ({ browser }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext({ ...ctxOpts, locale });
      const page = await ctx.newPage();
      const tag = `${dev}-${locale === 'en-US' ? 'en' : 'zh'}`;
      const shot = (name: string) => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
      const vp = page.viewportSize()!;
      const phone = vp.width <= 820;

      // Site page
      await page.goto(SITE);
      await page.waitForTimeout(1200);
      await shot('site');
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
      expect(m.sw, 'no horizontal overflow on the site page').toBeLessThanOrEqual(m.iw);
      if (phone) {
        expect(m.sh, 'game page does not scroll on phones').toBeLessThanOrEqual(m.ih);
        const back = (await page.locator('.back').boundingBox())!;
        expect(back.width).toBeGreaterThanOrEqual(44);
        expect(back.height).toBeGreaterThanOrEqual(44);
      }

      // Game scenes (local build has test hooks)
      const open = async (): Promise<{ at: (x: number, y: number) => { x: number; y: number } }> => {
        await page.goto(GAME);
        await scene(page, 'GKTitle');
        await page.waitForFunction(() => (window as unknown as { __ddTitle?: unknown }).__ddTitle !== undefined);
        await page.waitForTimeout(500);
        const box = (await page.locator('canvas').boundingBox())!;
        return { at: (gx, gy) => ({ x: box.x + (gx / 720) * box.width, y: box.y + (gy / 1280) * box.height }) };
      };
      let g = await open();
      await shot('title');
      const up = g.at(360, 1280 * 0.72 + 96);
      await page.mouse.click(up.x, up.y);
      await scene(page, 'Workshop');
      await page.waitForTimeout(500);
      await shot('workshop');

      g = await open();
      const sk = g.at(360, 1280 * 0.72);
      await page.mouse.click(sk.x, sk.y);
      await scene(page, 'Skins');
      await page.waitForTimeout(500);
      await shot('skins');

      g = await open();
      const c = g.at(360, 640);
      await page.mouse.click(c.x, c.y);
      await scene(page, 'Play');
      await page.waitForTimeout(2500);
      await shot('play');
      await page.evaluate(() => void (window as unknown as W).__gk!.endRound(5));
      await scene(page, 'GKGameOver');
      await page.waitForTimeout(1800);
      await shot('results');
      await ctx.close();
    });
  }
}
