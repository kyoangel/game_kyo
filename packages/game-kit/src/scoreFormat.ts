/** How a game's run result is measured: points (default) or survival time in whole seconds. */
export type ScoreFormat = 'points' | 'time';

export function formatScore(value: number, format: ScoreFormat | undefined): string {
  const n = Math.max(0, format === 'time' ? Math.floor(value) : Math.round(value));
  if (format !== 'time') return String(n);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/** Storage key of the best result. Time bests get their own key so an old points best is never read as seconds. */
export function bestKeyFor(slug: string, format: ScoreFormat | undefined): string {
  return format === 'time' ? `${slug}:bestTime` : `${slug}:best`;
}
