import { describe, it, expect } from 'vitest';
import {
  selectChallengePhrase,
  abandonActiveChallengePhrase,
  getActiveChallengePhrase,
} from '../../src/battle/ChallengePhrase';
import { CHALLENGE_PHRASES } from '../../src/data/challengePhrases';
import { newGame } from '../../src/save/GameState';
import type { GameState } from '../../src/types';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
// AC-2: Given a player selects an unlocked phrase, When they begin the next
// run, Then the game enforces all constraints defined by that phrase.
// "Persistence" rule: the unlocked phrase and its constraints must be
// persisted until activated or abandoned.

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

describe('selectChallengePhrase', () => {
  it('sets activeChallengePhraseId when the phrase is unlocked', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({ unlockedChallengePhraseIds: [target.id] });
    const result = selectChallengePhrase(state, target.id);
    expect(result.activeChallengePhraseId).toBe(target.id);
  });

  it('is a no-op when the phrase has not been unlocked', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({ unlockedChallengePhraseIds: [] });
    const result = selectChallengePhrase(state, target.id);
    expect(result.activeChallengePhraseId).toBeUndefined();
  });

  it('switches the active phrase when a different unlocked phrase is selected', () => {
    const [first, second] = CHALLENGE_PHRASES;
    const state = makeState({
      unlockedChallengePhraseIds: [first.id, second.id],
      activeChallengePhraseId: first.id,
    });
    const result = selectChallengePhrase(state, second.id);
    expect(result.activeChallengePhraseId).toBe(second.id);
  });

  it('does not mutate the original gameState', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({ unlockedChallengePhraseIds: [target.id] });
    selectChallengePhrase(state, target.id);
    expect(state.activeChallengePhraseId).toBeUndefined();
  });
});

describe('abandonActiveChallengePhrase', () => {
  it('clears activeChallengePhraseId', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({
      unlockedChallengePhraseIds: [target.id],
      activeChallengePhraseId: target.id,
    });
    const result = abandonActiveChallengePhrase(state);
    expect(result.activeChallengePhraseId).toBeUndefined();
  });

  it('keeps the phrase in unlockedChallengePhraseIds after abandoning (still selectable later)', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({
      unlockedChallengePhraseIds: [target.id],
      activeChallengePhraseId: target.id,
    });
    const result = abandonActiveChallengePhrase(state);
    expect(result.unlockedChallengePhraseIds).toContain(target.id);
  });
});

describe('getActiveChallengePhrase', () => {
  it('returns undefined when no phrase is active', () => {
    const state = makeState({ activeChallengePhraseId: undefined });
    expect(getActiveChallengePhrase(state)).toBeUndefined();
  });

  it('resolves activeChallengePhraseId to the full CHALLENGE_PHRASES entry', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({ activeChallengePhraseId: target.id });
    expect(getActiveChallengePhrase(state)).toEqual(target);
  });
});
