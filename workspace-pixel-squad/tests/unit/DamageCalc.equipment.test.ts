import { describe, it, expect } from 'vitest';
import { calcDamage } from '../../src/battle/DamageCalc';
import type { Character, EquipmentItem } from '../../src/types';

const vest: EquipmentItem = {
  id: 'armor_scrap_vest', slot: 'armor', name: '廢料背心', price: 30, description: 'DEF+6', statBonus: { def: 6 },
};

function makeChar(atk: number, def: number, overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk, def, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false, activeBuffs: [],
    equipment: {},
    ...overrides,
  } as Character;
}

describe('calcDamage reads equipped armor bonus through effectiveDef (no calcDamage changes needed)', () => {
  it('an equipped armor def bonus reduces damage exactly as an equivalent flat def increase would', () => {
    const attacker = makeChar(20, 0);
    const defenderGear = makeChar(0, 10, { equipment: { armor: vest } }); // effective def 16
    const defenderFlat = makeChar(0, 16); // no gear, equivalent flat stat
    expect(calcDamage(attacker, defenderGear).damage).toBe(calcDamage(attacker, defenderFlat).damage);
  });

  it('equipped armor lowers damage taken compared to the same character with no armor', () => {
    const attacker = makeChar(20, 0);
    const geared = makeChar(0, 10, { equipment: { armor: vest } });
    const ungeared = makeChar(0, 10, { equipment: {} });
    expect(calcDamage(attacker, geared).damage).toBeLessThan(calcDamage(attacker, ungeared).damage);
  });
});
