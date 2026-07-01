import { describe, it, expect } from 'vitest';
import { applyExp, STAT_POINTS_PER_LEVEL } from '../../src/battle/ExpSystem';
import type { Character } from '../../src/types';

// Spec: specs/pixel-squad-skill-tree.md, rule 2 / AC-1 / AC-2

type CharacterWithSkillPoints = Character & { skillPoints?: number };

function makeChar(
  isProtagonist: boolean,
  level: number,
  exp: number,
  skillPoints?: number,
): CharacterWithSkillPoints {
  return {
    id: 'c', templateId: 'c', name: 'c', isProtagonist, isPlayer: true,
    level, exp, expToNext: level * 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {}, equipment: {},
    skillPoints,
  };
}

describe('applyExp — skill points (rule 2 / AC-1 / AC-2)', () => {
  it('AC-1: protagonist levels up once and gains exactly 1 skill point, statPoints still increases by STAT_POINTS_PER_LEVEL exactly as before', () => {
    const before = makeChar(true, 1, 0, 0);
    const result = applyExp(before, 50);
    expect(result.level).toBe(2);
    expect(result.skillPoints).toBe(1);
    expect(result.statPoints).toBe(STAT_POINTS_PER_LEVEL);
    expect(result.stats.atk).toBe(before.stats.atk);
  });

  it('AC-1: defaults an unset skillPoints to 0 before adding the level-up point (pre-feature save)', () => {
    const before = makeChar(true, 1, 0, undefined);
    const result = applyExp(before, 50);
    expect(result.skillPoints).toBe(1);
  });

  it('AC-2: non-protagonist levels up once and gains exactly 1 skill point, auto stat growth unchanged from current behavior', () => {
    const before = makeChar(false, 1, 0, 0);
    const result = applyExp(before, 50);
    expect(result.level).toBe(2);
    expect(result.skillPoints).toBe(1);
    expect(result.stats.atk).toBeGreaterThan(before.stats.atk);
    expect(result.stats.hp).toBeGreaterThan(before.stats.hp);
  });

  it('grants one skill point per level gained when multiple levels are earned from a single exp grant', () => {
    const before = makeChar(false, 1, 0, 0);
    // level 1->2 needs 50 exp, level 2->3 needs 100 exp: 150 clears two level-ups
    const result = applyExp(before, 150);
    expect(result.level).toBe(3);
    expect(result.skillPoints).toBe(2);
  });

  it('does not grant a skill point when the exp gain does not trigger a level-up', () => {
    const before = makeChar(false, 1, 0, 0);
    const result = applyExp(before, 10);
    expect(result.level).toBe(1);
    expect(result.skillPoints).toBe(0);
  });
});
