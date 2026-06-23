import Phaser from 'phaser';
import type { Character, BattleSceneData, BattlePhase, PendingCommand } from '../types';
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
  private stageIndex = 0;
  private expPool = 0;
  private views = new Map<string, CharacterView>();
  private actionMenu!: Phaser.GameObjects.Container;
  private messageText!: Phaser.GameObjects.Text;
  private phase: BattlePhase = 'command';

  // Command phase state
  private pendingCommands = new Map<string, PendingCommand>();
  private commandIndex = 0;
  private commandIcons = new Map<string, Phaser.GameObjects.Text>();
  private waitingForInput = false;

  // Auto mode state
  private stopRequested = false;
  private stopButton?: Phaser.GameObjects.Container;

  // Target selection state
  private targetHighlights = new Map<string, Phaser.GameObjects.Rectangle>();
  private targetSelectActive = false;
  private targetSelectChars: Character[] = [];
  private targetSelectIndex = 0;
  private targetSelectCallback?: (target: Character) => void;

  // Keyboard state
  private keyboardActionIndex = 0;
  private keyboardActions: Array<{ label: string; action: () => void }> = [];

  constructor() { super({ key: 'BattleScene' }); }

  init(data: BattleSceneData) {
    this.playerParty = data.playerParty?.length
      ? data.playerParty.map(c => ({ ...c, stats: { ...c.stats, hp: c.stats.maxHp }, alive: true, defending: false }))
      : PLAYER_TEMPLATES.map(t => createCharacter(t, 1));
    this.stageIndex = data.stageIndex ?? 0;
    this.expPool = data.expPool ?? 0;
    const stage = STAGES[this.stageIndex];
    this.enemyParty = stage.enemies.map(e => createEnemy(e));
    this.views.clear();
    this.pendingCommands.clear();
    this.commandIcons.clear();
    this.targetHighlights.clear();
    this.phase = 'command';
    this.commandIndex = 0;
    this.stopRequested = false;
    this.targetSelectActive = false;
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

    this.messageText = this.add.text(W / 2, 508, '', {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    this.actionMenu = this.add.container(W / 2, 590);

    this.add.line(W / 2, 482, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);
    this.add.line(W / 2, 560, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);

    this.renderParty(this.playerParty, 90, true);
    this.renderParty(this.enemyParty, 270, false);

    this.setupKeyboard();
    this.startCommandPhase();

    (window as unknown as Record<string, unknown>).__getBattleState = () => ({
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      stageIndex: this.stageIndex,
    });
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  private renderParty(party: Character[], x: number, isPlayer: boolean) {
    const topY = 40, bottomY = 470;
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

      if (isPlayer) {
        const icon = this.add.text(x + 28, cy - 36, '', {
          fontSize: '11px', fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.commandIcons.set(char.id, icon);

        body.setInteractive({ useHandCursor: true });
        body.on('pointerdown', () => this.onPlayerBodyTap(char, i));
      }
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

  private setCommandIcon(char: Character, action: PendingCommand['action']) {
    const icon = this.commandIcons.get(char.id);
    if (!icon) return;
    icon.setText(action === 'attack' ? '⚔' : action === 'skill' ? '技' : '🛡');
  }

  private clearCommandIcons() {
    this.commandIcons.forEach(icon => icon.setText(''));
  }

  // ─── Command Phase ────────────────────────────────────────────────────────

  private startCommandPhase() {
    this.phase = 'command';
    this.pendingCommands.clear();
    this.commandIndex = 0;
    this.playerParty.forEach(c => { c.defending = false; });
    this.enemyParty.forEach(c => { c.defending = false; });
    this.clearCommandIcons();
    this.advanceCommandInput();
  }

  private advanceCommandInput() {
    while (
      this.commandIndex < this.playerParty.length &&
      !this.playerParty[this.commandIndex].alive
    ) {
      this.commandIndex++;
    }
    if (this.commandIndex >= this.playerParty.length) {
      this.startExecution();
      return;
    }
    this.showCommandMenu(this.playerParty[this.commandIndex]);
  }

  private showCommandMenu(character: Character) {
    this.actionMenu.removeAll(true);
    this.waitingForInput = true;

    const isFirstAlive = character === this.playerParty.find(c => c.alive);

    const entries: Array<{ label: string; action: () => void }> = [];

    if (isFirstAlive) {
      entries.push({ label: '自動', action: () => this.enterAutoMode() });
    }
    entries.push(
      {
        label: '攻擊', action: () => {
          this.waitingForInput = false;
          this.actionMenu.removeAll(true);
          this.enterTargetSelection(character, 'attack', this.enemyParty.filter(e => e.alive), (target) => {
            this.confirmCommand({ character, action: 'attack', target });
          });
        }
      },
      {
        label: '技能', action: () => {
          this.waitingForInput = false;
          this.actionMenu.removeAll(true);
          this.enterTargetSelection(character, 'skill', this.enemyParty.filter(e => e.alive), (target) => {
            this.confirmCommand({ character, action: 'skill', target });
          });
        }
      },
      {
        label: '防禦', action: () => {
          this.waitingForInput = false;
          this.confirmCommand({ character, action: 'defend' });
        }
      },
    );

    this.keyboardActions = entries;
    this.keyboardActionIndex = isFirstAlive ? 1 : 0;

    const btnW = 76;
    const totalW = entries.length * btnW + (entries.length - 1) * 4;
    const startX = -totalW / 2 + btnW / 2;

    entries.forEach(({ label, action }, i) => {
      const bx = startX + i * (btnW + 4);
      const focused = i === this.keyboardActionIndex;
      const bg = this.add.rectangle(bx, 0, btnW, 36, focused ? 0x4b5563 : 0x374151)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx, 0, label, {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      bg.on('pointerdown', () => {
        if (this.phase !== 'command' || !this.waitingForInput) return;
        action();
      });
      bg.on('pointerover', () => bg.setFillStyle(0x4b5563));
      bg.on('pointerout', () => bg.setFillStyle(focused ? 0x4b5563 : 0x374151));
      this.actionMenu.add([bg, txt]);
    });
  }

  private confirmCommand(cmd: PendingCommand) {
    this.waitingForInput = false;
    this.pendingCommands.set(cmd.character.id, cmd);
    this.setCommandIcon(cmd.character, cmd.action);
    this.commandIndex++;
    this.advanceCommandInput();
  }

  private onPlayerBodyTap(char: Character, partyIndex: number) {
    if (this.phase !== 'command') return;
    if (!this.pendingCommands.has(char.id)) return;
    if (this.targetSelectActive) return;

    this.pendingCommands.delete(char.id);
    const icon = this.commandIcons.get(char.id);
    if (icon) icon.setText('');
    this.commandIndex = partyIndex;
    this.actionMenu.removeAll(true);
    this.waitingForInput = false;
    this.advanceCommandInput();
  }

  // ─── Target Selection ─────────────────────────────────────────────────────

  private enterTargetSelection(
    _character: Character,
    _action: 'attack' | 'skill',
    targets: Character[],
    onConfirm: (target: Character) => void,
  ) {
    if (targets.length === 0) return;
    this.targetSelectActive = true;
    this.targetSelectChars = targets;
    this.targetSelectIndex = 0;
    this.targetSelectCallback = onConfirm;

    targets.forEach((t, i) => {
      const view = this.views.get(t.id);
      if (!view) return;
      const cx = view.body.x;
      const cy = view.body.y;
      const highlight = this.add.rectangle(cx, cy, 52, 64, 0xf97316, 0)
        .setStrokeStyle(2, 0xf97316)
        .setAlpha(i === 0 ? 1 : 0.4);
      this.targetHighlights.set(t.id, highlight);

      view.body.setInteractive({ useHandCursor: true });
      view.body.on('pointerdown', () => {
        if (!this.targetSelectActive) return;
        this.confirmTargetSelection(t);
      });
    });
  }

  private confirmTargetSelection(target: Character) {
    this.clearTargetHighlights();
    this.targetSelectActive = false;
    const cb = this.targetSelectCallback;
    this.targetSelectCallback = undefined;
    if (cb) cb(target);
  }

  private cancelTargetSelection() {
    this.clearTargetHighlights();
    this.targetSelectActive = false;
    this.targetSelectCallback = undefined;
    this.showCommandMenu(this.playerParty[this.commandIndex]);
  }

  private clearTargetHighlights() {
    this.targetHighlights.forEach(h => h.destroy());
    this.targetHighlights.clear();
    this.enemyParty.forEach(e => {
      const view = this.views.get(e.id);
      if (view) view.body.removeAllListeners('pointerdown');
    });
  }

  // ─── Execution Phase ──────────────────────────────────────────────────────

  private startExecution() {
    this.phase = 'executing';
    this.actionMenu.removeAll(true);
    const order = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.executeNextInOrder(order, 0);
  }

  private executeNextInOrder(order: Character[], idx: number) {
    while (idx < order.length && !order[idx].alive) idx++;

    if (idx >= order.length) {
      this.time.delayedCall(400, () => {
        if (this.phase === 'auto') {
          if (this.stopRequested) {
            this.stopRequested = false;
            this.hideStopButton();
            this.startCommandPhase();
          } else {
            this.runAutoRound();
          }
        } else {
          this.startCommandPhase();
        }
      });
      return;
    }

    const current = order[idx];

    if (current.isPlayer) {
      const cmd = this.pendingCommands.get(current.id);
      if (!cmd) {
        this.executeNextInOrder(order, idx + 1);
        return;
      }
      this.executePlayerCommand(cmd, () => {
        if (this.checkBattleEnd()) return;
        this.executeNextInOrder(order, idx + 1);
      });
    } else {
      this.executeEnemyAction(current, () => {
        if (this.checkBattleEnd()) return;
        this.executeNextInOrder(order, idx + 1);
      });
    }
  }

  private executePlayerCommand(cmd: PendingCommand, next: () => void) {
    if (cmd.action === 'defend') {
      cmd.character.defending = true;
      this.showMessage(`${cmd.character.name} 防禦！傷害減半`);
      this.time.delayedCall(900, () => { this.clearMessage(); next(); });
      return;
    }

    let target = cmd.target;
    if (!target || !target.alive) {
      const aliveEnemies = this.enemyParty.filter(e => e.alive);
      if (aliveEnemies.length === 0) { next(); return; }
      target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    }

    const skill = cmd.action === 'skill'
      ? cmd.character.skills.find(s => s.type === 'attack')
      : undefined;
    const dmg = calcDamage(cmd.character, target, skill);
    this.applyDamageAndAdvance(cmd.character, target, dmg, skill?.name, next);
  }

  private executeEnemyAction(enemy: Character, next: () => void) {
    const target = chooseTarget(this.playerParty);
    if (!target) { next(); return; }
    const dmg = calcDamage(enemy, target);
    this.applyDamageAndAdvance(enemy, target, dmg, undefined, next);
  }

  private applyDamageAndAdvance(
    attacker: Character,
    target: Character,
    dmg: number,
    skillName: string | undefined,
    next: () => void,
  ) {
    target.stats.hp = Math.max(0, target.stats.hp - dmg);
    if (target.stats.hp === 0) target.alive = false;
    this.updateHpBar(target);

    const label = skillName ? `【${skillName}】` : '';
    this.showMessage(`${attacker.name}${label} → ${target.name} -${dmg} HP`);

    this.time.delayedCall(900, () => {
      this.clearMessage();
      next();
    });
  }

  private checkBattleEnd(): boolean {
    const playerAlive = this.playerParty.some(c => c.alive);
    const enemyAlive = this.enemyParty.some(c => c.alive);
    if (!playerAlive || !enemyAlive) {
      const victory = !enemyAlive;
      const expGained = victory ? STAGES[this.stageIndex].expReward : 0;
      this.time.delayedCall(400, () => {
        this.scene.start('ResultScene', {
          victory,
          playerParty: this.playerParty,
          stageIndex: this.stageIndex,
          expGained,
          expPool: this.expPool,
        });
      });
      return true;
    }
    return false;
  }

  // ─── Auto-battle Mode ─────────────────────────────────────────────────────

  private enterAutoMode() {
    this.waitingForInput = false;
    this.phase = 'auto';
    this.actionMenu.removeAll(true);
    this.showStopButton();
    this.runAutoRound();
  }

  private runAutoRound() {
    this.pendingCommands.clear();
    this.clearCommandIcons();

    this.playerParty.filter(c => c.alive).forEach(c => {
      const aliveEnemies = this.enemyParty.filter(e => e.alive);
      if (aliveEnemies.length === 0) return;
      const useSkill = Math.random() < 0.5 && c.skills.some(s => s.type === 'attack');
      const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      this.pendingCommands.set(c.id, {
        character: c,
        action: useSkill ? 'skill' : 'attack',
        target,
      });
    });

    const order = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.executeNextInOrder(order, 0);
  }

  private showStopButton() {
    this.stopButton = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, 120, 36, 0x7f1d1d)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, '■ 停止', {
      fontSize: '14px', color: '#fca5a5', fontFamily: 'monospace',
    }).setOrigin(0.5);
    bg.on('pointerdown', () => { this.stopRequested = true; });
    bg.on('pointerover', () => bg.setFillStyle(0x991b1b));
    bg.on('pointerout', () => bg.setFillStyle(0x7f1d1d));
    this.stopButton.add([bg, txt]);
    this.actionMenu.add(this.stopButton);
  }

  private hideStopButton() {
    if (this.stopButton) {
      this.stopButton.destroy();
      this.stopButton = undefined;
    }
  }

  // ─── Keyboard Input ───────────────────────────────────────────────────────

  private setupKeyboard() {
    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.onKeyLeft());
    kb.on('keydown-RIGHT', () => this.onKeyRight());
    kb.on('keydown-UP', () => this.onKeyUp());
    kb.on('keydown-DOWN', () => this.onKeyDown());
    kb.on('keydown-ENTER', () => this.onKeyEnter());
    kb.on('keydown-ESC', () => this.onKeyEsc());
  }

  private onKeyLeft() {
    if (!this.waitingForInput || this.targetSelectActive) return;
    if (this.keyboardActions.length === 0) return;
    this.updateKeyboardFocus(-1);
  }

  private onKeyRight() {
    if (!this.waitingForInput || this.targetSelectActive) return;
    if (this.keyboardActions.length === 0) return;
    this.updateKeyboardFocus(1);
  }

  private updateKeyboardFocus(delta: number) {
    const btns = this.actionMenu.getAll().filter(
      c => c instanceof Phaser.GameObjects.Rectangle
    ) as Phaser.GameObjects.Rectangle[];
    if (btns.length === 0) return;
    btns[this.keyboardActionIndex]?.setFillStyle(0x374151);
    this.keyboardActionIndex = (this.keyboardActionIndex + delta + btns.length) % btns.length;
    btns[this.keyboardActionIndex]?.setFillStyle(0x4b5563);
  }

  private onKeyUp() {
    if (!this.targetSelectActive) return;
    this.moveTargetFocus(-1);
  }

  private onKeyDown() {
    if (!this.targetSelectActive) return;
    this.moveTargetFocus(1);
  }

  private moveTargetFocus(delta: number) {
    const prev = this.targetSelectChars[this.targetSelectIndex];
    if (prev) this.targetHighlights.get(prev.id)?.setAlpha(0.4);
    this.targetSelectIndex = (this.targetSelectIndex + delta + this.targetSelectChars.length) % this.targetSelectChars.length;
    const next = this.targetSelectChars[this.targetSelectIndex];
    if (next) this.targetHighlights.get(next.id)?.setAlpha(1);
  }

  private onKeyEnter() {
    if (this.targetSelectActive) {
      const target = this.targetSelectChars[this.targetSelectIndex];
      if (target) this.confirmTargetSelection(target);
      return;
    }
    if (!this.waitingForInput) return;
    const action = this.keyboardActions[this.keyboardActionIndex];
    if (action) action.action();
  }

  private onKeyEsc() {
    if (this.targetSelectActive) {
      this.cancelTargetSelection();
      return;
    }
    if (!this.waitingForInput || this.commandIndex <= 0) return;
    let prev = this.commandIndex - 1;
    while (prev > 0 && !this.playerParty[prev]?.alive) prev--;
    const prevChar = this.playerParty[prev];
    if (!prevChar?.alive) return;
    this.pendingCommands.delete(prevChar.id);
    const icon = this.commandIcons.get(prevChar.id);
    if (icon) icon.setText('');
    this.commandIndex = prev;
    this.waitingForInput = false;
    this.actionMenu.removeAll(true);
    this.advanceCommandInput();
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private showMessage(text: string) { this.messageText.setText(text); }
  private clearMessage() { this.messageText.setText(''); }
}
