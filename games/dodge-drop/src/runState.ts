import type { MedalId } from './medals.ts';
import type { StartTier } from './progression.ts';
import type { RunStats } from './missions.ts';

/** Registry key the play scene writes before game over, for the results hook. */
export const RUN_STATE_KEY = 'dd:run';

export interface RunState {
  /** Includes the head start (counts for best). */
  score: number;
  /** Real seconds survived: floor(t - startT). */
  seconds: number;
  stars: number;
  /** Medals earned this run (clock based, medals below the start clock excluded). */
  medals: MedalId[];
  headStart: number;
  startTier: StartTier;
  /** stats.score already excludes headStart; stats.runs = 1. */
  stats: RunStats;
}
