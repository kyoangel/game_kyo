export type MedalId = 'bronze' | 'silver' | 'gold' | 'neon' | 'diamond' | 'legend';

/** Survival-time medals. Owner decision 2026-11-25: Bronze 15 s, Silver 30 s, Gold at one minute. */
export const MEDALS: readonly { id: MedalId; seconds: number; color: number }[] = [
  { id: 'bronze', seconds: 15, color: 0xd08a4a },
  { id: 'silver', seconds: 30, color: 0xd8e0ff },
  { id: 'gold', seconds: 60, color: 0xffe14d },
  { id: 'neon', seconds: 120, color: 0x3ff0ff },
  { id: 'diamond', seconds: 180, color: 0xc8f4ff },
  { id: 'legend', seconds: 240, color: 0xff7ad9 },
];

/** Seconds needed for a medal. */
export function medalSeconds(id: MedalId): number {
  return MEDALS.find((m) => m.id === id)!.seconds;
}

/** Medals newly crossed between two survival times. */
export function medalsReached(prevSeconds: number, nowSeconds: number): MedalId[] {
  return MEDALS.filter((m) => prevSeconds < m.seconds && nowSeconds >= m.seconds).map((m) => m.id);
}

/** Sanitize saved data, merge with earned, unique, in MEDALS order. */
export function mergeMedals(saved: unknown, earned: MedalId[]): MedalId[] {
  const set = new Set<string>(earned);
  if (Array.isArray(saved)) for (const v of saved) if (typeof v === 'string') set.add(v);
  return MEDALS.filter((m) => set.has(m.id)).map((m) => m.id);
}
