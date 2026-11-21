import { describe, expect, it } from 'vitest';
import { joystickVector, keyVector } from './vector.ts';

describe('vector', () => {
  it('keyVector normalizes diagonal', () => {
    const v = keyVector({ left: true, right: false, up: true, down: false });
    expect(v.x).toBeCloseTo(-Math.SQRT1_2);
    expect(v.y).toBeCloseTo(-Math.SQRT1_2);
    expect(keyVector({ left: true, right: true, up: false, down: false })).toEqual({ x: 0, y: 0 });
  });
  it('joystick dead zone and clamp', () => {
    expect(joystickVector({ x: 0, y: 0 }, { x: 3, y: 3 }, 50)).toEqual({ x: 0, y: 0 });
    const v = joystickVector({ x: 0, y: 0 }, { x: 100, y: 0 }, 50);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });
});
