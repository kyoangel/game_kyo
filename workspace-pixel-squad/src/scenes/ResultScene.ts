import Phaser from 'phaser';
import type { ResultSceneData } from '../types';
import { STAGES } from '../data/stages';
import { saveSlot } from '../save/SaveSystem';
import { processVictory } from '../battle/VictoryProcessor';

export class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultScene' }); }

  create(data: ResultSceneData) {
    const { victory, playerParty, stageIndex, expGained, expPool = 0, recruitedEnemy, gameState } = data;
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    const title = victory ? '勝利！' : '敗北...';
    const titleColor = victory ? '#4ade80' : '#ef4444';
    this.add.text(W / 2, 160, title, {
      fontSize: '36px', color: titleColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    const stage = STAGES[stageIndex];
    this.add.text(W / 2, 220, stage?.name ?? '', {
      fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (victory) {
      let updatedGameState = gameState;
      if (gameState && stage) {
        updatedGameState = processVictory(gameState, stage, expGained, recruitedEnemy);
        saveSlot(updatedGameState);
      }
      const newExpPool = updatedGameState?.expPool ?? (expPool + expGained);

      this.add.text(W / 2, 270, `獲得 EXP: +${expGained}`, {
        fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.add.text(W / 2, 300, `EXP池: ${newExpPool}`, {
        fontSize: '13px', color: '#4ade80', fontFamily: 'monospace',
      }).setOrigin(0.5);

      if (stage?.currencyReward) {
        this.add.text(W / 2, 322, `幣: +${stage.currencyReward}`, {
          fontSize: '13px', color: '#fde047', fontFamily: 'monospace',
        }).setOrigin(0.5);
      }

      if (recruitedEnemy) {
        this.add.text(W / 2, 346, `新成員：${recruitedEnemy.name} 加入了！`, {
          fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace',
        }).setOrigin(0.5);
      } else if (gameState && updatedGameState) {
        // Story-join: show announcement for any character newly added to pool
        const newChar = updatedGameState.pool.find(
          c => !gameState.pool.some(p => p.id === c.id)
        );
        if (newChar) {
          const joinedSquad = updatedGameState.squad.some(s => s.id === newChar.id);
          const msg = joinedSquad ? `${newChar.name} 加入了小隊！` : `${newChar.name} 加入了基地！`;
          this.add.text(W / 2, 346, msg, {
            fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace',
          }).setOrigin(0.5);
        }
      }

      let y = 374;
      playerParty.forEach(c => {
        this.add.text(W / 2, y, `${c.name}  Lv.${c.level}`, {
          fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        y += 22;
      });

      this.makeButton(W / 2, 530, '整備', 0x7c3aed, () => {
        if (updatedGameState) {
          this.scene.start('BaseScene', updatedGameState);
        } else {
          this.scene.start('PrepScene', { playerParty, stageIndex, expPool: newExpPool });
        }
      });
    } else {
      this.add.text(W / 2, 300, '隊伍全滅', {
        fontSize: '14px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);

      if (gameState?.stageProgress.inChapterRun) {
        const clearedState = {
          ...gameState,
          stageProgress: { ...gameState.stageProgress, inChapterRun: undefined },
        };
        saveSlot(clearedState);
      }

      this.makeButton(W / 2, 400, '重試', 0x374151, () => {
        if (gameState) {
          this.scene.start('BaseScene', gameState);
        } else {
          this.scene.start('BattleScene', { playerParty: [], stageIndex, expPool });
        }
      });
      this.makeButton(W / 2, 460, '世界地圖', 0x374151, () => {
        if (gameState) {
          this.scene.start('WorldMapScene', { gameState });
        } else {
          this.scene.start('BattleScene', { playerParty: [], stageIndex: 0, expPool: 0 });
        }
      });
    }
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const bg = this.add.rectangle(x, y, 180, 40, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '13px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    bg.on('pointerdown', cb);
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }
}
