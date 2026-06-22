import Phaser from 'phaser';
import type { Character, AllocateSceneData } from '../types';
import { allocateStat } from '../battle/ExpSystem';
import { STAGES } from '../data/stages';

export class AllocateScene extends Phaser.Scene {
  private party: Character[] = [];
  private stageIndex = 0;
  private protagonist!: Character;
  private pointsText!: Phaser.GameObjects.Text;
  private statTexts: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor() { super({ key: 'AllocateScene' }); }

  create(data: AllocateSceneData) {
    this.party = data.playerParty.map(c => ({ ...c, stats: { ...c.stats } }));
    this.stageIndex = data.stageIndex;
    this.protagonist = this.party.find(c => c.isProtagonist)!;
    this.statTexts.clear();

    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    this.add.text(W / 2, 40, '分配能力點', {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 70, this.protagonist.name, {
      fontSize: '14px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.pointsText = this.add.text(W / 2, 100, `剩餘點數: ${this.protagonist.statPoints}`, {
      fontSize: '16px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const stats: Array<{ key: 'hp' | 'atk' | 'def' | 'spd'; label: string; inc: string }> = [
      { key: 'hp', label: 'HP', inc: '+10' },
      { key: 'atk', label: 'ATK', inc: '+2' },
      { key: 'def', label: 'DEF', inc: '+2' },
      { key: 'spd', label: 'SPD', inc: '+2' },
    ];

    stats.forEach(({ key, label, inc }, i) => {
      const y = 180 + i * 80;
      this.add.text(60, y, label, {
        fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0, 0.5);

      const valText = this.add.text(160, y, String(this.protagonist.stats[key]), {
        fontSize: '14px', color: '#a78bfa', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.statTexts.set(key, valText);

      const btn = this.add.rectangle(260, y, 70, 32, 0x374151)
        .setInteractive({ useHandCursor: true });
      this.add.text(260, y, inc, {
        fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      btn.on('pointerdown', () => this.spend(key));
      btn.on('pointerover', () => btn.setFillStyle(0x4b5563));
      btn.on('pointerout', () => btn.setFillStyle(0x374151));
    });

    this.makeButton(W / 2, 560, '確認', 0x16a34a, () => {
      const isLastStage = this.stageIndex >= STAGES.length - 1;
      if (!isLastStage) {
        this.scene.start('BattleScene', {
          playerParty: this.party,
          stageIndex: this.stageIndex + 1,
        });
      } else {
        // Route back to ResultScene so the "全部關卡通關！" screen is shown
        this.scene.start('ResultScene', {
          victory: true,
          playerParty: this.party,
          stageIndex: this.stageIndex,
          expGained: 0,
        });
      }
    });
  }

  private spend(stat: 'hp' | 'atk' | 'def' | 'spd') {
    if (this.protagonist.statPoints <= 0) return;
    const updated = allocateStat(this.protagonist, stat);
    const idx = this.party.indexOf(this.protagonist);
    this.party[idx] = updated;
    this.protagonist = updated;
    this.pointsText.setText(`剩餘點數: ${this.protagonist.statPoints}`);
    this.statTexts.get(stat)?.setText(String(this.protagonist.stats[stat]));
  }

  private makeButton(x: number, y: number, label: string, color: number, cb: () => void) {
    const bg = this.add.rectangle(x, y, 160, 40, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '14px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    bg.on('pointerdown', cb);
    bg.on('pointerover', () => bg.setAlpha(0.8));
    bg.on('pointerout', () => bg.setAlpha(1));
  }
}
