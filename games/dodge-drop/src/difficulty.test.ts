import { describe, expect, it } from 'vitest';
import { fallSpeed, OVERDRIVE_T, overdrive, spawnInterval, speedBoost } from './difficulty.ts';

describe('dodge-drop difficulty', () => {
  it('spawn interval starts at 0.9s and floors at 0.15s', () => {
    expect(spawnInterval(0)).toBeCloseTo(0.9);
    expect(spawnInterval(10)).toBeCloseTo(0.7);
    expect(spawnInterval(32.5)).toBeCloseTo(0.25);
    expect(spawnInterval(60)).toBeCloseTo(0.25 - 0.0011 * 27.5);
    expect(spawnInterval(123.4)).toBeCloseTo(0.15, 3);
    expect(spawnInterval(200)).toBe(0.15);
  });

  it('fall speed starts at 260px/s and caps at 900px/s', () => {
    expect(fallSpeed(0)).toBe(260);
    expect(fallSpeed(10)).toBe(380);
    expect(fallSpeed(53.33)).toBeCloseTo(900, 0);
    expect(fallSpeed(100)).toBeCloseTo(900 + 4 * (100 - 53.33), 1);
    expect(fallSpeed(115.8)).toBeCloseTo(1150, 0);
    expect(fallSpeed(300)).toBe(1150);
  });

  it('speedBoost: rush x1.4 before 120 s, then ramps 1 -> 1.3 by 150 s and holds', () => {
    expect(OVERDRIVE_T).toBe(120);
    const at = [46, 50, 91, 119, 120, 135, 150, 400].map(speedBoost);
    [1.4, 1, 1.4, 1, 1, 1.15, 1.3, 1.3].forEach((v, i) => expect(at[i]).toBeCloseTo(v, 9));
  });

  it('overdrive intensity is 0 before 120 s and 1 from 150 s', () => {
    expect([0, 119.9, 120, 135, 150, 999].map(overdrive)).toEqual([0, 0, 0, 0.5, 1, 1]);
  });

  it('fallSpeed * speedBoost never decreases from 120 s on', () => {
    let prev = 0;
    for (let t = 120; t <= 300; t += 0.1) {
      const v = fallSpeed(t) * speedBoost(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});
