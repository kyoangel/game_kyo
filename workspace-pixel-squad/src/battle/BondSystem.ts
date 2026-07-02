import type { Character } from '../types';
import { calcDamage } from './DamageCalc';

export const BOND_GAIN_PER_BATTLE = 4;
const SUPPORT_DAMAGE_MULTIPLIER = 0.6;

const BOND_TIERS: Array<{ min: number; chance: number }> = [
  { min: 80, chance: 0.5 },
  { min: 50, chance: 0.3 },
  { min: 20, chance: 0.15 },
  { min: 0, chance: 0 },
];

export function bondKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('_');
}

export function getBond(bondLevels: Record<string, number> | undefined, idA: string, idB: string): number {
  if (!bondLevels) return 0;
  return bondLevels[bondKey(idA, idB)] ?? 0;
}

export function supportChance(bond: number): number {
  return (BOND_TIERS.find(t => bond >= t.min) ?? BOND_TIERS[BOND_TIERS.length - 1]).chance;
}

/** Adds BOND_GAIN_PER_BATTLE to every unique pair of alive characters in `party`. Returns a new record; never mutates the input. */
export function applyBondGains(
  bondLevels: Record<string, number> | undefined,
  party: Character[],
): Record<string, number> {
  const result = { ...(bondLevels ?? {}) };
  const survivors = party.filter(c => c.alive);
  for (let i = 0; i < survivors.length; i++) {
    for (let j = i + 1; j < survivors.length; j++) {
      const key = bondKey(survivors[i].templateId, survivors[j].templateId);
      result[key] = (result[key] ?? 0) + BOND_GAIN_PER_BATTLE;
    }
  }
  return result;
}

/** Highest-bond alive candidate for `attacker`, excluding itself and anyone with supportUsedThisRound. Ties -> first in `squad` order. */
export function pickSupporter(
  attacker: Character,
  squad: Character[],
  bondLevels: Record<string, number> | undefined,
): Character | undefined {
  let best: Character | undefined;
  let bestBond = -1;
  for (const candidate of squad) {
    if (candidate.id === attacker.id || !candidate.alive || candidate.supportUsedThisRound) continue;
    const bond = getBond(bondLevels, attacker.templateId, candidate.templateId);
    if (bond > bestBond) { bestBond = bond; best = candidate; }
  }
  return best;
}

export function rollSupportAttack(bond: number): boolean {
  return Math.random() < supportChance(bond);
}

/** floor(calcDamage(supporter, defender).damage * 0.6), minimum 1. No crit, no weakness bonus, no status. */
export function calcSupportDamage(supporter: Character, defender: Character): number {
  return Math.max(1, Math.floor(calcDamage(supporter, defender).damage * SUPPORT_DAMAGE_MULTIPLIER));
}

/** Resets supportUsedThisRound on all given characters. Call once per command phase. */
export function resetSupportRoundFlags(characters: Character[]): void {
  for (const c of characters) c.supportUsedThisRound = false;
}
