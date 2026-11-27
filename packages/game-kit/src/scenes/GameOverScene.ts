import Phaser from 'phaser';
import { getKit, type OverlayData } from '../kit.ts';
import { cssColor } from '../theme.ts';
import { registerBounds } from '../ui/bounds.ts';
import { addButton, consumeButtonTap } from '../ui/button.ts';
import { sceneIsLandscape } from '../ui/landscape.ts';
import { formatScore } from '../scoreFormat.ts';

const COUNTDOWN_MS = 5000;
const GUARD_MS = 400;

/** Instant-results overlay launched on top of the paused play scene. */
export class GameOverScene extends Phaser.Scene {
  private score = 0;
  private newBest = false;
  private offerRevive = false;
  private panel: Phaser.GameObjects.GameObject[] = [];
  private ring: Phaser.GameObjects.Graphics | undefined;
  private remaining = COUNTDOWN_MS;
  private counting = false;

  constructor() {
    super(OVERLAY);
  }

  init(data: Partial<OverlayData>): void {
    this.score = data.score ?? 0;
    this.newBest = data.newBest ?? false;
    this.offerRevive = data.offerRevive ?? false;
    this.panel = [];
    this.ring = undefined;
    this.remaining = COUNTDOWN_MS;
    this.counting = false;
    this.busy = false;
    this.declined = false;
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x0d0624, sceneIsLandscape(this) ? 1 : 0.84).setOrigin(0, 0).setDepth(-1);
    registerBounds(this);
    if (this.offerRevive) this.showRevive();
    else this.showResults();
  }

  update(_time: number, delta: number): void {
    if (!this.counting || !this.ring) return;
    this.remaining -= delta;
    this.drawRing();
    if (this.remaining <= 0) void this.decline();
  }

  private style(size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
    const { theme } = getKit(this);
    return {
      fontFamily: theme.font,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: cssColor(color),
      stroke: '#1a1033',
      strokeThickness: 5,
      align: 'center',
    };
  }

  private drawRing(): void {
    if (!this.ring) return;
    const { theme } = getKit(this);
    const { width, height } = this.scale;
    const landscape = width > height;
    const cx = width / 2;
    const cy = landscape ? height * 0.31 : height * 0.36;
    const r = landscape ? 56 : 70;
    this.ring.clear();
    this.ring.lineStyle(landscape ? 12 : 14, 0x1a1033, 0.7);
    this.ring.strokeCircle(cx, cy, r);
    const frac = Math.max(0, this.remaining / COUNTDOWN_MS);
    this.ring.lineStyle(landscape ? 12 : 14, theme.accent, 1);
    this.ring.beginPath();
    this.ring.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
    this.ring.strokePath();
  }

  private showRevive(): void {
    const kit = getKit(this);
    const { theme } = kit;
    const { width, height } = this.scale;
    const landscape = width > height;
    const cx = width / 2;

    const panelW = landscape ? 620 : 580;
    const panelY = landscape ? height * 0.16 : height * 0.22;
    const panelH = landscape ? height * 0.58 : height * 0.44;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x1a1033, 0.85);
    panelBg.fillRoundedRect(cx - panelW / 2, panelY, panelW, panelH, 28);
    panelBg.lineStyle(4, theme.primary, 1);
    panelBg.strokeRoundedRect(cx - panelW / 2, panelY, panelW, panelH, 28);

    this.ring = this.add.graphics();
    this.drawRing();
    const num = this.add.text(cx, landscape ? height * 0.31 : height * 0.36, '', this.style(landscape ? 48 : 56, theme.text)).setOrigin(0.5);
    const numTimer = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => num.setText(String(Math.max(0, Math.ceil(this.remaining / 1000)))),
    });
    num.setText('5');

    const btnW = landscape ? 480 : 420;
    const btnH = landscape ? 82 : 88;
    const btn = addButton(this, cx, landscape ? height * 0.52 : height * 0.5, kit.t('gk.revive'), {
      width: btnW,
      height: btnH,
      fill: theme.primary,
      fontSize: landscape ? 32 : 36,
      onClick: () => void this.accept(),
    });
    // rewarded-ad icon: small play triangle in a rounded badge, left of the label
    const iconLeft = -btnW / 2 + 20;
    const iconSize = 46;
    const icon = this.add.graphics();
    icon.fillStyle(theme.accent, 1);
    icon.fillRoundedRect(iconLeft, -iconSize / 2, iconSize, iconSize, 10);
    icon.fillStyle(0x1a1033, 1);
    icon.fillTriangle(iconLeft + 14, -12, iconLeft + 14, 12, iconLeft + 34, 0);
    btn.add(icon);
    const text = btn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
    if (text) {
      const textAreaLeft = iconLeft + iconSize + 14;
      const textAreaRight = btnW / 2 - 18;
      const maxTextW = textAreaRight - textAreaLeft;
      text.setX((textAreaLeft + textAreaRight) / 2);
      if (text.width > maxTextW) {
        text.setScale(maxTextW / text.width);
      }
    }

    const no = this.add.text(cx, landscape ? height * 0.65 : height * 0.6, kit.t('gk.noThanks'), this.style(28, theme.muted)).setOrigin(0.5);
    no.setPadding(30, 14, 30, 14);
    no.setInteractive({ useHandCursor: true });
    no.on('pointerup', () => void this.decline());

    this.panel = [panelBg, this.ring, num, btn, no];
    this.panel.push({ destroy: () => numTimer.remove() } as unknown as Phaser.GameObjects.GameObject);
    this.counting = true;
  }

  private busy = false;
  private declined = false;

  private async accept(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.counting = false;
    const ok = await getKit(this).acceptRevive();
    if (ok) return;
    // No ad could play (no fill, ads disabled, ad blocker): say so instead of silently skipping to results.
    const { width, height } = this.scale;
    const note = this.add
      .text(width / 2, height * 0.72, getKit(this).t('gk.adUnavailable'), this.style(30, getKit(this).theme.danger))
      .setOrigin(0.5)
      .setDepth(20);
    await new Promise<void>((r) => this.time.delayedCall(1600, () => r()));
    note.destroy();
    this.busy = false;
    await this.decline();
  }

  private async decline(): Promise<void> {
    if (this.declined) return;
    this.declined = true;
    this.counting = false;
    for (const o of this.panel) o.destroy();
    this.panel = [];
    await getKit(this).commitGameOver(this.score);
    this.showResults();
  }

  private showResults(): void {
    const kit = getKit(this);
    const { theme } = kit;
    const { width, height } = this.scale;
    const land = sceneIsLandscape(this);
    // Landscape: score summary in the left column, the game's results hook (coins, goal, boosts) in the right column.
    const cx = land ? width * 0.27 : width / 2;
    const rx = land ? width * 0.72 : width / 2;
    const fx = kit.fx(this);
    const y = (portrait: number, landscape: number): number => height * (land ? landscape : portrait);

    this.add.text(cx, y(0.13, 0.17), kit.t('gk.gameOver'), this.style(60, theme.text)).setOrigin(0.5);

    const format = kit.def.scoreFormat;
    const show = (n: number): string => formatScore(n, format);
    this.add.text(cx, y(0.205, 0.27), kit.t(format === 'time' ? 'gk.time' : 'gk.score'), this.style(26, theme.muted)).setOrigin(0.5);
    const scoreText = this.add.text(cx, y(0.28, 0.37), '0', this.style(116, theme.accent)).setOrigin(0.5);
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: this.score,
      duration: 400,
      onUpdate: () => scoreText.setText(show(counter.v)),
      onComplete: () => scoreText.setText(show(this.score)),
    });

    if (this.newBest) {
      const banner = this.add.text(cx, y(0.37, 0.5), kit.t('gk.newBest'), this.style(48, theme.accent)).setOrigin(0.5).setScale(0.2);
      this.tweens.add({ targets: banner, scale: 1, duration: 350, ease: 'Back.easeOut' });
      fx.burst(cx, y(0.37, 0.5), { color: theme.accent, count: 40, speed: 520 });
      kit.audio.sfx('newBest');
    }

    this.add.text(cx, y(0.43, 0.58), `${kit.t(format === 'time' ? 'gk.bestTime' : 'gk.best')}: ${show(kit.session.best)}`, this.style(34, theme.muted)).setOrigin(0.5);

    kit.def.results?.(this, {
      score: this.score,
      best: kit.session.best,
      newBest: this.newBest,
      top: height * (land ? 0.1 : 0.5),
      rewardedAds: kit.platform.features.rewardedAds,
      cx: rx,
      landscape: land,
    });

    const tap = this.add.text(cx, y(0.82, 0.76), kit.t('gk.tapRetry'), this.style(34, theme.text)).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

    addButton(this, cx, y(0.91, 0.89), kit.t('gk.home'), {
      width: land ? 240 : 200,
      height: land ? 72 : 60,
      fill: theme.muted,
      fontSize: 28,
      onClick: () => kit.goTo('GKTitle'),
    });

    let retrying = false;
    const retry = (): void => {
      if (retrying) return;
      retrying = true;
      void kit.retry();
    };
    this.time.delayedCall(GUARD_MS, () => {
      this.input.on('pointerdown', () => {
        if (consumeButtonTap(this)) return;
        retry();
      });
      this.input.keyboard?.on('keydown-SPACE', retry);
      this.input.keyboard?.on('keydown-ENTER', retry);
    });
  }
}

const OVERLAY = 'GKGameOver';
