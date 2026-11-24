import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

type GkHooks = { state: string; best: number; activeScenes: string[]; endRound(score?: number): Promise<void> };
declare global {
  interface Window {
    __gk?: GkHooks;
  }
}

const slugs = readdirSync('games')
  .filter((d) => existsSync(join('games', d, 'game.json')))
  .sort();

for (const slug of slugs) {
  test(`${slug}: boots, plays, reaches game over without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });

    await page.goto(`/${slug}/?layout=portrait`);
    await page.waitForFunction(() => window.__gk?.activeScenes.includes('GKTitle') === true);

    const box = await page.locator('canvas').boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box!;
    await page.mouse.click(x + width / 2, y + height / 2);
    await page.waitForFunction(() => window.__gk?.state === 'playing');

    const keys = ['ArrowLeft', 'ArrowRight', 'Space'];
    for (let i = 0; i < 15; i++) {
      await page.mouse.click(x + ((i * 37) % 100) / 100 * width, y + ((i * 53) % 100) / 100 * height);
      await page.keyboard.press(keys[i % keys.length]!);
      await page.waitForTimeout(150);
    }

    await page.evaluate(async () => {
      if (window.__gk?.state === 'playing') await window.__gk.endRound(7);
    });
    await page.waitForFunction(
      () => window.__gk?.state === 'over' && window.__gk.activeScenes.includes('GKGameOver'),
    );
    expect(await page.evaluate(() => window.__gk?.best ?? -1)).toBeGreaterThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
