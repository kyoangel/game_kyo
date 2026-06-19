export type AudioEvent =
  | "move"
  | "eliminate"
  | "combo"
  | "spawn"
  | "gameOver"
  | "hammer"
  | "shuffle"
  | "addOne"
  | "bomb";

const MUTE_KEY = "mathMerge10Muted";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private _muted: boolean;

  constructor() {
    this._muted = localStorage.getItem(MUTE_KEY) === "true";
  }

  get isMuted(): boolean {
    return this._muted;
  }

  toggleMute(): void {
    this._muted = !this._muted;
    localStorage.setItem(MUTE_KEY, String(this._muted));
  }

  play(event: AudioEvent, options?: { comboCount?: number }): void {
    if (this._muted) return;
    const ctx = this.getCtx();
    switch (event) {
      case "move":      this.tone(ctx, 440, "sine", 0.08, 0.03); break;
      case "eliminate": this.rise(ctx, 523, 784, 0.2); break;
      case "combo":     this.combo(ctx, options?.comboCount ?? 2); break;
      case "spawn":     this.tone(ctx, 880, "triangle", 0.06, 0.02); break;
      case "gameOver":  this.fall(ctx, [784, 659, 523, 440], 0.6); break;
      case "hammer":    this.tone(ctx, 220, "square", 0.1, 0.04); break;
      case "shuffle":   this.shufflePops(ctx); break;
      case "addOne":    this.tone(ctx, 660, "sine", 0.1, 0.05); break;
      case "bomb":      this.boom(ctx); break;
    }
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    duration: number,
    attack: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + attack);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  private rise(ctx: AudioContext, from: number, to: number, duration: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.linearRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  private combo(ctx: AudioContext, count: number): void {
    const notes = count >= 3 ? [523, 659, 784, 1047] : [523, 659, 784];
    const step = 0.08;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.linearRampToValueAtTime(0, t + step);
      osc.start(t);
      osc.stop(t + step + 0.01);
    });
  }

  private fall(ctx: AudioContext, freqs: number[], total: number): void {
    const step = total / freqs.length;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0, t + step);
      osc.start(t);
      osc.stop(t + step + 0.01);
    });
  }

  private shufflePops(ctx: AudioContext): void {
    for (let i = 0; i < 5; i++) {
      const freq = 600 + i * 80;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.04;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.04);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  private boom(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.2);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}
