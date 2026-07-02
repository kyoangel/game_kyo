import type { Character, GameState, Stage } from '../types';
import { createCharacter, enemyToPlayerCharacter } from './CharacterFactory';
import { PLAYER_TEMPLATES } from '../data/characters';
import { addToInventory } from './ShopSystem';

export function processVictory(
  gameState: GameState,
  stage: Stage,
  expGained: number,
  recruitedEnemy: Character | undefined,
  ngPlusCycle = 0,
  starRating = 1,
): GameState {
  const rewardMultiplier = 1 + ngPlusCycle * 0.2;
  const starMultiplier = 1 + (Math.max(1, Math.min(3, starRating)) - 1) * 0.1;
  const totalMultiplier = rewardMultiplier * starMultiplier;
  const scaledExpGained = Math.round(expGained * totalMultiplier);
  const scaledCurrencyReward = Math.round(stage.currencyReward * totalMultiplier);
  const state: GameState = {
    ...gameState,
    pool: [...gameState.pool],
    squad: [...gameState.squad],
    inventory: [...gameState.inventory],
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
  state.currency += scaledCurrencyReward;

  // Add EXP to pool
  state.expPool += scaledExpGained;

  // Track best-ever star rating per stage (only improves, never decreases)
  const existingBest = gameState.bestStarRatings?.[stage.id] ?? 0;
  state.bestStarRatings = {
    ...(gameState.bestStarRatings ?? {}),
    [stage.id]: Math.max(existingBest, starRating),
  };

  // hasClearedGame is set permanently once the final boss is cleared; never reset (incl. by NG+)
  if (stage.id === '5-5') {
    state.hasClearedGame = true;
  }

  // Stage unlock (only on first clear)
  if (isFirstClear && stage.unlockCharacterId) {
    const alreadyInPool = state.pool.some(c => c.templateId === stage.unlockCharacterId);
    if (!alreadyInPool) {
      const template = PLAYER_TEMPLATES.find(t => t.id === stage.unlockCharacterId);
      if (template) {
        const newChar = createCharacter(template, 1);
        state.pool.push(newChar);
        // Non-boss story companions join squad directly if space (劇情加入)
        if (!stage.isBoss && state.squad.length < 5) {
          state.squad.push(newChar);
        }
      }
    }
  }

  // Item rewards (side quests only, granted on first clear)
  if (isFirstClear && stage.itemRewards) {
    let inventory = state.inventory;
    for (const reward of stage.itemRewards) {
      for (let i = 0; i < reward.quantity; i++) {
        inventory = addToInventory(inventory, reward.itemId);
      }
    }
    state.inventory = inventory;
  }

  // Recruit: add recruited enemy to pool (if not already there), then auto-join squad if space.
  // Note: for boss stages, the unlock block above may have already added the character to pool —
  // the squad push must still happen regardless.
  if (recruitedEnemy) {
    const alreadyInPool = state.pool.some(c => c.templateId === recruitedEnemy.templateId);
    if (!alreadyInPool) {
      const template = PLAYER_TEMPLATES.find(t => t.id === recruitedEnemy.templateId);
      const newChar = template
        ? createCharacter(template, Math.max(1, recruitedEnemy.level))
        : enemyToPlayerCharacter(recruitedEnemy, recruitedEnemy.stats.maxHp);
      state.pool.push(newChar);
    }
    const poolChar = state.pool.find(c => c.templateId === recruitedEnemy.templateId);
    if (poolChar && !state.squad.some(s => s.id === poolChar.id) && state.squad.length < 5) {
      state.squad.push(poolChar);
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
