/** '#4ade80' green >15 days, '#fbbf24' yellow 6-15 days, '#ef4444' red <=5 days. */
export function getDoomsdayColor(daysRemaining: number): string {
  if (daysRemaining <= 5) return '#ef4444';
  if (daysRemaining <= 15) return '#fbbf24';
  return '#4ade80';
}

export function formatDoomsdayLabel(daysRemaining: number): string {
  return `⏳ 剩餘 ${daysRemaining} 天`;
}
