import type { Character } from '../types';

export interface LevelUpConfig {
  protagonist: { pointsPerLevel: number };
  nonProtagonist: { pointsPerLevel: number };
  expFormula: (level: number) => number;
}

export const DEFAULT_LEVEL_UP_CONFIG: LevelUpConfig = {
  protagonist: { pointsPerLevel: 5 },
  nonProtagonist: { pointsPerLevel: 5 },
  expFormula: (level) => level * 50,
};

export function canLevelUp(
  character: Character,
  expPool: number,
  config: LevelUpConfig,
): boolean {
  return expPool >= config.expFormula(character.level);
}

export function applyLevelUp(
  character: Character,
  expPool: number,
  config: LevelUpConfig,
): { character: Character; expPool: number } {
  const cost = config.expFormula(character.level);
  if (expPool < cost) return { character, expPool };

  const newLevel = character.level + 1;
  const newExpPool = expPool - cost;
  const newExpToNext = config.expFormula(newLevel);

  if (character.isProtagonist) {
    return {
      character: {
        ...character,
        level: newLevel,
        expToNext: newExpToNext,
        statPoints: character.statPoints + config.protagonist.pointsPerLevel,
      },
      expPool: newExpPool,
    };
  }

  const statKeys: Array<'hp' | 'atk' | 'def' | 'spd'> = ['hp', 'atk', 'def', 'spd'];
  const gains: Record<'hp' | 'atk' | 'def' | 'spd', number> = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (let i = 0; i < config.nonProtagonist.pointsPerLevel; i++) {
    gains[statKeys[Math.floor(Math.random() * statKeys.length)]]++;
  }

  return {
    character: {
      ...character,
      level: newLevel,
      expToNext: newExpToNext,
      stats: {
        hp: character.stats.maxHp + gains.hp,
        maxHp: character.stats.maxHp + gains.hp,
        atk: character.stats.atk + gains.atk,
        def: character.stats.def + gains.def,
        spd: character.stats.spd + gains.spd,
      },
    },
    expPool: newExpPool,
  };
}
