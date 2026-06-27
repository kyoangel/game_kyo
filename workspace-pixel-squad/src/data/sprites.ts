// Character spritesheet: 320×320, 10 cols × 10 rows, 32×32 per frame (LPC layout)
// Row 0: Walk Up, Row 1: Walk Left, Row 2: Walk Down, Row 3: Walk Right (9 frames each)
// Row 4: Attack Up, Row 5: Attack Left, Row 6: Attack Down, Row 7: Attack Right (6 frames each)
// Row 8: Death (6 frames), Row 9: Idle/Gesture
export const SPRITE_KEYS = {
  protagonistIdle: 'protagonist_idle',
  protagonistSheet: 'protagonist_sheet',
} as const;

export const SPRITE_SHEET_ASSETS = {
  [SPRITE_KEYS.protagonistSheet]: {
    path: 'sprites/character_rogue.png',
    frameWidth: 32,
    frameHeight: 32,
  },
} as const;

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

export const SPRITE_ASSETS: Record<string, string> = {
  [SPRITE_KEYS.protagonistIdle]: 'sprites/character_rogue.png',
  [SPRITE_KEYS.protagonistSheet]: 'sprites/character_rogue.png',
};
