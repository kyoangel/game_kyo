import Phaser from 'phaser';
import type { Character, PrepSceneData } from '../types';
import { canLevelUp, applyLevelUp, DEFAULT_LEVEL_UP_CONFIG } from '../battle/LevelUpSystem';
import { allocateStat } from '../battle/ExpSystem';
import { STAGES } from '../data/stages';

export class PrepScene extends Phaser.Scene {
  private party: Character[] = [];
  private stageIndex = 0;
  private expPool = 0;

  private expPoolText!: Phaser.GameObjects.Text;
  private expPoolBar!: Phaser.GameObjects.Rectangle;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];

  private allocationPanel?: Phaser.GameObjects.Container;
  private currentAllocChar?: Character;
  private currentAllocIndex = 0;
  private pointsText?: Phaser.GameObjects.Text;
  private statValueTexts = new Map<string, Phaser.GameObjects.Text>();

  constructor() { super({ key: 'PrepScene' }); }

  create(data: PrepSceneData) {
    this.party = data.playerParty.map(c => ({ ...c, stats: { ...c.stats } }));
    this.stageIndex = data.stageIndex;
    this.expPool = data.expPool;
    this.rowObjects = [];

    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    this.add.text(W / 2, 28, '整備', {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    // EXP Pool display
    this.add.text(20, 68, 'EXP池', { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' });
    this.add.rectangle(200, 80, 220, 12, 0x374151).setOrigin(0.5, 0.5);
    this.expPoolBar = this.add.rectangle(90, 80, 0, 10, 0x4ade80).setOrigin(0, 0.5);
    this.expPoolText = this.add.text(320, 68, '0', {
      fontSize: '12px', color: '#4ade80', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.add.line(W / 2, 104, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    this.updateExpPoolDisplay();
    this.renderPartyList();

    // 出發 button
    const isLastStage = this.stageIndex >= STAGES.length - 1;
    const btnLabel = isLastStage ? '通關！再挑戰' : '出發';
    const btnColor = isLastStage ? 0x7c3aed : 0x16a34a;
    const btn = this.add.rectangle(W / 2, 590, 200, 44, btnColor)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, 590, btnLabel, {
      fontSize: '15px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    btn.on('pointerdown', () => this.goToNextBattle());
    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout', () => btn.setAlpha(1));
  }

  private renderPartyList() {
    this.rowObjects.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.rowObjects = [];

    const startY = 120;
    this.party.forEach((char, i) => {
      const y = startY + i * 130;
      const cost = DEFAULT_LEVEL_UP_CONFIG.expFormula(char.level);
      const canUp = canLevelUp(char, this.expPool, DEFAULT_LEVEL_UP_CONFIG);

      const rowBg = this.add.rectangle(180, y + 45, 340, 110, canUp ? 0x1f2937 : 0x161e2e)
        .setStrokeStyle(1, canUp ? 0x4b5563 : 0x1f2937);

      const nameText = this.add.text(24, y + 14, `${char.name}  Lv.${char.level}`, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      });

      const statsText = this.add.text(24, y + 38,
        `HP:${char.stats.hp}  ATK:${char.stats.atk}  DEF:${char.stats.def}  SPD:${char.stats.spd}`,
        { fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace' });

      const costColor = canUp ? '#4ade80' : '#6b7280';
      const costLabel = canUp ? `▶ 下一級需 ${cost} EXP` : `需 ${cost} EXP（不足）`;
      const costText = this.add.text(24, y + 62, costLabel, {
        fontSize: '11px', color: costColor, fontFamily: 'monospace',
      });

      this.rowObjects.push(rowBg, nameText, statsText, costText);

      if (canUp) {
        const lvBtn = this.add.rectangle(294, y + 45, 76, 36, 0x16a34a)
          .setInteractive({ useHandCursor: true });
        const lvTxt = this.add.text(294, y + 45, '升級', {
          fontSize: '13px', color: '#fff', fontFamily: 'monospace',
        }).setOrigin(0.5);
        lvBtn.on('pointerdown', () => this.handleLevelUp(i));
        lvBtn.on('pointerover', () => lvBtn.setAlpha(0.8));
        lvBtn.on('pointerout', () => lvBtn.setAlpha(1));
        this.rowObjects.push(lvBtn, lvTxt);
      }
    });
  }

  private updateExpPoolDisplay() {
    this.expPoolText.setText(String(this.expPool));
    const maxDisplay = 500;
    const pct = Math.min(1, this.expPool / maxDisplay);
    this.expPoolBar.width = 220 * pct;
  }

  private handleLevelUp(charIndex: number) {
    if (this.allocationPanel) return; // block while panel is open
    const char = this.party[charIndex];
    const result = applyLevelUp(char, this.expPool, DEFAULT_LEVEL_UP_CONFIG);
    this.party[charIndex] = result.character;
    this.expPool = result.expPool;
    this.updateExpPoolDisplay();

    if (result.character.isProtagonist) {
      this.showAllocationPanel(result.character, charIndex);
    } else {
      this.showNonProtagonistSummary(char, result.character);
    }
  }

  private showNonProtagonistSummary(before: Character, after: Character) {
    const W = 360, H = 640;
    const panel = this.add.container(W / 2, H / 2 - 40);
    panel.setDepth(10);

    const bg = this.add.rectangle(0, 0, 300, 160, 0x1f2937).setStrokeStyle(2, 0x4b5563);
    const title = this.add.text(0, -55, `${after.name}  Lv.${before.level} → Lv.${after.level}`, {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const gainParts: string[] = [];
    if (after.stats.hp > before.stats.hp) gainParts.push(`HP+${after.stats.hp - before.stats.hp}`);
    if (after.stats.atk > before.stats.atk) gainParts.push(`ATK+${after.stats.atk - before.stats.atk}`);
    if (after.stats.def > before.stats.def) gainParts.push(`DEF+${after.stats.def - before.stats.def}`);
    if (after.stats.spd > before.stats.spd) gainParts.push(`SPD+${after.stats.spd - before.stats.spd}`);
    const gains = gainParts.join('  ') || '無成長';

    const gainText = this.add.text(0, 5, gains, {
      fontSize: '14px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const hint = this.add.text(0, 55, '（點擊繼續）', {
      fontSize: '11px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5);

    panel.add([bg, title, gainText, hint]);
    bg.setInteractive();
    const dismiss = () => { if (panel.active) { panel.destroy(); this.renderPartyList(); } };
    bg.on('pointerdown', dismiss);
    this.time.delayedCall(2000, dismiss);
  }

  private showAllocationPanel(char: Character, charIndex: number) {
    this.currentAllocChar = char;
    this.currentAllocIndex = charIndex;
    this.statValueTexts.clear();

    const W = 360, H = 640;
    this.allocationPanel = this.add.container(W / 2, H / 2 - 20);
    this.allocationPanel.setDepth(10);

    const bg = this.add.rectangle(0, 0, 320, 360, 0x1f2937).setStrokeStyle(2, 0x7c3aed);
    // bg must be added FIRST so stat rows render on top of it, not beneath it
    this.allocationPanel.add(bg);

    const title = this.add.text(0, -155, `${char.name}  升級 Lv.${char.level}`, {
      fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.pointsText = this.add.text(0, -125, `剩餘點數: ${char.statPoints}`, {
      fontSize: '15px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.allocationPanel.add([title, this.pointsText]);

    const statDefs: Array<{ key: 'hp' | 'atk' | 'def' | 'spd'; label: string; inc: string }> = [
      { key: 'hp', label: 'HP', inc: '+10' },
      { key: 'atk', label: 'ATK', inc: '+2' },
      { key: 'def', label: 'DEF', inc: '+2' },
      { key: 'spd', label: 'SPD', inc: '+2' },
    ];

    statDefs.forEach(({ key, label, inc }, i) => {
      const y = -70 + i * 60;
      const lbl = this.add.text(-130, y, label, {
        fontSize: '15px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0, 0.5);
      const val = this.add.text(10, y, String(char.stats[key]), {
        fontSize: '15px', color: '#a78bfa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.statValueTexts.set(key, val);
      const btn = this.add.rectangle(100, y, 70, 32, 0x374151)
        .setInteractive({ useHandCursor: true });
      const btnTxt = this.add.text(100, y, inc, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.spendPoint(key));
      btn.on('pointerover', () => btn.setFillStyle(0x4b5563));
      btn.on('pointerout', () => btn.setFillStyle(0x374151));
      this.allocationPanel!.add([lbl, val, btn, btnTxt]);
    });

    const confirmBtn = this.add.rectangle(0, 140, 160, 40, 0x16a34a)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(0, 140, '確認', {
      fontSize: '16px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    confirmBtn.on('pointerdown', () => this.closeAllocationPanel());
    confirmBtn.on('pointerover', () => confirmBtn.setAlpha(0.8));
    confirmBtn.on('pointerout', () => confirmBtn.setAlpha(1));

    this.allocationPanel.add([confirmBtn, confirmTxt]);
  }

  private spendPoint(stat: 'hp' | 'atk' | 'def' | 'spd') {
    if (!this.currentAllocChar || this.currentAllocChar.statPoints <= 0) return;
    const updated = allocateStat(this.currentAllocChar, stat);
    this.currentAllocChar = updated;
    this.party[this.currentAllocIndex] = updated;
    this.pointsText?.setText(`剩餘點數: ${updated.statPoints}`);
    this.statValueTexts.get(stat)?.setText(String(updated.stats[stat]));
  }

  private closeAllocationPanel() {
    this.allocationPanel?.destroy();
    this.allocationPanel = undefined;
    this.currentAllocChar = undefined;
    this.renderPartyList();
  }

  private goToNextBattle() {
    if (this.allocationPanel) return; // must confirm allocation first
    const isLastStage = this.stageIndex >= STAGES.length - 1;
    const nextStage = isLastStage ? 0 : this.stageIndex + 1;
    this.scene.start('BattleScene', {
      playerParty: this.party,
      stageIndex: nextStage,
      expPool: this.expPool,
    });
  }
}
