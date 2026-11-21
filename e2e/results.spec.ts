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

    await page.waitForTimeout(900);
    await page.mouse.click(x + width / 2, y + height / 2);
    await page.waitForFunction(
      () => (window as unknown as W).__gk?.state === 'playing' && (window as unknown as W).__gk!.activeScenes.includes('Play') && !(window as unknown as W).__gk!.activeScenes.includes('GKGameOver'),
      undefined,
      { timeout: 1500 },
    );
    expect(errors).toEqual([]);
  });
}
