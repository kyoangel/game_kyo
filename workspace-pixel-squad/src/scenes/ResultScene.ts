import Phaser from 'phaser';
import type { ResultSceneData } from '../types';
import { applyExp } from '../battle/ExpSystem';
import { STAGES } from '../data/stages';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: ResultSceneData) {
    const { victory, playerParty, stageIndex, expGained } = data;
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    const title = victory ? '勝利！' : '敗北...';
    const titleColor = victory ? '#4ade80' : '#ef4444';
    this.add.text(W / 2, 160, title, {
      fontSize: '36px', color: titleColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 220, STAGES[stageIndex].name, {
      fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (victory) {
      this.add.text(W / 2, 270, `獲得 EXP: ${expGained}`, {
        fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
      }).setOrigin(0.5);

      const updatedParty = playerParty.map(c => applyExp(c, expGained));
      const hasProtagonistPoints = updatedParty.some(c => c.isProtagonist && c.statPoints > 0);

      let y = 310;
      updatedParty.forEach(c => {
        const leveled = c.level > (playerParty.find(p => p.id === c.id)?.level ?? 1);
        const label = leveled ? `${c.name} Lv.${c.level} ↑` : `${c.name} Lv.${c.level}`;
        this.add.text(W / 2, y, label, {
          fontSize: '13px', color: leveled ? '#a78bfa' : '#e5e7eb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        y += 22;
      });

      const isLastStage = stageIndex >= STAGES.length - 1;

      if (hasProtagonistPoints) {
        this.makeButton(W / 2, 520, '分配能力點數', 0x7c3aed, () => {
          this.scene.start('AllocateScene', { playerParty: updatedParty, stageIndex });
        });
      } else if (!isLastStage) {
        this.makeButton(W / 2, 520, '下一關', 0x16a34a, () => {
          this.scene.start('BattleScene', { playerParty: updatedParty, stageIndex: stageIndex + 1 });
        });
      } else {
        this.add.text(W / 2, 500, '🎉 全部關卡通關！', {
          fontSize: '18px', color: '#fde047', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.makeButton(W / 2, 540, '再來一次', 0x374151, () => {
          this.scene.start('BattleScene', { playerParty: [], stageIndex: 0 });
        });
      }
    } else {
      this.add.text(W / 2, 300, '隊伍全滅', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.makeButton(W / 2, 400, '重試', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex });
      });
      this.makeButton(W / 2, 460, '從第一關開始', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex: 0 });
      });
    }
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const bg = this.add.rectangle(x, y, 180, 40, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontSize: '13px', color: '#fff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    bg.on('pointerdown', cb);
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }
}
