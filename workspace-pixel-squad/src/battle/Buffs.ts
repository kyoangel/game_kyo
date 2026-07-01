import type { BuffStat, Character, Skill, StatusEffectType, ActiveStatusEffect } from '../types';
import { ALL_ROUNDER_STAT_MULT, ARCHETYPE_SUPPORT_POTENCY_MULT } from './ArchetypeEffects';

function effectiveStat(c: Character, stat: BuffStat, base: number): number {
  const buff = c.activeBuffs.find(b => b.stat === stat);
  const buffed = buff ? Math.floor(base * (1 + buff.amountPct)) : base;
  return c.archetype === '全能' ? buffed * ALL_ROUNDER_STAT_MULT : buffed;
}

function gearBonus(c: Character, stat: 'atk' | 'def' | 'spd'): number {
  return (c.equipment?.weapon?.statBonus[stat] ?? 0) + (c.equipment?.armor?.statBonus[stat] ?? 0);
}

export function effectiveAtk(c: Character): number {
  const base = effectiveStat(c, 'atk', c.stats.atk + gearBonus(c, 'atk'));
  const hasBurn = c.activeStatusEffects?.some(s => s.type === 'burn');
  return hasBurn ? Math.floor(base * 0.70) : base;
}

export function effectiveDef(c: Character): number {
  return effectiveStat(c, 'def', c.stats.def + gearBonus(c, 'def'));
}

export function effectiveSpd(c: Character): number {
  if (c.activeStatusEffects?.some(s => s.type === 'stun')) return 0;
  return effectiveStat(c, 'spd', c.stats.spd + gearBonus(c, 'spd'));
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

export function applyStatusEffect(
  target: Character,
  type: StatusEffectType,
  turns: number,
  sourceSkillId: string,
): void {
  if (!target.activeStatusEffects) target.activeStatusEffects = [];
  const existing = target.activeStatusEffects.findIndex(s => s.type === type);
  const effect: ActiveStatusEffect = { type, turnsRemaining: turns, sourceSkillId };
  if (existing >= 0) {
    target.activeStatusEffects[existing] = effect;
  } else {
    target.activeStatusEffects.push(effect);
  }
}

export interface StatusTickEvent {
  character: Character;
  type: StatusEffectType;
  damage?: number;
}

export function tickStatusEffects(party: Character[]): StatusTickEvent[] {
  const events: StatusTickEvent[] = [];
  party.forEach(c => {
    if (!c.alive) return;
    if (!c.activeStatusEffects) { c.activeStatusEffects = []; return; }
    const poison = c.activeStatusEffects.find(s => s.type === 'poison');
    if (poison) {
      const dmg = Math.max(1, Math.floor(c.stats.maxHp * 0.08));
      c.stats.hp = Math.max(0, c.stats.hp - dmg);
      if (c.stats.hp === 0) c.alive = false;
      events.push({ character: c, type: 'poison', damage: dmg });
    }
    c.activeStatusEffects.forEach(s => { s.turnsRemaining--; });
    c.activeStatusEffects = c.activeStatusEffects.filter(s => s.turnsRemaining > 0);
  });
  return events;
}
