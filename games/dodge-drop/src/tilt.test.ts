import { describe, expect, it } from 'vitest';
import { TILT_FULL_DEG, TILT_MAX_SPEED, tiltToVelocity } from './tilt.ts';

describe('tiltToVelocity', () => {
  it('is zero inside the +-3 degree dead zone around neutral', () => {
    expect(tiltToVelocity(10, 10)).toBe(0);
    expect(tiltToVelocity(12.9, 10)).toBe(0);
    expect(tiltToVelocity(7.1, 10)).toBe(0);
    expect(tiltToVelocity(13, 10)).toBe(0);
  });
  it('ramps linearly from the dead zone edge to full speed at 25 degrees', () => {
    expect(tiltToVelocity(14, 0)).toBeCloseTo((TILT_MAX_SPEED * (14 - 3)) / (TILT_FULL_DEG - 3), 6);
    expect(tiltToVelocity(-14, 0)).toBeCloseTo(-(TILT_MAX_SPEED * (14 - 3)) / (TILT_FULL_DEG - 3), 6);
    expect(tiltToVelocity(25, 0)).toBeCloseTo(TILT_MAX_SPEED, 6);
  });
  it('clamps at the keyboard max speed beyond 25 degrees, both directions', () => {
    expect(tiltToVelocity(80, 0)).toBe(TILT_MAX_SPEED);
    expect(tiltToVelocity(-80, 0)).toBe(-TILT_MAX_SPEED);
    expect(TILT_MAX_SPEED).toBe(640);
  });
  it('is measured relative to the calibrated neutral', () => {
    expect(tiltToVelocity(40, 15)).toBeCloseTo(TILT_MAX_SPEED, 6);
    expect(tiltToVelocity(-10, 15)).toBeCloseTo(-TILT_MAX_SPEED, 6);
  });
  it('treats non-finite input as no tilt', () => {
    expect(tiltToVelocity(Number.NaN, 0)).toBe(0);
  });
});
