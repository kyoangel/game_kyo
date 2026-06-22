import type { Character } from '../types';
import { expToNextLevel } from './CharacterFactory';

export const STAT_POINTS_PER_LEVEL = 3;

const AUTO_GROWTH = { hp: 8, maxHp: 8, atk: 3, def: 2, spd: 1 };

export function applyExp(character: Character, exp: number): Character {
  let c: Character = { ...character, stats: { ...character.stats }, exp: character.exp + exp };

  while (c.exp >= c.expToNext) {
    c.exp -= c.expToNext;
    c.level += 1;
    c.expToNext = expToNextLevel(c.level);

    if (c.isProtagonist) {
      c.statPoints += STAT_POINTS_PER_LEVEL;
    } else {
      c.stats = {
        hp: c.stats.hp + AUTO_GROWTH.hp,
        maxHp: c.stats.maxHp + AUTO_GROWTH.maxHp,
        atk: c.stats.atk + AUTO_GROWTH.atk,
        def: c.stats.def + AUTO_GROWTH.def,
        spd: c.stats.spd + AUTO_GROWTH.spd,
      };
    }
  }

  return c;
}

export function allocateStat(
  character: Character,
  stat: 'hp' | 'atk' | 'def' | 'spd',
): Character {
  if (character.statPoints <= 0) return character;
  const inc = stat === 'hp' ? 10 : 2;
  const stats = { ...character.stats, [stat]: character.stats[stat] + inc };
  if (stat === 'hp') stats.maxHp = character.stats.maxHp + inc;
  return { ...character, stats, statPoints: character.statPoints - 1 };
}
