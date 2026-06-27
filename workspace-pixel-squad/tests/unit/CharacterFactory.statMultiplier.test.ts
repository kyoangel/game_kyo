import { describe, it, expect } from 'vitest';
import { createEnemy } from '../../src/battle/CharacterFactory';
import type { EnemyTemplate } from '../../src/types';

const template: EnemyTemplate = {
  id: 'test_enemy',
  name: 'Enemy',
  baseStats: { hp: 100, atk: 20, def: 10, spd: 9 },
  skillIds: [],
};

describe('createEnemy — New Game+ stat multiplier', () => {
  it('defaults to a multiplier of 1 when none is given, leaving stats unchanged', () => {
    const e = createEnemy(template);
    expect(e.stats).toMatchObject({ hp: 100, atk: 20, def: 10, spd: 9 });
  });

  it('scales hp/atk/def by the given multiplier, rounded', () => {
    const e = createEnemy(template, 1.3);
    expect(e.stats.hp).toBe(Math.round(100 * 1.3));
    expect(e.stats.atk).toBe(Math.round(20 * 1.3));
    expect(e.stats.def).toBe(Math.round(10 * 1.3));
  });

  it('does not scale spd, regardless of multiplier', () => {
    const e = createEnemy(template, 1.6);
    expect(e.stats.spd).toBe(9);
  });

  it('sets maxHp to the scaled hp value, not the base hp', () => {
    const e = createEnemy(template, 1.3);
    expect(e.stats.maxHp).toBe(Math.round(100 * 1.3));
  });

  it('applies the NG+2 multiplier (×1.6) correctly', () => {
    const e = createEnemy(template, 1.6);
    expect(e.stats.hp).toBe(Math.round(100 * 1.6));
    expect(e.stats.atk).toBe(Math.round(20 * 1.6));
    expect(e.stats.def).toBe(Math.round(10 * 1.6));
  });
});
