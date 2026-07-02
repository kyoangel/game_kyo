import { describe, it, expect } from 'vitest';
import {
  getUnlockedChallengePhrases,
  unlockChallengePhrasesForStage,
} from '../../src/battle/ChallengePhrase';
import { CHALLENGE_PHRASES } from '../../src/data/challengePhrases';
import { newGame } from '../../src/save/GameState';
import type { GameState } from '../../src/types';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
// AC-1: Given the player successfully clears a stage, When they visit the
// progression screen, Then the newly unlocked Challenge Phrases are
// available for selection.
//
// getUnlockedChallengePhrases/unlockChallengePhrasesForStage back the
// progression screen's list — WorldMapScene itself is not exercised here
// per the "pure business logic only" testing rule.

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

describe('getUnlockedChallengePhrases', () => {
  it('returns an empty list on a fresh save with no unlocked phrases', () => {
    const state = makeState({ unlockedChallengePhraseIds: [] });
    expect(getUnlockedChallengePhrases(state)).toEqual([]);
  });

  it('defaults to an empty list when unlockedChallengePhraseIds is undefined (legacy save)', () => {
    const state = makeState({ unlockedChallengePhraseIds: undefined });
    expect(getUnlockedChallengePhrases(state)).toEqual([]);
  });

  it('returns the full CHALLENGE_PHRASES entry for each unlocked id', () => {
    const first = CHALLENGE_PHRASES[0];
    const state = makeState({ unlockedChallengePhraseIds: [first.id] });
    expect(getUnlockedChallengePhrases(state)).toEqual([first]);
  });

  it('does not return phrases whose id is absent from unlockedChallengePhraseIds', () => {
    const [first, second] = CHALLENGE_PHRASES;
    const state = makeState({ unlockedChallengePhraseIds: [first.id] });
    const result = getUnlockedChallengePhrases(state);
    expect(result.find(p => p.id === second.id)).toBeUndefined();
  });
});

describe('unlockChallengePhrasesForStage', () => {
  it('adds the phrase tied to the cleared stage into unlockedChallengePhraseIds', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({ unlockedChallengePhraseIds: [] });
    const result = unlockChallengePhrasesForStage(state, target.unlockStageId);
    expect(result.unlockedChallengePhraseIds).toContain(target.id);
  });

  it('is a no-op when the cleared stage does not unlock any phrase', () => {
    const state = makeState({ unlockedChallengePhraseIds: [] });
    const result = unlockChallengePhrasesForStage(state, 'stage-with-no-linked-phrase');
    expect(result.unlockedChallengePhraseIds).toEqual([]);
  });

  it('does not add duplicate ids when the same stage is cleared again', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({ unlockedChallengePhraseIds: [target.id] });
    const result = unlockChallengePhrasesForStage(state, target.unlockStageId);
    expect(result.unlockedChallengePhraseIds!.filter(id => id === target.id)).toHaveLength(1);
  });

  it('preserves previously unlocked phrase ids from other stages', () => {
    const [first, second] = CHALLENGE_PHRASES;
    const state = makeState({ unlockedChallengePhraseIds: [first.id] });
    const result = unlockChallengePhrasesForStage(state, second.unlockStageId);
    expect(result.unlockedChallengePhraseIds).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it('does not mutate the original gameState', () => {
    const target = CHALLENGE_PHRASES[0];
    const state = makeState({ unlockedChallengePhraseIds: [] });
    unlockChallengePhrasesForStage(state, target.unlockStageId);
    expect(state.unlockedChallengePhraseIds).toEqual([]);
  });
});
