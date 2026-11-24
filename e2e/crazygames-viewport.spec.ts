// e2e/crazygames-viewport.spec.ts
// CrazyGames requires legibility in 16:9 iframes from 800x450 to 1920x1080 and on phones.
import { expect, test, type Page } from '@playwright/test';

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
  await page.screenshot({ path: `${OUT}/play-800x450.png` });
});
