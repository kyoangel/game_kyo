import type { Character } from '../types';

const NAMED_CHARACTER_IDS = new Set(['vega', 'crow', 'zora', 'dex', 'aaaa']);

export function isNamedCharacter(templateId: string): boolean {
  return NAMED_CHARACTER_IDS.has(templateId);
}

export function canAttemptRecruit(enemy: Character): boolean {
  return enemy.alive && (enemy.stats.hp / enemy.stats.maxHp) < 0.5;
}

export function recruitChance(enemy: Character, isNamed: boolean): number {
  const hpRatio = enemy.stats.hp / enemy.stats.maxHp;
  const base = Math.floor((1 - 2 * hpRatio) * 100);
  return isNamed ? Math.floor(base / 2) : base;
}

export function attemptRecruit(chance: number): boolean {
  return Math.random() * 100 < chance;
}
