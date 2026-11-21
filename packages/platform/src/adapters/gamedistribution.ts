import { createAdEvents } from '../adEvents.ts';
import { createIntervalGate } from '../intervalGate.ts';
import { loadScript as defaultLoadScript } from '../loadScript.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { AdResult, Platform } from '../types.ts';
import { withTimeout } from '../withTimeout.ts';

export const GD_SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js';

interface GdSdk {
  showAd(type?: string): Promise<unknown>;
  preloadAd(type: string): Promise<unknown>;
}

interface GdGlobals {
  GD_OPTIONS?: { gameId: string; onEvent: (event: { name?: string } | undefined) => void };
  gdsdk?: Partial<GdSdk>;
}

export interface GameDistributionOptions {
  /** Defaults to the build-time define `__GK_GD_GAME_ID__` ('' when the game has no portalIds.gamedistribution). */
  gameId?: string;
  loadScript?: (url: string, timeoutMs: number) => Promise<boolean>;
  loadTimeoutMs?: number;
  /** How long to wait for the SDK_READY event after the script loaded (default 8 s). */
  readyTimeoutMs?: number;
  /** Safety net if showAd/preloadAd never settle (default 60 s). */
  adTimeoutMs?: number;
  interstitialMinIntervalMs?: number;
  now?: () => number;
}

export function createPlatform(opts: GameDistributionOptions = {}): Platform {
  const events = createAdEvents();
  const gate = createIntervalGate(opts.interstitialMinIntervalMs ?? 60_000, opts.now);
  const load = opts.loadScript ?? defaultLoadScript;
  const gameId = opts.gameId ?? __GK_GD_GAME_ID__;
  const adTimeoutMs = opts.adTimeoutMs ?? 60_000;
  const g = globalThis as unknown as GdGlobals;

  let active = false;
  let paused = false;
  let rewardedInFlight = false;
  let rewardCompleted = false;
  let initPromise: Promise<void> | null = null;

  const resume = (): void => {
    if (!paused) return;
    paused = false;
    events.emitResume();
  };

  function onEvent(name: string | undefined): void {
    switch (name) {
      case 'SDK_GAME_PAUSE':
        if (!paused) {
          paused = true;
          events.emitPause();
        }
        break;
      case 'SDK_GAME_START':
        resume();
        break;
      case 'SDK_REWARDED_WATCH_COMPLETE':
        if (rewardedInFlight) rewardCompleted = true;
        break;
      default:
        break;
    }
  }

  async function doInit(): Promise<void> {
    if (gameId === '') return;
    try {
      let markReady!: () => void;
      const ready = new Promise<boolean>((resolve) => {
        markReady = () => resolve(true);
      });
      // GD_OPTIONS must exist BEFORE the SDK script executes.
      g.GD_OPTIONS = {
        gameId,
        onEvent: (event) => {
          try {
            onEvent(event?.name);
            if (event?.name === 'SDK_READY') markReady();
          } catch {
            // never throw back into the SDK
          }
        },
      };
      if (!(await load(GD_SDK_URL, opts.loadTimeoutMs ?? 8000))) return;
      active = await withTimeout(ready, opts.readyTimeoutMs ?? 8000, false);
    } catch {
      active = false;
    }
  }

  const usableSdk = (): GdSdk | null => {
    const sdk = g.gdsdk;
    if (!active || !sdk || typeof sdk.showAd !== 'function' || typeof sdk.preloadAd !== 'function') return null;
    return sdk as GdSdk;
  };

  return {
    id: 'gamedistribution',
    features: { externalLinks: false, leaderboard: false, rewardedAds: true },
    init() {
      initPromise ??= doInit();
      return initPromise;
    },
    loadingProgress() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    async showInterstitial(): Promise<AdResult> {
      const sdk = usableSdk();
      if (!sdk) return 'unavailable';
      if (!gate.tryPass()) return 'unavailable';
      try {
        return await withTimeout(sdk.showAd().then((): AdResult => 'shown'), adTimeoutMs, 'unavailable');
      } catch {
        return 'unavailable';
      } finally {
        resume();
      }
    },
    async showRewarded(): Promise<AdResult> {
      const sdk = usableSdk();
      if (!sdk) return 'unavailable';
      try {
        const preloaded = await withTimeout(sdk.preloadAd('rewarded').then(() => true), adTimeoutMs, false);
        if (!preloaded) return 'unavailable';
        rewardedInFlight = true;
        rewardCompleted = false;
        const finished = await withTimeout(sdk.showAd('rewarded').then(() => true), adTimeoutMs, false);
        if (!finished) return 'unavailable';
        // showAd resolving is NOT proof of reward; only SDK_REWARDED_WATCH_COMPLETE is.
        return rewardCompleted ? 'rewarded' : 'skipped';
      } catch {
        return 'unavailable';
      } finally {
        rewardedInFlight = false;
        resume();
      }
    },
    storage: createSafeLocalStorage('gk:'),
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
