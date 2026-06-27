import type Phaser from 'phaser';
import { SFX_ASSETS, type SfxKey } from '../data/audio';

const MUTE_STORAGE_KEY = 'pixel-squad:sfxMuted';

export class SfxManager {
  private sound: Phaser.Sound.BaseSoundManager;
  private muted: boolean;

  constructor(sound: Phaser.Sound.BaseSoundManager) {
    this.sound = sound;
    this.muted = SfxManager.loadMuted();
    this.sound.mute = this.muted;
  }

  static loadMuted(): boolean {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  }

  static preload(scene: Phaser.Scene): void {
    Object.entries(SFX_ASSETS).forEach(([key, path]) => scene.load.audio(key, path));
  }

  play(key: SfxKey): void {
    this.sound.play(key);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.sound.mute = this.muted;
    localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted));
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

export function getSfx(scene: Phaser.Scene): SfxManager {
  if (!scene.game.registry.has('sfx')) {
    scene.game.registry.set('sfx', new SfxManager(scene.sound));
  }
  return scene.game.registry.get('sfx') as SfxManager;
}
