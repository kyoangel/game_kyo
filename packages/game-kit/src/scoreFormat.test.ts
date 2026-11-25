import { describe, expect, it } from 'vitest';
import { bestKeyFor, formatScore } from './scoreFormat.ts';

describe('formatScore', () => {
  it('points are plain integers', () => {
    expect(formatScore(1234, 'points')).toBe('1234');
    expect(formatScore(12.7, undefined)).toBe('13');
  });
  it('time is m:ss of whole seconds', () => {
    expect(formatScore(0, 'time')).toBe('0:00');
    expect(formatScore(9, 'time')).toBe('0:09');
    expect(formatScore(75.9, 'time')).toBe('1:15');
    expect(formatScore(600, 'time')).toBe('10:00');
  });
});

describe('bestKeyFor', () => {
  it('points keep the original key; time uses its own so an old points best is never read as seconds', () => {
    expect(bestKeyFor('dodge-drop', 'points')).toBe('dodge-drop:best');
    expect(bestKeyFor('dodge-drop', undefined)).toBe('dodge-drop:best');
    expect(bestKeyFor('dodge-drop', 'time')).toBe('dodge-drop:bestTime');
  });
});
