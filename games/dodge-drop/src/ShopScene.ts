import Phaser from 'phaser';
import { addBackground, addButton, ensureTextures, getKit, type Kit } from '@gf/game-kit';
import { sanitizeBoosts } from './boosts.ts';
import { renderBoostsPanel } from './boostsPanel.ts';
import { sanitizeOwned } from './format.ts';
import { drawCurrencyIcon, ensureUiTextures } from './playArt.ts';
import { SkinsPanel } from './skinsPanel.ts';
import { SHOP_TABS, sanitizeShopTab, shopStyle, type ShopCtx, type ShopState, type ShopTab } from './shopTypes.ts';
import { renderUpgradesPanel } from './workshopPanel.ts';
import { sanitizeWorkshop, shieldCapacity } from './workshop.ts';

const TAB_Y = 172;
const TAB_W = 216;

/** Merged Shop: Upgrades | Skins | Boosts tabs under one balance and Back button. */
export class ShopScene extends Phaser.Scene {
  private kit!: Kit;
  private state: ShopState | null = null;
  private tab: ShopTab = 'upgrades';
  private layer: Phaser.GameObjects.GameObject[] = [];
  private skins = new SkinsPanel('cyan');
  private chain: Promise<void> = Promise.resolve();

  constructor() {
    super('Shop');
  }

  create(): void {
    this.kit = getKit(this);
    const { theme } = this.kit;
    ensureTextures(this, theme);
    ensureUiTextures(this);
    addBackground(this);
    this.layer = [];
    this.state = null;
    this.chain = Promise.resolve();
    this.skins = new SkinsPanel('cyan');
    this.events.once('shutdown', () => this.skins.destroy(this));

    addButton(this, 120, 80, this.kit.t('back'), {
      width: 180, height: 72, fill: theme.muted, fontSize: 32,
      onClick: () => this.kit.goTo('GKTitle'),
    });

    const save = this.kit.save;
    void Promise.all([
      save.getNumber('coins', 0),
      save.getJSON<unknown>('workshop', {}),
      save.getJSON<unknown>('skins', []),
      save.getJSON<string>('skin', 'cyan'),
      save.getJSON<unknown>('boosts', null),
      save.getJSON<unknown>('shopTab', 'upgrades'),
    ]).then(([coins, ws, owned, sel, rawBoosts, rawTab]) => {
      if (!this.sys.isActive()) return;
      const workshop = sanitizeWorkshop(ws);
      const ownedSkins = sanitizeOwned(owned);
      const selected = ownedSkins.includes(sel) ? sel : 'cyan';
      this.state = {
        coins: Math.max(0, Math.floor(coins)),
        workshop,
        owned: ownedSkins,
        selected,
        boosts: sanitizeBoosts(rawBoosts, shieldCapacity(workshop.shieldStack)),
      };
      this.skins = new SkinsPanel(selected);
      this.tab = sanitizeShopTab(rawTab);
      this.render();
    });
  }

  update(time: number): void {
    this.skins.update(time);
  }

  private ctx(state: ShopState): ShopCtx {
    return {
      scene: this,
      kit: this.kit,
      state,
      add: (o) => { this.layer.push(o); return o; },
      refresh: () => this.render(),
      persist: (fn) => { this.chain = this.chain.then(fn); },
    };
  }

  private setTab(tab: ShopTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.chain = this.chain.then(() => this.kit.save.setJSON('shopTab', tab));
    this.kit.audio.sfx('click');
    this.render();
  }

  private render(): void {
    const state = this.state;
    if (!state || !this.sys.isActive()) return;
    for (const o of this.layer) o.destroy();
    this.layer = [];
    this.skins.destroy(this);
    const { theme } = this.kit;
    const ctx = this.ctx(state);

    // Balance, top-center (clear of Back on the left).
    const bal = ctx.add(this.add.text(0, 80, String(state.coins), shopStyle(this.kit, 44, 0xffe14d)).setOrigin(0, 0.5));
    const total = 52 + 10 + bal.width;
    const x0 = this.scale.width / 2 - total / 2 + 24;
    ctx.add(drawCurrencyIcon(this, x0, 80, 52));
    bal.setX(x0 + 36);

    SHOP_TABS.forEach((id, i) => {
      const sel = this.tab === id;
      const btn = addButton(this, this.scale.width / 2 + (i - 1) * (TAB_W + 8), TAB_Y, this.kit.t(`tab.${id}`), {
        width: TAB_W, height: 64, fontSize: 30,
        fill: sel ? theme.accent : theme.primary,
        textColor: sel ? 0x1a1033 : 0xffffff,
        strokeThickness: sel ? 0 : 4,
        onClick: () => this.setTab(id),
      });
      ctx.add(btn);
    });

    if (this.tab === 'upgrades') renderUpgradesPanel(ctx);
    else if (this.tab === 'skins') this.skins.render(ctx);
    else renderBoostsPanel(ctx);
  }
}
