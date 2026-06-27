import { describe, it, expect } from 'vitest';
import { newGame, startNewGamePlus } from '../../src/save/GameState';
import type { GameState } from '../../src/types';

describe('newGame NG+ fields', () => {
  it('initializes ngPlusCycle to 0', () => {
    const state = newGame(0);
    expect(state.ngPlusCycle).toBe(0);
  });

  it('initializes hasClearedGame to false', () => {
    const state = newGame(0);
    expect(state.hasClearedGame).toBe(false);
  });
});

function makeClearedState(overrides: Partial<GameState> = {}): GameState {
  const base = newGame(0);
  return {
    ...base,
    hasClearedGame: true,
    currency: 500,
    expPool: 1000,
    stageProgress: { completedStageIds: ['1-1', '1-2', '5-5'] },
    inventory: [{ itemId: 'supply_medkit_s', quantity: 3 }],
    ...overrides,
  };
}

describe('startNewGamePlus', () => {
  it('clears completedStageIds', () => {
    const state = makeClearedState();
    const result = startNewGamePlus(state);
    expect(result.stageProgress.completedStageIds).toEqual([]);
  });

  it('clears inChapterRun', () => {
    const state = makeClearedState({
      stageProgress: {
        completedStageIds: ['1-1'],
        inChapterRun: { chapterId: 'ch1', currentStageIndex: 2, lockedSquad: [] },
      },
    });
    const result = startNewGamePlus(state);
    expect(result.stageProgress.inChapterRun).toBeUndefined();
  });

  it('increments ngPlusCycle by 1', () => {
    const state = makeClearedState({ ngPlusCycle: 0 });
    const result = startNewGamePlus(state);
    expect(result.ngPlusCycle).toBe(1);
  });

  it('increments ngPlusCycle from an already-elevated cycle', () => {
    const state = makeClearedState({ ngPlusCycle: 2 });
    const result = startNewGamePlus(state);
    expect(result.ngPlusCycle).toBe(3);
  });

  it('preserves pool, squad, currency, expPool, and inventory unchanged', () => {
    const state = makeClearedState();
    const result = startNewGamePlus(state);
    expect(result.pool).toEqual(state.pool);
    expect(result.squad).toEqual(state.squad);
    expect(result.currency).toBe(state.currency);
    expect(result.expPool).toBe(state.expPool);
    expect(result.inventory).toEqual(state.inventory);
  });

  it('keeps hasClearedGame true after starting NG+', () => {
    const state = makeClearedState();
    const result = startNewGamePlus(state);
    expect(result.hasClearedGame).toBe(true);
  });

  it('does not mutate the original gameState', () => {
    const state = makeClearedState();
    const originalCompleted = [...state.stageProgress.completedStageIds];
    startNewGamePlus(state);
    expect(state.stageProgress.completedStageIds).toEqual(originalCompleted);
    expect(state.ngPlusCycle).toBe(0);
  });
});
