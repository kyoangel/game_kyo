export type PlatformId = 'local' | 'site' | 'crazygames' | 'gamedistribution';

/** 'shown' = interstitial played; 'rewarded'/'skipped' = rewarded ad outcome; 'unavailable' = no ad (any failure). */
export type AdResult = 'shown' | 'rewarded' | 'skipped' | 'unavailable';

export const AD_RESULTS: readonly AdResult[] = ['shown', 'rewarded', 'skipped', 'unavailable'];

export interface PlatformFeatures {
  externalLinks: boolean;
  leaderboard: boolean;
  rewardedAds: boolean;
  /** Show the in-game fullscreen toggle (only the site; portals provide their own). */
  fullscreenButton: boolean;
}

export interface PlatformStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface Platform {
  readonly id: PlatformId;
  readonly features: PlatformFeatures;
  init(): Promise<void>;
  loadingProgress(ratio: number): void;
  loadingDone(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<AdResult>;
  showRewarded(): Promise<AdResult>;
  storage: PlatformStorage;
  locale(): string;
  onAdPause(cb: () => void): void;
  onAdResume(cb: () => void): void;
}
