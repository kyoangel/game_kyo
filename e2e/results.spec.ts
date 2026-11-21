import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

type GkHooks = {
  state: string;
  activeScenes: string[];
  pausedScenes: string[];
  endRound(score?: number): Promise<void>;
};
type W = { __gk?: GkHooks };

const slugs = readdirSync('games')
  .filter((d) => existsSync(join('games', d, 'game.json')))
  .sort();

for (const slug of slugs) {
  test(`${slug}: results overlay shows over a paused play scene and tap retries`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });

    await page.goto(`/${slug}/`);
    await page.waitForFunction(() => (window as unknown as W).__gk?.activeScenes.includes('GKTitle') === true);
    const box = await page.locator('canvas').boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box!;
    await page.mouse.click(x + width / 2, y + height / 2);
    await page.waitForFunction(() => (window as unknown as W).__gk?.state === 'playing');

    await page.evaluate(() => (window as unknown as W).__gk!.endRound(5));
    await page.waitForFunction(() => (window as unknown as W).__gk?.activeScenes.includes('GKGameOver') === true);
    expect(await page.evaluate(() => (window as unknown as W).__gk!.pausedScenes)).toContain('Play');
    expect(await page.evaluate(() => (window as unknown as W).__gk!.state)).toBe('over');

    // The overlay's input guard runs on game time, which is slow under CI software rendering:
    // keep tapping until the retry lands instead of relying on one fixed-delay tap.
    const retried = () => (window as unknown as W).__gk?.state === 'playing' && (window as unknown as W).__gk!.activeScenes.includes('Play') && !(window as unknown as W).__gk!.activeScenes.includes('GKGameOver');
    const deadline = Date.now() + 8000;
    while (!(await page.evaluate(retried)) && Date.now() < deadline) {
      await page.mouse.click(x + width / 2, y + height / 2);
      await page.waitForTimeout(300);
    }
    expect(await page.evaluate(retried)).toBe(true);
    expect(errors).toEqual([]);
  });
}
