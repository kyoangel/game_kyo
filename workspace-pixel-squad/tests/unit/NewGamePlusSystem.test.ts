import { describe, it, expect } from 'vitest';
import { startNewGamePlus, getStatMultiplier, getRewardMultiplier } from '../../src/battle/NewGamePlusSystem';
import type { GameState } from '../../src/types';
import { newGame } from '../../src/save/GameState';

function makeClearedState(): GameState {
  const state = newGame(0);
  state.hasClearedGame = true;
  state.ngPlusCycle = 0;
  state.currency = 999;
  state.expPool = 123;
  state.inventory = [{ itemId: 'supply_medkit_s', quantity: 2 }];
  state.stageProgress.completedStageIds = ['1-1', '1-2', '1-3', '1-4', '1-5', '5-5'];
  state.stageProgress.inChapterRun = { chapterId: 'ch2', currentStageIndex: 1, lockedSquad: [...state.squad] };
  return state;
}

describe('startNewGamePlus', () => {
  it('clears completedStageIds', () => {
    const result = startNewGamePlus(makeClearedState());
    expect(result.stageProgress.completedStageIds).toEqual([]);
  });

  it('clears any in-progress chapter run', () => {
    const result = startNewGamePlus(makeClearedState());
    expect(result.stageProgress.inChapterRun).toBeUndefined();
  });

  it('increments ngPlusCycle by 1', () => {
    const state = makeClearedState();
    state.ngPlusCycle = 1;
    const result = startNewGamePlus(state);
    expect(result.ngPlusCycle).toBe(2);
  });

  it('preserves pool, squad, currency, inventory, and expPool unchanged', () => {
    const state = makeClearedState();
    const result = startNewGamePlus(state);
    expect(result.currency).toBe(999);
    expect(result.expPool).toBe(123);
    expect(result.inventory).toEqual([{ itemId: 'supply_medkit_s', quantity: 2 }]);
    expect(result.squad).toEqual(state.squad);
    expect(result.pool).toEqual(state.pool);
  });

  it('keeps hasClearedGame true', () => {
    const result = startNewGamePlus(makeClearedState());
    expect(result.hasClearedGame).toBe(true);
  });

  it('does not mutate the original gameState', () => {
    const state = makeClearedState();
    startNewGamePlus(state);
    expect(state.stageProgress.completedStageIds).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5', '5-5']);
  });
});

describe('getStatMultiplier', () => {
  it('returns 1 at ngPlusCycle 0', () => {
    expect(getStatMultiplier(0)).toBe(1);
  });

  it('returns 1.3 at ngPlusCycle 1', () => {
    expect(getStatMultiplier(1)).toBeCloseTo(1.3);
  });

  it('returns 1.6 at ngPlusCycle 2', () => {
    expect(getStatMultiplier(2)).toBeCloseTo(1.6);
  });
});

describe('getRewardMultiplier', () => {
  it('returns 1 at ngPlusCycle 0', () => {
    expect(getRewardMultiplier(0)).toBe(1);
  });

  it('returns 1.2 at ngPlusCycle 1', () => {
    expect(getRewardMultiplier(1)).toBeCloseTo(1.2);
  });

  it('returns 1.4 at ngPlusCycle 2', () => {
    expect(getRewardMultiplier(2)).toBeCloseTo(1.4);
  });
});
