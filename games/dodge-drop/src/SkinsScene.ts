import Phaser from 'phaser';
import { addBackground, addButton, cssColor, ensureTextures, getKit, type Kit } from '@gf/game-kit';
import { buySkin, SKINS } from './economy.ts';
import { sanitizeOwned } from './format.ts';
import { MEDALS, mergeMedals } from './medals.ts';
import { skinTextureKey } from './skinArt.ts';

const CARD_W = 320;
const CARD_H = 196;
const COL_X = [190, 530];
const ROW_Y0 = 420;
const ROW_STEP = 216;

export class SkinsScene extends Phaser.Scene {
  private kit!: Kit;
  private coins = 0;
  private owned: string[] = ['cyan'];
  private selected = 'cyan';
  private medals: string[] = [];
  private layer: Phaser.GameObjects.Container | undefined;
  private prism: Phaser.GameObjects.Image[] = [];
  private busy = false;

  constructor() {
    super('Skins');
  }

  create(): void {
    this.kit = getKit(this);
    const { theme } = this.kit;
    ensureTextures(this, theme);
    addBackground(this);
    this.layer = undefined;
    this.prism = [];
    this.busy = false;

    this.add.text(this.scale.width / 2 + 40, 80, this.kit.t('skins'), this.style(60, theme.text)).setOrigin(0.5);
    addButton(this, 120, 80, this.kit.t('back'), {
      width: 180,
      height: 72,
      fill: theme.muted,
      fontSize: 32,
      onClick: () => this.kit.goTo('GKTitle'),
    });

    void Promise.all([
      this.kit.save.getNumber('coins', 0),
      this.kit.save.getJSON<unknown>('skins', []),
      this.kit.save.getJSON<string>('skin', 'cyan'),
      this.kit.save.getJSON<unknown>('medals', []),
    ]).then(([coins, owned, sel, medals]) => {
      if (!this.sys.isActive()) return;
      this.coins = Math.max(0, Math.floor(coins));
      this.owned = sanitizeOwned(owned);
      this.selected = this.owned.includes(sel) ? sel : 'cyan';
      this.medals = mergeMedals(medals, []);
      this.render();
    });
  }

  update(time: number): void {
    if (this.prism.length === 0) return;
    const c = Phaser.Display.Color.HSVToRGB(((time / 1500) % 1), 0.55, 1) as Phaser.Types.Display.ColorObject;
    const tint = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    for (const img of this.prism) img.setTint(tint);
  }

  private style(size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: this.kit.theme.font, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 5, align: 'center' };
  }

  private render(): void {
    this.layer?.destroy();
    this.prism = [];
    const { theme } = this.kit;
    const layer = this.add.container(0, 0);
    this.layer = layer;

    // balance
    const coin = this.add.graphics();
    coin.fillStyle(0xffe14d, 1);
    coin.fillCircle(300, 190, 24);
    coin.lineStyle(4, 0xffffff, 0.9);
    coin.strokeCircle(300, 190, 24);
    coin.fillStyle(0xffffff, 0.5);
    coin.fillCircle(292, 182, 7);
    const bal = this.add.text(338, 190, String(this.coins), this.style(54, 0xffe14d)).setOrigin(0, 0.5);
    layer.add([coin, bal]);

    // medal row
    const mg = this.add.graphics();
    MEDALS.forEach((m, i) => {
      const x = 360 + (i - 1.5) * 110;
      const has = this.medals.includes(m.id);
      mg.fillStyle(has ? m.color : 0x1a1033, has ? 1 : 0.55);
      mg.fillCircle(x, 290, 28);
      if (has) {
        mg.fillStyle(0xffffff, 0.45);
        mg.fillCircle(x - 8, 282, 8);
      }
      mg.lineStyle(3, has ? 0xffffff : m.color, has ? 0.9 : 0.35);
      mg.strokeCircle(x, 290, 28);
    });
    layer.add(mg);

    SKINS.forEach((skin, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = COL_X[col]!;
      const y = ROW_Y0 + row * ROW_STEP;
      const owned = this.owned.includes(skin.id);
      const isSel = this.selected === skin.id;
      const affordable = owned || this.coins >= skin.cost;

      const bg = this.add.graphics();
      bg.fillStyle(0x1a1033, 0.78);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
      bg.lineStyle(isSel ? 6 : 3, isSel ? theme.accent : theme.primary, isSel ? 1 : 0.5);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
      const img = this.add.image(0, -34, skinTextureKey(this, skin)).setScale(1.35);
      if (skin.color === 'cycle') this.prism.push(img);
      if (!owned && !affordable) img.setAlpha(0.55);
      const label = isSel ? this.kit.t('selected') : owned ? this.kit.t('owned') : String(skin.cost);
      const labelColor = isSel ? theme.accent : owned ? theme.text : affordable ? 0xffe14d : theme.muted;
      const text = this.add.text(0, 62, label, this.style(34, labelColor)).setOrigin(0.5);
      const card = this.add.container(x, y, [bg, img, text]);
      if (!owned) {
        const dot = this.add.graphics();
        dot.fillStyle(0xffe14d, affordable ? 1 : 0.45);
        dot.fillCircle(-text.width / 2 - 20, 62, 11);
        card.add(dot);
      }
      card.setSize(CARD_W, CARD_H);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerup', () => void this.onCard(skin.id, card));
      layer.add(card);
    });
  }

  private async onCard(id: string, card: Phaser.GameObjects.Container): Promise<void> {
    if (this.busy) return;
    if (this.owned.includes(id)) {
      this.busy = true;
      this.selected = id;
      await this.kit.save.setJSON('skin', id);
      this.kit.audio.sfx('click');
      this.busy = false;
      if (this.sys.isActive()) this.render();
      return;
    }
    const res = buySkin({ coins: this.coins, owned: this.owned }, id);
    if (!res.ok) {
      const x0 = card.x;
      this.tweens.add({ targets: card, x: x0 + 12, duration: 50, yoyo: true, repeat: 3, onComplete: () => { card.x = x0; } });
      return;
    }
    this.busy = true;
    this.coins = res.coins;
    this.owned = res.owned;
    this.selected = id;
    await this.kit.save.setNumber('coins', res.coins);
    await this.kit.save.setJSON('skins', res.owned);
    await this.kit.save.setJSON('skin', id);
    this.kit.audio.sfx('pickup');
    this.busy = false;
    if (!this.sys.isActive()) return;
    this.render();
    this.kit.fx(this).burst(this.scale.width / 2, 400, { color: 0xffe14d, count: 30, speed: 420 });
  }
}
