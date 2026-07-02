import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: pixel-squad-hidden-stage
// processVictory must accept a 7th `alliesSurvived` parameter (default false)
// and, immediately after the existing bestStarRatings block, append
// stage.id to a freshly-built perfectClearStageIds array when
// alliesSurvived is true and the id isn't already present — never mutating
// the existing array in place, and treating a missing perfectClearStageIds
// key (legacy save) as [] rather than throwing.
// AC-2, AC-3, AC-9, AC-10.

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '2-5', chapterId: 'ch2', name: '[BOSS] 影鴉 Crow', stageIndex: 4,
    isBoss: true, isSideQuest: false,
    enemies: [], expReward: 180, currencyReward: 120,
    ...overrides,
  };
}

describe('AC-2: processVictory records a perfect clear when alliesSurvived is true', () => {
  it('adds "2-5" to perfectClearStageIds', () => {
    const state = makeGameState({ perfectClearStageIds: [] } as any);
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 1, true) as any;
    expect(result.perfectClearStageIds).toContain('2-5');
  });
});

describe('AC-3: a clear with a squad KO does not record a perfect clear', () => {
  it('does not add "2-5" to perfectClearStageIds when alliesSurvived is false', () => {
    const state = makeGameState({ perfectClearStageIds: [] } as any);
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 1, false) as any;
    expect(result.perfectClearStageIds).not.toContain('2-5');
  });

  it('does not add "2-5" when alliesSurvived is omitted (defaults to false)', () => {
    const state = makeGameState({ perfectClearStageIds: [] } as any);
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 1) as any;
    expect(result.perfectClearStageIds).not.toContain('2-5');
  });
});

describe('AC-10/rule 5: monotonic set — clearing the same stage perfectly twice never duplicates the entry', () => {
  it('keeps exactly one "2-5" entry after two consecutive perfect clears', () => {
    let state = makeGameState({ perfectClearStageIds: [] } as any);
    const stage = makeStage();

    state = processVictory(state, stage, 100, undefined, 0, 1, true) as any;
    state = processVictory(state, stage, 100, undefined, 0, 1, true) as any;

    const occurrences = ((state as any).perfectClearStageIds as string[]).filter((id) => id === '2-5');
    expect(occurrences).toHaveLength(1);
  });
});

describe('AC-9: legacy save with no perfectClearStageIds key at all does not throw', () => {
  it('initializes the array with the cleared stage id instead of throwing', () => {
    const legacyState = makeGameState();
    delete (legacyState as any).perfectClearStageIds;
    const stage = makeStage();

    expect(() => processVictory(legacyState, stage, 100, undefined, 0, 1, true)).not.toThrow();

    const result = processVictory(legacyState, stage, 100, undefined, 0, 1, true) as any;
    expect(result.perfectClearStageIds).toContain('2-5');
  });
});

describe('immutability: perfectClearStageIds is replaced, not mutated in place', () => {
  it('leaves the input array untouched and returns a distinct array containing the new id', () => {
    const original: string[] = [];
    const state = makeGameState({ perfectClearStageIds: original } as any);
    const stage = makeStage();

    const result = processVictory(state, stage, 100, undefined, 0, 1, true) as any;

    expect(original).toEqual([]);
    expect(result.perfectClearStageIds).not.toBe(original);
    expect(result.perfectClearStageIds).toContain('2-5');
  });
});
