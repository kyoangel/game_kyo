import type { ArchetypeLabel, Character } from '../types';

export const ARCHETYPE_DAMAGE_DEALT_MULT: Record<ArchetypeLabel, number> = {
  '坦克': 1.0,
  '輸出': 1.1,
  '狙擊': 1.0,
  '輔助': 1.0,
  '全能': 1.0,
};

export const ARCHETYPE_DAMAGE_TAKEN_MULT: Record<ArchetypeLabel, number> = {
  '坦克': 0.85,
  '輸出': 1.0,
  '狙擊': 1.0,
  '輔助': 1.0,
  '全能': 1.0,
};

export const SNIPER_CRIT_CHANCE = 0.2;
export const SNIPER_CRIT_MULTIPLIER = 1.5;

export const ARCHETYPE_SUPPORT_POTENCY_MULT: Record<ArchetypeLabel, number> = {
  '坦克': 1.0,
  '輸出': 1.0,
  '狙擊': 1.0,
  '輔助': 1.2,
  '全能': 1.0,
};

export const ALL_ROUNDER_STAT_MULT = 1.05;

/** Rolls whether `attacker`'s next basic attack / attack-skill is a critical hit. Only 狙擊 has nonzero chance. */
export function rollCrit(attacker: Character): boolean {
  if (attacker.archetype !== '狙擊') return false;
  return Math.random() < SNIPER_CRIT_CHANCE;
}
