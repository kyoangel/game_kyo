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
    const monsterBranchMatch = body.match(/shouldUseMonsterSprite\(char, this\)\)\s*\{([\s\S]{0,1700}?)\}\s*(?:else|const useSprite)/);
    expect(monsterBranchMatch).not.toBeNull();
    const branch = monsterBranchMatch![1];
    expect(branch).toMatch(/this\.add\.sprite\(/);
    expect(branch).not.toMatch(/this\.add\.image\(/);
    expect(branch).toMatch(/monsterFrameKey\(/);
  });

  it('sizes the sprite per type via monsterDisplaySize(), not a hardcoded 44x56', () => {
    // Bug: demon/dragon/lizard ship on a 256x256 canvas vs jinn/medusa/
    // small_dragon's 128x128, so the same fixed setDisplaySize(44, 56)
    // rendered the 256-canvas types at roughly half the on-screen height.
    const body = extractMethod(source, 'renderParty');
    const monsterBranchMatch = body.match(/shouldUseMonsterSprite\(char, this\)\)\s*\{([\s\S]{0,1700}?)\}\s*(?:else|const useSprite)/);
    expect(monsterBranchMatch).not.toBeNull();
    const branch = monsterBranchMatch![1];
    expect(branch).toMatch(/monsterDisplaySize\(/);
    expect(branch).not.toMatch(/setDisplaySize\(44,\s*56\)/);
  });

  it('bottom-anchors the sprite (setOrigin(0.5, 1)) so a taller display size grows upward, keeping feet pinned to the HP bar', () => {
    // User requirement: HP bar position must stay fixed, and the distance
    // from the sprite's feet to the bar must stay fixed too — only the
    // character should get bigger. Phaser sprites default to center origin
    // (0.5, 0.5), so growing displayHeight while keeping the same center y
    // would push the feet *down* past the bar as much as the head rises.
    // Bottom-anchoring at the original 56px-tall box's bottom edge means
    // extra height only extends upward.
    const body = extractMethod(source, 'renderParty');
    const monsterBranchMatch = body.match(/shouldUseMonsterSprite\(char, this\)\)\s*\{([\s\S]{0,1700}?)\}\s*(?:else|const useSprite)/);
    expect(monsterBranchMatch).not.toBeNull();
    const branch = monsterBranchMatch![1];
    expect(branch).toMatch(/setOrigin\(0\.5,\s*1\)/);
  });

  it('flips based on isPlayer, not unconditionally', () => {
    const body = extractMethod(source, 'renderParty');
    const monsterBranchMatch = body.match(/shouldUseMonsterSprite\(char, this\)\)\s*\{([\s\S]{0,1700}?)\}\s*(?:else|const useSprite)/);
    expect(monsterBranchMatch).not.toBeNull();
    const branch = monsterBranchMatch![1];
    // Bug: a recruited monster fights on the player's (left) side, where
    // monster art's native right-facing orientation is already correct —
    // unconditionally flipping (the old behavior) made it face the wrong
    // way. Enemy-side monsters still need the flip (fixes the original
    // "enemy facing wrong direction" QA bug), so this must be conditional
    // on isPlayer, not a bare setFlipX(true).
    expect(branch).toMatch(/setFlipX\(!isPlayer\)/);
    expect(branch).not.toMatch(/setFlipX\(true\)/);
  });

  it('useSprite is true for the monster real-sprite path in addition to the protagonist/party paths', () => {
    const body = extractMethod(source, 'renderParty');
    const useSpriteMatch = body.match(/const\s+useSprite\s*=\s*([\s\S]{0,300}?);/);
    expect(useSpriteMatch).not.toBeNull();
    const expr = useSpriteMatch![1];
    expect(expr).toMatch(/shouldUseMonsterSprite\(/);
  });

  it('computes animKeys via monsterCharacterAnimKeys for any character with _monsterType, not just non-player enemies', () => {
    const body = extractMethod(source, 'renderParty');
    expect(body).toMatch(/monsterCharacterAnimKeys\(/);
    // Bug: a recruited monster is isPlayer:true but still has _monsterType
    // set (see CharacterFactory.enemyToPlayerCharacter) — the old
    // `!char.isPlayer && char._monsterType` condition excluded it, so it
    // fell through to characterAnimKeys(char.templateId), generating
    // animation keys that don't exist for a monster templateId.
    const animKeysMatch = body.match(/const\s+animKeys\s*=\s*([\s\S]{0,300}?);/);
    expect(animKeysMatch).not.toBeNull();
    expect(animKeysMatch![1]).not.toMatch(/!char\.isPlayer\s*&&\s*char\._monsterType/);
    expect(animKeysMatch![1]).toMatch(/char\._monsterType/);
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
