/**
 * Renders the Chomp loop (public/assets/audio/music-chomp.mp3): an original, bright major-key chiptune at 168 BPM,
 * 8 bars, seamless (rendered into a circular buffer so release tails wrap onto the loop start).
 * Run: node games/dodge-drop/scripts/render-chomp-music.ts  (needs ffmpeg; loudness-normalised to -18 LUFS like the
 * other music files; a 6.5 kHz low-pass tames naive square-wave aliasing). Owner brief 2026-11-26: Chomp should feel joyful, "like grabbing an invincibility power-up".
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SR = 44100;
const BPM = 168;
const STEP = 60 / BPM / 4; // 16th note
const BARS = 8;
const STEPS = BARS * 16;
const N = Math.round(STEPS * STEP * SR);
const buf = new Float32Array(N);

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "C6", "F#5" -> midi */
function m(name: string): number {
  const sharp = name[1] === '#' ? 1 : 0;
  return NOTE[name[0]!]! + sharp + 12 * (Number(name.slice(1 + sharp)) + 1);
}

function add(i: number, v: number): void {
  buf[((i % N) + N) % N]! += v;
}

type Wave = (phase: number) => number;
const square = (duty: number): Wave => (p) => (p % 1 < duty ? 1 : -1);
const triangle: Wave = (p) => 1 - 4 * Math.abs((p % 1) - 0.5);

function tone(startStep: number, steps: number, midi: number, wave: Wave, gain: number, opts: { vibrato?: boolean; decay?: number } = {}): void {
  const start = Math.round(startStep * STEP * SR);
  const len = Math.round(steps * STEP * SR);
  const rel = Math.round(0.03 * SR);
  const f = hz(midi);
  let phase = 0;
  for (let k = 0; k < len + rel; k++) {
    const t = k / SR;
    const vib = opts.vibrato && t > 0.12 ? 1 + 0.006 * Math.sin(2 * Math.PI * 6 * t) : 1;
    phase += (f * vib) / SR;
    const att = Math.min(1, k / (0.004 * SR));
    const dec = opts.decay ? Math.max(0.55, Math.exp(-t / opts.decay)) : 1;
    const env = k < len ? att * dec : att * dec * (1 - (k - len) / rel);
    add(start + k, wave(phase) * env * gain);
  }
}

let seed = 12345;
const noise = (): number => {
  seed = (seed * 1103515245 + 12345) >>> 0;
  return (seed / 2 ** 32) * 2 - 1;
};

function kick(step: number): void {
  const s = Math.round(step * STEP * SR);
  let ph = 0;
  for (let k = 0; k < 0.14 * SR; k++) {
    const t = k / SR;
    ph += (50 + 110 * Math.exp(-t / 0.03)) / SR;
    add(s + k, Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.05) * 0.55);
  }
}
function snare(step: number): void {
  const s = Math.round(step * STEP * SR);
  for (let k = 0; k < 0.13 * SR; k++) {
    const t = k / SR;
    add(s + k, (noise() * 0.8 + 0.3 * Math.sin(2 * Math.PI * 190 * t)) * Math.exp(-t / 0.045) * 0.26);
  }
}
function hat(step: number, open = false): void {
  const s = Math.round(step * STEP * SR);
  let prev = 0;
  for (let k = 0; k < (open ? 0.09 : 0.03) * SR; k++) {
    const t = k / SR;
    const n = noise();
    add(s + k, (n - prev) * 0.5 * Math.exp(-t / (open ? 0.03 : 0.01)) * 0.1); // first difference: crude high-pass
    prev = n;
  }
}

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

let peak = 0;
for (const v of buf) peak = Math.max(peak, Math.abs(v));
const pcm = Buffer.alloc(44 + N * 2);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.round((buf[i]! / peak) * 0.9 * 32767), 44 + i * 2);

const dir = mkdtempSync(join(tmpdir(), 'chomp-'));
const wav = join(dir, 'chomp.wav');
writeFileSync(wav, pcm);
const out = join(import.meta.dirname, '..', 'public', 'assets', 'audio', 'music-chomp.mp3');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', 'lowpass=f=6500,lowpass=f=6500,loudnorm=I=-18:TP=-1.5:LRA=7', '-ar', '44100', '-ac', '2', '-b:a', '112k', out]);
console.log(`wrote ${out} (${(N / SR).toFixed(2)} s, ${BPM} BPM)`);
