import { coinsForRun } from './economy.ts';

export const LOSS_SECONDS = 30;
export const ASSIST_SPEED_MUL = 0.85;
export const ASSIST_INTERVAL_MUL = 1.25;

export function nextLossStreak(prev: number, secondsSurvived: number): number {
  return secondsSurvived >= LOSS_SECONDS ? 0 : prev + 1;
}

export interface CoinInput { score: number; headStart: number; stars: number; lossStreak: number; rankMultiplier: number }
export interface CoinResult { coins: number; base: number; floor: number; multiplier: number; floorApplied: boolean }

export function runCoins(i: CoinInput): CoinResult {
  const earned = Math.max(0, i.score - i.headStart);
  const base = coinsForRun(earned, i.stars);
  const floor = Math.min(10, 2 * i.lossStreak);
  const multiplier = Math.round(i.rankMultiplier * 100) / 100;
  const coins = Math.round(Math.max(base, floor) * multiplier);
  return { coins, base, floor, multiplier, floorApplied: floor > base };
}

export interface AssistState { zeroStreak: number; noBronzeStreak: number; active: boolean; retired: boolean }
export const DEFAULT_ASSIST: AssistState = { zeroStreak: 0, noBronzeStreak: 0, active: false, retired: false };

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function sanitizeAssist(raw: unknown): AssistState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...DEFAULT_ASSIST };
  const r = raw as Record<string, unknown>;
  return {
    zeroStreak: count(r.zeroStreak),
    noBronzeStreak: count(r.noBronzeStreak),
    active: r.active === true,
    retired: r.retired === true,
  };
}

export function updateAssist(
  prev: AssistState,
  run: { score: number; seconds: number; bronzeOwned: boolean },
): AssistState {
  if (prev.retired || run.bronzeOwned) return { zeroStreak: 0, noBronzeStreak: 0, active: false, retired: true };
  const zeroStreak = run.score === 0 ? prev.zeroStreak + 1 : 0;
  const noBronzeStreak = run.seconds < LOSS_SECONDS ? prev.noBronzeStreak + 1 : 0;
  return {
    zeroStreak,
    noBronzeStreak,
    active: prev.active || zeroStreak >= 2 || noBronzeStreak >= 3,
    retired: false,
  };
}

export type StartTier = 'none' | 'bronze' | 'silver' | 'gold';
export const START_TIERS: readonly { id: StartTier; seconds: number }[] = [
  { id: 'none', seconds: 0 },
  { id: 'bronze', seconds: 30 },
  { id: 'silver', seconds: 60 },
  { id: 'gold', seconds: 90 },
];

export function tierSeconds(t: StartTier): number {
  return START_TIERS.find((x) => x.id === t)?.seconds ?? 0;
}

export function availableTiers(medals: readonly string[]): StartTier[] {
  return START_TIERS.filter((t) => t.id === 'none' || medals.includes(t.id)).map((t) => t.id);
}

export function sanitizeStartTier(raw: unknown, medals: readonly string[]): StartTier {
  return availableTiers(medals).find((t) => t === raw) ?? 'none';
}

export function advanceStartTier(current: StartTier, runMedals: readonly string[]): StartTier {
  let best: StartTier = 'none';
  for (const t of START_TIERS) if (runMedals.includes(t.id) && t.seconds > tierSeconds(best)) best = t.id;
  return tierSeconds(best) > tierSeconds(current) ? best : current;
}

export const HEAD_START_SCORE: Record<'bronze' | 'silver' | 'gold', number> = { bronze: 44, silver: 149, gold: 342 };

export function headStartScore(t: StartTier): number {
  return t === 'none' ? 0 : HEAD_START_SCORE[t];
}

export function rushesBefore(clock: number): number {
  // rushes exist only at 45 s and 90 s (none from OVERDRIVE_T)
  return clock < 49 ? 0 : clock < 94 ? 1 : 2;
}
