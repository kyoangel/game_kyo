import { describe, it, expect } from 'vitest';
import { newGame, startNewGamePlus } from '../../src/save/GameState';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { Stage } from '../../src/types';

// Spec: pixel-squad-mercenary-rating-history
// AC-1: newGame() initializes bestStarRatings as {} (not undefined)
// AC-10: startNewGamePlus preserves bestStarRatings earned before NG+ started
//   (rule 6 — startNewGamePlus itself needs no code change; only the
//   upstream newGame()/processVictory wiring does, so this test drives the
//   real pipeline rather than hand-constructing the field)

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 100, currencyReward: 300,
    ...overrides,
  };
}

describe('AC-1: GameState.bestStarRatings initializes on newGame', () => {
  it('newGame(0).bestStarRatings is defined', () => {
    const state = newGame(0);
    expect((state as any).bestStarRatings).toBeDefined();
  });

  it('newGame(0).bestStarRatings equals {} (not undefined)', () => {
    const state = newGame(0);
    expect((state as any).bestStarRatings).toEqual({});
  });
});

describe('AC-10: startNewGamePlus preserves bestStarRatings earned before NG+', () => {
  it('carries a rating earned via processVictory through into the NG+ state', () => {
    let state = newGame(0);
    state = processVictory(state, makeStage({ id: '2-3' }), 100, undefined, 0, 3);

    const ngPlus = startNewGamePlus(state);

    expect((ngPlus as any).bestStarRatings).toEqual({ '2-3': 3 });
  });
});
