import { describe, expect, it } from 'vitest';
import { pentatonic } from './notes.ts';

describe('pentatonic', () => {
  it('values', () => {
    expect(pentatonic(0)).toBe(440);
    expect(pentatonic(5)).toBe(880);
    expect(pentatonic(2)).toBeCloseTo(440 * 2 ** (4 / 12));
  });
  it('clamps', () => {
    expect(pentatonic(99)).toBe(pentatonic(14));
    expect(pentatonic(-3)).toBe(440);
  });
});
