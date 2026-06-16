export function formatScorePopup(scoreGained: number): string {
  return `+${scoreGained}`;
}

export function isNewRecord(score: number, bestScore: number): boolean {
  return score === bestScore && score > 0;
}
