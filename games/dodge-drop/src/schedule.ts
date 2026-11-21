import { firstDeadEnd, type Scheduled } from './fairness.ts';
import { planWave, waveKindAt, type WaveKind } from './waves.ts';

export type { Scheduled };

const START = 0.4;
/** Waves are planned this far beyond `untilT`; those spawns stay removable until emitted. */
const LOOKAHEAD = 5;
/** Validation window: history simulated before the first new spawn, and after the last. */
const LOOKBACK = 8;
const LOOKFORWARD = 8;

interface Entry extends Scheduled {
  wall: boolean;
}

export class SpawnScheduler {
  private planEnd = START;
  private fillerNext = false;
  private gapX: number | undefined;
  private committed: Scheduled[] = [];
  private buffer: Entry[] = [];

  private readonly rng: () => number;
  private readonly width: number;
  private readonly validate: boolean;

  constructor(rng: () => number, width: number, validate = true) {
    this.rng = rng;
    this.width = width;
    this.validate = validate;
  }

  /**
   * Plans waves until `planEnd >= untilT + LOOKAHEAD` and returns the spawns with `at < untilT`.
   * Spawns after untilT stay in an internal buffer where a later wave's validation may drop them.
   */
  planUntil(untilT: number): Scheduled[] {
    while (this.planEnd < untilT + LOOKAHEAD) this.planOne();
    const out: Scheduled[] = [];
    const keep: Entry[] = [];
    for (const e of this.buffer) {
      if (e.at < untilT) out.push({ at: e.at, x: e.x, w: e.w, h: e.h, speedMul: e.speedMul });
      else keep.push(e);
    }
    this.buffer = keep;
    out.sort((a, b) => a.at - b.at);
    this.committed.push(...out);
    return out;
  }

  private planOne(): void {
    let kind: WaveKind = this.fillerNext ? 'rain' : waveKindAt(this.planEnd);
    if (this.fillerNext) this.fillerNext = false;
    else if (kind !== 'rain' && kind !== 'rainHeavy') this.fillerNext = true;
    const plan = planWave(kind, this.planEnd, this.rng, this.width, this.gapX);
    if (plan.gapX !== undefined) this.gapX = plan.gapX;
    const isWall = kind === 'wall';
    const fresh: Entry[] = plan.spawns.map((sp) => ({ ...sp, at: this.planEnd + sp.at, wall: isWall }));
    this.planEnd += plan.duration;
    this.buffer.push(...fresh);
    if (this.validate && fresh.length > 0) this.prune(fresh);
  }

  /** Drops non-wall buffered blocks until the window around `fresh` has a survivable path. */
  private prune(fresh: Entry[]): void {
    const first = Math.min(...fresh.map((e) => e.at));
    const last = Math.max(...fresh.map((e) => e.at));
    const fromT = Math.max(0, first - LOOKBACK);
    const toT = last + LOOKFORWARD;
    const history = this.committed.filter((c) => c.at > fromT - 12);
    const dead = (): number | null => firstDeadEnd([...history, ...this.buffer], this.width, fromT, toT);
    let d = dead();
    while (d !== null) {
      const cands = this.buffer.filter((e) => !e.wall).sort((a, b) => b.at - a.at);
      if (cands.length === 0) return; // only walls left; nothing legal to drop
      let removed: Entry | null = null;
      for (const c of cands) {
        this.buffer.splice(this.buffer.indexOf(c), 1);
        const nd = dead();
        if (nd === null || nd > d) {
          removed = c;
          d = nd;
          break;
        }
        this.buffer.push(c);
      }
      if (!removed) {
        // no single removal helps yet: drop the latest block spawned before the dead end
        const c = cands.find((e) => e.at <= d!) ?? cands[0]!;
        this.buffer.splice(this.buffer.indexOf(c), 1);
        d = dead();
      }
    }
  }
}
