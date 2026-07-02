import Phaser from 'phaser';
import type { GameState, Stage } from '../types';
import { CHAPTERS } from '../data/chapters';
import { STAGES } from '../data/stages';
import { getSfx } from '../audio/SfxManager';
import { getMusic } from '../audio/MusicManager';
import { SFX_KEYS, MUSIC_KEYS } from '../data/audio';
import { getDoomsdayColor, formatDoomsdayLabel } from '../ui/doomsdayDisplay';
import { getDoomsdayDaysRemaining } from '../battle/DoomsdayClock';

interface StageRowView {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  stage: Stage;
}

export class WorldMapScene extends Phaser.Scene {
  private gameState!: GameState;
  private stageRows: StageRowView[] = [];
  private scrollY = 0;
  private maxScroll = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;

  constructor() {
    super({ key: 'WorldMapScene' });
  }

  init(data: { gameState: GameState }) {
    this.gameState = data.gameState;
  }

  create() {
    getMusic(this).playTrack(MUSIC_KEYS.theme);

    const W = 360;

    // Background
    this.add.rectangle(W / 2, 320, W, 640, 0x111827);

    // Title bar
    this.add.text(W / 2, 30, 'WORLD MAP', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    // Back button (top-left)
    const backBtnBg = this.add.rectangle(40, 30, 60, 28, 0x374151)
      .setInteractive({ useHandCursor: true });
    this.add.text(40, 30, '← 基地', {
      fontSize: '12px',
      color: '#e5e7eb',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    backBtnBg.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.scene.start('BaseScene', this.gameState); });
    backBtnBg.on('pointerover', () => backBtnBg.setFillStyle(0x4b5563));
    backBtnBg.on('pointerout', () => backBtnBg.setFillStyle(0x374151));

    // Currency display (top-right)
    this.add.text(W - 20, 30, `${this.gameState.currency} 💰`, {
      fontSize: '14px',
      color: '#fbbf24',
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    const doomsdayDays = getDoomsdayDaysRemaining(this.gameState);
    this.add.text(W - 20, 48, formatDoomsdayLabel(doomsdayDays), {
      fontSize: '12px',
      color: getDoomsdayColor(doomsdayDays),
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    // Create scrollable stage list
    this.createStageList();

    // Setup input handlers
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const delta = pointer.y - this.dragStartY;
      this.scrollY = Phaser.Math.Clamp(
        this.dragStartScroll - delta,
        0,
        this.maxScroll
      );
      this.updateStageListPositions();
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  private createStageList() {
    const rowHeight = 56;
    const baseY = 80;

    this.stageRows = [];

    CHAPTERS.forEach((chapter) => {
      // Check if chapter is unlocked
      if (!this.isChapterUnlocked(chapter.id)) {
        return;
      }

      // Chapter header row
      this.add.text(20, 0, chapter.name, {
        fontSize: '14px',
        color: '#9ca3af',
        fontFamily: 'monospace',
      }).setOrigin(0);

      // Stage rows for this chapter
      chapter.stageIds.forEach((stageId) => {
        const stage = STAGES.find((s) => s.id === stageId);
        if (!stage) return;

        const isAvailable = this.isStageAvailable(stage);
        const isCompleted = this.isStageCompleted(stage.id);
        const bestRating = this.gameState.bestStarRatings?.[stage.id] ?? 0;

        // Determine styling
        let bgColor = 0x374151;
        let textColor = '#6b7280';
        let prefix = '';

        if (isCompleted) {
          bgColor = 0x065f46;
          textColor = '#d1d5db';
          prefix = '✅ ';
        } else if (isAvailable) {
          bgColor = 0x1e3a5f;
          textColor = '#ffffff';
          prefix = '▶ ';
        } else {
          bgColor = 0x374151;
          textColor = '#6b7280';
          prefix = '🔒 ';
        }

        // Add boss/side quest prefix
        if (stage.isBoss) {
          prefix = '⚔ ' + prefix;
        } else if (stage.isSideQuest) {
          prefix = '✦ ' + prefix;
        }

        // Create stage row (background + text)
        const background = this.add.rectangle(0, 0, 320, rowHeight, bgColor)
          .setOrigin(0);

        if (isAvailable) {
          background.setInteractive({ useHandCursor: true });
          background.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.launchStage(stage); });
          background.on('pointerover', () => background.setFillStyle(0x2d5a8c));
          background.on('pointerout', () => background.setFillStyle(bgColor));
        }

        const starSuffix = isCompleted
          ? `  ${'★'.repeat(bestRating)}${'☆'.repeat(Math.max(0, 3 - bestRating))}`
          : '';

        const text = this.add.text(
          20,
          0,
          `${prefix}${stage.name}${starSuffix}`,
          {
            fontSize: '13px',
            color: textColor,
            fontFamily: 'monospace',
          }
        ).setOrigin(0);

        this.stageRows.push({
          background,
          text,
          stage,
        });
      });
    });

    // Hidden stages: absent from the list entirely until unlocked (secret, not just locked)
    STAGES.filter((s) => s.isHidden).forEach((stage) => {
      if (!this.isHiddenStageUnlocked(stage)) return;

      const isAvailable = this.isStageAvailable(stage);
      const isCompleted = this.isStageCompleted(stage.id);
      const bestRating = this.gameState.bestStarRatings?.[stage.id] ?? 0;

      let bgColor = 0x374151;
      let textColor = '#6b7280';
      let prefix = '🌟 ';

      if (isCompleted) {
        bgColor = 0x065f46;
        textColor = '#d1d5db';
        prefix = '🌟✅ ';
      } else if (isAvailable) {
        bgColor = 0x4c1d95;
        textColor = '#ffffff';
        prefix = '🌟▶ ';
      }

      const background = this.add.rectangle(0, 0, 320, rowHeight, bgColor).setOrigin(0);

      if (isAvailable) {
        background.setInteractive({ useHandCursor: true });
        background.on('pointerdown', () => { getSfx(this).play(SFX_KEYS.buttonClick); this.launchStage(stage); });
        background.on('pointerover', () => background.setFillStyle(0x2d5a8c));
        background.on('pointerout', () => background.setFillStyle(bgColor));
      }

      const starSuffix = isCompleted
        ? `  ${'★'.repeat(bestRating)}${'☆'.repeat(Math.max(0, 3 - bestRating))}`
        : '';

      const text = this.add.text(20, 0, `${prefix}${stage.name}${starSuffix}`, {
        fontSize: '13px',
        color: textColor,
        fontFamily: 'monospace',
      }).setOrigin(0);

      this.stageRows.push({ background, text, stage });
    });

    // Calculate max scroll
    const totalContentHeight = this.stageRows.length * rowHeight;
    this.maxScroll = Math.max(0, totalContentHeight - (600 - baseY));

    this.updateStageListPositions();
  }

  private updateStageListPositions() {
    const rowHeight = 56;
    const baseY = 80;

    this.stageRows.forEach((row, i) => {
      const y = baseY + i * rowHeight - this.scrollY;
      row.background.setPosition(20, y);
      row.text.setPosition(20, y + rowHeight / 2);
      row.text.setOrigin(0, 0.5);

      // Hide rows that are out of view
      const isVisible = y + rowHeight > baseY && y < 600;
      row.background.setVisible(isVisible);
      row.text.setVisible(isVisible);
    });
  }

  private isChapterUnlocked(chapterId: string): boolean {
    const chapter = CHAPTERS.find((c) => c.id === chapterId);
    if (!chapter) return false;

    // First chapter is always unlocked
    if (!chapter.unlockAfterChapterId) return true;

    // Check if the unlock chapter has all non-side-quest stages completed
    const unlockChapter = CHAPTERS.find((c) => c.id === chapter.unlockAfterChapterId);
    if (!unlockChapter) return false;

    const unlockStages = unlockChapter.stageIds
      .map((id) => STAGES.find((s) => s.id === id))
      .filter((s) => s && !s.isSideQuest);

    return unlockStages.every((stage) => stage && this.isStageCompleted(stage.id));
  }

  private isStageAvailable(stage: Stage): boolean {
    if (stage.isHidden) return this.isHiddenStageUnlocked(stage);

    // Side quest: check if unlockAfterStageId is completed
    if (stage.isSideQuest) {
      if (!stage.unlockAfterStageId) return false;
      return this.isStageCompleted(stage.unlockAfterStageId);
    }

    // Regular stage: check if chapter is unlocked and all previous stages are completed
    if (!this.isChapterUnlocked(stage.chapterId)) return false;

    if (stage.stageIndex === 0) return true; // First stage in chapter is available if chapter is unlocked

    // All previous stages in the chapter must be completed
    const chapter = CHAPTERS.find((c) => c.id === stage.chapterId);
    if (!chapter) return false;

    for (let i = 0; i < stage.stageIndex; i++) {
      const prevStageId = chapter.stageIds[i];
      if (!this.isStageCompleted(prevStageId)) return false;
    }

    return true;
  }

  private isStageCompleted(stageId: string): boolean {
    return this.gameState.stageProgress.completedStageIds.includes(stageId);
  }

  private isHiddenStageUnlocked(stage: Stage): boolean {
    if (!stage.unlockRequiresPerfectClear) return false;
    return (this.gameState.perfectClearStageIds ?? []).includes(stage.unlockRequiresPerfectClear);
  }

  private launchStage(stage: Stage) {
    const stageIndex = STAGES.findIndex((s) => s.id === stage.id);
    if (stageIndex === -1) return;

    this.scene.start('BattleScene', {
      playerParty: this.gameState.squad,
      stageIndex,
      expPool: this.gameState.expPool,
      gameState: this.gameState,
    });
  }
}
