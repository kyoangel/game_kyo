import Phaser from 'phaser';
import { getKit } from '../kit.ts';
import { addBackground, ensureTextures } from '../juice/textures.ts';
import { cssColor } from '../theme.ts';
import { titleLayout } from '../titleLayout.ts';
import { addButton, consumeButtonTap } from '../ui/button.ts';
import { registerBounds } from '../ui/bounds.ts';
import { topRightSlotX } from '../ui/topRight.ts';

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
    const menu = kit.def.titleMenu ?? [];
    const lay = titleLayout(width, height, menu.length);

    const logoKey = kit.def.titleLogo;
    if (logoKey && this.textures.exists(logoKey) && kit.t('title') === kit.def.manifest.title.en) {
      const logo = this.add.image(width / 2, lay.titleY - height * (lay.landscape ? 0.02 : 0.04), logoKey);
      // Fit a box (keeps the glow clear of the tap prompt and the extras below): 30% x 21% of the canvas in landscape, 70% x 24% in portrait.
      const fit = Math.min((width * (lay.landscape ? 0.3 : 0.7)) / logo.width, (height * (lay.landscape ? 0.21 : 0.24)) / logo.height);
      logo.setScale(fit);
      this.tweens.add({ targets: logo, scale: fit * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      const title = this.add
        .text(width / 2, lay.titleY, kit.t('title'), {
          fontFamily: theme.font,
          fontSize: '76px',
          fontStyle: 'bold',
          color: cssColor(theme.text),
          stroke: '#1a1033',
          strokeThickness: 8,
          align: 'center',
          wordWrap: { width: lay.landscape ? width * 0.36 : width * 0.9 },
        })
        .setOrigin(0.5);
      kit.fx(this).glow(title, theme.primary, 6);
      this.tweens.add({ targets: title, scale: 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const tap = this.add
      .text(width / 2, lay.tapY, kit.t('gk.tapToStart'), {
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
        .text(width / 2, lay.bestY, `${kit.t('gk.best')}: ${kit.session.best}`, {
          fontFamily: theme.font,
          fontSize: '32px',
          fontStyle: 'bold',
          color: cssColor(theme.muted),
          stroke: '#1a1033',
          strokeThickness: 5,
        })
        .setOrigin(0.5);
    }

    menu.forEach((item, i) => {
      addButton(this, width / 2, lay.menuY0 + i * lay.menuStep, kit.t(item.labelKey), {
        width: lay.menuButtonW,
        height: lay.menuButtonH,
        fontSize: lay.landscape ? 38 : undefined,
        fill: theme.primary,
        onClick: () => kit.goTo(item.scene),
      });
    });
    kit.addMuteButton(this, topRightSlotX(width, 0), 60);
    kit.addFullscreenButton(this, topRightSlotX(width, 1), 60);
    kit.def.titleExtras?.(this, lay);
    registerBounds(this, { menuAt: (i: number) => ({ x: width / 2, y: lay.menuY0 + i * lay.menuStep }) });

    // Small support link at the very bottom, only where external links are allowed (own site, never portals).
    const supportUrl = kit.platform.supportUrl;
    if (supportUrl) {
      addButton(this, width / 2, height - (lay.landscape ? 44 : 40), kit.t('gk.support'), {
        width: lay.landscape ? 340 : 280, height: lay.landscape ? 56 : 44, fill: 0x2a1a5e, textColor: theme.muted, fontSize: lay.landscape ? 26 : 20, strokeThickness: 3,
        onClick: () => { window.open(supportUrl, '_blank', 'noopener'); },
      });
    }

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
