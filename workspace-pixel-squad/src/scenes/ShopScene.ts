import Phaser from 'phaser';
import type { Character, GameState, ShopItem } from '../types';
import { SHOP_ITEMS } from '../data/shopItems';
import { canAfford, hasAnyEligibleCharacter, isEligibleForScroll, teachSkill, addToInventory } from '../battle/ShopSystem';
import { saveSlot } from '../save/SaveSystem';
import { getSfx } from '../audio/SfxManager';
import { SFX_KEYS } from '../data/audio';

export class ShopScene extends Phaser.Scene {
  private gameState!: GameState;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private pickerPanel?: Phaser.GameObjects.Container;
  private currencyText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'ShopScene' }); }

  init(data: { gameState: GameState }) {
    this.gameState = data.gameState;
  }

  create() {
    const W = 360;
    this.add.rectangle(W / 2, 320, W, 640, 0x111827);

    this.add.text(W / 2, 24, '商店', {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const backBtn = this.add.rectangle(40, 24, 60, 28, 0x374151).setInteractive({ useHandCursor: true });
    this.add.text(40, 24, '← 基地', { fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace' }).setOrigin(0.5);
    backBtn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.scene.start('BaseScene', this.gameState); });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x4b5563));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x374151));

    this.currencyText = this.add.text(W - 20, 24, `幣:${this.gameState.currency}`, {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    this.renderList();
  }

  private renderList() {
    this.rowObjects.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.rowObjects = [];
    this.currencyText.setText(`幣:${this.gameState.currency}`);

    let y = 50;

    const scrollLabel = this.add.text(20, y, '技能卷軸', { fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace' });
    this.rowObjects.push(scrollLabel);
    y += 22;
    SHOP_ITEMS.filter(i => i.type === 'skill_scroll').forEach((item) => {
      y = this.renderRow(item, y);
    });

    const supplyLabel = this.add.text(20, y + 4, '補給品', { fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace' });
    this.rowObjects.push(supplyLabel);
    y += 26;
    SHOP_ITEMS.filter(i => i.type === 'supply').forEach((item) => {
      y = this.renderRow(item, y);
    });
  }

  private renderRow(item: ShopItem, y: number): number {
    const W = 360;
    const rowBg = this.add.rectangle(W / 2, y + 24, 340, 48, 0x1f2937).setStrokeStyle(1, 0x4b5563);
    const nameText = this.add.text(20, y + 12, `${item.name}  ${item.price}幣`, { fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace' });
    const descText = this.add.text(20, y + 30, item.description, { fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' });
    this.rowObjects.push(rowBg, nameText, descText);

    const affordable = canAfford(this.gameState.currency, item.price);
    const eligible = item.type === 'skill_scroll'
      ? (item.skillId ? hasAnyEligibleCharacter(this.gameState.pool, item.skillId) : false)
      : true;
    const canBuy = affordable && eligible;

    const buyBtn = this.add.rectangle(310, y + 24, 60, 32, canBuy ? 0x16a34a : 0x374151);
    const buyTxt = this.add.text(310, y + 24, '購買', { fontSize: '12px', color: canBuy ? '#fff' : '#6b7280', fontFamily: 'monospace' }).setOrigin(0.5);
    this.rowObjects.push(buyBtn, buyTxt);
    if (canBuy) {
      buyBtn.setInteractive({ useHandCursor: true });
      buyBtn.on('pointerdown', () => this.handleBuy(item));
      buyBtn.on('pointerover', () => buyBtn.setAlpha(0.8));
      buyBtn.on('pointerout', () => buyBtn.setAlpha(1));
    }

    return y + 56;
  }

  private handleBuy(item: ShopItem) {
    if (this.pickerPanel) return;
    if (item.type === 'supply') {
      getSfx(this).play(SFX_KEYS.purchase);
      this.gameState.currency -= item.price;
      this.gameState.inventory = addToInventory(this.gameState.inventory ?? [], item.id);
      saveSlot(this.gameState);
      this.renderList();
      return;
    }

    if (item.skillId) {
      this.showCharacterPicker(item);
    }
  }

  private showCharacterPicker(item: ShopItem) {
    const skillId = item.skillId!;
    const eligible = this.gameState.pool.filter(c => isEligibleForScroll(c, skillId));
    if (eligible.length === 0) return;

    const W = 360, H = 640;
    const panel = this.add.container(W / 2, H / 2);
    panel.setDepth(10);
    const bg = this.add.rectangle(0, 0, 300, 80 + eligible.length * 40, 0x1f2937).setStrokeStyle(2, 0x7c3aed);
    panel.add(bg);
    const title = this.add.text(0, -(40 + eligible.length * 20) + 10, '選擇學習角色', {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    panel.add(title);

    let y = -(20 + eligible.length * 20) + 30;
    eligible.forEach((char) => {
      const rowBtn = this.add.rectangle(0, y, 260, 32, 0x374151).setInteractive({ useHandCursor: true });
      const rowTxt = this.add.text(0, y, `${char.name}  Lv.${char.level}`, {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      rowBtn.on('pointerdown', () => this.handleTeach(item, char));
      rowBtn.on('pointerover', () => rowBtn.setFillStyle(0x4b5563));
      rowBtn.on('pointerout', () => rowBtn.setFillStyle(0x374151));
      panel.add([rowBtn, rowTxt]);
      y += 40;
    });

    const cancelBtn = this.add.rectangle(0, y, 120, 32, 0x7f1d1d).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(0, y, '取消', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    cancelBtn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.closePicker(); });
    cancelBtn.on('pointerover', () => cancelBtn.setAlpha(0.8));
    cancelBtn.on('pointerout', () => cancelBtn.setAlpha(1));
    panel.add([cancelBtn, cancelTxt]);

    this.pickerPanel = panel;
  }

  private handleTeach(item: ShopItem, char: Character) {
    getSfx(this).play(SFX_KEYS.purchase);
    this.gameState.currency -= item.price;
    const updated = teachSkill(char, item.skillId!);
    this.updateCharInState(updated);
    saveSlot(this.gameState);
    this.closePicker();
  }

  private updateCharInState(updated: Character) {
    const squadIdx = this.gameState.squad.findIndex(c => c.id === updated.id);
    if (squadIdx >= 0) this.gameState.squad[squadIdx] = updated;
    const poolIdx = this.gameState.pool.findIndex(c => c.id === updated.id);
    if (poolIdx >= 0) this.gameState.pool[poolIdx] = updated;
    if (this.gameState.stageProgress.inChapterRun) {
      const run = this.gameState.stageProgress.inChapterRun;
      const lockedIdx = run.lockedSquad.findIndex(c => c.id === updated.id);
      if (lockedIdx >= 0) run.lockedSquad[lockedIdx] = updated;
    }
  }

  private closePicker() {
    this.pickerPanel?.destroy();
    this.pickerPanel = undefined;
    this.renderList();
  }
}
