import { describe, it, expect } from 'vitest';
import {
  BOSS_RUSH_STAGE_IDS,
  startChallengeRun,
  advanceChallengeRun,
  isChallengeRunComplete,
  isSquadDefeated,
  settleChallengeRunRewards,
} from '../../src/battle/ChallengeRun';
import type { Character, ChallengeRunState, Stage } from '../../src/types';
import { newGame } from '../../src/save/GameState';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'p1', templateId: 'vega', name: 'Vega', isProtagonist: false, isPlayer: true,
    level: 5, exp: 0, expToNext: 250,
    stats: { hp: 80, maxHp: 100, atk: 30, def: 10, spd: 14 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

function makeBossStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: '1-5', chapterId: 'ch1', name: '[BOSS] 鐵拳 Vega', stageIndex: 4,
    isBoss: true, isSideQuest: false,
    enemies: [], expReward: 120, currencyReward: 80,
    ...overrides,
  };
}

describe('BOSS_RUSH_STAGE_IDS', () => {
  it('lists the five chapter bosses in chapter order', () => {
    expect(BOSS_RUSH_STAGE_IDS).toEqual(['1-5', '2-5', '3-5', '4-5', '5-5']);
  });
});

describe('startChallengeRun', () => {
  it('queues all five boss stage ids', () => {
    const squad = [makeCharacter()];
    const run = startChallengeRun(squad);
    expect(run.bossStageIds).toEqual(['1-5', '2-5', '3-5', '4-5', '5-5']);
  });

  it('locks a snapshot of the squad', () => {
    const squad = [makeCharacter({ id: 'p1' }), makeCharacter({ id: 'p2' })];
    const run = startChallengeRun(squad);
    expect(run.lockedSquad.map(c => c.id)).toEqual(['p1', 'p2']);
  });

  it('starts accumulatedCurrency at 0', () => {
    const run = startChallengeRun([makeCharacter()]);
    expect(run.accumulatedCurrency).toBe(0);
  });

  it('does not mutate the passed-in squad', () => {
    const squad = [makeCharacter({ stats: { hp: 80, maxHp: 100, atk: 30, def: 10, spd: 14 } })];
    const run = startChallengeRun(squad);
    run.lockedSquad[0].stats.hp = 1;
    expect(squad[0].stats.hp).toBe(80);
  });
});

describe('advanceChallengeRun', () => {
  it('removes the cleared boss stage id from the front of the queue', () => {
    const run: ChallengeRunState = {
      bossStageIds: ['1-5', '2-5', '3-5', '4-5', '5-5'],
      lockedSquad: [makeCharacter()],
      accumulatedCurrency: 0,
    };
    const survivors = [makeCharacter({ stats: { hp: 50, maxHp: 100, atk: 30, def: 10, spd: 14 } })];
    const next = advanceChallengeRun(run, makeBossStage({ id: '1-5', currencyReward: 80 }), survivors);
    expect(next.bossStageIds).toEqual(['2-5', '3-5', '4-5', '5-5']);
  });

  it('adds the cleared boss stage currencyReward to accumulatedCurrency', () => {
    const run: ChallengeRunState = {
      bossStageIds: ['1-5', '2-5', '3-5', '4-5', '5-5'],
      lockedSquad: [makeCharacter()],
      accumulatedCurrency: 0,
    };
    const next = advanceChallengeRun(run, makeBossStage({ id: '1-5', currencyReward: 80 }), [makeCharacter()]);
    expect(next.accumulatedCurrency).toBe(80);
  });

  it('accumulates currency across multiple advances', () => {
    let run: ChallengeRunState = {
      bossStageIds: ['1-5', '2-5'],
      lockedSquad: [makeCharacter()],
      accumulatedCurrency: 80,
    };
    run = advanceChallengeRun(run, makeBossStage({ id: '2-5', currencyReward: 120 }), [makeCharacter()]);
    expect(run.accumulatedCurrency).toBe(200);
  });

  it('carries over the surviving squad HP from the previous fight (no auto-heal)', () => {
    const run: ChallengeRunState = {
      bossStageIds: ['1-5'],
      lockedSquad: [makeCharacter({ stats: { hp: 100, maxHp: 100, atk: 30, def: 10, spd: 14 } })],
      accumulatedCurrency: 0,
    };
    const woundedSurvivors = [makeCharacter({ stats: { hp: 23, maxHp: 100, atk: 30, def: 10, spd: 14 } })];
    const next = advanceChallengeRun(run, makeBossStage(), woundedSurvivors);
    expect(next.lockedSquad[0].stats.hp).toBe(23);
  });

  it('carries over activeBuffs from the previous fight', () => {
    const run: ChallengeRunState = {
      bossStageIds: ['1-5'],
      lockedSquad: [makeCharacter()],
      accumulatedCurrency: 0,
    };
    const buffedSurvivors = [makeCharacter({
      activeBuffs: [{ stat: 'atk', amountPct: 20, turnsRemaining: 2, sourceSkillId: 'overdrive' }],
    })];
    const next = advanceChallengeRun(run, makeBossStage(), buffedSurvivors);
    expect(next.lockedSquad[0].activeBuffs).toEqual([
      { stat: 'atk', amountPct: 20, turnsRemaining: 2, sourceSkillId: 'overdrive' },
    ]);
  });

  it('resets defending to false on the carried-over squad', () => {
    const run: ChallengeRunState = {
      bossStageIds: ['1-5'],
      lockedSquad: [makeCharacter()],
      accumulatedCurrency: 0,
    };
    const survivors = [makeCharacter({ defending: true })];
    const next = advanceChallengeRun(run, makeBossStage(), survivors);
    expect(next.lockedSquad[0].defending).toBe(false);
  });
});

describe('isChallengeRunComplete', () => {
  it('is false while boss stage ids remain', () => {
    const run: ChallengeRunState = { bossStageIds: ['5-5'], lockedSquad: [], accumulatedCurrency: 0 };
    expect(isChallengeRunComplete(run)).toBe(false);
  });

  it('is true once all five bosses have been cleared', () => {
    const run: ChallengeRunState = { bossStageIds: [], lockedSquad: [], accumulatedCurrency: 0 };
    expect(isChallengeRunComplete(run)).toBe(true);
  });
});

describe('isSquadDefeated', () => {
  it('is false when at least one squad member is alive', () => {
    const squad = [makeCharacter({ alive: false }), makeCharacter({ alive: true })];
    expect(isSquadDefeated(squad)).toBe(false);
  });

  it('is true when every squad member has fallen', () => {
    const squad = [makeCharacter({ alive: false }), makeCharacter({ alive: false })];
    expect(isSquadDefeated(squad)).toBe(true);
  });
});

describe('settleChallengeRunRewards', () => {
  it('multiplies the accumulated currency total by 1.5 on a full clear', () => {
    const result = settleChallengeRunRewards(200, [], () => 0);
    expect(result.currency).toBe(300);
  });

  it('awards one EXCLUSIVE_ITEMS id the player does not already own', () => {
    const result = settleChallengeRunRewards(200, [], () => 0);
    expect(result.itemId).toBe('scroll_overdrive');
  });

  it('uses the provided random-index function to pick among unowned items', () => {
    const result = settleChallengeRunRewards(200, [], () => 1);
    expect(result.itemId).toBe('supply_nano_kit');
  });

  it('only offers items the player does not already own', () => {
    const result = settleChallengeRunRewards(200, ['scroll_overdrive'], () => 0);
    expect(result.itemId).toBe('supply_nano_kit');
  });

  it('grants no itemId when the player already owns every exclusive item', () => {
    const result = settleChallengeRunRewards(200, ['scroll_overdrive', 'supply_nano_kit'], () => 0);
    expect(result.itemId).toBeUndefined();
  });

  it('still grants currency when the player owns every exclusive item', () => {
    const result = settleChallengeRunRewards(200, ['scroll_overdrive', 'supply_nano_kit'], () => 0);
    expect(result.currency).toBeGreaterThanOrEqual(300);
  });
});

describe('Boss Rush does not affect main-game progression', () => {
  it('clearing a boss via Boss Rush does not add it to stageProgress.completedStageIds', () => {
    // Boss Rush settlement must not call processVictory on the main gameState —
    // it tracks rewards independently via ChallengeRunState.accumulatedCurrency.
    const state = newGame(0);
    const stage = makeBossStage({ id: '2-5', unlockCharacterId: 'crow' });
    const run = startChallengeRun(state.squad);
    advanceChallengeRun(run, stage, state.squad);
    expect(state.stageProgress.completedStageIds).toEqual([]);
  });

  it('a mid-run wipe leaves currency and completedStageIds untouched from before the run started', () => {
    const state = newGame(0);
    state.currency = 50;
    const currencyBefore = state.currency;
    const completedBefore = [...state.stageProgress.completedStageIds];

    const run = startChallengeRun(state.squad);
    const wipedSquad = state.squad.map(c => ({ ...c, alive: false }));
    expect(isSquadDefeated(wipedSquad)).toBe(true);
    // No settlement function should be invoked on a wipe — gameState must be untouched.
    expect(state.currency).toBe(currencyBefore);
    expect(state.stageProgress.completedStageIds).toEqual(completedBefore);
    expect(run.accumulatedCurrency).toBe(0);
  });
});
