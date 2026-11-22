// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { createPlatform } from './site.ts';

runPlatformContract('site', { normal: () => createPlatform(), failingAds: () => createPlatform() });

describe('site adapter (phase 1)', () => {
  it('has no ads yet and allows external links', async () => {
    const p = createPlatform();
    expect(p.id).toBe('site');
    expect(p.features).toEqual({ externalLinks: true, leaderboard: false, rewardedAds: false, fullscreenButton: true });
    expect(p.supportUrl).toBe('https://p.ecpay.com.tw/17369E9');
    expect(await p.showInterstitial()).toBe('unavailable');
    expect(await p.showRewarded()).toBe('unavailable');
  });

  it('stores under the gk: prefix (lobby reads gk:<slug>:best)', async () => {
    await createPlatform().storage.set('demo:best', '42');
    expect(localStorage.getItem('gk:demo:best')).toBe('42');
  });
});
