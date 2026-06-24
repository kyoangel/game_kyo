import { describe, it, expect, beforeEach } from 'vitest';
import { saveSlot, loadSlot, deleteSlot, listSlots } from '../../src/save/SaveSystem';
import type { GameState } from '../../src/types';

// Mock localStorage for Node environment
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

function makeState(slot: 0 | 1 | 2): GameState {
  return {
    slotId: slot,
    pool: [],
    squad: [],
    expPool: 0,
    currency: 100,
    stageProgress: { completedStageIds: ['1-1', '1-2'] },
    savedAt: 1234567890,
  };
}

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

describe('saveSlot + loadSlot', () => {
  it('round-trips a GameState', () => {
    const state = makeState(0);
    saveSlot(state);
    const loaded = loadSlot(0);
    expect(loaded).toEqual(state);
  });

  it('stores separate keys for different slots', () => {
    saveSlot(makeState(0));
    saveSlot(makeState(1));
    expect(loadSlot(0)?.slotId).toBe(0);
    expect(loadSlot(1)?.slotId).toBe(1);
  });
});

describe('loadSlot', () => {
  it('returns null for empty slot', () => {
    expect(loadSlot(2)).toBeNull();
  });

  it('returns null for corrupted data', () => {
    store['pixelSquad_save_0'] = 'not-json{{{';
    expect(loadSlot(0)).toBeNull();
  });
});

describe('deleteSlot', () => {
  it('makes slot return null after deletion', () => {
    saveSlot(makeState(1));
    expect(loadSlot(1)).not.toBeNull();
    deleteSlot(1);
    expect(loadSlot(1)).toBeNull();
  });
});

describe('listSlots', () => {
  it('returns 3 entries with empty=true for unused slots', () => {
    const slots = listSlots();
    expect(slots).toHaveLength(3);
    expect(slots.every(s => s.empty)).toBe(true);
  });

  it('fills metadata for saved slots', () => {
    const state = makeState(0);
    state.stageProgress.inChapterRun = {
      chapterId: 'ch2',
      currentStageIndex: 2,
      lockedSquad: [],
    };
    state.squad = [{ id: 'p1' } as never, { id: 'p2' } as never];
    saveSlot(state);
    const slots = listSlots();
    expect(slots[0].empty).toBe(false);
    expect(slots[0].chapterName).toBe('ch2');
    expect(slots[0].squadSize).toBe(2);
    expect(slots[0].savedAt).toBe(1234567890);
    expect(slots[1].empty).toBe(true);
  });

  it('shows 基地 when not in chapter run', () => {
    saveSlot(makeState(2));
    const slots = listSlots();
    expect(slots[2].chapterName).toBe('基地');
  });
});

import { newGame } from '../../src/save/GameState';

describe('newGame', () => {
  it('creates a GameState with the given slot', () => {
    const state = newGame(1);
    expect(state.slotId).toBe(1);
  });

  it('starts with protagonist as the only pool member', () => {
    const state = newGame(0);
    expect(state.pool).toHaveLength(1);
    expect(state.pool[0].isProtagonist).toBe(true);
    expect(state.squad).toHaveLength(1);
    expect(state.squad[0].isProtagonist).toBe(true);
  });

  it('starts with zero currency and zero expPool', () => {
    const state = newGame(0);
    expect(state.currency).toBe(0);
    expect(state.expPool).toBe(0);
  });

  it('starts with empty stage progress', () => {
    const state = newGame(0);
    expect(state.stageProgress.completedStageIds).toHaveLength(0);
    expect(state.stageProgress.inChapterRun).toBeUndefined();
  });
});
