import { describe, it, expect } from 'vitest';
import { grantChallengePhraseReward } from '../../src/battle/ChallengePhrase';
import { CHALLENGE_PHRASES } from '../../src/data/challengePhrases';
import { newGame } from '../../src/save/GameState';
import type { GameState } from '../../src/types';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
// AC-3: Given a player successfully completes a run under the chosen
// phrase's constraints, When they return to the progression screen, Then
// the high-value reward associated with that phrase is granted.

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

describe('grantChallengePhraseReward', () => {
  it('adds the phrase reward.currencyBonus to gameState.currency', () => {
    const phrase = CHALLENGE_PHRASES[0];
    const state = makeState({ currency: 100 });
    const result = grantChallengePhraseReward(state, phrase);
    expect(result.currency).toBe(100 + phrase.reward.currencyBonus);
  });

  it('clears activeChallengePhraseId once the reward is granted', () => {
    const phrase = CHALLENGE_PHRASES[0];
    const state = makeState({
      unlockedChallengePhraseIds: [phrase.id],
      activeChallengePhraseId: phrase.id,
    });
    const result = grantChallengePhraseReward(state, phrase);
    expect(result.activeChallengePhraseId).toBeUndefined();
  });

  it('leaves the phrase in unlockedChallengePhraseIds so it can be run again', () => {
    const phrase = CHALLENGE_PHRASES[0];
    const state = makeState({
      unlockedChallengePhraseIds: [phrase.id],
      activeChallengePhraseId: phrase.id,
    });
    const result = grantChallengePhraseReward(state, phrase);
    expect(result.unlockedChallengePhraseIds).toContain(phrase.id);
  });

  it('does not mutate the original gameState', () => {
    const phrase = CHALLENGE_PHRASES[0];
    const state = makeState({ currency: 100 });
    grantChallengePhraseReward(state, phrase);
    expect(state.currency).toBe(100);
  });

  it('grants the reward for whichever phrase is passed in, not just the active one', () => {
    const [first, second] = CHALLENGE_PHRASES;
    const state = makeState({ currency: 0, activeChallengePhraseId: first.id });
    const result = grantChallengePhraseReward(state, second);
    expect(result.currency).toBe(second.reward.currencyBonus);
  });
});
