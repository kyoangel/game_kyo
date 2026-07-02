import { describe, it, expect } from 'vitest';
import {
  bondKey,
  getBond,
  supportChance,
  applyBondGains,
  pickSupporter,
  calcSupportDamage,
  resetSupportRoundFlags,
  BOND_GAIN_PER_BATTLE,
} from '../../src/battle/BondSystem';
import { calcDamage } from '../../src/battle/DamageCalc';
import type { Character } from '../../src/types';

// Spec: pixel-squad-bond-system
// BondSystem.ts does not exist yet — every import above fails to resolve,
// which is the expected "not implemented" failure mode for this suite.
// AC-1 through AC-10.

function makeChar(overrides: Record<string, unknown> = {}): Character {
  return Object.assign(
    {
      id: 'c1', templateId: 'c1', name: 'Char', isProtagonist: false, isPlayer: true,
      level: 1, exp: 0, expToNext: 50,
      stats: { hp: 100, maxHp: 100, atk: 20, def: 5, spd: 10 },
      skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
      activeBuffs: [], activeStatusEffects: [], skillCooldowns: {}, equipment: {},
    },
    overrides,
  ) as Character;
}

describe('AC-1: bondKey is order-independent', () => {
  it('bondKey("rex","nyx") === bondKey("nyx","rex")', () => {
    expect(bondKey('rex', 'nyx')).toBe(bondKey('nyx', 'rex'));
  });
});

describe('AC-2: getBond handles missing bondLevels without throwing', () => {
  it('returns 0 for undefined bondLevels', () => {
    expect(() => getBond(undefined, 'a', 'b')).not.toThrow();
    expect(getBond(undefined, 'a', 'b')).toBe(0);
  });

  it('returns 0 for a missing key in a populated map', () => {
    expect(getBond({ x_y: 10 }, 'a', 'b')).toBe(0);
  });

  it('returns the stored value for an existing pair, regardless of argument order', () => {
    const bondLevels = { [bondKey('rex', 'nyx')]: 30 };
    expect(getBond(bondLevels, 'rex', 'nyx')).toBe(30);
    expect(getBond(bondLevels, 'nyx', 'rex')).toBe(30);
  });
});

describe('AC-3: supportChance tier boundaries', () => {
  it('0 -> 0', () => expect(supportChance(0)).toBe(0));
  it('19 -> 0', () => expect(supportChance(19)).toBe(0));
  it('20 -> 0.15', () => expect(supportChance(20)).toBe(0.15));
  it('49 -> 0.15', () => expect(supportChance(49)).toBe(0.15));
  it('50 -> 0.3', () => expect(supportChance(50)).toBe(0.3));
  it('79 -> 0.3', () => expect(supportChance(79)).toBe(0.3));
  it('80 -> 0.5', () => expect(supportChance(80)).toBe(0.5));
  it('1000 -> 0.5', () => expect(supportChance(1000)).toBe(0.5));
});

describe('AC-4: applyBondGains adds BOND_GAIN_PER_BATTLE to every unique alive pair', () => {
  it('produces bond 4 for all three pairs among three alive characters', () => {
    const a = makeChar({ id: 'a', templateId: 'rex', alive: true });
    const b = makeChar({ id: 'b', templateId: 'nyx', alive: true });
    const c = makeChar({ id: 'c', templateId: 'zed', alive: true });

    const result = applyBondGains({}, [a, b, c]);

    expect(result[bondKey('rex', 'nyx')]).toBe(BOND_GAIN_PER_BATTLE);
    expect(result[bondKey('rex', 'zed')]).toBe(BOND_GAIN_PER_BATTLE);
    expect(result[bondKey('nyx', 'zed')]).toBe(BOND_GAIN_PER_BATTLE);
  });

  it('accumulates on top of an existing bond value', () => {
    const a = makeChar({ id: 'a', templateId: 'rex', alive: true });
    const b = makeChar({ id: 'b', templateId: 'nyx', alive: true });

    const result = applyBondGains({ [bondKey('rex', 'nyx')]: 10 }, [a, b]);

    expect(result[bondKey('rex', 'nyx')]).toBe(14);
  });
});

describe('AC-5: KO\'d characters earn no bond that battle', () => {
  it('produces no entry for a pair where one member is dead', () => {
    const a = makeChar({ id: 'a', templateId: 'rex', alive: true });
    const b = makeChar({ id: 'b', templateId: 'nyx', alive: false });

    const result = applyBondGains({}, [a, b]);

    expect(result[bondKey('rex', 'nyx')]).toBeUndefined();
  });
});

describe('AC-6: applyBondGains does not mutate its input', () => {
  it('returns a new object and leaves the original reference untouched', () => {
    const original: Record<string, number> = { [bondKey('rex', 'nyx')]: 5 };
    const a = makeChar({ id: 'a', templateId: 'rex', alive: true });
    const b = makeChar({ id: 'b', templateId: 'nyx', alive: true });

    const result = applyBondGains(original, [a, b]);

    expect(original[bondKey('rex', 'nyx')]).toBe(5);
    expect(result).not.toBe(original);
    expect(result[bondKey('rex', 'nyx')]).toBe(9);
  });
});

describe('AC-7: pickSupporter selection and tie-break rules', () => {
  it('excludes the attacker itself, dead members, and supportUsedThisRound members, picking the highest-bond remainder', () => {
    const attacker = makeChar({ id: 'atk', templateId: 'rex' });
    const dead = makeChar({ id: 'dead', templateId: 'gone', alive: false });
    const used = makeChar({ id: 'used', templateId: 'busy', supportUsedThisRound: true });
    const lowBond = makeChar({ id: 'low', templateId: 'nyx' });
    const highBond = makeChar({ id: 'high', templateId: 'zed' });
    const squad = [attacker, dead, used, lowBond, highBond];

    const bondLevels = {
      [bondKey('rex', 'gone')]: 100,
      [bondKey('rex', 'busy')]: 90,
      [bondKey('rex', 'nyx')]: 10,
      [bondKey('rex', 'zed')]: 50,
    };

    const supporter = pickSupporter(attacker, squad, bondLevels);

    expect(supporter?.id).toBe('high');
  });

  it('breaks ties by squad array order (first match wins)', () => {
    const attacker = makeChar({ id: 'atk', templateId: 'rex' });
    const first = makeChar({ id: 'first', templateId: 'nyx' });
    const second = makeChar({ id: 'second', templateId: 'zed' });
    const squad = [attacker, first, second];

    const bondLevels = {
      [bondKey('rex', 'nyx')]: 40,
      [bondKey('rex', 'zed')]: 40,
    };

    const supporter = pickSupporter(attacker, squad, bondLevels);

    expect(supporter?.id).toBe('first');
  });
});

describe('AC-8: pickSupporter returns undefined when no eligible candidate exists', () => {
  it('returns undefined for a solo squad', () => {
    const attacker = makeChar({ id: 'atk', templateId: 'rex' });
    expect(pickSupporter(attacker, [attacker], {})).toBeUndefined();
  });

  it('returns undefined when every other member already used their support this round', () => {
    const attacker = makeChar({ id: 'atk', templateId: 'rex' });
    const usedA = makeChar({ id: 'a', templateId: 'nyx', supportUsedThisRound: true });
    const usedB = makeChar({ id: 'b', templateId: 'zed', supportUsedThisRound: true });

    expect(pickSupporter(attacker, [attacker, usedA, usedB], {})).toBeUndefined();
  });
});

describe('AC-9: calcSupportDamage matches floor(calcDamage(...).damage * 0.6), minimum 1', () => {
  it('matches the derived formula for a normal-strength supporter', () => {
    const supporter = makeChar({ id: 's', templateId: 'nyx', stats: { hp: 100, maxHp: 100, atk: 50, def: 5, spd: 10 } });
    const defender = makeChar({ id: 'd', templateId: 'foe', isPlayer: false, stats: { hp: 100, maxHp: 100, atk: 10, def: 10, spd: 5 } });

    const expected = Math.max(1, Math.floor(calcDamage(supporter, defender).damage * 0.6));
    expect(calcSupportDamage(supporter, defender)).toBe(expected);
  });

  it('never goes below 1 even for a very weak supporter', () => {
    const supporter = makeChar({ id: 's', templateId: 'nyx', stats: { hp: 100, maxHp: 100, atk: 1, def: 5, spd: 10 } });
    const defender = makeChar({ id: 'd', templateId: 'foe', isPlayer: false, stats: { hp: 100, maxHp: 100, atk: 10, def: 999, spd: 5 } });

    expect(calcSupportDamage(supporter, defender)).toBeGreaterThanOrEqual(1);
  });
});

describe('AC-10: resetSupportRoundFlags clears supportUsedThisRound regardless of prior value', () => {
  it('sets false on all given characters', () => {
    const a = makeChar({ id: 'a', supportUsedThisRound: true });
    const b = makeChar({ id: 'b', supportUsedThisRound: false });

    resetSupportRoundFlags([a, b]);

    expect(a.supportUsedThisRound).toBe(false);
    expect(b.supportUsedThisRound).toBe(false);
  });
});
