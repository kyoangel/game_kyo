import { SKINS } from './economy.ts';

/** Seconds as m:ss (67 -> "1:07"). */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** Owned-skin ids from storage: known ids only, unique, always includes 'cyan' first. */
export function sanitizeOwned(saved: unknown): string[] {
  const set = new Set<string>(['cyan']);
  if (Array.isArray(saved)) for (const v of saved) if (typeof v === 'string' && SKINS.some((s) => s.id === v)) set.add(v);
  return SKINS.filter((s) => set.has(s.id)).map((s) => s.id);
}
