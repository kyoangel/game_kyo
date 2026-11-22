import Phaser from 'phaser';
import { getKit } from '../kit.ts';
import { addBackground, ensureTextures } from '../juice/textures.ts';
import { cssColor } from '../theme.ts';
import { titleLayout } from '../titleLayout.ts';
import { addButton, consumeButtonTap } from '../ui/button.ts';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('GKTitle');
  }

  create(): void {
    const kit = getKit(this);
    const { theme } = kit;
    const { width, height } = this.scale;
    ensureTextures(this, theme);
    addBackground(this);
    kit.def.titleBackdrop?.(this);

    const title = this.add
      .text(width / 2, height * 0.3, kit.t('title'), {
        fontFamily: theme.font,
        fontSize: '76px',
        fontStyle: 'bold',
        color: cssColor(theme.text),
        stroke: '#1a1033',
        strokeThickness: 8,
        align: 'center',
        wordWrap: { width: width * 0.9 },
      })
      .setOrigin(0.5);
    kit.fx(this).glow(title, theme.primary, 6);
    this.tweens.add({ targets: title, scale: 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const tap = this.add
      .text(width / 2, height * 0.55, kit.t('gk.tapToStart'), {
        fontFamily: theme.font,
        fontSize: '40px',
        fontStyle: 'bold',
        color: cssColor(theme.accent),
        stroke: '#1a1033',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, hold: 0 });

    if (kit.session.best > 0) {
      this.add
        .text(width / 2, height * 0.62, `${kit.t('gk.best')}: ${kit.session.best}`, {
          fontFamily: theme.font,
          fontSize: '32px',
          fontStyle: 'bold',
          color: cssColor(theme.muted),
          stroke: '#1a1033',
          strokeThickness: 5,
        })
        .setOrigin(0.5);
    }

    const menu = kit.def.titleMenu ?? [];
    menu.forEach((item, i) => {
      addButton(this, width / 2, height * 0.72 + i * 96, kit.t(item.labelKey), {
        width: 280,
        height: 72,
        fill: theme.primary,
        onClick: () => kit.goTo(item.scene),
      });
    });
    kit.addMuteButton(this, width - 60, 60);
    kit.def.titleExtras?.(this, titleLayout(width, height, menu.length));

    let started = false;
    const go = (): void => {
      if (started) return;
      started = true;
      kit.start();
    };
    this.input.on('pointerdown', () => {
      if (consumeButtonTap(this)) return;
      go();
    });
    // Ignore modifier chords/keys (e.g. Cmd+Shift+4 screenshots) so they don't start the run.
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ['Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) return;
      go();
    });
  }
}
