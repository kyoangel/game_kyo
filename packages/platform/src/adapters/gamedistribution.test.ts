// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { GD_SDK_URL, createPlatform, type GameDistributionOptions } from './gamedistribution.ts';

interface EnvOptions {
  ready?: boolean;
  loadOk?: boolean;
  showAd?: 'ok' | 'reject' | 'hang';
  /** Fire SDK_REWARDED_WATCH_COMPLETE during a rewarded showAd. */
  watch?: boolean;
  /** Fire SDK_GAME_START after the ad (real SDK does; a broken one may not). */
  sendStart?: boolean;
  preload?: 'ok' | 'reject';
}

type GdOptionsGlobal = { GD_OPTIONS?: { gameId: string; onEvent(e: { name: string }): void } };
const emit = (name: string): void => (globalThis as unknown as GdOptionsGlobal).GD_OPTIONS!.onEvent({ name });

function makeEnv(o: EnvOptions = {}) {
  const calls: string[] = [];
  const urls: string[] = [];
  let optionsAtLoad: GdOptionsGlobal['GD_OPTIONS'];
  const gdsdk = {
    async preloadAd(type: string) {
      calls.push(`preloadAd:${type}`);
      if (o.preload === 'reject') throw new Error('no ad');
    },
    async showAd(type?: string) {
      calls.push(`showAd:${type ?? 'interstitial'}`);
      emit('SDK_GAME_PAUSE');
      if (o.showAd === 'hang') return new Promise<void>(() => {});
      if (o.showAd === 'reject') throw new Error('ad error');
      if (type === 'rewarded' && o.watch) emit('SDK_REWARDED_WATCH_COMPLETE');
      if (o.sendStart !== false) emit('SDK_GAME_START');
    },
  };
  const loadScript = async (url: string, _ms: number): Promise<boolean> => {
    urls.push(url);
    optionsAtLoad = (globalThis as unknown as GdOptionsGlobal).GD_OPTIONS;
    if (o.loadOk === false) return false;
    vi.stubGlobal('gdsdk', gdsdk);
    if (o.ready !== false) setTimeout(() => emit('SDK_READY'), 0);
    return true;
  };
  return { calls, urls, loadScript, optionsAtLoad: () => optionsAtLoad };
}

const make = (o: EnvOptions = {}, p: GameDistributionOptions = {}) => {
  const env = makeEnv(o);
  const platform = createPlatform({ gameId: 'test-game-id', loadScript: env.loadScript, ...p });
  return { env, platform };
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as unknown as GdOptionsGlobal).GD_OPTIONS;
  localStorage.clear();
});

runPlatformContract('gamedistribution', {
  normal: () => make({ watch: true }).platform,
  failingAds: () => make({ showAd: 'reject', preload: 'reject' }).platform,
});

describe('gamedistribution adapter specifics', () => {
  it('has id gamedistribution, no external links, no leaderboard', () => {
    const { platform } = make();
    expect(platform.id).toBe('gamedistribution');
    expect(platform.features).toEqual({ externalLinks: false, leaderboard: false, rewardedAds: true, fullscreenButton: false });
    expect(platform.supportUrl).toBeUndefined();
  });

  it('sets GD_OPTIONS (gameId + onEvent) BEFORE loading the SDK script', async () => {
    const { env, platform } = make();
    await platform.init();
    expect(env.urls).toEqual([GD_SDK_URL]);
    const opts = env.optionsAtLoad();
    expect(opts?.gameId).toBe('test-game-id');
    expect(typeof opts?.onEvent).toBe('function');
  });

  describe('degraded mode', () => {
    it('empty gameId: never loads the script, ads unavailable', async () => {
      const env = makeEnv();
      const p = createPlatform({ gameId: '', loadScript: env.loadScript });
      await p.init();
      expect(env.urls).toEqual([]);
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it('the build-time default gameId is empty under test, hence degraded', async () => {
      const env = makeEnv();
      const p = createPlatform({ loadScript: env.loadScript });
      await p.init();
      expect(env.urls).toEqual([]);
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it('script load failure is degraded and init still resolves', async () => {
      const { env, platform } = make({ loadOk: false });
      await expect(platform.init()).resolves.toBeUndefined();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(env.calls).toEqual([]);
    });

    it('SDK_READY never arriving within readyTimeoutMs is degraded', async () => {
      const { env, platform } = make({ ready: false }, { readyTimeoutMs: 20 });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(env.calls).toEqual([]);
    });

    it('degraded storage still round-trips through localStorage with the gk: prefix', async () => {
      const p = createPlatform({ gameId: '', loadScript: async () => false });
      await p.storage.set('x', '1');
      expect(localStorage.getItem('gk:x')).toBe('1');
      expect(await p.storage.get('x')).toBe('1');
    });
  });

  describe('pause/resume events', () => {
    it('maps SDK_GAME_PAUSE to pause and SDK_GAME_START to resume', async () => {
      const { platform } = make();
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      emit('SDK_GAME_PAUSE');
      emit('SDK_GAME_PAUSE');
      emit('SDK_GAME_START');
      expect(log).toEqual(['pause', 'resume']);
    });

    it('ignores SDK_GAME_START when not paused', async () => {
      const { platform } = make();
      const log: string[] = [];
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      emit('SDK_GAME_START');
      expect(log).toEqual([]);
    });

    it('resumes after an ad even when the SDK never sends SDK_GAME_START', async () => {
      const { platform } = make({ sendStart: false });
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(log).toEqual(['pause', 'resume']);
    });
  });

  describe('interstitial', () => {
    it('resolves shown via gdsdk.showAd()', async () => {
      const { env, platform } = make();
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(env.calls).toEqual(['showAd:interstitial']);
    });

    it('resolves unavailable when showAd rejects', async () => {
      const { platform } = make({ showAd: 'reject' });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
    });

    it('resolves unavailable and resumes when showAd hangs past adTimeoutMs', async () => {
      const { platform } = make({ showAd: 'hang' }, { adTimeoutMs: 20 });
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(log).toEqual(['pause', 'resume']);
    });

    it('is gated at 60 s', async () => {
      let t = 0;
      const { env, platform } = make({}, { now: () => t });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      t = 59_999;
      expect(await platform.showInterstitial()).toBe('unavailable');
      t = 60_000;
      expect(await platform.showInterstitial()).toBe('shown');
      expect(env.calls.filter((c) => c === 'showAd:interstitial')).toHaveLength(2);
    });
  });

  describe('rewarded', () => {
    it("is 'rewarded' ONLY when SDK_REWARDED_WATCH_COMPLETE fired during the call", async () => {
      const { env, platform } = make({ watch: true });
      await platform.init();
      expect(await platform.showRewarded()).toBe('rewarded');
      expect(env.calls).toEqual(['preloadAd:rewarded', 'showAd:rewarded']);
    });

    it("is 'skipped' when the ad showed but no WATCH_COMPLETE arrived", async () => {
      const { platform } = make({ watch: false });
      await platform.init();
      expect(await platform.showRewarded()).toBe('skipped');
    });

    it('a WATCH_COMPLETE from outside the call does not leak into the next rewarded call', async () => {
      const { platform } = make({ watch: false });
      await platform.init();
      emit('SDK_REWARDED_WATCH_COMPLETE');
      expect(await platform.showRewarded()).toBe('skipped');
    });

    it('preloadAd rejection is unavailable and showAd is not called', async () => {
      const { env, platform } = make({ preload: 'reject', watch: true });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
      expect(env.calls).toEqual(['preloadAd:rewarded']);
    });

    it('showAd rejection is unavailable', async () => {
      const { platform } = make({ showAd: 'reject', watch: true });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
    });

    it('hanging showAd resolves unavailable after adTimeoutMs', async () => {
      const { platform } = make({ showAd: 'hang' }, { adTimeoutMs: 20 });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
    });

    it('is not gated by the interstitial interval', async () => {
      let t = 0;
      const { platform } = make({ watch: true }, { now: () => t });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(await platform.showRewarded()).toBe('rewarded');
    });
  });
});
