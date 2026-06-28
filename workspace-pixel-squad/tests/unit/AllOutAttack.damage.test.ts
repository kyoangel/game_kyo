import { describe, it, expect } from 'vitest';
import { calcAoaDamage, applyAllOutAttack } from '../../src/battle/AllOutAttack';
import type { Character } from '../../src/types';

function makeChar(atk: number, isPlayer = true, overrides: Record<string, unknown> = {}): Character {
  return Object.assign(
    {
      id: 'c1', templateId: 'c1', name: 'Char', isProtagonist: false, isPlayer,
      level: 1, exp: 0, expToNext: 50,
      stats: { hp: 100, maxHp: 100, atk, def: 5, spd: 10 },
      skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
      activeBuffs: [], skillCooldowns: {},
    },
    overrides,
  ) as Character;
}

function makeEnemy(hp: number, overrides: Record<string, unknown> = {}): Character {
  return Object.assign(
    {
      id: 'e1', templateId: 'e1', name: 'Enemy', isProtagonist: false, isPlayer: false,
      level: 1, exp: 0, expToNext: 50,
      stats: { hp, maxHp: hp, atk: 10, def: 5, spd: 5 },
      skills: [], statPoints: 0, archetype: '全能', alive: true, defending: false,
      activeBuffs: [], skillCooldowns: {}, knockedDown: true,
    },
    overrides,
  ) as Character;
}

// --- calcAoaDamage ---

describe('calcAoaDamage — formula: floor(atk × 0.5), min 1 (AC: AOA damage)', () => {
  it('returns 5 for atk=10', () => {
    expect(calcAoaDamage(10)).toBe(5);
  });

  it('returns 3 for atk=7 (floor of 3.5)', () => {
    expect(calcAoaDamage(7)).toBe(3);
  });

  it('returns 1 minimum for atk=1 (floor(0.5)=0 → clamped to 1)', () => {
    expect(calcAoaDamage(1)).toBe(1);
  });

  it('returns 1 minimum for atk=0', () => {
    expect(calcAoaDamage(0)).toBe(1);
  });

  it('returns 25 for atk=50', () => {
    expect(calcAoaDamage(50)).toBe(25);
  });

  it('always returns a whole number (floors fractional result)', () => {
    const result = calcAoaDamage(9);
    expect(result).toBe(Math.floor(result));
    expect(result).toBe(4);
  });
});

// --- applyAllOutAttack ---

describe('applyAllOutAttack — damage application (AC: 3 members × 2 enemies = 6 applications)', () => {
  it('each enemy loses HP equal to the sum of all alive members\' AOA damage', () => {
    // 3 members each with atk=10 → each deals floor(10×0.5)=5
    const members = [
      makeChar(10, true, { id: 'm1' }),
      makeChar(10, true, { id: 'm2' }),
      makeChar(10, true, { id: 'm3' }),
    ];
    const enemy1 = makeEnemy(100, { id: 'e1' });
    const enemy2 = makeEnemy(100, { id: 'e2' });

    applyAllOutAttack(members, [enemy1, enemy2]);

    // Each enemy takes 5 from each of 3 members = 15 total damage
    expect(enemy1.stats.hp).toBe(85);
    expect(enemy2.stats.hp).toBe(85);
  });

  it('uses raw stats.atk — no archetype multipliers applied', () => {
    // A '輸出' archetype member has a 1.1× ATK multiplier in effectiveAtk(),
    // but AOA must use raw stats.atk * 0.5.
    const dpsChar = makeChar(20, true, { id: 'dps', archetype: '輸出' });
    const enemy = makeEnemy(100, { id: 'e1' });

    applyAllOutAttack([dpsChar], [enemy]);

    // Should be floor(20 × 0.5) = 10, NOT floor(20 × 1.1 × 0.5) = 11
    expect(enemy.stats.hp).toBe(90);
  });

  it('deals at least 1 damage even when member atk=0', () => {
    const weakMember = makeChar(0, true, { id: 'weak' });
    const enemy = makeEnemy(100, { id: 'e1' });

    applyAllOutAttack([weakMember], [enemy]);

    expect(enemy.stats.hp).toBe(99); // max(1, floor(0 × 0.5)) = 1
  });

  it('does NOT apply defense reduction — enemy def is ignored', () => {
    // Enemy with def=50: AOA should NOT reduce damage
    const member = makeChar(10, true, { id: 'm1' });
    const highDefEnemy = makeEnemy(100, { id: 'e1', stats: { hp: 100, maxHp: 100, atk: 10, def: 50, spd: 5 } });

    applyAllOutAttack([member], [highDefEnemy]);

    // floor(10 × 0.5) = 5, regardless of def=50
    expect(highDefEnemy.stats.hp).toBe(95);
  });

  it('does NOT set alive=false even when HP drops to 0 (death check is caller responsibility)', () => {
    // atk=10 → deals 5; enemy has hp=3 → reduced to -2
    const member = makeChar(10, true, { id: 'm1' });
    const fragileEnemy = makeEnemy(3, { id: 'e1' });

    applyAllOutAttack([member], [fragileEnemy]);

    expect(fragileEnemy.stats.hp).toBeLessThanOrEqual(0);
    expect(fragileEnemy.alive).toBe(true); // NOT set to false by applyAllOutAttack
  });

  it('all damage applied before any death check (enemy can go negative)', () => {
    // AC: "all damage resolved before any death check"
    // 3 members each dealing 5 against enemy with hp=7: after each application hp=2, -3, -8
    const members = [
      makeChar(10, true, { id: 'm1' }),
      makeChar(10, true, { id: 'm2' }),
      makeChar(10, true, { id: 'm3' }),
    ];
    const enemy = makeEnemy(7, { id: 'e1' });

    applyAllOutAttack(members, [enemy]);

    expect(enemy.stats.hp).toBe(-8);   // 7 - 5 - 5 - 5
    expect(enemy.alive).toBe(true);     // no death check inside applyAllOutAttack
  });

  it('skips dead party members (alive=false members do not deal damage)', () => {
    const aliveMember = makeChar(10, true, { id: 'm1', alive: true });
    const deadMember = makeChar(10, true, { id: 'm2', alive: false });
    const enemy = makeEnemy(100, { id: 'e1' });

    applyAllOutAttack([aliveMember, deadMember], [enemy]);

    // Only alive member attacks: 5 damage
    expect(enemy.stats.hp).toBe(95);
  });

  it('skips dead enemies (alive=false enemies do not take damage)', () => {
    const member = makeChar(10, true, { id: 'm1' });
    const aliveEnemy = makeEnemy(100, { id: 'e1', alive: true });
    const deadEnemy = makeEnemy(100, { id: 'e2', alive: false });

    applyAllOutAttack([member], [aliveEnemy, deadEnemy]);

    expect(aliveEnemy.stats.hp).toBe(95); // took 5 damage
    expect(deadEnemy.stats.hp).toBe(100); // unchanged
  });
});

describe('applyAllOutAttack — enough damage to kill all enemies (AC: AOA kills all enemies)', () => {
  it('HP goes to 0 or below when AOA damage exceeds enemy HP', () => {
    const member = makeChar(100, true, { id: 'm1' }); // deals floor(100×0.5)=50
    const enemy = makeEnemy(20, { id: 'e1' });        // hp=20

    applyAllOutAttack([member], [enemy]);

    expect(enemy.stats.hp).toBeLessThanOrEqual(0);
  });

  it('does not throw when multiple enemies all reach 0 HP simultaneously', () => {
    const member = makeChar(100, true, { id: 'm1' }); // deals 50
    const enemy1 = makeEnemy(20, { id: 'e1' });
    const enemy2 = makeEnemy(30, { id: 'e2' });

    expect(() => applyAllOutAttack([member], [enemy1, enemy2])).not.toThrow();
    expect(enemy1.stats.hp).toBeLessThanOrEqual(0);
    expect(enemy2.stats.hp).toBeLessThanOrEqual(0);
  });
});
