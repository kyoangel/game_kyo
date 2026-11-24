import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __fakeSdkCalls?: string[];
  }
}

const ROOT = 'dist/portals-smoke';
const PORTALS = [
  {
    platform: 'crazygames',
    port: 5181,
    host: 'sdk.crazygames.com',
    sdkUrl: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
    fixture: 'e2e/fixtures/fake-crazygames-sdk.js',
  },
  {
    platform: 'gamedistribution',
    port: 5182,
    host: 'html5.api.gamedistribution.com',
    sdkUrl: 'https://html5.api.gamedistribution.com/main.min.js',
    fixture: 'e2e/fixtures/fake-gd-sdk.js',
  },
] as const;

function slugsFor(platform: string): string[] {
  return readdirSync('games')
    .filter((d) => existsSync(join('games', d, 'game.json')))
    .filter((d) => (JSON.parse(readFileSync(join('games', d, 'game.json'), 'utf8')).targets as string[]).includes(platform))
    .sort();
}

for (const portal of PORTALS) {
  for (const slug of slugsFor(portal.platform)) {
    test(`${slug} (${portal.platform}): boots against the fake SDK without errors`, async ({ page }) => {
      test.skip(
        !existsSync(join(ROOT, portal.platform, slug, 'index.html')),
        'portal smoke build missing; run `npm run test:portals`',
      );
      const errors: string[] = [];
      const hosts = new Set<string>();
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });
      page.on('request', (r) => {
        const host = new URL(r.url()).hostname;
        if (host !== '' && host !== 'localhost') hosts.add(host);
      });
      const sdkBody = readFileSync(portal.fixture, 'utf8');
      await page.route(portal.sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: sdkBody }));

      await page.goto(`http://localhost:${portal.port}/${slug}/`);
      const calls = () => page.evaluate(() => window.__fakeSdkCalls ?? []);

      if (portal.platform === 'crazygames') {
        // PreloadScene reports loadingProgress(0) up front, so every game (even with no preloaded assets)
        // makes the adapter send loadingStart, then loadingStop on loadingDone, after init.
        await expect.poll(calls, { timeout: 15_000 }).toContain('game.loadingStop');
        const seen = await calls();
        expect(seen[0]).toBe('init');
        expect(seen.indexOf('game.loadingStart')).toBeGreaterThan(seen.indexOf('init'));
        expect(seen.indexOf('game.loadingStop')).toBeGreaterThan(seen.indexOf('game.loadingStart'));
      } else {
        await expect.poll(calls, { timeout: 15_000 }).toContain('SDK_READY');
        expect(await calls()).toContain('GD_OPTIONS.gameId=smoke-test-game-id');
      }

      await page.waitForTimeout(500);
      const box = await page.locator('canvas').boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

      if (portal.platform === 'crazygames') {
        await expect.poll(calls, { timeout: 10_000 }).toContain('game.gameplayStart');
        const after = await calls();
        expect(after.indexOf('game.gameplayStart')).toBeGreaterThan(after.indexOf('game.loadingStop'));
      } else {
        await page.waitForTimeout(500);
      }

      expect([...hosts]).toEqual([portal.host]);
      expect(errors).toEqual([]);
    });
  }
}

// CrazyGames provides its own fullscreen control (platform.features.fullscreenButton = false), so the custom
// button's slot (top-right, one step left of mute) must be inert in both frames. Positive control: the local
// build enters fullscreen from the same spot (e2e/crazygames-viewport.spec.ts).
for (const frame of [{ q: '', w: 1440, h: 810 }, { q: '?layout=portrait', w: 720, h: 1280 }] as const) {
  test(`dodge-drop (crazygames): no custom fullscreen button (${frame.q || 'landscape'})`, async ({ page }) => {
    test.skip(!existsSync(join(ROOT, 'crazygames', 'dodge-drop', 'index.html')), 'portal smoke build missing; run `npm run test:portals`');
    const sdk = PORTALS[0];
    await page.route(sdk.sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(sdk.fixture, 'utf8') }));
    await page.goto(`http://localhost:${sdk.port}/dodge-drop/${frame.q}`);
    await page.waitForTimeout(2000);
    const b = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(b.x + ((frame.w - 136) / frame.w) * b.width, b.y + (60 / frame.h) * b.height);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(false);
  });
}
