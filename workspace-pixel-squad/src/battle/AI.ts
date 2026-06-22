import type { Character } from '../types';

export function chooseTarget(characters: Character[]): Character | null {
  const alive = characters.filter(c => c.alive);
  if (alive.length === 0) return null;
  return alive.reduce((lowest, c) => (c.stats.hp < lowest.stats.hp ? c : lowest));
}
