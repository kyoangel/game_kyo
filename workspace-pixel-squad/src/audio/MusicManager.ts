import type Phaser from 'phaser';
import { MUSIC_ASSETS, MUSIC_LOOP_KEYS, MUSIC_VOLUME, MUSIC_FADE_MS, type MusicKey } from '../data/audio';

const MUTE_STORAGE_KEY = 'pixel-squad:musicMuted';
const FADE_STEPS = 10;

interface FadableSound {
  volume: number;
  play(): void;
  stop(): void;
  destroy(): void;
}

export class MusicManager {
  private sound: Phaser.Sound.BaseSoundManager;
  private muted: boolean;
  private currentKey?: MusicKey;
  private currentSound?: FadableSound;
  private fadeInterval?: ReturnType<typeof setInterval>;

  constructor(sound: Phaser.Sound.BaseSoundManager) {
    this.sound = sound;
    this.muted = MusicManager.loadMuted();
  }

  static loadMuted(): boolean {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  }

  static preload(scene: Phaser.Scene): void {
    Object.entries(MUSIC_ASSETS).forEach(([key, path]) => scene.load.audio(key, path));
  }

  playTrack(key: MusicKey): void {
    if (key === this.currentKey && this.currentSound) {
      return;
    }

    const loop = MUSIC_LOOP_KEYS.has(key);
    const targetVolume = this.muted ? 0 : MUSIC_VOLUME;

    let newSound: FadableSound;
    try {
      newSound = this.sound.add(key, { loop, volume: 0 }) as unknown as FadableSound;
      newSound.play();
    } catch {
      return;
    }

    const oldSound = this.currentSound;
    this.currentSound = newSound;
    this.currentKey = key;

    if (!oldSound) {
      newSound.volume = targetVolume;
      return;
    }

    this.crossfade(oldSound, newSound, targetVolume);
  }

  private crossfade(oldSound: FadableSound, newSound: FadableSound, targetVolume: number): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }

    const oldStartVolume = oldSound.volume;
    let step = 0;
    this.fadeInterval = setInterval(() => {
      step += 1;
      const progress = Math.min(step / FADE_STEPS, 1);
      newSound.volume = targetVolume * progress;
      oldSound.volume = oldStartVolume * (1 - progress);
      if (progress >= 1) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = undefined;
      }
    }, MUSIC_FADE_MS / FADE_STEPS);

    setTimeout(() => {
      newSound.volume = targetVolume;
      oldSound.stop();
      oldSound.destroy();
    }, MUSIC_FADE_MS);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted));
    if (this.currentSound) {
      this.currentSound.volume = this.muted ? 0 : MUSIC_VOLUME;
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

export function getMusic(scene: Phaser.Scene): MusicManager {
  if (!scene.game.registry.has('music')) {
    scene.game.registry.set('music', new MusicManager(scene.sound));
  }
  return scene.game.registry.get('music') as MusicManager;
}
