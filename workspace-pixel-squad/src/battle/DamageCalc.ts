import type { Character, Skill } from '../types';
import { effectiveAtk, effectiveDef } from './Buffs';
import {
  ARCHETYPE_DAMAGE_DEALT_MULT,
  ARCHETYPE_DAMAGE_TAKEN_MULT,
  ARCHETYPE_SUPPORT_POTENCY_MULT,
  SNIPER_CRIT_MULTIPLIER,
} from './ArchetypeEffects';

export interface DamageResult {
  damage: number;
  isWeaknessHit: boolean;
  isCrit: boolean;
}

export function calcDamage(attacker: Character, defender: Character, skill?: Skill, isCrit = false): DamageResult {
  const multiplier = skill?.type === 'attack' ? skill.multiplier : 1.0;
  let raw = effectiveAtk(attacker) * multiplier - effectiveDef(defender) * 0.5;
  raw *= ARCHETYPE_DAMAGE_DEALT_MULT[attacker.archetype];
  raw *= ARCHETYPE_DAMAGE_TAKEN_MULT[defender.archetype];
  if (isCrit) raw *= SNIPER_CRIT_MULTIPLIER;
  let base = Math.max(1, Math.floor(raw));
  if (defender.defending) base = Math.max(1, Math.ceil(base / 2));

  const isWeaknessHit = !!(skill?.element) && !!((defender as any).weakness) && skill.element === (defender as any).weakness;
  if (isWeaknessHit) base = Math.floor(base * 1.5);

  return { damage: base, isWeaknessHit, isCrit };
}

export function calcHeal(caster: Character, skill: Skill): number {
  const potency = ARCHETYPE_SUPPORT_POTENCY_MULT[caster.archetype];
  return Math.max(1, Math.floor(effectiveAtk(caster) * skill.multiplier * potency));
}
