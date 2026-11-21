import type { MedalId } from './medals.ts';

/** Registry key the play scene writes before game over, for the results hook. */
export const RUN_STATE_KEY = 'dd:run';

export interface RunState {
  score: number;
  seconds: number;
  stars: number;
  medals: MedalId[];
}
