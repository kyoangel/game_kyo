// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { createPlatform } from './local.ts';

runPlatformContract('local', {
  normal: () => createPlatform({ adDurationMs: 0 }),
  failingAds: () => createPlatform({ adDurationMs: 0, adMode: () => 'throw' }),
});

describe('local adapter specifics', () => {
  it('is id local with all features on', () => {
    const p = createPlatform();
    expect(p.id).toBe('local');
    expect(p.features).toEqual({ externalLinks: true, leaderboard: true, rewardedAds: true, fullscreenButton: true });
  });

  it('interstitial resolves shown, rewarded resolves rewarded by default', async () => {
    const p = createPlatform({ adDurationMs: 0 });
    expect(await p.showInterstitial()).toBe('shown');
    expect(await p.showRewarded()).toBe('rewarded');
  });

  it('honours adMode skipped / unavailable', async () => {
    expect(await createPlatform({ adDurationMs: 0, adMode: () => 'skipped' }).showRewarded()).toBe('skipped');
    expect(await createPlatform({ adDurationMs: 0, adMode: () => 'unavailable' }).showInterstitial()).toBe('unavailable');
  });

  it('frequency-caps interstitials', async () => {
    let t = 0;
    const p = createPlatform({ adDurationMs: 0, interstitialMinIntervalMs: 1000, now: () => t });
    expect(await p.showInterstitial()).toBe('shown');
    t = 500;
    expect(await p.showInterstitial()).toBe('unavailable');
    t = 1000;
    expect(await p.showInterstitial()).toBe('shown');
  });

  it('reads window.__GK_LOCAL_AD__ when no adMode is given', async () => {
    (globalThis as { __GK_LOCAL_AD__?: string }).__GK_LOCAL_AD__ = 'unavailable';
    try {
      expect(await createPlatform({ adDurationMs: 0 }).showRewarded()).toBe('unavailable');
    } finally {
      delete (globalThis as { __GK_LOCAL_AD__?: string }).__GK_LOCAL_AD__;
    }
  });
});
