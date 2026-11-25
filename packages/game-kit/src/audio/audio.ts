import type { SaveData } from '../save.ts';
import {
  CHOMP_TRACK,
  LAYERS,
  RUSH_DRUMS,
  TRACKS,
  modeBpm,
  stepsToSchedule,
  type DrumHit,
  type MusicMode,
  type MusicTrack,
} from './music.ts';
import { computeLoopPoints, SampleBank, sfxRate, type Fetcher } from './samples.ts';
import { noise, playSfx, tone, type SfxName } from './sfx.ts';

export type { SfxName, MusicMode };

/** Sample files for a game: `sfx` keyed by SfxName, `music` keyed by `music-<MusicMode>`. Anything missing falls back to synth. */
export interface AudioManifest {
  sfx: Record<string, string>;
  music: Record<string, string>;
}

/** Test/debug view of what the music engine is doing right now. */
export interface AudioState {
  musicSource: 'sample' | 'synth' | 'none';
  /** Name of the playing music sample (`music-<mode>`), or null. */
  musicSample: string | null;
  /** Names of every sample decoded so far. */
  loaded: string[];
}

export interface GameAudio {
  sfx(name: SfxName, opts?: { step?: number }): void;
  music: {
    start(): void;
    stop(): void;
    setLayers(n: 1 | 2 | 3 | 4): void;
    setMode(mode: MusicMode): void;
    nextTrack(): void;
    /** Jump to a random track other than the current one. */
    randomTrack(rng?: () => number): void;
    setTrack(index: number): void;
    readonly trackIndex: number;
    readonly mode: MusicMode;
  };
  readonly muted: boolean;
  toggleMute(): Promise<void>;
  unlock(): void;
  setAdPaused(paused: boolean): void;
  loadMuted(): Promise<void>;
  /** Fetch and decode the manifest's samples; never rejects (failures leave the synth fallback in place). */
  loadSamples(manifest: AudioManifest, onProgress?: (ratio: number) => void): Promise<void>;
  readonly state: AudioState;
}

/** Balanced for mobile speakers as well as headphones (music audible at ~30-40% volume, SFX crisp on top). */
export const SFX_BUS = 0.42;
export const MUSIC_BUS = 0.58;
const SCHEDULE_AHEAD = 0.1;
const TICK_MS = 25;
/** Crossfade between music sample loops (mode switches). */
const MUSIC_FADE = 0.4;
/** Quick fade when music stops, avoids a click. */
const MUSIC_STOP_FADE = 0.15;

interface MusicVoice {
  name: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

function defaultFactory(): AudioContext | null {
  const C = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return C ? new C() : null;
}

export function createGameAudio(save: SaveData, ctxFactory: () => AudioContext | null = defaultFactory, fetcher?: Fetcher): GameAudio {
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
  let mode: MusicMode = 'normal';
  let trackIdx = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextTime = 0;
  let stepIdx = 0;
  let wantMusic = false;
  let bank: SampleBank | null = null;
  let voice: MusicVoice | null = null;

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
        if (LAYERS[i]!.name === 'bass') {
          // Warm low-pass on sawtooth bass so upper harmonics stay clearly audible on mobile speakers.
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(950, ctx.currentTime);
          g.connect(lp);
          lp.connect(musicBus);
        } else {
          g.connect(musicBus);
        }
        layerGains.push(g);
      }
    } catch {
      ctx = null;
    }
  }

  function activeTrack(): MusicTrack {
    return mode === 'chomp' ? CHOMP_TRACK : TRACKS[trackIdx]!;
  }

  function effectiveLayers(): number {
    return mode === 'normal' ? layers : 4;
  }

  function applyMaster(): void {
    if (master) master.gain.value = muted || adPaused ? 0 : 1;
  }

  function applyLayerGains(fast: boolean): void {
    if (!ctx) return;
    const now = ctx.currentTime;
    const activeCount = effectiveLayers();
    const bpm = modeBpm(activeTrack(), mode);
    layerGains.forEach((g, i) => {
      const target = i < activeCount ? 1 : 0;
      const rampSec = fast ? 0.15 : target > g.gain.value ? (60 / bpm) * 4 : 0.3;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(target, now + rampSec);
    });
  }

  function playLayerStep(track: MusicTrack, stepSec: number, li: number, step: number, t: number): void {
    if (!ctx) return;
    const out = layerGains[li]!;
    const layer = track.layers[li]!;
    const v =
      layer.name === 'drums' && (mode === 'rush' || mode === 'overdrive')
        ? RUSH_DRUMS[step % RUSH_DRUMS.length]
        : layer.steps[step];
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      const hit: DrumHit = v;
      if (hit === 'k') tone(ctx, out, { type: 'sine', f0: 150, f1: 48, t, dur: 0.14, vol: 0.9 });
      else if (hit === 's') noise(ctx, out, { t, dur: 0.12, vol: 0.55, hp: 1200 });
      else noise(ctx, out, { t, dur: 0.04, vol: 0.28, hp: 6000 });
      return;
    }
    const hz = track.baseHz * 2 ** (v / 12);
    if (layer.name === 'bass') {
      tone(ctx, out, { type: 'sawtooth', f0: hz, t, dur: stepSec * 2.2, vol: 0.48 });
    } else if (layer.name === 'arp') {
      tone(ctx, out, { type: 'square', f0: hz * 4, t, dur: stepSec * 0.85, vol: 0.24 });
    } else if (mode === 'chomp') {
      tone(ctx, out, { type: 'square', f0: hz * 4, t, dur: stepSec * 1.4, vol: 0.34 });
    } else {
      tone(ctx, out, { type: 'triangle', f0: hz * 4, t, dur: stepSec * 1.8, vol: 0.56 });
    }
  }

  function tick(): void {
    if (!ctx) return;
    const track = activeTrack();
    const stepSec = 60 / modeBpm(track, mode) / 4;
    const stepsCount = track.layers[0]!.steps.length;
    const now = ctx.currentTime;
    if (nextTime < now) nextTime = now;
    if (stepIdx >= stepsCount) stepIdx = 0;
    for (const s of stepsToSchedule(now, now + SCHEDULE_AHEAD, nextTime, stepIdx, stepSec, stepsCount)) {
      for (let li = 0; li < track.layers.length; li++) playLayerStep(track, stepSec, li, s.step, s.time);
    }
    while (nextTime < now + SCHEDULE_AHEAD) {
      nextTime += stepSec;
      stepIdx = (stepIdx + 1) % stepsCount;
    }
  }

  function startTimer(): void {
    if (!ctx || !unlocked || timer !== null) return;
    nextTime = ctx.currentTime + 0.05;
    stepIdx = 0;
    timer = setInterval(tick, TICK_MS);
  }

  function stopTimer(): void {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function fadeOut(v: MusicVoice, sec: number): void {
    if (!ctx) return;
    const now = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, now + sec);
    v.src.stop(now + sec + 0.05);
  }

  function stopVoice(sec: number): void {
    if (!voice) return;
    const v = voice;
    voice = null;
    try {
      fadeOut(v, sec);
    } catch {
      /* never throw from audio */
    }
  }

  /** Loop `buf` on the music bus from its trimmed start, fading in over MUSIC_FADE. */
  function startVoice(name: string, buf: AudioBuffer): void {
    if (!ctx || !musicBus) return;
    const prev = voice;
    voice = null;
    if (prev) fadeOut(prev, MUSIC_FADE);
    const now = ctx.currentTime;
    const channels: Float32Array[] = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
    const loop = computeLoopPoints(channels, buf.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = loop.start;
    src.loopEnd = loop.end;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + MUSIC_FADE);
    src.connect(gain);
    gain.connect(musicBus);
    src.start(now, loop.start);
    voice = { name, src, gain };
  }

  /** Picks sample loop or synth sequencer for the current mode; safe to call from any state change. */
  function syncMusic(): void {
    if (!ctx || !unlocked || !wantMusic) return;
    try {
      const name = `music-${mode}`;
      const buf = bank?.get(name);
      if (buf) {
        stopTimer();
        if (voice?.name !== name) startVoice(name, buf);
      } else {
        stopVoice(MUSIC_FADE);
        startTimer();
      }
    } catch {
      /* never throw from audio */
    }
  }

  const audio: GameAudio = {
    sfx(name, opts) {
      if (!ctx || !unlocked || !sfxBus) return;
      try {
        const buf = bank?.get(name);
        if (buf) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = sfxRate(opts?.step ?? 0);
          src.connect(sfxBus);
          src.start(ctx.currentTime);
          return;
        }
        playSfx(ctx, sfxBus, name, opts?.step ?? 0);
      } catch {
        /* never throw from audio */
      }
    },
    music: {
      start() {
        wantMusic = true;
        syncMusic();
      },
      stop() {
        wantMusic = false;
        stopTimer();
        stopVoice(MUSIC_STOP_FADE);
      },
      setLayers(n) {
        layers = n;
        applyLayerGains(false);
      },
      setMode(next) {
        if (next === mode) return;
        const chompBoundary = next === 'chomp' || mode === 'chomp';
        mode = next;
        if (chompBoundary) stepIdx = 0;
        applyLayerGains(true);
        syncMusic();
      },
      nextTrack() {
        trackIdx = (trackIdx + 1) % TRACKS.length;
        stepIdx = 0;
      },
      randomTrack(rng = Math.random) {
        if (TRACKS.length < 2) return;
        const r = Math.min(TRACKS.length - 2, Math.floor(rng() * (TRACKS.length - 1)));
        trackIdx = r >= trackIdx ? r + 1 : r;
        stepIdx = 0;
      },
      setTrack(index) {
        trackIdx = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
        stepIdx = 0;
      },
      get trackIndex() {
        return trackIdx;
      },
      get mode() {
        return mode;
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
        syncMusic();
      } catch {
        /* ignore */
      }
    },
    setAdPaused(paused) {
      adPaused = paused;
      applyMaster();
      if (ctx && unlocked) {
        try {
          void Promise.resolve(paused ? ctx.suspend() : ctx.resume()).catch(() => {});
        } catch {
          /* never throw from audio */
        }
      }
    },
    async loadMuted() {
      muted = (await save.getNumber('muted', 0)) === 1;
      applyMaster();
    },
    async loadSamples(manifest, onProgress) {
      if (!ctx) {
        onProgress?.(1);
        return;
      }
      try {
        bank ??= new SampleBank(ctx, fetcher);
        await bank.load({ ...manifest.sfx, ...manifest.music }, onProgress);
        syncMusic();
      } catch {
        /* never throw from audio */
      }
    },
    get state(): AudioState {
      return {
        musicSource: voice ? 'sample' : timer !== null ? 'synth' : 'none',
        musicSample: voice?.name ?? null,
        loaded: bank ? bank.names() : [],
      };
    },
  };
  return audio;
}
