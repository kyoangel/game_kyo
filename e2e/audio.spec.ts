import { expect, test, type Page } from '@playwright/test';
import { skipOnboarding } from './fixtures/onboarding.ts';

type AudioState = { musicSource: 'sample' | 'synth' | 'none'; musicSample: string | null; loaded: string[] };
type W = {
  __gk: { activeScenes: string[]; state: string; audio: AudioState };
  __dd?: { god: boolean; noGraze?: boolean; warp(s: number): void };
};

const audio = (page: Page) => page.evaluate(() => (window as unknown as W).__gk.audio);

async function startRun(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as W).__gk.activeScenes.includes('GKTitle'));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => (window as unknown as W).__gk.state === 'playing' && (window as unknown as W).__dd !== undefined);
}

test('music samples load, start after the first input and switch to the rush loop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await skipOnboarding(page);
  await page.goto('/dodge-drop/?layout=portrait');
  await page.waitForFunction(() => (window as unknown as W).__gk.activeScenes.includes('GKTitle'));

  // Preload waited for the samples (4 music loops + 8 sfx; click stays synth).
  const loaded = (await audio(page)).loaded;
  expect(loaded.filter((n) => n.startsWith('music-')).sort()).toEqual(['music-chomp', 'music-normal', 'music-overdrive', 'music-rush']);
  expect(loaded).toHaveLength(12);
  expect((await audio(page)).musicSource, 'no music before any input').toBe('none');

  await startRun(page);
  await expect.poll(async () => (await audio(page)).musicSource).toBe('sample');
  expect((await audio(page)).musicSample).toBe('music-normal');

  await page.evaluate(() => {
    const dd = (window as unknown as W).__dd!;
    dd.god = true;
    dd.noGraze = true; // a stationary god player grazes a lot in rushes; a graze Chomp would switch to the chomp loop
    dd.warp(46); // first rush window starts at 45 s
  });
  await expect.poll(async () => (await audio(page)).musicSample).toBe('music-rush');

  await page.evaluate(() => (window as unknown as W).__dd!.warp(80)); // past OVERDRIVE_T (120 s)
  await expect.poll(async () => (await audio(page)).musicSample).toBe('music-overdrive');
  expect(errors).toEqual([]);
});

test('with every audio file missing the game boots and the synth sequencer plays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await skipOnboarding(page);
  await page.route('**/assets/audio/**', (r) => r.abort());
  await page.goto('/dodge-drop/?layout=portrait');
  await page.waitForFunction(() => (window as unknown as W).__gk.activeScenes.includes('GKTitle'));
  expect((await audio(page)).loaded).toEqual([]);
  await startRun(page);
  await expect.poll(async () => (await audio(page)).musicSource).toBe('synth');
  expect(errors).toEqual([]);
});
