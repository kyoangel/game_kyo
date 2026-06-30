/**
 * Status Effect Expansion — Burn lowers calcDamage output via effectiveAtk.
 */
import { describe, it, expect } from 'vitest';
import { calcDamage } from '../../src/battle/DamageCalc';
import type { Character, Skill } from '../../src/types';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 40, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype: '狙擊', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {},
    ...overrides,
  };
}

const attackSkill: Skill = {
  id: 'burst_shot', name: '爆發射擊', type: 'attack', target: 'enemy',
  multiplier: 1.5, description: '', element: 'fire',
};

describe('calcDamage — Burn', () => {
  it('a burned attacker deals less damage than an identical unburned attacker', () => {
    const defender = makeChar({ id: 'd', archetype: '坦克' });
    const normalAttacker = makeChar({ id: 'a1', archetype: '狙擊' });
    const burnedAttacker = makeChar({
      id: 'a2', archetype: '狙擊',
      activeStatusEffects: [{ type: 'burn', turnsRemaining: 2, sourceSkillId: 'acid_splash' }],
    });

    const normalResult = calcDamage(normalAttacker, defender, attackSkill);
    const burnedResult = calcDamage(burnedAttacker, defender, attackSkill);

    expect(burnedResult.damage).toBeLessThan(normalResult.damage);
  });
});
