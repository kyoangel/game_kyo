import Phaser from 'phaser';
import { withTimeout } from '@gf/platform';
import { getKit } from '../kit.ts';

/** Audio never holds the title hostage: after this the game starts and samples keep loading in the background. */
export const AUDIO_LOAD_TIMEOUT_MS = 4000;

export class PreloadScene extends Phaser.Scene {
  private audioLoad: Promise<void> = Promise.resolve();

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
    const manifest = kit.def.audioManifest;
    let files = 0;
    let audio = manifest ? 0 : 1;
    const show = (): void => {
      const ratio = manifest ? (files + audio) / 2 : files;
      bar.setSize(barWidth * ratio, 12);
      kit.platform.loadingProgress(ratio);
    };
    this.load.on('progress', (ratio: number) => {
      files = ratio;
      show();
    });
    if (manifest) {
      this.audioLoad = kit.audio.loadSamples(manifest, (ratio) => {
        audio = ratio;
        show();
      });
    }
    kit.def.preload?.(this);
  }

  async create(): Promise<void> {
    const kit = getKit(this);
    await withTimeout(this.audioLoad, AUDIO_LOAD_TIMEOUT_MS, undefined);
    kit.platform.loadingDone();
    this.scene.start('GKTitle');
  }
}
