import { describe, expect, it } from 'vitest';
import { computeLoopPoints, SampleBank, sfxRate } from './samples.ts';

const fakeBuf = { duration: 1 } as AudioBuffer;
const okFetch = async (): Promise<ArrayBuffer> => new ArrayBuffer(8);
const ctx = { decodeAudioData: async () => fakeBuf } as unknown as AudioContext;

describe('SampleBank', () => {
  it('loads and returns buffers by name', async () => {
    const bank = new SampleBank(ctx, okFetch);
    await bank.load({ pickup: 'assets/audio/sfx-pickup.mp3' });
    expect(bank.get('pickup')).toBe(fakeBuf);
  });
  it('a failed fetch leaves the name unloaded instead of throwing (synth fallback)', async () => {
    const bank = new SampleBank(ctx, async () => { throw new Error('404'); });
    await expect(bank.load({ pickup: 'x.mp3' })).resolves.toBeUndefined();
    expect(bank.get('pickup')).toBeUndefined();
  });
  it('a failed decode is also tolerated', async () => {
    const bad = { decodeAudioData: async () => { throw new Error('bad'); } } as unknown as AudioContext;
    const bank = new SampleBank(bad, okFetch);
    await bank.load({ pickup: 'x.mp3' });
    expect(bank.get('pickup')).toBeUndefined();
  });
  it('reports load progress 0..1', async () => {
    const seen: number[] = [];
    const bank = new SampleBank(ctx, okFetch);
    await bank.load({ a: 'a.mp3', b: 'b.mp3' }, (r) => seen.push(r));
    expect(seen[seen.length - 1]).toBe(1);
  });
});

describe('sfxRate', () => {
  it('raises pitch per combo step by a semitone and clamps', () => {
    expect(sfxRate(0)).toBeCloseTo(1, 5);
    expect(sfxRate(12)).toBeCloseTo(2, 3);
    expect(sfxRate(99)).toBeCloseTo(sfxRate(14), 5);
    expect(sfxRate(-3)).toBeCloseTo(1, 5);
  });
});

describe('computeLoopPoints (mp3 encoder padding)', () => {
  const sr = 1000;
  /** `lead` silent samples, `body` loud samples, `tail` silent samples. */
  const wave = (lead: number, body: number, tail: number): Float32Array => {
    const a = new Float32Array(lead + body + tail);
    for (let i = lead; i < lead + body; i++) a[i] = i % 2 ? 0.5 : -0.5;
    return a;
  };

  it('trims near-silent leading and trailing padding', () => {
    const p = computeLoopPoints([wave(25, 1000, 40)], sr);
    expect(p.start).toBeCloseTo(0.025, 5);
    expect(p.end).toBeCloseTo(1.025, 5);
  });
  it('treats very quiet dither as padding but not real signal', () => {
    const a = wave(30, 500, 0);
    a[10] = 0.0005; // below threshold: still padding
    a[400] = 0.0005; // inside the body, irrelevant
    expect(computeLoopPoints([a], sr).start).toBeCloseTo(0.03, 5);
  });
  it('keeps the whole buffer when there is no padding', () => {
    const p = computeLoopPoints([wave(0, 1000, 0)], sr);
    expect(p).toEqual({ start: 0, end: 1 });
  });
  it('caps the trim so a quiet intro is never eaten', () => {
    const p = computeLoopPoints([wave(500, 1000, 500)], sr, { maxTrimSec: 0.06 });
    expect(p.start).toBeCloseTo(0.06, 5);
    expect(p.end).toBeCloseTo(2 - 0.06, 5);
  });
  it('uses the earliest signal across channels', () => {
    const left = wave(50, 1000, 0);
    const right = wave(20, 1030, 0);
    expect(computeLoopPoints([left, right], sr).start).toBeCloseTo(0.02, 5);
  });
  it('falls back to the whole buffer for silence or an empty buffer', () => {
    expect(computeLoopPoints([new Float32Array(2000)], sr)).toEqual({ start: 0, end: 2 });
    expect(computeLoopPoints([], sr)).toEqual({ start: 0, end: 0 });
  });
});
