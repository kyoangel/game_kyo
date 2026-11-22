export const BPM = 120;
export const STEP_SEC = 60 / BPM / 4;
export const STEPS = 16;

export type DrumHit = 'k' | 's' | 'h';
export type MusicMode = 'normal' | 'rush' | 'overdrive' | 'chomp';

export interface MusicLayer {
  name: 'bass' | 'drums' | 'arp' | 'lead';
  /** Semitone offsets (bass/arp/lead) or drum hits (drums); null = rest. */
  steps: ReadonlyArray<number | DrumHit | null>;
}

export interface MusicTrack {
  id: string;
  bpm: number;
  /** Root frequency (Hz) for semitone offset 0. */
  baseHz: number;
  layers: readonly MusicLayer[];
}

const n = null;

/** Driving synthwave drums (16-step pattern, repeated across bars). */
const DRUMS_SYNTH: ReadonlyArray<DrumHit | null> = [
  'k', n, 'h', n, 's', n, 'h', n, 'k', n, 'h', 'k', 's', n, 'h', n,
  'k', n, 'h', n, 's', n, 'h', 'h', 'k', n, 'h', 'k', 's', n, 'h', n,
  'k', n, 'h', n, 's', n, 'h', n, 'k', n, 'h', 'k', 's', n, 'h', 'h',
  'k', n, 'h', n, 's', n, 'h', 'k', 'k', 'h', 's', 'h', 's', 'k', 's', 'h',
];

/** Syncopated arcade drums (64 steps). */
const DRUMS_BREAK: ReadonlyArray<DrumHit | null> = [
  'k', n, 'h', 'h', 's', n, 'k', n, 'h', n, 'k', n, 's', n, 'h', n,
  'k', n, 'h', n, 's', n, 'k', 'h', 'k', n, 'h', 'k', 's', n, 'h', 's',
  'k', n, 'h', 'h', 's', n, 'k', n, 'h', n, 'k', n, 's', n, 'h', n,
  'k', 'h', 'k', n, 's', n, 'k', 'h', 'k', 'k', 's', n, 's', 'h', 's', 'h',
];

/** Upbeat runner drums (64 steps). */
const DRUMS_RUNNER: ReadonlyArray<DrumHit | null> = [
  'k', 'h', 'h', 'h', 's', 'h', 'h', 'h', 'k', 'h', 'k', 'h', 's', 'h', 'h', n,
  'k', 'h', 'h', 'h', 's', 'h', 'h', 'k', 'k', 'h', 'h', 'h', 's', 'h', 'h', 'h',
  'k', 'h', 'h', 'h', 's', 'h', 'h', 'h', 'k', 'h', 'k', 'h', 's', 'h', 'h', 'k',
  'k', 'h', 'k', 'h', 's', 'h', 'k', 'h', 'k', 'k', 's', 's', 'k', 's', 's', 'h',
];

/** Intense double-time drums substituted during Rush / Overdrive. */
export const RUSH_DRUMS: ReadonlyArray<DrumHit | null> = [
  'k', 'h', 'k', 'h', 's', 'h', 'k', 'h', 'k', 'k', 'h', 'k', 's', 'h', 'k', 'h',
];

/** Track 0 — Neon Pulse: A minor (Am – F – C – G), 124 BPM. */
const TRACK_NEON_PULSE: MusicTrack = {
  id: 'neon-pulse',
  bpm: 124,
  baseHz: 110,
  layers: [
    {
      name: 'bass',
      steps: [
        0, n, 0, n, 0, n, 0, 12, 0, n, 0, n, 0, n, 7, n,
        -4, n, -4, n, -4, n, -4, 8, -4, n, -4, n, -4, n, 0, n,
        3, n, 3, n, 3, n, 3, 15, 3, n, 3, n, 3, n, 10, n,
        -2, n, -2, n, -2, n, -2, 10, -2, n, -2, n, -2, 0, 2, n,
      ],
    },
    { name: 'drums', steps: DRUMS_SYNTH },
    {
      name: 'arp',
      steps: [
        0, 3, 7, 12, 0, 3, 7, 12, 0, 3, 7, 12, 7, 3, 0, 7,
        -4, 0, 3, 8, -4, 0, 3, 8, -4, 0, 3, 8, 3, 0, -4, 3,
        3, 7, 10, 15, 3, 7, 10, 15, 3, 7, 10, 15, 10, 7, 3, 10,
        -2, 2, 5, 10, -2, 2, 5, 10, -2, 2, 5, 10, 5, 2, -2, 2,
      ],
    },
    {
      name: 'lead',
      steps: [
        12, n, n, 15, n, 14, n, n, 12, n, 19, n, 15, n, 14, n,
        12, n, n, 8, n, 12, n, n, 15, n, 14, n, 12, n, n, n,
        15, n, n, 19, n, 17, n, n, 15, n, 22, n, 19, n, 17, n,
        14, n, n, 17, n, 15, n, 14, 12, n, 10, n, 14, n, n, n,
      ],
    },
  ],
};

/** Track 1 — Cyber Drift: D minor (Dm – Bb – C – Am), 128 BPM. */
const TRACK_CYBER_DRIFT: MusicTrack = {
  id: 'cyber-drift',
  bpm: 128,
  baseHz: 146.83,
  layers: [
    {
      name: 'bass',
      steps: [
        0, n, n, 0, n, 0, 12, n, 0, n, n, 0, n, 7, 0, n,
        -4, n, n, -4, n, -4, 8, n, -4, n, n, -4, n, 3, -4, n,
        -2, n, n, -2, n, -2, 10, n, -2, n, n, -2, n, 5, -2, n,
        -5, n, n, -5, n, -5, 7, n, -5, n, -2, n, 0, n, 2, n,
      ],
    },
    { name: 'drums', steps: DRUMS_BREAK },
    {
      name: 'arp',
      steps: [
        12, 7, 3, 0, 12, 7, 3, 0, 12, 7, 3, 0, 3, 7, 10, 12,
        8, 3, 0, -4, 8, 3, 0, -4, 8, 3, 0, -4, 0, 3, 7, 8,
        10, 5, 2, -2, 10, 5, 2, -2, 10, 5, 2, -2, 2, 5, 7, 10,
        7, 2, -2, -5, 7, 2, -2, -5, 7, 2, 0, 2, 5, 7, 10, 12,
      ],
    },
    {
      name: 'lead',
      steps: [
        12, n, 14, n, 15, n, n, 12, 19, n, n, 17, 15, n, 14, n,
        15, n, 14, n, 12, n, n, 8, 12, n, 15, n, 14, n, n, n,
        14, n, 17, n, 19, n, n, 14, 22, n, n, 19, 17, n, 15, n,
        19, n, 17, n, 15, n, 14, n, 12, n, n, 10, 12, n, n, n,
      ],
    },
  ],
};

/** Track 2 — Starlight Run: C minor (Cm – Eb – Fm – G), 126 BPM. */
const TRACK_STARLIGHT_RUN: MusicTrack = {
  id: 'starlight-run',
  bpm: 126,
  baseHz: 130.81,
  layers: [
    {
      name: 'bass',
      steps: [
        0, 12, 0, n, 0, 12, 0, n, 0, 12, 0, n, 3, n, 2, n,
        3, 15, 3, n, 3, 15, 3, n, 3, 15, 3, n, 7, n, 5, n,
        5, 17, 5, n, 5, 17, 5, n, 5, 17, 5, n, 8, n, 7, n,
        7, 19, 7, n, 7, 19, 7, n, 7, n, 10, n, 11, n, 7, n,
      ],
    },
    { name: 'drums', steps: DRUMS_RUNNER },
    {
      name: 'arp',
      steps: [
        0, 7, 3, 12, 0, 7, 3, 12, 0, 7, 3, 12, 7, 12, 15, 12,
        3, 10, 7, 15, 3, 10, 7, 15, 3, 10, 7, 15, 10, 15, 19, 15,
        5, 12, 8, 17, 5, 12, 8, 17, 5, 12, 8, 17, 12, 17, 20, 17,
        7, 14, 11, 19, 7, 14, 11, 19, 7, 11, 14, 19, 14, 11, 7, 11,
      ],
    },
    {
      name: 'lead',
      steps: [
        12, n, 15, n, 19, n, 15, n, 17, n, 15, n, 14, n, 12, n,
        15, n, 19, n, 22, n, 19, n, 17, n, 15, n, 19, n, n, n,
        17, n, 20, n, 24, n, 20, n, 19, n, 17, n, 15, n, 17, n,
        19, n, 17, n, 14, n, 11, n, 14, n, 17, n, 19, n, n, n,
      ],
    },
  ],
};

/** Main tracks rotated across runs so every run feels fresh. */
export const TRACKS: readonly MusicTrack[] = [
  TRACK_NEON_PULSE,
  TRACK_CYBER_DRIFT,
  TRACK_STARLIGHT_RUN,
];

/** Dedicated Chomp Mode invincible theme: bright C major (C – G – F – G), 160 BPM. */
export const CHOMP_TRACK: MusicTrack = {
  id: 'chomp-fever',
  bpm: 160,
  baseHz: 130.81,
  layers: [
    {
      name: 'bass',
      steps: [
        0, n, 12, n, 7, n, 12, n, 0, n, 12, n, 7, n, 4, n,
        -5, n, 7, n, 2, n, 7, n, -5, n, 7, n, 2, n, -1, n,
        5, n, 17, n, 12, n, 17, n, 5, n, 17, n, 12, n, 9, n,
        7, n, 19, n, 14, n, 19, n, 7, n, 11, n, 14, n, 19, n,
      ],
    },
    {
      name: 'drums',
      steps: [
        'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'k', 's', 'h',
        'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 's', 's', 'h',
        'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'k', 's', 'h',
        'k', 'h', 's', 'h', 'k', 's', 'k', 's', 'k', 'k', 's', 's', 'k', 's', 's', 'h',
      ],
    },
    {
      name: 'arp',
      steps: [
        0, 4, 7, 12, 16, 12, 7, 4, 0, 4, 7, 12, 16, 12, 7, 4,
        -5, -1, 2, 7, 11, 7, 2, -1, -5, -1, 2, 7, 11, 7, 2, -1,
        5, 9, 12, 17, 21, 17, 12, 9, 5, 9, 12, 17, 21, 17, 12, 9,
        7, 11, 14, 19, 23, 19, 14, 11, 7, 11, 14, 19, 23, 19, 14, 11,
      ],
    },
    {
      name: 'lead',
      steps: [
        12, 12, n, 16, 19, n, 16, n, 24, n, 19, n, 16, n, 12, n,
        14, 14, n, 19, 23, n, 19, n, 26, n, 23, n, 19, n, 14, n,
        17, 17, n, 21, 24, n, 21, n, 29, n, 24, n, 21, n, 17, n,
        19, n, 23, n, 26, n, 23, 24, 26, n, 24, n, 23, n, 19, n,
      ],
    },
  ],
};

/** Legacy single-bar 16-step export kept for backwards compatibility. */
export const LAYERS: readonly MusicLayer[] = TRACK_NEON_PULSE.layers.map((l) => ({
  name: l.name,
  steps: l.steps.slice(0, STEPS),
}));

/** Effective BPM for a track under the current music mode. */
export function modeBpm(track: MusicTrack, mode: MusicMode): number {
  if (mode === 'chomp') return CHOMP_TRACK.bpm;
  if (mode === 'overdrive') return Math.round(track.bpm * 1.25);
  if (mode === 'rush') return Math.round(track.bpm * 1.18);
  return track.bpm;
}

/** 16th-note steps whose time falls in [max(fromTime, nextStepTime), toTime). */
export function stepsToSchedule(
  fromTime: number,
  toTime: number,
  nextStepTime: number,
  stepIndex: number,
  stepSec: number = STEP_SEC,
  stepsCount: number = STEPS,
): Array<{ time: number; step: number }> {
  const out: Array<{ time: number; step: number }> = [];
  let t = nextStepTime;
  let i = stepIndex;
  while (t < toTime) {
    if (t >= fromTime) out.push({ time: t, step: i });
    t += stepSec;
    i = (i + 1) % stepsCount;
  }
  return out;
}
