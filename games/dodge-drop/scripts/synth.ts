/**
 * Tiny offline synth shared by the music renderers (render-*-music.ts): naive oscillators, a few drums, and a
 * circular buffer so note tails wrap onto the loop start (seamless loops). Output is low-passed and
 * loudness-normalised to -18 LUFS by ffmpeg, matching the other music files.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SR = 44100;
export type Wave = (phase: number) => number;
export const square = (duty: number): Wave => (p) => (p % 1 < duty ? 1 : -1);
export const triangle: Wave = (p) => 1 - 4 * Math.abs((p % 1) - 0.5);
export const saw: Wave = (p) => 2 * (p % 1) - 1;

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "C6", "G#5" -> midi */
export function m(name: string): number {
  const sharp = name[1] === '#' ? 1 : 0;
  return NOTE[name[0]!]! + sharp + 12 * (Number(name.slice(1 + sharp)) + 1);
}
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export interface ToneOpts {
  vibrato?: boolean;
  /** Exponential decay time constant (s); the level never falls below 55 %. */
  decay?: number;
  /** Attack time (s), default 4 ms. */
  attack?: number;
}

export class Loop {
  readonly step: number;
  readonly n: number;
  readonly buf: Float32Array;
  readonly bpm: number;
  private seed = 12345;

  constructor(bpm: number, steps: number) {
    this.bpm = bpm;
    this.step = 60 / bpm / 4; // 16th note
    this.n = Math.round(steps * this.step * SR);
    this.buf = new Float32Array(this.n);
  }

  private add(i: number, v: number): void {
    this.buf[((i % this.n) + this.n) % this.n]! += v;
  }

  private noise(): number {
    this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    return (this.seed / 2 ** 32) * 2 - 1;
  }

  tone(startStep: number, steps: number, midi: number, wave: Wave, gain: number, opts: ToneOpts = {}): void {
    const start = Math.round(startStep * this.step * SR);
    const len = Math.round(steps * this.step * SR);
    const rel = Math.round(0.03 * SR);
    const f = hz(midi);
    const attack = opts.attack ?? 0.004;
    let phase = 0;
    for (let k = 0; k < len + rel; k++) {
      const t = k / SR;
      const vib = opts.vibrato && t > 0.12 ? 1 + 0.006 * Math.sin(2 * Math.PI * 6 * t) : 1;
      phase += (f * vib) / SR;
      const att = Math.min(1, k / (attack * SR));
      const dec = opts.decay ? Math.max(0.55, Math.exp(-t / opts.decay)) : 1;
      const env = k < len ? att * dec : att * dec * (1 - (k - len) / rel);
      this.add(start + k, wave(phase) * env * gain);
    }
  }

  kick(step: number, gain = 0.55): void {
    const s = Math.round(step * this.step * SR);
    let ph = 0;
    for (let k = 0; k < 0.14 * SR; k++) {
      const t = k / SR;
      ph += (50 + 110 * Math.exp(-t / 0.03)) / SR;
      this.add(s + k, Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.05) * gain);
    }
  }

  snare(step: number, gain = 0.26): void {
    const s = Math.round(step * this.step * SR);
    for (let k = 0; k < 0.13 * SR; k++) {
      const t = k / SR;
      this.add(s + k, (this.noise() * 0.8 + 0.3 * Math.sin(2 * Math.PI * 190 * t)) * Math.exp(-t / 0.045) * gain);
    }
  }

  /** Clap: three quick noise bursts then a short tail. */
  clap(step: number, gain = 0.2): void {
    const s = Math.round(step * this.step * SR);
    for (let k = 0; k < 0.16 * SR; k++) {
      const t = k / SR;
      const burst = t < 0.03 ? (Math.floor(t / 0.01) % 2 === 0 ? 1 : 0.3) : Math.exp(-(t - 0.03) / 0.04);
      this.add(s + k, this.noise() * burst * gain);
    }
  }

  hat(step: number, open = false, gain = 0.1): void {
    const s = Math.round(step * this.step * SR);
    let prev = 0;
    for (let k = 0; k < (open ? 0.09 : 0.03) * SR; k++) {
      const t = k / SR;
      const n = this.noise();
      this.add(s + k, (n - prev) * 0.5 * Math.exp(-t / (open ? 0.03 : 0.01)) * gain); // first difference: crude high-pass
      prev = n;
    }
  }

  /** Peak-normalises to 16-bit WAV, then low-passes, loudness-normalises and encodes the mp3 at `out`. */
  write(out: string, lowpassHz: number): void {
    let peak = 0;
    for (const v of this.buf) peak = Math.max(peak, Math.abs(v));
    const N = this.n;
    const pcm = Buffer.alloc(44 + N * 2);
    pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
    pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24);
    pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40);
    for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.round((this.buf[i]! / peak) * 0.9 * 32767), 44 + i * 2);
    const wav = join(mkdtempSync(join(tmpdir(), 'music-')), 'loop.wav');
    writeFileSync(wav, pcm);
    const lp = `lowpass=f=${lowpassHz},lowpass=f=${lowpassHz}`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', `${lp},loudnorm=I=-18:TP=-1.5:LRA=7`, '-ar', '44100', '-ac', '2', '-b:a', '112k', out]);
    console.log(`wrote ${out} (${(N / SR).toFixed(2)} s, ${this.bpm} BPM)`);
  }
}
