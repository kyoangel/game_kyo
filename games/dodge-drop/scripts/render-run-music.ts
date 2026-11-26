/**
 * Renders the main run loop (public/assets/audio/music-normal.mp3): an original racing-game synth track in A minor,
 * 150 BPM, 16 bars (8-bar verse + 8-bar lift), seamless. Eurobeat / OutRun-style ingredients: four-on-the-floor kick,
 * claps on 2 and 4, off-beat open hats, octave-bouncing bass, detuned saw lead and pad.
 * Run: node games/dodge-drop/scripts/render-run-music.ts (needs ffmpeg).
 * Owner brief 2026-11-26: "racing game music", made the same way as the Chomp jingle (render-chomp-music.ts).
 */
import { join } from 'node:path';
import { Loop, m, saw, square } from './synth.ts';

const BARS = 16;
const song = new Loop(150, BARS * 16);

const CHORD: Record<string, string[]> = {
  Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], C: ['C', 'E', 'G'], G: ['G', 'B', 'D'], E: ['E', 'G#', 'B'], Em: ['E', 'G', 'B'],
};
const PROG = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'E'];
const ROOT: Record<string, string> = { Am: 'A1', F: 'F1', C: 'C2', G: 'G1', E: 'E1', Em: 'E1' };

// Lead: 8 eighth-note slots per bar, '.' ties, '-' rests. Original melody.
const LEAD = [
  'A5 . C6 . E6 . D6 C6',
  'C6 . A5 . F5 . A5 C6',
  'E6 . G6 . E6 D6 C6 .',
  'D6 . B5 . G5 . B5 D6',
  'E6 . E6 D6 C6 . A5 C6',
  'F6 . E6 D6 C6 . A5 .',
  'B5 C6 D6 . G6 . F6 E6',
  'G#5 . B5 . E6 . D6 B5',
  'A6 . G6 F6 E6 . C6 .',
  'B5 . D6 G6 F6 . E6 D6',
  'E6 . G6 . B6 . A6 G6',
  'A6 . . . E6 . C6 .',
  'F6 E6 F6 G6 A6 . G6 F6',
  'G6 F6 G6 A6 B6 . A6 G6',
  'G#6 . E6 . B5 . E6 .',
  'G#6 . . . B6 . . -',
];

/** Detuned saw stack: the classic big synth lead / pad. */
function supersaw(step: number, steps: number, midi: number, gain: number, opts: { decay?: number; attack?: number; vibrato?: boolean } = {}): void {
  for (const d of [-0.12, 0, 0.12]) song.tone(step, steps, midi + d, saw, gain, opts);
}

for (let bar = 0; bar < BARS; bar++) {
  const b0 = bar * 16;
  const lift = bar >= 8;
  const chord = CHORD[PROG[bar]!]!;
  // drums
  for (const k of [0, 4, 8, 12]) song.kick(b0 + k, 0.6);
  for (const k of [4, 12]) song.clap(b0 + k, 0.22);
  for (let k = 0; k < 16; k++) {
    if (k % 4 === 2) song.hat(b0 + k, true, 0.13); // off-beat open hat
    else if (lift || k % 2 === 0) song.hat(b0 + k, false, 0.07);
  }
  if (bar % 4 === 3) for (const k of [13, 14, 15]) song.snare(b0 + k, 0.16); // fill into the next phrase
  // bass: octave bounce on 8ths, plucky square
  const root = m(ROOT[PROG[bar]!]!);
  for (let k = 0; k < 16; k += 2) song.tone(b0 + k, 1.7, k % 4 === 0 ? root : root + 12, square(0.5), 0.2, { decay: 0.09 });
  // pad: whole-bar chord, soft attack
  for (const n of chord) supersaw(b0, 15.5, m(`${n}4`), 0.012, { attack: 0.08 });
  // lift: 16th arpeggio for drive
  if (lift) for (let k = 0; k < 16; k++) song.tone(b0 + k, 0.7, m(`${chord[k % 3]!}5`), square(0.25), 0.035, { decay: 0.05 });
  // lead
  const slots = LEAD[bar]!.split(' ');
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    if (s === '.' || s === '-') continue;
    let len = 1;
    while (i + len < slots.length && slots[i + len] === '.') len++;
    supersaw(b0 + i * 2, len * 2 - 0.3, m(s), 0.045, { vibrato: len > 1, decay: 0.5 });
    song.tone(b0 + i * 2, len * 2 - 0.3, m(s) - 12, square(0.5), 0.03, { decay: 0.5 }); // octave-down body
  }
}

song.write(join(import.meta.dirname, '..', 'public', 'assets', 'audio', 'music-normal.mp3'), 7000);
