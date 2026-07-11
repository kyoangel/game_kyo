// Protagonist LPC per-animation sheets (real-sprite battle animation): each
// is its own 64×64-frame PNG exported from the LPC generator's "ZIP: Split
// by animation", 13 cols × 4 rows (up/left/down/right), except hurt which
// has no direction split (13×1).
export const SPRITE_KEYS = {
  protagonistWalkSheet: 'protagonist_lpc_walk',
  protagonistSlashSheet: 'protagonist_lpc_slash',
  protagonistHurtSheet: 'protagonist_lpc_hurt',
  protagonistIdleSheet: 'protagonist_lpc_idle',
} as const;

export const SPRITE_SHEET_ASSETS = {
  [SPRITE_KEYS.protagonistWalkSheet]: {
    path: 'sprites/party-lpc/protagonist/walk.png',
    frameWidth: 64,
    frameHeight: 64,
  },
  [SPRITE_KEYS.protagonistSlashSheet]: {
    path: 'sprites/party-lpc/protagonist/slash.png',
    frameWidth: 64,
    frameHeight: 64,
  },
  [SPRITE_KEYS.protagonistHurtSheet]: {
    path: 'sprites/party-lpc/protagonist/hurt.png',
    frameWidth: 64,
    frameHeight: 64,
  },
  [SPRITE_KEYS.protagonistIdleSheet]: {
    path: 'sprites/party-lpc/protagonist/idle.png',
    frameWidth: 64,
    frameHeight: 64,
  },
} as const;

// LPC's fixed per-animation row order (up/left/down/right), used with
// lpcRowFrameRange() below to compute Phaser frame ranges for the
// protagonist's per-animation sheets.
export const LPC_DIRECTION_ROW = { up: 0, left: 1, down: 2, right: 3 } as const;

// Computes the Phaser frame-number range for one row of an LPC per-animation
// sheet (13 columns per row by default, matching the LPC generator's
// standard "split by animation" export).
export function lpcRowFrameRange(row: number, frameCount: number, cols = 13): { start: number; end: number } {
  const start = row * cols;
  return { start, end: start + frameCount - 1 };
}

// Phaser animation keys for a real-sprite character (protagonist or any
// party member). Pure/deterministic per id so it can be recomputed anywhere
// without a lookup table.
export interface CharacterAnimKeySet {
  walkRight: string;
  walkLeft: string;
  attackRight: string;
  attackLeft: string;
  death: string;
  idle: string;
}

export function characterAnimKeys(id: string): CharacterAnimKeySet {
  return {
    walkRight: `${id}_walk_right`,
    walkLeft: `${id}_walk_left`,
    attackRight: `${id}_attack_right`,
    attackLeft: `${id}_attack_left`,
    death: `${id}_death`,
    idle: `${id}_idle_gesture`,
  };
}

// The 4 LPC "ZIP: Split by animation" sheets every real-sprite character
// needs (walk/slash/hurt/idle), always 64×64 frames regardless of character.
export const PARTY_LPC_ANIMS = ['walk', 'slash', 'hurt', 'idle'] as const;
export type PartyLpcAnim = typeof PARTY_LPC_ANIMS[number];

export function partyLpcSheetKey(id: string, anim: PartyLpcAnim): string {
  return `party_${id}_lpc_${anim}`;
}

export function partyLpcSheetPath(id: string, anim: PartyLpcAnim): string {
  return `sprites/party-lpc/${id}/${anim}.png`;
}

export interface CharacterAnimDef {
  key: string;
  sheetKey: string;
  start: number;
  end: number;
  frameRate: number;
  repeat: number;
}

// Builds the 6 Phaser animDefs (walkRight/Left, attackRight/Left, death,
// idle) for a real-sprite character, given its anim keys and its 4 LPC
// sheets. Frame counts/rates are the same for every character — walk 9
// frames/direction, slash 6 frames/direction, hurt/death 6 frames flat (no
// direction split), idle 2 frames/direction (breathing loop) — verified
// against the LPC generator's "ZIP: Split by animation" export format.
export function buildCharacterAnimDefs(
  keys: CharacterAnimKeySet,
  sheets: { walk: string; slash: string; hurt: string; idle: string },
): CharacterAnimDef[] {
  return [
    { key: keys.walkRight,   sheetKey: sheets.walk,  ...lpcRowFrameRange(LPC_DIRECTION_ROW.right, 9), frameRate: 12, repeat: -1 },
    { key: keys.walkLeft,    sheetKey: sheets.walk,  ...lpcRowFrameRange(LPC_DIRECTION_ROW.left, 9),  frameRate: 12, repeat: -1 },
    { key: keys.attackRight, sheetKey: sheets.slash, ...lpcRowFrameRange(LPC_DIRECTION_ROW.right, 6), frameRate: 17, repeat: 0  },
    { key: keys.attackLeft,  sheetKey: sheets.slash, ...lpcRowFrameRange(LPC_DIRECTION_ROW.left, 6),  frameRate: 17, repeat: 0  },
    { key: keys.death,       sheetKey: sheets.hurt,  start: 0, end: 5,                                frameRate: 13, repeat: 0  },
    { key: keys.idle,        sheetKey: sheets.idle,  ...lpcRowFrameRange(LPC_DIRECTION_ROW.right, 2), frameRate: 3,  repeat: -1 },
  ];
}

// Monster sprite frames — individual PNGs per animation frame (OGA-BY 3.0, CraftPix.net)
export type MonsterType = 'demon' | 'dragon' | 'jinn' | 'lizard' | 'medusa' | 'small_dragon';

export type MonsterAnimKey = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

function frames(folder: string, prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `sprites/monsters/${folder}/${prefix}${i + 1}.png`);
}

export const MONSTER_FRAMES: Record<MonsterType, Record<MonsterAnimKey, string[]>> = {
  demon: {
    idle:   frames('demon', 'Idle', 3),
    walk:   frames('demon', 'Walk', 6),
    attack: frames('demon', 'Attack', 4),
    hurt:   frames('demon', 'Hurt', 2),
    death:  frames('demon', 'Death', 6),
  },
  dragon: {
    idle:   frames('dragon', 'Idle', 3),
    walk:   frames('dragon', 'Walk', 5),
    attack: frames('dragon', 'Attack', 4),
    hurt:   frames('dragon', 'Hurt', 2),
    death:  frames('dragon', 'Death', 5),
  },
  jinn: {
    idle:   frames('jinn_animation', 'Idle', 3),
    walk:   frames('jinn_animation', 'Flight', 4),
    attack: frames('jinn_animation', 'Attack', 4),
    hurt:   frames('jinn_animation', 'Hurt', 2),
    death:  frames('jinn_animation', 'Death', 6),
  },
  lizard: {
    idle:   frames('lizard', 'Idle', 3),
    walk:   frames('lizard', 'Walk', 6),
    attack: frames('lizard', 'Attack', 5),
    hurt:   frames('lizard', 'Hurt', 2),
    death:  frames('lizard', 'Death', 6),
  },
  medusa: {
    idle:   frames('medusa', 'Idle', 3),
    walk:   frames('medusa', 'Walk', 4),
    attack: frames('medusa', 'Attack', 6),
    hurt:   frames('medusa', 'Hurt', 2),
    death:  frames('medusa', 'Death', 6),
  },
  small_dragon: {
    idle:   frames('small_dragon', 'Idle', 3),
    walk:   frames('small_dragon', 'Walk', 4),
    attack: frames('small_dragon', 'Attack', 3),
    hurt:   frames('small_dragon', 'Hurt', 2),
    death:  frames('small_dragon', 'Death', 4),
  },
};

// Party member sprite keys (one per character id)
export const PARTY_MEMBER_IDS = ['rex', 'nyx', 'vega', 'ash', 'crow', 'mira', 'zora', 'rook', 'dex', 'echo', 'aaaa'] as const;
export type PartyMemberId = typeof PARTY_MEMBER_IDS[number];

export function partySpritKey(id: string): string {
  return `party_${id}`;
}

export function partySpritePath(id: string): string {
  return `sprites/party/${id}.png`;
}

export const MONSTER_ANIM_FPS: Record<MonsterAnimKey, number> = {
  idle:   8,
  walk:   8,
  attack: 10,
  hurt:   10,
  death:  6,
};

export function monsterAnimKey(type: MonsterType, anim: MonsterAnimKey): string {
  return `monster_${type}_${anim}`;
}

// Individual per-frame texture key/path — monster animations are shipped as
// individual PNGs (see frames() above), not a single spritesheet, so each
// frame needs its own Phaser texture key.
export function monsterFrameKey(type: MonsterType, anim: MonsterAnimKey, index: number): string {
  return `monster_${type}_${anim}_frame${index}`;
}

export function monsterFramePath(type: MonsterType, anim: MonsterAnimKey, index: number): string {
  return MONSTER_FRAMES[type][anim][index];
}

// CharacterAnimKeySet for a monster, reusing CharacterAnimator unchanged:
// monster art is a single fixed orientation (no left/right frame variants —
// enemies always sit on the right side facing left via setFlipX(true)), so
// walkRight/walkLeft and attackRight/attackLeft collapse to the same key.
export function monsterCharacterAnimKeys(type: MonsterType): CharacterAnimKeySet {
  return {
    walkRight: monsterAnimKey(type, 'walk'),
    walkLeft: monsterAnimKey(type, 'walk'),
    attackRight: monsterAnimKey(type, 'attack'),
    attackLeft: monsterAnimKey(type, 'attack'),
    death: monsterAnimKey(type, 'death'),
    idle: monsterAnimKey(type, 'idle'),
  };
}

// Phaser animation keys for the protagonist — same shape/generation as any
// party member's (see characterAnimKeys above), just for id 'protagonist'.
export const PROTAGONIST_ANIM_KEYS: CharacterAnimKeySet = characterAnimKeys('protagonist');
