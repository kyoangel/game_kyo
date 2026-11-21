import Phaser from 'phaser';
import { getKit, type OverlayData } from '../kit.ts';
import { cssColor } from '../theme.ts';
import { addButton, consumeButtonTap } from '../ui/button.ts';

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
    this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0).setDepth(-1);
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
    const cx = width / 2;
    const cy = height * 0.36;
    const r = 70;
    this.ring.clear();
    this.ring.lineStyle(14, 0x1a1033, 0.7);
    this.ring.strokeCircle(cx, cy, r);
    const frac = Math.max(0, this.remaining / COUNTDOWN_MS);
    this.ring.lineStyle(14, theme.accent, 1);
    this.ring.beginPath();
    this.ring.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
    this.ring.strokePath();
  }

  private showRevive(): void {
    const kit = getKit(this);
    const { theme } = kit;
    const { width, height } = this.scale;
    const cx = width / 2;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x1a1033, 0.85);
    panelBg.fillRoundedRect(cx - 290, height * 0.22, 580, height * 0.44, 28);
    panelBg.lineStyle(4, theme.primary, 1);
    panelBg.strokeRoundedRect(cx - 290, height * 0.22, 580, height * 0.44, 28);

    this.ring = this.add.graphics();
    this.drawRing();
    const num = this.add.text(cx, height * 0.36, '', this.style(56, theme.text)).setOrigin(0.5);
    const numTimer = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => num.setText(String(Math.max(0, Math.ceil(this.remaining / 1000)))),
    });
    num.setText('5');

    const btn = addButton(this, cx, height * 0.5, kit.t('gk.revive'), {
      width: 380,
      height: 88,
      fill: theme.primary,
      fontSize: 38,
      onClick: () => void this.accept(),
    });
    // rewarded-ad icon: small play triangle in a rounded badge, left of the label
    const icon = this.add.graphics();
    icon.fillStyle(theme.accent, 1);
    icon.fillRoundedRect(-170, -24, 48, 48, 10);
    icon.fillStyle(0x1a1033, 1);
    icon.fillTriangle(-156, -13, -156, 13, -134, 0);
    btn.add(icon);
    const text = btn.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
    text?.setX(20);

    const no = this.add.text(cx, height * 0.6, kit.t('gk.noThanks'), this.style(30, theme.muted)).setOrigin(0.5);
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
    const cx = width / 2;
    const fx = kit.fx(this);

    this.add.text(cx, height * 0.14, kit.t('gk.gameOver'), this.style(60, theme.text)).setOrigin(0.5);

    const scoreText = this.add.text(cx, height * 0.26, '0', this.style(120, theme.accent)).setOrigin(0.5);
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: this.score,
      duration: 400,
      onUpdate: () => scoreText.setText(String(Math.round(counter.v))),
      onComplete: () => scoreText.setText(String(this.score)),
    });

    if (this.newBest) {
      const banner = this.add.text(cx, height * 0.36, kit.t('gk.newBest'), this.style(52, theme.accent)).setOrigin(0.5).setScale(0.2);
      this.tweens.add({ targets: banner, scale: 1, duration: 350, ease: 'Back.easeOut' });
      fx.burst(cx, height * 0.36, { color: theme.accent, count: 40, speed: 520 });
      kit.audio.sfx('newBest');
    }

    this.add.text(cx, height * 0.43, `${kit.t('gk.best')}: ${kit.session.best}`, this.style(36, theme.muted)).setOrigin(0.5);

    kit.def.results?.(this, {
      score: this.score,
      best: kit.session.best,
      newBest: this.newBest,
      top: height * 0.5,
      rewardedAds: kit.platform.features.rewardedAds,
    });

    const tap = this.add.text(cx, height * 0.82, kit.t('gk.tapRetry'), this.style(34, theme.text)).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

    addButton(this, cx, height * 0.91, kit.t('gk.home'), {
      width: 200,
      height: 60,
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
