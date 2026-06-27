import Phaser from 'phaser';
import { listSlots, saveSlot, loadSlot, deleteSlot } from '../save/SaveSystem';
import { newGame } from '../save/GameState';
import type { SlotMeta } from '../save/SaveSystem';
import type { GameState } from '../types';
import { SfxManager, getSfx } from '../audio/SfxManager';
import { SFX_KEYS } from '../data/audio';

export class TitleScene extends Phaser.Scene {
  private muteIcon!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'TitleScene' }); }

  preload() {
    SfxManager.preload(this);
  }

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

    this.renderMuteIcon();
    this.renderSlots();
  }

  private renderMuteIcon() {
    const sfx = getSfx(this);
    this.muteIcon = this.add.text(336, 16, sfx.isMuted() ? '🔇' : '🔊', {
      fontSize: '16px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.muteIcon.on('pointerdown', () => {
      const muted = sfx.toggleMute();
      this.muteIcon.setText(muted ? '🔇' : '🔊');
    });
  }

  private renderSlots() {
    const W = 360;
    const slots = listSlots();
    slots.forEach((meta, i) => {
      const y = 220 + i * 130;
      this.renderSlotCard(meta, W / 2, y);
    });
  }

  private renderSlotCard(meta: SlotMeta, x: number, y: number) {
    const bg = this.add.rectangle(x, y, 300, 100, meta.empty ? 0x1f2937 : 0x374151)
      .setStrokeStyle(1, 0x4b5563)
      .setInteractive({ useHandCursor: true });

    this.add.text(x - 120, y - 32, `存檔 ${meta.slot + 1}`, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    });

    if (meta.empty) {
      this.add.text(x - 20, y, '空白  點擊開始', {
        fontSize: '13px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
    } else {
      const dateStr = meta.savedAt ? new Date(meta.savedAt).toLocaleDateString('zh-TW') : '';
      this.add.text(x - 120, y - 10, `${meta.chapterName}`, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      });
      this.add.text(x - 120, y + 16, `${meta.squadSize} 名隊員  ${dateStr}`, {
        fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace',
      });

      // Delete button — only on filled slots
      const delBtn = this.add.rectangle(x + 110, y, 52, 30, 0x7f1d1d)
        .setInteractive({ useHandCursor: true });
      this.add.text(x + 110, y, '刪除', {
        fontSize: '12px', color: '#fca5a5', fontFamily: 'monospace',
      }).setOrigin(0.5);
      delBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.confirmDelete(meta.slot);
      });
      delBtn.on('pointerover', () => delBtn.setFillStyle(0x991b1b));
      delBtn.on('pointerout', () => delBtn.setFillStyle(0x7f1d1d));
    }

    bg.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.handleSlotTap(meta); });
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

  private startNewGameInSlot(slot: 0 | 1 | 2) {
    const state = newGame(slot);
    saveSlot(state);
    this.scene.start('BaseScene', state);
  }

  private confirmDelete(slot: 0 | 1 | 2) {
    const W = 360, H = 640;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75)
      .setInteractive().setDepth(20);
    const panel = this.add.container(W / 2, H / 2).setDepth(21);

    const panelBg = this.add.rectangle(0, 0, 280, 160, 0x1f2937).setStrokeStyle(2, 0x7f1d1d);
    const msg = this.add.text(0, -44, `刪除存檔 ${slot + 1}？`, {
      fontSize: '15px', color: '#fca5a5', fontFamily: 'monospace',
    }).setOrigin(0.5);
    const sub = this.add.text(0, -14, '此操作無法復原', {
      fontSize: '12px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const confirmBtn = this.add.rectangle(-60, 44, 100, 36, 0x7f1d1d).setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(-60, 44, '確認刪除', { fontSize: '12px', color: '#fca5a5', fontFamily: 'monospace' }).setOrigin(0.5);
    confirmBtn.on('pointerdown', () => {
      deleteSlot(slot);
      overlay.destroy();
      panel.destroy();
      this.scene.restart();
    });
    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0x991b1b));
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0x7f1d1d));

    const cancelBtn = this.add.rectangle(60, 44, 80, 36, 0x374151).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(60, 44, '取消', { fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace' }).setOrigin(0.5);
    cancelBtn.on('pointerdown', () => { overlay.destroy(); panel.destroy(); });
    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x4b5563));
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x374151));

    panel.add([panelBg, msg, sub, confirmBtn, confirmTxt, cancelBtn, cancelTxt]);
  }
}
