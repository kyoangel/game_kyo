import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding } from './fixtures/onboarding.ts';

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

  await page.goto('/dodge-drop/?layout=portrait');
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
  await page.goto('/dodge-drop/?layout=portrait');
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

const MISSIONS_SEED = `{"active":[{"id":"chompEat","tier":1,"progress":0},{"id":"starsRun","tier":1,"progress":0},{"id":"runs","tier":1,"progress":0}],"stars":0,"rank":1,"completedCount":0}`;

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
  await page.goto('/dodge-drop/?layout=portrait');
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

test('dodge-drop: retired graze upgrades (Daredevil, Longer Chomp) are refunded once on the title', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '10', workshop: '{"shield":2,"nearMiss":5,"combo":1}' });
  await openTitle(page);
  // 236 (all five Daredevil levels) + 15 (one Longer Chomp level) on top of the 10 held.
  await expect.poll(async () => await ls(page, 'coins')).toBe('261');
  expect(JSON.parse((await ls(page, 'workshop')) ?? '{}')).toEqual({ shield: 2, shieldStack: 0, startShield: 0, magnet: 0, luck: 0, grazeCharge: 0 });
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('GKTitle'));
  await page.waitForTimeout(300);
  expect(await ls(page, 'coins'), 'paid once').toBe('261');
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
  expect(r.missions.map((m) => m.id)).toEqual(['chompEat', 'starsRun', 'runs']);
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
  expect(s.t).toBeGreaterThanOrEqual(30);
  expect(s.t).toBeLessThan(33);
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
  expect(saved.active[0].id).not.toBe('chompEat');
  expect(errors).toEqual([]);
});

test('dodge-drop: enlarged hit areas never fire the neighbouring row (tap low on the first skip swaps the first mission)', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '100', missions: MISSIONS_SEED });
  const { at } = await openTitle(page);
  await page.waitForTimeout(500);
  const before = JSON.parse((await ls(page, 'missions'))!);
  // First skip button is 42 px tall (+-21) at y 996; its 88 px hit area overlaps the second row (y 1048). 18 px low is
  // still on the first button but 34 px from the second centre: the first mission must be the one swapped.
  const skip = at(648, 996 + 18);
  await page.mouse.click(skip.x, skip.y);
  await expect.poll(() => ls(page, 'coins')).toBe('95');
  const saved = JSON.parse((await ls(page, 'missions'))!);
  expect(saved.active[0].id).not.toBe(before.active[0].id);
  expect(saved.active[1].id).toBe(before.active[1].id);
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
  await page.waitForFunction(() => ((window as unknown as { __dd?: { stats?: () => { t: number } } }).__dd?.stats?.().t ?? 0) >= 59);
  await page.evaluate(() => (window as unknown as { __dd: { warp: (s: number) => void } }).__dd.warp(90));
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
    // Pull speed is game-time (frame-rate bound): on a loaded machine Phaser runs at a fraction of 60 fps, so give it room.
    .poll(async () => page.evaluate(() => { const s = (window as unknown as WD).__dd!.stats!(); return [s.stars, s.shieldHits]; }), { timeout: 22000 })
    .toEqual([before.stars + 1, before.shieldHits + 1]);
  expect(errors).toEqual([]);
});

type DDTut = { visible: boolean; kind: 'touch' | 'keys' };
const tut = (page: Page) => page.evaluate(() => (window as unknown as { __dd: { tutorial(): DDTut } }).__dd.tutorial());

async function startRun(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('GKTitle'));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => { const g = (window as unknown as W).__gk!; return g.state === 'playing' && g.activeScenes.includes('Play'); });
  await page.waitForFunction(() => (window as unknown as { __dd?: unknown }).__dd !== undefined);
}

test('dodge-drop: first run shows the visual control tutorial; first input dismisses it; second run does not show it', async ({ page }) => {
  await page.goto('/dodge-drop/?layout=portrait'); // fresh context: empty localStorage
  await startRun(page);
  expect(await tut(page)).toEqual({ visible: true, kind: 'keys' });
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await tut(page)).visible).toBe(false);
  // same browser profile (localStorage persists across reload): stored onboarding says completed
  await page.reload();
  await startRun(page);
  expect((await tut(page)).visible).toBe(false);
});

test('dodge-drop: tutorial times out by itself when the player does nothing', async ({ page }) => {
  await page.goto('/dodge-drop/?layout=portrait');
  await startRun(page);
  await page.evaluate(() => { (window as unknown as { __dd: { god: boolean } }).__dd.god = true; });
  expect((await tut(page)).visible).toBe(true);
  // The tutorial clock is game time (dt capped at 50 ms/frame), which crawls on CI's software GL; jump it past
  // TUTORIAL_SECONDS instead of waiting on wall-clock time.
  await page.evaluate(() => (window as unknown as { __dd: { warp(s: number): void } }).__dd.warp(7));
  await expect.poll(async () => (await tut(page)).visible, { timeout: 12000 }).toBe(false);
});

test('dodge-drop: skipOnboarding fixture suppresses the tutorial', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/dodge-drop/?layout=portrait');
  await startRun(page);
  expect((await tut(page)).visible).toBe(false);
});

test('goal bar shows the next medal and fills as the run proceeds', async ({ page }) => {
  await page.goto('/dodge-drop/?layout=portrait');
  await startRun(page);
  type G = { text: string; frac: number; id: string };
  const dd = (page: Page) => page.evaluate(() => (window as unknown as { __dd: { goal(): G } }).__dd.goal());
  const g0 = await dd(page);
  expect(g0.id).toBe('bronze');
  expect(g0.text).toMatch(/Bronze/);
  await page.evaluate(() => { const d = (window as unknown as { __dd: { god: boolean; warp(s: number): void } }).__dd; d.god = true; d.warp(7); });
  await expect.poll(async () => (await dd(page)).frac).toBeGreaterThan(0.4);
  await page.evaluate(() => (window as unknown as { __dd: { warp(s: number): void } }).__dd.warp(10));
  await expect.poll(async () => (await dd(page)).id).toBe('silver');
  // The label counts the seconds left to the medal, not the medal's clock time (30 s).
  const t = await page.evaluate(() => (window as unknown as { __dd: { stats(): { t: number } } }).__dd.stats().t);
  const left = Number(/in (\d+) s/.exec((await dd(page)).text)?.[1]);
  expect(left).toBeGreaterThan(0);
  expect(Math.abs(left - (30 - t))).toBeLessThanOrEqual(2);
});

test('dodge-drop: title boost bar - a second tap on an equipped boost refunds it', async ({ page }) => {
  const errors = watch(page);
  await seed(page, { coins: '100' });
  const { at } = await openTitle(page);
  // Portrait boost bar: y = 0.45H, buttons at cx + (i - 1) * 220 -> Mini (shrink) is the middle one.
  const mini = at(360, Math.round(1280 * 0.45));
  await page.mouse.click(mini.x, mini.y);
  await expect.poll(async () => JSON.parse((await ls(page, 'boosts')) ?? '{}').shrink).toBe(true);
  expect(await ls(page, 'coins')).toBe('85');
  await page.waitForTimeout(300);
  await page.mouse.click(mini.x, mini.y);
  await expect.poll(async () => JSON.parse((await ls(page, 'boosts')) ?? '{}').shrink).toBe(false);
  expect(await ls(page, 'coins')).toBe('100');
  // Neither tap started the run.
  expect(await page.evaluate(() => (window as unknown as W).__gk!.activeScenes)).toContain('GKTitle');
  expect(errors).toEqual([]);
});

type DdPause = {
  stats(): { t: number; paused: boolean; dead: boolean };
  pauseButton(): { x: number; y: number } | null;
  pauseMenu(): { resume: { x: number; y: number }; end: { x: number; y: number } } | null;
};
type WP = { __dd: DdPause };

test('dodge-drop: pause button freezes the run, Resume continues, End run goes to results without a revive', async ({ page }) => {
  const errors = watch(page);
  await skipOnboarding(page);
  await seed(page, {}, true);
  const { box } = await openTitle(page);
  await startRun(page);
  await page.waitForFunction(() => ((window as unknown as WP).__dd.stats?.().t ?? 0) > 1);
  const toPage = (p: { x: number; y: number }) => ({ x: box.x + (p.x / 720) * box.width, y: box.y + (p.y / 1280) * box.height });

  const btn = await page.evaluate(() => (window as unknown as WP).__dd.pauseButton());
  expect(btn).not.toBeNull();
  const b = toPage(btn!);
  await page.mouse.click(b.x, b.y);
  await page.waitForFunction(() => (window as unknown as WP).__dd.stats().paused);
  const t0 = await page.evaluate(() => (window as unknown as WP).__dd.stats().t);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as unknown as WP).__dd.stats().t)).toBe(t0);

  const menu = (await page.evaluate(() => (window as unknown as WP).__dd.pauseMenu()))!;
  const r = toPage(menu.resume);
  await page.mouse.click(r.x, r.y);
  await page.waitForFunction(() => !(window as unknown as WP).__dd.stats().paused);
  await page.waitForFunction((t) => (window as unknown as WP).__dd.stats().t > t + 0.2, t0);

  // Esc reopens it; End run settles straight to the results (no revive panel).
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as unknown as WP).__dd.stats().paused);
  const m2 = (await page.evaluate(() => (window as unknown as WP).__dd.pauseMenu()))!;
  const e = toPage(m2.end);
  await page.mouse.click(e.x, e.y);
  await page.waitForFunction(() => (window as unknown as W).__gk!.activeScenes.includes('GKGameOver'));
  expect(await page.evaluate(() => (window as unknown as W).__gk!.state)).toBe('over');
  expect(errors).toEqual([]);
});

test('dodge-drop: 8 near misses fill the graze gauge and grant a shield (never Chomp); the HUD shows the run time', async ({ page }) => {
  const errors = watch(page);
  await skipOnboarding(page);
  await seed(page, {}, true);
  await openTitle(page);
  await startRun(page);
  type S = { graze: number; chomping: boolean; shieldHits: number; t: number };
  type D = { stats(): S; nearMiss(): void; hud(): Array<{ name: string }> };
  const stats = (): Promise<S> => page.evaluate(() => (window as unknown as { __dd: D }).__dd.stats());
  const graze = (n: number) => page.evaluate((k) => { for (let i = 0; i < k; i++) (window as unknown as { __dd: D }).__dd.nearMiss(); }, n);
  await page.waitForFunction(() => ((window as unknown as { __dd: D }).__dd.stats?.().t ?? 0) > 0.5);
  expect((await stats()).shieldHits).toBe(0);
  await graze(7);
  expect(await stats()).toMatchObject({ graze: 7, shieldHits: 0, chomping: false });
  await graze(1);
  expect(await stats()).toMatchObject({ graze: 0, shieldHits: 1, chomping: false });
  // Capacity 1 without Shield Stack: the gauge fills and waits instead of wasting the shield.
  await graze(9);
  expect(await stats()).toMatchObject({ graze: 8, shieldHits: 1, chomping: false });
  const names = (await page.evaluate(() => (window as unknown as { __dd: D }).__dd.hud())).map((h) => h.name);
  expect(names).toContain('timer');
  expect(names).not.toContain('score');
  expect(errors).toEqual([]);
});

test('dodge-drop: Graze Charger 3 needs only 5 near misses per shield (5-segment gauge)', async ({ page }) => {
  const errors = watch(page);
  await skipOnboarding(page);
  await seed(page, { workshop: '{"grazeCharge":3,"shieldStack":1}' }, true);
  await openTitle(page);
  await startRun(page);
  type S = { graze: number; shieldHits: number; t: number };
  type D = { stats(): S; nearMiss(): void };
  const stats = (): Promise<S> => page.evaluate(() => (window as unknown as { __dd: D }).__dd.stats());
  const graze = (n: number) => page.evaluate((k) => { for (let i = 0; i < k; i++) (window as unknown as { __dd: D }).__dd.nearMiss(); }, n);
  await page.waitForFunction(() => ((window as unknown as { __dd: D }).__dd.stats?.().t ?? 0) > 0.5);
  await graze(4);
  expect(await stats()).toMatchObject({ graze: 4, shieldHits: 0 });
  await graze(1);
  expect(await stats()).toMatchObject({ graze: 0, shieldHits: 1 });
  await graze(5);
  expect(await stats()).toMatchObject({ graze: 0, shieldHits: 2 });
  expect(errors).toEqual([]);
});

test('dodge-drop: standing still for 3 s drops an aimed block on the player', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = watch(page);
  await skipOnboarding(page);
  await seed(page, {}, true);
  await openTitle(page);
  await startRun(page);
  type S = { aimed: number; t: number };
  type D = { stats(): S };
  const stats = (): Promise<S> => page.evaluate(() => (window as unknown as { __dd: D }).__dd.stats());
  await page.waitForFunction(() => ((window as unknown as { __dd: D }).__dd.stats?.().t ?? 0) > 1);
  expect((await stats()).aimed).toBe(0);
  // The god player never moves: one aimed block after warm-up (2 s) + 3 s still (game clock; CI's software GL runs slow).
  await page.waitForFunction(() => (window as unknown as { __dd: D }).__dd.stats().aimed >= 1, undefined, { timeout: 40_000 });
  expect((await stats()).t).toBeGreaterThan(4.5);
  expect(errors).toEqual([]);
});
