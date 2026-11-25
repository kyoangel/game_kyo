export type Fetcher = (url: string) => Promise<ArrayBuffer>;

const defaultFetch: Fetcher = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.arrayBuffer();
};

export class SampleBank {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly ctx: AudioContext;
  private readonly fetcher: Fetcher;

  constructor(ctx: AudioContext, fetcher: Fetcher = defaultFetch) {
    this.ctx = ctx;
    this.fetcher = fetcher;
  }

  async load(urls: Record<string, string>, onProgress?: (ratio: number) => void): Promise<void> {
    const names = Object.keys(urls);
    let done = 0;
    await Promise.all(names.map(async (name) => {
      try {
        const data = await this.fetcher(urls[name]!);
        this.buffers.set(name, await this.ctx.decodeAudioData(data));
      } catch {
        /* leave unloaded: caller falls back to synthesis */
      }
      done += 1;
      onProgress?.(done / names.length);
    }));
  }

  get(name: string): AudioBuffer | undefined { return this.buffers.get(name); }

  names(): string[] { return [...this.buffers.keys()]; }
}

/** Playback rate for combo step n (semitone per step, clamped to 0..14 like pentatonic()). */
export function sfxRate(step: number): number {
  const s = Math.max(0, Math.min(14, step));
  return 2 ** (s / 12);
}

export interface LoopPoints {
  /** Seconds into the buffer where the loop begins (after leading encoder padding). */
  start: number;
  /** Seconds into the buffer where the loop wraps (before trailing padding). */
  end: number;
}

export interface LoopOptions {
  /** Absolute sample level at or below which a sample counts as padding. */
  threshold?: number;
  /** Never trim more than this many seconds from either end. */
  maxTrimSec?: number;
}

/**
 * Loop points that exclude the near-silent encoder delay at the head and the padding at the tail of a decoded mp3,
 * so an AudioBufferSourceNode loop wraps without an audible gap. Padding must be quiet on EVERY channel. A buffer
 * with no padding (decoder already compensated, or ogg/wav) keeps its full length: no fixed trim is ever applied.
 */
export function computeLoopPoints(channels: ArrayLike<number>[], sampleRate: number, opts: LoopOptions = {}): LoopPoints {
  const length = channels.reduce((m, c) => Math.max(m, c.length), 0);
  if (length === 0 || sampleRate <= 0) return { start: 0, end: length / (sampleRate || 1) };
  const threshold = opts.threshold ?? 0.002;
  const maxTrim = Math.floor((opts.maxTrimSec ?? 0.08) * sampleRate);
  const loud = (i: number): boolean => channels.some((c) => i < c.length && Math.abs(c[i]!) > threshold);

  let first = 0;
  while (first < length && !loud(first)) first += 1;
  if (first === length) return { start: 0, end: length / sampleRate }; // silence: leave alone
  let last = length - 1;
  while (last > first && !loud(last)) last -= 1;
  const lead = Math.min(first, maxTrim);
  const tail = Math.min(length - 1 - last, maxTrim);
  return { start: lead / sampleRate, end: (length - tail) / sampleRate };
}
