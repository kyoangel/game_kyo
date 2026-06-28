import { describe, it, expect } from 'vitest';
// monsterAnimKey and MONSTER_ANIM_FPS are not yet exported from sprites.ts — all tests will fail
import { monsterAnimKey, MONSTER_ANIM_FPS } from '../../src/data/sprites';
import type { MonsterAnimKey } from '../../src/data/sprites';

describe('monsterAnimKey()', () => {
  it('generates the correct key for demon + idle', () => {
    expect(monsterAnimKey('demon', 'idle')).toBe('monster_demon_idle');
  });

  it('generates the correct key for jinn + attack', () => {
    expect(monsterAnimKey('jinn', 'attack')).toBe('monster_jinn_attack');
  });

  it('generates the correct key for medusa + death', () => {
    expect(monsterAnimKey('medusa', 'death')).toBe('monster_medusa_death');
  });

  it('generates the correct key for small_dragon + walk', () => {
    expect(monsterAnimKey('small_dragon', 'walk')).toBe('monster_small_dragon_walk');
  });

  it('generates the correct key for lizard + hurt', () => {
    expect(monsterAnimKey('lizard', 'hurt')).toBe('monster_lizard_hurt');
  });

  it('generates the correct key for dragon + idle', () => {
    expect(monsterAnimKey('dragon', 'idle')).toBe('monster_dragon_idle');
  });

  it('is deterministic — same inputs always return the same key', () => {
    // This property is required for scene.anims.exists(key) duplicate guard to work correctly
    expect(monsterAnimKey('jinn', 'idle')).toBe(monsterAnimKey('jinn', 'idle'));
  });

  it('produces different keys for different monster types with the same anim', () => {
    // Two enemies of the same type share one key; different types must not collide
    expect(monsterAnimKey('demon', 'attack')).not.toBe(monsterAnimKey('dragon', 'attack'));
  });

  it('produces different keys for different anims on the same monster type', () => {
    expect(monsterAnimKey('demon', 'idle')).not.toBe(monsterAnimKey('demon', 'attack'));
  });

  it('produces different keys for all five animation states of the same type', () => {
    const keys: string[] = ['idle', 'walk', 'attack', 'hurt', 'death'].map(
      a => monsterAnimKey('demon', a as MonsterAnimKey),
    );
    expect(new Set(keys).size).toBe(5);
  });
});

describe('MONSTER_ANIM_FPS', () => {
  it('idle plays at 8 fps', () => {
    expect(MONSTER_ANIM_FPS.idle).toBe(8);
  });

  it('walk plays at 8 fps', () => {
    expect(MONSTER_ANIM_FPS.walk).toBe(8);
  });

  it('attack plays at 10 fps', () => {
    expect(MONSTER_ANIM_FPS.attack).toBe(10);
  });

  it('hurt plays at 10 fps', () => {
    expect(MONSTER_ANIM_FPS.hurt).toBe(10);
  });

  it('death plays at 6 fps', () => {
    expect(MONSTER_ANIM_FPS.death).toBe(6);
  });

  it('defines a fps value for every animation state', () => {
    const states: MonsterAnimKey[] = ['idle', 'walk', 'attack', 'hurt', 'death'];
    states.forEach(state => {
      expect(
        typeof MONSTER_ANIM_FPS[state],
        `missing fps for anim state '${state}'`,
      ).toBe('number');
    });
  });
});
