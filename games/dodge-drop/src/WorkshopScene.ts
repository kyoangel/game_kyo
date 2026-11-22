import Phaser from 'phaser';
import { addBackground, addButton, cssColor, ensureTextures, getKit, type Kit } from '@gf/game-kit';
import { buyUpgrade, effectValue, MAX_LEVEL, nextCost, sanitizeWorkshop, UPGRADE_IDS, type UpgradeId, type Workshop } from './workshop.ts';

const ROW_Y0 = 270;
const ROW_STEP = 150;

export class WorkshopScene extends Phaser.Scene {
  private kit!: Kit;
  private coins = 0;
  private levels: Workshop = sanitizeWorkshop(null);
  private layer: Phaser.GameObjects.GameObject[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor() {
    super('Workshop');
  }

  create(): void {
    this.kit = getKit(this);
    const { theme } = this.kit;
    ensureTextures(this, theme);
    addBackground(this);
    this.layer = [];
    this.chain = Promise.resolve();

    this.add.text(this.scale.width / 2 + 40, 80, this.kit.t('upgrades'), this.style(60, theme.text)).setOrigin(0.5);
    addButton(this, 120, 80, this.kit.t('back'), {
      width: 180, height: 72, fill: theme.muted, fontSize: 32,
      onClick: () => this.kit.goTo('GKTitle'),
    });

    void Promise.all([this.kit.save.getNumber('coins', 0), this.kit.save.getJSON<unknown>('workshop', {})]).then(([coins, ws]) => {
      if (!this.sys.isActive()) return;
      this.coins = Math.max(0, Math.floor(coins));
      this.levels = sanitizeWorkshop(ws);
      this.render();
    });
  }

  private style(size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: this.kit.theme.font, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 5, align: 'center' };
  }

  private desc(id: UpgradeId, level: number): string {
    const v = String(effectValue(id, level));
    let s = this.kit.t(`up.${id}.desc`).replace('{v}', v);
    if (id === 'shield' && level >= MAX_LEVEL) s += this.kit.t('up.shield.max');
    return s;
  }

  private icon(g: Phaser.GameObjects.Graphics, id: UpgradeId, x: number, y: number, color: number): void {
    g.lineStyle(7, color, 1);
    g.fillStyle(color, 1);
    switch (id) {
      case 'shield': g.strokeCircle(x, y, 34); break;
      case 'startShield': g.strokeCircle(x, y, 34); g.strokeCircle(x, y, 18); break;
      case 'magnet':
        g.beginPath(); g.arc(x, y - 4, 28, Math.PI, 0, false); g.strokePath();
        g.fillRect(x - 34, y - 4, 12, 30); g.fillRect(x + 22, y - 4, 12, 30);
        break;
      case 'nearMiss': g.fillTriangle(x, y - 34, x - 12, y + 4, x + 12, y + 4); g.fillTriangle(x, y + 34, x - 12, y - 4, x + 12, y - 4); break;
      case 'combo': g.fillRect(x - 32, y + 8, 16, 24); g.fillRect(x - 8, y - 8, 16, 40); g.fillRect(x + 16, y - 28, 16, 60); break;
      case 'luck': g.fillStyle(0xffe14d, 1); g.fillCircle(x, y, 30); g.fillStyle(0xffffff, 0.5); g.fillCircle(x - 9, y - 9, 8); break;
    }
  }

  private render(): void {
    for (const o of this.layer) o.destroy();
    this.layer = [];
    const { theme } = this.kit;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.layer.push(o); return o; };

    add(this.add.text(this.scale.width / 2, 170, `${this.kit.t('balance')}: ${this.coins}`, this.style(32, 0xffe14d)).setOrigin(0.5));

    UPGRADE_IDS.forEach((id, i) => {
      const y = ROW_Y0 + i * ROW_STEP;
      const level = this.levels[id];
      const cost = nextCost(level);
      const affordable = cost !== null && this.coins >= cost;

      const bg = add(this.add.graphics());
      bg.fillStyle(0x1a1033, 0.7);
      bg.fillRoundedRect(20, y - 66, 680, 132, 22);
      bg.lineStyle(3, theme.primary, 0.45);
      bg.strokeRoundedRect(20, y - 66, 680, 132, 22);
      this.icon(bg, id, 80, y, theme.accent);

      add(this.add.text(150, y - 28, this.kit.t(`up.${id}.name`), this.style(30, theme.text)).setOrigin(0, 0.5));
      add(this.add.text(150, y + 4, this.desc(id, level), { ...this.style(22, theme.muted), strokeThickness: 3 }).setOrigin(0, 0.5));
      for (let k = 0; k < MAX_LEVEL; k++) {
        bg.fillStyle(k < level ? theme.accent : 0x3a2b66, 1);
        bg.fillCircle(159 + k * 26, y + 38, 9);
      }

      if (cost === null) {
        add(this.add.text(600, y, this.kit.t('maxed'), this.style(34, theme.accent)).setOrigin(0.5));
      } else {
        add(addButton(this, 600, y, String(cost), {
          width: 170, height: 80, fontSize: 38,
          fill: affordable ? theme.primary : theme.muted,
          textColor: affordable ? 0xffe14d : 0xaaaaaa,
          onClick: () => this.onBuy(id, y),
        }));
      }
    });
  }

  private onBuy(id: UpgradeId, y: number): void {
    const res = buyUpgrade({ coins: this.coins, levels: this.levels }, id);
    if (!res.ok) return;
    this.coins = res.coins;
    this.levels = res.levels;
    const coins = res.coins;
    const levels = res.levels;
    this.chain = this.chain.then(async () => {
      await this.kit.save.setNumber('coins', coins);
      await this.kit.save.setJSON('workshop', levels);
    });
    this.kit.audio.sfx('pickup');
    this.render();
    this.kit.fx(this).burst(600, y, { color: 0xffe14d, count: 24, speed: 360 });
  }
}
