import { devices, expect, test } from '@playwright/test';

const SITE = 'http://localhost:5183';
const { defaultBrowserType: _unused, ...iphone13 } = devices['iPhone 13'];

test.describe('site game page on a phone', () => {
  test.use({ ...iphone13, baseURL: SITE });

  test('game fills the first viewport, page does not scroll, back icon is a 44px target', async ({ page }) => {
    await page.goto('/dodge-drop/');
    const frame = page.locator('.frame');
    await expect(frame).toBeVisible();
    const vp = page.viewportSize()!;
    const box = (await frame.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    expect(box.height).toBeGreaterThan(vp.height * 0.95);
    const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    expect(m.sh).toBeLessThanOrEqual(m.ih);
    await expect(page.locator('.game-header h1')).toBeHidden();
    await expect(page.locator('.about')).toBeHidden();
    const back = (await page.locator('.back').boundingBox())!;
    expect(back.width).toBeGreaterThanOrEqual(44);
    expect(back.height).toBeGreaterThanOrEqual(44);
    expect(back.x).toBeLessThan(60);
  });

  test('the canvas inside the iframe is within the first viewport', async ({ page }) => {
    await page.goto('/dodge-drop/');
    const canvas = page.frameLocator('iframe').locator('canvas');
    await expect(canvas).toBeVisible();
    const cb = (await canvas.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(cb.y).toBeGreaterThanOrEqual(0);
    expect(cb.y + cb.height).toBeLessThanOrEqual(vp.height + 1);
    expect(cb.x + cb.width).toBeLessThanOrEqual(vp.width + 1);
  });
});

test.describe('site game page on desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, baseURL: SITE });
  test('keeps the header and about section', async ({ page }) => {
    await page.goto('/dodge-drop/');
    await expect(page.locator('.game-header h1')).toBeVisible();
    await expect(page.locator('.about')).toBeVisible();
  });
});
