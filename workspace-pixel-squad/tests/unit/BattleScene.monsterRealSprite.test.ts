import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Generalizes the party's real-sprite frame-animation path to monsters:
// preload() loads every individual frame for every anim of every monster
// type, create() registers one Phaser animation per type × anim from those
// individual-frame textures, and renderParty()'s monster branch switches
// from a static this.add.image() to a real this.add.sprite() gated on
// shouldUseMonsterSprite(), reusing monsterCharacterAnimKeys() for the
// CharacterAnimKeySet (walkRight===walkLeft, attackRight===attackLeft since
// monster art has only one fixed facing).

describe('BattleScene preload() — monster per-frame images', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('loads an individual image for every monster type crossed with every animation frame', () => {
    const body = extractMethod(source, 'preload');
    expect(body).toMatch(/MONSTER_ANIM_FPS/);
    expect(body).toMatch(/MONSTER_FRAMES\[type\]\[anim\]/);
    expect(body).toMatch(/monsterFrameKey\(/);
    expect(body).toMatch(/this\.load\.image\(/);
  });

  it('no longer references the removed monsterIdleKey/monsterIdlePath helpers', () => {
    const body = extractMethod(source, 'preload');
    expect(body).not.toMatch(/monsterIdleKey/);
    expect(body).not.toMatch(/monsterIdlePath/);
  });
});

describe('BattleScene create() — monster per-type animation registration', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('registers a Phaser animation for every monster type × animation via monsterAnimKey', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/monsterAnimKey\(/);
    expect(body).toMatch(/this\.anims\.create\(/);
    expect(body).toMatch(/MONSTER_FRAMES/);
    expect(body).toMatch(/MONSTER_ANIM_FPS/);
  });

  it('builds animation frames from individual monster frame textures via monsterFrameKey', () => {
    const body = extractMethod(source, 'create');
    expect(body).toMatch(/monsterFrameKey\(/);
  });

  it('guards duplicate registration with this.anims.exists() for the monster loop, same pattern as the party loop', () => {
    const body = extractMethod(source, 'create');
    const monsterLoopIdx = body.indexOf('monsterAnimKey(');
    expect(monsterLoopIdx).toBeGreaterThan(-1);
    const surrounding = body.slice(Math.max(0, monsterLoopIdx - 200), monsterLoopIdx + 400);
    expect(surrounding).toMatch(/this\.anims\.exists\(/);
  });
});

describe('BattleScene renderParty() — monster real-sprite branch', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('uses this.add.sprite (not this.add.image) for the monster branch, keyed by monsterFrameKey', () => {
    const body = extractMethod(source, 'renderParty');
    const monsterBranchMatch = body.match(/shouldUseMonsterSprite\(char, this\)\)\s*\{([\s\S]{0,800}?)\}\s*(?:else|const useSprite)/);
    expect(monsterBranchMatch).not.toBeNull();
    const branch = monsterBranchMatch![1];
    expect(branch).toMatch(/this\.add\.sprite\(/);
    expect(branch).not.toMatch(/this\.add\.image\(/);
    expect(branch).toMatch(/monsterFrameKey\(/);
  });

  it('preserves setDisplaySize(44, 56) and setFlipX(true) on the monster sprite', () => {
    const body = extractMethod(source, 'renderParty');
    const monsterBranchMatch = body.match(/shouldUseMonsterSprite\(char, this\)\)\s*\{([\s\S]{0,800}?)\}\s*(?:else|const useSprite)/);
    expect(monsterBranchMatch).not.toBeNull();
    const branch = monsterBranchMatch![1];
    expect(branch).toMatch(/setDisplaySize\(44,\s*56\)/);
    expect(branch).toMatch(/setFlipX\(true\)/);
  });

  it('useSprite is true for the monster real-sprite path in addition to the protagonist/party paths', () => {
    const body = extractMethod(source, 'renderParty');
    const useSpriteMatch = body.match(/const\s+useSprite\s*=\s*([\s\S]{0,300}?);/);
    expect(useSpriteMatch).not.toBeNull();
    const expr = useSpriteMatch![1];
    expect(expr).toMatch(/shouldUseMonsterSprite\(/);
  });

  it('computes animKeys via monsterCharacterAnimKeys for non-player monster characters', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/monsterCharacterAnimKeys\(/);
  });

  it('no longer references the removed monsterIdleKey helper', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).not.toMatch(/monsterIdleKey/);
  });
});

describe('BattleScene imports — monster real-sprite wiring', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('imports the new monster real-sprite helpers and drops the removed idle-image helpers', () => {
    const importLine = source.split('\n').find(l => l.includes("from '../data/sprites'")) ?? '';
    expect(importLine).toMatch(/monsterFrameKey/);
    expect(importLine).toMatch(/MONSTER_ANIM_FPS/);
    expect(importLine).toMatch(/monsterAnimKey/);
    expect(importLine).toMatch(/monsterCharacterAnimKeys/);
    expect(importLine).not.toMatch(/monsterIdleKey/);
    expect(importLine).not.toMatch(/monsterIdlePath/);
  });
});
