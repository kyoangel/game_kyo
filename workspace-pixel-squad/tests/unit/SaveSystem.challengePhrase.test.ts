import { describe, it, expect, beforeEach } from 'vitest';
import { saveSlot, loadSlot } from '../../src/save/SaveSystem';
import { processVictory } from '../../src/battle/VictoryProcessor';
import { CHALLENGE_PHRASES } from '../../src/data/challengePhrases';
import { newGame } from '../../src/save/GameState';
import { selectChallengePhrase } from '../../src/battle/ChallengePhrase';
import type { Stage, GameState } from '../../src/types';

// Spec: pixel-squad-post-clear-challenge-phrase-unlock
// "Persistence" rule: the unlocked phrase and its constraints must be
// persisted across playthroughs until activated or abandoned.
//
// saveSlot/loadSlot are plain JSON.stringify/parse (SaveSystem.ts), so this
// test drives the real processVictory + selectChallengePhrase pipeline
// first (matching SaveSystem.bestStarRatings.test.ts's approach) rather
// than round-tripping a hand-built literal, so it actually depends on the
// feature existing.

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

describe('challenge phrase persistence through saveSlot/loadSlot', () => {
  it('round-trips unlockedChallengePhraseIds produced by processVictory unchanged', () => {
    const linkedPhrase = CHALLENGE_PHRASES[0];
    let state: GameState = newGame(0);
    const stage = makeStage({ id: linkedPhrase.unlockStageId, unlocksChallengePhraseId: linkedPhrase.id } as Partial<Stage>);
    state = processVictory(state, stage, 100, undefined);

    saveSlot(state);
    const loaded = loadSlot(0);

    expect(loaded?.unlockedChallengePhraseIds).toEqual([linkedPhrase.id]);
  });

  it('round-trips an active phrase selection unchanged', () => {
    const target = CHALLENGE_PHRASES[0];
    let state: GameState = { ...newGame(0), unlockedChallengePhraseIds: [target.id] };
    state = selectChallengePhrase(state, target.id);

    saveSlot(state);
    const loaded = loadSlot(0);

    expect(loaded?.activeChallengePhraseId).toBe(target.id);
  });
});
