import Phaser from 'phaser';
import type { Character, BattleSceneData, BattlePhase, PendingCommand, GameState, Skill, Element, BattlePerformanceStats } from '../types';
import { createCharacter, createEnemy } from '../battle/CharacterFactory';
import { computeTurnOrder, applyWeaknessBonus, resetRoundFlags } from '../battle/TurnEngine';
import {
  canKnockDown,
  shouldTriggerAoa,
  applyAllOutAttack,
  resetAoaRoundState,
  type AoaRoundState,
} from '../battle/AllOutAttack';
import { calcDamage, calcHeal } from '../battle/DamageCalc';
import { pickSupporter, getBond, rollSupportAttack, calcSupportDamage, resetSupportRoundFlags } from '../battle/BondSystem';
import { chooseTarget } from '../battle/AI';
import { applyBuff, tickBuffs, applyStatusEffect, tickStatusEffects, type StatusTickEvent } from '../battle/Buffs';
import { getStatusIconData } from '../ui/battleStatusIcons';
import { ELEMENT_LABELS, ELEMENT_ICONS } from '../ui/elementLabels';
import type { StatusEffectType } from '../types';
import { decideAction, decideActionWithAwareness } from '../battle/SkillAI';
import { getBossPhase, executeBossAction, type BossConfig, type BossPhase } from '../battle/BossAI';
import { revealBossWeakness } from '../battle/BossWeaknessReveal';
import { seedDiscoveredThisBattle, recordHitDiscovery, isWeaknessIconVisible } from '../battle/WeaknessDiscovery';
import { BOSS_CONFIGS } from '../data/bossConfigs';
import { STAGES } from '../data/stages';
import { PLAYER_TEMPLATES } from '../data/characters';
import { canAttemptRecruit, recruitChance, attemptRecruit, isNamedCharacter } from '../battle/RecruitSystem';
import { rollCrit } from '../battle/ArchetypeEffects';
import { shouldUseProtagonistSprite, shouldUsePartySprite, shouldUseMonsterSprite } from '../battle/SpriteSelection';
import { SPRITE_KEYS, SPRITE_SHEET_ASSETS, PROTAGONIST_ANIM_KEYS, PARTY_MEMBER_IDS, partySpritKey, partySpritePath, monsterIdleKey, monsterIdlePath, MONSTER_FRAMES } from '../data/sprites';
import type { MonsterType } from '../data/sprites';
import { CharacterAnimator } from '../battle/CharacterAnimator';
import { deriveFacing, DIE_CONFIG } from '../battle/AnimationState';
import { getSfx } from '../audio/SfxManager';
import { getMusic } from '../audio/MusicManager';
import { SFX_KEYS, MUSIC_KEYS } from '../data/audio';

const STAT_LABEL: Record<string, string> = { atk: 'ATK', def: 'DEF', spd: 'SPD' };

const ARCHETYPE_TOOLTIP: Record<string, string> = {
  '坦克': '減傷15%',
  '輸出': '傷害+10%',
  '狙擊': '暴擊20%',
  '輔助': '治療/增益+20%',
  '全能': '全屬性+5%',
};

interface CharacterView {
  body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  animator: CharacterAnimator;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  archetypeText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  weaknessIcon: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private playerParty: Character[] = [];
  private enemyParty: Character[] = [];
  private stageIndex = 0;
  private expPool = 0;
  private gameState?: GameState;
  private discoveredThisBattle: Set<string> = new Set();
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

  // Recruit state
  private recruitedEnemy?: Character;

  // Boss AI state
  private bossConfig?: BossConfig;
  private triggeredPhaseThresholds = new Set<number>();

  // All-Out Attack state
  private aoaState: AoaRoundState = { usedThisRound: false };

  // Performance rating state
  private battleStats: BattlePerformanceStats = { playerKOCount: 0, weaknessHitCount: 0, roundsUsed: 0 };

  // Target selection state
  private targetHighlights = new Map<string, Phaser.GameObjects.Rectangle>();
  private targetSelectActive = false;
  private targetSelectChars: Character[] = [];
  private targetSelectIndex = 0;
  private targetSelectCallback?: (target: Character) => void;

  // Skill picker state
  private skillPickerActive = false;

  // Keyboard state
  private keyboardActionIndex = 0;
  private keyboardActions: Array<{ label: string; action: () => void }> = [];

  constructor() { super({ key: 'BattleScene' }); }

  preload() {
    const asset = SPRITE_SHEET_ASSETS[SPRITE_KEYS.protagonistSheet];
    this.load.spritesheet(SPRITE_KEYS.protagonistSheet, asset.path, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
    });
    // Party member sprites
    for (const id of PARTY_MEMBER_IDS) {
      this.load.image(partySpritKey(id), partySpritePath(id));
    }
    // Monster idle frames (one per type)
    const monsterTypes = Object.keys(MONSTER_FRAMES) as MonsterType[];
    for (const type of monsterTypes) {
      this.load.image(monsterIdleKey(type), monsterIdlePath(type));
    }
  }

  init(data: BattleSceneData) {
    this.playerParty = data.playerParty?.length
      ? data.playerParty.map(c => ({ ...c, stats: { ...c.stats, hp: c.stats.maxHp }, alive: true, defending: false, activeStatusEffects: [] }))
      : PLAYER_TEMPLATES.map(t => createCharacter(t, 1));
    this.stageIndex = data.stageIndex ?? 0;
    this.expPool = data.expPool ?? 0;
    this.gameState = data.gameState;
    this.discoveredThisBattle = seedDiscoveredThisBattle(this.gameState?.discoveredWeaknesses);
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
    this.recruitedEnemy = undefined;
    this.bossConfig = undefined;
    this.triggeredPhaseThresholds = new Set<number>();
    this.aoaState = { usedThisRound: false };
    this.battleStats = { playerKOCount: 0, weaknessHitCount: 0, roundsUsed: 0 };
    if (stage.isBoss && this.enemyParty.length === 1) {
      const bossTemplateId = this.enemyParty[0].templateId;
      this.bossConfig = BOSS_CONFIGS[bossTemplateId];
    }
  }

  create() {
    getMusic(this).playTrack(MUSIC_KEYS.battle);

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

    const sheetKey = SPRITE_KEYS.protagonistSheet;
    const animDefs = [
      { key: PROTAGONIST_ANIM_KEYS.walkRight,   start: 30, end: 38, frameRate: 12, repeat: -1 },
      { key: PROTAGONIST_ANIM_KEYS.walkLeft,    start: 10, end: 18, frameRate: 12, repeat: -1 },
      { key: PROTAGONIST_ANIM_KEYS.attackRight, start: 70, end: 75, frameRate: 17, repeat: 0  },
      { key: PROTAGONIST_ANIM_KEYS.attackLeft,  start: 50, end: 55, frameRate: 17, repeat: 0  },
      { key: PROTAGONIST_ANIM_KEYS.death,       start: 80, end: 85, frameRate: 13, repeat: 0  },
      { key: PROTAGONIST_ANIM_KEYS.idle,        start: 90, end: 90, frameRate: 1,  repeat: -1 },
    ];
    animDefs.forEach(def => {
      if (!this.anims.exists(def.key)) {
        this.anims.create({
          key: def.key,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: def.start, end: def.end }),
          frameRate: def.frameRate,
          repeat: def.repeat,
        });
      }
    });

    this.renderParty(this.playerParty, 90, true);
    this.renderParty(this.enemyParty, 270, false);

    this.setupKeyboard();

    const stage = STAGES[this.stageIndex];
    const isFirstVisit = !this.gameState?.stageProgress.completedStageIds.includes(stage.id);
    if (isFirstVisit && stage.preDialog) {
      this.showPreBattleDialog(stage.preDialog, () => this.startCommandPhase());
    } else {
      this.startCommandPhase();
    }

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
      // Single column — position index i is the formation slot (0=front, 4=back)
      const cy = topY + ((bottomY - topY) * (i + 0.5)) / n;
      const cx = x;

      const textureLoaded = this.textures.exists(SPRITE_KEYS.protagonistSheet);
      const color = isPlayer ? 0x3b82f6 : 0xef4444;
      let body: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
      if (shouldUseProtagonistSprite(char, textureLoaded)) {
        body = this.add.sprite(cx, cy, SPRITE_KEYS.protagonistSheet, 90).setDisplaySize(44, 56);
      } else if (shouldUsePartySprite(char, this)) {
        body = this.add.image(cx, cy, partySpritKey(char.templateId)).setDisplaySize(44, 56);
      } else if (shouldUseMonsterSprite(char, this)) {
        body = this.add.image(cx, cy, monsterIdleKey(char._monsterType as MonsterType)).setDisplaySize(44, 56);
      } else {
        body = this.add.rectangle(cx, cy, 44, 56, color).setAlpha(0.9);
      }
      const useSprite = shouldUseProtagonistSprite(char, textureLoaded);
      const hpBarBg = this.add.rectangle(cx, cy + 34, 60, 6, 0x374151);
      const hpBar = this.add.rectangle(cx - 30, cy + 34, 60, 6, 0x22c55e).setOrigin(0, 0.5);
      const nameText = this.add.text(cx, cy - 36, char.name, {
        fontSize: '10px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const archetypeText = this.add.text(cx, cy - 26, `[${char.archetype}] ${ARCHETYPE_TOOLTIP[char.archetype]}`, {
        fontSize: '8px', color: '#6b7280', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const hpText = this.add.text(cx, cy + 44, `${char.stats.hp}/${char.stats.maxHp}`, {
        fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const statusText = this.add.text(cx, cy + 54, '', {
        fontSize: '9px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const weaknessIcon = this.add.text(cx + 22, cy - 26, '', {
        fontSize: '10px', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const animator = new CharacterAnimator(this, body, useSprite);
      animator.playIdleLoop();
      this.views.set(char.id, { body, animator, hpBarBg, hpBar, nameText, hpText, archetypeText, statusText, weaknessIcon });
      this.updateStatusIcons(char);
      this.updateWeaknessIcon(char);

      if (isPlayer) {
        const icon = this.add.text(cx + 28, cy - 36, '', {
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
  }

  private updateStatusIcons(char: Character) {
    const view = this.views.get(char.id);
    if (!view) return;
    const icons = getStatusIconData(char);
    view.statusText.setText(icons.map(i => i.icon).join(' '));
  }

  private updateWeaknessIcon(char: Character) {
    const view = this.views.get(char.id);
    if (!view) return;
    view.weaknessIcon.setText(isWeaknessIconVisible(char, this.discoveredThisBattle) ? ELEMENT_ICONS[char.weakness!] : '');
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
    this.battleStats.roundsUsed++;
    resetRoundFlags([...this.playerParty, ...this.enemyParty]);
    resetSupportRoundFlags(this.playerParty);
    resetAoaRoundState(this.aoaState);
    this.phase = 'command';
    this.pendingCommands.clear();
    this.commandIndex = 0;
    this.playerParty.forEach(c => { c.defending = false; });
    this.enemyParty.forEach(c => { c.defending = false; });
    tickBuffs(this.playerParty);
    tickBuffs(this.enemyParty);
    this.clearCommandIcons();
    this.runStartOfRoundTicks(() => this.advanceCommandInput());
  }

  private runStartOfRoundTicks(onDone: () => void) {
    const events = [
      ...tickStatusEffects(this.playerParty),
      ...tickStatusEffects(this.enemyParty),
    ];
    [...this.playerParty, ...this.enemyParty].forEach(c => this.updateStatusIcons(c));

    if (events.length === 0) {
      onDone();
      return;
    }

    const showNext = (i: number) => {
      if (i >= events.length) {
        this.clearMessage();
        if (this.checkBattleEnd()) return;
        onDone();
        return;
      }
      const event: StatusTickEvent = events[i];
      this.updateHpBar(event.character);
      const label = event.type === 'poison' ? `${event.character.name} 中毒 -${event.damage} HP` : `${event.character.name} ${event.type}`;
      this.showMessage(label);
      this.time.delayedCall(600, () => showNext(i + 1));
    };
    showNext(0);
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
          this.enterTargetSelection(character, this.enemyParty.filter(e => e.alive), (target) => {
            this.confirmCommand({ character, action: 'attack', target });
          });
        }
      },
    );
    if (character.skills.length > 0) {
      entries.push({
        label: '技能', action: () => {
          this.waitingForInput = false;
          this.actionMenu.removeAll(true);
          if (character.skills.length === 1) {
            this.beginSkillTargeting(character, character.skills[0]);
          } else {
            this.showSkillPicker(character);
          }
        }
      });
    }
    entries.push(
      {
        label: '防禦', action: () => {
          this.waitingForInput = false;
          this.confirmCommand({ character, action: 'defend' });
        }
      },
    );

    // 勸降 — only when 1 enemy alive, below 50% HP, and NOT a story-join character
    const aliveEnemies = this.enemyParty.filter(e => e.alive);
    const stageUnlockId = STAGES[this.stageIndex].unlockCharacterId;
    if (
      aliveEnemies.length === 1 &&
      canAttemptRecruit(aliveEnemies[0]) &&
      aliveEnemies[0].templateId !== stageUnlockId
    ) {
      const recruitTarget = aliveEnemies[0];
      entries.push({
        label: '勸降',
        action: () => this.attemptRecruitAction(character, recruitTarget),
      });
    }

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
        getSfx(this).play(SFX_KEYS.buttonClick);
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

  private showSkillPicker(character: Character) {
    this.actionMenu.removeAll(true);
    this.waitingForInput = true;
    this.skillPickerActive = true;

    const entries = character.skills.map(skill => ({
      label: skill.name,
      action: () => {
        this.waitingForInput = false;
        this.skillPickerActive = false;
        this.actionMenu.removeAll(true);
        this.beginSkillTargeting(character, skill);
      },
    }));

    this.keyboardActions = entries;
    this.keyboardActionIndex = 0;

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
        getSfx(this).play(SFX_KEYS.buttonClick);
        action();
      });
      bg.on('pointerover', () => bg.setFillStyle(0x4b5563));
      bg.on('pointerout', () => bg.setFillStyle(focused ? 0x4b5563 : 0x374151));
      this.actionMenu.add([bg, txt]);
    });
  }

  private beginSkillTargeting(character: Character, skill: Skill) {
    if (skill.target === 'self') {
      this.confirmCommand({ character, action: 'skill', skill, target: character });
      return;
    }
    const targets = skill.target === 'ally'
      ? (character.isPlayer ? this.playerParty : this.enemyParty).filter(c => c.alive)
      : this.enemyParty.filter(e => e.alive);
    this.enterTargetSelection(character, targets, (target) => {
      this.confirmCommand({ character, action: 'skill', skill, target });
    });
  }

  private enterTargetSelection(
    _character: Character,
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
        getSfx(this).play(SFX_KEYS.buttonClick);
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
    const queue = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.executeNextInQueue(queue);
  }

  private executeNextInQueue(queue: Character[]) {
    // Drain dead entries from the front
    while (queue.length > 0 && !queue[0].alive) queue.shift();

    if (queue.length === 0) {
      this.time.delayedCall(400, () => {
        if (this.phase === 'auto') {
          if (this.stopRequested) {
            this.stopRequested = false;
            this.hideStopButton();
            this.startCommandPhase();
          } else {
            this.battleStats.roundsUsed++;
            this.runAutoRound();
          }
        } else {
          this.startCommandPhase();
        }
      });
      return;
    }

    const current = queue.shift()!;

    const frozen = current.activeStatusEffects?.some(s => s.type === 'freeze');
    if (frozen) {
      this.showMessage(`${current.name} 被凍結，跳過回合！`);
      this.time.delayedCall(600, () => {
        this.clearMessage();
        this.executeNextInQueue(queue);
      });
      return;
    }

    const afterAction = () => {
      if (this.checkBattleEnd()) return;
      if (shouldTriggerAoa(this.enemyParty, this.aoaState)) {
        this.showAoaPrompt(() => this.executeNextInQueue(queue));
        return;
      }
      this.executeNextInQueue(queue);
    };

    if (current.isPlayer) {
      const cmd = this.pendingCommands.get(current.id);
      if (!cmd) {
        this.executeNextInQueue(queue);
        return;
      }
      this.executePlayerCommand(cmd, queue, afterAction);
    } else {
      this.executeEnemyAction(current, afterAction);
    }
  }

  private executePlayerCommand(cmd: PendingCommand, queue: Character[], next: () => void) {
    if (cmd.action === 'defend') {
      cmd.character.defending = true;
      this.showMessage(`${cmd.character.name} 防禦！傷害減半`);
      this.time.delayedCall(900, () => { this.clearMessage(); next(); });
      return;
    }

    if (cmd.action === 'skill' && cmd.skill?.type === 'heal') {
      const target = cmd.target;
      if (!target || !target.alive) { next(); return; }
      this.applyHealAndAdvance(cmd.character, target, cmd.skill, next);
      return;
    }

    if (cmd.action === 'skill' && cmd.skill?.type === 'buff') {
      const target = cmd.target;
      if (!target || !target.alive) { next(); return; }
      this.applyBuffAndAdvance(cmd.character, target, cmd.skill, next);
      return;
    }

    let target = cmd.target;
    if (!target || !target.alive) {
      const aliveEnemies = this.enemyParty.filter(e => e.alive);
      if (aliveEnemies.length === 0) { next(); return; }
      target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    }

    const skill = cmd.action === 'skill' ? cmd.skill : undefined;
    const isCrit = rollCrit(cmd.character);
    const dmgResult = calcDamage(cmd.character, target, skill, isCrit);
    if (dmgResult.isWeaknessHit) this.battleStats.weaknessHitCount++;
    const isNewDiscovery = recordHitDiscovery(dmgResult.isWeaknessHit, target, this.discoveredThisBattle, this.gameState);
    if (isNewDiscovery) {
      this.enemyParty
        .filter(e => e.templateId === target.templateId)
        .forEach(e => this.updateWeaknessIcon(e));
      this.time.delayedCall(900, () => {
        if (!this.scene.isActive()) return;
        this.showWeaknessRevealBanner(target.weakness!);
      });
    }

    const hpAfterHit = Math.max(0, target.stats.hp - dmgResult.damage);

    // Knockdown stagger
    if (dmgResult.isWeaknessHit && hpAfterHit > 0 && canKnockDown(target)) {
      target.knockedDown = true;
      const targetView = this.views.get(target.id);
      if (targetView) targetView.animator.playHit(false, () => {});
      this.showStaggerBanner(target);
    }

    // Bonus action
    applyWeaknessBonus(cmd.character, hpAfterHit, dmgResult.isWeaknessHit, queue);

    const finalTarget = target;
    const afterPrimaryHit = () => {
      if (!finalTarget.alive) { next(); return; }
      const supporter = pickSupporter(cmd.character, this.playerParty, this.gameState?.bondLevels);
      if (!supporter) { next(); return; }
      const bond = getBond(this.gameState?.bondLevels, cmd.character.templateId, supporter.templateId);
      if (!rollSupportAttack(bond)) { next(); return; }
      supporter.supportUsedThisRound = true;
      const supportDmg = calcSupportDamage(supporter, finalTarget);
      this.applyDamageAndAdvance(supporter, finalTarget, supportDmg, '援護攻擊', next);
    };

    this.applyDamageAndAdvance(cmd.character, target, dmgResult.damage, skill?.name, afterPrimaryHit, isCrit, skill?.appliesStatus, skill?.id);
  }

  private attemptRecruitAction(_attacker: Character, enemy: Character) {
    if (!this.waitingForInput) return;
    this.waitingForInput = false;
    this.actionMenu.removeAll(true);

    const isNamed = isNamedCharacter(enemy.templateId);
    const chance = recruitChance(enemy, isNamed);
    const success = attemptRecruit(chance);

    const resultMsg = success
      ? `「${enemy.name}」決定加入你的隊伍！`
      : `「${enemy.name}」拒絕了你的勸降！`;

    if (success) {
      this.recruitedEnemy = enemy;
      enemy.recruited = true;
    }

    getSfx(this).play(success ? SFX_KEYS.recruitSuccess : SFX_KEYS.recruitFail);
    this.showMessage(resultMsg);

    if (success) {
      // Recruit succeeded — no counterattack, just end the battle
      this.time.delayedCall(1200, () => {
        this.clearMessage();
        enemy.alive = false;
        this.checkBattleEnd();
      });
      return;
    }

    // Recruit failed — enemy counterattacks, then resume combat
    this.time.delayedCall(600, () => {
      this.clearMessage();
      const aliveTargets = this.playerParty.filter(p => p.alive);
      const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      if (!target) {
        this.checkBattleEnd();
        return;
      }
      const isCrit = rollCrit(enemy);
      const dmgResult = calcDamage(enemy, target, undefined, isCrit);
      this.applyDamageAndAdvance(enemy, target, dmgResult.damage, undefined, () => {
        this.startCommandPhase();
      }, isCrit);
    });
  }

  private executeEnemyAction(enemy: Character, next: () => void) {
    if (this.bossConfig && enemy.templateId === this.bossConfig.templateId) {
      const hpRatio = enemy.stats.hp / enemy.stats.maxHp;
      const phase = getBossPhase(this.bossConfig, hpRatio);
      const isFirstEntry = (phase.message || phase.weaknessOverride) && !this.triggeredPhaseThresholds.has(phase.hpThreshold);

      if (isFirstEntry) {
        this.triggeredPhaseThresholds.add(phase.hpThreshold);

        if (phase.weaknessOverride) {
          revealBossWeakness(enemy, phase, this.gameState);
          this.discoveredThisBattle.add(enemy.templateId);
          this.updateWeaknessIcon(enemy);
        }

        if (phase.message) this.showPhaseBanner(phase);

        const revealDelay = phase.message ? 2000 : 0;
        if (phase.weaknessOverride) {
          this.time.delayedCall(revealDelay, () => this.showWeaknessRevealBanner(phase.weaknessOverride!));
        }
        const actDelay = revealDelay + (phase.weaknessOverride ? 1800 : 0);
        this.time.delayedCall(actDelay, () => this.executeBossPhaseAction(enemy, phase, next));
        return;
      }

      this.executeBossPhaseAction(enemy, phase, next);
      return;
    }

    const decision = decideAction(enemy, this.enemyParty, this.playerParty);
    if (decision.skill?.type === 'heal') {
      this.applyHealAndAdvance(enemy, decision.target, decision.skill, next);
      return;
    }
    if (decision.skill?.type === 'buff') {
      this.applyBuffAndAdvance(enemy, decision.target, decision.skill, next);
      return;
    }
    const target = decision.target ?? chooseTarget(this.playerParty);
    if (!target) { next(); return; }
    const isCrit = rollCrit(enemy);
    const dmgResult = calcDamage(enemy, target, decision.skill, isCrit);
    this.applyDamageAndAdvance(enemy, target, dmgResult.damage, decision.skill?.name, next, isCrit, decision.skill?.appliesStatus, decision.skill?.id);
  }

  private executeBossPhaseAction(enemy: Character, phase: BossPhase, next: () => void) {
    const action = executeBossAction(enemy, this.playerParty, phase);

    if (action.type === 'defend') {
      enemy.defending = true;
      this.showMessage(`${enemy.name} 進入防禦姿態！`);
      this.time.delayedCall(900, () => { this.clearMessage(); next(); });
      return;
    }

    if (!action.target) { next(); return; }

    if (action.type === 'double_attack') {
      const target = action.target;
      const crit1 = !action.ignoreDefense && rollCrit(enemy);
      const dmg1 = action.ignoreDefense
        ? Math.max(1, enemy.stats.atk)
        : calcDamage(enemy, target, undefined, crit1).damage;
      this.applyDamageAndAdvance(enemy, target, dmg1, '連擊①', () => {
        if (!target.alive) { next(); return; }
        const crit2 = !action.ignoreDefense && rollCrit(enemy);
        const dmg2 = action.ignoreDefense
          ? Math.max(1, enemy.stats.atk)
          : calcDamage(enemy, target, undefined, crit2).damage;
        this.applyDamageAndAdvance(enemy, target, dmg2, '連擊②', next, crit2);
      }, crit1);
      return;
    }

    const crit = !action.ignoreDefense && rollCrit(enemy);
    const dmg = action.ignoreDefense
      ? Math.max(1, enemy.stats.atk)
      : calcDamage(enemy, action.target, undefined, crit).damage;
    this.applyDamageAndAdvance(enemy, action.target, dmg, undefined, next, crit);
  }

  private showPhaseBanner(phase: BossPhase) {
    const W = 360;
    const banner = this.add.text(W / 2, 100, phase.message!, {
      fontSize: '14px', color: '#f59e0b', fontFamily: 'monospace',
      backgroundColor: '#111827',
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(1800, () => {
      if (banner.active) banner.destroy();
    });
  }

  private showWeaknessRevealBanner(element: Element) {
    const W = 360;
    const label = ELEMENT_LABELS[element];
    const banner = this.add.text(W / 2, 130, `💢 弱點外露：${label}屬性！`, {
      fontSize: '13px', color: '#f87171', fontFamily: 'monospace',
      backgroundColor: '#111827', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(1800, () => { if (banner.active) banner.destroy(); });
  }

  private showStaggerBanner(target: Character) {
    const view = this.views.get(target.id);
    if (!view) return;
    const W = 360;
    const banner = this.add.text(W / 2, 160, '↓ STAGGER!', {
      fontSize: '13px', color: '#facc15', fontFamily: 'monospace',
      backgroundColor: '#111827', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(800, () => { if (banner.active) banner.destroy(); });
  }

  private showAoaPrompt(onDone: () => void) {
    this.phase = 'all-out-attack-prompt';
    this.actionMenu.removeAll(true);
    const W = 360;

    const banner = this.add.text(W / 2, 150, '⚡ ALL-OUT ATTACK!', {
      fontSize: '15px', color: '#fbbf24', fontFamily: 'monospace',
      backgroundColor: '#111827', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(1000, () => { if (banner.active) banner.destroy(); });

    const confirmBtn = this.add.rectangle(-44, 0, 80, 36, 0x15803d)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(-44, 0, '確認', {
      fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const declineBtn = this.add.rectangle(44, 0, 80, 36, 0x7f1d1d)
      .setInteractive({ useHandCursor: true });
    const declineTxt = this.add.text(44, 0, '放棄', {
      fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.actionMenu.add([confirmBtn, confirmTxt, declineBtn, declineTxt]);

    const cleanup = () => { this.actionMenu.removeAll(true); };

    confirmBtn.once('pointerdown', () => {
      if (this.phase !== 'all-out-attack-prompt') return;
      getSfx(this).play(SFX_KEYS.crit);
      cleanup();

      // Flash all alive player characters
      this.playerParty.filter(m => m.alive).forEach(m => {
        this.views.get(m.id)?.animator.playSkillCast('white', () => {});
      });

      applyAllOutAttack(this.playerParty, this.enemyParty);

      // Post-damage: set alive=false, update bars, play die anims
      this.enemyParty.forEach(e => {
        if (e.stats.hp <= 0) {
          e.alive = false;
          this.views.get(e.id)?.animator.playDie('left', () => {});
        }
        this.updateHpBar(e);
      });

      this.aoaState.usedThisRound = true;
      this.phase = 'executing';
      this.showMessage('⚡ 全體攻擊！');

      this.time.delayedCall(1200, () => {
        if (!this.scene.isActive()) return;
        this.clearMessage();
        if (this.checkBattleEnd()) return;
        onDone();
      });
    });

    declineBtn.once('pointerdown', () => {
      if (this.phase !== 'all-out-attack-prompt') return;
      getSfx(this).play(SFX_KEYS.buttonClick);
      cleanup();
      this.aoaState.usedThisRound = true;
      this.phase = 'executing';
      onDone();
    });
  }

  private applyDamageAndAdvance(
    attacker: Character,
    target: Character,
    dmg: number,
    skillName: string | undefined,
    next: () => void,
    isCrit = false,
    appliesStatus?: StatusEffectType,
    skillId?: string,
  ) {
    const sfx = getSfx(this);
    const attackerView = this.views.get(attacker.id);
    const targetView = this.views.get(target.id);
    const facing = deriveFacing(attacker.isPlayer);

    target.stats.hp = Math.max(0, target.stats.hp - dmg);
    const died = target.stats.hp === 0;
    if (died && target.isPlayer) this.battleStats.playerKOCount++;
    if (died) target.alive = false;
    this.updateHpBar(target);

    let statusLabel = '';
    if (appliesStatus && target.alive) {
      const durationMap: Record<StatusEffectType, number> = { poison: 3, burn: 2, freeze: 1, stun: 1 };
      applyStatusEffect(target, appliesStatus, durationMap[appliesStatus], skillId ?? 'unknown');
      this.updateStatusIcons(target);
      const STATUS_LABEL: Record<StatusEffectType, string> = {
        poison: '中毒！', burn: '灼燒！', freeze: '凍結！', stun: '眩暈！',
      };
      statusLabel = ` ${STATUS_LABEL[appliesStatus]}`;
    }

    const label = skillName ? `【${skillName}】` : '';
    const critLabel = isCrit ? '暴擊! ' : '';
    this.showMessage(`${critLabel}${attacker.name}${label} → ${target.name} -${dmg} HP${statusLabel}`);

    if (attackerView) {
      attackerView.animator.playWalk(facing, () => {
        sfx.play(SFX_KEYS.attack);
        attackerView.animator.playAttack(facing, () => {
          sfx.play(SFX_KEYS.hit);
          if (isCrit) sfx.play(SFX_KEYS.crit);
          if (targetView) {
            if (died) {
              targetView.animator.playDie(deriveFacing(target.isPlayer), () => {});
            } else {
              targetView.animator.playHit(isCrit, () => targetView.animator.returnToIdle());
            }
          }
          attackerView.animator.returnToIdle();
        });
      });
    } else {
      sfx.play(SFX_KEYS.attack);
      sfx.play(SFX_KEYS.hit);
      if (isCrit) sfx.play(SFX_KEYS.crit);
    }

    const delay = died ? Math.max(900, DIE_CONFIG.sprite.totalDuration + 200) : 900;
    this.time.delayedCall(delay, () => {
      this.clearMessage();
      next();
    });
  }

  private applyHealAndAdvance(caster: Character, target: Character, skill: Skill, next: () => void) {
    getSfx(this).play(SFX_KEYS.heal);
    const amount = calcHeal(caster, skill);
    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + amount);
    this.updateHpBar(target);

    const casterView = this.views.get(caster.id);
    if (casterView) casterView.animator.playSkillCast('blue', () => {});

    this.showMessage(`${caster.name}【${skill.name}】→ ${target.name} +${amount} HP`);
    this.time.delayedCall(900, () => { this.clearMessage(); next(); });
  }

  private applyBuffAndAdvance(caster: Character, target: Character, skill: Skill, next: () => void) {
    getSfx(this).play(SFX_KEYS.buff);
    applyBuff(target, skill, caster);
    const label = skill.buffStat ? STAT_LABEL[skill.buffStat] : '';

    const casterView = this.views.get(caster.id);
    if (casterView) casterView.animator.playSkillCast('green', () => {});

    this.showMessage(`${caster.name}【${skill.name}】→ ${target.name} ${label}↑`);
    this.time.delayedCall(900, () => { this.clearMessage(); next(); });
  }

  private checkBattleEnd(): boolean {
    const playerAlive = this.playerParty.some(c => c.alive);
    const enemyAlive = this.enemyParty.some(c => c.alive);
    if (!playerAlive || !enemyAlive) {
      const victory = !enemyAlive;
      getSfx(this).play(victory ? SFX_KEYS.victory : SFX_KEYS.defeat);
      const expGained = victory ? STAGES[this.stageIndex].expReward : 0;
      this.views.forEach(view => view.animator.killAllTweens());
      this.time.delayedCall(400, () => {
        this.scene.start('ResultScene', {
          victory,
          playerParty: this.playerParty,
          stageIndex: this.stageIndex,
          expGained,
          expPool: this.expPool,
          recruitedEnemy: this.recruitedEnemy,
          gameState: this.gameState,
          battleStats: this.battleStats,
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
      const decision = decideActionWithAwareness(c, this.playerParty, this.enemyParty, this.gameState?.discoveredWeaknesses ?? {});
      this.pendingCommands.set(c.id, {
        character: c,
        action: decision.skill ? 'skill' : 'attack',
        skill: decision.skill,
        target: decision.target,
      });
    });

    const queue = computeTurnOrder([...this.playerParty, ...this.enemyParty]);
    this.executeNextInQueue(queue);
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
    if (this.skillPickerActive) {
      this.skillPickerActive = false;
      this.actionMenu.removeAll(true);
      this.showCommandMenu(this.playerParty[this.commandIndex]);
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

  // ─── Pre-battle Dialog ────────────────────────────────────────────────────

  private showPreBattleDialog(dialog: { speaker: string; lines: string[] }, onDone: () => void) {
    const W = 360, H = 640;
    let lineIndex = 0;

    const blocker = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(19)
      .setInteractive();

    const panelBg = this.add.rectangle(W / 2, H - 100, W, 200, 0x111827)
      .setStrokeStyle(1, 0x4b5563)
      .setDepth(20);

    const speakerText = this.add.text(24, H - 188, dialog.speaker, {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(20);

    const lineText = this.add.text(24, H - 168, dialog.lines[0], {
      fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      wordWrap: { width: 312 },
    }).setDepth(20);

    const hintText = this.add.text(W - 16, H - 16, '▶ 點擊繼續', {
      fontSize: '10px', color: '#6b7280', fontFamily: 'monospace',
    }).setOrigin(1, 1).setDepth(20);

    const advance = () => {
      lineIndex++;
      if (lineIndex >= dialog.lines.length) {
        blocker.destroy();
        panelBg.destroy();
        speakerText.destroy();
        lineText.destroy();
        hintText.destroy();
        onDone();
      } else {
        lineText.setText(dialog.lines[lineIndex]);
      }
    };

    panelBg.setInteractive();
    panelBg.on('pointerdown', advance);
    blocker.on('pointerdown', advance);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private showMessage(text: string) { this.messageText.setText(text); }
  private clearMessage() { this.messageText.setText(''); }
}
