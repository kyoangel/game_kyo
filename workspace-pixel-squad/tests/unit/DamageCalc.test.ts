import { describe, it, expect } from 'vitest';
import { calcDamage } from '../../src/battle/DamageCalc';
import type { Character, Skill } from '../../src/types';

function makeChar(atk: number, def: number): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk, def, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
  };
}

const attackSkill: Skill = { id: 's', name: 'S', type: 'attack', multiplier: 1.5, description: '' };

describe('calcDamage', () => {
  it('base formula: ATK − DEF×0.5, floored', () => {
    // 20 − 10×0.5 = 15
    expect(calcDamage(makeChar(20, 10), makeChar(0, 10))).toBe(15);
  });

  it('minimum damage is 1 even when DEF is very high', () => {
    expect(calcDamage(makeChar(5, 0), makeChar(0, 100))).toBe(1);
  });

  it('applies skill multiplier to ATK before subtracting DEF', () => {
    // (20×1.5) − 10×0.5 = 30 − 5 = 25
    expect(calcDamage(makeChar(20, 0), makeChar(0, 10), attackSkill)).toBe(25);
  });

  it('defending target takes half damage (rounded up)', () => {
    const defender = makeChar(0, 0);
    defender.defending = true;
    // base = 20, after defending = ceil(20/2) = 10
    expect(calcDamage(makeChar(20, 0), defender)).toBe(10);
  });

  it('minimum 1 still applies after defend halving', () => {
    const defender = makeChar(0, 100);
    defender.defending = true;
    expect(calcDamage(makeChar(5, 0), defender)).toBe(1);
  });
});
