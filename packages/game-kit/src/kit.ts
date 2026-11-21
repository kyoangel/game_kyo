import type Phaser from 'phaser';
import type { AdResult, Platform } from '@gf/platform';
import type { GameAudio } from './audio/audio.ts';
import type { GameDefinition } from './defineGame.ts';
import type { SaveData } from './save.ts';
import type { GameSession } from './session.ts';

export const KIT_KEY = 'gk:kit';

/** Facade handed to scenes via getKit(scene). Scene switching lives here; state lives in GameSession. */
export class Kit {
  readonly game: Phaser.Game;
  readonly session: GameSession;
  readonly platform: Platform;
  readonly def: GameDefinition;
  readonly save: SaveData;
  readonly audio: GameAudio;
  private readonly translate: (key: string) => string;

  constructor(game: Phaser.Game, session: GameSession, platform: Platform, t: (key: string) => string, def: GameDefinition, save: SaveData, audio: GameAudio) {
    this.game = game;
    this.session = session;
    this.platform = platform;
    this.translate = t;
    this.def = def;
    this.save = save;
    this.audio = audio;
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
