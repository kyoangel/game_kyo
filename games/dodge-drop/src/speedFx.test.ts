import { describe, expect, it } from 'vitest';
import { EDGE_W, MAX_STREAKS, streakAlpha, streakSpawnRate, streakX, streakLen, streakWidth, streakSpeed, streakTint, vignetteAlpha } from './speedFx.ts';

describe('speedFx', () => {
  it('spawn rate scales with intensity and is 0 at 0', () => {
    expect(streakSpawnRate(0)).toBe(0);
    expect(streakSpawnRate(1)).toBeGreaterThan(streakSpawnRate(0.5));
    expect(streakSpawnRate(0.5)).toBeGreaterThan(0);
  });
  it('alpha is 0.45-0.9 times intensity', () => {
    expect(streakAlpha(1, 0)).toBeCloseTo(0.45);
    expect(streakAlpha(1, 1)).toBeCloseTo(0.9);
    expect(streakAlpha(0.5, 1)).toBeCloseTo(0.45);
    expect(streakAlpha(0, 0.7)).toBe(0);
  });
  it('vignette alpha is 0.75 times intensity', () => {
    expect(vignetteAlpha(1)).toBeCloseTo(0.75);
    expect(vignetteAlpha(0)).toBe(0);
  });
  it('x lies in an edge band, denser near the outer edge', () => {
    let outer = 0;
    for (let i = 0; i <= 200; i++) {
      const r = i / 200;
      for (const side of [0, 1] as const) {
        const x = streakX(side, r, 720);
        expect(x >= 0 && x <= EDGE_W).toBe(side === 0);
        expect(x >= 720 - EDGE_W && x <= 720).toBe(side === 1);
      }
      if (streakX(0, r, 720) < EDGE_W / 2) outer++;
    }
    expect(outer).toBeGreaterThan(110);
  });
  it('every third streak is cyan, others white', () => {
    expect([0, 1, 2, 3, 4, 5].map(streakTint)).toEqual([0xffffff, 0xffffff, 0x3ff0ff, 0xffffff, 0xffffff, 0x3ff0ff]);
  });
  it('size and speed helpers', () => {
    expect(streakWidth(0)).toBe(3);
    expect(streakWidth(1)).toBe(6);
    expect(streakLen(0)).toBe(90);
    expect(streakLen(1)).toBe(260);
    expect(streakSpeed(1000)).toBe(2500);
    expect(MAX_STREAKS).toBe(40);
  });
});
