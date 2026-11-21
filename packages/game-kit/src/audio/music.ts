export const BPM = 120;
export const STEP_SEC = 60 / BPM / 4;
export const STEPS = 16;

export type DrumHit = 'k' | 's' | 'h';
export interface MusicLayer {
  name: 'bass' | 'drums' | 'arp' | 'lead';
  /** Semitone offsets (bass/arp/lead) or drum hits (drums); null = rest. */
  steps: ReadonlyArray<number | DrumHit | null>;
}

export const LAYERS: readonly MusicLayer[] = [
  { name: 'bass', steps: [0, null, null, null, 0, null, null, null, -5, null, null, null, -3, null, -3, null] },
  { name: 'drums', steps: ['k', null, 'h', null, 's', null, 'h', null, 'k', null, 'h', 'k', 's', null, 'h', null] },
  { name: 'arp', steps: [0, 4, 7, 12, 0, 4, 7, 12, -5, 2, 7, 11, -3, 4, 9, 12] },
  { name: 'lead', steps: [12, null, null, 16, null, 14, null, null, 12, null, 19, null, 16, null, 14, null] },
];

/** 16th-note steps whose time falls in [max(fromTime, nextStepTime), toTime). */
export function stepsToSchedule(fromTime: number, toTime: number, nextStepTime: number, stepIndex: number): Array<{ time: number; step: number }> {
  const out: Array<{ time: number; step: number }> = [];
  let t = nextStepTime;
  let i = stepIndex;
  while (t < toTime) {
    if (t >= fromTime) out.push({ time: t, step: i });
    t += STEP_SEC;
    i = (i + 1) % STEPS;
  }
  return out;
}
