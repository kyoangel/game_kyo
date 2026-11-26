/**
 * Renders the Chomp loop (public/assets/audio/music-chomp.mp3): an original, bright major-key chiptune at 168 BPM,
 * 8 bars, seamless. Run: node games/dodge-drop/scripts/render-chomp-music.ts (needs ffmpeg).
 * Owner brief 2026-11-26: Chomp should feel joyful, "like grabbing an invincibility power-up".
 */
import { join } from 'node:path';
import { Loop, m, square, triangle } from './synth.ts';

const BARS = 8;
const song = new Loop(168, BARS * 16);
const tone = song.tone.bind(song);
const kick = (s: number): void => song.kick(s);
const snare = (s: number): void => song.snare(s);
const hat = (s: number, open = false): void => song.hat(s, open);

// I - vi - IV - V, I - vi - IV/V - I in C major
const CHORDS: string[][] = [['C', 'E', 'G'], ['A', 'C', 'E'], ['F', 'A', 'C'], ['G', 'B', 'D'], ['C', 'E', 'G'], ['A', 'C', 'E'], ['F', 'A', 'C', 'G', 'B', 'D'], ['C', 'E', 'G']];
const ROOTS = ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'C3'];

// Lead: 8 eighth-note slots per bar, '.' ties the previous note, '-' is a rest. Original melody.
const LEAD = [
  'G5 . E5 G5 C6 . B5 C6',
  'A5 . E5 A5 C6 . B5 A5',
  'F5 A5 C6 A5 F5 A5 C6 D6',
  'B5 . G5 B5 D6 . D6 -',
  'E6 . D6 C6 G5 . C6 E6',
  'D6 C6 A5 E5 A5 C6 E6 -',
  'F6 E6 D6 C6 D6 B5 G5 B5',
  'C6 . G5 E5 C5 - C6 -',
];

for (let bar = 0; bar < BARS; bar++) {
  const b0 = bar * 16;
  // drums: four-on-the-floor kick with a skip, backbeat snare, 8th hats with an open hat on the off-beat of 4
  for (const k of [0, 4, 8, 12]) kick(b0 + k);
  for (const k of [4, 12]) snare(b0 + k);
  if (bar % 2 === 1) snare(b0 + 15);
  for (let k = 0; k < 16; k += 2) hat(b0 + k + 1, k === 14);
  // bass: octave bounce on 8ths (triangle, NES-style)
  const root = m(ROOTS[bar]!);
  const secondHalfRoot = bar === 6 ? m('G2') : root;
  for (let k = 0; k < 16; k += 2) {
    const r = k < 8 ? root : secondHalfRoot;
    tone(b0 + k, 1.6, k % 4 === 0 ? r : r + 12, triangle, 0.32);
  }
  // arpeggio: 16th chord tones, thin pulse, quiet
  const chord = CHORDS[bar]!;
  for (let k = 0; k < 16; k++) {
    const set = chord.length > 3 && k >= 8 ? chord.slice(3) : chord.slice(0, 3);
    const n = set[k % 3]!;
    tone(b0 + k, 0.8, m(`${n}5`) - 12, square(0.125), 0.045);
  }
  // lead
  const slots = LEAD[bar]!.split(' ');
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    if (s === '.' || s === '-') continue;
    let len = 1;
    while (i + len < slots.length && slots[i + len] === '.') len++;
    tone(b0 + i * 2, len * 2 - 0.3, m(s), square(0.5), 0.13, { vibrato: len > 1, decay: 0.35 });
    tone(b0 + i * 2, len * 2 - 0.3, m(s) + 0.07, square(0.25), 0.05, { decay: 0.35 }); // slight detune chorus
  }
}

song.write(join(import.meta.dirname, '..', 'public', 'assets', 'audio', 'music-chomp.mp3'), 6500);
