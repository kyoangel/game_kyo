import { describe, it, expect } from 'vitest';
import { getDoomsdayColor, formatDoomsdayLabel } from '../../src/ui/doomsdayDisplay';

// Spec: specs/pixel-squad-doomsday-timer.md
// ui/doomsdayDisplay.ts does not exist yet — every import above fails to
// resolve. Covers AC-12's color-threshold logic.

describe('AC-12: getDoomsdayColor threshold boundaries', () => {
  it('returns red (#ef4444) at 5 days or fewer', () => {
    expect(getDoomsdayColor(0)).toBe('#ef4444');
    expect(getDoomsdayColor(4)).toBe('#ef4444');
    expect(getDoomsdayColor(5)).toBe('#ef4444');
  });

  it('returns yellow (#fbbf24) between 6 and 15 days', () => {
    expect(getDoomsdayColor(6)).toBe('#fbbf24');
    expect(getDoomsdayColor(10)).toBe('#fbbf24');
    expect(getDoomsdayColor(15)).toBe('#fbbf24');
  });

  it('returns green (#4ade80) above 15 days', () => {
    expect(getDoomsdayColor(16)).toBe('#4ade80');
    expect(getDoomsdayColor(20)).toBe('#4ade80');
    expect(getDoomsdayColor(32)).toBe('#4ade80');
  });
});

describe('formatDoomsdayLabel', () => {
  it('formats the days-remaining message with the hourglass prefix', () => {
    expect(formatDoomsdayLabel(20)).toBe('⏳ 剩餘 20 天');
  });

  it('formats correctly at 0 days', () => {
    expect(formatDoomsdayLabel(0)).toBe('⏳ 剩餘 0 天');
  });
});
