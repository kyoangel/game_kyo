import Phaser from 'phaser';
import { getKit } from '../kit.ts';

export class GameOverScene extends Phaser.Scene {
  private score = 0;

  constructor() {
    super('GKGameOver');
  }

  init(data: { score?: number }): void {
    this.score = data.score ?? 0;
  }

  create(): void {
    const kit = getKit(this);
    const { width, height } = this.scale;
    this.add.text(width / 2, height * 0.3, kit.t('gk.gameOver'), { fontSize: '56px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.42, `${kit.t('gk.score')}: ${this.score}`, { fontSize: '36px', color: '#facc15' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.5, `${kit.t('gk.best')}: ${kit.session.best}`, { fontSize: '28px', color: '#9ca3af' }).setOrigin(0.5);
    const button = this.add.rectangle(width / 2, height * 0.65, 280, 80, 0x4ade80).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.65, kit.t('gk.retry'), { fontSize: '32px', color: '#111111' }).setOrigin(0.5);

    let retrying = false;
    const retry = () => {
      if (retrying) return;
      retrying = true;
      void kit.retry();
    };
    // Short delay so the tap that ended the round does not instantly retry.
    this.time.delayedCall(400, () => {
      button.once('pointerdown', retry);
      this.input.keyboard?.once('keydown-ENTER', retry);
      this.input.keyboard?.once('keydown-SPACE', retry);
    });
  }
}
