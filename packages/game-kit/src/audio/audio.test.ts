import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveData } from '../save.ts';
import { createGameAudio, MUSIC_BUS, SFX_BUS } from './audio.ts';
import { TRACKS } from './music.ts';

function store() {
  const m = new Map<string, string>();
  return { m, save: new SaveData({ get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) }, 'g') };
}

interface FakeSource {
  buffer: unknown; loop: boolean; loopStart: number; loopEnd: number; started: boolean; stopped: boolean;
  playbackRate: { value: number };
  connect(): void; start(): void; stop(): void;
}

function fakeCtx() {
  const created = { osc: 0, gains: [] as Array<{ gain: { value: number; ramps: number[] } }>, sources: [] as FakeSource[] };
  const param = () => {
    const p = {
      value: 1,
      ramps: [] as number[],
      setValueAtTime() {}, exponentialRampToValueAtTime() {},
      linearRampToValueAtTime(v: number) { p.ramps.push(v); },
      setTargetAtTime() {}, cancelScheduledValues() {},
    };
    return p;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'suspended',
    destination: {},
    resume: async () => { ctx.state = 'running'; },
    suspend: async () => { ctx.state = 'suspended'; },
    createOscillator: () => { created.osc++; return { type: 'sine', frequency: param(), connect() {}, start() {}, stop() {} }; },
    createGain: () => { const g = { gain: param(), connect() {} }; created.gains.push(g); return g; },
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => {
      const src: FakeSource = {
        buffer: null, loop: false, loopStart: 0, loopEnd: 0, started: false, stopped: false, playbackRate: { value: 1 },
        connect() {}, start() { src.started = true; }, stop() { src.stopped = true; },
      };
      created.sources.push(src);
      return src;
    },
    decodeAudioData: async (data: ArrayBuffer) => fakeBuffer(data.byteLength),
    createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), connect() {} }),
  };
  return { ctx: ctx as unknown as AudioContext, created };
}

/** Decoded-buffer stand-in: `byteLength` doubles as a tag so tests can tell loaded samples apart. */
function fakeBuffer(tag: number): AudioBuffer {
  const sr = 1000;
  const ch = new Float32Array(2000);
  for (let i = 25; i < 1990; i++) ch[i] = i % 2 ? 0.4 : -0.4; // 25 leading, 10 trailing padding samples
  return { duration: 2, sampleRate: sr, numberOfChannels: 1, length: ch.length, getChannelData: () => ch, tag } as unknown as AudioBuffer;
}

/** Fetch stand-in: the byte length encodes the URL index so a decoded buffer maps to its URL. */
function fetcher(seen: string[] = []) {
  return async (url: string): Promise<ArrayBuffer> => { seen.push(url); return new ArrayBuffer(8 + seen.length); };
}

async function withSamples(manifest: { sfx?: Record<string, string>; music?: Record<string, string>; gains?: Record<string, number> }, ctxOverride?: ReturnType<typeof fakeCtx>) {
  const f = ctxOverride ?? fakeCtx();
  const a = createGameAudio(store().save, () => f.ctx, fetcher());
  await a.loadSamples({ sfx: manifest.sfx ?? {}, music: manifest.music ?? {}, gains: manifest.gains });
  return { f, a };
}

afterEach(() => { vi.useRealTimers(); });

describe('createGameAudio', () => {
  it('stub mode never throws and still persists mute', async () => {
    const s = store();
    const a = createGameAudio(s.save, () => null);
    a.unlock(); a.sfx('click'); a.music.start(); a.music.setLayers(3); a.music.stop(); a.setAdPaused(true);
    await a.toggleMute();
    expect(a.muted).toBe(true);
    expect(s.m.get('g:muted')).toBe('1');
    await a.toggleMute();
    expect(s.m.get('g:muted')).toBe('0');
  });
  it('factory that throws is a stub', () => {
    const a = createGameAudio(store().save, () => { throw new Error('no'); });
    expect(() => { a.unlock(); a.sfx('death'); }).not.toThrow();
  });
  it('loadMuted restores', async () => {
    const s = store();
    s.m.set('g:muted', '1');
    const a = createGameAudio(s.save, () => null);
    await a.loadMuted();
    expect(a.muted).toBe(true);
  });
  it('sfx is a no-op before unlock, plays after', () => {
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx);
    a.sfx('nearMiss', { step: 2 });
    expect(f.created.osc).toBe(0);
    a.unlock();
    a.sfx('nearMiss', { step: 2 });
    expect(f.created.osc).toBeGreaterThanOrEqual(1);
  });
  it('every sfx preset runs after unlock', () => {
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx);
    a.unlock();
    for (const n of ['nearMiss', 'pickup', 'shield', 'shieldBreak', 'death', 'medal', 'click', 'rush', 'newBest'] as const) {
      expect(() => a.sfx(n)).not.toThrow();
    }
  });
  it('ad pause zeroes master gain; resume restores per mute', async () => {
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx);
    a.unlock();
    const master = f.created.gains[0]!;
    a.setAdPaused(true);
    expect(master.gain.value).toBe(0);
    a.setAdPaused(false);
    expect(master.gain.value).toBe(1);
    await a.toggleMute();
    a.setAdPaused(true); a.setAdPaused(false);
    expect(master.gain.value).toBe(0);
  });
  it('ad pause suspends and resumes the context once unlocked; never throws', async () => {
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx);
    a.setAdPaused(true); // not unlocked: must not touch ctx
    expect(f.ctx.state).toBe('suspended');
    a.setAdPaused(false);
    a.unlock();
    await Promise.resolve();
    expect(f.ctx.state).toBe('running');
    a.setAdPaused(true);
    expect(f.ctx.state).toBe('suspended');
    a.setAdPaused(false);
    await Promise.resolve();
    expect(f.ctx.state).toBe('running');
    (f.ctx as unknown as { suspend: () => never }).suspend = () => { throw new Error('x'); };
    expect(() => a.setAdPaused(true)).not.toThrow();
  });
  it('rotates tracks and switches music modes cleanly', () => {
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx);
    expect(a.music.trackIndex).toBe(0);
    expect(a.music.mode).toBe('normal');
    a.music.nextTrack();
    expect(a.music.trackIndex).toBe(1);
    a.music.setTrack(TRACKS.length);
    expect(a.music.trackIndex).toBe(0);
    a.music.setTrack(-1);
    expect(a.music.trackIndex).toBe(TRACKS.length - 1);
    a.music.setMode('rush');
    expect(a.music.mode).toBe('rush');
    a.music.setMode('chomp');
    expect(a.music.mode).toBe('chomp');
    a.music.setMode('overdrive');
    expect(a.music.mode).toBe('overdrive');
    a.music.setMode('normal');
    expect(a.music.mode).toBe('normal');
  });
  it('randomTrack picks a different track each time', () => {
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx);
    for (let i = 0; i < 20; i++) {
      const before = a.music.trackIndex;
      a.music.randomTrack(() => (i % 10) / 10);
      expect(a.music.trackIndex).not.toBe(before);
      expect(a.music.trackIndex).toBeGreaterThanOrEqual(0);
      expect(a.music.trackIndex).toBeLessThan(TRACKS.length);
    }
    a.music.setTrack(0);
    a.music.randomTrack(() => 0.99);
    expect(a.music.trackIndex).toBe(2);
    a.music.randomTrack(() => 0);
    expect(a.music.trackIndex).toBe(0);
  });
  it('balances music bus louder than sfx bus for mobile speakers', () => {
    expect(MUSIC_BUS).toBeGreaterThan(SFX_BUS);
    expect(MUSIC_BUS).toBeGreaterThanOrEqual(0.5);
  });
});

describe('sample playback', () => {
  it('plays a loaded sfx sample through a BufferSource with no oscillator', async () => {
    const { f, a } = await withSamples({ sfx: { pickup: 'sfx-pickup.mp3' } });
    a.unlock();
    a.sfx('pickup');
    expect(f.created.sources).toHaveLength(1);
    expect(f.created.sources[0]!.started).toBe(true);
    expect(f.created.osc).toBe(0);
  });
  it('pitches a sample per combo step via playbackRate', async () => {
    const { f, a } = await withSamples({ sfx: { nearMiss: 'sfx-nearMiss.mp3' } });
    a.unlock();
    a.sfx('nearMiss', { step: 12 });
    expect(f.created.sources[0]!.playbackRate.value).toBeCloseTo(2, 3);
  });
  it('uses the synth oscillator when no sample is loaded for that name', async () => {
    const { f, a } = await withSamples({ sfx: { pickup: 'sfx-pickup.mp3' } });
    a.unlock();
    a.sfx('click');
    expect(f.created.osc).toBeGreaterThanOrEqual(1);
  });
  it('a failed fetch keeps the synth fallback and never throws', async () => {
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx, async () => { throw new Error('404'); });
    await expect(a.loadSamples({ sfx: { pickup: 'x' }, music: { 'music-normal': 'y' } })).resolves.toBeUndefined();
    a.unlock();
    a.sfx('pickup');
    expect(f.created.osc).toBeGreaterThanOrEqual(1);
    a.music.start();
    expect(a.state.musicSource).toBe('synth');
  });
  it('loadSamples without a context resolves (stub mode)', async () => {
    const a = createGameAudio(store().save, () => null);
    await expect(a.loadSamples({ sfx: { pickup: 'x' }, music: {} })).resolves.toBeUndefined();
  });
  it('loops a music sample between the trimmed encoder-padding points', async () => {
    const { f, a } = await withSamples({ music: { 'music-normal': 'm.mp3' } });
    a.unlock();
    a.music.start();
    expect(a.state.musicSource).toBe('sample');
    const src = f.created.sources[0]!;
    expect(src.loop).toBe(true);
    expect(src.loopStart).toBeCloseTo(0.025, 5);
    expect(src.loopEnd).toBeCloseTo(1.99, 5);
    expect(f.created.osc).toBe(0);
  });
  it('does not run the synth sequencer while a music sample plays', async () => {
    vi.useFakeTimers();
    const { f, a } = await withSamples({ music: { 'music-normal': 'm.mp3' } });
    a.unlock();
    a.music.start();
    vi.advanceTimersByTime(500);
    expect(f.created.osc).toBe(0);
  });
  it('crossfades to the rush loop and back, stopping the faded-out source', async () => {
    vi.useFakeTimers();
    const { f, a } = await withSamples({ music: { 'music-normal': 'n.mp3', 'music-rush': 'r.mp3' } });
    a.unlock();
    a.music.start();
    a.music.setMode('rush');
    expect(f.created.sources).toHaveLength(2);
    expect(a.state.musicSample).toBe('music-rush');
    vi.advanceTimersByTime(600);
    expect(f.created.sources[0]!.stopped).toBe(true);
    expect(f.created.sources[1]!.stopped).toBe(false);
    a.music.setMode('normal');
    expect(a.state.musicSample).toBe('music-normal');
    expect(f.created.sources).toHaveLength(3);
  });
  it('falls back to the synth sequencer for a mode without a sample', async () => {
    vi.useFakeTimers();
    const { f, a } = await withSamples({ music: { 'music-normal': 'n.mp3' } });
    a.unlock();
    a.music.start();
    a.music.setMode('chomp');
    expect(a.state.musicSource).toBe('synth');
    (f.ctx as unknown as { currentTime: number }).currentTime += 1;
    vi.advanceTimersByTime(100);
    expect(f.created.osc).toBeGreaterThan(0);
  });
  it('stop() silences the sample and start() resumes it', async () => {
    vi.useFakeTimers();
    const { f, a } = await withSamples({ music: { 'music-normal': 'n.mp3' } });
    a.unlock();
    a.music.start();
    a.music.stop();
    vi.advanceTimersByTime(600);
    expect(f.created.sources[0]!.stopped).toBe(true);
    expect(a.state.musicSource).toBe('none');
    a.music.start();
    expect(f.created.sources).toHaveLength(2);
    expect(a.state.musicSource).toBe('sample');
  });
  it('start() twice does not stack a second loop', async () => {
    const { f, a } = await withSamples({ music: { 'music-normal': 'n.mp3' } });
    a.unlock();
    a.music.start();
    a.music.start();
    expect(f.created.sources).toHaveLength(1);
  });
  it('samples that finish loading after music started take over from the synth', async () => {
    vi.useFakeTimers();
    const f = fakeCtx();
    const a = createGameAudio(store().save, () => f.ctx, fetcher());
    a.unlock();
    a.music.start();
    expect(a.state.musicSource).toBe('synth');
    await a.loadSamples({ sfx: {}, music: { 'music-normal': 'n.mp3' } });
    expect(a.state.musicSource).toBe('sample');
  });
  it('music waits for unlock, then starts the sample', async () => {
    const { f, a } = await withSamples({ music: { 'music-normal': 'n.mp3' } });
    a.music.start();
    expect(f.created.sources).toHaveLength(0);
    a.unlock();
    expect(a.state.musicSource).toBe('sample');
  });
  it('mute and ad pause still gate sample audio through the master gain', async () => {
    const { f, a } = await withSamples({ music: { 'music-normal': 'n.mp3' }, sfx: { pickup: 'p.mp3' } });
    a.unlock();
    a.music.start();
    const master = f.created.gains[0]!;
    await a.toggleMute();
    expect(master.gain.value).toBe(0);
    await a.toggleMute();
    expect(master.gain.value).toBe(1);
    a.setAdPaused(true);
    expect(master.gain.value).toBe(0);
    expect(f.ctx.state).toBe('suspended');
  });
});

describe('mix', () => {
  it('buses sit at their constants with a music sample loaded; mute drives the master to 0', async () => {
    const { f, a } = await withSamples({ music: { 'music-normal': 'n.mp3' } });
    a.unlock();
    a.music.start();
    const [master, sfxBus, musicBus] = f.created.gains;
    expect(sfxBus!.gain.value).toBe(SFX_BUS);
    expect(musicBus!.gain.value).toBe(MUSIC_BUS);
    await a.toggleMute();
    expect(master!.gain.value).toBe(0);
    expect(musicBus!.gain.value).toBe(MUSIC_BUS);
  });
  it('applies a per-track gain to the music loop', async () => {
    const { f, a } = await withSamples({ music: { 'music-overdrive': 'o.mp3' }, gains: { 'music-overdrive': 1.2 } });
    a.unlock();
    a.music.setMode('overdrive');
    a.music.start();
    const voiceGain = f.created.gains[f.created.gains.length - 1]!;
    expect(voiceGain.gain.ramps[voiceGain.gain.ramps.length - 1]).toBeCloseTo(1.2, 5);
  });
  it('applies a per-sfx gain and defaults to 1', async () => {
    const { f, a } = await withSamples({ sfx: { pickup: 'p.mp3', death: 'd.mp3' }, gains: { pickup: 1.5 } });
    a.unlock();
    a.sfx('pickup');
    expect(f.created.gains[f.created.gains.length - 1]!.gain.value).toBeCloseTo(1.5, 5);
    a.sfx('death');
    expect(f.created.gains[f.created.gains.length - 1]!.gain.value).toBe(1);
  });
});
