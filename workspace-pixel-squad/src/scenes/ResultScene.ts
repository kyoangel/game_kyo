import Phaser from 'phaser';
import type { ResultSceneData } from '../types';
import { STAGES } from '../data/stages';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: ResultSceneData) {
    const { victory, playerParty, stageIndex, expGained, expPool = 0, recruitedEnemy } = data;
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
      const newExpPool = expPool + expGained;

      this.add.text(W / 2, 270, `獲得 EXP: +${expGained}`, {
        fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.add.text(W / 2, 304, `EXP池: ${newExpPool}`, {
        fontSize: '13px', color: '#4ade80', fontFamily: 'monospace',
      }).setOrigin(0.5);

      if (recruitedEnemy) {
        this.add.text(W / 2, 338, `新成員：${recruitedEnemy.name} 加入了！`, {
          fontSize: '15px', color: '#a78bfa', fontFamily: 'monospace',
        }).setOrigin(0.5);
      }

      let y = 350;
      playerParty.forEach(c => {
        this.add.text(W / 2, y, `${c.name}  Lv.${c.level}`, {
          fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        y += 22;
      });

      this.makeButton(W / 2, 520, '整備', 0x7c3aed, () => {
        this.scene.start('PrepScene', {
          playerParty,
          stageIndex,
          expPool: newExpPool,
        });
      });
    } else {
      this.add.text(W / 2, 300, '隊伍全滅', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.makeButton(W / 2, 400, '重試', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex, expPool });
      });
      this.makeButton(W / 2, 460, '從第一關開始', 0x374151, () => {
        this.scene.start('BattleScene', { playerParty: [], stageIndex: 0, expPool: 0 });
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
