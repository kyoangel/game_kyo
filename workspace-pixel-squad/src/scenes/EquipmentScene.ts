import Phaser from 'phaser';
import type { Character, EquipmentSlot, GameState } from '../types';
import { equipItem, unequipItem, findEquipmentById } from '../battle/EquipmentSystem';
import { saveSlot } from '../save/SaveSystem';
import { getSfx } from '../audio/SfxManager';
import { getMusic } from '../audio/MusicManager';
import { SFX_KEYS, MUSIC_KEYS } from '../data/audio';

export class EquipmentScene extends Phaser.Scene {
  private gameState!: GameState;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private pickerPanel?: Phaser.GameObjects.Container;
  private currencyText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'EquipmentScene' }); }

  init(data: { gameState: GameState }) {
    this.gameState = data.gameState;
  }

  create() {
    getMusic(this).playTrack(MUSIC_KEYS.theme);

    const W = 360;
    this.add.rectangle(W / 2, 320, W, 640, 0x111827);

    this.add.text(W / 2, 24, '裝備', {
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
    this.gameState.squad.forEach((char) => {
      y = this.renderCharRow(char, y);
    });
  }

  private renderCharRow(char: Character, y: number): number {
    const W = 360;
    const rowBg = this.add.rectangle(W / 2, y + 62, 340, 116, 0x1f2937).setStrokeStyle(1, 0x4b5563);
    const nameText = this.add.text(20, y + 10, `${char.name}  Lv.${char.level}  ${char.archetype}`, { fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace' });
    this.rowObjects.push(rowBg, nameText);

    y = this.renderSlotRow(char, 'weapon', '武器', y + 34);
    y = this.renderSlotRow(char, 'armor', '防具', y + 4);

    return y + 14;
  }

  private renderSlotRow(char: Character, slot: EquipmentSlot, label: string, y: number): number {
    const equipped = char.equipment[slot];
    const nameLabel = equipped ? equipped.name : '（無）';
    const slotText = this.add.text(24, y, `${label}: ${nameLabel}`, { fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace' });
    this.rowObjects.push(slotText);

    const swapBtn = this.add.rectangle(270, y + 6, 56, 26, 0x374151).setInteractive({ useHandCursor: true });
    const swapTxt = this.add.text(270, y + 6, '更換', { fontSize: '11px', color: '#e5e7eb', fontFamily: 'monospace' }).setOrigin(0.5);
    swapBtn.on('pointerdown', () => this.showEquipmentPicker(char, slot));
    swapBtn.on('pointerover', () => swapBtn.setFillStyle(0x4b5563));
    swapBtn.on('pointerout', () => swapBtn.setFillStyle(0x374151));
    this.rowObjects.push(swapBtn, swapTxt);

    if (equipped) {
      const unequipBtn = this.add.rectangle(330, y + 6, 44, 26, 0x7f1d1d).setInteractive({ useHandCursor: true });
      const unequipTxt = this.add.text(330, y + 6, '卸下', { fontSize: '10px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
      unequipBtn.on('pointerdown', () => this.handleUnequip(char, slot));
      unequipBtn.on('pointerover', () => unequipBtn.setAlpha(0.8));
      unequipBtn.on('pointerout', () => unequipBtn.setAlpha(1));
      this.rowObjects.push(unequipBtn, unequipTxt);
    }

    return y + 20;
  }

  private handleUnequip(char: Character, slot: EquipmentSlot) {
    if (this.pickerPanel) return;
    const result = unequipItem(char, slot, this.gameState.equipmentInventory ?? []);
    this.updateCharInState(result.character);
    this.gameState.equipmentInventory = result.inventory;
    saveSlot(this.gameState);
    this.renderList();
  }

  private showEquipmentPicker(char: Character, slot: EquipmentSlot) {
    if (this.pickerPanel) return;

    const entries = (this.gameState.equipmentInventory ?? [])
      .map(entry => ({ entry, item: findEquipmentById(entry.itemId) }))
      .filter((e): e is { entry: typeof e.entry; item: NonNullable<typeof e.item> } => !!e.item && e.item.slot === slot);

    const W = 360, H = 640;
    const rowCount = Math.max(entries.length, 1);
    const panel = this.add.container(W / 2, H / 2);
    panel.setDepth(10);
    const bg = this.add.rectangle(0, 0, 300, 80 + rowCount * 40, 0x1f2937).setStrokeStyle(2, 0x7c3aed);
    panel.add(bg);
    const title = this.add.text(0, -(40 + rowCount * 20) + 10, '選擇裝備', {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    panel.add(title);

    let y = -(20 + rowCount * 20) + 30;

    if (entries.length === 0) {
      const placeholder = this.add.text(0, y, '（無可用裝備，請先至商店購買）', {
        fontSize: '11px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      panel.add(placeholder);
      y += 40;
    } else {
      entries.forEach(({ entry, item }) => {
        const rowBtn = this.add.rectangle(0, y, 260, 36, 0x374151).setInteractive({ useHandCursor: true });
        const rowTxt = this.add.text(0, y, `${item.name}  ${item.description}  x${entry.quantity}`, {
          fontSize: '11px', color: '#e5e7eb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        rowBtn.on('pointerdown', () => this.handleEquip(char, item));
        rowBtn.on('pointerover', () => rowBtn.setFillStyle(0x4b5563));
        rowBtn.on('pointerout', () => rowBtn.setFillStyle(0x374151));
        panel.add([rowBtn, rowTxt]);
        y += 40;
      });
    }

    const cancelBtn = this.add.rectangle(0, y, 120, 32, 0x7f1d1d).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(0, y, '取消', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    cancelBtn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.closePicker(); });
    cancelBtn.on('pointerover', () => cancelBtn.setAlpha(0.8));
    cancelBtn.on('pointerout', () => cancelBtn.setAlpha(1));
    panel.add([cancelBtn, cancelTxt]);

    this.pickerPanel = panel;
  }

  private handleEquip(char: Character, item: NonNullable<ReturnType<typeof findEquipmentById>>) {
    getSfx(this).play(SFX_KEYS.purchase);
    const result = equipItem(char, item, this.gameState.equipmentInventory ?? []);
    this.updateCharInState(result.character);
    this.gameState.equipmentInventory = result.inventory;
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
