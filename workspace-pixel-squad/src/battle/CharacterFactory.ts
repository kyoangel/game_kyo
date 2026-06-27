import type { Character, CharacterTemplate, EnemyTemplate } from '../types';
import { SKILLS } from '../data/skills';
import { computeArchetype } from './Archetype';

let _instanceCounter = 0;
function nextId(templateId: string): string {
  return `${templateId}_${++_instanceCounter}`;
}

export function createCharacter(template: CharacterTemplate, level: number): Character {
  const s = { ...template.baseStats };
  if (!template.isProtagonist && level > 1) {
    for (let l = 1; l < level; l++) {
      s.hp += template.statGrowth.hp;
      s.atk += template.statGrowth.atk;
      s.def += template.statGrowth.def;
      s.spd += template.statGrowth.spd;
    }
  }
  return {
    id: nextId(template.id),
    templateId: template.id,
    name: template.name,
    isProtagonist: template.isProtagonist,
    isPlayer: true,
    level,
    exp: 0,
    expToNext: expToNextLevel(level),
    stats: { hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd },
    skills: template.skillIds.map(id => SKILLS[id]).filter(Boolean),
    statPoints: 0,
    archetype: computeArchetype(s),
    alive: true,
    defending: false,
    activeBuffs: [],
  };
}

export function createEnemy(template: EnemyTemplate, statMultiplier = 1): Character {
  const s = {
    ...template.baseStats,
    hp: Math.round(template.baseStats.hp * statMultiplier),
    atk: Math.round(template.baseStats.atk * statMultiplier),
    def: Math.round(template.baseStats.def * statMultiplier),
  };
  return {
    id: nextId(template.id),
    templateId: template.id,
    name: template.name,
    isProtagonist: false,
    isPlayer: false,
    level: 1,
    exp: 0,
    expToNext: expToNextLevel(1),
    stats: { hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd },
    skills: template.skillIds.map(id => SKILLS[id]).filter(Boolean),
    statPoints: 0,
    archetype: computeArchetype(s),
    alive: true,
    defending: false,
    activeBuffs: [],
  };
}

export function expToNextLevel(level: number): number {
  return level * 50;
}
