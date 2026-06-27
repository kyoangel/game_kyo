import { describe, it, expect } from 'vitest';
import { createEnemy } from '../../src/battle/CharacterFactory';
import type { EnemyTemplate } from '../../src/types';

const TEMPLATE: EnemyTemplate = {
  id: 'vega',
  name: 'Vega',
  baseStats: { hp: 200, atk: 35, def: 15, spd: 14 },
  skillIds: [],
};

describe('createEnemy statMultiplier (NG+ scaling)', () => {
  it('defaults to an unscaled enemy when no multiplier is given', () => {
    const enemy = createEnemy(TEMPLATE);
    expect(enemy.stats.hp).toBe(200);
    expect(enemy.stats.atk).toBe(35);
    expect(enemy.stats.def).toBe(15);
    expect(enemy.stats.spd).toBe(14);
  });

  it('scales hp, atk, and def by the multiplier, rounded', () => {
    // NG+1: multiplier = 1 + 1 * 0.3 = 1.3
    const enemy = createEnemy(TEMPLATE, 1.3);
    expect(enemy.stats.hp).toBe(Math.round(200 * 1.3));
    expect(enemy.stats.atk).toBe(Math.round(35 * 1.3));
    expect(enemy.stats.def).toBe(Math.round(15 * 1.3));
  });

  it('does not scale spd, regardless of multiplier', () => {
    const enemy = createEnemy(TEMPLATE, 1.6);
    expect(enemy.stats.spd).toBe(14);
  });

  it('sets maxHp to the same scaled value as hp', () => {
    const enemy = createEnemy(TEMPLATE, 1.3);
    expect(enemy.stats.maxHp).toBe(enemy.stats.hp);
  });

  it('applies NG+2 multiplier of 1.6 correctly', () => {
    const enemy = createEnemy(TEMPLATE, 1.6);
    expect(enemy.stats.hp).toBe(Math.round(200 * 1.6));
    expect(enemy.stats.atk).toBe(Math.round(35 * 1.6));
    expect(enemy.stats.def).toBe(Math.round(15 * 1.6));
    expect(enemy.stats.spd).toBe(14);
  });
});
