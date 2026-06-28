import { describe, it, expect } from 'vitest';
import { createEnemy } from '../../src/battle/CharacterFactory';
import type { EnemyTemplate } from '../../src/types';
import type { MonsterType } from '../../src/data/sprites';

// createEnemy() must copy template.monsterType to (char as any)._monsterType so
// BattleScene can select the correct sprite without touching the Character type.
// All assertions below fail until CharacterFactory.createEnemy() is updated.

function makeTemplate(id: string, monsterType?: MonsterType): EnemyTemplate {
  const t: EnemyTemplate = {
    id,
    name: id,
    baseStats: { hp: 100, atk: 20, def: 10, spd: 10 },
    skillIds: [],
  };
  if (monsterType !== undefined) {
    (t as any).monsterType = monsterType;
  }
  return t;
}

describe('createEnemy — _monsterType propagation (AC2, AC4)', () => {
  it('sets _monsterType to demon when template.monsterType is demon', () => {
    const char = createEnemy(makeTemplate('mutant', 'demon'));
    expect((char as any)._monsterType).toBe('demon');
  });

  it('sets _monsterType to medusa when template.monsterType is medusa', () => {
    const char = createEnemy(makeTemplate('zora', 'medusa'));
    expect((char as any)._monsterType).toBe('medusa');
  });

  it('sets _monsterType to jinn when template.monsterType is jinn', () => {
    const char = createEnemy(makeTemplate('crow', 'jinn'));
    expect((char as any)._monsterType).toBe('jinn');
  });

  it('sets _monsterType to dragon when template.monsterType is dragon', () => {
    const char = createEnemy(makeTemplate('dex', 'dragon'));
    expect((char as any)._monsterType).toBe('dragon');
  });

  it('sets _monsterType to lizard when template.monsterType is lizard', () => {
    const char = createEnemy(makeTemplate('em_spider', 'lizard'));
    expect((char as any)._monsterType).toBe('lizard');
  });

  it('sets _monsterType to small_dragon when template.monsterType is small_dragon', () => {
    const char = createEnemy(makeTemplate('wolf_a', 'small_dragon'));
    expect((char as any)._monsterType).toBe('small_dragon');
  });

  it('leaves _monsterType undefined when template has no monsterType (AC4: unmapped enemy falls back to rectangle)', () => {
    const char = createEnemy(makeTemplate('future_enemy_001'));
    expect((char as any)._monsterType).toBeUndefined();
  });

  it('_monsterType is preserved when statMultiplier is applied (NG+ scaling does not clobber it)', () => {
    const char = createEnemy(makeTemplate('vega', 'demon'), 1.3);
    expect((char as any)._monsterType).toBe('demon');
  });

  it('two enemies of the same monsterType get independent Character instances (AC3: share anim key, not instance)', () => {
    const charA = createEnemy(makeTemplate('mech_a', 'jinn'));
    const charB = createEnemy(makeTemplate('mech_b', 'jinn'));
    expect((charA as any)._monsterType).toBe('jinn');
    expect((charB as any)._monsterType).toBe('jinn');
    // Each enemy is its own object — mutation of one must not affect the other
    expect(charA).not.toBe(charB);
    expect(charA.id).not.toBe(charB.id);
  });

  it('_monsterType on the character exactly matches monsterType on the template (no transformation)', () => {
    const allTypes: MonsterType[] = ['demon', 'dragon', 'jinn', 'lizard', 'medusa', 'small_dragon'];
    allTypes.forEach(mt => {
      const char = createEnemy(makeTemplate(`test_${mt}`, mt));
      expect((char as any)._monsterType).toBe(mt);
    });
  });
});
