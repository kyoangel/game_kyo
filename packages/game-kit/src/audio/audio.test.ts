import { describe, expect, it } from 'vitest';
import { SaveData } from '../save.ts';
import { createGameAudio } from './audio.ts';

function store() {
  const m = new Map<string, string>();
  return { m, save: new SaveData({ get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) }, 'g') };
}

function fakeCtx() {
  const created = { osc: 0, gains: [] as Array<{ gain: { value: number } }> };
  const param = () => ({
    value: 1,
    setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
    setTargetAtTime() {}, cancelScheduledValues() {},
  });
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
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
    createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), connect() {} }),
  };
  return { ctx: ctx as unknown as AudioContext, created };
}

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
});
