import { describe, expect, it } from 'vitest';
import { formatTime, sanitizeOwned } from './format.ts';

describe('formatTime', () => {
  it('formats m:ss', () => {
    expect(formatTime(67)).toBe('1:07');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(120)).toBe('2:00');
    expect(formatTime(59.9)).toBe('0:59');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('sanitizeOwned', () => {
  it('always includes cyan, drops junk and duplicates', () => {
    expect(sanitizeOwned(null)).toEqual(['cyan']);
    expect(sanitizeOwned('x')).toEqual(['cyan']);
    expect(sanitizeOwned(['lime', 5, 'nope', 'lime'])).toEqual(['cyan', 'lime']);
    expect(sanitizeOwned(['star', 'cyan'])).toEqual(['cyan', 'star']);
  });
});
