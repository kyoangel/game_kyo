import { describe, expect, it } from 'vitest';
import { SKINS, buySkin, coinsForRun } from './economy.ts';

describe('economy', () => {
  it('coinsForRun', () => {
    expect(coinsForRun(100, 3)).toBe(7);
    expect(coinsForRun(24, 0)).toBe(0);
  });
  it('SKINS table', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['cyan', 'lime', 'orb', 'tri', 'diamond', 'hex', 'star', 'prism']);
    expect(SKINS.map((s) => s.cost)).toEqual([0, 30, 60, 100, 150, 200, 300, 500]);
    expect(SKINS.map((s) => s.shape)).toEqual(['square', 'square', 'circle', 'triangle', 'diamond', 'hexagon', 'star', 'diamond']);
    expect(SKINS.map((s) => s.color)).toEqual([0x3ff0ff, 0x7dff5a, 0xff7ad9, 0xffa14d, 0xffffff, 0xb98cff, 0xffe14d, 'cycle']);
    expect(SKINS.map((s) => s.trail)).toEqual(['dots', 'dots', 'dots', 'sparks', 'dots', 'sparks', 'sparks', 'sparks']);
    expect(SKINS.map((s) => s.trailColor)).toEqual([0x3ff0ff, 0x7dff5a, 0xff7ad9, 0xffa14d, 'rainbow', 0xb98cff, 0xffe14d, 'rainbow']);
  });
  it('buySkin', () => {
    expect(buySkin({ coins: 10, owned: ['cyan'] }, 'lime')).toEqual({ ok: false, reason: 'poor' });
    expect(buySkin({ coins: 99, owned: ['cyan'] }, 'cyan')).toEqual({ ok: false, reason: 'owned' });
    expect(buySkin({ coins: 99, owned: ['cyan'] }, 'nope')).toEqual({ ok: false, reason: 'unknown' });
    expect(buySkin({ coins: 40, owned: ['cyan'] }, 'lime')).toEqual({ ok: true, coins: 10, owned: ['cyan', 'lime'] });
  });
});
