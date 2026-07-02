import { describe, it, expect, beforeEach } from 'vitest';
import { saveSlot, loadSlot } from '../../src/save/SaveSystem';
import { newGame } from '../../src/save/GameState';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { Stage } from '../../src/types';

// Mock localStorage for Node environment, matching SaveSystem.test.ts's setup.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  length: 0,
  key: () => null,
} as unknown as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 100, currencyReward: 300,
    ...overrides,
  };
}

// Spec: pixel-squad-mercenary-rating-history
// AC-9: bestStarRatings round-trips through saveSlot/loadSlot unchanged.
//
// saveSlot/loadSlot are plain JSON.stringify/parse (SaveSystem.ts), so a
// hand-built GameState literal would round-trip regardless of whether the
// feature exists. To make this test actually depend on the feature, the
// ratings here are produced by the real processVictory pipeline first.

describe('AC-9: bestStarRatings persistence through saveSlot/loadSlot', () => {
  it('round-trips a bestStarRatings map produced by processVictory unchanged', () => {
    let state = newGame(0);
    state = processVictory(state, makeStage({ id: '1-1' }), 100, undefined, 0, 3);
    state = processVictory(state, makeStage({ id: '1-2' }), 100, undefined, 0, 1);

    saveSlot(state);
    const loaded = loadSlot(0);

    expect((loaded as any)?.bestStarRatings).toEqual({ '1-1': 3, '1-2': 1 });
  });
});
