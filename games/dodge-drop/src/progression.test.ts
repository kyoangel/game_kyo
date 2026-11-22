import { describe, expect, it } from 'vitest';
import {
  advanceStartTier, availableTiers, DEFAULT_ASSIST, HEAD_START_SCORE, headStartScore, nextLossStreak, runCoins,
  rushesBefore, rushStartAt, sanitizeAssist, sanitizeStartTier, START_TIERS, tierSeconds, updateAssist, type AssistState,
} from './progression.ts';

describe('loss streak', () => {
  it('increments below 30 s, resets at 30 s or more', () => {
    expect(nextLossStreak(0, 12)).toBe(1);
    expect(nextLossStreak(2, 29)).toBe(3);
    expect(nextLossStreak(2, 30)).toBe(0);
    expect(nextLossStreak(5, 75)).toBe(0);
  });
});

describe('runCoins', () => {
  const base = { headStart: 0, lossStreak: 0, rankMultiplier: 1 };
  it('base = stars + floor(score/25), no floor or multiplier', () => {
    expect(runCoins({ ...base, score: 100, stars: 3 })).toEqual({ coins: 7, base: 7, floor: 0, multiplier: 1, floorApplied: false });
  });
  it('loss-streak floor is min(10, 2*streak) and applies only when above base', () => {
    expect(runCoins({ ...base, score: 25, stars: 0, lossStreak: 2 })).toMatchObject({ coins: 4, base: 1, floor: 4, floorApplied: true });
    expect(runCoins({ ...base, score: 0, stars: 0, lossStreak: 9 })).toMatchObject({ coins: 10, floor: 10, floorApplied: true });
    expect(runCoins({ ...base, score: 250, stars: 0, lossStreak: 1 })).toMatchObject({ coins: 10, floorApplied: false });
  });
  it('rank multiplier multiplies max(base, floor) and rounds', () => {
    expect(runCoins({ ...base, score: 250, stars: 0, rankMultiplier: 1.1 })).toMatchObject({ coins: 11, multiplier: 1.1 });
    expect(runCoins({ ...base, score: 500, stars: 0, rankMultiplier: 1.35 })).toMatchObject({ coins: 27 });
    expect(runCoins({ ...base, score: 25, stars: 0, lossStreak: 3, rankMultiplier: 1.1 })).toMatchObject({ coins: 7, floor: 6 });
  });
  it('head-start score earns no coins', () => {
    expect(runCoins({ ...base, score: 300 + 50, headStart: 300, stars: 0 })).toMatchObject({ coins: 2 });
    expect(runCoins({ ...base, score: 100, headStart: 300, stars: 0 })).toMatchObject({ coins: 0 });
  });
});

describe('assist state machine', () => {
  const run = (score: number, seconds: number, bronzeOwned = false) => ({ score, seconds, bronzeOwned });
  it('starts inactive', () => {
    expect(DEFAULT_ASSIST).toEqual({ zeroStreak: 0, noBronzeStreak: 0, active: false, retired: false });
  });
  it('turns on after 2 consecutive zero-score runs', () => {
    let s = updateAssist(DEFAULT_ASSIST, run(0, 3));
    expect(s.active).toBe(false);
    s = updateAssist(s, run(0, 2));
    expect(s.active).toBe(true);
  });
  it('a non-zero score resets the zero streak', () => {
    let s = updateAssist(DEFAULT_ASSIST, run(0, 3));
    s = updateAssist(s, run(5, 31));
    expect(s.zeroStreak).toBe(0);
    s = updateAssist(s, run(0, 3));
    expect(s.active).toBe(false);
  });
  it('turns on after 3 consecutive runs under 30 s without Bronze', () => {
    let s: AssistState = DEFAULT_ASSIST;
    s = updateAssist(s, run(10, 12));
    s = updateAssist(s, run(10, 12));
    expect(s.active).toBe(false);
    s = updateAssist(s, run(10, 12));
    expect(s.active).toBe(true);
  });
  it('stays active (latched) until Bronze is owned, then retires permanently', () => {
    let s = updateAssist({ ...DEFAULT_ASSIST, zeroStreak: 1 }, run(0, 1));
    expect(s.active).toBe(true);
    s = updateAssist(s, run(40, 20));
    expect(s.active).toBe(true);
    s = updateAssist(s, run(300, 35, true));
    expect(s).toEqual({ zeroStreak: 0, noBronzeStreak: 0, active: false, retired: true });
    for (let i = 0; i < 5; i++) s = updateAssist(s, run(0, 1, true));
    expect(s.active).toBe(false);
    expect(s.retired).toBe(true);
  });
  it('retire wins over a trigger in the same run', () => {
    const s = updateAssist({ ...DEFAULT_ASSIST, zeroStreak: 1 }, run(0, 31, true));
    expect(s.active).toBe(false);
    expect(s.retired).toBe(true);
  });
  it('sanitizes garbage', () => {
    expect(sanitizeAssist(null)).toEqual(DEFAULT_ASSIST);
    expect(sanitizeAssist({ zeroStreak: -4, noBronzeStreak: 'x', active: 'yes', retired: 1 })).toEqual(DEFAULT_ASSIST);
    expect(sanitizeAssist({ zeroStreak: 2.9, noBronzeStreak: 1, active: true, retired: false })).toEqual({
      zeroStreak: 2, noBronzeStreak: 1, active: true, retired: false,
    });
  });
});

describe('start tiers', () => {
  it('Bronze 0:30, Silver 1:00, Gold 1:30 (max start is Gold)', () => {
    expect(START_TIERS.map((t) => [t.id, t.seconds])).toEqual([['none', 0], ['bronze', 30], ['silver', 60], ['gold', 90]]);
    expect(tierSeconds('gold')).toBe(90);
  });
  it('only earned medals are available; neon/diamond/legend are not start points', () => {
    expect(availableTiers([])).toEqual(['none']);
    expect(availableTiers(['bronze', 'silver', 'neon', 'legend', 'bogus'])).toEqual(['none', 'bronze', 'silver']);
    expect(availableTiers(['diamond', 'neon'])).toEqual(['none']);
  });
  it('sanitizeStartTier falls back to none when not earned or invalid', () => {
    expect(sanitizeStartTier('silver', ['bronze', 'silver'])).toBe('silver');
    expect(sanitizeStartTier('gold', ['bronze'])).toBe('none');
    expect(sanitizeStartTier(42, ['bronze'])).toBe('none');
  });
  it('auto-advances up to the newest medal, never down', () => {
    expect(advanceStartTier('none', ['bronze'])).toBe('bronze');
    expect(advanceStartTier('none', ['bronze', 'silver'])).toBe('silver');
    expect(advanceStartTier('silver', ['gold', 'neon'])).toBe('gold');
    expect(advanceStartTier('gold', ['bronze'])).toBe('gold');
    expect(advanceStartTier('bronze', [])).toBe('bronze');
    expect(advanceStartTier('none', ['neon'])).toBe('none');
    expect(advanceStartTier('gold', ['gold', 'neon', 'diamond', 'legend'])).toBe('gold');
    expect(advanceStartTier('none', ['diamond', 'legend'])).toBe('none');
  });
});

describe('headStartScore', () => {
  it('round, readable head starts: bronze 100, silver 200, gold 300 (owner decision 2026-11-22)', () => {
    expect(HEAD_START_SCORE).toEqual({ bronze: 100, silver: 200, gold: 300 });
    expect(headStartScore('none')).toBe(0);
    expect(headStartScore('silver')).toBe(200);
  });
});

describe('rushStartAt', () => {
  it('45 s, 90 s, then every 30 s from 180 s', () => {
    expect([0, 1, 2, 3, 4, 10].map(rushStartAt)).toEqual([45, 90, 180, 210, 240, 420]);
  });
});

describe('rushesBefore', () => {
  it('counts rushes (45 s and 90 s only, 4 s long; none from 120 s) fully ended before the clock', () => {
    expect([0, 30, 48.9, 49, 60, 90, 93.9, 94, 139].map(rushesBefore)).toEqual([0, 0, 0, 1, 1, 1, 1, 2, 2]);
    expect([120, 180, 183.9, 184, 213.9, 214, 600].map(rushesBefore)).toEqual([2, 2, 2, 3, 3, 4, 2 + Math.floor((600 - 184) / 30) + 1]);
  });
});
