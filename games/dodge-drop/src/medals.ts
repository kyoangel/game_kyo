export type MedalId = 'bronze' | 'silver' | 'gold' | 'neon';

export const MEDALS: readonly { id: MedalId; seconds: number; color: number }[] = [
  { id: 'bronze', seconds: 30, color: 0xd08a4a },
  { id: 'silver', seconds: 60, color: 0xd8e0ff },
  { id: 'gold', seconds: 90, color: 0xffe14d },
  { id: 'neon', seconds: 120, color: 0x3ff0ff },
];

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
