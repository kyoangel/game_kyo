import { afterEach, describe, expect, it, vi } from 'vitest';
import { AD_RESULTS, type Platform } from '../types.ts';

export interface ContractFactories {
  /** Adapter in its normal environment (ads may or may not be available). */
  normal: () => Platform;
  /** Adapter whose underlying ad SDK fails/throws. */
  failingAds: () => Platform;
}

/** Every adapter MUST pass this suite. Call it from `<adapter>.test.ts` (jsdom environment). */
export function runPlatformContract(name: string, f: ContractFactories): void {
  describe(`${name} adapter contract`, () => {
    afterEach(() => vi.unstubAllGlobals());

    it('init resolves', async () => {
      await expect(f.normal().init()).resolves.toBeUndefined();
    });

    it('exposes boolean features and a non-empty locale', () => {
      const p = f.normal();
      expect(typeof p.features.externalLinks).toBe('boolean');
      expect(typeof p.features.leaderboard).toBe('boolean');
      expect(typeof p.features.rewardedAds).toBe("boolean");
      expect(typeof p.features.fullscreenButton).toBe("boolean");
      expect(p.locale().length).toBeGreaterThan(0);
    });

    it('lifecycle calls do not throw', async () => {
      const p = f.normal();
      await p.init();
      expect(() => {
        p.loadingProgress(0.5);
        p.loadingDone();
        p.gameplayStart();
        p.gameplayStop();
      }).not.toThrow();
    });

    it('ad calls resolve to a valid AdResult', async () => {
      const p = f.normal();
      await p.init();
      expect(AD_RESULTS).toContain(await p.showInterstitial());
      expect(AD_RESULTS).toContain(await p.showRewarded());
    });

    it('interstitial never resolves rewarded/skipped; rewarded never resolves shown', async () => {
      const p = f.normal();
      await p.init();
      expect(['shown', 'unavailable']).toContain(await p.showInterstitial());
      expect(['rewarded', 'skipped', 'unavailable']).toContain(await p.showRewarded());
    });

    it('ad failures resolve unavailable and never reject', async () => {
      const p = f.failingAds();
      await p.init();
      await expect(p.showInterstitial()).resolves.toBe('unavailable');
      await expect(p.showRewarded()).resolves.toBe('unavailable');
    });

    it('emits pause before and resume after any ad that plays', async () => {
      const p = f.normal();
      const log: string[] = [];
      p.onAdPause(() => log.push('pause'));
      p.onAdResume(() => log.push('resume'));
      await p.init();
      const r = await p.showRewarded();
      expect(log).toEqual(r === 'unavailable' ? [] : ['pause', 'resume']);
    });

    it('storage round-trips and returns null for missing keys', async () => {
      const p = f.normal();
      const key = `contract-${Math.random()}`;
      expect(await p.storage.get(key)).toBeNull();
      await p.storage.set(key, 'v1');
      expect(await p.storage.get(key)).toBe('v1');
    });

    it('storage keeps working when localStorage throws', async () => {
      vi.stubGlobal('localStorage', {
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); },
      });
      const p = f.normal();
      await p.storage.set('k', 'v');
      expect(await p.storage.get('k')).toBe('v');
    });
  });
}
