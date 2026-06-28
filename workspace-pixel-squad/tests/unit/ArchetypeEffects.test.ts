import { describe, it, expect, vi, afterEach } from 'vitest';
import { calcDamage, calcHeal } from '../../src/battle/DamageCalc';
import { effectiveAtk, effectiveDef, effectiveSpd, applyBuff } from '../../src/battle/Buffs';
import { computeTurnOrder } from '../../src/battle/TurnEngine';
import {
  rollCrit,
  ARCHETYPE_DAMAGE_DEALT_MULT,
  ARCHETYPE_DAMAGE_TAKEN_MULT,
  ARCHETYPE_SUPPORT_POTENCY_MULT,
  SNIPER_CRIT_CHANCE,
  SNIPER_CRIT_MULTIPLIER,
  ALL_ROUNDER_STAT_MULT,
} from '../../src/battle/ArchetypeEffects';
import type { ArchetypeLabel, Character, Skill } from '../../src/types';

function makeChar(archetype: ArchetypeLabel, overrides: Partial<Character> = {}): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer: true,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk: 20, def: 10, spd: 15 },
    skills: [], statPoints: 0, archetype, alive: true, defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

const attackSkill: Skill = { id: 's', name: 'S', type: 'attack', target: 'enemy', multiplier: 1.5, description: '' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ArchetypeEffects constants', () => {
  it('坦克 has -15% damage taken and no other bonuses', () => {
    expect(ARCHETYPE_DAMAGE_TAKEN_MULT['坦克']).toBe(0.85);
    expect(ARCHETYPE_DAMAGE_DEALT_MULT['坦克']).toBe(1.0);
  });

  it('輸出 has +10% damage dealt and no other bonuses', () => {
    expect(ARCHETYPE_DAMAGE_DEALT_MULT['輸出']).toBe(1.1);
    expect(ARCHETYPE_DAMAGE_TAKEN_MULT['輸出']).toBe(1.0);
  });

  it('輔助 has +20% heal/buff potency', () => {
    expect(ARCHETYPE_SUPPORT_POTENCY_MULT['輔助']).toBe(1.2);
  });

  it('全能 stat multiplier is 1.05', () => {
    expect(ALL_ROUNDER_STAT_MULT).toBe(1.05);
  });

  it('sniper crit chance/multiplier match spec', () => {
    expect(SNIPER_CRIT_CHANCE).toBe(0.2);
    expect(SNIPER_CRIT_MULTIPLIER).toBe(1.5);
  });
});

describe('rollCrit', () => {
  it('returns false for non-狙擊 characters without calling Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    const c = makeChar('坦克');
    expect(rollCrit(c)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('狙擊 character can roll true when Math.random is below crit chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const c = makeChar('狙擊');
    expect(rollCrit(c)).toBe(true);
  });

  it('狙擊 character rolls false when Math.random is at/above crit chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const c = makeChar('狙擊');
    expect(rollCrit(c)).toBe(false);
  });
});

describe('calcDamage — 坦克 damage reduction', () => {
  it('reduces damage taken by 15% before defend halving', () => {
    // attacker全能 atk20 def10 -> raw = 20 - 10*0.5 = 15 vs non-坦克 baseline 15... use explicit raw=100 scenario below instead
    const attacker = makeChar('全能');
    const defender = makeChar('坦克');
    // construct raw=100 case: atk * mult - def*0.5 = 100. Use atk=110, def=20, mult=1 => 110-10=100
    attacker.stats.atk = 110;
    defender.stats.def = 20;
    // attacker is 全能, so effectiveAtk = 110 * 1.05 = 115.5; raw = 115.5 - 10 = 105.5; *0.85 = 89.675 -> floor 89
    expect(calcDamage(attacker, defender).damage).toBe(89);
  });

  it('applies archetype reduction before defend halving (defending 坦克)', () => {
    const attacker = makeChar('全能', { stats: { hp: 100, maxHp: 100, atk: 40, def: 0, spd: 15 } });
    const defender = makeChar('坦克', { defending: true, stats: { hp: 100, maxHp: 100, atk: 20, def: 0, spd: 15 } });
    // attacker is 全能, so effectiveAtk = 40 * 1.05 = 42; raw = 42 - 0 = 42; *0.85 = 35.7 -> floor 35; ceil(35/2) = 18
    expect(calcDamage(attacker, defender).damage).toBe(18);
  });
});

describe('calcDamage — 輸出 bonus damage', () => {
  it('increases damage dealt by 10% against a non-坦克 target', () => {
    const attacker = makeChar('輸出', { stats: { hp: 100, maxHp: 100, atk: 110, def: 0, spd: 15 } });
    const defender = makeChar('全能', { stats: { hp: 100, maxHp: 100, atk: 20, def: 20, spd: 15 } });
    // defender is 全能, so effectiveDef = 20 * 1.05 = 21; raw = 110 - 10.5 = 99.5; *1.1 = 109.45 -> floor 109
    expect(calcDamage(attacker, defender).damage).toBe(109);
  });

  it('stacks multiplicatively with 坦克 reduction', () => {
    const attacker = makeChar('輸出', { stats: { hp: 100, maxHp: 100, atk: 110, def: 0, spd: 15 } });
    const defender = makeChar('坦克', { stats: { hp: 100, maxHp: 100, atk: 20, def: 20, spd: 15 } });
    // raw = 100; *1.1*0.85 = 93.5 -> floor 93
    expect(calcDamage(attacker, defender).damage).toBe(93);
  });
});

describe('calcDamage — 狙擊 crit', () => {
  it('multiplies damage by 1.5 when isCrit is true', () => {
    const attacker = makeChar('狙擊', { stats: { hp: 100, maxHp: 100, atk: 50, def: 0, spd: 15 } });
    const defender = makeChar('全能', { stats: { hp: 100, maxHp: 100, atk: 20, def: 0, spd: 15 } });
    // raw = 50; crit -> 75
    expect(calcDamage(attacker, defender, undefined, true).damage).toBe(75);
  });

  it('does not crit when isCrit is false even for a 狙擊 attacker', () => {
    const attacker = makeChar('狙擊', { stats: { hp: 100, maxHp: 100, atk: 50, def: 0, spd: 15 } });
    const defender = makeChar('全能', { stats: { hp: 100, maxHp: 100, atk: 20, def: 0, spd: 15 } });
    expect(calcDamage(attacker, defender, undefined, false).damage).toBe(50);
  });
});

describe('calcHeal — 輔助 potency', () => {
  const fieldMedic: Skill = {
    id: 'field_medic', name: '戰地醫療', type: 'heal', target: 'ally', multiplier: 0.8, description: '',
  };

  it('輔助 caster heals for +20% more than a non-輔助 caster', () => {
    const supportCaster = makeChar('輔助', { stats: { hp: 100, maxHp: 100, atk: 100, def: 10, spd: 15 } });
    const plainCaster = makeChar('全能', { stats: { hp: 100, maxHp: 100, atk: 100, def: 10, spd: 15 } });
    expect(calcHeal(supportCaster, fieldMedic)).toBe(96); // 100*0.8*1.2
    // plainCaster is 全能, so effectiveAtk = 100*1.05 = 105; 105*0.8 = 84
    expect(calcHeal(plainCaster, fieldMedic)).toBe(84);
  });
});

describe('applyBuff — 輔助 caster potency', () => {
  const ironWill: Skill = {
    id: 'iron_will', name: '鋼鐵意志', type: 'buff', target: 'ally',
    multiplier: 0, buffStat: 'def', buffAmountPct: 0.4, buffDuration: 3, description: '',
  };

  it('輔助 caster boosts applied buff amountPct by 1.2x', () => {
    const target = makeChar('全能');
    const supportCaster = makeChar('輔助');
    applyBuff(target, ironWill, supportCaster);
    expect(target.activeBuffs[0].amountPct).toBeCloseTo(0.48);
  });

  it('non-輔助 caster applies the printed amountPct unchanged', () => {
    const target = makeChar('全能');
    const plainCaster = makeChar('坦克');
    applyBuff(target, ironWill, plainCaster);
    expect(target.activeBuffs[0].amountPct).toBe(0.4);
  });

  it('omitting caster entirely applies the printed amountPct unchanged', () => {
    const target = makeChar('全能');
    applyBuff(target, ironWill);
    expect(target.activeBuffs[0].amountPct).toBe(0.4);
  });
});

describe('effectiveAtk / effectiveDef / effectiveSpd — 全能 stat boost', () => {
  it('applies +5% after any active buff multiplier', () => {
    const c = makeChar('全能', {
      stats: { hp: 100, maxHp: 100, atk: 100, def: 10, spd: 15 },
      activeBuffs: [{ stat: 'atk', amountPct: 0.3, turnsRemaining: 3, sourceSkillId: 'combat_stim' }],
    });
    // 100 * 1.3 * 1.05 = 136.5
    expect(effectiveAtk(c)).toBeCloseTo(136.5);
  });

  it('applies +5% to def with no buffs present', () => {
    const c = makeChar('全能', { stats: { hp: 100, maxHp: 100, atk: 100, def: 10, spd: 15 } });
    expect(effectiveDef(c)).toBeCloseTo(10.5);
  });

  it('applies +5% to spd, affecting computeTurnOrder', () => {
    const allRounder = makeChar('全能', { id: 'a', stats: { hp: 100, maxHp: 100, atk: 100, def: 10, spd: 20 } });
    const plain = makeChar('坦克', { id: 'b', stats: { hp: 100, maxHp: 100, atk: 100, def: 10, spd: 21 } });
    expect(effectiveSpd(allRounder)).toBeCloseTo(21); // 20 * 1.05
    expect(effectiveSpd(plain)).toBe(21);
    const order = computeTurnOrder([plain, allRounder]);
    // effectiveSpd tie at 21 -> falls back to isPlayer tie-break; both isPlayer true here so order preserved as input order
    expect(order.map(c => c.id)).toEqual(['b', 'a']);
  });

  it('non-全能 characters get no stat bonus', () => {
    const c = makeChar('坦克', { stats: { hp: 100, maxHp: 100, atk: 100, def: 10, spd: 15 } });
    expect(effectiveAtk(c)).toBe(100);
    expect(effectiveDef(c)).toBe(10);
    expect(effectiveSpd(c)).toBe(15);
  });
});
