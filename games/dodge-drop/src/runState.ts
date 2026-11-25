import type { MedalId } from './medals.ts';
import type { StartTier } from './progression.ts';
import type { RunStats } from './missions.ts';

/** Registry key the play scene writes before game over, for the results hook. */
export const RUN_STATE_KEY = 'dd:run';

export interface RunState {
  /** The run result: final clock in whole seconds, tier-start offset included (same clock as the medals; counts for best). */
  clock: number;
  /** Real seconds survived: floor(t - startT); earns coins. */
  seconds: number;
  stars: number;
  /** Medals earned this run (clock based, medals below the start clock excluded). */
  medals: MedalId[];
  startTier: StartTier;
  /** stats.runs = 1. */
  stats: RunStats;
}
