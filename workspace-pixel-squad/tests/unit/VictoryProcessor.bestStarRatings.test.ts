import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: pixel-squad-mercenary-rating-history
// processVictory must, immediately after the expPool update, set
//   bestStarRatings[stage.id] = Math.max(existingBest, starRating)
// by replacing bestStarRatings with a new object (never mutating the
// existing one in place), and must treat a missing bestStarRatings key
// (legacy save) as {} rather than throwing.
// AC-2, AC-3, AC-4, AC-5 + rule 4 (immutability).

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

describe('AC-2: processVictory records a new bestStarRatings entry for an unseen stage', () => {
  it('sets bestStarRatings["1-1"] = 2 when there was no prior record', () => {
    const state = makeGameState({ bestStarRatings: {} } as any);
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 2) as any;
    expect(result.bestStarRatings['1-1']).toBe(2);
  });
});

describe('AC-3: monotonic — a worse replay never downgrades the best', () => {
  it('keeps bestStarRatings["1-1"] at 3 after a 1-star replay, in a freshly-built object', () => {
    const originalRatings = { '1-1': 3 };
    const state = makeGameState({ bestStarRatings: originalRatings } as any);
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 1) as any;

    // The value must still be 3, produced by an actual max() computation into
    // a new object — not merely left untouched by a no-op implementation.
    expect(result.bestStarRatings).not.toBe(originalRatings);
    expect(result.bestStarRatings['1-1']).toBe(3);
  });
});

describe('AC-4: a better replay raises the best', () => {
  it('raises bestStarRatings["1-1"] from 1 to 3', () => {
    const state = makeGameState({ bestStarRatings: { '1-1': 1 } } as any);
    const stage = makeStage();
    const result = processVictory(state, stage, 100, undefined, 0, 3) as any;
    expect(result.bestStarRatings['1-1']).toBe(3);
  });
});

describe('AC-5: legacy save with no bestStarRatings key at all does not throw', () => {
  it('initializes the record for the cleared stage instead of throwing', () => {
    const legacyState = makeGameState();
    delete (legacyState as any).bestStarRatings;
    const stage = makeStage();

    expect(() => processVictory(legacyState, stage, 100, undefined, 0, 2)).not.toThrow();

    const result = processVictory(legacyState, stage, 100, undefined, 0, 2) as any;
    expect(result.bestStarRatings['1-1']).toBe(2);
  });
});

describe('rule 4: immutability — bestStarRatings is replaced, not mutated in place', () => {
  it('leaves the input object untouched and returns a distinct object with the updated max', () => {
    const original = { '1-1': 1 };
    const state = makeGameState({ bestStarRatings: original } as any);
    const stage = makeStage();

    const result = processVictory(state, stage, 100, undefined, 0, 3) as any;

    expect(original).toEqual({ '1-1': 1 });
    expect(result.bestStarRatings).not.toBe(original);
    expect(result.bestStarRatings['1-1']).toBe(3);
  });
});

describe('clearing a different stage does not touch or drop an existing entry', () => {
  it('preserves "1-1" while adding "1-2" on a separate victory', () => {
    const state = makeGameState({ bestStarRatings: { '1-1': 2 } } as any);
    const stage = makeStage({ id: '1-2' });

    const result = processVictory(state, stage, 100, undefined, 0, 3) as any;

    expect(result.bestStarRatings['1-1']).toBe(2);
    expect(result.bestStarRatings['1-2']).toBe(3);
  });
});
