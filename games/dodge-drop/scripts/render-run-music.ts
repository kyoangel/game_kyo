/**
 * Renders the main run loop (public/assets/audio/music-normal.mp3): an original synth-pop / future-house track in
 * F minor, 140 BPM, 16 bars (8-bar verse + 8-bar chorus with a repeating hook), seamless.
 * Pop ingredients: four-on-the-floor kick with sidechain pump on bass/chords/pad, off-beat rolling bass, filtered
 * pluck chord stabs, a mid-register hook with a dotted-eighth echo, claps on 2 and 4, risers into each phrase.
 * Run: node games/dodge-drop/scripts/render-run-music.ts (needs ffmpeg).
 * Owner brief 2026-11-27: more sense of speed, "not kids' music", a little pop. Replaces the 150 BPM racing loop.
 */
import { join } from 'node:path';
import { Loop, m, SR, saw, square, triangle } from './synth.ts';

const BPM = 140;
const BARS = 16;
const STEPS = BARS * 16;
const master = new Loop(BPM, STEPS); // drums + risers (not ducked)
const ducked = new Loop(BPM, STEPS); // bass, chords, pad: pumped by the kick
const lead = new Loop(BPM, STEPS); // hook, with echo

// Chord per bar. Verse: i-VI-III-VII twice. Chorus: VI-VII-i-III, VI-VII-V-V (C major pulls back to Fm).
const PROG = ['Fm', 'Db', 'Ab', 'Eb', 'Fm', 'Db', 'Ab', 'Eb', 'Db', 'Eb', 'Fm', 'Ab', 'Db', 'Eb', 'C', 'C'];
const CHORD: Record<string, string[]> = {
  Fm: ['F', 'G#', 'C'], Db: ['C#', 'F', 'G#'], Ab: ['G#', 'C', 'D#'], Eb: ['D#', 'G', 'A#'], C: ['C', 'E', 'G'],
};
const ROOT: Record<string, string> = { Fm: 'F1', Db: 'C#2', Ab: 'G#1', Eb: 'D#2', C: 'C2' };

type Note = [step: number, len: number, note: string];
// Original melody. Verse: a quiet call in bars 5-8; chorus: the hook (bars 9-16), its motif repeats with a lift.
const MOTIF: Note[] = [[0, 2, 'C5'], [3, 2, 'C#5'], [6, 2, 'C5'], [8, 3, 'G#4'], [12, 2, 'A#4'], [14, 2, 'C5']];
const MELODY: Record<number, Note[]> = {
  4: [[2, 2, 'G#4'], [4, 2, 'C5'], [8, 4, 'C5'], [12, 2, 'A#4'], [14, 2, 'G#4']],
  5: [[0, 4, 'G#4'], [6, 2, 'F4'], [8, 6, 'G#4']],
  6: [[2, 2, 'G#4'], [4, 2, 'C5'], [8, 4, 'D#5'], [12, 4, 'C5']],
  7: [[0, 6, 'A#4'], [8, 8, 'G4']],
  8: MOTIF,
  9: [[0, 2, 'A#4'], [3, 2, 'C5'], [6, 2, 'A#4'], [8, 3, 'G4'], [12, 4, 'D#5']],
  10: [[0, 2, 'C5'], [3, 2, 'C#5'], [6, 2, 'C5'], [8, 3, 'G#4'], [12, 2, 'F4'], [14, 2, 'G#4']],
  11: [[0, 6, 'C5'], [8, 2, 'D#5'], [10, 2, 'C5'], [12, 4, 'G#4']],
  12: MOTIF,
  13: [[0, 2, 'A#4'], [3, 2, 'C5'], [6, 2, 'D#5'], [8, 3, 'F5'], [12, 4, 'G5']],
  14: [[0, 3, 'G5'], [3, 3, 'F5'], [6, 2, 'E5'], [8, 6, 'C5']],
  15: [[0, 3, 'E5'], [4, 4, 'G5'], [8, 8, 'E5']],
};
// Future-house stab rhythm (16th steps).
const STABS_VERSE = [0, 3, 6, 10];
const STABS_CHORUS = [0, 3, 6, 8, 10, 13];

for (let bar = 0; bar < BARS; bar++) {
  const b0 = bar * 16;
  const chorus = bar >= 8;
  const name = PROG[bar]!;
  const chord = CHORD[name]!;
  const root = m(ROOT[name]!);

  // drums
  for (const k of [0, 4, 8, 12]) master.kick(b0 + k, 0.7);
  for (const k of [4, 12]) {
    master.clap(b0 + k, chorus ? 0.24 : 0.17);
    if (chorus) master.snare(b0 + k, 0.1);
  }
  for (let k = 0; k < 16; k++) {
    if (k % 4 === 2) master.hat(b0 + k, true, chorus ? 0.12 : 0.09);
    else if (chorus || k % 2 === 0) master.hat(b0 + k, false, k % 2 === 0 ? 0.07 : 0.045);
  }
  if (bar % 8 === 7) {
    master.riser(b0, 16, 0.2);
    for (const k of [12, 13, 14, 15]) master.snare(b0 + k, 0.08 + 0.03 * (k - 12));
  }

  // bass: off-beat 8ths in the verse, rolling 16ths between the kicks in the chorus; saw + sub
  const bassSteps = chorus ? [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15] : [2, 6, 10, 14];
  for (const k of bassSteps) {
    const oct = chorus && k % 4 === 3 ? 12 : 0;
    ducked.tone(b0 + k, 0.9, root + 12 + oct, saw, 0.16, { cutoff: 380, cutoffPeak: 1400, cutoffDecay: 0.05, decay: 0.12 });
    ducked.tone(b0 + k, 0.9, root, triangle, 0.22, { decay: 0.15 });
  }

  // pluck chord stabs: detuned saws with a fast-closing filter
  for (const k of chorus ? STABS_CHORUS : STABS_VERSE) {
    for (const n of chord) {
      for (const d of [-0.1, 0.1]) {
        ducked.tone(b0 + k, 1.6, m(`${n}4`) + d, saw, 0.03, { cutoff: 500, cutoffPeak: chorus ? 4200 : 2800, cutoffDecay: 0.07 });
      }
    }
  }
  // pad: soft whole-bar chord an octave down, low-passed
  for (const n of chord) ducked.tone(b0, 15.5, m(`${n}3`), saw, 0.016, { attack: 0.12, cutoff: chorus ? 1500 : 1000 });

  // lead: two detuned saws through a mellow filter plus a square an octave up for bite in the chorus
  for (const [s, len, note] of MELODY[bar] ?? []) {
    const midi = m(note);
    const gain = chorus ? 0.075 : 0.05;
    for (const d of [-0.08, 0.08]) {
      lead.tone(b0 + s, len - 0.3, midi + d, saw, gain, { cutoff: chorus ? 3200 : 2200, vibrato: len > 3, glide: s === 0 ? 1 : 0, glideTime: 0.04 });
    }
    if (chorus) lead.tone(b0 + s, len - 0.3, midi + 12, square(0.5), 0.012, { cutoff: 3500, decay: 0.3 });
  }
}

lead.echo(3, 0.3, 0.35); // dotted-eighth echo

// Sidechain pump: duck to 30 % on every kick, recover over ~0.2 s.
const beat = Math.round(ducked.step * 4 * SR);
const pump = (i: number): number => {
  const t = (i % beat) / SR;
  return 1 - 0.7 * Math.max(0, 1 - t / 0.2) ** 2;
};
ducked.mixInto(master, pump);
lead.mixInto(master);

master.write(join(import.meta.dirname, '..', 'public', 'assets', 'audio', 'music-normal.mp3'), 9000);
