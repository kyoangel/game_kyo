import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

function makeGameState(): GameState {
  return newGame(0);
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 40, currencyReward: 20,
    ...overrides,
  };
}

function makeFinalBossStage(): Stage {
  return {
    id: '5-5', chapterId: 'ch5', name: '[BOSS] AAAA', stageIndex: 4,
    isBoss: true, isSideQuest: false, unlockCharacterId: 'aaaa',
    enemies: [], expReward: 500, currencyReward: 300,
  };
}

describe('processVictory — New Game+ reward multiplier', () => {
  it('does not scale rewards when ngPlusCycle is 0', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 40, undefined, 0);
    expect(result.expPool).toBe(40);
    expect(result.currency).toBe(20);
  });

  it('scales currencyReward by 1.2 at ngPlusCycle 1, rounded', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 0, undefined, 1);
    expect(result.currency).toBe(Math.round(20 * 1.2));
  });

  it('scales expGained by 1.2 at ngPlusCycle 1, rounded', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 40, undefined, 1);
    expect(result.expPool).toBe(Math.round(40 * 1.2));
  });

  it('scales rewards by 1.4 at ngPlusCycle 2, rounded', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 40, undefined, 2);
    expect(result.currency).toBe(Math.round(20 * 1.4));
    expect(result.expPool).toBe(Math.round(40 * 1.4));
  });

  it('re-grants itemRewards for a side quest cleared again during a New Game+ cycle', () => {
    const state = makeGameState();
    state.stageProgress.completedStageIds = ['SQ-1'];
    state.inventory = [];
    const stage = makeStage({
      id: 'SQ-1', chapterId: 'sq', isSideQuest: true, unlockAfterStageId: '1-5',
      itemRewards: [{ itemId: 'scroll_overdrive', quantity: 1 }],
    });
    const result = processVictory(state, stage, 0, undefined, 0);
    expect(result.inventory).toEqual([{ itemId: 'scroll_overdrive', quantity: 1 }]);
  });
});

describe('processVictory — hasClearedGame flag', () => {
  it('sets hasClearedGame to true on a first-time victory over stage 5-5', () => {
    const state = makeGameState();
    state.hasClearedGame = false;
    const stage = makeFinalBossStage();
    const result = processVictory(state, stage, 500, undefined, 0);
    expect(result.hasClearedGame).toBe(true);
  });

  it('keeps hasClearedGame true on a repeat victory over stage 5-5 (e.g. during NG+)', () => {
    const state = makeGameState();
    state.hasClearedGame = true;
    state.stageProgress.completedStageIds = ['5-5'];
    const stage = makeFinalBossStage();
    const result = processVictory(state, stage, 500, undefined, 1);
    expect(result.hasClearedGame).toBe(true);
  });

  it('does not set hasClearedGame on victories over non-final stages', () => {
    const state = makeGameState();
    state.hasClearedGame = false;
    const stage = makeStage({ id: '1-5', isBoss: true });
    const result = processVictory(state, stage, 100, undefined, 0);
    expect(result.hasClearedGame).toBe(false);
  });
});
