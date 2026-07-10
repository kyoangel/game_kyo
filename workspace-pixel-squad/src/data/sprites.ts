// Character spritesheet: 320×320, 10 cols × 10 rows, 32×32 per frame (LPC layout)
// Row 0: Walk Up, Row 1: Walk Left, Row 2: Walk Down, Row 3: Walk Right (9 frames each)
// Row 4: Attack Up, Row 5: Attack Left, Row 6: Attack Down, Row 7: Attack Right (6 frames each)
// Row 8: Death (6 frames), Row 9: Idle/Gesture
export const SPRITE_KEYS = {
  protagonistIdle: 'protagonist_idle',
  protagonistSheet: 'protagonist_sheet',
  // Protagonist LPC per-animation sheets (pilot for real-sprite party
  // animation): each is its own 64×64-frame PNG exported from the LPC
  // generator's "ZIP: Split by animation", 13 cols × 4 rows (up/left/down/
  // right), except hurt which has no direction split (13×1).
  protagonistWalkSheet: 'protagonist_lpc_walk',
  protagonistSlashSheet: 'protagonist_lpc_slash',
  protagonistHurtSheet: 'protagonist_lpc_hurt',
  protagonistIdleSheet: 'protagonist_lpc_idle',
} as const;

export const SPRITE_SHEET_ASSETS = {
  [SPRITE_KEYS.protagonistSheet]: {
    path: 'sprites/character_rogue.png',
    frameWidth: 32,
    frameHeight: 32,
  },
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

// protagonistIdle/protagonistSheet + character_rogue.png are no longer
// loaded by BattleScene (superseded by the LPC per-animation sheets below),
// kept only so existing references/tests to the old asset don't break.
export const SPRITE_ASSETS: Record<string, string> = {
  [SPRITE_KEYS.protagonistIdle]: 'sprites/character_rogue.png',
  [SPRITE_KEYS.protagonistSheet]: 'sprites/character_rogue.png',
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

export function monsterIdleKey(type: MonsterType): string {
  return `monster_idle_${type}`;
}

export function monsterIdlePath(type: MonsterType): string {
  return MONSTER_FRAMES[type].idle[0];
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

// Phaser animation keys for the protagonist. Frame sources now live in
// BattleScene.ts's animDefs, computed via lpcRowFrameRange/LPC_DIRECTION_ROW
// against the 4 per-animation sheets above (walk 9f/dir, attack 6f/dir,
// death 6f single-row, idle 2f/dir) — see that block for the source of truth.
export const PROTAGONIST_ANIM_KEYS = {
  walkRight:   'protagonist_walk_right',
  walkLeft:    'protagonist_walk_left',
  attackRight: 'protagonist_attack_right',
  attackLeft:  'protagonist_attack_left',
  death:       'protagonist_death',
  idle:        'protagonist_idle_gesture',
} as const;
