import { describe, expect, it } from 'vitest';
import { addTrauma, decayTrauma, shakeOffset } from './trauma.ts';

describe('trauma', () => {
  it('add clamps to [0,1]', () => {
    expect(addTrauma(0.8, 0.5)).toBe(1);
    expect(addTrauma(0.2, 0.3)).toBeCloseTo(0.5);
  });
  it('decay floors at 0', () => {
    expect(decayTrauma(0.5, 1)).toBe(0);
    expect(decayTrauma(1, 0.25)).toBeCloseTo(0.6);
  });
  it('offset', () => {
    expect(shakeOffset(0, 18, () => 1)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(0.5, 18, () => 1).x).toBeCloseTo(4.5);
  });
});
