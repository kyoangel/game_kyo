// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createPlatform, type LocalAdMode } from '../../platform/src/adapters/local.ts';
import { GameSession } from './session.ts';

let n = 0;
const setup = (adMode: LocalAdMode = 'play') => {
  const platform = createPlatform({ adDurationMs: 0, adMode: () => adMode });
  const slug = `test-${++n}`;
  return { platform, slug, session: new GameSession(platform, slug) };
};

describe('GameSession', () => {
  it('starts ready with best 0', async () => {
    const { session } = setup();
    await session.loadBest();
    expect(session.state).toBe('ready');
    expect(session.best).toBe(0);
  });

  it('loads a stored best and ignores garbage', async () => {
    const a = setup();
    await a.platform.storage.set(`${a.slug}:best`, '17');
    await a.session.loadBest();
    expect(a.session.best).toBe(17);
    const b = setup();
    await b.platform.storage.set(`${b.slug}:best`, 'NaN-ish');
    await b.session.loadBest();
    expect(b.session.best).toBe(0);
  });

  it('start() calls gameplayStart once', () => {
    const { platform, session } = setup();
    const spy = vi.spyOn(platform, 'gameplayStart');
    session.start();
    session.start();
    expect(session.state).toBe('playing');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('gameOver() stops gameplay and persists a new best only when higher', async () => {
    const { platform, slug, session } = setup();
    const stop = vi.spyOn(platform, 'gameplayStop');
    session.start();
    expect(await session.gameOver(10)).toBe(true);
    expect(session.state).toBe('over');
    expect(stop).toHaveBeenCalledOnce();
    expect(session.best).toBe(10);
    expect(await platform.storage.get(`${slug}:best`)).toBe('10');
    await session.retry();
    await session.gameOver(5);
    expect(session.best).toBe(10);
    expect(session.lastScore).toBe(5);
  });

  it('gameOver() is ignored unless playing', async () => {
    const { session } = setup();
    expect(await session.gameOver(3)).toBe(false);
    expect(session.state).toBe('ready');
  });

  it('breakpoint() stops gameplay around the interstitial and emits pause changes', async () => {
    const { platform, session } = setup();
    const calls: string[] = [];
    vi.spyOn(platform, 'gameplayStop').mockImplementation(() => calls.push('stop'));
    vi.spyOn(platform, 'gameplayStart').mockImplementation(() => calls.push('start'));
    const paused: boolean[] = [];
    session.onPauseChange((p) => paused.push(p));
    session.start();
    expect(await session.breakpoint()).toBe('shown');
    expect(calls).toEqual(['start', 'stop', 'start']);
    expect(paused).toEqual([true, false]);
    expect(session.paused).toBe(false);
  });

  it('breakpoint() does nothing unless playing', async () => {
    const { platform, session } = setup();
    const ad = vi.spyOn(platform, 'showInterstitial');
    expect(await session.breakpoint()).toBe('unavailable');
    expect(ad).not.toHaveBeenCalled();
  });

  it('retry() from over shows an interstitial then plays', async () => {
    const { platform, session } = setup();
    const ad = vi.spyOn(platform, 'showInterstitial');
    session.start();
    await session.gameOver(1);
    await session.retry();
    expect(ad).toHaveBeenCalledOnce();
    expect(session.state).toBe('playing');
  });

  it('rewarded() returns the ad result and resumes gameplay', async () => {
    const { platform, session } = setup('skipped');
    const start = vi.spyOn(platform, 'gameplayStart');
    session.start();
    expect(await session.rewarded()).toBe('skipped');
    expect(start).toHaveBeenCalledTimes(2);
    expect(session.state).toBe('playing');
  });

  it('a failing ad SDK never breaks the flow', async () => {
    const { session } = setup('throw');
    session.start();
    expect(await session.breakpoint()).toBe('unavailable');
    expect(await session.rewarded()).toBe('unavailable');
    expect(session.state).toBe('playing');
  });

  it('pauseGameplay()/resumeGameplay() stop and restart gameplay once each, only while playing', () => {
    const { platform, session } = setup();
    const calls: string[] = [];
    vi.spyOn(platform, 'gameplayStop').mockImplementation(() => calls.push('stop'));
    vi.spyOn(platform, 'gameplayStart').mockImplementation(() => calls.push('start'));
    session.pauseGameplay();
    expect(calls).toEqual([]);
    session.start();
    session.pauseGameplay();
    session.pauseGameplay();
    expect(session.gameplayPaused).toBe(true);
    session.resumeGameplay();
    session.resumeGameplay();
    expect(calls).toEqual(['start', 'stop', 'start']);
    expect(session.gameplayPaused).toBe(false);
  });

  it('gameOver() while paused does not stop gameplay twice', async () => {
    const { platform, session } = setup();
    session.start();
    session.pauseGameplay();
    const stop = vi.spyOn(platform, 'gameplayStop');
    await session.gameOver(3);
    expect(stop).not.toHaveBeenCalled();
    expect(session.gameplayPaused).toBe(false);
  });

  it('a custom best key keeps separate bests', async () => {
    const { platform, slug } = setup();
    await platform.storage.set(`${slug}:best`, '500');
    await platform.storage.set(`${slug}:bestTime`, '42');
    const s = new GameSession(platform, slug, `${slug}:bestTime`);
    await s.loadBest();
    expect(s.best).toBe(42);
  });
});
