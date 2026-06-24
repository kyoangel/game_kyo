import type { Character, GameState, Stage } from '../types';
import { createCharacter } from './CharacterFactory';
import { PLAYER_TEMPLATES } from '../data/characters';

export function processVictory(
  gameState: GameState,
  stage: Stage,
  expGained: number,
  recruitedEnemy: Character | undefined,
): GameState {
  const state: GameState = {
    ...gameState,
    pool: [...gameState.pool],
    squad: [...gameState.squad],
    stageProgress: {
      ...gameState.stageProgress,
      completedStageIds: [...gameState.stageProgress.completedStageIds],
      inChapterRun: gameState.stageProgress.inChapterRun
        ? { ...gameState.stageProgress.inChapterRun, lockedSquad: [...gameState.stageProgress.inChapterRun.lockedSquad] }
        : undefined,
    },
  };

  const isFirstClear = !gameState.stageProgress.completedStageIds.includes(stage.id);

  // Add to completed stages (no duplicates)
  if (!state.stageProgress.completedStageIds.includes(stage.id)) {
    state.stageProgress.completedStageIds.push(stage.id);
  }

  // Add currency
  state.currency += stage.currencyReward;

  // Add EXP to pool
  state.expPool += expGained;

  // Stage unlock (only on first clear)
  if (isFirstClear && stage.unlockCharacterId) {
    const alreadyInPool = state.pool.some(c => c.templateId === stage.unlockCharacterId);
    if (!alreadyInPool) {
      const template = PLAYER_TEMPLATES.find(t => t.id === stage.unlockCharacterId);
      if (template) {
        state.pool.push(createCharacter(template, 1));
      }
    }
  }

  // Recruit: add recruited enemy to pool
  if (recruitedEnemy) {
    const alreadyInPool = state.pool.some(c => c.templateId === recruitedEnemy.templateId);
    if (!alreadyInPool) {
      const template = PLAYER_TEMPLATES.find(t => t.id === recruitedEnemy.templateId);
      if (template) {
        state.pool.push(createCharacter(template, Math.max(1, recruitedEnemy.level)));
      }
    }
  }

  // Update chapter run state
  if (state.stageProgress.inChapterRun?.chapterId === stage.chapterId) {
    if (stage.stageIndex >= 4) {
      state.stageProgress.inChapterRun = undefined;
    } else {
      state.stageProgress.inChapterRun.currentStageIndex = stage.stageIndex + 1;
    }
  }

  state.savedAt = Date.now();
  return state;
}
