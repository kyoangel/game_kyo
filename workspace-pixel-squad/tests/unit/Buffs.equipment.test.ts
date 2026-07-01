import { describe, it, expect } from 'vitest';
import { effectiveAtk, effectiveDef, effectiveSpd } from '../../src/battle/Buffs';
import type { Character, EquipmentItem } from '../../src/types';

const pipe: EquipmentItem = {
  id: 'weapon_pipe', slot: 'weapon', name: '鋼管', price: 30, description: 'ATK+6', statBonus: { atk: 6 },
};
const combatKnife: EquipmentItem = {
  id: 'weapon_combat_knife', slot: 'weapon', name: '戰鬥匕首', price: 45, description: 'ATK+8, SPD+2',
  statBonus: { atk: 8, spd: 2 },
};
const vest: EquipmentItem = {
  id: 'armor_scrap_vest', slot: 'armor', name: '廢料背心', price: 30, description: 'DEF+6', statBonus: { def: 6 },
};
const lightMesh: EquipmentItem = {
  id: 'armor_light_mesh', slot: 'armor', name: '輕量網甲', price: 45, description: 'DEF+5, SPD+3',
  statBonus: { def: 5, spd: 3 },
};

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1', templateId: 't', name: 'T', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 10 },
    skills: [], statPoints: 0, archetype: '坦克', alive: true, defending: false,
    activeBuffs: [], activeStatusEffects: [], skillCooldowns: {},
    equipment: {},
    ...overrides,
  } as Character;
}

describe('effectiveAtk with equipped weapon', () => {
  it('adds the weapon flat atk bonus to base atk', () => {
    const c = makeChar({ equipment: { weapon: pipe } });
    expect(effectiveAtk(c)).toBe(26);
  });

  it('gear bonus is added to base before percentage buffs multiply (buff amplifies gear too)', () => {
    const c = makeChar({
      equipment: { weapon: pipe },
      activeBuffs: [{ stat: 'atk', amountPct: 0.2, turnsRemaining: 2, sourceSkillId: 's' }],
    });
    expect(effectiveAtk(c)).toBe(31); // floor(26 * 1.2) = 31
  });

  it('contributes 0 when equipment is present but empty', () => {
    const c = makeChar({ equipment: {} });
    expect(effectiveAtk(c)).toBe(20);
  });
});

describe('effectiveDef with equipped armor', () => {
  it('adds the armor flat def bonus to base def', () => {
    const c = makeChar({ equipment: { armor: vest } });
    expect(effectiveDef(c)).toBe(16);
  });

  it('contributes 0 when equipment is present but empty', () => {
    const c = makeChar({ equipment: {} });
    expect(effectiveDef(c)).toBe(10);
  });
});

describe('effectiveSpd with equipped gear', () => {
  it('sums spd bonuses from both weapon and armor', () => {
    const c = makeChar({ equipment: { weapon: combatKnife, armor: lightMesh } });
    expect(effectiveSpd(c)).toBe(15); // 10 base + 2 (weapon) + 3 (armor)
  });

  it('contributes 0 when equipment is present but empty', () => {
    const c = makeChar({ equipment: {} });
    expect(effectiveSpd(c)).toBe(10);
  });
});

describe('regression: behavior is unchanged for characters with no equipment field at all', () => {
  it('effectiveAtk/effectiveDef/effectiveSpd match pre-feature output when equipment is undefined', () => {
    const c = makeChar();
    delete (c as Partial<Character>).equipment;
    expect(effectiveAtk(c)).toBe(20);
    expect(effectiveDef(c)).toBe(10);
    expect(effectiveSpd(c)).toBe(10);
  });
});
