import { describe, it, expect } from 'vitest';
import { processVictory } from '../../src/battle/VictoryProcessor';
import type { GameState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

// Spec: specs/pixel-squad-doomsday-timer.md
// processVictory() does not yet tick doomsdayDaysRemaining, and
// battle/DoomsdayClock.ts (isDoomsdayExpired, DOOMSDAY_INITIAL_DAYS) does
// not exist yet — every test below fails today either because the import
// can't resolve or because the returned state's doomsdayDaysRemaining is
// undefined/unchanged. Covers AC-2 through AC-9, AC-13 (regression).

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return { ...newGame(0), ...overrides };
}

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-1', chapterId: 'ch1', name: '廢城入口', stageIndex: 0,
    isBoss: false, isSideQuest: false,
    enemies: [], expReward: 40, currencyReward: 20,
    ...overrides,
  };
}

describe('AC-2: clearing a main-story stage deducts 1 day', () => {
  it('doomsdayDaysRemaining goes from 10 to 9', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    const stage = makeStage({ id: '1-1', isSideQuest: false });
    const result = processVictory(state, stage, 40, undefined) as any;
    expect(result.doomsdayDaysRemaining).toBe(9);
  });
});

describe('AC-3: clearing a side-quest stage deducts 3 days', () => {
  it('doomsdayDaysRemaining goes from 10 to 7', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    const stage = makeStage({ id: 'SQ-1', chapterId: 'sq', isSideQuest: true });
    const result = processVictory(state, stage, 40, undefined) as any;
    expect(result.doomsdayDaysRemaining).toBe(7);
  });
});

describe('AC-4: clearing the hidden stage deducts 4 days', () => {
  it('doomsdayDaysRemaining goes from 10 to 6', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    const stage = makeStage({ id: 'HS-1', isHidden: true });
    const result = processVictory(state, stage, 40, undefined) as any;
    expect(result.doomsdayDaysRemaining).toBe(6);
  });
});

describe('AC-5: the clock floors at 0 and never goes negative', () => {
  it('2 days remaining minus the hidden-stage cost (4) clamps to 0', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 2 } as any);
    const stage = makeStage({ id: 'HS-1', isHidden: true });
    const result = processVictory(state, stage, 40, undefined) as any;
    expect(result.doomsdayDaysRemaining).toBe(0);
  });

  it('stays at 0 across repeated clears, never negative', () => {
    let state: any = makeGameState({ doomsdayDaysRemaining: 0 } as any);
    const stage = makeStage({ id: 'HS-1', isHidden: true });
    state = processVictory(state, stage, 40, undefined);
    state = processVictory(state, stage, 40, undefined);
    expect(state.doomsdayDaysRemaining).toBe(0);
  });
});

describe('Rule 4: repeated clears of an already-completed stage keep deducting (no first-clear gate)', () => {
  it('deducts a day again on the second clear of the same stage', () => {
    let state: any = makeGameState({ doomsdayDaysRemaining: 10 } as any);
    const stage = makeStage({ id: '1-1' });
    state = processVictory(state, stage, 40, undefined);
    expect(state.doomsdayDaysRemaining).toBe(9);
    state = processVictory(state, stage, 40, undefined);
    expect(state.doomsdayDaysRemaining).toBe(8);
  });
});

describe('legacy save: a gameState with doomsdayDaysRemaining undefined starts from DOOMSDAY_INITIAL_DAYS (32)', () => {
  it('ticks down from 32 by the stage cost', () => {
    const state = makeGameState();
    delete (state as any).doomsdayDaysRemaining;
    const stage = makeStage({ id: '1-1' });
    const result = processVictory(state, stage, 40, undefined) as any;
    expect(result.doomsdayDaysRemaining).toBe(31);
  });
});

describe('AC-7: a non-final-boss clear that drains the clock to 0 triggers doomsday expiry', () => {
  it('isDoomsdayExpired(result) is true', async () => {
    const { isDoomsdayExpired } = await import('../../src/battle/DoomsdayClock');
    const state = makeGameState({ doomsdayDaysRemaining: 1, hasClearedGame: false } as any);
    const stage = makeStage({ id: '1-1' });
    const result = processVictory(state, stage, 40, undefined) as any;
    expect(isDoomsdayExpired(result)).toBe(true);
  });
});

describe('AC-8/Rule 7: clearing stage 5-5 wins outright even when the clock also hits 0 in the same call', () => {
  it('hasClearedGame is true and isDoomsdayExpired is false — win priority over expiry', async () => {
    const { isDoomsdayExpired } = await import('../../src/battle/DoomsdayClock');
    const state = makeGameState({ doomsdayDaysRemaining: 1, hasClearedGame: false } as any);
    const finalStage = makeStage({ id: '5-5', chapterId: 'ch5', stageIndex: 4, isBoss: true });
    const result = processVictory(state, finalStage, 40, undefined) as any;
    expect(result.hasClearedGame).toBe(true);
    expect(isDoomsdayExpired(result)).toBe(false);
  });
});

describe('AC-9: post-game clears still tick and clamp the clock, but never re-trigger expiry', () => {
  it('doomsdayDaysRemaining clamps to 0 while isDoomsdayExpired stays false once hasClearedGame is already true', async () => {
    const { isDoomsdayExpired } = await import('../../src/battle/DoomsdayClock');
    const state = makeGameState({ doomsdayDaysRemaining: 1, hasClearedGame: true } as any);
    const stage = makeStage({ id: '1-1' });
    const result = processVictory(state, stage, 40, undefined) as any;
    expect(result.doomsdayDaysRemaining).toBe(0);
    expect(isDoomsdayExpired(result)).toBe(false);
  });
});

describe('AC-13 (regression): the doomsday tick is additive and does not disturb existing processVictory behavior', () => {
  it('still applies currency, exp, and hasClearedGame updates alongside the new doomsday tick', () => {
    const state = makeGameState({ doomsdayDaysRemaining: 10, currency: 0, expPool: 0 } as any);
    const stage = makeStage({ id: '1-1', currencyReward: 20, expReward: 40 });
    const result = processVictory(state, stage, 40, undefined) as any;

    expect(result.currency).toBe(20);
    expect(result.expPool).toBe(40);
    expect(result.stageProgress.completedStageIds).toContain('1-1');
    expect(result.doomsdayDaysRemaining).toBe(9);
  });
});
