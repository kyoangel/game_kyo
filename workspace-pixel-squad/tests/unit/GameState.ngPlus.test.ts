import { describe, it, expect } from 'vitest';
import { newGame } from '../../src/save/GameState';

describe('newGame New Game+ fields', () => {
  it('initializes ngPlusCycle to 0', () => {
    const state = newGame(0);
    expect(state.ngPlusCycle).toBe(0);
  });

  it('initializes hasClearedGame to false', () => {
    const state = newGame(0);
    expect(state.hasClearedGame).toBe(false);
  });

  it('does not initialize a challengeRun', () => {
    const state = newGame(0);
    expect(state.challengeRun).toBeUndefined();
  });
});
