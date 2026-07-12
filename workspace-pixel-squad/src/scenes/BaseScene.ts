import Phaser from 'phaser';
import type { Character, GameState } from '../types';
import { canLevelUp, applyLevelUp, DEFAULT_LEVEL_UP_CONFIG } from '../battle/LevelUpSystem';
import { allocateStat } from '../battle/ExpSystem';
import { canUseSupply, useSupply, findItemById } from '../battle/ShopSystem';
import { saveSlot } from '../save/SaveSystem';
import { computeBaseHubButtons } from './BaseButtonLayout';
import { CHAPTERS } from '../data/chapters';
import { STAGES } from '../data/stages';
import { getSfx } from '../audio/SfxManager';
import { getMusic } from '../audio/MusicManager';
import { SFX_KEYS, MUSIC_KEYS } from '../data/audio';
import { getDoomsdayColor, formatDoomsdayLabel } from '../ui/doomsdayDisplay';
import { getDoomsdayDaysRemaining } from '../battle/DoomsdayClock';
import { computeMaxScroll, clampScroll } from '../ui/scrollList';

export class BaseScene extends Phaser.Scene {
  private gameState!: GameState;
  private expPoolText!: Phaser.GameObjects.Text;
  private expPoolBar!: Phaser.GameObjects.Rectangle;

  private allocationPanel?: Phaser.GameObjects.Container;
  private currentAllocChar?: Character;
  private pointsText?: Phaser.GameObjects.Text;
  private statValueTexts = new Map<string, Phaser.GameObjects.Text>();

  private supplyPanel?: Phaser.GameObjects.Container;

  // Squad/bench/supply list can overflow the viewport with a full 5-person
  // squad + bench + supply rows (bug: hub buttons became overlapped/
  // unreachable with no way to scroll down to them). Lives in its own
  // scrollable, masked container between the header and the hub buttons.
  private squadContainer?: Phaser.GameObjects.Container;
  private squadMask?: Phaser.Display.Masks.GeometryMask;
  private scrollY = 0;
  private maxScroll = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private readonly listViewTop = 104;
  private readonly listViewBottom = 576; // just above the hub button row at y=600

  constructor() { super({ key: 'BaseScene' }); }

  create(gameState: GameState) {
    this.gameState = gameState;
    getMusic(this).playTrack(MUSIC_KEYS.theme);

    const W = 360, H = 640;
    this.add.rectangle(W / 2, H / 2, W, H, 0x111827);

    const isInChapter = !!gameState.stageProgress.inChapterRun;
    const title = isInChapter ? '整備' : '基地';
    this.add.text(W / 2, 24, title, {
      fontSize: '20px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(320, 24, `幣:${gameState.currency}`, {
      fontSize: '12px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    const doomsdayDays = getDoomsdayDaysRemaining(gameState);
    this.add.text(320, 40, formatDoomsdayLabel(doomsdayDays), {
      fontSize: '11px',
      color: getDoomsdayColor(doomsdayDays),
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    this.add.text(20, 48, 'EXP池', { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' });
    this.add.rectangle(200, 60, 220, 12, 0x374151).setOrigin(0.5, 0.5);
    this.expPoolBar = this.add.rectangle(90, 60, 0, 10, 0x4ade80).setOrigin(0, 0.5);
    this.expPoolText = this.add.text(320, 48, '0', {
      fontSize: '12px', color: '#4ade80', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    this.updateExpPoolDisplay();

    if (isInChapter) {
      this.renderInChapterMode();
    } else {
      this.renderBaseMode();
    }
  }

  private updateExpPoolDisplay() {
    this.expPoolText.setText(String(this.gameState.expPool));
    const pct = Math.min(1, this.gameState.expPool / 500);
    this.expPoolBar.width = 220 * pct;
  }

  private renderBaseMode() {
    const W = 360;
    this.add.line(W / 2, 84, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);
    this.add.text(20, 90, '出戰中 (最多5人)', { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' });
    this.setupSquadScrollMask();
    this.setupSquadScrollInput();
    this.renderSquadSection(104);

    computeBaseHubButtons().forEach(def => {
      const btn = this.add.rectangle(def.x, def.y, def.width, def.height, def.color).setInteractive({ useHandCursor: true });
      this.add.text(def.x, def.y, def.label, { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
      btn.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); saveSlot(this.gameState); this.scene.start(def.targetScene, { gameState: this.gameState }); });
      btn.on('pointerover', () => btn.setAlpha(0.8));
      btn.on('pointerout', () => btn.setAlpha(1));
    });
  }

  private setupSquadScrollMask() {
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.listViewTop, 360, this.listViewBottom - this.listViewTop);
    this.squadMask = maskShape.createGeometryMask();
  }

  private applyListScroll() {
    if (this.squadContainer) this.squadContainer.y = -this.scrollY;
  }

  private setupSquadScrollInput() {
    const isBlocked = () => !!this.allocationPanel || !!this.supplyPanel;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (isBlocked()) return;
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const delta = pointer.y - this.dragStartY;
      this.scrollY = clampScroll(this.dragStartScroll - delta, this.maxScroll);
      this.applyListScroll();
    });

    this.input.on('pointerup', () => { this.isDragging = false; });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      if (isBlocked()) return;
      this.scrollY = clampScroll(this.scrollY + dy, this.maxScroll);
      this.applyListScroll();
    });
  }

  private renderSquadSection(startY: number) {
    this.squadContainer?.destroy();
    this.squadContainer = this.add.container(0, 0);
    if (this.squadMask) this.squadContainer.setMask(this.squadMask);

    let y = startY;

    this.gameState.squad.forEach((char) => {
      y = this.renderCharCard(char, y, true, this.squadContainer!);
    });

    const bench = this.gameState.pool.filter(p => !this.gameState.squad.some(s => s.id === p.id));
    if (bench.length > 0) {
      const sep = this.add.text(20, y + 4, '角色庫', { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' });
      this.squadContainer.add(sep);
      y += 22;
      bench.forEach((char) => {
        y = this.renderCharCard(char, y, false, this.squadContainer!);
      });
    }

    if (!this.gameState.stageProgress.inChapterRun) {
      y = this.renderInventorySection(y);
    }

    this.maxScroll = computeMaxScroll(y - startY, this.listViewBottom - this.listViewTop);
    this.scrollY = 0; // reshuffled content each rebuild — start back at the top
    this.applyListScroll();
  }

  private renderInventorySection(startY: number): number {
    const inventory = this.gameState.inventory ?? [];
    if (inventory.length === 0) return startY;

    let y = startY + 4;
    const sep = this.add.text(20, y, '補給品', { fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' });
    this.squadContainer!.add(sep);
    y += 22;

    inventory.forEach((entry) => {
      const item = findItemById(entry.itemId);
      const name = item?.name ?? entry.itemId;
      const rowBg = this.add.rectangle(180, y + 16, 340, 32, 0x1f2937).setStrokeStyle(1, 0x4b5563);
      const label = this.add.text(24, y + 16, `${name}  x${entry.quantity}`, { fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace' }).setOrigin(0, 0.5);
      this.squadContainer!.add([rowBg, label]);

      const canUse = item ? this.gameState.squad.some(m => canUseSupply(m)) : false;
      const useBtn = this.add.rectangle(320, y + 16, 50, 28, canUse ? 0x16a34a : 0x374151);
      const useTxt = this.add.text(320, y + 16, '使用', { fontSize: '11px', color: canUse ? '#fff' : '#6b7280', fontFamily: 'monospace' }).setOrigin(0.5);
      this.squadContainer!.add([useBtn, useTxt]);
      if (canUse && item) {
        useBtn.setInteractive({ useHandCursor: true });
        useBtn.on('pointerdown', () => this.showSupplyTargetPanel(item));
        useBtn.on('pointerover', () => useBtn.setAlpha(0.8));
        useBtn.on('pointerout', () => useBtn.setAlpha(1));
      }

      y += 36;
    });

    return y;
  }

  private showSupplyTargetPanel(item: { id: string; healAmount?: number }) {
    if (this.allocationPanel || this.supplyPanel) return;
    const targets = this.gameState.squad.filter(m => canUseSupply(m));
    if (targets.length === 0) return;

    const W = 360, H = 640;
    const panel = this.add.container(W / 2, H / 2);
    panel.setDepth(10);
    const bg = this.add.rectangle(0, 0, 300, 80 + targets.length * 40, 0x1f2937).setStrokeStyle(2, 0x16a34a);
    panel.add(bg);
    const title = this.add.text(0, -(40 + targets.length * 20) + 10, '選擇使用對象', {
      fontSize: '13px', color: '#a78bfa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    panel.add(title);

    let y = -(20 + targets.length * 20) + 30;
    targets.forEach((target) => {
      const rowBtn = this.add.rectangle(0, y, 260, 32, 0x374151).setInteractive({ useHandCursor: true });
      const rowTxt = this.add.text(0, y, `${target.name}  HP:${target.stats.hp}/${target.stats.maxHp}`, {
        fontSize: '12px', color: '#e5e7eb', fontFamily: 'monospace',
      }).setOrigin(0.5);
      rowBtn.on('pointerdown', () => this.applySupply(item, target));
      rowBtn.on('pointerover', () => rowBtn.setFillStyle(0x4b5563));
      rowBtn.on('pointerout', () => rowBtn.setFillStyle(0x374151));
      panel.add([rowBtn, rowTxt]);
      y += 40;
    });

    const cancelBtn = this.add.rectangle(0, y, 120, 32, 0x7f1d1d).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(0, y, '取消', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    cancelBtn.on('pointerdown', () => this.closeSupplyPanel());
    cancelBtn.on('pointerover', () => cancelBtn.setAlpha(0.8));
    cancelBtn.on('pointerout', () => cancelBtn.setAlpha(1));
    panel.add([cancelBtn, cancelTxt]);

    this.supplyPanel = panel;
  }

  private applySupply(item: { id: string; healAmount?: number }, target: Character) {
    const result = useSupply(this.gameState.inventory ?? [], item.id, item.healAmount ?? 0, target);
    this.updateCharInState(result.character);
    this.gameState.inventory = result.inventory;
    saveSlot(this.gameState);
    this.closeSupplyPanel();
  }

  private closeSupplyPanel() {
    this.supplyPanel?.destroy();
    this.supplyPanel = undefined;
    this.renderSquadSection(104);
  }

  private renderCharCard(char: Character, y: number, inSquad: boolean, container: Phaser.GameObjects.Container): number {
    const canUp = canLevelUp(char, this.gameState.expPool, DEFAULT_LEVEL_UP_CONFIG);

    const rowBg = this.add.rectangle(180, y + 42, 340, 76, inSquad ? 0x1f2937 : 0x161e2e).setStrokeStyle(1, inSquad ? 0x4b5563 : 0x1f2937);
    const nameText = this.add.text(24, y + 14, `${char.name}  Lv.${char.level}  ${char.archetype}`, { fontSize: '13px', color: '#e5e7eb', fontFamily: 'monospace' });
    const statsText = this.add.text(24, y + 34, `HP:${char.stats.hp}  ATK:${char.stats.atk}  DEF:${char.stats.def}  SPD:${char.stats.spd}`, { fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' });
    container.add([rowBg, nameText, statsText]);

    const gearParts: string[] = [];
    if (char.equipment?.weapon) gearParts.push(`⚔${char.equipment.weapon.name}`);
    if (char.equipment?.armor) gearParts.push(`🛡${char.equipment.armor.name}`);
    if (gearParts.length > 0) {
      const gearText = this.add.text(24, y + 52, gearParts.join(' '), { fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' });
      container.add(gearText);
    }

    if (canUp) {
      const lvBtn = this.add.rectangle(260, y + 42, 66, 32, 0x16a34a).setInteractive({ useHandCursor: true });
      const lvTxt = this.add.text(260, y + 42, '升級', { fontSize: '12px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
      lvBtn.on('pointerdown', () => this.handleLevelUp(char));
      lvBtn.on('pointerover', () => lvBtn.setAlpha(0.8));
      lvBtn.on('pointerout', () => lvBtn.setAlpha(1));
      container.add([lvBtn, lvTxt]);
    }

    if (!this.gameState.stageProgress.inChapterRun) {
      const toggleLabel = inSquad ? '移出' : '加入';
      const toggleColor = inSquad ? 0x7f1d1d : 0x16a34a;
      const canToggle = inSquad ? this.gameState.squad.length > 1 : this.gameState.squad.length < 5;
      if (canToggle) {
        const toggleBtn = this.add.rectangle(320, y + 42, 50, 32, toggleColor).setInteractive({ useHandCursor: true });
        const toggleTxt = this.add.text(320, y + 42, toggleLabel, { fontSize: '11px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
        toggleBtn.on('pointerdown', () => this.toggleSquad(char, inSquad));
        toggleBtn.on('pointerover', () => toggleBtn.setAlpha(0.8));
        toggleBtn.on('pointerout', () => toggleBtn.setAlpha(1));
        container.add([toggleBtn, toggleTxt]);
      }
    }

    return y + 84;
  }

  private toggleSquad(char: Character, isInSquad: boolean) {
    if (this.allocationPanel) return;
    if (isInSquad) {
      if (this.gameState.squad.length <= 1) return;
      this.gameState.squad = this.gameState.squad.filter(c => c.id !== char.id);
    } else {
      if (this.gameState.squad.length >= 5) return;
      this.gameState.squad = [...this.gameState.squad, char];
    }
    saveSlot(this.gameState);
    this.renderSquadSection(104);
  }

  private renderInChapterMode() {
    const W = 360;
    const run = this.gameState.stageProgress.inChapterRun!;
    const chapter = CHAPTERS.find(c => c.id === run.chapterId);
    const chapterName = chapter?.name ?? run.chapterId;

    this.add.text(W / 2, 84, `${chapterName} ${run.currentStageIndex + 1}/5關`, {
      fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.line(W / 2, 100, -W / 2, 0, W / 2, 0, 0x374151).setLineWidth(1);
    this.add.text(20, 106, '出戰中 (鎖定)', { fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' });

    // Locked squad in a chapter run is capped at 5 with no bench/inventory
    // rows, so it always fits the viewport — a plain container is enough,
    // no scroll/mask wiring needed here (unlike renderSquadSection above).
    const listContainer = this.add.container(0, 0);
    let y = 118;
    run.lockedSquad.forEach(char => {
      y = this.renderCharCard(char, y, true, listContainer);
    });

    const continueBtn = this.add.rectangle(240, 600, 130, 40, 0x16a34a).setInteractive({ useHandCursor: true });
    this.add.text(240, 600, '繼續', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    continueBtn.on('pointerdown', () => this.continueChapter());
    continueBtn.on('pointerover', () => continueBtn.setAlpha(0.8));
    continueBtn.on('pointerout', () => continueBtn.setAlpha(1));

    const abandonBtn = this.add.rectangle(100, 600, 130, 40, 0x7f1d1d).setInteractive({ useHandCursor: true });
    this.add.text(100, 600, '放棄本章', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    abandonBtn.on('pointerdown', () => this.abandonChapter());
    abandonBtn.on('pointerover', () => abandonBtn.setAlpha(0.8));
    abandonBtn.on('pointerout', () => abandonBtn.setAlpha(1));
  }

  private continueChapter() {
    if (this.allocationPanel) return;
    const run = this.gameState.stageProgress.inChapterRun!;
    const stageArrayIndex = STAGES.findIndex(
      s => s.chapterId === run.chapterId && s.stageIndex === run.currentStageIndex
    );
    if (stageArrayIndex < 0) return;
    saveSlot(this.gameState);
    this.scene.start('BattleScene', {
      playerParty: run.lockedSquad,
      stageIndex: stageArrayIndex,
      expPool: this.gameState.expPool,
      gameState: this.gameState,
    });
  }

  private abandonChapter() {
    this.gameState.stageProgress.inChapterRun = undefined;
    saveSlot(this.gameState);
    this.scene.start('WorldMapScene', { gameState: this.gameState });
  }

  private handleLevelUp(char: Character) {
    if (this.allocationPanel) return;
    const result = applyLevelUp(char, this.gameState.expPool, DEFAULT_LEVEL_UP_CONFIG);
    this.updateCharInState(result.character);
    this.gameState.expPool = result.expPool;
    this.updateExpPoolDisplay();
    saveSlot(this.gameState);

    if (result.character.isProtagonist) {
      this.showAllocationPanel(result.character);
    } else {
      this.showNonProtagonistSummary(char, result.character);
    }
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
    const gainText = this.add.text(0, 5, gainParts.join('  ') || '無成長', {
      fontSize: '14px', color: '#fde047', fontFamily: 'monospace',
    }).setOrigin(0.5);
    const hint = this.add.text(0, 55, '（點擊繼續）', { fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }).setOrigin(0.5);
    panel.add([bg, title, gainText, hint]);
    bg.setInteractive();
    const dismiss = () => {
      if (panel.active) {
        panel.destroy();
        if (this.gameState.stageProgress.inChapterRun) { this.renderInChapterMode(); } else { this.renderSquadSection(104); }
      }
    };
    bg.on('pointerdown', dismiss);
    this.time.delayedCall(2000, dismiss);
  }

  private showAllocationPanel(char: Character) {
    this.currentAllocChar = char;
    this.statValueTexts.clear();
    const W = 360, H = 640;
    this.allocationPanel = this.add.container(W / 2, H / 2 - 20);
    this.allocationPanel.setDepth(10);
    const bg = this.add.rectangle(0, 0, 320, 360, 0x1f2937).setStrokeStyle(2, 0x7c3aed);
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
      const lbl = this.add.text(-130, y, label, { fontSize: '15px', color: '#e5e7eb', fontFamily: 'monospace' }).setOrigin(0, 0.5);
      const val = this.add.text(10, y, String(char.stats[key]), { fontSize: '15px', color: '#a78bfa', fontFamily: 'monospace' }).setOrigin(0.5);
      this.statValueTexts.set(key, val);
      const btn = this.add.rectangle(100, y, 70, 32, 0x374151).setInteractive({ useHandCursor: true });
      const btnTxt = this.add.text(100, y, inc, { fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace' }).setOrigin(0.5);
      btn.on('pointerdown', () => this.spendPoint(key));
      btn.on('pointerover', () => btn.setFillStyle(0x4b5563));
      btn.on('pointerout', () => btn.setFillStyle(0x374151));
      this.allocationPanel!.add([lbl, val, btn, btnTxt]);
    });

    const confirmBtn = this.add.rectangle(0, 140, 160, 40, 0x16a34a).setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(0, 140, '確認', { fontSize: '16px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5);
    confirmBtn.on('pointerdown', () => this.closeAllocationPanel());
    confirmBtn.on('pointerover', () => confirmBtn.setAlpha(0.8));
    confirmBtn.on('pointerout', () => confirmBtn.setAlpha(1));
    this.allocationPanel.add([confirmBtn, confirmTxt]);
  }

  private spendPoint(stat: 'hp' | 'atk' | 'def' | 'spd') {
    if (!this.currentAllocChar || this.currentAllocChar.statPoints <= 0) return;
    const updated = allocateStat(this.currentAllocChar, stat);
    this.currentAllocChar = updated;
    this.updateCharInState(updated);
    this.pointsText?.setText(`剩餘點數: ${updated.statPoints}`);
    this.statValueTexts.get(stat)?.setText(String(updated.stats[stat]));
    saveSlot(this.gameState);
  }

  private closeAllocationPanel() {
    this.allocationPanel?.destroy();
    this.allocationPanel = undefined;
    this.currentAllocChar = undefined;
    if (this.gameState.stageProgress.inChapterRun) { this.renderInChapterMode(); } else { this.renderSquadSection(104); }
  }
}
