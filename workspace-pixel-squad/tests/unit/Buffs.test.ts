import { describe, it, expect } from 'vitest';
import { effectiveAtk, effectiveDef, effectiveSpd, applyBuff, tickBuffs } from '../../src/battle/Buffs';
import type { Character, Skill } from '../../src/types';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '狙擊', alive: true, defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

const atkBuffSkill: Skill = {
  id: 'combat_stim', name: '戰鬥興奮劑', type: 'buff', target: 'self',
  multiplier: 0, buffStat: 'atk', buffAmountPct: 0.3, buffDuration: 3, description: '',
};

const otherAtkBuffSkill: Skill = {
  id: 'other_atk_buff', name: '其他ATK增益', type: 'buff', target: 'self',
  multiplier: 0, buffStat: 'atk', buffAmountPct: 0.5, buffDuration: 2, description: '',
};

describe('effectiveAtk / effectiveDef / effectiveSpd', () => {
  it('returns base stat when no active buffs', () => {
    const c = makeChar();
    expect(effectiveAtk(c)).toBe(20);
    expect(effectiveDef(c)).toBe(10);
    expect(effectiveSpd(c)).toBe(15);
  });

  it('applies a single active buff as base * (1 + amountPct)', () => {
    const c = makeChar({
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 'combat_stim' }],
    });
    expect(effectiveAtk(c)).toBe(26); // 20 * 1.3
  });

  it('only affects the buffed stat, not others', () => {
    const c = makeChar({
      activeBuffs: [{ stat: 'def', amountPct: 0.4, turnsRemaining: 3, sourceSkillId: 'iron_will' }],
    });
    expect(effectiveAtk(c)).toBe(20);
    expect(effectiveDef(c)).toBe(14); // 10 * 1.4
    expect(effectiveSpd(c)).toBe(15);
  });
});

describe('applyBuff', () => {
  it('adds a new ActiveBuff entry for an unbuffed stat', () => {
    const c = makeChar();
    applyBuff(c, atkBuffSkill);
    expect(c.activeBuffs).toHaveLength(1);
    expect(c.activeBuffs[0]).toMatchObject({ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 'combat_stim' });
  });

  it('replaces an existing buff on the same stat (no stacking)', () => {
    const c = makeChar();
    applyBuff(c, atkBuffSkill);
    applyBuff(c, otherAtkBuffSkill);
    expect(c.activeBuffs).toHaveLength(1);
    expect(c.activeBuffs[0]).toMatchObject({ stat: 'atk', amountPct: 0.5, turnsRemaining: 2, sourceSkillId: 'other_atk_buff' });
  });

  it('refreshes turnsRemaining when the exact same buff is reapplied', () => {
    const c = makeChar({
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 1, sourceSkillId: 'combat_stim' }],
    });
    applyBuff(c, atkBuffSkill);
    expect(c.activeBuffs).toHaveLength(1);
    expect(c.activeBuffs[0].turnsRemaining).toBe(3);
  });

  it('buffs on different stats coexist independently', () => {
    const c = makeChar();
    const defBuffSkill: Skill = {
      id: 'iron_will', name: '鋼鐵意志', type: 'buff', target: 'ally',
      multiplier: 0, buffStat: 'def', buffAmountPct: 0.4, buffDuration: 3, description: '',
    };
    applyBuff(c, atkBuffSkill);
    applyBuff(c, defBuffSkill);
    expect(c.activeBuffs).toHaveLength(2);
  });
});

describe('tickBuffs', () => {
  it('decrements turnsRemaining for every buff on every character in the party', () => {
    const a = makeChar({ activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 's1' }] });
    const b = makeChar({ activeBuffs: [{ stat: 'def', amountPct: 0.4, turnsRemaining: 2, sourceSkillId: 's2' }] });
    tickBuffs([a, b]);
    expect(a.activeBuffs[0].turnsRemaining).toBe(2);
    expect(b.activeBuffs[0].turnsRemaining).toBe(1);
  });

  it('removes buffs once turnsRemaining reaches 0 after 3 ticks (duration 3)', () => {
    const c = makeChar({ activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 'combat_stim' }] });
    tickBuffs([c]);
    tickBuffs([c]);
    tickBuffs([c]);
    expect(c.activeBuffs).toHaveLength(0);
    expect(effectiveAtk(c)).toBe(c.stats.atk);
  });

  it('does not affect characters with no active buffs', () => {
    const c = makeChar();
    expect(() => tickBuffs([c])).not.toThrow();
    expect(c.activeBuffs).toHaveLength(0);
  });
});
