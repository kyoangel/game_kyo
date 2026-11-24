import { devices, expect, test } from '@playwright/test';

type W = { __gk?: { activeScenes: string[] }; __ddTitle?: { tiltToggle: boolean; control: string } };
const { defaultBrowserType: _unused, ...iphone13 } = devices['iPhone 13'];

async function titleState(page: import('@playwright/test').Page, settleMs: number): Promise<{ tiltToggle: boolean; control: string }> {
  await page.goto('/dodge-drop/?layout=portrait');
  await page.waitForFunction(() => (window as unknown as W).__gk?.activeScenes.includes('GKTitle') === true);
  await page.waitForFunction(() => (window as unknown as W).__ddTitle !== undefined);
  await page.waitForTimeout(settleMs);
  return page.evaluate(() => (window as unknown as W).__ddTitle!);
}

const feedGamma = (): void => {
  setInterval(() => {
    const e = new Event('deviceorientation') as Event & { gamma: number };
    Object.defineProperty(e, 'gamma', { value: 4 });
    window.dispatchEvent(e);
  }, 100);
};

test.describe('tilt option visibility', () => {
  test.describe('phone with a working sensor', () => {
    test.use({ ...iphone13 });
    test('toggle appears once a real gamma reading arrives', async ({ page }) => {
      await page.addInitScript(feedGamma);
      const s = await titleState(page, 1500);
      expect(s.tiltToggle).toBe(true);
      expect(s.control).toBe('drag');
    });
  });

  test.describe('phone without the orientation API', () => {
    test.use({ ...iphone13 });
    test('toggle stays hidden', async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
      });
      expect((await titleState(page, 1500)).tiltToggle).toBe(false);
    });
  });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test('toggle stays hidden even if readings arrive', async ({ page }) => {
      await page.addInitScript(feedGamma);
      expect((await titleState(page, 1500)).tiltToggle).toBe(false);
    });
  });
});

test('interactive controls are at least 44 css px on an iPhone SE', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/dodge-drop/?layout=portrait');
  await page.waitForFunction(() => (window as unknown as W).__gk?.activeScenes.includes('GKTitle') === true);
  await page.waitForFunction(() => (window as unknown as W).__ddTitle !== undefined);
  await page.waitForTimeout(800); // async extras (missions, chips) render
  const small = await page.evaluate(() => {
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    const s = c.width / 720;
    const targets = (window as unknown as { __dd: { tapTargets(): { name: string; h: number }[] } }).__dd.tapTargets();
    return { count: targets.length, small: targets.filter((t) => t.h * s < 44) };
  });
  expect(small.count, 'tap target hook sees the title buttons').toBeGreaterThan(5);
  expect(small.small).toEqual([]);
});
