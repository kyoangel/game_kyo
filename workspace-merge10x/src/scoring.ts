export function groupBaseScore(length: 2 | 3 | 4): number {
  if (length === 4) return 50;
  if (length === 3) return 25;
  return 10;
}

export function comboBonus(groupCount: number): number {
  return groupCount > 1 ? (groupCount - 1) * 10 : 0;
}

export function formatScorePopup(amount: number): string {
  return `+${amount}`;
}

export function isNewRecord(score: number, best: number): boolean {
  return score > best;
}
