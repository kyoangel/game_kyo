import type { BuffStat, Character, Skill } from '../types';
import { effectiveAtk, effectiveDef, effectiveSpd } from './Buffs';

export interface SkillDecision {
  skill?: Skill;          // undefined => basic attack
  target: Character;
}

function effectiveByStat(c: Character, stat: BuffStat): number {
  if (stat === 'atk') return effectiveAtk(c);
  if (stat === 'def') return effectiveDef(c);
  return effectiveSpd(c);
}

export function decideAction(actor: Character, allies: Character[], enemies: Character[]): SkillDecision {
  const aliveAllies = allies.filter(c => c.alive);
  const aliveEnemies = enemies.filter(c => c.alive);

  const healSkill = actor.skills.find(s => s.type === 'heal');
  if (healSkill && aliveAllies.length > 0) {
    const lowest = aliveAllies.reduce((l, c) =>
      c.stats.hp / c.stats.maxHp < l.stats.hp / l.stats.maxHp ? c : l
    );
    if (lowest.stats.hp / lowest.stats.maxHp < 0.5) {
      return { skill: healSkill, target: lowest };
    }
  }

  const buffSkill = actor.skills.find(s => s.type === 'buff');
  if (buffSkill && buffSkill.buffStat) {
    const target = buffSkill.target === 'self'
      ? actor
      : aliveAllies.reduce((l, c) =>
        effectiveByStat(c, buffSkill.buffStat!) < effectiveByStat(l, buffSkill.buffStat!) ? c : l
      );
    const alreadyBuffed = target.activeBuffs.some(b => b.stat === buffSkill.buffStat);
    if (!alreadyBuffed) {
      return { skill: buffSkill, target };
    }
  }

  const attackSkills = actor.skills.filter(s => s.type === 'attack');
  if (attackSkills.length > 0 && Math.random() < 0.5 && aliveEnemies.length > 0) {
    const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
    const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    return { skill, target };
  }

  const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
  return { target };
}
