import type { SaveData } from '../save.ts';
import { BPM, LAYERS, STEPS, STEP_SEC, stepsToSchedule, type DrumHit } from './music.ts';
import { noise, playSfx, tone, type SfxName } from './sfx.ts';

export type { SfxName };

export interface GameAudio {
  sfx(name: SfxName, opts?: { step?: number }): void;
  music: { start(): void; stop(): void; setLayers(n: 1 | 2 | 3 | 4): void };
  readonly muted: boolean;
  toggleMute(): Promise<void>;
  unlock(): void;
  setAdPaused(paused: boolean): void;
  loadMuted(): Promise<void>;
}

const SFX_BUS = 0.5;
const MUSIC_BUS = 0.25;
const SCHEDULE_AHEAD = 0.1;
const TICK_MS = 25;
const BASS_HZ = 110;

function defaultFactory(): AudioContext | null {
  const C = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return C ? new C() : null;
}

export function createGameAudio(save: SaveData, ctxFactory: () => AudioContext | null = defaultFactory): GameAudio {
  let muted = false;
  let adPaused = false;
  let unlocked = false;
  let ctx: AudioContext | null = null;
  try {
    ctx = ctxFactory();
  } catch {
    ctx = null;
  }

  let master: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let musicBus: GainNode | null = null;
  const layerGains: GainNode[] = [];
  let layers = 1;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextTime = 0;
  let stepIdx = 0;
  let wantMusic = false;

  if (ctx) {
    try {
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = SFX_BUS;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_BUS;
      musicBus.connect(master);
      for (let i = 0; i < LAYERS.length; i++) {
        const g = ctx.createGain();
        g.gain.value = i < layers ? 1 : 0;
        g.connect(musicBus);
        layerGains.push(g);
      }
    } catch {
      ctx = null;
    }
  }

  function applyMaster(): void {
    if (master) master.gain.value = muted || adPaused ? 0 : 1;
  }

  function playLayerStep(li: number, step: number, t: number): void {
    if (!ctx) return;
    const out = layerGains[li]!;
    const v = LAYERS[li]!.steps[step];
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      const hit: DrumHit = v;
      if (hit === 'k') tone(ctx, out, { type: 'sine', f0: 140, f1: 45, t, dur: 0.15, vol: 0.9 });
      else if (hit === 's') noise(ctx, out, { t, dur: 0.12, vol: 0.5, hp: 1200 });
      else noise(ctx, out, { t, dur: 0.04, vol: 0.25, hp: 6000 });
      return;
    }
    const name = LAYERS[li]!.name;
    const hz = BASS_HZ * 2 ** (v / 12);
    if (name === 'bass') tone(ctx, out, { type: 'triangle', f0: hz, t, dur: STEP_SEC * 3, vol: 0.8 });
    else if (name === 'arp') tone(ctx, out, { type: 'square', f0: hz * 4, t, dur: STEP_SEC * 0.9, vol: 0.2 });
    else tone(ctx, out, { type: 'triangle', f0: hz * 4, t, dur: STEP_SEC * 1.8, vol: 0.4 });
  }

  function tick(): void {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (nextTime < now) nextTime = now;
    for (const s of stepsToSchedule(now, now + SCHEDULE_AHEAD, nextTime, stepIdx)) {
      for (let li = 0; li < LAYERS.length; li++) playLayerStep(li, s.step, s.time);
    }
    // advance cursor past everything scheduled
    while (nextTime < now + SCHEDULE_AHEAD) {
      nextTime += STEP_SEC;
      stepIdx = (stepIdx + 1) % STEPS;
    }
  }

  function startTimer(): void {
    if (!ctx || !unlocked || timer !== null) return;
    nextTime = ctx.currentTime + 0.05;
    stepIdx = 0;
    timer = setInterval(tick, TICK_MS);
  }

  const audio: GameAudio = {
    sfx(name, opts) {
      if (!ctx || !unlocked || !sfxBus) return;
      try {
        playSfx(ctx, sfxBus, name, opts?.step ?? 0);
      } catch {
        /* never throw from audio */
      }
    },
    music: {
      start() {
        wantMusic = true;
        try {
          startTimer();
        } catch {
          /* ignore */
        }
      },
      stop() {
        wantMusic = false;
        if (timer !== null) clearInterval(timer);
        timer = null;
      },
      setLayers(n) {
        layers = n;
        if (!ctx) return;
        const now = ctx.currentTime;
        layerGains.forEach((g, i) => {
          const target = i < n ? 1 : 0;
          const rampSec = target > g.gain.value ? 60 / BPM * 4 : 0.3;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(target, now + rampSec);
        });
      },
    },
    get muted() {
      return muted;
    },
    async toggleMute() {
      muted = !muted;
      applyMaster();
      try {
        await save.setNumber('muted', muted ? 1 : 0);
      } catch {
        /* ignore */
      }
    },
    unlock() {
      if (!ctx || unlocked) return;
      unlocked = true;
      try {
        void Promise.resolve(ctx.resume()).catch(() => {});
        applyMaster();
        if (wantMusic) startTimer();
      } catch {
        /* ignore */
      }
    },
    setAdPaused(paused) {
      adPaused = paused;
      applyMaster();
    },
    async loadMuted() {
      muted = (await save.getNumber('muted', 0)) === 1;
      applyMaster();
    },
  };
  return audio;
}
