import { SURGE_EVERY, SURGE_LEN, SURGE_T } from './difficulty.ts';
import { coinsForRun } from './economy.ts';
import { medalSeconds } from './medals.ts';

/** A run that ends before Bronze counts as a loss (coin floor, assist). */
export const LOSS_SECONDS = medalSeconds('bronze');
/** A run shorter than this counts toward the assist's zero streak. */
export const ZERO_RUN_SECONDS = 5;
export const ASSIST_SPEED_MUL = 0.85;
export const ASSIST_INTERVAL_MUL = 1.25;

export function nextLossStreak(prev: number, secondsSurvived: number): number {
  return secondsSurvived >= LOSS_SECONDS ? 0 : prev + 1;
}

export interface CoinInput { /** Seconds actually survived (tier-start offset excluded). */ seconds: number; stars: number; lossStreak: number; rankMultiplier: number }
export interface CoinResult { coins: number; base: number; floor: number; multiplier: number; floorApplied: boolean }

export function runCoins(i: CoinInput): CoinResult {
  const base = coinsForRun(i.seconds, i.stars);
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
  run: { seconds: number; bronzeOwned: boolean },
): AssistState {
  if (prev.retired || run.bronzeOwned) return { zeroStreak: 0, noBronzeStreak: 0, active: false, retired: true };
  // "Zero" run: over almost at once (the score era counted 0-point runs, i.e. died before any block passed).
  const zeroStreak = run.seconds < ZERO_RUN_SECONDS ? prev.zeroStreak + 1 : 0;
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
  { id: 'bronze', seconds: medalSeconds('bronze') },
  { id: 'silver', seconds: medalSeconds('silver') },
  { id: 'gold', seconds: medalSeconds('gold') },
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

/** Start time of the i-th rush (0-based): 45 s, 90 s, then a surge every 30 s from 180 s. */
export function rushStartAt(i: number): number {
  return i === 0 ? 45 : i === 1 ? 90 : SURGE_T + SURGE_EVERY * (i - 2);
}

export function rushesBefore(clock: number): number {
  // rushes at 45 s and 90 s (4 s long), none 120..180, then a surge every 30 s from 180 s
  const early = clock < 49 ? 0 : clock < 94 ? 1 : 2;
  const surges = clock < SURGE_T + SURGE_LEN ? 0 : Math.floor((clock - SURGE_T - SURGE_LEN) / SURGE_EVERY) + 1;
  return early + surges;
}
