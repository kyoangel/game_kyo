import { describe, it, expect } from 'vitest';
import { applyExp, STAT_POINTS_PER_LEVEL } from '../../src/battle/ExpSystem';
import type { Character } from '../../src/types';

function makeChar(isProtagonist: boolean, level: number, exp: number): Character {
  return {
    id: 'c', templateId: 'c', name: 'c', isProtagonist, isPlayer: true,
    level, exp, expToNext: level * 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false, activeBuffs: [],
  };
}

describe('applyExp', () => {
  it('adds exp without leveling when below threshold', () => {
    const result = applyExp(makeChar(false, 1, 0), 30);
    expect(result.exp).toBe(30);
    expect(result.level).toBe(1);
  });

  it('levels up when exp meets threshold', () => {
    const result = applyExp(makeChar(false, 1, 0), 50);
    expect(result.level).toBe(2);
    expect(result.exp).toBe(0);
  });

  it('carries over excess exp after level up', () => {
    const result = applyExp(makeChar(false, 1, 0), 70);
    expect(result.level).toBe(2);
    expect(result.exp).toBe(20);
  });

  it('non-protagonist gets auto stat boosts on level up', () => {
    const before = makeChar(false, 1, 0);
    const result = applyExp(before, 50);
    expect(result.stats.atk).toBeGreaterThan(before.stats.atk);
    expect(result.stats.hp).toBeGreaterThan(before.stats.hp);
  });

  it('protagonist gets stat points instead of auto boosts', () => {
    const before = makeChar(true, 1, 0);
    const result = applyExp(before, 50);
    expect(result.statPoints).toBe(STAT_POINTS_PER_LEVEL);
    expect(result.stats.atk).toBe(before.stats.atk);
  });
});
