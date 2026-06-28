import { describe, it, expect } from 'vitest';
import { calcDamage } from '../../src/battle/DamageCalc';
import type { Character, Skill } from '../../src/types';

function makeChar(atk: number, def: number, isPlayer = true): Character {
  return {
    id: 'x', templateId: 'x', name: 'x', isProtagonist: false, isPlayer,
    level: 1, exp: 0, expToNext: 50,
    stats: { hp: 100, maxHp: 100, atk, def, spd: 10 },
    skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
    activeBuffs: [], skillCooldowns: {},
  } as Character;
}

// AC-1: Basic weakness hit — damage and isWeaknessHit flag

describe('AC-1: weakness hit returns DamageResult with isWeaknessHit = true', () => {
  it('returns an object (DamageResult), not a plain number', () => {
    const attacker = makeChar(20, 0);
    const defender = Object.assign(makeChar(0, 0, false), { weakness: 'ice' });
    const skill = {
      id: 'cryo_round', name: '冰凍彈', type: 'attack' as const,
      target: 'enemy' as const, multiplier: 1.2, description: '', element: 'ice',
    };

    const result = calcDamage(attacker, defender as any, skill as any) as any;
    // Currently returns number — should return DamageResult object
    expect(typeof result).toBe('object');
  });

  it('isWeaknessHit is true when skill element matches enemy weakness', () => {
    const attacker = makeChar(20, 0);
    const defender = Object.assign(makeChar(0, 0, false), { weakness: 'ice' });
    const iceSkill = {
      id: 'cryo_round', name: '冰凍彈', type: 'attack' as const,
      target: 'enemy' as const, multiplier: 1.0, description: '', element: 'ice',
    };

    const result = calcDamage(attacker, defender as any, iceSkill as any) as any;
    expect(result.isWeaknessHit).toBe(true);
  });

  it('weakness damage equals floor(base_damage × 1.5)', () => {
    // 全能 atk=40, def=0: effectiveAtk = 40×1.05 = 42; base = floor(42) = 42
    // weakness: floor(42 × 1.5) = 63
    const attacker = makeChar(40, 0);
    const defenderWeak = Object.assign(makeChar(0, 0, false), { weakness: 'ice' });
    const defenderPlain = makeChar(0, 0, false);
    const iceSkill = {
      id: 'cryo_round', type: 'attack' as const, target: 'enemy' as const,
      name: '冰凍彈', multiplier: 1.0, description: '', element: 'ice',
    };
    const fireSkill = { ...iceSkill, id: 'burst_shot', element: 'fire' };

    const weakResult = calcDamage(attacker, defenderWeak as any, iceSkill as any) as any;
    const normalResult = calcDamage(attacker, defenderPlain as any, fireSkill as any) as any;

    // result.damage is undefined until implemented
    expect(weakResult.damage).toBe(Math.floor(normalResult.damage * 1.5));
  });

  it('isCrit field is present on DamageResult', () => {
    const attacker = makeChar(20, 0);
    const defender = makeChar(0, 0, false);
    const skill: Skill = {
      id: 'burst_shot', name: '爆發射擊', type: 'attack',
      target: 'enemy', multiplier: 1.5, description: '',
    };

    const result = calcDamage(attacker, defender, skill) as any;
    expect(typeof result.isCrit).toBe('boolean');
  });
});

// AC-2: Non-matching element — no weakness effect

describe('AC-2: non-matching element — isWeaknessHit is false, no damage bonus', () => {
  it('isWeaknessHit is false when skill element does not match enemy weakness', () => {
    const attacker = makeChar(20, 0);
    const defender = Object.assign(makeChar(0, 0, false), { weakness: 'ice' });
    const fireSkill = {
      id: 'burst_shot', name: '爆發射擊', type: 'attack' as const,
      target: 'enemy' as const, multiplier: 1.5, description: '', element: 'fire',
    };

    const result = calcDamage(attacker, defender as any, fireSkill as any) as any;
    expect(result.isWeaknessHit).toBe(false);
  });

  it('isWeaknessHit is false when enemy has no weakness field', () => {
    const attacker = makeChar(20, 0);
    const defender = makeChar(0, 0, false); // no weakness
    const iceSkill = {
      id: 'cryo_round', name: '冰凍彈', type: 'attack' as const,
      target: 'enemy' as const, multiplier: 1.2, description: '', element: 'ice',
    };

    const result = calcDamage(attacker, defender as any, iceSkill as any) as any;
    expect(result.isWeaknessHit).toBe(false);
  });

  it('isWeaknessHit is false for a heal skill (no element)', () => {
    const attacker = makeChar(20, 0);
    const defender = Object.assign(makeChar(0, 0, false), { weakness: 'ice' });
    const healSkill: Skill = {
      id: 'field_medic', name: '戰地醫療', type: 'heal',
      target: 'ally', multiplier: 0.8, description: '',
    };

    const result = calcDamage(attacker, defender as any, healSkill) as any;
    expect(result.isWeaknessHit).toBe(false);
  });

  it('non-matching element damage is the same as no-element attack (no bonus)', () => {
    const attacker = makeChar(40, 0);
    const defender = Object.assign(makeChar(0, 0, false), { weakness: 'ice' });
    // fire vs ice-weakness: no bonus
    const fireSkill = {
      id: 'burst_shot', type: 'attack' as const, target: 'enemy' as const,
      name: '爆發射擊', multiplier: 1.0, description: '', element: 'fire',
    };
    // ice vs ice-weakness: 1.5×
    const iceSkill = { ...fireSkill, id: 'cryo_round', element: 'ice' };

    const fireResult = calcDamage(attacker, defender as any, fireSkill as any) as any;
    const iceResult = calcDamage(attacker, defender as any, iceSkill as any) as any;

    // Ice (weakness match) should deal MORE than fire (no match)
    expect(iceResult.damage).toBeGreaterThan(fireResult.damage);
  });
});

// AC-7: Weakness multiplier stacks multiplicatively with Sniper crit

describe('AC-7: Sniper crit + weakness = 2.25× normal damage', () => {
  it('crit × weakness multiplies to 2.25× base', () => {
    const sniper: Character = { ...makeChar(40, 0), archetype: '狙擊' };
    const defenderWeak = Object.assign(makeChar(0, 0, false), { weakness: 'thunder' });
    const defenderPlain = makeChar(0, 0, false);
    const thunderSkill = {
      id: 'swift_strike', name: '迅捷突刺', type: 'attack' as const,
      target: 'enemy' as const, multiplier: 1.0, description: '', element: 'thunder',
    };
    const plainSkill = { ...thunderSkill, element: undefined };

    // No crit, no weakness → baseline
    const normalResult = calcDamage(sniper, defenderPlain as any, plainSkill as any) as any;
    // Crit + weakness
    const critWeakResult = calcDamage(sniper, defenderWeak as any, thunderSkill as any, true) as any;

    const normalDmg = normalResult.damage;
    const critWeakDmg = critWeakResult.damage;
    // 1.5 (weakness) × 1.5 (crit) = 2.25×
    expect(critWeakDmg).toBe(Math.floor(normalDmg * 1.5 * 1.5));
  });

  it('isCrit is true when called with isCrit=true', () => {
    const sniper: Character = { ...makeChar(30, 0), archetype: '狙擊' };
    const defender = makeChar(0, 0, false);
    const skill: Skill = {
      id: 'swift_strike', name: '迅捷突刺', type: 'attack',
      target: 'enemy', multiplier: 1.0, description: '',
    };

    const result = calcDamage(sniper, defender, skill, true) as any;
    expect(result.isCrit).toBe(true);
  });
});
