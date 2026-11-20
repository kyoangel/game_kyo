import Phaser from 'phaser';
import { getKit } from '@gf/game-kit';
import { fallSpeed, PLAYER_SPEED, spawnInterval } from './difficulty.ts';

const PLAYER_W = 90;
const PLAYER_H = 28;

export class PlayScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private blocks: Phaser.GameObjects.Rectangle[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private hud!: Phaser.GameObjects.Text;
  private elapsed = 0;
  private spawnIn = 0;
  private dodged = 0;
  private over = false;

  constructor() {
    super('Play');
  }

  create(): void {
    const { width, height } = this.scale;
    this.blocks = [];
    this.elapsed = 0;
    this.spawnIn = 0;
    this.dodged = 0;
    this.over = false;
    this.player = this.add.rectangle(width / 2, height - 80, PLAYER_W, PLAYER_H, 0x4ade80);
    this.hud = this.add.text(24, 24, '', { fontSize: '32px', color: '#ffffff' });
    this.cursors = this.input.keyboard?.createCursorKeys();
    const follow = (p: Phaser.Input.Pointer) => this.movePlayerTo(p.x);
    this.input.on('pointerdown', follow);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) follow(p);
    });
  }

  update(_time: number, deltaMs: number): void {
    if (this.over) return;
    const dt = deltaMs / 1000;
    const { width, height } = this.scale;
    this.elapsed += dt;

    if (this.cursors?.left.isDown) this.movePlayerTo(this.player.x - PLAYER_SPEED * dt);
    if (this.cursors?.right.isDown) this.movePlayerTo(this.player.x + PLAYER_SPEED * dt);

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      const w = Phaser.Math.Between(60, 160);
      this.blocks.push(this.add.rectangle(Phaser.Math.Between(w / 2, width - w / 2), -30, w, 40, 0xf87171));
      this.spawnIn = spawnInterval(this.elapsed);
    }

    const speed = fallSpeed(this.elapsed);
    const playerBounds = this.player.getBounds();
    for (const block of [...this.blocks]) {
      block.y += speed * dt;
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, block.getBounds())) {
        this.over = true;
        void getKit(this).gameOver(this.dodged);
        return;
      }
      if (block.y - block.height / 2 > height) {
        block.destroy();
        this.blocks.splice(this.blocks.indexOf(block), 1);
        this.dodged += 1;
      }
    }
    this.hud.setText(`${getKit(this).t('gk.score')}: ${this.dodged}`);
  }

  private movePlayerTo(x: number): void {
    this.player.x = Phaser.Math.Clamp(x, PLAYER_W / 2, this.scale.width - PLAYER_W / 2);
  }
}
