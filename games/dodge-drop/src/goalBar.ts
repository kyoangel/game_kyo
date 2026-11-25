import { MEDALS, type MedalId } from './medals.ts';

export type Goal =
  | { kind: 'medal'; id: MedalId; targetSec: number; fromSec: number; frac: number; remainingSec: number }
  | { kind: 'best'; percent: number; frac: number; /** Best time in seconds. */ best: number }
  | { kind: 'none' };

/**
 * Next visible goal. `seconds` uses the same clock as `medalsReached` (PlayScene `this.t`); past the top medal the bar
 * tracks the best time (`bestSeconds`, same clock).
 */
export function nextGoal(seconds: number, bestSeconds: number): Goal {
  const t = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const i = MEDALS.findIndex((m) => m.seconds > t);
  if (i >= 0) {
    const targetSec = MEDALS[i].seconds;
    const fromSec = i === 0 ? 0 : MEDALS[i - 1].seconds;
    const frac = Math.min(1, Math.max(0, (t - fromSec) / (targetSec - fromSec)));
    return { kind: 'medal', id: MEDALS[i].id, targetSec, fromSec, frac, remainingSec: Math.ceil(targetSec - t) };
  }
  if (!(bestSeconds > 0)) return { kind: 'none' };
  const frac = Math.min(1, t / bestSeconds);
  return { kind: 'best', percent: Math.floor(frac * 100), frac, best: bestSeconds };
}
