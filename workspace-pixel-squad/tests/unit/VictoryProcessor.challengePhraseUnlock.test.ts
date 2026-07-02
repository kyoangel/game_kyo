import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import { CHALLENGE_PHRASES } from '../../src/data/challengePhrases';
import { newGame } from '../../src/save/GameState';
import type { Stage } from '../../src/types';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
// AC-1: Given the player successfully clears a stage, When they visit the
// progression screen, Then the newly unlocked Challenge Phrases are
// available for selection.
//
// This exercises the real processVictory pipeline (black-box) rather than
// calling unlockChallengePhrasesForStage directly, to prove the stage-clear
// flow actually wires the unlock in — not just that the helper exists.

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 100, currencyReward: 300,
    ...overrides,
  };
}

describe('processVictory unlocks the challenge phrase tied to the cleared stage', () => {
  it('adds the linked phrase id to unlockedChallengePhraseIds on first clear', () => {
    const linkedPhrase = CHALLENGE_PHRASES[0];
    const state = newGame(0);
    const stage = makeStage({ id: linkedPhrase.unlockStageId, unlocksChallengePhraseId: linkedPhrase.id } as Partial<Stage>);

    const result = processVictory(state, stage, 100, undefined);

    expect(result.unlockedChallengePhraseIds).toContain(linkedPhrase.id);
  });

  it('does not unlock anything for a stage with no linked challenge phrase', () => {
    const state = newGame(0);
    const stage = makeStage({ id: '1-2' });

    const result = processVictory(state, stage, 100, undefined);

    expect(result.unlockedChallengePhraseIds ?? []).toEqual([]);
  });

  it('does not add a duplicate id when the same stage is cleared again on a later run', () => {
    const linkedPhrase = CHALLENGE_PHRASES[0];
    let state = newGame(0);
    const stage = makeStage({ id: linkedPhrase.unlockStageId, unlocksChallengePhraseId: linkedPhrase.id } as Partial<Stage>);

    state = processVictory(state, stage, 100, undefined);
    state = processVictory(state, stage, 100, undefined);

    expect(state.unlockedChallengePhraseIds!.filter(id => id === linkedPhrase.id)).toHaveLength(1);
  });

  it('leaves currency/exp/stageProgress handling untouched for a clear with no linked phrase', () => {
    const state = newGame(0);
    const stage = makeStage({ id: '1-2', currencyReward: 50 });

    const result = processVictory(state, stage, 100, undefined);

    expect(result.currency).toBe(50);
    expect(result.stageProgress.completedStageIds).toContain('1-2');
  });
});
