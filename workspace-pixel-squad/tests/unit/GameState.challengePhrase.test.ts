import { describe, it, expect } from 'vitest';
import { newGame, startNewGamePlus } from '../../src/save/GameState';
import type { GameState } from '../../src/types';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
// "Persistence" rule: the unlocked phrase and its constraints must be
// persisted across playthroughs until activated or abandoned.

describe('newGame challenge phrase fields', () => {
  it('initializes unlockedChallengePhraseIds to an empty array', () => {
    const state = newGame(0);
    expect(state.unlockedChallengePhraseIds).toEqual([]);
  });

  it('initializes activeChallengePhraseId to undefined', () => {
    const state = newGame(0);
    expect(state.activeChallengePhraseId).toBeUndefined();
  });
});

function makeClearedState(overrides: Partial<GameState> = {}): GameState {
  const base = newGame(0);
  return {
    ...base,
    hasClearedGame: true,
    unlockedChallengePhraseIds: ['phrase_a', 'phrase_b'],
    ...overrides,
  };
}

describe('startNewGamePlus preserves unlocked challenge phrases across playthroughs', () => {
  it('does not clear unlockedChallengePhraseIds when starting NG+', () => {
    const state = makeClearedState();
    const result = startNewGamePlus(state);
    expect(result.unlockedChallengePhraseIds).toEqual(['phrase_a', 'phrase_b']);
  });

  it('carries an active phrase selection into NG+ unless the player abandoned it', () => {
    const state = makeClearedState({ activeChallengePhraseId: 'phrase_a' });
    const result = startNewGamePlus(state);
    expect(result.activeChallengePhraseId).toBe('phrase_a');
  });
});
