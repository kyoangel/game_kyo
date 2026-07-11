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

describe('BattleScene create() — protagonist animDefs built via the shared buildCharacterAnimDefs helper', () => {
  // Detailed frame-range/frame-count correctness for buildCharacterAnimDefs
  // itself is covered precisely in tests/unit/SpriteData.test.ts (direct unit
  // tests on the pure function) — this file only checks that create() wires
  // it up correctly for the protagonist, not the frame math again.
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('no longer relies on a single shared sheetKey const for all animDefs', () => {
    const body = extractMethod(source, 'create');
    expect(body).not.toMatch(/const\s+sheetKey\s*=\s*SPRITE_KEYS\.protagonistSheet/);
  });

  it('calls buildCharacterAnimDefs with PROTAGONIST_ANIM_KEYS and the 4 protagonist sheet keys', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/buildCharacterAnimDefs\(\s*PROTAGONIST_ANIM_KEYS/);
    expect(body).toMatch(/SPRITE_KEYS\.protagonistWalkSheet/);
    expect(body).toMatch(/SPRITE_KEYS\.protagonistSlashSheet/);
    expect(body).toMatch(/SPRITE_KEYS\.protagonistHurtSheet/);
    expect(body).toMatch(/SPRITE_KEYS\.protagonistIdleSheet/);
  });

  it('also calls buildCharacterAnimDefs once per PARTY_MEMBER_IDS entry (party real-sprite animDefs)', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/PARTY_MEMBER_IDS/);
    expect(body).toMatch(/characterAnimKeys\(/);
    expect(body).toMatch(/partyLpcSheetKey\(/);
  });

  it('anims.create uses generateFrameNumbers against each def\'s own sheetKey, not a shared const', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/generateFrameNumbers\(\s*def\.sheetKey/);
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
