import type { BuffStat, Character, Skill } from '../types';
import { ALL_ROUNDER_STAT_MULT, ARCHETYPE_SUPPORT_POTENCY_MULT } from './ArchetypeEffects';

function effectiveStat(c: Character, stat: BuffStat, base: number): number {
  const buff = c.activeBuffs.find(b => b.stat === stat);
  const buffed = buff ? base * (1 + buff.amountPct) : base;
  return c.archetype === '全能' ? buffed * ALL_ROUNDER_STAT_MULT : buffed;
}

export function effectiveAtk(c: Character): number {
  return effectiveStat(c, 'atk', c.stats.atk);
}

export function effectiveDef(c: Character): number {
  return effectiveStat(c, 'def', c.stats.def);
}

export function effectiveSpd(c: Character): number {
  return effectiveStat(c, 'spd', c.stats.spd);
}

export function applyBuff(target: Character, skill: Skill, caster?: Character): void {
  if (!skill.buffStat || skill.buffAmountPct === undefined || skill.buffDuration === undefined) return;
  const potency = caster ? ARCHETYPE_SUPPORT_POTENCY_MULT[caster.archetype] : 1.0;
  const existingIndex = target.activeBuffs.findIndex(b => b.stat === skill.buffStat);
  const newBuff = {
    stat: skill.buffStat,
    amountPct: skill.buffAmountPct * potency,
    turnsRemaining: skill.buffDuration,
    sourceSkillId: skill.id,
  };
  if (existingIndex >= 0) {
    target.activeBuffs[existingIndex] = newBuff;
  } else {
    target.activeBuffs.push(newBuff);
  }
}

export function tickBuffs(party: Character[]): void {
  party.forEach(c => {
    c.activeBuffs.forEach(b => { b.turnsRemaining--; });
    c.activeBuffs = c.activeBuffs.filter(b => b.turnsRemaining > 0);
  });
}
