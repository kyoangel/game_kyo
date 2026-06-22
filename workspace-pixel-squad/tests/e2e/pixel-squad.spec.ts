import { test, expect } from '@playwright/test';

test('game loads and shows battle screen with characters', async ({ page }) => {
  await page.goto('/game_kyo/pixel-squad/');
  await page.waitForSelector('canvas', { timeout: 8000 });
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.height).toBeGreaterThan(400);
});

test('battle state is accessible via test helper', async ({ page }) => {
  await page.goto('/game_kyo/pixel-squad/');
  await page.waitForSelector('canvas', { timeout: 8000 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(
    () => (window as unknown as { __getBattleState: () => unknown }).__getBattleState()
  );
  expect(state).toBeTruthy();
  const s = state as { playerParty: unknown[]; enemyParty: unknown[] };
  expect(s.playerParty).toHaveLength(3);
  expect(s.enemyParty).toHaveLength(1); // stage 1 has 1 enemy
});

test('player can click 攻擊 during their turn', async ({ page }) => {
  await page.goto('/game_kyo/pixel-squad/');
  await page.waitForSelector('canvas', { timeout: 8000 });
  await page.waitForTimeout(2000); // let first player turn arrive

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found');

  // Action menu at bottom of canvas (~y=590 in 640-tall logical canvas)
  const scale = box.height / 640;
  const clickX = box.x + box.width / 2;
  const clickY = box.y + 590 * scale;
  await page.mouse.click(clickX - 40 * scale, clickY);
  await page.waitForTimeout(1200);

  // Game should still be running (no crash)
  const state = await page.evaluate(
    () => (window as unknown as { __getBattleState?: () => unknown }).__getBattleState?.()
  );
  expect(state).toBeTruthy();
});
