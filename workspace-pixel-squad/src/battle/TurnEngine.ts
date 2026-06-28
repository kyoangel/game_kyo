import type { Character } from '../types';
import { effectiveSpd } from './Buffs';

export function computeTurnOrder(characters: Character[]): Character[] {
  return [...characters]
    .filter(c => c.alive)
    .sort((a, b) => {
      const spdDiff = effectiveSpd(b) - effectiveSpd(a);
      if (spdDiff !== 0) return spdDiff;
      // player-friendly tie-break: player chars act before enemies
      if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
      return 0;
    });
}

/** Inserts character at the front of the remaining turn queue for this round. */
export function insertBonusAction(character: Character, remaining: Character[]): void {
  remaining.unshift(character);
}

/**
 * Checks whether a weakness hit should grant a bonus action and applies it.
 * Mutates attacker.bonusActionUsed and the remaining queue.
 */
export function applyWeaknessBonus(
  attacker: Character,
  defenderHpAfterHit: number,
  isWeaknessHit: boolean,
  remaining: Character[],
): void {
  if (!isWeaknessHit) return;
  if ((attacker as any).bonusActionUsed) return;
  if (defenderHpAfterHit <= 0) return;

  (attacker as any).bonusActionUsed = true;
  insertBonusAction(attacker, remaining);
}

/** Resets knockedDown and bonusActionUsed on all characters at the start of a new round. */
export function resetRoundFlags(characters: Character[]): void {
  for (const c of characters) {
    (c as any).bonusActionUsed = false;
    (c as any).knockedDown = false;
  }
}
