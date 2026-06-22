import type { Character } from '../types';

export type EnemyAIType = 'random' | 'lowest-hp' | 'highest-atk';

export function chooseTarget(
  characters: Character[],
  aiType: EnemyAIType = 'random',
): Character | null {
  const alive = characters.filter(c => c.alive);
  if (alive.length === 0) return null;

  if (aiType === 'lowest-hp') {
    return alive.reduce((lowest, c) => (c.stats.hp < lowest.stats.hp ? c : lowest));
  }
  if (aiType === 'highest-atk') {
    return alive.reduce((highest, c) => (c.stats.atk > highest.stats.atk ? c : highest));
  }
  return alive[Math.floor(Math.random() * alive.length)];
}
