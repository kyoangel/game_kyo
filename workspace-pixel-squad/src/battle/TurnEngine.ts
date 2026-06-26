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
