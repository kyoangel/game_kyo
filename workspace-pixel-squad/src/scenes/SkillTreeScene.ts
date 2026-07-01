import Phaser from 'phaser';
import type { Character, GameState, SkillTreeNode } from '../types';
import {
  getSkillTree,
  canUnlockNode,
  unlockNode,
  isNodeUnlocked,
  calculateRespecRefund,
  canRespec,
  respecCharacter,
} from '../battle/SkillTree';
import { SKILLS } from '../data/skills';
import { RESPEC_ITEM_ID } from '../data/shopItems';
import { saveSlot } from '../save/SaveSystem';
import { getSfx } from '../audio/SfxManager';
import { getMusic } from '../audio/MusicManager';
import { SFX_KEYS, MUSIC_KEYS } from '../data/audio';

const BRANCH_LABELS: Record<string, string> = {
  offense: '攻擊',
  control: '控制',
  support: '輔助',
};

const BRANCH_ORDER = ['offense', 'control', 'support'] as const;

export class SkillTreeScene extends Phaser.Scene {
  private gameState!: GameState;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private detailPanel?: Phaser.GameObjects.Container;
  private respecConfirmPanel?: Phaser.GameObjects.Container;

  constructor() { super({ key: 'SkillTreeScene' }); }

  init(data: { gameState: GameState }) {
    this.gameState = data.gameState;
  }

  create() {
    getMusic(this).playTrack(MUSIC_KEYS.theme);

    const W = 360;
    this.add.rectangle(W / 2, 320, W, 640, 0x111827);

    this.add.text(W / 2, 24, '技能樹', {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const backBtn = this.add.rectangle(40, 24, 60, 28, 0x374151).setInteractive({ useHandCursor: true });
    this.add.text(40, 24, '← 基地', { fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace' }).setOrigin(0.5);
    backBtn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.scene.start('BaseScene', this.gameState); });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x4b5563));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x374151));

    this.renderList();
  }

  private renderList() {
    this.rowObjects.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.rowObjects = [];

    let y = 50;
    this.gameState.squad.forEach((char) => {
      y = this.renderCharRow(char, y);
    });
  }

  private renderCharRow(char: Character, y: number): number {
    const W = 360;
    const rowBg = this.add.rectangle(W / 2, y + 30, 340, 56, 0x1f2937).setStrokeStyle(1, 0x4b5563);
    const nameText = this.add.text(20, y + 10, `${char.name}  Lv.${char.level}`, { fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace' });
    const pointsText = this.add.text(20, y + 32, `剩餘技能點數: ${char.skillPoints ?? 0}`, { fontSize: '12px', color: '#fde047', fontFamily: 'monospace' });
    this.rowObjects.push(rowBg, nameText, pointsText);

    const viewBtn = this.add.rectangle(310, y + 30, 60, 32, 0x0891b2).setInteractive({ useHandCursor: true });
    const viewTxt = this.add.text(310, y + 30, '查看', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    viewBtn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.showDetailPanel(char); });
    viewBtn.on('pointerover', () => viewBtn.setAlpha(0.8));
    viewBtn.on('pointerout', () => viewBtn.setAlpha(1));
    this.rowObjects.push(viewBtn, viewTxt);

    return y + 64;
  }

  private showDetailPanel(char: Character) {
    if (this.detailPanel) return;

    const W = 360, H = 640;
    const panel = this.add.container(W / 2, H / 2);
    panel.setDepth(10);

    const tree = getSkillTree(char.templateId);

    if (!tree) {
      const bg = this.add.rectangle(0, 0, 300, 160, 0x1f2937).setStrokeStyle(2, 0x0891b2);
      const title = this.add.text(0, -50, char.name, { fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace' }).setOrigin(0.5);
      const placeholder = this.add.text(0, 0, '此角色暫無技能樹', { fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace' }).setOrigin(0.5);
      panel.add([bg, title, placeholder]);
      this.addCloseButton(panel, 60);
      this.detailPanel = panel;
      return;
    }

    const bg = this.add.rectangle(0, 0, 320, 420, 0x1f2937).setStrokeStyle(2, 0x0891b2);
    panel.add(bg);

    const title = this.add.text(0, -190, `${char.name}  剩餘點數: ${char.skillPoints ?? 0}`, {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    panel.add(title);

    const columnXs = [-100, 0, 100];
    BRANCH_ORDER.forEach((branch, i) => {
      const x = columnXs[i];
      const label = this.add.text(x, -160, BRANCH_LABELS[branch], {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      panel.add(label);

      const nodes = tree.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
      nodes.forEach((node, tierIdx) => {
        const y = -110 + tierIdx * 90;
        this.renderNode(panel, char, node, tree, x, y);
      });
    });

    this.addRespecButton(panel, char, tree);
    this.addCloseButton(panel, 190, 65);
    this.detailPanel = panel;
  }

  private addRespecButton(panel: Phaser.GameObjects.Container, char: Character, tree: SkillTreeNode[]) {
    const enabled = canRespec(char, this.gameState.inventory ?? [], RESPEC_ITEM_ID);
    const color = enabled ? 0xb45309 : 0x4b5563;
    const label = enabled
      ? `重置技能\n(返還${calculateRespecRefund(char, tree)}點)`
      : '重置技能';

    const btn = this.add.rectangle(-65, 190, 110, 32, color);
    const txt = this.add.text(-65, 190, label, {
      fontSize: '10px', color: '#fff', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);
    panel.add([btn, txt]);

    if (enabled) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.showRespecConfirm(char, tree); });
      btn.on('pointerover', () => btn.setAlpha(0.8));
      btn.on('pointerout', () => btn.setAlpha(1));
    }
  }

  private showRespecConfirm(char: Character, tree: SkillTreeNode[]) {
    if (this.respecConfirmPanel) return;

    const W = 360, H = 640;
    const panel = this.add.container(W / 2, H / 2);
    panel.setDepth(20);

    const bg = this.add.rectangle(0, 0, 280, 180, 0x1f2937).setStrokeStyle(2, 0xb45309);
    const refund = calculateRespecRefund(char, tree);
    const text = this.add.text(0, -30,
      `重置 ${char.name} 的技能樹？\n返還 ${refund} 點技能點\n消耗 1 個 神經重塑模組`,
      { fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace', align: 'center' },
    ).setOrigin(0.5);
    panel.add([bg, text]);

    const confirmBtn = this.add.rectangle(-65, 50, 110, 32, 0xb45309).setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(-65, 50, '確定', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    confirmBtn.on('pointerdown', () => this.handleRespecConfirm(char, tree));
    confirmBtn.on('pointerover', () => confirmBtn.setAlpha(0.8));
    confirmBtn.on('pointerout', () => confirmBtn.setAlpha(1));
    panel.add([confirmBtn, confirmTxt]);

    const cancelBtn = this.add.rectangle(65, 50, 110, 32, 0x7f1d1d).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(65, 50, '取消', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    cancelBtn.on('pointerdown', () => {
      getSfx(this).play(SFX_KEYS.buttonClick);
      this.respecConfirmPanel?.destroy();
      this.respecConfirmPanel = undefined;
    });
    cancelBtn.on('pointerover', () => cancelBtn.setAlpha(0.8));
    cancelBtn.on('pointerout', () => cancelBtn.setAlpha(1));
    panel.add([cancelBtn, cancelTxt]);

    this.respecConfirmPanel = panel;
  }

  private handleRespecConfirm(char: Character, tree: SkillTreeNode[]) {
    getSfx(this).play(SFX_KEYS.purchase);
    const result = respecCharacter(char, tree, this.gameState.inventory ?? [], RESPEC_ITEM_ID);
    this.updateCharInState(result.character);
    this.gameState.inventory = result.inventory;
    saveSlot(this.gameState);
    this.respecConfirmPanel?.destroy();
    this.respecConfirmPanel = undefined;
    this.closeDetailPanel();
    this.showDetailPanel(result.character);
  }

  private renderNode(
    panel: Phaser.GameObjects.Container,
    char: Character,
    node: SkillTreeNode,
    tree: SkillTreeNode[],
    x: number,
    y: number,
  ) {
    const skill = SKILLS[node.skillId];
    const unlocked = isNodeUnlocked(char, node.id);
    const unlockable = !unlocked && canUnlockNode(char, node, tree);

    const color = unlocked ? 0x16a34a : unlockable ? 0x2563eb : 0x4b5563;
    const nodeBtn = this.add.rectangle(x, y, 90, 64, color).setStrokeStyle(1, 0x111827);
    const label = unlocked ? skill.name : `${skill.name}\n(${node.cost}點)`;
    const nodeTxt = this.add.text(x, y, label, {
      fontSize: '10px', color: '#fff', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);
    panel.add([nodeBtn, nodeTxt]);

    if (unlockable) {
      nodeBtn.setInteractive({ useHandCursor: true });
      nodeBtn.on('pointerdown', () => this.handleUnlock(char, node));
      nodeBtn.on('pointerover', () => nodeBtn.setAlpha(0.8));
      nodeBtn.on('pointerout', () => nodeBtn.setAlpha(1));
    }
  }

  private addCloseButton(panel: Phaser.GameObjects.Container, y: number, x = 0) {
    const closeBtn = this.add.rectangle(x, y, 110, 32, 0x7f1d1d).setInteractive({ useHandCursor: true });
    const closeTxt = this.add.text(x, y, '關閉', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    closeBtn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.closeDetailPanel(); });
    closeBtn.on('pointerover', () => closeBtn.setAlpha(0.8));
    closeBtn.on('pointerout', () => closeBtn.setAlpha(1));
    panel.add([closeBtn, closeTxt]);
  }

  private handleUnlock(char: Character, node: SkillTreeNode) {
    getSfx(this).play(SFX_KEYS.purchase);
    const updated = unlockNode(char, node);
    this.updateCharInState(updated);
    saveSlot(this.gameState);
    this.closeDetailPanel();
    this.showDetailPanel(updated);
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

  private closeDetailPanel() {
    this.detailPanel?.destroy();
    this.detailPanel = undefined;
    this.renderList();
  }
}
