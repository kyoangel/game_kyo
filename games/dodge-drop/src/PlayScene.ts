import Phaser from 'phaser';
import { getKit } from '@gf/game-kit';

const MAX_MISSES = 3;
const RADIUS = 48;

/** Template mechanic: tap circles before they vanish. Replace with your game. Scene key MUST be 'Play'. */
export class PlayScene extends Phaser.Scene {
  private score = 0;
  private misses = 0;
  private target?: Phaser.GameObjects.Arc;
  private timer?: Phaser.Time.TimerEvent;
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super('Play');
  }

  create(): void {
    this.score = 0;
    this.misses = 0;
    this.hud = this.add.text(24, 24, '', { fontSize: '32px', color: '#ffffff' });
    this.updateHud();
    this.spawn();
  }

  private spawn(): void {
    this.target?.destroy();
    this.timer?.remove();
    const { width, height } = this.scale;
    const x = Phaser.Math.Between(RADIUS, width - RADIUS);
    const y = Phaser.Math.Between(RADIUS + 100, height - RADIUS);
    const target = this.add.circle(x, y, RADIUS, 0xfacc15).setInteractive({ useHandCursor: true });
    target.once('pointerdown', () => {
      this.score += 1;
      this.updateHud();
      this.spawn();
    });
    this.target = target;
    this.timer = this.time.delayedCall(Math.max(450, 1200 - this.score * 25), () => this.miss());
  }

  private miss(): void {
    this.misses += 1;
    this.updateHud();
    if (this.misses >= MAX_MISSES) {
      this.target?.destroy();
      void getKit(this).gameOver(this.score);
      return;
    }
    this.spawn();
  }

  private updateHud(): void {
    const lives = '●'.repeat(MAX_MISSES - this.misses);
    this.hud.setText(`${getKit(this).t('gk.score')}: ${this.score}   ${lives}`);
  }
}
