import { describe, it, expect, vi } from 'vitest';
import { getBossPhase, executeBossAction } from '../../src/battle/BossAI';
import type { BossConfig, BossAction } from '../../src/battle/BossAI';
import type { Character } from '../../src/types';

function makeChar(id: string, hp: number, maxHp: number, isPlayer: boolean): Character {
  return {
    id, templateId: id, name: id, isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp, maxHp, atk: 20, def: 10, spd: 10 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false, activeBuffs: [],
  };
}

const testConfig: BossConfig = {
  templateId: 'vega',
  phases: [
    { hpThreshold: 1.0, aiType: 'normal' },
    { hpThreshold: 0.5, aiType: 'aggressive' },
    { hpThreshold: 0.2, aiType: 'berserk', message: '最後衝刺！' },
  ],
};

describe('getBossPhase', () => {
  it('returns first phase at full HP (hpRatio = 1.0)', () => {
    const phase = getBossPhase(testConfig, 1.0);
    expect(phase.aiType).toBe('normal');
  });

  it('returns aggressive phase at exactly 50% HP', () => {
    const phase = getBossPhase(testConfig, 0.5);
    expect(phase.aiType).toBe('aggressive');
  });

  it('returns berserk phase below 20% HP', () => {
    const phase = getBossPhase(testConfig, 0.15);
    expect(phase.aiType).toBe('berserk');
  });

  it('returns berserk at exactly 20% HP', () => {
    const phase = getBossPhase(testConfig, 0.2);
    expect(phase.aiType).toBe('berserk');
  });

  it('returns last phase as fallback when none match (hpRatio 0)', () => {
    const phase = getBossPhase(testConfig, 0);
    expect(phase.aiType).toBe('berserk');
  });
});

describe('executeBossAction', () => {
  const boss = makeChar('boss', 100, 200, false);
  const players = [
    makeChar('p1', 80, 100, true),
    makeChar('p2', 30, 100, true),
  ];

  it('normal: returns attack action', () => {
    const phase = { hpThreshold: 1.0, aiType: 'normal' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    expect(action.target).toBeTruthy();
  });

  it('aggressive: targets the lowest HP player', () => {
    const phase = { hpThreshold: 0.5, aiType: 'aggressive' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    expect(action.target?.id).toBe('p2');
  });

  it('defensive: returns defend ~50% of the time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const phase = { hpThreshold: 0.6, aiType: 'defensive' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('defend');
    vi.restoreAllMocks();
  });

  it('defensive: attacks the other 50%', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7);
    const phase = { hpThreshold: 0.6, aiType: 'defensive' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    vi.restoreAllMocks();
  });

  it('berserk: returns attack with ignoreDefense = true', () => {
    const phase = { hpThreshold: 0.2, aiType: 'berserk' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('attack');
    expect(action.ignoreDefense).toBe(true);
  });

  it('desperation: returns double_attack', () => {
    const phase = { hpThreshold: 0.3, aiType: 'desperation' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.type).toBe('double_attack');
    expect(action.target).toBeTruthy();
  });

  it('returns attack targeting a random alive player when all alive', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const phase = { hpThreshold: 1.0, aiType: 'normal' as const };
    const action: BossAction = executeBossAction(boss, players, phase);
    expect(action.target).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('skips dead players for target selection', () => {
    const deadPlayers = [
      { ...makeChar('p1', 0, 100, true), alive: false },
      makeChar('p2', 30, 100, true),
    ];
    const phase = { hpThreshold: 1.0, aiType: 'normal' as const };
    const action: BossAction = executeBossAction(boss, deadPlayers, phase);
    expect(action.target?.id).toBe('p2');
  });
});
