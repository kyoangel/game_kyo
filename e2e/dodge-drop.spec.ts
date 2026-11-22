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
  // The overlay's input guard runs on game time, which is slow under CI software rendering:
  // keep tapping until the retry lands instead of relying on one fixed-delay tap.
  const retried = () => { const g = (window as unknown as W).__gk!; return g.state === 'playing' && g.activeScenes.includes('Play') && !g.activeScenes.includes('GKGameOver'); };
  const deadline = Date.now() + 8000;
  while (!(await page.evaluate(retried)) && Date.now() < deadline) {
    await page.mouse.click(x + width / 2, y + height / 2);
    await page.waitForTimeout(300);
  }
  expect(await page.evaluate(retried)).toBe(true);
  expect(errors).toEqual([]);
});

test('dodge-drop: Shop scene opens from the title and Back returns', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto('/dodge-drop/');
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('GKTitle'));
  const box = (await page.locator('canvas').boundingBox())!;
  const at = (gx: number, gy: number) => ({ x: box.x + (gx / 720) * box.width, y: box.y + (gy / 1280) * box.height });

  const shop = at(360, 1280 * 0.72);
  await page.mouse.click(shop.x, shop.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('Shop'));
  expect(await page.evaluate(() => (window as unknown as W).__gk!.state)).not.toBe('playing');

  const back = at(120, 80);
  await page.mouse.click(back.x, back.y);
  await page.waitForFunction(() => {
    const s = (window as unknown as W).__gk!.activeScenes;
    return s.includes('GKTitle') && !s.includes('Shop');
  });
  expect(errors).toEqual([]);
});

// ---- Meta-progression (Phase 1) ----
type Dd = { god?: boolean; giveShield?: () => void; spawnPickup?: (kind: 'star' | 'shield', x: number) => boolean; results?: { goal: unknown; missions: Array<{ id: string }> }; stats?: () => { stars: number; t: number; score: number; startTier: string; shieldHits: number; shieldHeld: boolean; clock: number } };
type WD = { __dd?: Dd };

const MISSIONS_SEED = `{"active":[{"id":"score","tier":1,"progress":0},{"id":"combo","tier":1,"progress":0},{"id":"runs","tier":1,"progress":0}],"stars":0,"rank":1,"completedCount":0}`;

async function seed(page: import('@playwright/test').Page, kv: Record<string, string>, god = false): Promise<void> {
  await page.addInitScript(([entries, g]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(entries as Record<string, string>)) localStorage.setItem(`gk:dodge-drop:${k}`, v);
    if (g) (window as unknown as WD).__dd = { god: true };
  }, [kv, god] as const);
}
const ls = (page: import('@playwright/test').Page, key: string) => page.evaluate((k) => localStorage.getItem(`gk:dodge-drop:${k}`), key);

function watch(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function openTitle(page: import('@playwright/test').Page) {
  await page.goto('/dodge-drop/');
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('GKTitle'));
  const box = (await page.locator('canvas').boundingBox())!;
  const at = (gx: number, gy: number) => ({ x: box.x + (gx / 720) * box.width, y: box.y + (gy / 1280) * box.height });
  return { box, at };
}

test('dodge-drop: Shop upgrades buy persists level and coins', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '100' });
  const { at } = await openTitle(page);
  // Shop button (titleLayout menu row 1); the Upgrades tab is the default.
  const up = at(360, 1280 * 0.72);
  await page.mouse.click(up.x, up.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('Shop'));
  await page.waitForTimeout(500);
  // First row cost button: workshopPanel ROW_Y0 = 300, x = 600.
  const buy = at(600, 300);
  await page.mouse.click(buy.x, buy.y);
  await expect.poll(async () => JSON.parse((await ls(page, 'workshop')) ?? '{}').shield).toBe(1);
  expect(await ls(page, 'coins')).toBe('85');
  const back = at(120, 80);
  await page.mouse.click(back.x, back.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('GKTitle'));
  expect(errors).toEqual([]);
});

test('dodge-drop: results expose near-goal and mission rows', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '10', missions: MISSIONS_SEED });
  const { box } = await openTitle(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => (window as unknown as W).__gk!.state === 'playing');
  await page.evaluate(() => void (window as unknown as W).__gk!.endRound(5));
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('GKGameOver'));
  await page.waitForFunction(() => (window as unknown as WD).__dd?.results !== undefined);
  const r = await page.evaluate(() => (window as unknown as WD).__dd!.results!);
  expect((r.goal as { cost: number }).cost).toBe(15);
  expect(r.missions.map((m) => m.id)).toEqual(['score', 'combo', 'runs']);
  expect(errors).toEqual([]);
});

test('dodge-drop: silver tier start sets the game clock', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { medals: '["bronze","silver"]', startTier: '"silver"' }, true);
  const { box } = await openTitle(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => (window as unknown as W).__gk!.state === 'playing');
  await page.waitForFunction(() => (window as unknown as WD).__dd?.stats?.().startTier === 'silver');
  const s = await page.evaluate(() => (window as unknown as WD).__dd!.stats!());
  expect(s.t).toBeGreaterThanOrEqual(60);
  expect(s.t).toBeLessThan(63);
  expect(s.score).toBeGreaterThanOrEqual(200);
  expect(errors).toEqual([]);
});

test('dodge-drop: title chips select a tier and skip replaces a mission', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { medals: '["bronze"]', coins: '100', missions: MISSIONS_SEED });
  const { at } = await openTitle(page);
  await page.waitForTimeout(500);
  // Bronze chip: titleLayout below (829.6) + 24, x = 360 + (1 - 1.5) * 162 = 279.
  const chip = at(279, 854);
  await page.mouse.click(chip.x, chip.y);
  await expect.poll(() => ls(page, 'startTier')).toBe('"bronze"');
  // First mission skip: menuBottom (957.6) + 12 + 26, x = 648.
  const skip = at(648, 996);
  await page.mouse.click(skip.x, skip.y);
  // A swap always costs a flat 5 star coins.
  await expect.poll(() => ls(page, 'coins')).toBe('95');
  const saved = JSON.parse((await ls(page, 'missions'))!);
  expect(saved.active[0].id).not.toBe('score');
  expect(errors).toEqual([]);
});

test('dodge-drop: Skins previews on tap, buys only on confirm, then Use equips', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '100' });
  const { at } = await openTitle(page);
  const shop = at(360, 1280 * 0.72);
  await page.mouse.click(shop.x, shop.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('Shop'));
  await page.waitForTimeout(500);
  // Skins tab (middle).
  const skinsTab = at(360, 172);
  await page.mouse.click(skinsTab.x, skinsTab.y);
  await expect.poll(() => ls(page, 'shopTab')).toBe('"skins"');
  await page.waitForTimeout(400);
  // Tap the locked lime card (col 2, row 1): preview only, nothing spent.
  const lime = at(530, 700);
  await page.mouse.click(lime.x, lime.y);
  await page.waitForTimeout(400);
  expect(await ls(page, 'coins')).toBe('100');
  expect(await ls(page, 'skins')).toBeNull();
  // Confirm with the Buy button.
  const action = at(360, 525);
  await page.mouse.click(action.x, action.y);
  await expect.poll(() => ls(page, 'coins')).toBe('70');
  expect(JSON.parse((await ls(page, 'skins'))!)).toContain('lime');
  await expect.poll(() => ls(page, 'skin')).toBe('"lime"');
  // Preview the owned default skin and equip it with Use.
  const first = at(190, 700);
  await page.mouse.click(first.x, first.y);
  await page.waitForTimeout(300);
  await page.mouse.click(action.x, action.y);
  await expect.poll(() => ls(page, 'skin')).toBe('"cyan"');
  expect(await ls(page, 'coins')).toBe('70');
  expect(errors).toEqual([]);
});

test('dodge-drop: tapping a start-tier chip or a skip does not start the run; empty space does', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { medals: '["bronze"]', coins: '100', missions: MISSIONS_SEED });
  const { at } = await openTitle(page);
  await page.waitForTimeout(500);
  const chip = at(279, 854);
  await page.mouse.click(chip.x, chip.y);
  await expect.poll(() => ls(page, 'startTier')).toBe('"bronze"');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as W).__gk!.activeScenes)).toContain('GKTitle');
  expect(await page.evaluate(() => (window as unknown as W).__gk!.state)).not.toBe('playing');
  const skip = at(648, 996);
  await page.mouse.click(skip.x, skip.y);
  await expect.poll(() => ls(page, 'coins')).toBe('95');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as W).__gk!.activeScenes)).toContain('GKTitle');
  const empty = at(360, 400);
  await page.mouse.click(empty.x, empty.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.state === 'playing');
  expect(errors).toEqual([]);
});

test('dodge-drop: Overdrive streaks appear after warping past 120 s and the run stays error-free', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { medals: '["bronze","silver","gold"]', startTier: '"gold"' }, true);
  const { box } = await openTitle(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => (window as unknown as W).__gk!.state === 'playing');
  await page.waitForFunction(() => ((window as unknown as { __dd?: { stats?: () => { t: number } } }).__dd?.stats?.().t ?? 0) >= 89);
  await page.evaluate(() => (window as unknown as { __dd: { warp: (s: number) => void } }).__dd.warp(60));
  await page.waitForFunction(() => ((window as unknown as { __dd: { stats: () => { streaks: number } } }).__dd.stats().streaks) > 0, undefined, { timeout: 10_000 });
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => (window as unknown as { __dd: { stats: () => { overdrive: number; streaks: number; layers: number } } }).__dd.stats());
  expect(s.overdrive).toBe(1);
  expect(s.streaks).toBeGreaterThan(0);
  expect(s.layers).toBe(4);
  expect(errors).toEqual([]);
});

test('dodge-drop: Shield Stack (2nd workshop row) is bought and shields stack up to 1 + L', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '100' });
  const { at } = await openTitle(page);
  const up = at(360, 1280 * 0.72);
  await page.mouse.click(up.x, up.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('Shop'));
  await page.waitForTimeout(500);
  // Second row: ROW_Y0 300 + ROW_STEP 134.
  const buy = at(600, 300 + 134);
  await page.mouse.click(buy.x, buy.y);
  await expect.poll(async () => JSON.parse((await ls(page, 'workshop')) ?? '{}').shieldStack).toBe(1);
  expect(await ls(page, 'coins')).toBe('85');
  expect(errors).toEqual([]);
});

test('dodge-drop: pickups add one shield at a time up to the Shield Stack cap', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { workshop: '{"shieldStack":2}' }, true);
  const { box } = await openTitle(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => (window as unknown as W).__gk!.state === 'playing');
  await page.waitForFunction(() => (window as unknown as WD).__dd?.giveShield !== undefined && (window as unknown as WD).__dd?.stats?.().t! > 0.5);
  const hits = async () => page.evaluate(() => (window as unknown as WD).__dd!.stats!().shieldHits);
  const before = await hits();
  for (let i = 0; i < 6; i++) await page.evaluate(() => (window as unknown as WD).__dd!.giveShield!());
  expect(before).toBeLessThanOrEqual(1);
  expect(await hits()).toBe(3); // capacity 1 + 2
  expect(errors).toEqual([]);
});

test('dodge-drop: Shop boosts tab buys a shield and the tab choice is remembered', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '100' });
  const { at } = await openTitle(page);
  const shop = at(360, 1280 * 0.72);
  await page.mouse.click(shop.x, shop.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('Shop'));
  await page.waitForTimeout(500);
  const tab = at(360 + 224, 172);
  await page.mouse.click(tab.x, tab.y);
  await expect.poll(() => ls(page, 'shopTab')).toBe('"boosts"');
  await page.waitForTimeout(400);
  const buy = at(600, 300);
  await page.mouse.click(buy.x, buy.y);
  await expect.poll(async () => JSON.parse((await ls(page, 'boosts')) ?? '{}').shields).toBe(1);
  expect(await ls(page, 'coins')).toBe('90');
  expect(errors).toEqual([]);
});

test('dodge-drop: max-level magnet pulls a far star and shield to a stationary player', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { workshop: '{"magnet":5}' }, true);
  const { box } = await openTitle(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => (window as unknown as W).__gk!.state === 'playing');
  await page.waitForFunction(() => (window as unknown as WD).__dd?.stats !== undefined);
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => (window as unknown as WD).__dd!.stats!());
  await page.evaluate(() => {
    const d = (window as unknown as WD).__dd!;
    d.spawnPickup!('star', 60);
    d.spawnPickup!('shield', 660);
  });
  await expect
    .poll(async () => page.evaluate(() => { const s = (window as unknown as WD).__dd!.stats!(); return [s.stars, s.shieldHits]; }), { timeout: 8000 })
    .toEqual([before.stars + 1, before.shieldHits + 1]);
  expect(errors).toEqual([]);
});
