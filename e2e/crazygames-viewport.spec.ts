// e2e/crazygames-viewport.spec.ts
// CrazyGames requires legibility in 16:9 iframes from 800x450 to 1920x1080 and on phones.
import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding } from './fixtures/onboarding.ts';

const GAME = 'http://localhost:5180/dodge-drop/';
const OUT = '.superpowers/sdd/meta/v3';

type GK = { frame?: { mode: 'portrait' | 'landscape'; width: number; height: number; fieldX: number; fieldW: number; dispW: number; zoom: number }; activeScenes: string[] };
/** fontPx is the EFFECTIVE canvas px (font size times camera zoom for in-field text). inField marks text drawn inside the play field. */
type DDHud = { name: string; x: number; y: number; fontPx: number; inField: boolean }[];

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __gk?: GK }).__gk?.activeScenes.includes('GKTitle'));
}

const SIZES = [
  { name: '800x450', width: 800, height: 450 },
  { name: '907x510', width: 907, height: 510 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;

for (const s of SIZES) {
  test(`landscape frame at ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto(GAME);
    await ready(page);
    const frame = await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame);
    expect(frame?.mode).toBe('landscape');
    expect(frame!.zoom).toBeCloseTo(810 / 1280, 4);
    const box = (await page.locator('canvas').boundingBox())!;
    expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
    await page.screenshot({ path: `${OUT}/title-${s.name}.png` });
  });
}

test('portrait frame on a phone-sized viewport is unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(GAME);
  await ready(page);
  const frame = await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame);
  expect(frame).toMatchObject({ mode: 'portrait', width: 720, height: 1280, fieldX: 0, fieldW: 720, dispW: 720, zoom: 1 });
});

test('?layout=portrait forces the portrait frame even on a wide window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${GAME}?layout=portrait`);
  await ready(page);
  const frame = await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame);
  expect(frame?.mode).toBe('portrait');
});

test('landscape: HUD text is in side panels and every text is legible (>= 14 css px) at 800x450', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto(GAME);
  await ready(page);
  await page.mouse.click(400, 225); // start (tap anywhere on title)
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  const { hud, frame, scale } = await page.evaluate(() => {
    const w = window as unknown as { __gk: GK; __dd: { hud(): DDHud } };
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    return { hud: w.__dd.hud(), frame: w.__gk.frame!, scale: c.width / w.__gk.frame!.width };
  });
  for (const h of hud) {
    expect(h.fontPx * scale, `${h.name} font in CSS px`).toBeGreaterThanOrEqual(14);
    const insideField = h.x >= frame.fieldX && h.x <= frame.fieldX + frame.dispW;
    // readable HUD (score, timer, combo, best, missions, shields) must be in a panel; only large cues may be in the field
    if (!h.inField) expect(insideField, `${h.name} must be in a side panel`).toBe(false);
  }
  const goal = hud.find((h) => h.name === 'goal');
  expect(goal, 'goal bar text is in the HUD report').toBeTruthy();
  expect(goal!.inField, 'goal bar lives in the left side panel').toBe(false);
  expect(goal!.x).toBeLessThan(frame.fieldX);
  expect(goal!.fontPx * scale, 'goal font in CSS px').toBeGreaterThanOrEqual(14);
  const tutorialRow = hud.find((h) => h.name === 'tutorial');
  expect(tutorialRow, 'first-run tutorial is visible in landscape').toBeTruthy();
  expect(tutorialRow!.fontPx * scale, 'tutorial caption font in CSS px').toBeGreaterThanOrEqual(14);
  await page.screenshot({ path: `${OUT}/play-800x450.png` });
});

type Bound = { name: string; top: number; bottom: number; left: number; right: number; fontPx: number };
type DDBounds = { bounds?: () => Bound[]; results?: unknown };

/** Every text must sit fully on the canvas and render at >= 14 css px. */
async function expectLegibleOnCanvas(page: Page, label: string, w: number, h: number): Promise<void> {
  const rows = await page.evaluate(() => {
    const win = window as unknown as { __dd?: DDBounds; __gk: GK };
    return { items: win.__dd?.bounds?.() ?? null, f: win.__gk.frame! };
  });
  expect(rows.items, 'bounds hook present').not.toBeNull();
  expect(rows.items!.length, `${label}: some text found`).toBeGreaterThan(3);
  const css = Math.min(w / rows.f.width, h / rows.f.height);
  const bad = rows.items!.filter((b) => b.top < 0 || b.bottom > rows.f.height || b.left < 0 || b.right > rows.f.width || b.fontPx * css < 14);
  expect(bad, `${label} at ${w}x${h}`).toEqual([]);
}

const LOCALES = [{ locale: 'en', tag: '' }, { locale: 'zh-TW', tag: 'zh-' }] as const;

for (const L of LOCALES) for (const s of [SIZES[0], SIZES[2]]) {
  test.describe(`locale ${L.locale}`, () => {
  test.use({ locale: L.locale });
  test(`title, shop, play HUD and results fit the landscape canvas and are legible at ${s.name} (${L.locale})`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto(GAME);
    await ready(page);
    await page.waitForTimeout(600); // let async extras (missions, boosts) render
    await page.screenshot({ path: `${OUT}/title-${L.tag}${s.name}.png` });
    await expectLegibleOnCanvas(page, 'title', s.width, s.height);

    // shop: second menu button (centre column), then each tab
    const toCanvas = async (cx: number, cy: number) => {
      const f = (await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame))!;
      const box = (await page.locator('canvas').boundingBox())!;
      return { x: box.x + (cx / f.width) * box.width, y: box.y + (cy / f.height) * box.height };
    };
    const menu = await page.evaluate(() => (window as unknown as { __dd?: { menuAt?: (i: number) => { x: number; y: number } } }).__dd?.menuAt?.(0) ?? null);
    expect(menu, 'title menuAt hook').not.toBeNull();
    const p = await toCanvas(menu!.x, menu!.y);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Shop'));
    for (const tab of [0, 1, 2]) {
      const t = await toCanvas(720 + (tab - 1) * 224, 60);
      await page.mouse.click(t.x, t.y);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/shop-${tab}-${L.tag}${s.name}.png` });
      await expectLegibleOnCanvas(page, `shop tab ${tab}`, s.width, s.height);
    }

    // play HUD
    await page.goto(GAME);
    await ready(page);
    await page.mouse.click(s.width / 2, s.height / 2);
    await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/play-${L.tag}${s.name}.png` });
    const hud = await page.evaluate(() => (window as unknown as { __dd: { hud(): DDHud } }).__dd.hud());
    expect(hud.length, 'play HUD entries').toBeGreaterThan(3);
    const css = Math.min(s.width / 1440, s.height / 810);
    expect(hud.filter((h) => h.fontPx * css < 14 || h.x < 0 || h.x > 1440 || h.y < 0 || h.y > 810).map((h) => h.name), 'play HUD legible and on canvas').toEqual([]);

    // results overlay
    await page.evaluate(() => void (window as unknown as { __gk: { endRound(n: number): Promise<void> } }).__gk.endRound(120));
    await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('GKGameOver'));
    await page.waitForFunction(() => (window as unknown as { __dd?: DDBounds }).__dd?.results !== undefined);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/results-${L.tag}${s.name}.png` });
    await expectLegibleOnCanvas(page, 'results', s.width, s.height);
  });
  });
}

test('landscape results overlay is fully opaque: the paused Play HUD does not show through', async ({ page }) => {
  await skipOnboarding(page); // a clean results band, no tutorial
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto(GAME);
  await ready(page);
  await page.mouse.click(400, 225);
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  await page.waitForTimeout(400); // drag hint + HUD are visible
  await page.evaluate(() => void (window as unknown as { __gk: { endRound(n: number): Promise<void> } }).__gk.endRound(120));
  await page.waitForFunction(() => (window as unknown as { __dd?: DDBounds }).__dd?.results !== undefined);
  await page.waitForTimeout(900);
  // Free band between the results columns, where the Play drag hint sits (css px at 800x450).
  const png = await page.screenshot({ clip: { x: 300, y: 262, width: 150, height: 40 } });
  const spread = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let max = 0;
    for (let ch = 0; ch < 3; ch++) {
      let lo = 255, hi = 0;
      for (let i = ch; i < d.length; i += 4) { lo = Math.min(lo, d[i]!); hi = Math.max(hi, d[i]!); }
      max = Math.max(max, hi - lo);
    }
    return max;
  }, png.toString('base64'));
  expect(spread, 'colour spread in an empty results band (0 = flat background)').toBeLessThanOrEqual(2);
});

test('layout switches on rotation only when no run is in progress', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(GAME);
  await ready(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.frame?.mode === 'landscape');
  await ready(page);
  await page.mouse.click(300, 190);
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame?.mode)).toBe('landscape'); // mid-run: unchanged
  await page.evaluate(() => (window as unknown as { __gk: { endRound(s?: number): Promise<void> } }).__gk.endRound(5));
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.frame?.mode === 'portrait');
});

test('landscape journey: start, play, die, results, retry', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(GAME);
  await ready(page);
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => void (window as unknown as { __gk: { endRound(n: number): Promise<void> } }).__gk.endRound(5));
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('GKGameOver'));
  await page.waitForFunction(() => (window as unknown as { __dd?: DDBounds }).__dd?.results !== undefined);
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const a = (window as unknown as { __gk: GK }).__gk.activeScenes;
    return a.includes('Play') && !a.includes('GKGameOver');
  });
  expect(await page.evaluate(() => (window as unknown as { __gk: GK }).__gk.frame?.mode)).toBe('landscape');
});

test('control: the local build has a custom fullscreen button in the landscape title (top-right slot 1)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(GAME);
  await ready(page);
  await page.waitForTimeout(500);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + ((1440 - 136) / 1440) * box.width, box.y + (60 / 810) * box.height);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null), { timeout: 3000 }).toBe(true);
});

test('with every art file missing the game still boots and plays on the procedural fallback', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/assets/art/**', (r) => r.abort());
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(GAME);
  await ready(page);
  const title = await page.evaluate(() => (window as unknown as { __dd: { textures(): string[] } }).__dd.textures());
  expect(title, 'no logo file -> text title').not.toContain('dd-logo');
  expect(title, 'procedural star generated').toContain('dd-star');
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  await page.waitForTimeout(800);
  const play = await page.evaluate(() => (window as unknown as { __dd: { textures(): string[] } }).__dd.textures());
  for (const k of ['dd-star', 'dd-shield', 'dd-ring']) expect(play).toContain(k);
  expect(play).not.toContain('dd-bg-far');
  expect(errors).toEqual([]);
});

type ArtHook = { __dd: { art(): string[]; textures(): string[] } };

test('authored art is registered and drawn: logo on the title, panel art and parallax layers in landscape play', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(GAME);
  await ready(page);
  const have = await page.evaluate(() => (window as unknown as ArtHook).__dd.textures());
  for (const k of ['dd-logo', 'dd-panel-art', 'dd-bg-far']) expect(have).toContain(k);
  expect(await page.evaluate(() => (window as unknown as ArtHook).__dd.art()), 'title draws the logo').toContain('dd-logo');
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  await page.waitForTimeout(500);
  const play = await page.evaluate(() => (window as unknown as ArtHook).__dd.art());
  for (const k of ['dd-panel-art', 'dd-bg-far', 'dd-bg-mid']) expect(play, `landscape play draws ${k}`).toContain(k);
});

test('portrait play draws the parallax layers but no side-panel art', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(GAME);
  await ready(page);
  await page.mouse.click(187, 333);
  await page.waitForFunction(() => (window as unknown as { __gk: GK }).__gk.activeScenes.includes('Play'));
  await page.waitForTimeout(500);
  const play = await page.evaluate(() => (window as unknown as ArtHook).__dd.art());
  expect(play).toEqual(expect.arrayContaining(['dd-bg-far', 'dd-bg-mid']));
  expect(play).not.toContain('dd-panel-art');
});
