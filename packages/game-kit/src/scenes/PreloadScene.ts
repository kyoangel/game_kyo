import Phaser from 'phaser';
import { getKit } from '../kit.ts';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('GKPreload');
  }

  preload(): void {
    const kit = getKit(this);
    const { width, height } = this.scale;
    const barWidth = width * 0.6;
    this.add.text(width / 2, height / 2 - 40, kit.t('gk.loading'), { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.add.rectangle(width / 2, height / 2, barWidth, 12, 0x333333);
    const bar = this.add.rectangle(width / 2 - barWidth / 2, height / 2, 0, 12, 0xfacc15).setOrigin(0, 0.5);
    kit.platform.loadingProgress(0);
    this.load.on('progress', (ratio: number) => {
      bar.setSize(barWidth * ratio, 12);
      kit.platform.loadingProgress(ratio);
    });
    kit.def.preload?.(this);
  }

  create(): void {
    getKit(this).platform.loadingDone();
    this.scene.start('GKTitle');
  }
}
