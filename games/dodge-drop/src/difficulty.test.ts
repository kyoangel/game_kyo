import { describe, expect, it } from 'vitest';
import { fallSpeed, isSurge, OVERDRIVE_T, overdrive, spawnInterval, speedBoost } from './difficulty.ts';

describe('dodge-drop difficulty', () => {
  it('spawn interval eases gently through Silver (0.28s at 60s) and floors at 0.15s at 180s', () => {
    expect(spawnInterval(0)).toBeCloseTo(0.9);
    expect(spawnInterval(30)).toBeCloseTo(0.59);
    expect(spawnInterval(60)).toBeCloseTo(0.28);
    expect(spawnInterval(120)).toBeCloseTo(0.215);
    expect(spawnInterval(180)).toBeCloseTo(0.15, 3);
    expect(spawnInterval(240)).toBe(0.15);
  });

  it('fall speed starts at 260px/s and caps at 900px/s', () => {
    expect(fallSpeed(0)).toBe(260);
    expect(fallSpeed(10)).toBe(380);
    expect(fallSpeed(53.33)).toBeCloseTo(900, 0);
    expect(fallSpeed(100)).toBeCloseTo(900 + 4 * (100 - 53.33), 1);
    expect(fallSpeed(115.8)).toBeCloseTo(1150, 0);
    expect(fallSpeed(300)).toBe(1150);
  });

  it('speedBoost: rush x1.4 before 120 s, then ramps 1 -> 1.3 by 130 s and holds', () => {
    expect(OVERDRIVE_T).toBe(120);
    const at = [46, 50, 91, 119, 120, 125, 130, 400].map(speedBoost);
    [1.4, 1, 1.4, 1, 1, 1.15, 1.3, 1.3].forEach((v, i) => expect(at[i]).toBeCloseTo(v, 9));
  });

  it('overdrive intensity is 0 before 120 s and 1 from 130 s', () => {
    expect([0, 119.9, 120, 125, 130, 999].map(overdrive)).toEqual([0, 0, 0, 0.5, 1, 1]);
  });

  it('fallSpeed * speedBoost never decreases from 120 s on', () => {
    let prev = 0;
    for (let t = 120; t <= 179.9; t += 0.1) {
      const v = fallSpeed(t) * speedBoost(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});

describe('Diamond surges', () => {
  it('every 30 s from 180 s a 4 s surge multiplies top speed by 1.2, forever', () => {
    const at = [179, 181, 185, 211, 215, 240, 300, 305, 1020.5].map(speedBoost);
    [1.3, 1.56, 1.3, 1.56, 1.3, 1.56, 1.56, 1.3, 1.56].forEach((v, i) => expect(at[i]).toBeCloseTo(v, 9));
    expect(isSurge(179.9)).toBe(false);
    expect(isSurge(183.9)).toBe(true);
    expect(isSurge(184)).toBe(false);
  });
  it('outside surges, boost and fall speed never change after Neon top speed', () => {
    for (let t = 130; t < 600; t += 0.5) if (!isSurge(t)) expect(speedBoost(t)).toBeCloseTo(1.3, 9);
    expect(fallSpeed(130)).toBe(1150);
  });
});
