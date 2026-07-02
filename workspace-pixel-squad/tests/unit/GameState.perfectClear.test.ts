import { describe, it, expect } from 'vitest';
import { newGame, startNewGamePlus } from '../../src/save/GameState';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { Stage } from '../../src/types';

// Spec: pixel-squad-hidden-stage
// AC-1: newGame() initializes perfectClearStageIds as [] (not undefined)
// AC-8: startNewGamePlus preserves perfectClearStageIds entries earned before NG+
//   (mirrors GameState.bestStarRatings.test.ts's pattern of driving the real
//   pipeline via processVictory rather than hand-constructing the field)

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '2-5', chapterId: 'ch2', name: '[BOSS] 影鴉 Crow', stageIndex: 4,
    isBoss: true, isSideQuest: false,
    enemies: [], expReward: 180, currencyReward: 120,
    ...overrides,
  };
}

describe('AC-1: GameState.perfectClearStageIds initializes on newGame', () => {
  it('newGame(0).perfectClearStageIds is defined', () => {
    const state = newGame(0);
    expect((state as any).perfectClearStageIds).toBeDefined();
  });

  it('newGame(0).perfectClearStageIds equals [] (not undefined)', () => {
    const state = newGame(0);
    expect((state as any).perfectClearStageIds).toEqual([]);
  });
});

describe('AC-8: startNewGamePlus preserves perfectClearStageIds earned before NG+', () => {
  it('carries a perfect-clear entry earned via processVictory through into the NG+ state', () => {
    let state = newGame(0);
    state = processVictory(state, makeStage({ id: '2-5' }), 100, undefined, 0, 3, true);

    const ngPlus = startNewGamePlus(state);

    expect((ngPlus as any).perfectClearStageIds).toEqual(['2-5']);
  });
});
