import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: pixel-squad-mercenary-rating
// processVictory gains a 6th optional param `starRating = 1`, scaling
// EXP/currency alongside the existing NG+ `rewardMultiplier`:
//   starMultiplier = 1 + (clamp(starRating, 1, 3) - 1) * 0.1
//   totalMultiplier = rewardMultiplier * starMultiplier
// AC-6: a 3★ result yields exactly 1.2x currency/EXP vs a 1★ result on the
// same stage with the same ngPlusCycle.
// AC-11: default starRating = 1 reproduces prior (pre-feature) reward math.

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 100, currencyReward: 300,
    ...overrides,
  };
}

describe('processVictory star rating reward scaling', () => {
  it('1★ (starRating = 1) applies no bonus — currency/exp equal the base reward', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 1);
    expect(result.currency).toBe(state.currency + stage.currencyReward);
    expect(result.expPool).toBe(state.expPool + 100);
  });

  it('2★ (starRating = 2) scales currency/exp by exactly 1.1x, rounded', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 2);
    expect(result.currency).toBe(state.currency + Math.round(stage.currencyReward * 1.1));
    expect(result.expPool).toBe(state.expPool + Math.round(100 * 1.1));
  });

  it('3★ (starRating = 3) scales currency/exp by exactly 1.2x, rounded', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 3);
    expect(result.currency).toBe(state.currency + Math.round(stage.currencyReward * 1.2));
    expect(result.expPool).toBe(state.expPool + Math.round(100 * 1.2));
  });

  it('AC-6: 3★ yields exactly 1.2x the reward of a 1★ result on the same stage/ngPlusCycle', () => {
    const stage = makeStage();
    const oneStarResult = processVictory(makeGameState(), stage, 100, undefined, 0, 1);
    const threeStarResult = processVictory(makeGameState(), stage, 100, undefined, 0, 3);

    expect(threeStarResult.currency).toBe(Math.round(oneStarResult.currency * 1.2));
    expect(threeStarResult.expPool).toBe(Math.round(oneStarResult.expPool * 1.2));
  });

  it('stacks multiplicatively with NG+ rewardMultiplier: ngPlusCycle=1 (1.2x) * 3★ (1.2x) = 1.44x', () => {
    const state = makeGameState({ ngPlusCycle: 1 });
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 1, 3);
    expect(result.currency).toBe(state.currency + Math.round(stage.currencyReward * 1.44));
    expect(result.expPool).toBe(state.expPool + Math.round(100 * 1.44));
  });

  it('AC-11: calling with only 4 args (no starRating) still applies exactly a 1.0x star multiplier', () => {
    const state = makeGameState();
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined);
    expect(result.currency).toBe(state.currency + stage.currencyReward);
    expect(result.expPool).toBe(state.expPool + 100);
  });
});
