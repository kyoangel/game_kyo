import type { Character, Skill } from '../types';

export interface StatDetail {
  current: number;
  max?: number;
  iconKey: string;
}

export interface SkillDetail {
  id: string;
  name: string;
  cooldownRemaining: number;
}

export interface CharacterDetailData {
  name: string;
  archetype: string;
  level: number;
  exp: number;
  expToNext: number;
  expProgressPct: number;
  stats: {
    hp: StatDetail;
    atk: StatDetail;
    def: StatDetail;
    spd: StatDetail;
  };
  skills: SkillDetail[];
}

export function buildCharacterDetailData(char: Character): CharacterDetailData {
  const expProgressPct = char.expToNext > 0 ? char.exp / char.expToNext : 0;

  return {
    name: char.name,
    archetype: char.archetype,
    level: char.level,
    exp: char.exp,
    expToNext: char.expToNext,
    expProgressPct,
    stats: {
      hp:  { current: char.stats.hp,  max: char.stats.maxHp, iconKey: 'icon_hp' },
      atk: { current: char.stats.atk, iconKey: 'icon_atk' },
      def: { current: char.stats.def, iconKey: 'icon_def' },
      spd: { current: char.stats.spd, iconKey: 'icon_spd' },
    },
    skills: char.skills.map((skill: Skill) => ({
      id: skill.id,
      name: skill.name,
      cooldownRemaining: char.skillCooldowns[skill.id] ?? 0,
    })),
  };
}
