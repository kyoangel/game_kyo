import { createAdEvents } from '../adEvents.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { Platform } from '../types.ts';
import { SUPPORT_URL } from '../support.ts';

/** Own website. Phase 1: no ads (AdSense H5 comes with the custom domain, spec §5.1 phase 2). */
export function createPlatform(): Platform {
  const events = createAdEvents();
  return {
    id: 'site',
    features: { externalLinks: true, leaderboard: false, rewardedAds: false, fullscreenButton: true },
    supportUrl: SUPPORT_URL,
    async init() {},
    loadingProgress() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    showInterstitial: async () => 'unavailable',
    showRewarded: async () => 'unavailable',
    storage: createSafeLocalStorage('gk:'),
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
