import type { Character, Skill } from '../types';

export function calcDamage(attacker: Character, defender: Character, skill?: Skill): number {
  const multiplier = skill?.type === 'attack' ? skill.multiplier : 1.0;
  const raw = attacker.stats.atk * multiplier - defender.stats.def * 0.5;
  const base = Math.max(1, Math.floor(raw));
  if (defender.defending) return Math.max(1, Math.ceil(base / 2));
  return base;
}
