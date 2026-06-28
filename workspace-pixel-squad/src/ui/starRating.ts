export const STAR_ANIMATION_DELAY_MS = 200;

export function calculateStarRating(victory: boolean, playerKOs: number, turnsUsed: number): number {
  if (!victory) return 0;
  if (playerKOs > 0) return 1;
  if (turnsUsed > 5) return 2;
  return 3;
}
