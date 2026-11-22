import Phaser from 'phaser';
import type { AdResult, Platform } from '@gf/platform';
import type { GameAudio } from './audio/audio.ts';
import type { GameDefinition } from './defineGame.ts';
import type { SaveData } from './save.ts';
import { createInput, type GameInput } from './input/input.ts';
import { createFx, type Fx } from './juice/fx.ts';
import type { GameSession } from './session.ts';
import { markButtonTap } from './ui/button.ts';
import { RunFlow } from './runFlow.ts';
import { fullscreenAvailable } from './ui/fullscreenSupport.ts';
import { resolveTheme, type Theme } from './theme.ts';

export const KIT_KEY = 'gk:kit';
export const OVERLAY_KEY = 'GKGameOver';

export interface GameOverOptions {
  revive?: () => void;
}

export interface OverlayData {
  score: number;
  newBest: boolean;
  offerRevive: boolean;
}

/** Facade handed to scenes via getKit(scene). Scene switching lives here; state lives in GameSession. */
export class Kit {
  readonly game: Phaser.Game;
  readonly session: GameSession;
  readonly platform: Platform;
  readonly def: GameDefinition;
  readonly save: SaveData;
  readonly audio: GameAudio;
  readonly theme: Theme;
  readonly flow = new RunFlow();
  private readonly translate: (key: string) => string;
  private overlayUp = false;
  private reviveCb: (() => void) | undefined;
  private playKeyCache: string | undefined;

  constructor(game: Phaser.Game, session: GameSession, platform: Platform, t: (key: string) => string, def: GameDefinition, save: SaveData, audio: GameAudio) {
    this.game = game;
    this.session = session;
    this.platform = platform;
    this.translate = t;
    this.def = def;
    this.save = save;
    this.audio = audio;
    this.theme = resolveTheme(def.theme);
  }

  t(key: string): string {
    return this.translate(key);
  }

  /** Key of the play scene registered by def.playScene. */
  get playKey(): string {
    if (!this.playKeyCache) {
      try {
        this.playKeyCache = new this.def.playScene().sys.settings.key || 'Play';
      } catch {
        this.playKeyCache = 'Play';
      }
    }
    return this.playKeyCache;
  }

  start(): void {
    this.flow.reset();
    this.overlayUp = false;
    this.session.start();
    this.switchTo(this.playKey);
  }

  async gameOver(score: number, opts?: GameOverOptions): Promise<void> {
    if (this.overlayUp || this.session.state !== 'playing') return;
    this.overlayUp = true;
    const offerRevive = this.flow.canOfferRevive(opts?.revive !== undefined, this.platform.features.rewardedAds);
    this.reviveCb = offerRevive ? opts?.revive : undefined;
    const newBest = score > this.session.best && score > 0;
    this.game.scene.pause(this.playKey);
    if (!offerRevive) await this.session.gameOver(score);
    this.game.scene.getScene(this.playKey).scene.launch(OVERLAY_KEY, { score, newBest, offerRevive } satisfies OverlayData);
  }

  /** Overlay: revive offer declined / timed out / ad not rewarded. Commits the score. */
  async commitGameOver(score: number): Promise<void> {
    await this.session.gameOver(score);
  }

  /** Overlay: user chose Revive. Resolves true when the ad was rewarded and play resumed. */
  async acceptRevive(): Promise<boolean> {
    const result = await this.session.rewarded();
    if (result !== 'rewarded') return false;
    this.flow.markReviveUsed();
    this.game.scene.stop(OVERLAY_KEY);
    this.game.scene.resume(this.playKey);
    this.overlayUp = false;
    const cb = this.reviveCb;
    this.reviveCb = undefined;
    cb?.();
    return true;
  }

  breakpoint(): Promise<AdResult> {
    return this.session.breakpoint();
  }

  async retry(): Promise<void> {
    await this.session.retry();
    this.flow.reset();
    this.overlayUp = false;
    this.game.scene.stop(OVERLAY_KEY);
    this.game.scene.stop(this.playKey);
    this.game.scene.start(this.playKey);
  }

  showRewarded(): Promise<AdResult> {
    return this.session.rewarded();
  }

  activeScenes(): string[] {
    return this.game.scene.getScenes(true).map((s) => s.scene.key);
  }

  pausedScenes(): string[] {
    return this.game.scene.getScenes(false).filter((s) => s.sys.isPaused()).map((s) => s.scene.key);
  }

  fx(scene: Phaser.Scene): Fx {
    return createFx(scene);
  }

  input(scene: Phaser.Scene, opts?: { joystick?: boolean; joystickRadius?: number }): GameInput {
    return createInput(scene, opts);
  }

  goTo(key: string, data?: object): void {
    this.switchTo(key, data);
  }

  addMuteButton(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const size = 56;
    const g = scene.add.graphics();
    const draw = (): void => {
      g.clear();
      g.fillStyle(0x1a1033, 0.5);
      g.fillCircle(0, 0, size / 2);
      g.fillStyle(this.theme.text, 1);
      g.fillRect(-14, -5, 8, 10);
      g.fillTriangle(-6, -5, 4, -14, 4, 14);
      g.fillTriangle(-6, 5, 4, 14, -6, -5);
      g.lineStyle(3, this.theme.text, 1);
      if (this.audio.muted) {
        g.lineStyle(4, this.theme.danger, 1);
        g.lineBetween(-16, -16, 16, 16);
      } else {
        g.beginPath();
        g.arc(4, 0, 9, -0.9, 0.9);
        g.strokePath();
        g.beginPath();
        g.arc(4, 0, 16, -0.9, 0.9);
        g.strokePath();
      }
    };
    draw();
    const c = scene.add.container(x, y, [g]);
    // Hit area larger than the 56 px visual: ~40 css px on a 375 px wide phone.
    c.setSize(76, 76);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      markButtonTap(scene);
      void this.audio.toggleMute().then(() => {
        draw();
        this.hintBelow(scene, c.x, c.y, this.t(this.audio.muted ? 'gk.soundOff' : 'gk.soundOn'));
      });
    });
    return c;
  }

  /**
   * Short state label under a round icon toggle (e.g. "Sound off"), fading out after ~1.2 s.
   * A newer label at the same spot replaces the previous one.
   */
  hintBelow(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Text {
    const key = `gk-hint-${Math.round(x)}-${Math.round(y)}`;
    const prev = scene.data.get(key) as Phaser.GameObjects.Text | undefined;
    if (prev?.active) prev.destroy();
    const label = scene.add
      .text(x, y + 46, text, {
        fontFamily: this.theme.font, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#1a1033', strokeThickness: 5, align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(1000)
      .setAlpha(0);
    scene.data.set(key, label);
    scene.tweens.add({ targets: label, alpha: 1, duration: 120 });
    scene.tweens.add({ targets: label, alpha: 0, delay: 1200, duration: 300, onComplete: () => label.destroy() });
    return label;
  }

  /** True when a fullscreen toggle should be shown (platform feature on and the browser allows it). */
  get fullscreenAvailable(): boolean {
    return fullscreenAvailable(this.platform.features.fullscreenButton, typeof document === 'undefined' ? undefined : document);
  }

  /** Fullscreen toggle button, or null when unavailable. Place it next to the mute button. */
  addFullscreenButton(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container | null {
    if (!this.fullscreenAvailable) return null;
    const size = 56;
    const g = scene.add.graphics();
    const draw = (): void => {
      g.clear();
      g.fillStyle(0x1a1033, 0.5);
      g.fillCircle(0, 0, size / 2);
      g.lineStyle(4, this.theme.text, 1);
      const out = !scene.scale.isFullscreen;
      // Four corner brackets: pointing outwards to enter fullscreen, inwards to leave it.
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const cx = sx * (out ? 15 : 7);
        const cy = sy * (out ? 15 : 7);
        const arm = out ? -9 : 9;
        g.beginPath();
        g.moveTo(cx + sx * arm, cy);
        g.lineTo(cx, cy);
        g.lineTo(cx, cy + sy * arm);
        g.strokePath();
      }
    };
    draw();
    const c = scene.add.container(x, y, [g]);
    // Hit area larger than the 56 px visual: ~40 css px on a 375 px wide phone.
    c.setSize(76, 76);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      markButtonTap(scene);
      if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
      else scene.scale.startFullscreen();
    });
    const redraw = (): void => {
      if (g.active) draw();
    };
    scene.scale.on('enterfullscreen', redraw);
    scene.scale.on('leavefullscreen', redraw);
    scene.events.once('shutdown', () => {
      scene.scale.off('enterfullscreen', redraw);
      scene.scale.off('leavefullscreen', redraw);
    });
    return c;
  }

  private switchTo(key: string, data?: object): void {
    this.overlayUp = false;
    for (const s of this.game.scene.getScenes(false)) {
      if (s.sys.isActive() || s.sys.isPaused()) this.game.scene.stop(s.scene.key);
    }
    this.game.scene.start(key, data);
  }
}

export function getKit(scene: Phaser.Scene): Kit {
  const kit = scene.registry.get(KIT_KEY) as Kit | undefined;
  if (!kit) throw new Error('game-kit not initialised: create the game with defineGame()');
  return kit;
}
