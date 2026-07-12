import { describe, it, expect } from 'vitest';
import { shouldUseProtagonistSprite, shouldUsePartyRealSprite, shouldUseMonsterSprite } from '../../src/battle/SpriteSelection';
import { monsterFrameKey, MONSTER_ANIM_FPS } from '../../src/data/sprites';
import type { MonsterAnimKey } from '../../src/data/sprites';
import type { Character } from '../../src/types';

function makeScene(loadedKeys: string[]) {
  return { textures: { exists: (k: string) => loadedKeys.includes(k) } };
}

function makeCharacter(overrides: Partial<Character>): Character {
  return {
    id: 'c1',
    templateId: 'protagonist',
    name: '倖存者',
    isProtagonist: false,
    isPlayer: false,
    level: 1,
    exp: 0,
    expToNext: 100,
    stats: { hp: 100, maxHp: 100, atk: 10, def: 10, spd: 10 },
    skills: [],
    statPoints: 0,
    archetype: '全能',
    alive: true,
    defending: false,
    activeBuffs: [],
    ...overrides,
  };
}

describe('shouldUseProtagonistSprite', () => {
  it('returns true for the protagonist player character when the texture is loaded', () => {
    const protagonist = makeCharacter({ isProtagonist: true, isPlayer: true });
    expect(shouldUseProtagonistSprite(protagonist, true)).toBe(true);
  });

  it('returns false when the texture failed to load, even for the protagonist', () => {
    const protagonist = makeCharacter({ isProtagonist: true, isPlayer: true });
    expect(shouldUseProtagonistSprite(protagonist, false)).toBe(false);
  });

  it('returns false for a non-protagonist ally (e.g. Rex) regardless of texture state', () => {
    const rex = makeCharacter({ templateId: 'rex', name: 'Rex', isProtagonist: false, isPlayer: true });
    expect(shouldUseProtagonistSprite(rex, true)).toBe(false);
  });

  it('returns false for an enemy even if isProtagonist were somehow true', () => {
    const enemy = makeCharacter({ isProtagonist: true, isPlayer: false });
    expect(shouldUseProtagonistSprite(enemy, true)).toBe(false);
  });

  it('returns false for a recruited former enemy who is not the protagonist', () => {
    const recruited = makeCharacter({ isProtagonist: false, isPlayer: true, recruited: true });
    expect(shouldUseProtagonistSprite(recruited, true)).toBe(false);
  });
});

describe('shouldUsePartyRealSprite', () => {
  const rexKeys = ['party_rex_lpc_walk', 'party_rex_lpc_slash', 'party_rex_lpc_hurt', 'party_rex_lpc_idle'];

  it('returns true for a party member player character when all 4 LPC textures are loaded', () => {
    const rex = makeCharacter({ templateId: 'rex', name: 'Rex', isProtagonist: false, isPlayer: true });
    expect(shouldUsePartyRealSprite(rex, makeScene(rexKeys))).toBe(true);
  });

  it('returns false when only some of the 4 LPC textures are loaded (partial/failed download)', () => {
    const rex = makeCharacter({ templateId: 'rex', name: 'Rex', isProtagonist: false, isPlayer: true });
    expect(shouldUsePartyRealSprite(rex, makeScene(['party_rex_lpc_walk']))).toBe(false);
  });

  it('returns false when none of the LPC textures are loaded (character not yet regenerated)', () => {
    const nyx = makeCharacter({ templateId: 'nyx', name: 'Nyx', isProtagonist: false, isPlayer: true });
    expect(shouldUsePartyRealSprite(nyx, makeScene(rexKeys))).toBe(false);
  });

  it('returns false for the protagonist even if matching textures happened to exist', () => {
    const protagonist = makeCharacter({ isProtagonist: true, isPlayer: true });
    expect(shouldUsePartyRealSprite(protagonist, makeScene(rexKeys))).toBe(false);
  });

  it('returns false for an enemy, even one that shares a templateId with a party member', () => {
    const enemyRex = makeCharacter({ templateId: 'rex', isProtagonist: false, isPlayer: false });
    expect(shouldUsePartyRealSprite(enemyRex, makeScene(rexKeys))).toBe(false);
  });

  it('returns false for a templateId that is not in PARTY_MEMBER_IDS', () => {
    const unknown = makeCharacter({ templateId: 'not_a_party_member', isProtagonist: false, isPlayer: true });
    expect(shouldUsePartyRealSprite(unknown, makeScene(rexKeys))).toBe(false);
  });
});

describe('shouldUseMonsterSprite', () => {
  const monsterAnims = Object.keys(MONSTER_ANIM_FPS) as MonsterAnimKey[];
  const demonKeys = monsterAnims.map(anim => monsterFrameKey('demon', anim, 0));

  it('returns true for a monster enemy when the first frame of every animation is loaded', () => {
    const demon = makeCharacter({ isPlayer: false, _monsterType: 'demon' });
    expect(shouldUseMonsterSprite(demon, makeScene(demonKeys))).toBe(true);
  });

  it('returns false when one animation is missing its first frame (partial/failed download)', () => {
    const demon = makeCharacter({ isPlayer: false, _monsterType: 'demon' });
    const missingDeath = demonKeys.filter(k => k !== monsterFrameKey('demon', 'death', 0));
    expect(shouldUseMonsterSprite(demon, makeScene(missingDeath))).toBe(false);
  });

  it('returns true for a recruited enemy (isPlayer: true, still carries its original _monsterType)', () => {
    // A generic (non-named) recruited enemy is converted to a player
    // character via enemyToPlayerCharacter(), which preserves _monsterType
    // so it keeps its real monster sprite in the party row instead of
    // falling through to the flat-color rectangle fallback.
    const recruited = makeCharacter({ isPlayer: true, _monsterType: 'demon' });
    expect(shouldUseMonsterSprite(recruited, makeScene(demonKeys))).toBe(true);
  });

  it('returns false for a normal player character with no _monsterType', () => {
    const player = makeCharacter({ isPlayer: true });
    expect(shouldUseMonsterSprite(player, makeScene(demonKeys))).toBe(false);
  });

  it('returns false for an enemy with no _monsterType set', () => {
    const noType = makeCharacter({ isPlayer: false });
    expect(shouldUseMonsterSprite(noType, makeScene(demonKeys))).toBe(false);
  });

  it('returns false when no textures are loaded', () => {
    const demon = makeCharacter({ isPlayer: false, _monsterType: 'demon' });
    expect(shouldUseMonsterSprite(demon, makeScene([]))).toBe(false);
  });
});
