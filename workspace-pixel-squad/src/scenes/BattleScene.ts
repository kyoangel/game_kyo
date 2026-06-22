import Phaser from 'phaser';
import type { Character, BattleSceneData } from '../types';
import { createCharacter, createEnemy } from '../battle/CharacterFactory';
import { computeTurnOrder } from '../battle/TurnEngine';
import { calcDamage } from '../battle/DamageCalc';
import { chooseTarget } from '../battle/AI';
import { STAGES } from '../data/stages';
import { PLAYER_TEMPLATES } from '../data/characters';

interface CharacterView {
  body: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  archetypeText: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private playerParty: Character[] = [];
  private enemyParty: Character[] = [];
  private turnOrder: Character[] = [];
  private turnIndex = 0;
  private stageIndex = 0;
  private views = new Map<string, CharacterView>();
  private actionMenu!: Phaser.GameObjects.Container;
  private turnQueueText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private waitingForInput = false;

  constructor() { super({ key: 'BattleScene' }); }

  init(data: BattleSceneData) {
    this.playerParty = data.playerParty?.length
      ? data.playerParty.map(c => ({ ...c, stats: { ...c.stats }, alive: true, defending: false }))
      : PLAYER_TEMPLATES.map(t => createCharacter(t, 1));
    this.stageIndex = data.stageIndex ?? 0;
    const stage = STAGES[this.stageIndex];
    this.enemyParty = stage.enemies.map(e => createEnemy(e));
    this.turnOrder = [];
    this.turnIndex = 0;
    this.views.clear();
    this.waitingForInput = false;
  }

  create() {
    const W = 360, H = 640;

    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);
    this.add.rectangle(90, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);
    this.add.rectangle(270, H / 2 - 80, 160, 440, 0x1f2937).setAlpha(0.6);

    this.add.line(W / 2, 240, 0, -220, 0, 220, 0x374151, 0.6).setLineWidth(1);

    this.add.text(W / 2, 16, STAGES[this.stageIndex].name, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 230, 'VS', {
      fontSize: '20px', color: '#4b5563', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.turnQueueText = this.add.text(W / 2, 488, '', {
      fontSize: '10px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    this.messageText = this.add.text(W / 2, 508, '', {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    this.actionMenu = this.add.container(W / 2, 590);

    this.add.line(W / 2, 482, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);
    this.add.line(W / 2, 560, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    this.renderParty(this.playerParty, 90, true);
    this.renderParty(this.enemyParty, 270, false);

    this.startNewRound();

    (window as unknown as Record<string, unknown>).__getBattleState = () => ({
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      stageIndex: this.stageIndex,
    });
  }

  private renderParty(party: Character[], x: number, isPlayer: boolean) {
    const topY = 40;
    const bottomY = 470;
    const n = Math.max(1, party.length);
    party.forEach((char, i) => {
      const cy = topY + ((bottomY - topY) * (i + 0.5)) / n;
      const color = isPlayer ? 0x3b82f6 : 0xef4444;
      const body = this.add.rectangle(x, cy, 44, 56, color).setAlpha(0.9);
      const hpBarBg = this.add.rectangle(x, cy + 34, 60, 6, 0x374151);
      const hpBar = this.add.rectangle(x - 30, cy + 34, 60, 6, 0x22c55e).setOrigin(0, 0.5);
      const nameText = this.add.text(x, cy - 36, char.name, {
        fontSize: '10px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const archetypeText = this.add.text(x, cy - 26, `[${char.archetype}]`, {
        fontSize: '8px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const hpText = this.add.text(x, cy + 44, `${char.stats.hp}/${char.stats.maxHp}`, {
        fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.views.set(char.id, { body, hpBarBg, hpBar, nameText, hpText, archetypeText });
    });
  }

  private updateHpBar(char: Character) {
    const view = this.views.get(char.id);
    if (!view) return;
    const pct = Math.max(0, char.stats.hp / char.stats.maxHp);
    view.hpBar.width = 60 * pct;
    view.hpBar.fillColor = pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xf59e0b : 0xef4444;
    view.hpText.setText(`${char.stats.hp}/${char.stats.maxHp}`);
    if (!char.alive) {
      view.body.setAlpha(0.2);
      view.nameText.setAlpha(0.3);
      view.archetypeText.setAlpha(0.3);
    }
  }

  private startNewRound() {
    this.playerParty.forEach(c => { c.defending = false; });
    this.enemyParty.forEach(c => { c.defending = false; });
    this.turnOrder = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.turnIndex = 0;
    this.processTurn();
  }

  private processTurn() {
    while (this.turnIndex < this.turnOrder.length && !this.turnOrder[this.turnIndex].alive) {
      this.turnIndex++;
    }
    if (this.turnIndex >= this.turnOrder.length) {
      this.startNewRound();
      return;
    }
    const current = this.turnOrder[this.turnIndex];
    this.updateTurnQueueDisplay();

    if (current.isPlayer) {
      this.showActionMenu(current);
    } else {
      this.time.delayedCall(700, () => this.executeEnemyTurn(current));
    }
  }

  private updateTurnQueueDisplay() {
    const upcoming = this.turnOrder
      .slice(this.turnIndex, this.turnIndex + 4)
      .filter(c => c.alive)
      .map(c => c.name)
      .join(' → ');
    this.turnQueueText.setText('Next: ' + upcoming);
  }

  private showActionMenu(character: Character) {
    this.actionMenu.removeAll(true);
    this.waitingForInput = true;

    type ActionEntry = { label: string; action: () => void };
    const entries: ActionEntry[] = [];

    if (character.isProtagonist) {
      entries.push({ label: '總攻擊', action: () => this.executeAutoAttack(character) });
    }
    entries.push(
      { label: '攻擊', action: () => this.executeNormalAttack(character) },
      { label: '技能', action: () => this.executeSkillAttack(character) },
      { label: '防禦', action: () => this.executeDefend(character) },
    );

    const btnW = 76;
    const totalW = entries.length * btnW + (entries.length - 1) * 4;
    const startX = -totalW / 2 + btnW / 2;

    entries.forEach(({ label, action }, i) => {
      const bx = startX + i * (btnW + 4);
      const bg = this.add.rectangle(bx, 0, btnW, 36, 0x374151)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx, 0, label, {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      bg.on('pointerdown', () => {
        if (!this.waitingForInput) return;
        this.waitingForInput = false;
        this.actionMenu.removeAll(true);
        action();
      });
      bg.on('pointerover', () => bg.setFillStyle(0x4b5563));
      bg.on('pointerout', () => bg.setFillStyle(0x374151));
      this.actionMenu.add([bg, txt]);
    });
  }

  private executeNormalAttack(attacker: Character) {
    const target = chooseTarget(this.enemyParty);
    if (!target) { this.endTurn(); return; }
    const dmg = calcDamage(attacker, target);
    this.applyDamageAndAdvance(attacker, target, dmg, undefined);
  }

  private executeSkillAttack(attacker: Character) {
    const target = chooseTarget(this.enemyParty);
    if (!target) { this.endTurn(); return; }
    const skill = attacker.skills.find(s => s.type === 'attack');
    const dmg = calcDamage(attacker, target, skill);
    this.applyDamageAndAdvance(attacker, target, dmg, skill?.name);
  }

  private executeAutoAttack(attacker: Character) {
    if (Math.random() < 0.5 && attacker.skills.some(s => s.type === 'attack')) {
      this.executeSkillAttack(attacker);
    } else {
      this.executeNormalAttack(attacker);
    }
  }

  private executeDefend(character: Character) {
    character.defending = true;
    this.showMessage(`${character.name} 防禦！傷害減半`);
    this.time.delayedCall(900, () => {
      this.clearMessage();
      this.endTurn();
    });
  }

  private executeEnemyTurn(enemy: Character) {
    const target = chooseTarget(this.playerParty);
    if (!target) { this.endTurn(); return; }
    const dmg = calcDamage(enemy, target);
    this.applyDamageAndAdvance(enemy, target, dmg, undefined);
  }

  private applyDamageAndAdvance(
    attacker: Character,
    target: Character,
    dmg: number,
    skillName: string | undefined,
  ) {
    target.stats.hp = Math.max(0, target.stats.hp - dmg);
    if (target.stats.hp === 0) target.alive = false;
    this.updateHpBar(target);

    const skillLabel = skillName ? `【${skillName}】` : '';
    this.showMessage(`${attacker.name}${skillLabel} → ${target.name} -${dmg} HP`);

    this.time.delayedCall(900, () => {
      this.clearMessage();
      if (this.checkBattleEnd()) return;
      this.endTurn();
    });
  }

  private checkBattleEnd(): boolean {
    const playerAlive = this.playerParty.some(c => c.alive);
    const enemyAlive = this.enemyParty.some(c => c.alive);
    if (!playerAlive || !enemyAlive) {
      const victory = enemyAlive === false;
      const expGained = victory ? STAGES[this.stageIndex].expReward : 0;
      this.time.delayedCall(400, () => {
        this.scene.start('ResultScene', {
          victory,
          playerParty: this.playerParty,
          stageIndex: this.stageIndex,
          expGained,
        });
      });
      return true;
    }
    return false;
  }

  private endTurn() {
    this.turnIndex++;
    this.time.delayedCall(150, () => this.processTurn());
  }

  private showMessage(text: string) {
    this.messageText.setText(text);
  }

  private clearMessage() {
    this.messageText.setText('');
  }
}
