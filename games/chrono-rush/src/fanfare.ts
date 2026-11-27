/** Procedural 8-bit JRPG Victory Fanfare & Defeat Jingle using Web Audio API. */

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function playNote(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'square',
  vol = 0.14,
): void {
  const t = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

/** 100% original heroic 8-bit D-major ascending victory fanfare. */
export function playVictoryFanfare(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Original rising arcade-RPG arpeggio + triumphant high D6 chord
  const melody: Array<[number, number, number]> = [
    [587.33, 0.0, 0.10],  // D5
    [739.99, 0.11, 0.10], // F#5
    [880.0, 0.22, 0.16],  // A5
    [783.99, 0.40, 0.10], // G5
    [880.0, 0.51, 0.10],  // A5
    [987.77, 0.62, 0.14], // B5
    [1174.66, 0.78, 0.62], // D6!
  ];
  for (const [f, s, d] of melody) {
    playNote(ctx, f, s, d, 'square', 0.12);
    playNote(ctx, f * 0.5, s, d, 'triangle', 0.12);
  }
  // Sparkling final major triad bloom (F#5 + A5)
  playNote(ctx, 739.99, 0.78, 0.58, 'triangle', 0.09);
  playNote(ctx, 880.0, 0.78, 0.58, 'triangle', 0.09);
  setTimeout(() => void ctx.close().catch(() => {}), 1800);
}

/** Retro descending 8-bit Defeat / Time-Up jingle. */
export function playDefeatJingle(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes: Array<[number, number, number]> = [
    [392.0, 0.0, 0.18],   // G4
    [369.99, 0.20, 0.18], // F#4
    [349.23, 0.40, 0.18], // F4
    [311.13, 0.60, 0.52], // Eb4
  ];
  for (const [f, s, d] of notes) {
    playNote(ctx, f, s, d, 'sawtooth', 0.1);
    playNote(ctx, f * 0.5, s, d, 'triangle', 0.12);
  }
  setTimeout(() => void ctx.close().catch(() => {}), 1400);
}

/** Heavenly celestial harp arpeggio for the Time Goddess revival cutscene. */
export function playGoddessReviveChime(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const arp: Array<[number, number, number]> = [
    [523.25, 0.0, 0.32],  // C5
    [659.25, 0.09, 0.32], // E5
    [783.99, 0.18, 0.34], // G5
    [987.77, 0.27, 0.36], // B5
    [1046.5, 0.36, 0.42], // C6
    [1318.5, 0.48, 0.55], // E6
    [1567.98, 0.62, 0.72], // G6!
  ];
  for (const [f, s, d] of arp) {
    playNote(ctx, f, s, d, 'triangle', 0.12);
    playNote(ctx, f * 0.5, s, d, 'sine', 0.09);
  }
  // Radiant spell-cast shimmer chord at t = 1.15s
  playNote(ctx, 1046.5, 1.15, 0.65, 'triangle', 0.11);
  playNote(ctx, 1318.5, 1.18, 0.65, 'triangle', 0.1);
  playNote(ctx, 1567.98, 1.22, 0.7, 'sine', 0.12);
  setTimeout(() => void ctx.close().catch(() => {}), 2200);
}
