import type { Character } from '../types';

export function computeTurnOrder(characters: Character[]): Character[] {
  return [...characters]
    .filter(c => c.alive)
    .sort((a, b) => {
      if (b.stats.spd !== a.stats.spd) return b.stats.spd - a.stats.spd;
      // player-friendly tie-break: player chars act before enemies
      if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
      return 0;
    });
}
