import Phaser from 'phaser';
import { addButton, landscapeFont, sceneIsLandscape } from '@gf/game-kit';
import { buySkin, SKINS } from './economy.ts';
import { drawCurrencyIcon } from './playArt.ts';
import { SHOP_LAND_ROW0, shopStyle, type ShopCtx } from './shopTypes.ts';
import { skinTextureKey } from './skinArt.ts';
import { fxLineKey, skinFxSpec, hueColor } from './skinFx.ts';
import { playNearMiss, startSkinTrail, type SkinTrail } from './skinFxRender.ts';
import { skinAction } from './skinsState.ts';

const CARD_W = 320;
const CARD_H = 140;
const COL_X = [190, 530];
/** Landscape: preview panel keeps its column on the left (shifted up under the single header row), cards sit in the right half. */
const LAND_DY = -110;
const LAND_COL_X = [910, 1250];
const ROW_Y0 = 700;
const ROW_STEP = 152;
const PREVIEW_X = 360;
const PREVIEW_Y = 340;
const PREVIEW_SIZE = 120;

/** Skins tab: preview panel (preview before buy) + grid of skin cards. */
export class SkinsPanel {
  /** Skin shown in the preview panel (never spends coins). */
  private previewId: string;
  private previewObjs: Phaser.GameObjects.GameObject[] = [];
  private trail: SkinTrail | null = null;
  private previewImg: Phaser.GameObjects.Image | null = null;
  private prism: Phaser.GameObjects.Image[] = [];
  private busy = false;
  private lastPx = 0;

  constructor(initialPreview: string) {
    this.previewId = initialPreview;
  }

  /** Per-frame rainbow tint for the prism skin. */
  update(time: number): void {
    if (this.prism.length > 0) {
      const tint = hueColor(time / 1500, 0.55);
      for (const img of this.prism) img.setTint(tint);
    }
    const pv = this.previewImg;
    if (this.trail && pv) this.trail.update(time, Math.min(1, Math.abs(pv.x - this.lastPx) / 12));
    if (pv) this.lastPx = pv.x;
  }

  destroy(scene: Phaser.Scene): void {
    this.trail?.stop();
    this.trail = null;
    this.previewImg = null;
    for (const o of this.previewObjs) {
      scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.previewObjs = [];
    this.prism = [];
  }

  render(ctx: ShopCtx): void {
    const { scene, kit, state } = ctx;
    const { theme } = kit;
    this.prism = [];
    const land = sceneIsLandscape(scene);
    const layer = ctx.add(scene.add.container(0, 0));

    this.renderPreview(ctx, layer, land ? LAND_DY : 0);

    SKINS.forEach((skin, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = (land ? LAND_COL_X : COL_X)[col]!;
      const y = land ? SHOP_LAND_ROW0 + row * ROW_STEP : ROW_Y0 + row * ROW_STEP;
      const owned = state.owned.includes(skin.id);
      const inUse = state.selected === skin.id;
      const isPreview = this.previewId === skin.id;
      const affordable = owned || state.coins >= skin.cost;

      const bg = scene.add.graphics();
      bg.fillStyle(0x1a1033, 0.78);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
      // in use: accent outline; previewed: white outline; both can apply
      bg.lineStyle(inUse ? 6 : 3, inUse ? theme.accent : theme.primary, inUse ? 1 : 0.5);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
      if (isPreview) {
        bg.lineStyle(4, 0xffffff, 1);
        bg.strokeRoundedRect(-CARD_W / 2 + 7, -CARD_H / 2 + 7, CARD_W - 14, CARD_H - 14, 18);
      }
      const img = scene.add.image(0, -22, skinTextureKey(scene, skin)).setScale(1.0);
      if (skin.color === 'cycle') this.prism.push(img);
      if (!owned && !affordable) img.setAlpha(0.55);
      const label = inUse ? kit.t('inUse') : owned ? kit.t('owned') : String(skin.cost);
      const labelColor = inUse ? theme.accent : owned ? theme.text : affordable ? 0xffe14d : theme.muted;
      const text = scene.add.text(0, 48, label, shopStyle(kit, landscapeFont(30, land), labelColor)).setOrigin(0.5);
      const card = scene.add.container(x, y, [bg, img, text]);
      if (!owned) {
        const dot = drawCurrencyIcon(scene, -text.width / 2 - 20, 48, 28).setAlpha(affordable ? 1 : 0.45);
        card.add(dot);
      }
      card.setSize(CARD_W, CARD_H);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerup', () => this.onCard(ctx, skin.id));
      layer.add(card);
    });
  }

  private renderPreview(ctx: ShopCtx, layer: Phaser.GameObjects.Container, dy: number): void {
    const { scene, kit, state } = ctx;
    const land = dy !== 0;
    const fs = (n: number): number => landscapeFont(n, land);
    const PY = PREVIEW_Y + dy;
    const { theme } = kit;
    const skin = SKINS.find((s) => s.id === this.previewId) ?? SKINS[0]!;
    const act = skinAction({ owned: state.owned, inUse: state.selected, coins: state.coins }, skin.id);

    const panel = scene.add.graphics();
    panel.fillStyle(0x1a1033, 0.78);
    panel.fillRoundedRect(60, 250 + dy, 600, 340, 28);
    panel.lineStyle(3, theme.primary, 0.5);
    panel.strokeRoundedRect(60, 250 + dy, 600, 340, 28);
    const name = scene.add.text(PREVIEW_X, 425 + dy, kit.t(`skin.${skin.id}`), shopStyle(kit, 40, theme.text)).setOrigin(0.5);
    layer.add([panel, name]);

    // large skin, swaying so its trail is visible (scene-level so the trail emitter follows world coords)
    const img = scene.add.image(PREVIEW_X - 120, PY, skinTextureKey(scene, skin)).setScale(PREVIEW_SIZE / 64).setDepth(6);
    if (skin.color === 'cycle') this.prism.push(img);
    this.previewObjs.push(img);
    scene.tweens.add({ targets: img, x: PREVIEW_X + 120, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.previewImg = img;
    this.lastPx = img.x;
    this.trail = startSkinTrail(scene, img, skin);

    // tap the preview to play this skin's near-miss effect once
    const zone = scene.add.zone(PREVIEW_X, PY, 560, 150).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      const tint = skin.color === 'cycle' ? hueColor(scene.time.now / 1500, 0.55) : skin.color;
      playNearMiss(scene, kit.fx(scene), skin, img.x, PY, 1, tint);
      kit.audio.sfx('nearMiss', { step: 1 });
    });
    this.previewObjs.push(zone);

    // cosmetic tag, effect list, and the no-gameplay-effect note
    const tag = scene.add.text(PREVIEW_X + 220, 276 + dy, kit.t('skin.tag'), { ...shopStyle(kit, fs(24), 0x1a1033), strokeThickness: 0 }).setOrigin(0.5);
    const tagBg = scene.add.graphics();
    tagBg.fillStyle(theme.primary, 1);
    tagBg.fillRoundedRect(tag.x - tag.width / 2 - 14, 276 + dy - 20, tag.width + 28, 40, 20);
    layer.add([tagBg, tag]);
    const fxLine = scene.add.text(PREVIEW_X, 462 + dy, kit.t(fxLineKey(skinFxSpec(skin))), shopStyle(kit, fs(26), theme.muted)).setOrigin(0.5);
    const note = scene.add.text(PREVIEW_X, 613 + dy, kit.t('skin.note'), shopStyle(kit, fs(24), theme.muted)).setOrigin(0.5);
    layer.add([fxLine, note]);

    // single action button
    const bx = PREVIEW_X;
    const by = 525 + dy;
    if (act.kind === 'inuse') {
      this.addAction(ctx, bx, by, kit.t('inUse'), theme.muted, 0.5, () => undefined);
    } else if (act.kind === 'use') {
      this.addAction(ctx, bx, by, kit.t('use'), theme.primary, 1, () => void this.onUse(ctx, skin.id));
    } else if (act.kind === 'buy') {
      const b = this.addAction(ctx, bx, by, `${kit.t('buy')} ${act.cost}`, theme.accent, 1, () => void this.onBuy(ctx, skin.id), 0x1a1033);
      starAfter(scene, b);
    } else {
      const btn = this.addAction(ctx, bx, by, kit.t('needMore').replace('{n}', String(act.need)), theme.muted, 0.55, () => {
        scene.tweens.killTweensOf(btn);
        btn.x = bx;
        scene.tweens.add({ targets: btn, x: bx + 12, duration: 50, yoyo: true, repeat: 3, onComplete: () => { btn.x = bx; } });
      });
      starAfter(scene, btn);
    }
  }

  private addAction(ctx: ShopCtx, x: number, y: number, label: string, fill: number, alpha: number, onClick: () => void, textColor = 0xffffff): Phaser.GameObjects.Container {
    const btn = addButton(ctx.scene, x, y, label, { width: 400, height: 84, fill, textColor, fontSize: 36, strokeThickness: textColor === 0xffffff ? 4 : 0, onClick });
    btn.setAlpha(alpha);
    this.previewObjs.push(btn);
    return btn;
  }

  private onCard(ctx: ShopCtx, id: string): void {
    if (this.busy || this.previewId === id) return;
    this.previewId = id;
    ctx.kit.audio.sfx('click');
    ctx.refresh();
  }

  private async onUse(ctx: ShopCtx, id: string): Promise<void> {
    if (this.busy || !ctx.state.owned.includes(id)) return;
    this.busy = true;
    ctx.state.selected = id;
    await ctx.kit.save.setJSON('skin', id);
    ctx.kit.audio.sfx('click');
    this.busy = false;
    if (ctx.scene.sys.isActive()) ctx.refresh();
  }

  private async onBuy(ctx: ShopCtx, id: string): Promise<void> {
    if (this.busy) return;
    const { state, kit, scene } = ctx;
    const res = buySkin({ coins: state.coins, owned: state.owned }, id);
    if (!res.ok) return;
    this.busy = true;
    state.coins = res.coins;
    state.owned = res.owned;
    state.selected = id;
    this.previewId = id;
    await kit.save.setNumber('coins', res.coins);
    await kit.save.setJSON('skins', res.owned);
    await kit.save.setJSON('skin', id);
    kit.audio.sfx('pickup');
    this.busy = false;
    if (!scene.sys.isActive()) return;
    ctx.refresh();
    kit.fx(scene).burst(PREVIEW_X, PREVIEW_Y + (sceneIsLandscape(scene) ? LAND_DY : 0), { color: 0xffe14d, count: 30, speed: 420 });
  }
}

/** Appends a drawn star-coin icon after a button's label text (centres the pair). */
function starAfter(scene: Phaser.Scene, btn: Phaser.GameObjects.Container): void {
  const text = btn.list[1] as Phaser.GameObjects.Text;
  const star = drawCurrencyIcon(scene, 0, 0, 34);
  const total = text.width + 10 + 34;
  text.x = -total / 2 + text.width / 2;
  star.setPosition(total / 2 - 17, 0);
  btn.add(star);
}
