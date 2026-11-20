import type { AdResult, Platform } from '@gf/platform';

export type SessionState = 'ready' | 'playing' | 'over';

/** Owns gameplay state, best score and ad orchestration. No Phaser dependency (unit-testable). */
export class GameSession {
  state: SessionState = 'ready';
  lastScore = 0;
  best = 0;
  private readonly platform: Platform;
  private readonly bestKey: string;
  private adPaused = false;
  private readonly listeners: Array<(paused: boolean) => void> = [];

  constructor(platform: Platform, slug: string) {
    this.platform = platform;
    this.bestKey = `${slug}:best`;
    platform.onAdPause(() => this.setAdPaused(true));
    platform.onAdResume(() => this.setAdPaused(false));
  }

  get paused(): boolean {
    return this.adPaused;
  }

  onPauseChange(cb: (paused: boolean) => void): void {
    this.listeners.push(cb);
  }

  async loadBest(): Promise<void> {
    const raw = await this.platform.storage.get(this.bestKey);
    const value = raw === null ? 0 : Number(raw);
    this.best = Number.isFinite(value) && value > 0 ? value : 0;
  }

  start(): void {
    if (this.state === 'playing') return;
    this.state = 'playing';
    this.platform.gameplayStart();
  }

  async gameOver(score: number): Promise<boolean> {
    if (this.state !== 'playing') return false;
    this.state = 'over';
    this.lastScore = score;
    this.platform.gameplayStop();
    if (score > this.best) {
      this.best = score;
      await this.platform.storage.set(this.bestKey, String(score));
    }
    return true;
  }

  /** Natural pause point during play (e.g. between levels). The adapter decides whether an ad runs. */
  async breakpoint(): Promise<AdResult> {
    if (this.state !== 'playing') return 'unavailable';
    this.platform.gameplayStop();
    try {
      return await this.platform.showInterstitial();
    } finally {
      this.platform.gameplayStart();
    }
  }

  async retry(): Promise<void> {
    if (this.state !== 'over') return;
    await this.platform.showInterstitial();
    this.start();
  }

  async rewarded(): Promise<AdResult> {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) this.platform.gameplayStop();
    try {
      return await this.platform.showRewarded();
    } finally {
      if (wasPlaying) this.platform.gameplayStart();
    }
  }

  private setAdPaused(paused: boolean): void {
    if (this.adPaused === paused) return;
    this.adPaused = paused;
    for (const cb of this.listeners) cb(paused);
  }
}
