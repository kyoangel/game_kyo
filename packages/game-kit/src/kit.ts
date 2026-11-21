import Phaser from 'phaser';
import type { AdResult, Platform } from '@gf/platform';
import type { GameAudio } from './audio/audio.ts';
import type { GameDefinition } from './defineGame.ts';
import type { SaveData } from './save.ts';
import { createInput, type GameInput } from './input/input.ts';
import { createFx, type Fx } from './juice/fx.ts';
import type { GameSession } from './session.ts';
import { resolveTheme, type Theme } from './theme.ts';

export const KIT_KEY = 'gk:kit';

/** Facade handed to scenes via getKit(scene). Scene switching lives here; state lives in GameSession. */
export class Kit {
  readonly game: Phaser.Game;
  readonly session: GameSession;
  readonly platform: Platform;
  readonly def: GameDefinition;
  readonly save: SaveData;
  readonly audio: GameAudio;
  readonly theme: Theme;
  private readonly translate: (key: string) => string;

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

  start(): void {
    this.session.start();
    this.switchTo('Play');
  }

  async gameOver(score: number): Promise<void> {
    if (!(await this.session.gameOver(score))) return;
    this.switchTo('GKGameOver', { score });
  }

  breakpoint(): Promise<AdResult> {
    return this.session.breakpoint();
  }

  async retry(): Promise<void> {
    await this.session.retry();
    this.switchTo('Play');
  }

  showRewarded(): Promise<AdResult> {
    return this.session.rewarded();
  }

  activeScenes(): string[] {
    return this.game.scene.getScenes(true).map((s) => s.scene.key);
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
    c.setSize(size, size);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      void this.audio.toggleMute().then(draw);
    });
    return c;
  }

  private switchTo(key: string, data?: object): void {
    for (const s of this.game.scene.getScenes(true)) this.game.scene.stop(s.scene.key);
    this.game.scene.start(key, data);
  }
}

export function getKit(scene: Phaser.Scene): Kit {
  const kit = scene.registry.get(KIT_KEY) as Kit | undefined;
  if (!kit) throw new Error('game-kit not initialised: create the game with defineGame()');
  return kit;
}
