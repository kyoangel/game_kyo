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
  'desktop-1920': { viewport: { width: 1920, height: 1080 } },
  'desktop-1280': { viewport: { width: 1280, height: 720 } },
} as const;
const LOCALES = ['en-US', 'zh-TW'] as const;

type W = { __gk?: { activeScenes: string[]; frame?: { mode: 'portrait' | 'landscape'; width: number; height: number }; endRound(s?: number): Promise<void> } };

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
      // Phones stay pinned to portrait (the portrait layout is what they ship with); desktop sizes use the default
      // viewport-driven frame, so they exercise landscape.
      const gameUrl = phone ? `${GAME}?layout=portrait` : GAME;
      const expectedMode = phone ? 'portrait' : 'landscape';

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
      type Opened = { at: (x: number, y: number) => { x: number; y: number }; w: number; h: number };
      const open = async (): Promise<Opened> => {
        await page.goto(gameUrl);
        await scene(page, 'GKTitle');
        await page.waitForFunction(() => (window as unknown as { __ddTitle?: unknown }).__ddTitle !== undefined);
        await page.waitForTimeout(500);
        const frame = (await page.evaluate(() => (window as unknown as W).__gk!.frame))!;
        expect(frame.mode, 'frame mode').toBe(expectedMode);
        const box = (await page.locator('canvas').boundingBox())!;
        return { at: (gx, gy) => ({ x: box.x + (gx / frame.width) * box.width, y: box.y + (gy / frame.height) * box.height }), w: frame.width, h: frame.height };
      };
      let g = await open();
      await shot('title');
      const landscape = g.w > g.h;
      const shopBtn = landscape
        ? await page.evaluate(() => (window as unknown as { __dd: { menuAt(i: number): { x: number; y: number } } }).__dd.menuAt(0))
        : { x: 360, y: 1280 * 0.72 };
      const sh = g.at(shopBtn.x, shopBtn.y);
      await page.mouse.click(sh.x, sh.y);
      await scene(page, 'Shop');
      await page.waitForTimeout(500);
      await shot('shop-upgrades');
      for (const [name, off] of [['skins', 0], ['boosts', 224]] as const) {
        const tab = landscape ? g.at(720 + off, 60) : g.at(360 + off, 172);
        await page.mouse.click(tab.x, tab.y);
        await page.waitForTimeout(600);
        await shot(`shop-${name}`);
      }

      g = await open();
      const c = g.at(g.w / 2, g.h / 2);
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
