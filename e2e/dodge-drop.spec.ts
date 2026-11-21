import { expect, test } from '@playwright/test';

type GkHooks = {
  state: string;
  activeScenes: string[];
  pausedScenes: string[];
  endRound(score?: number): Promise<void>;
};
type W = { __gk?: GkHooks };

test('dodge-drop: plays with keys, survives or dies cleanly, overlay tap returns to play', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto('/dodge-drop/');
  await page.waitForFunction(() => { const g = (window as unknown as W).__gk!; return g.activeScenes.includes('GKTitle'); });
  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width, height } = box!;
  await page.mouse.click(x + width / 2, y + height / 2);
  await page.waitForFunction(() => { const g = (window as unknown as W).__gk!; return g.state === 'playing'; });

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1500);

  expect(['playing', 'over']).toContain(await page.evaluate(() => { const g = (window as unknown as W).__gk!; return g.state; }));
  expect(await page.evaluate(() => { const g = (window as unknown as W).__gk!; return g.activeScenes; })).toContain('Play');

  // Force the end if the player is still alive, then wait for the overlay.
  await page.evaluate(() => { const g = (window as unknown as W).__gk!; return void g.endRound(5); });
  await page.waitForFunction(() => { const g = (window as unknown as W).__gk!; return g.activeScenes.includes('GKGameOver'); });
  expect(await page.evaluate(() => { const g = (window as unknown as W).__gk!; return g.pausedScenes; })).toContain('Play');

  // Tap (the guard delay protects against accidental taps); works for results and for the revive panel.
  await page.waitForTimeout(900);
  await page.mouse.click(x + width / 2, y + height / 2);
  await page.waitForFunction(
    () => { const g = (window as unknown as W).__gk!; return g.state === 'playing' && g.activeScenes.includes('Play') && !g.activeScenes.includes('GKGameOver'); },
    undefined,
    { timeout: 2500 },
  );
  expect(errors).toEqual([]);
});
