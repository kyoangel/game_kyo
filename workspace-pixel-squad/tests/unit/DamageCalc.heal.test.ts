import { describe, it, expect } from 'vitest';
import { calcDamage, calcHeal } from '../../src/battle/DamageCalc';
import type { Character, Skill } from '../../src/types';

function makeChar(atk: number, def: number, overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk, def, spd: 10 },
    skills: [], statPoints: 0, archetype: '狙擊', alive: true, defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

const healSkill: Skill = {
  id: 'field_medic', name: '戰地醫療', type: 'heal', target: 'ally', multiplier: 0.8, description: '',
};

describe('calcHeal', () => {
  it('heal amount = floor(caster.effectiveAtk * skill.multiplier)', () => {
    // floor(20 * 0.8) = 16
    expect(calcHeal(makeChar(20, 0), healSkill)).toBe(16);
  });

  it('minimum heal is 1', () => {
    const lowAtkSkill: Skill = { ...healSkill, multiplier: 0.01 };
    expect(calcHeal(makeChar(1, 0), lowAtkSkill)).toBeGreaterThanOrEqual(1);
  });

  it('uses effectiveAtk (buffed) rather than raw stats.atk', () => {
    const caster = makeChar(20, 0, {
      activeBuffs: [{ stat: 'atk', amountPct: 0.5, turnsRemaining: 3, sourceSkillId: 'combat_stim' }],
    });
    // effectiveAtk = 30, floor(30 * 0.8) = 24
    expect(calcHeal(caster, healSkill)).toBe(24);
  });
});

describe('calcDamage with buffed stats', () => {
  it('uses effectiveAtk of the attacker when buffed', () => {
    const attacker = makeChar(20, 0, {
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 'combat_stim' }],
    });
    const defender = makeChar(0, 10);
    // effectiveAtk = 26, 26 - 10*0.5 = 21
    expect(calcDamage(attacker, defender).damage).toBe(21);
  });

  it('uses effectiveDef of the defender when buffed', () => {
    const attacker = makeChar(20, 0);
    const defender = makeChar(0, 10, {
      activeBuffs: [{ stat: 'def', amountPct: 0.4, turnsRemaining: 3, sourceSkillId: 'iron_will' }],
    });
    // effectiveDef = 14, 20 - 14*0.5 = 13
    expect(calcDamage(attacker, defender).damage).toBe(13);
  });

  it('existing attack-skill behavior is unchanged when no buffs are active', () => {
    const attackSkill: Skill = { id: 's', name: 'S', type: 'attack', target: 'enemy', multiplier: 1.5, description: '' };
    expect(calcDamage(makeChar(20, 0), makeChar(0, 10), attackSkill).damage).toBe(25);
  });
});
