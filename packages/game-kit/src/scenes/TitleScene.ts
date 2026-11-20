import Phaser from 'phaser';
import { getKit } from '../kit.ts';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('GKTitle');
  }

  create(): void {
    const kit = getKit(this);
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height * 0.35, kit.t('title'), {
        fontSize: '56px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: width * 0.9 },
      })
      .setOrigin(0.5);
    this.add.text(width / 2, height * 0.55, kit.t('gk.tapToStart'), { fontSize: '32px', color: '#facc15' }).setOrigin(0.5);
    if (kit.session.best > 0) {
      this.add
        .text(width / 2, height * 0.63, `${kit.t('gk.best')}: ${kit.session.best}`, { fontSize: '26px', color: '#9ca3af' })
        .setOrigin(0.5);
    }
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      kit.start();
    };
    this.input.once('pointerdown', go);
    this.input.keyboard?.once('keydown', go);
  }
}
