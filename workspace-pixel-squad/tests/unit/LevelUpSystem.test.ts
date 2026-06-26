import { describe, it, expect, vi } from 'vitest';
import { canLevelUp, applyLevelUp, DEFAULT_LEVEL_UP_CONFIG } from '../../src/battle/LevelUpSystem';
import type { Character } from '../../src/types';

function makeChar(id: string, level: number, isProtagonist: boolean, statPoints = 0): Character {
  return {
    id, templateId: id, name: id, isProtagonist, isPlayer: true,
    level, exp: 0, expToNext: level * 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 10 },
    skills: [], statPoints, archetype: '全能', alive: true, defending: false, activeBuffs: [],
  };
}

const cfg = DEFAULT_LEVEL_UP_CONFIG; // expFormula: level * 50, protagonist.pointsPerLevel: 5

describe('canLevelUp', () => {
  it('returns true when pool equals cost exactly', () => {
    expect(canLevelUp(makeChar('a', 2, false), 100, cfg)).toBe(true); // 2*50=100
  });

  it('returns true when pool exceeds cost', () => {
    expect(canLevelUp(makeChar('a', 1, false), 200, cfg)).toBe(true);
  });

  it('returns false when pool is one short', () => {
    expect(canLevelUp(makeChar('a', 2, false), 99, cfg)).toBe(false);
  });

  it('returns false when pool is zero', () => {
    expect(canLevelUp(makeChar('a', 1, false), 0, cfg)).toBe(false);
  });
});

describe('applyLevelUp', () => {
  it('does nothing when pool < cost', () => {
    const char = makeChar('a', 1, false);
    const result = applyLevelUp(char, 10, cfg); // cost=50
    expect(result.character.level).toBe(1);
    expect(result.expPool).toBe(10);
  });

  it('protagonist: increments level, adds statPoints, decrements pool', () => {
    const char = makeChar('p', 1, true, 0);
    const result = applyLevelUp(char, 100, cfg); // cost=50
    expect(result.character.level).toBe(2);
    expect(result.character.statPoints).toBe(5);
    expect(result.expPool).toBe(50);
  });

  it('protagonist: updates expToNext to new level cost', () => {
    const char = makeChar('p', 1, true);
    const result = applyLevelUp(char, 100, cfg);
    expect(result.character.expToNext).toBe(cfg.expFormula(2)); // 100
  });

  it('non-protagonist: total stat gain equals pointsPerLevel', () => {
    const char = makeChar('n', 1, false);
    const before = char.stats;
    const result = applyLevelUp(char, 100, cfg);
    expect(result.character.level).toBe(2);
    const s = result.character.stats;
    const total = (s.hp - before.hp) + (s.atk - before.atk) + (s.def - before.def) + (s.spd - before.spd);
    expect(total).toBe(cfg.nonProtagonist.pointsPerLevel);
    expect(result.expPool).toBe(50);
  });

  it('non-protagonist: hp gain also increases maxHp', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // always picks hp (index 0 in statKeys)
    const char = makeChar('n', 1, false);
    const result = applyLevelUp(char, 100, cfg);
    expect(result.character.stats.hp).toBe(105);
    expect(result.character.stats.maxHp).toBe(105);
    vi.restoreAllMocks();
  });
});
