import { describe, it, expect } from 'vitest';
import {
  SPRITE_KEYS,
  SPRITE_SHEET_ASSETS,
  LPC_DIRECTION_ROW,
  lpcRowFrameRange,
  PROTAGONIST_ANIM_KEYS,
  characterAnimKeys,
  PARTY_LPC_ANIMS,
  partyLpcSheetKey,
  partyLpcSheetPath,
  buildCharacterAnimDefs,
  monsterFrameKey,
  monsterFramePath,
  monsterCharacterAnimKeys,
  monsterAnimKey,
  MONSTER_FRAMES,
  monsterDisplaySize,
} from '../../src/data/sprites';

describe('SPRITE_KEYS', () => {
  it('defines the 4 protagonist LPC per-animation sheet keys', () => {
    expect(SPRITE_KEYS.protagonistWalkSheet).toBe('protagonist_lpc_walk');
    expect(SPRITE_KEYS.protagonistSlashSheet).toBe('protagonist_lpc_slash');
    expect(SPRITE_KEYS.protagonistHurtSheet).toBe('protagonist_lpc_hurt');
    expect(SPRITE_KEYS.protagonistIdleSheet).toBe('protagonist_lpc_idle');
  });
});

describe('SPRITE_SHEET_ASSETS — protagonist LPC per-animation sheets', () => {
  it('registers all 4 sheets at 64×64 frames under public/sprites/party-lpc/protagonist', () => {
    const expected: Record<string, string> = {
      [SPRITE_KEYS.protagonistWalkSheet]: 'sprites/party-lpc/protagonist/walk.png',
      [SPRITE_KEYS.protagonistSlashSheet]: 'sprites/party-lpc/protagonist/slash.png',
      [SPRITE_KEYS.protagonistHurtSheet]: 'sprites/party-lpc/protagonist/hurt.png',
      [SPRITE_KEYS.protagonistIdleSheet]: 'sprites/party-lpc/protagonist/idle.png',
    };
    for (const [key, path] of Object.entries(expected)) {
      const asset = SPRITE_SHEET_ASSETS[key as keyof typeof SPRITE_SHEET_ASSETS];
      expect(asset.path).toBe(path);
      expect(asset.frameWidth).toBe(64);
      expect(asset.frameHeight).toBe(64);
    }
  });
});

describe('LPC_DIRECTION_ROW', () => {
  it('matches the fixed LPC row order: up, left, down, right', () => {
    expect(LPC_DIRECTION_ROW).toEqual({ up: 0, left: 1, down: 2, right: 3 });
  });
});

describe('lpcRowFrameRange', () => {
  it('row 0 (up), 9 frames → start 0, end 8', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.up, 9)).toEqual({ start: 0, end: 8 });
  });

  it('row 3 (right), 9 frames (walk) → start 39, end 47', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.right, 9)).toEqual({ start: 39, end: 47 });
  });

  it('row 1 (left), 6 frames (slash) → start 13, end 18', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.left, 6)).toEqual({ start: 13, end: 18 });
  });

  it('row 2 (down), 2 frames (idle) → start 26, end 27', () => {
    expect(lpcRowFrameRange(LPC_DIRECTION_ROW.down, 2)).toEqual({ start: 26, end: 27 });
  });

  it('defaults to 13 columns per row (LPC standard), overridable via 3rd arg', () => {
    expect(lpcRowFrameRange(1, 3, 10)).toEqual({ start: 10, end: 12 });
  });
});

describe('characterAnimKeys', () => {
  it('generates the 6 Phaser animation keys for a given character id', () => {
    expect(characterAnimKeys('rex')).toEqual({
      walkRight: 'rex_walk_right',
      walkLeft: 'rex_walk_left',
      attackRight: 'rex_attack_right',
      attackLeft: 'rex_attack_left',
      death: 'rex_death',
      idle: 'rex_idle_gesture',
    });
  });

  it('produces distinct keys for different character ids (no collisions)', () => {
    expect(characterAnimKeys('rex').walkRight).not.toBe(characterAnimKeys('nyx').walkRight);
  });

  it('PROTAGONIST_ANIM_KEYS is exactly characterAnimKeys("protagonist") — byte-identical to the pre-refactor hardcoded values', () => {
    expect(PROTAGONIST_ANIM_KEYS).toEqual(characterAnimKeys('protagonist'));
    expect(PROTAGONIST_ANIM_KEYS.walkRight).toBe('protagonist_walk_right');
    expect(PROTAGONIST_ANIM_KEYS.idle).toBe('protagonist_idle_gesture');
  });
});

describe('PARTY_LPC_ANIMS', () => {
  it('lists the 4 LPC per-animation sheet names', () => {
    expect(PARTY_LPC_ANIMS).toEqual(['walk', 'slash', 'hurt', 'idle']);
  });
});

describe('partyLpcSheetKey / partyLpcSheetPath', () => {
  it('generates a unique Phaser texture key per character+animation', () => {
    expect(partyLpcSheetKey('rex', 'walk')).toBe('party_rex_lpc_walk');
    expect(partyLpcSheetKey('nyx', 'slash')).toBe('party_nyx_lpc_slash');
  });

  it('generates the expected public/ asset path per character+animation', () => {
    expect(partyLpcSheetPath('rex', 'walk')).toBe('sprites/party-lpc/rex/walk.png');
    expect(partyLpcSheetPath('nyx', 'hurt')).toBe('sprites/party-lpc/nyx/hurt.png');
  });

  it('has no leading slash so paths resolve relative to the public dir', () => {
    expect(partyLpcSheetPath('rex', 'idle').startsWith('/')).toBe(false);
  });
});

describe('buildCharacterAnimDefs', () => {
  it('returns 6 animDefs (walkRight/Left, attackRight/Left, death, idle) wired to the given sheets', () => {
    const keys = characterAnimKeys('rex');
    const sheets = { walk: 'w', slash: 's', hurt: 'h', idle: 'i' };
    const defs = buildCharacterAnimDefs(keys, sheets);
    expect(defs).toHaveLength(6);

    const byKey = Object.fromEntries(defs.map(d => [d.key, d]));
    expect(byKey[keys.walkRight]).toMatchObject({ sheetKey: 'w', start: 39, end: 47, frameRate: 12, repeat: -1 });
    expect(byKey[keys.walkLeft]).toMatchObject({ sheetKey: 'w', start: 13, end: 21, frameRate: 12, repeat: -1 });
    expect(byKey[keys.attackRight]).toMatchObject({ sheetKey: 's', start: 39, end: 44, frameRate: 17, repeat: 0 });
    expect(byKey[keys.attackLeft]).toMatchObject({ sheetKey: 's', start: 13, end: 18, frameRate: 17, repeat: 0 });
    expect(byKey[keys.death]).toMatchObject({ sheetKey: 'h', start: 0, end: 5, frameRate: 13, repeat: 0 });
    expect(byKey[keys.idle]).toMatchObject({ sheetKey: 'i', start: 39, end: 40, frameRate: 3, repeat: -1 });
  });

  it('produces different animDefs for different characters (own keys, same frame math)', () => {
    const rexDefs = buildCharacterAnimDefs(characterAnimKeys('rex'), { walk: 'w', slash: 's', hurt: 'h', idle: 'i' });
    const nyxDefs = buildCharacterAnimDefs(characterAnimKeys('nyx'), { walk: 'w', slash: 's', hurt: 'h', idle: 'i' });
    expect(rexDefs.map(d => d.key)).not.toEqual(nyxDefs.map(d => d.key));
    expect(rexDefs.map(d => ({ start: d.start, end: d.end }))).toEqual(nyxDefs.map(d => ({ start: d.start, end: d.end })));
  });
});

describe('monsterFrameKey', () => {
  it('generates a Phaser texture key per type+anim+frame index', () => {
    expect(monsterFrameKey('demon', 'idle', 0)).toBe('monster_demon_idle_frame0');
    expect(monsterFrameKey('demon', 'idle', 2)).toBe('monster_demon_idle_frame2');
  });

  it('generates distinct keys for different monster types', () => {
    expect(monsterFrameKey('demon', 'walk', 0)).not.toBe(monsterFrameKey('dragon', 'walk', 0));
  });

  it('generates distinct keys for different anims on the same type', () => {
    expect(monsterFrameKey('jinn', 'attack', 0)).not.toBe(monsterFrameKey('jinn', 'death', 0));
  });

  it('generates distinct keys for different frame indices', () => {
    expect(monsterFrameKey('lizard', 'walk', 0)).not.toBe(monsterFrameKey('lizard', 'walk', 1));
  });
});

describe('monsterFramePath', () => {
  it('resolves the correct asset path from MONSTER_FRAMES for a given type+anim+index', () => {
    expect(monsterFramePath('demon', 'idle', 0)).toBe(MONSTER_FRAMES.demon.idle[0]);
    expect(monsterFramePath('dragon', 'attack', 1)).toBe(MONSTER_FRAMES.dragon.attack[1]);
  });

  it('matches the frames() naming convention (folder + prefix + 1-based frame number)', () => {
    expect(monsterFramePath('medusa', 'death', 0)).toBe('sprites/monsters/medusa/Death1.png');
  });
});

describe('monsterCharacterAnimKeys', () => {
  it('returns a CharacterAnimKeySet where walkRight equals walkLeft and attackRight equals attackLeft (no left/right frame variants)', () => {
    const keys = monsterCharacterAnimKeys('demon');
    expect(keys.walkRight).toBe(keys.walkLeft);
    expect(keys.attackRight).toBe(keys.attackLeft);
  });

  it('wires each key to the corresponding monsterAnimKey', () => {
    expect(monsterCharacterAnimKeys('jinn')).toEqual({
      walkRight: monsterAnimKey('jinn', 'walk'),
      walkLeft: monsterAnimKey('jinn', 'walk'),
      attackRight: monsterAnimKey('jinn', 'attack'),
      attackLeft: monsterAnimKey('jinn', 'attack'),
      death: monsterAnimKey('jinn', 'death'),
      idle: monsterAnimKey('jinn', 'idle'),
    });
  });

  it('produces distinct anim keys for different monster types', () => {
    expect(monsterCharacterAnimKeys('demon').idle).not.toBe(monsterCharacterAnimKeys('dragon').idle);
  });
});

describe('monsterDisplaySize', () => {
  // Bug: every monster type rendered through the same fixed
  // setDisplaySize(44, 56), but source canvases aren't uniform (256x256 for
  // demon/dragon/lizard vs 128x128 for jinn/medusa/small_dragon) — the same
  // display box renders the 256-canvas types' content at roughly half the
  // on-screen height of the 128-canvas types (confirmed via pixel analysis:
  // demon ~21px tall vs jinn ~34px tall at the old fixed size). Doubling the
  // display box for the 256-canvas types restores a consistent apparent
  // size without touching the ones that already looked right.
  it('doubles the display box for 256x256-canvas types (demon, dragon, lizard)', () => {
    expect(monsterDisplaySize('demon')).toEqual({ w: 88, h: 112 });
    expect(monsterDisplaySize('dragon')).toEqual({ w: 88, h: 112 });
    expect(monsterDisplaySize('lizard')).toEqual({ w: 88, h: 112 });
  });

  it('keeps the original 44x56 box for 128x128-canvas types (jinn, medusa, small_dragon)', () => {
    expect(monsterDisplaySize('jinn')).toEqual({ w: 44, h: 56 });
    expect(monsterDisplaySize('medusa')).toEqual({ w: 44, h: 56 });
    expect(monsterDisplaySize('small_dragon')).toEqual({ w: 44, h: 56 });
  });
});
