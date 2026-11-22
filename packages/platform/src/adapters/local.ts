import { createAdEvents } from '../adEvents.ts';
import { createIntervalGate } from '../intervalGate.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { AdResult, Platform } from '../types.ts';
import { SUPPORT_URL } from '../support.ts';

/** 'play' = an ad plays (interstitial → shown, rewarded → rewarded). */
export type LocalAdMode = 'play' | 'skipped' | 'unavailable' | 'throw';

export interface LocalOptions {
  adDurationMs?: number;
  interstitialMinIntervalMs?: number;
  now?: () => number;
  adMode?: () => LocalAdMode;
}

/** Dev/test override: window.__GK_LOCAL_AD__ = 'rewarded' | 'skipped' | 'unavailable' | 'throw'. */
function readGlobalMode(): LocalAdMode {
  const v = (globalThis as { __GK_LOCAL_AD__?: unknown }).__GK_LOCAL_AD__;
  if (v === 'skipped' || v === 'unavailable' || v === 'throw') return v;
  return 'play';
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createPlatform(opts: LocalOptions = {}): Platform {
  const events = createAdEvents();
  const gate = createIntervalGate(opts.interstitialMinIntervalMs ?? 0, opts.now);
  const duration = opts.adDurationMs ?? 300;
  const adMode = opts.adMode ?? readGlobalMode;

  async function fakeAd(kind: 'interstitial' | 'rewarded'): Promise<AdResult> {
    try {
      const mode = adMode();
      if (mode === 'throw') throw new Error('simulated ad failure');
      if (mode === 'unavailable') return 'unavailable';
      if (kind === 'interstitial' && mode === 'skipped') return 'unavailable';
      events.emitPause();
      try {
        await delay(duration);
      } finally {
        events.emitResume();
      }
      if (kind === 'interstitial') return 'shown';
      return mode === 'skipped' ? 'skipped' : 'rewarded';
    } catch {
      return 'unavailable';
    }
  }

  return {
    id: 'local',
    features: { externalLinks: true, leaderboard: true, rewardedAds: true, fullscreenButton: true },
    supportUrl: SUPPORT_URL,
    async init() {},
    loadingProgress() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    async showInterstitial() {
      if (!gate.tryPass()) return 'unavailable';
      return fakeAd('interstitial');
    },
    showRewarded: () => fakeAd('rewarded'),
    storage: createSafeLocalStorage('gk:'),
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
