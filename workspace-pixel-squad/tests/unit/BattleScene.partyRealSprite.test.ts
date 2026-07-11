import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Generalizes the protagonist's real-sprite LPC animation path to any party
// member: preload() loads PARTY_MEMBER_IDS × PARTY_LPC_ANIMS sheets,
// renderParty() gains a shouldUsePartyRealSprite branch (before the existing
// static-image fallback), and useSprite/animKeys cover both the protagonist
// and party-member cases.

describe('BattleScene preload() — party member LPC per-animation sheets', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('loads a spritesheet for every party member id crossed with every LPC animation', () => {
    const body = extractMethod(source, 'preload');
    expect(body).toMatch(/PARTY_MEMBER_IDS/);
    expect(body).toMatch(/PARTY_LPC_ANIMS/);
    expect(body).toMatch(/partyLpcSheetKey\(/);
    expect(body).toMatch(/partyLpcSheetPath\(/);
    expect(body).toMatch(/this\.load\.spritesheet\(/);
  });
});

describe('BattleScene renderParty() — party member real-sprite branch', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('has a shouldUsePartyRealSprite branch positioned before the static-image (shouldUsePartySprite) branch', () => {
    const body = extractMethod(source, 'renderParty');
    const realSpriteIdx = body.indexOf('shouldUsePartyRealSprite');
    const staticImageIdx = body.indexOf('shouldUsePartySprite(');
    expect(realSpriteIdx).toBeGreaterThan(-1);
    expect(staticImageIdx).toBeGreaterThan(-1);
    expect(realSpriteIdx).toBeLessThan(staticImageIdx);
  });

  it('useSprite is true for either the protagonist sprite path or the party real-sprite path', () => {
    const body = extractMethod(source, 'renderParty');
    const useSpriteMatch = body.match(/const\s+useSprite\s*=\s*([\s\S]{0,200}?);/);
    expect(useSpriteMatch).not.toBeNull();
    const expr = useSpriteMatch![1];
    expect(expr).toMatch(/shouldUseProtagonistSprite\(/);
    expect(expr).toMatch(/shouldUsePartyRealSprite\(/);
  });

  it('computes animKeys as PROTAGONIST_ANIM_KEYS for the protagonist, characterAnimKeys(templateId) otherwise', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/isProtagonist[\s\S]{0,60}?PROTAGONIST_ANIM_KEYS[\s\S]{0,60}?characterAnimKeys\(/);
  });

  it('passes animKeys as a 4th argument to the CharacterAnimator constructor', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/new CharacterAnimator\([^)]*,\s*useSprite\s*,\s*animKeys\s*\)/);
  });
});
