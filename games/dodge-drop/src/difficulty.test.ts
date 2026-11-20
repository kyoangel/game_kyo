import { describe, expect, it } from 'vitest';
import { fallSpeed, spawnInterval } from './difficulty.ts';

describe('dodge-drop difficulty', () => {
  it('spawn interval starts at 0.9s and floors at 0.25s', () => {
    expect(spawnInterval(0)).toBeCloseTo(0.9);
    expect(spawnInterval(10)).toBeCloseTo(0.7);
    expect(spawnInterval(100)).toBe(0.25);
  });

  it('fall speed starts at 260px/s and caps at 900px/s', () => {
    expect(fallSpeed(0)).toBe(260);
    expect(fallSpeed(10)).toBe(380);
    expect(fallSpeed(60)).toBe(900);
  });
});
