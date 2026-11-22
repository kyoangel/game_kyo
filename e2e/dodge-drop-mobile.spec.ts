import { devices, expect, test } from '@playwright/test';

type W = { __gk?: { activeScenes: string[] }; __ddTitle?: { tiltChip: boolean; control: string } };
const { defaultBrowserType: _unused, ...iphone13 } = devices['iPhone 13'];

async function titleState(page: import('@playwright/test').Page, settleMs: number): Promise<{ tiltChip: boolean; control: string }> {
  await page.goto('/dodge-drop/');
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
    test('chip appears once a real gamma reading arrives', async ({ page }) => {
      await page.addInitScript(feedGamma);
      const s = await titleState(page, 1500);
      expect(s.tiltChip).toBe(true);
      expect(s.control).toBe('drag');
    });
  });

  test.describe('phone without the orientation API', () => {
    test.use({ ...iphone13 });
    test('chip stays hidden', async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
      });
      expect((await titleState(page, 1500)).tiltChip).toBe(false);
    });
  });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test('chip stays hidden even if readings arrive', async ({ page }) => {
      await page.addInitScript(feedGamma);
      expect((await titleState(page, 1500)).tiltChip).toBe(false);
    });
  });
});
