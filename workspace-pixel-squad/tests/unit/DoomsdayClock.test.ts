import { describe, it, expect } from 'vitest';
import {
  DOOMSDAY_INITIAL_DAYS,
  MAIN_STORY_DAY_COST,
  SIDE_QUEST_DAY_COST,
  HIDDEN_STAGE_DAY_COST,
  getStageDoomsdayCost,
  getDoomsdayDaysRemaining,
  tickDoomsdayClock,
  isDoomsdayExpired,
} from '../../src/battle/DoomsdayClock';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: specs/pixel-squad-doomsday-timer.md
// battle/DoomsdayClock.ts does not exist yet — every import above fails to
// resolve, which is the expected "not implemented" failure mode for this
// suite. Covers AC-2 through AC-9 at the pure-function level plus Rule 3/5/7.

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 40, currencyReward: 20,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

describe('constants', () => {
  it('DOOMSDAY_INITIAL_DAYS is 32', () => {
    expect(DOOMSDAY_INITIAL_DAYS).toBe(32);
  });

  it('MAIN_STORY_DAY_COST is 1', () => {
    expect(MAIN_STORY_DAY_COST).toBe(1);
  });

  it('SIDE_QUEST_DAY_COST is 3', () => {
    expect(SIDE_QUEST_DAY_COST).toBe(3);
  });

  it('HIDDEN_STAGE_DAY_COST is 4', () => {
    expect(HIDDEN_STAGE_DAY_COST).toBe(4);
  });
});

describe('Rule 3: getStageDoomsdayCost precedence — hidden > side quest > main story', () => {
  it('returns MAIN_STORY_DAY_COST for a normal main-story stage', () => {
    const stage = makeStage({ isSideQuest: false, isHidden: undefined });
    expect(getStageDoomsdayCost(stage)).toBe(MAIN_STORY_DAY_COST);
  });

  it('returns MAIN_STORY_DAY_COST for a boss stage (isBoss true is still main story)', () => {
    const stage = makeStage({ isBoss: true, isSideQuest: false });
    expect(getStageDoomsdayCost(stage)).toBe(MAIN_STORY_DAY_COST);
  });

  it('returns SIDE_QUEST_DAY_COST for a side-quest stage', () => {
    const stage = makeStage({ id: 'SQ-1', chapterId: 'sq', isSideQuest: true });
    expect(getStageDoomsdayCost(stage)).toBe(SIDE_QUEST_DAY_COST);
  });

  it('returns HIDDEN_STAGE_DAY_COST for the hidden stage', () => {
    const stage = makeStage({ id: 'HS-1', isHidden: true });
    expect(getStageDoomsdayCost(stage)).toBe(HIDDEN_STAGE_DAY_COST);
  });

  it('the hidden check wins even when isSideQuest is also true', () => {
    const stage = makeStage({ id: 'HS-1', isHidden: true, isSideQuest: true });
    expect(getStageDoomsdayCost(stage)).toBe(HIDDEN_STAGE_DAY_COST);
  });
});

describe('AC-6/Rule 1: getDoomsdayDaysRemaining defaults a missing value to DOOMSDAY_INITIAL_DAYS', () => {
  it('returns DOOMSDAY_INITIAL_DAYS (32) when doomsdayDaysRemaining is undefined', () => {
    const state = makeGameState();
    delete (state as any).doomsdayDaysRemaining;
    expect(getDoomsdayDaysRemaining(state)).toBe(32);
  });

  it('returns the stored value when present', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 5 } as any);
    expect(getDoomsdayDaysRemaining(state)).toBe(5);
  });

  it('returns 0 when the stored value is exactly 0 (not treated as falsy/missing)', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 0 } as any);
    expect(getDoomsdayDaysRemaining(state)).toBe(0);
  });
});

describe('tickDoomsdayClock — subtracts the correct per-type cost, floors at 0', () => {
  it('subtracts MAIN_STORY_DAY_COST for a main-story clear', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    expect(tickDoomsdayClock(state, makeStage())).toBe(9);
  });

  it('subtracts SIDE_QUEST_DAY_COST for a side-quest clear', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    expect(tickDoomsdayClock(state, makeStage({ id: 'SQ-1', chapterId: 'sq', isSideQuest: true }))).toBe(7);
  });

  it('subtracts HIDDEN_STAGE_DAY_COST for the hidden-stage clear', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    expect(tickDoomsdayClock(state, makeStage({ id: 'HS-1', isHidden: true }))).toBe(6);
  });

  it('floors at 0 rather than going negative (2 - 4 = 0, not -2)', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 2 } as any);
    expect(tickDoomsdayClock(state, makeStage({ id: 'HS-1', isHidden: true }))).toBe(0);
  });

  it('is pure — does not mutate the input gameState', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    tickDoomsdayClock(state, makeStage());
    expect((state as any).doomsdayDaysRemaining).toBe(10);
  });

  it('treats a legacy state with no doomsdayDaysRemaining key as starting from DOOMSDAY_INITIAL_DAYS', () => {
    const state = makeGameState();
    delete (state as any).doomsdayDaysRemaining;
    expect(tickDoomsdayClock(state, makeStage())).toBe(DOOMSDAY_INITIAL_DAYS - 1);
  });
});

describe('AC-7/AC-8/AC-9/Rule 7: isDoomsdayExpired', () => {
  it('is true when daysRemaining <= 0 and hasClearedGame is false', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 0, hasClearedGame: false } as any);
    expect(isDoomsdayExpired(state)).toBe(true);
  });

  it('is false when daysRemaining > 0, regardless of hasClearedGame', () => {
    const notCleared = makeGameState({ doomsdayDaysRemaining: 1, hasClearedGame: false } as any);
    expect(isDoomsdayExpired(notCleared)).toBe(false);

    const cleared = makeGameState({ doomsdayDaysRemaining: 1, hasClearedGame: true } as any);
    expect(isDoomsdayExpired(cleared)).toBe(false);
  });

  it('is false when daysRemaining <= 0 but hasClearedGame is already true (post-game farming never re-triggers expiry)', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 0, hasClearedGame: true } as any);
    expect(isDoomsdayExpired(state)).toBe(false);
  });
});
