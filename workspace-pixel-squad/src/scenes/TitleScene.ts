import Phaser from 'phaser';
import { listSlots, saveSlot, loadSlot } from '../save/SaveSystem';
import { newGame } from '../save/GameState';
import type { SlotMeta } from '../save/SaveSystem';
import type { GameState } from '../types';

export class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    // E2E test shortcut: ?e2e=1 bypasses TitleScene and jumps directly to BattleScene
    if (new URLSearchParams(window.location.search).has('e2e')) {
      const gs = newGame(0);
      saveSlot(gs);
      this.scene.start('BattleScene', {
        playerParty: gs.squad,
        stageIndex: 0,
        expPool: 0,
        gameState: gs,
      });
      return;
    }

    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    this.add.text(W / 2, 100, 'PIXEL SQUAD', {
      fontSize: '28px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 140, '廢土生存 RPG', {
      fontSize: '13px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.renderSlots();
  }

  private renderSlots() {
    const W = 360;
    const slots = listSlots();
    slots.forEach((meta, i) => {
      const y = 220 + i * 110;
      this.renderSlotCard(meta, W / 2, y);
    });

    const newBtn = this.add.rectangle(W / 2, 570, 160, 40, 0x374151)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, 570, '新遊戲', {
      fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5);
    newBtn.on('pointerdown', () => this.handleNewGame());
    newBtn.on('pointerover', () => newBtn.setAlpha(0.8));
    newBtn.on('pointerout', () => newBtn.setAlpha(1));
  }

  private renderSlotCard(meta: SlotMeta, x: number, y: number) {
    const bg = this.add.rectangle(x, y, 300, 90, meta.empty ? 0x1f2937 : 0x374151)
      .setStrokeStyle(1, 0x4b5563)
      .setInteractive({ useHandCursor: true });

    const slotLabel = `存檔 ${meta.slot + 1}`;
    this.add.text(x - 120, y - 26, slotLabel, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    });

    if (meta.empty) {
      this.add.text(x, y, '空白', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
    } else {
      const dateStr = meta.savedAt ? new Date(meta.savedAt).toLocaleDateString('zh-TW') : '';
      this.add.text(x - 120, y - 4, `${meta.chapterName}`, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      });
      this.add.text(x - 120, y + 20, `${meta.squadSize} 名隊員  ${dateStr}`, {
        fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace',
      });
    }

    bg.on('pointerdown', () => this.handleSlotTap(meta));
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }

  private handleSlotTap(meta: SlotMeta) {
    if (meta.empty) {
      this.startNewGameInSlot(meta.slot);
      return;
    }
    const state: GameState | null = loadSlot(meta.slot);
    if (!state) { this.startNewGameInSlot(meta.slot); return; }
    if (state.stageProgress.inChapterRun) {
      this.scene.start('WorldMapScene', state);
    } else {
      this.scene.start('BaseScene', state);
    }
  }

  private handleNewGame() {
    const slots = listSlots();
    const emptySlot = slots.find(s => s.empty);
    if (emptySlot) {
      this.startNewGameInSlot(emptySlot.slot);
    } else {
      this.showOverwritePicker();
    }
  }

  private startNewGameInSlot(slot: 0 | 1 | 2) {
    const state = newGame(slot);
    saveSlot(state);
    this.scene.start('BaseScene', state);
  }

  private showOverwritePicker() {
    const W = 360, H = 640;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7)
      .setInteractive();
    this.add.text(W / 2, H / 2 - 80, '選擇存檔位置：', {
      fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const slots = listSlots();
    slots.forEach((meta, i) => {
      const x = 60 + i * 120;
      const btn = this.add.rectangle(x, H / 2, 100, 50, 0x7c3aed)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, H / 2, `存檔 ${meta.slot + 1}`, {
        fontSize: '12px', color: '#fff', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => {
        overlay.destroy();
        this.startNewGameInSlot(meta.slot);
      });
    });
  }
}
