import type { Character } from '../types';

export interface AoaRoundState {
  usedThisRound: boolean;
}

/** Returns false for bosses (immune to knockdown), true for all other enemy types. */
export function canKnockDown(enemy: Character): boolean {
  return (enemy._monsterType as string | undefined) !== 'boss';
}

/**
 * Returns true only when at least one alive enemy exists AND every alive enemy
 * is knocked down. Bosses naturally block this because they can never be knocked down.
 */
export function allEnemiesKnockedDown(enemies: Character[]): boolean {
  const alive = enemies.filter(e => e.alive);
  if (alive.length === 0) return false;
  return alive.every(e => e.knockedDown === true);
}

/**
 * Returns true when all alive enemies are knocked down and AOA has not been
 * used or declined this round.
 */
export function shouldTriggerAoa(enemies: Character[], aoaState: AoaRoundState): boolean {
  if (aoaState.usedThisRound) return false;
  return allEnemiesKnockedDown(enemies);
}

/** AOA damage per member per target: floor(atk × 0.5), minimum 1. */
export function calcAoaDamage(atk: number): number {
  return Math.max(1, Math.floor(atk * 0.5));
}

/**
 * Applies All-Out Attack: each alive member deals calcAoaDamage(atk) to each
 * alive enemy simultaneously. Does NOT set alive=false — death check is the
 * caller's responsibility after all damage is resolved.
 */
export function applyAllOutAttack(members: Character[], enemies: Character[]): void {
  const aliveMembers = members.filter(m => m.alive);
  const aliveEnemies = enemies.filter(e => e.alive);
  for (const enemy of aliveEnemies) {
    for (const member of aliveMembers) {
      enemy.stats.hp -= calcAoaDamage(member.stats.atk);
    }
  }
}

/** Resets AOA round state at the start of each command phase. Mutates in place. */
export function resetAoaRoundState(aoaState: AoaRoundState): void {
  aoaState.usedThisRound = false;
}
