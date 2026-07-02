import { describe, it, expect } from 'vitest';
import { newGame } from '../../src/save/GameState';

// Spec: specs/pixel-squad-permanent-death-mode.md
// GameState.currentRosterIds does not exist yet — newGame() never sets it,
// so every assertion below fails today (property is undefined). Covers the
// "Data Model Change: GameState Update" requirement that underpins AC-4.

describe('Data Model: newGame initializes currentRosterIds from the starting pool', () => {
  it('currentRosterIds contains exactly the ids of every character in pool at run start', () => {
    const state = newGame(0);
    const poolIds = state.pool.map(c => c.id);
    expect((state as any).currentRosterIds).toEqual(poolIds);
  });

  it('currentRosterIds is an array (not undefined) on a freshly created run', () => {
    const state = newGame(0);
    expect(Array.isArray((state as any).currentRosterIds)).toBe(true);
  });
});
