import { MEDALS, type MedalId } from './medals.ts';

export type Goal =
  | { kind: 'medal'; id: MedalId; targetSec: number; fromSec: number; frac: number; remainingSec: number }
  | { kind: 'best'; percent: number; frac: number; best: number }
  | { kind: 'none' };

/** Next visible goal. `seconds` uses the same clock as `medalsReached` (PlayScene `this.t`). */
export function nextGoal(seconds: number, score: number, best: number): Goal {
  const t = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const i = MEDALS.findIndex((m) => m.seconds > t);
  if (i >= 0) {
    const targetSec = MEDALS[i].seconds;
    const fromSec = i === 0 ? 0 : MEDALS[i - 1].seconds;
    const frac = Math.min(1, Math.max(0, (t - fromSec) / (targetSec - fromSec)));
    return { kind: 'medal', id: MEDALS[i].id, targetSec, fromSec, frac, remainingSec: Math.ceil(targetSec - t) };
  }
  if (!(best > 0)) return { kind: 'none' };
  const s = Number.isFinite(score) && score > 0 ? score : 0;
  const frac = Math.min(1, s / best);
  return { kind: 'best', percent: Math.floor(frac * 100), frac, best };
}
