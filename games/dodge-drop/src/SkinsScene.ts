import Phaser from 'phaser';
import { addBackground, addButton, cssColor, ensureTextures, getKit, type Kit } from '@gf/game-kit';
import { buySkin, SKINS } from './economy.ts';
import { sanitizeOwned } from './format.ts';
import { drawCurrencyIcon } from './playArt.ts';
import { skinTextureKey } from './skinArt.ts';
import { skinAction } from './skinsState.ts';

const CARD_W = 320;
const CARD_H = 140;
const COL_X = [190, 530];
const ROW_Y0 = 700;
const ROW_STEP = 152;
const PREVIEW_X = 360;
const PREVIEW_Y = 340;
const PREVIEW_SIZE = 120;

export class SkinsScene extends Phaser.Scene {
  private kit!: Kit;
  private coins = 0;
  private owned: string[] = ['cyan'];
  /** Skin in use (saved). */
  private selected = 'cyan';
  /** Skin shown in the preview panel (never spends coins). */
  private previewId = 'cyan';
  private previewObjs: Phaser.GameObjects.GameObject[] = [];
  private trail: { stop(): void } | null = null;
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
    this.previewObjs = [];
    this.trail = null;
    this.events.once('shutdown', () => this.clearPreview());

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
    ]).then(([coins, owned, sel]) => {
      if (!this.sys.isActive()) return;
      this.coins = Math.max(0, Math.floor(coins));
      this.owned = sanitizeOwned(owned);
      this.selected = this.owned.includes(sel) ? sel : 'cyan';
      this.previewId = this.selected;
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

  private clearPreview(): void {
    this.trail?.stop();
    this.trail = null;
    for (const o of this.previewObjs) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.previewObjs = [];
  }

  private render(): void {
    this.layer?.destroy();
    this.clearPreview();
    this.prism = [];
    const { theme } = this.kit;
    const layer = this.add.container(0, 0);
    this.layer = layer;

    // balance
    const icon = drawCurrencyIcon(this, 290, 168, 56);
    const bal = this.add.text(334, 168, String(this.coins), this.style(48, 0xffe14d)).setOrigin(0, 0.5);
    const balLabel = this.add.text(360, 212, this.kit.t('balance'), this.style(22, theme.muted)).setOrigin(0.5);
    layer.add([icon, bal, balLabel]);

    this.renderPreview(layer);

    SKINS.forEach((skin, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = COL_X[col]!;
      const y = ROW_Y0 + row * ROW_STEP;
      const owned = this.owned.includes(skin.id);
      const inUse = this.selected === skin.id;
      const isPreview = this.previewId === skin.id;
      const affordable = owned || this.coins >= skin.cost;

      const bg = this.add.graphics();
      bg.fillStyle(0x1a1033, 0.78);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
      // in use: accent outline; previewed: white outline; both can apply
      bg.lineStyle(inUse ? 6 : 3, inUse ? theme.accent : theme.primary, inUse ? 1 : 0.5);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
      if (isPreview) {
        bg.lineStyle(4, 0xffffff, 1);
        bg.strokeRoundedRect(-CARD_W / 2 + 7, -CARD_H / 2 + 7, CARD_W - 14, CARD_H - 14, 18);
      }
      const img = this.add.image(0, -22, skinTextureKey(this, skin)).setScale(1.0);
      if (skin.color === 'cycle') this.prism.push(img);
      if (!owned && !affordable) img.setAlpha(0.55);
      const label = inUse ? this.kit.t('inUse') : owned ? this.kit.t('owned') : String(skin.cost);
      const labelColor = inUse ? theme.accent : owned ? theme.text : affordable ? 0xffe14d : theme.muted;
      const text = this.add.text(0, 48, label, this.style(30, labelColor)).setOrigin(0.5);
      const card = this.add.container(x, y, [bg, img, text]);
      if (!owned) {
        const dot = drawCurrencyIcon(this, -text.width / 2 - 20, 48, 28).setAlpha(affordable ? 1 : 0.45);
        card.add(dot);
      }
      card.setSize(CARD_W, CARD_H);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerup', () => this.onCard(skin.id));
      layer.add(card);
    });
  }

  private renderPreview(layer: Phaser.GameObjects.Container): void {
    const { theme } = this.kit;
    const skin = SKINS.find((s) => s.id === this.previewId) ?? SKINS[0]!;
    const act = skinAction({ owned: this.owned, inUse: this.selected, coins: this.coins }, skin.id);

    const panel = this.add.graphics();
    panel.fillStyle(0x1a1033, 0.78);
    panel.fillRoundedRect(60, 250, 600, 360, 28);
    panel.lineStyle(3, theme.primary, 0.5);
    panel.strokeRoundedRect(60, 250, 600, 360, 28);
    const name = this.add.text(PREVIEW_X, 425, this.kit.t(`skin.${skin.id}`), this.style(40, theme.text)).setOrigin(0.5);
    layer.add([panel, name]);

    // large skin, swaying so its trail is visible (scene-level so the trail emitter follows world coords)
    const img = this.add.image(PREVIEW_X - 120, PREVIEW_Y, skinTextureKey(this, skin)).setScale(PREVIEW_SIZE / 64).setDepth(6);
    if (skin.color === 'cycle') this.prism.push(img);
    this.previewObjs.push(img);
    this.tweens.add({ targets: img, x: PREVIEW_X + 120, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const tc = skin.trailColor;
    this.trail = this.kit.fx(this).trail(img, { color: tc === 'rainbow' ? 0xffffff : tc });

    // single action button
    const bx = PREVIEW_X;
    const by = 525;
    if (act.kind === 'inuse') {
      this.addAction(bx, by, this.kit.t('inUse'), theme.muted, 0.5, () => undefined);
    } else if (act.kind === 'use') {
      this.addAction(bx, by, this.kit.t('use'), theme.primary, 1, () => void this.onUse(skin.id));
    } else if (act.kind === 'buy') {
      this.addAction(bx, by, `${this.kit.t('buy')} ★${act.cost}`, theme.accent, 1, () => void this.onBuy(skin.id), 0x1a1033);
    } else {
      const btn = this.addAction(bx, by, this.kit.t('needMore').replace('{n}', String(act.need)), theme.muted, 0.55, () => {
        this.tweens.killTweensOf(btn);
        btn.x = bx;
        this.tweens.add({ targets: btn, x: bx + 12, duration: 50, yoyo: true, repeat: 3, onComplete: () => { btn.x = bx; } });
      });
    }
  }

  private addAction(x: number, y: number, label: string, fill: number, alpha: number, onClick: () => void, textColor = 0xffffff): Phaser.GameObjects.Container {
    const btn = addButton(this, x, y, label, { width: 400, height: 84, fill, textColor, fontSize: 36, strokeThickness: textColor === 0xffffff ? 4 : 0, onClick });
    btn.setAlpha(alpha);
      this.previewObjs.push(btn);
    return btn;
  }

  private onCard(id: string): void {
    if (this.busy || this.previewId === id) return;
    this.previewId = id;
    this.kit.audio.sfx('click');
    this.render();
  }

  private async onUse(id: string): Promise<void> {
    if (this.busy || !this.owned.includes(id)) return;
    this.busy = true;
    this.selected = id;
    await this.kit.save.setJSON('skin', id);
    this.kit.audio.sfx('click');
    this.busy = false;
    if (this.sys.isActive()) this.render();
  }

  private async onBuy(id: string): Promise<void> {
    if (this.busy) return;
    const res = buySkin({ coins: this.coins, owned: this.owned }, id);
    if (!res.ok) return;
    this.busy = true;
    this.coins = res.coins;
    this.owned = res.owned;
    this.selected = id;
    this.previewId = id;
    await this.kit.save.setNumber('coins', res.coins);
    await this.kit.save.setJSON('skins', res.owned);
    await this.kit.save.setJSON('skin', id);
    this.kit.audio.sfx('pickup');
    this.busy = false;
    if (!this.sys.isActive()) return;
    this.render();
    this.kit.fx(this).burst(PREVIEW_X, PREVIEW_Y, { color: 0xffe14d, count: 30, speed: 420 });
  }
}
