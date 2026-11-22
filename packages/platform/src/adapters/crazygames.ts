import { createAdEvents } from '../adEvents.ts';
import { createIntervalGate } from '../intervalGate.ts';
import { loadScript as defaultLoadScript } from '../loadScript.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { AdResult, Platform } from '../types.ts';
import { withTimeout } from '../withTimeout.ts';

export const CG_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

interface CgAdCallbacks {
  adStarted(): void;
  adFinished(): void;
  adError(error?: unknown): void;
}

/** Subset of window.CrazyGames.SDK (v3) used here. Every member may throw when the SDK is disabled. */
interface CgSdk {
  environment?: string;
  init(): Promise<void>;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
  };
  ad: { requestAd(type: 'midgame' | 'rewarded', callbacks: CgAdCallbacks): void };
  data: { getItem(key: string): unknown; setItem(key: string, value: string): unknown };
}

export interface CrazyGamesOptions {
  loadScript?: (url: string, timeoutMs: number) => Promise<boolean>;
  loadTimeoutMs?: number;
  initTimeoutMs?: number;
  /** Safety net if the SDK never calls back (default 60 s). */
  adTimeoutMs?: number;
  interstitialMinIntervalMs?: number;
  now?: () => number;
}

const readSdk = (): CgSdk | null =>
  (globalThis as unknown as { CrazyGames?: { SDK?: CgSdk } }).CrazyGames?.SDK ?? null;

export function createPlatform(opts: CrazyGamesOptions = {}): Platform {
  const events = createAdEvents();
  const gate = createIntervalGate(opts.interstitialMinIntervalMs ?? 60_000, opts.now);
  const load = opts.loadScript ?? defaultLoadScript;
  const fallback = createSafeLocalStorage('gk:');
  const adTimeoutMs = opts.adTimeoutMs ?? 60_000;

  /** Non-null only when the SDK initialised and is not disabled. */
  let sdk: CgSdk | null = null;
  let useSdkData = false;
  let loadingStarted = false;
  let initPromise: Promise<void> | null = null;

  async function doInit(): Promise<void> {
    try {
      if (!(await load(CG_SDK_URL, opts.loadTimeoutMs ?? 8000))) return;
      const candidate = readSdk();
      if (!candidate) return;
      const ok = await withTimeout(candidate.init().then(() => true), opts.initTimeoutMs ?? 8000, false);
      if (!ok || candidate.environment === 'disabled') return;
      sdk = candidate;
      useSdkData = candidate.environment === 'crazygames';
    } catch {
      sdk = null;
      useSdkData = false;
    }
  }

  const callSdk = (fn: (s: CgSdk) => void): void => {
    if (!sdk) return;
    try {
      fn(sdk);
    } catch {
      // The SDK throws when disabled; never let that reach the game.
    }
  };

  function requestAd(type: 'midgame' | 'rewarded'): Promise<AdResult> {
    const active = sdk;
    if (!active) return Promise.resolve('unavailable');
    return new Promise<AdResult>((resolve) => {
      let settled = false;
      let paused = false;
      const timer = setTimeout(() => settle('unavailable'), adTimeoutMs);
      const settle = (result: AdResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (paused) {
          paused = false;
          events.emitResume();
        }
        resolve(result);
      };
      try {
        active.ad.requestAd(type, {
          adStarted: () => {
            if (settled || paused) return;
            paused = true;
            events.emitPause();
          },
          adFinished: () => settle(type === 'rewarded' ? 'rewarded' : 'shown'),
          adError: () => settle('unavailable'),
        });
      } catch {
        settle('unavailable');
      }
    });
  }

  return {
    id: 'crazygames',
    features: { externalLinks: false, leaderboard: false, rewardedAds: true, fullscreenButton: false },
    init() {
      initPromise ??= doInit();
      return initPromise;
    },
    loadingProgress() {
      if (loadingStarted) return;
      loadingStarted = true;
      callSdk((s) => s.game.loadingStart());
    },
    loadingDone() {
      if (!loadingStarted) return;
      callSdk((s) => s.game.loadingStop());
    },
    gameplayStart: () => callSdk((s) => s.game.gameplayStart()),
    gameplayStop: () => callSdk((s) => s.game.gameplayStop()),
    async showInterstitial() {
      if (!sdk) return 'unavailable';
      if (!gate.tryPass()) return 'unavailable';
      return requestAd('midgame');
    },
    async showRewarded() {
      if (!sdk) return 'unavailable';
      return requestAd('rewarded');
    },
    storage: {
      async get(key) {
        const active = sdk;
        if (useSdkData && active) {
          try {
            const v = await active.data.getItem(`gk:${key}`);
            if (typeof v === 'string') return v;
          } catch {
            // fall through to the local copy
          }
        }
        return fallback.get(key);
      },
      async set(key, value) {
        await fallback.set(key, value);
        const active = sdk;
        if (useSdkData && active) {
          try {
            await active.data.setItem(`gk:${key}`, value);
          } catch {
            // local copy already stored
          }
        }
      },
    },
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
