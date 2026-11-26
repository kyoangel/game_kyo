import { describe, expect, it } from 'vitest';
import { countdownAt, WARN_LEAD } from './countdown.ts';

describe('countdownAt', () => {
  it('counts 3, 2, 1 over the WARN_LEAD seconds before a speed-up, null otherwise', () => {
    expect(WARN_LEAD).toBe(3);
    expect(countdownAt(41.9, 45)).toBeNull();
    expect(countdownAt(42, 45)).toBe(3);
    expect(countdownAt(42.5, 45)).toBe(3);
    expect(countdownAt(43.01, 45)).toBe(2);
    expect(countdownAt(44.5, 45)).toBe(1);
    expect(countdownAt(45, 45)).toBeNull();
  });
});
