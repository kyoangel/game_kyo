export const STAR_ANIMATION_DELAY_MS = 200;

export function calculateStarRating(
  victory: boolean,
  playerKOs: number,
  roundsUsed: number,
  weaknessHitCount: number,
): number {
  if (!victory) return 0;
  if (playerKOs > 0) return 1;
  if (roundsUsed > 5 || weaknessHitCount === 0) return 2;
  return 3;
}
