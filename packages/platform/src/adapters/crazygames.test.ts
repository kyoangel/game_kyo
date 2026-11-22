// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { CG_SDK_URL, createPlatform, type CrazyGamesOptions } from './crazygames.ts';

type AdBehaviour = 'finish' | 'error' | 'throw' | 'silent';
interface MockOptions {
  environment?: string;
  ads?: AdBehaviour;
  initFails?: boolean;
  initHangs?: boolean;
  gameThrows?: boolean;
  dataThrows?: boolean;
}

function installMock(o: MockOptions = {}) {
  const calls: string[] = [];
  const data = new Map<string, string>();
  const game = (name: string) => () => {
    calls.push(name);
    if (o.gameThrows) throw new Error('SDK disabled');
  };
  const sdk = {
    environment: o.environment ?? 'crazygames',
    async init() {
      calls.push('init');
      if (o.initFails) throw new Error('init failed');
      if (o.initHangs) await new Promise<void>(() => {});
    },
    game: {
      loadingStart: game('game.loadingStart'),
      loadingStop: game('game.loadingStop'),
      gameplayStart: game('game.gameplayStart'),
      gameplayStop: game('game.gameplayStop'),
    },
    ad: {
      requestAd(
        type: string,
        cb: { adStarted(): void; adFinished(): void; adError(e: { code: string; message: string }): void },
      ) {
        calls.push(`ad.requestAd:${type}`);
        const mode = o.ads ?? 'finish';
        if (mode === 'throw') throw new Error('SDK disabled');
        queueMicrotask(() => {
          if (mode === 'silent') return;
          if (mode === 'error') {
            cb.adError({ code: 'unfilled', message: 'no fill' });
            return;
          }
          cb.adStarted();
          cb.adFinished();
        });
      },
    },
    data: {
      getItem(key: string) {
        if (o.dataThrows) throw new Error('data disabled');
        return data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (o.dataThrows) throw new Error('data disabled');
        data.set(key, value);
      },
    },
  };
  vi.stubGlobal('CrazyGames', { SDK: sdk });
  return { calls, data, sdk };
}

const make = (o: MockOptions = {}, p: CrazyGamesOptions = {}) => {
  const mock = installMock(o);
  const platform = createPlatform({ loadScript: async () => true, ...p });
  return { mock, platform };
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

runPlatformContract('crazygames', {
  normal: () => make().platform,
  failingAds: () => make({ ads: 'throw' }).platform,
});

describe('crazygames adapter specifics', () => {
  it('has id crazygames, no external links, no leaderboard', () => {
    const { platform } = make();
    expect(platform.id).toBe('crazygames');
    expect(platform.features).toEqual({ externalLinks: false, leaderboard: false, rewardedAds: true, fullscreenButton: false });
  });

  it('loads the SDK script once and inits the SDK once even if init is called twice', async () => {
    const mock = installMock();
    const loadScript = vi.fn(async (_url: string, _ms: number) => true);
    const p = createPlatform({ loadScript });
    await p.init();
    await p.init();
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(loadScript).toHaveBeenCalledWith(CG_SDK_URL, expect.any(Number));
    expect(mock.calls.filter((c) => c === 'init')).toHaveLength(1);
  });

  describe('degraded mode', () => {
    it('script load failure: ads unavailable, storage via localStorage, SDK untouched', async () => {
      const mock = installMock();
      const p = createPlatform({ loadScript: async () => false });
      const log: string[] = [];
      p.onAdPause(() => log.push('pause'));
      await p.init();
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(await p.showRewarded()).toBe('unavailable');
      expect(log).toEqual([]);
      await p.storage.set('k', 'v');
      expect(localStorage.getItem('gk:k')).toBe('v');
      p.loadingProgress(0.5);
      p.gameplayStart();
      expect(mock.calls).toEqual([]);
    });

    it('window.CrazyGames missing after load (adblock) is degraded, not an error', async () => {
      const p = createPlatform({ loadScript: async () => true });
      await p.init();
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it('SDK.init rejecting is degraded', async () => {
      const mock = installMock({ initFails: true });
      const p = createPlatform({ loadScript: async () => true });
      await expect(p.init()).resolves.toBeUndefined();
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(mock.calls).toEqual(['init']);
    });

    it('SDK.init hanging past initTimeoutMs is degraded', async () => {
      installMock({ initHangs: true });
      const p = createPlatform({ loadScript: async () => true, initTimeoutMs: 20 });
      await p.init();
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it("environment 'disabled' is degraded and never requests ads", async () => {
      const mock = installMock({ environment: 'disabled' });
      const p = createPlatform({ loadScript: async () => true });
      await p.init();
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(await p.showRewarded()).toBe('unavailable');
      expect(mock.calls.filter((c) => c.startsWith('ad.'))).toEqual([]);
      await p.storage.set('a', '1');
      expect(localStorage.getItem('gk:a')).toBe('1');
    });
  });

  describe('ads', () => {
    it('midgame resolves shown and rewarded resolves rewarded on adFinished, with pause then resume', async () => {
      const { mock, platform } = make();
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(await platform.showRewarded()).toBe('rewarded');
      expect(log).toEqual(['pause', 'resume', 'pause', 'resume']);
      expect(mock.calls).toContain('ad.requestAd:midgame');
      expect(mock.calls).toContain('ad.requestAd:rewarded');
    });

    it('adError resolves unavailable for both kinds and emits no pause/resume', async () => {
      const { platform } = make({ ads: 'error' });
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(await platform.showRewarded()).toBe('unavailable');
      expect(log).toEqual([]);
    });

    it('safety timeout resolves unavailable when the SDK never calls back', async () => {
      const { platform } = make({ ads: 'silent' }, { adTimeoutMs: 20 });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
    });

    it('resumes if the safety timeout fires after adStarted', async () => {
      installMock();
      const sdk = (globalThis as unknown as { CrazyGames: { SDK: { ad: { requestAd: (t: string, cb: { adStarted(): void }) => void } } } })
        .CrazyGames.SDK;
      sdk.ad.requestAd = (_t, cb) => cb.adStarted();
      const p = createPlatform({ loadScript: async () => true, adTimeoutMs: 20 });
      const log: string[] = [];
      p.onAdPause(() => log.push('pause'));
      p.onAdResume(() => log.push('resume'));
      await p.init();
      expect(await p.showRewarded()).toBe('unavailable');
      expect(log).toEqual(['pause', 'resume']);
    });

    it('gates interstitials at 60 s but never gates rewarded', async () => {
      let t = 0;
      const { mock, platform } = make({}, { now: () => t });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      t = 59_999;
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(await platform.showRewarded()).toBe('rewarded');
      expect(mock.calls.filter((c) => c === 'ad.requestAd:midgame')).toHaveLength(1);
      t = 60_000;
      expect(await platform.showInterstitial()).toBe('shown');
    });
  });

  describe('lifecycle', () => {
    it('maps loading and gameplay calls onto the SDK game module', async () => {
      const { mock, platform } = make();
      await platform.init();
      platform.loadingProgress(0.1);
      platform.loadingProgress(0.6);
      platform.loadingDone();
      platform.gameplayStart();
      platform.gameplayStop();
      expect(mock.calls).toEqual(['init', 'game.loadingStart', 'game.loadingStop', 'game.gameplayStart', 'game.gameplayStop']);
    });

    it('loadingDone without any progress does not call loadingStop', async () => {
      const { mock, platform } = make();
      await platform.init();
      platform.loadingDone();
      expect(mock.calls).toEqual(['init']);
    });

    it('swallows SDK exceptions from the game module', async () => {
      const { platform } = make({ gameThrows: true });
      await platform.init();
      expect(() => {
        platform.loadingProgress(0.5);
        platform.loadingDone();
        platform.gameplayStart();
        platform.gameplayStop();
      }).not.toThrow();
    });
  });

  describe('storage', () => {
    it("uses SDK.data with the gk: prefix when environment is 'crazygames'", async () => {
      const { mock, platform } = make();
      await platform.init();
      await platform.storage.set('a', '1');
      expect(mock.data.get('gk:a')).toBe('1');
      mock.data.set('gk:b', '2');
      expect(await platform.storage.get('b')).toBe('2');
    });

    it("uses localStorage (not SDK.data) when environment is 'local'", async () => {
      const { mock, platform } = make({ environment: 'local' });
      await platform.init();
      await platform.storage.set('a', '1');
      expect(mock.data.size).toBe(0);
      expect(localStorage.getItem('gk:a')).toBe('1');
    });

    it('reads a pre-existing localStorage value when SDK.data has none (migration)', async () => {
      const { platform } = make();
      await platform.init();
      localStorage.setItem('gk:old', '9');
      expect(await platform.storage.get('old')).toBe('9');
    });

    it('falls back to localStorage when SDK.data throws', async () => {
      const { platform } = make({ dataThrows: true });
      await platform.init();
      await expect(platform.storage.set('k', 'v')).resolves.toBeUndefined();
      expect(await platform.storage.get('k')).toBe('v');
    });
  });
});
