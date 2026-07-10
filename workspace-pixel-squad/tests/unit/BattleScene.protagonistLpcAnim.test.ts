import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Protagonist LPC real-sprite pilot: swaps the single 32×32 flat-grid
// character_rogue.png sheet for 4 separate 64×64 per-animation sheets
// (walk/slash/hurt/idle) exported from the LPC generator's
// "ZIP: Split by animation" feature.

describe('BattleScene preload() — protagonist LPC per-animation sheets', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('loads a spritesheet for all 4 new protagonist LPC keys (frame size comes from SPRITE_SHEET_ASSETS, checked in SpriteData.test.ts)', () => {
    const body = extractMethod(source, 'preload');
    expect(body).toMatch(/this\.load\.spritesheet\(/);
    for (const key of [
      'protagonistWalkSheet',
      'protagonistSlashSheet',
      'protagonistHurtSheet',
      'protagonistIdleSheet',
    ]) {
      expect(body).toMatch(new RegExp(`SPRITE_KEYS\\.${key}`));
    }
  });
});

describe('BattleScene create() — protagonist animDefs use per-animation sheets and LPC row math', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('no longer relies on a single shared sheetKey const for all animDefs', () => {
    const body = extractMethod(source, 'create');
    expect(body).not.toMatch(/const\s+sheetKey\s*=\s*SPRITE_KEYS\.protagonistSheet/);
  });

  it('references lpcRowFrameRange and LPC_DIRECTION_ROW instead of hardcoded numeric ranges', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/lpcRowFrameRange\(/);
    expect(body).toMatch(/LPC_DIRECTION_ROW\.(left|right|up|down)/);
  });

  it('each animDef entry carries its own sheetKey field', () => {
    const body = extractMethod(source, 'create');
    // walk/slash/hurt/idle keys should each appear paired with a sheetKey on the same object
    expect(body).toMatch(/PROTAGONIST_ANIM_KEYS\.walkRight[\s\S]{0,120}?sheetKey:\s*SPRITE_KEYS\.protagonistWalkSheet/);
    expect(body).toMatch(/PROTAGONIST_ANIM_KEYS\.attackLeft[\s\S]{0,120}?sheetKey:\s*SPRITE_KEYS\.protagonistSlashSheet/);
    expect(body).toMatch(/PROTAGONIST_ANIM_KEYS\.death[\s\S]{0,120}?sheetKey:\s*SPRITE_KEYS\.protagonistHurtSheet/);
    expect(body).toMatch(/PROTAGONIST_ANIM_KEYS\.idle[\s\S]{0,120}?sheetKey:\s*SPRITE_KEYS\.protagonistIdleSheet/);
  });

  it('anims.create uses generateFrameNumbers against each def\'s own sheetKey, not a shared const', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/generateFrameNumbers\(\s*def\.sheetKey/);
  });

  it('idle animation now spans 2 frames (upgraded breathing loop), not 1 held frame', () => {
    const body = extractMethod(source, 'create');
    const idleDefMatch = body.match(/\{\s*key:\s*PROTAGONIST_ANIM_KEYS\.idle[\s\S]{0,200}?\}/);
    expect(idleDefMatch).not.toBeNull();
    const idleDef = idleDefMatch![0];
    expect(idleDef).toMatch(/lpcRowFrameRange\(\s*LPC_DIRECTION_ROW\.\w+\s*,\s*2\s*\)/);
  });

  it('walk/attack animDefs use the correct direction row and frame count each (catches a left/right swap or wrong frame count)', () => {
    const body = extractMethod(source, 'create');
    const cases: Array<[string, string, number]> = [
      ['walkRight', 'right', 9],
      ['walkLeft', 'left', 9],
      ['attackRight', 'right', 6],
      ['attackLeft', 'left', 6],
    ];
    for (const [animKey, direction, frameCount] of cases) {
      const re = new RegExp(
        `PROTAGONIST_ANIM_KEYS\\.${animKey}[\\s\\S]{0,160}?lpcRowFrameRange\\(\\s*LPC_DIRECTION_ROW\\.${direction}\\s*,\\s*${frameCount}\\s*\\)`,
      );
      expect(body).toMatch(re);
    }
  });
});

describe('BattleScene renderParty() — protagonist sprite readiness checks all 4 sheets', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('textureLoaded is true only when all 4 protagonist LPC textures exist', () => {
    const body = extractMethod(source, 'renderParty');
    const textureLoadedMatch = body.match(/const\s+textureLoaded\s*=\s*([\s\S]{0,400}?);/);
    expect(textureLoadedMatch).not.toBeNull();
    const expr = textureLoadedMatch![1];
    for (const key of [
      'protagonistWalkSheet',
      'protagonistSlashSheet',
      'protagonistHurtSheet',
      'protagonistIdleSheet',
    ]) {
      expect(expr).toMatch(new RegExp(`this\\.textures\\.exists\\(\\s*SPRITE_KEYS\\.${key}\\s*\\)`));
    }
  });

  it('creates the protagonist sprite body from the idle sheet, not the old flat-grid sheet', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/this\.add\.sprite\([^)]*SPRITE_KEYS\.protagonistIdleSheet/);
    expect(body).not.toMatch(/this\.add\.sprite\([^)]*SPRITE_KEYS\.protagonistSheet\s*,\s*90/);
  });
});
