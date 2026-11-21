import { pentatonic } from './notes.ts';

export type SfxName = 'nearMiss' | 'pickup' | 'shield' | 'shieldBreak' | 'death' | 'medal' | 'click' | 'rush' | 'newBest';

export function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function tone(ctx: AudioContext, out: AudioNode, o: { type: OscillatorType; f0: number; f1?: number; t: number; dur: number; vol?: number }): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f0, o.t);
  if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.t + o.dur);
  const v = o.vol ?? 0.6;
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.linearRampToValueAtTime(v, o.t + Math.min(0.005, o.dur / 2));
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  osc.connect(g);
  g.connect(out);
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.02);
}

export function noise(ctx: AudioContext, out: AudioNode, o: { t: number; dur: number; vol?: number; hp?: number }): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, o.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.5, o.t);
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  let node: AudioNode = src;
  if (o.hp) {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(o.hp, o.t);
    src.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(out);
  src.start(o.t);
  src.stop(o.t + o.dur + 0.02);
}

export function playSfx(ctx: AudioContext, out: AudioNode, name: SfxName, step = 0): void {
  const t = ctx.currentTime;
  switch (name) {
    case 'nearMiss':
      tone(ctx, out, { type: 'triangle', f0: pentatonic(step, 523.25), t, dur: 0.08 });
      break;
    case 'pickup':
      tone(ctx, out, { type: 'square', f0: 660, t, dur: 0.07, vol: 0.4 });
      tone(ctx, out, { type: 'square', f0: 990, t: t + 0.07, dur: 0.1, vol: 0.4 });
      break;
    case 'shield':
      tone(ctx, out, { type: 'sine', f0: 300, f1: 900, t, dur: 0.25 });
      break;
    case 'shieldBreak':
      noise(ctx, out, { t, dur: 0.25, vol: 0.6 });
      tone(ctx, out, { type: 'sine', f0: 120, f1: 40, t, dur: 0.2, vol: 0.8 });
      break;
    case 'death':
      tone(ctx, out, { type: 'sawtooth', f0: 400, f1: 60, t, dur: 0.5, vol: 0.5 });
      noise(ctx, out, { t, dur: 0.4, vol: 0.4 });
      break;
    case 'medal':
      [523.25, 659.25, 783.99].forEach((f, i) => tone(ctx, out, { type: 'triangle', f0: f, t: t + i * 0.09, dur: 0.15 }));
      break;
    case 'click':
      tone(ctx, out, { type: 'square', f0: 880, t, dur: 0.03, vol: 0.3 });
      break;
    case 'rush':
      tone(ctx, out, { type: 'sawtooth', f0: 200, f1: 1200, t, dur: 0.4, vol: 0.35 });
      break;
    case 'newBest':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, out, { type: 'triangle', f0: f, t: t + i * 0.1, dur: 0.18 }));
      break;
  }
}
