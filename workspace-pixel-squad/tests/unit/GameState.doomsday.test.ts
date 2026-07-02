import { describe, it, expect } from 'vitest';
import { newGame, startNewGamePlus } from '../../src/save/GameState';

// Spec: specs/pixel-squad-doomsday-timer.md
// newGame()/startNewGamePlus() don't set doomsdayDaysRemaining yet, and
// battle/DoomsdayClock.ts (DOOMSDAY_INITIAL_DAYS) does not exist yet —
// these tests fail today either on the missing import or on the missing
// field. AC-1, AC-11.

describe('AC-1: newGame initializes doomsdayDaysRemaining to DOOMSDAY_INITIAL_DAYS (32)', () => {
  it('newGame(0).doomsdayDaysRemaining === 32', async () => {
    const { DOOMSDAY_INITIAL_DAYS } = await import('../../src/battle/DoomsdayClock');
    const state = newGame(0);
    expect((state as any).doomsdayDaysRemaining).toBe(DOOMSDAY_INITIAL_DAYS);
    expect((state as any).doomsdayDaysRemaining).toBe(32);
  });
});

describe('AC-11: startNewGamePlus resets doomsdayDaysRemaining to full, regardless of prior depletion', () => {
  it('resets from a partially-depleted value of 3 back to 32', () => {
    const state = { ...newGame(0), doomsdayDaysRemaining: 3, ngPlusCycle: 0 } as any;
    const ngPlus = startNewGamePlus(state);
    expect((ngPlus as any).doomsdayDaysRemaining).toBe(32);
  });

  it('resets even from 0', () => {
    const state = { ...newGame(0), doomsdayDaysRemaining: 0, ngPlusCycle: 1 } as any;
    const ngPlus = startNewGamePlus(state);
    expect((ngPlus as any).doomsdayDaysRemaining).toBe(32);
  });
});
