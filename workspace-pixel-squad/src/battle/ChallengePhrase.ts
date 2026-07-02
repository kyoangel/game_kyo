import type { ChallengePhrase, ChallengePhraseConstraint, GameState, PendingCommand } from '../types';
import { CHALLENGE_PHRASES } from '../data/challengePhrases';

export interface ChallengePhraseProgress {
  roundsUsed?: number;
  usedSkill?: boolean;
}

export function getUnlockedChallengePhrases(state: GameState): ChallengePhrase[] {
  const ids = state.unlockedChallengePhraseIds ?? [];
  return CHALLENGE_PHRASES.filter(p => ids.includes(p.id));
}

export function unlockChallengePhrasesForStage(state: GameState, clearedStageId: string): GameState {
  const existing = state.unlockedChallengePhraseIds ?? [];
  const phrase = CHALLENGE_PHRASES.find(p => p.unlockStageId === clearedStageId);
  if (!phrase || existing.includes(phrase.id)) {
    return { ...state, unlockedChallengePhraseIds: [...existing] };
  }
  return { ...state, unlockedChallengePhraseIds: [...existing, phrase.id] };
}

export function selectChallengePhrase(state: GameState, phraseId: string): GameState {
  const unlocked = state.unlockedChallengePhraseIds ?? [];
  if (!unlocked.includes(phraseId)) {
    return { ...state };
  }
  return { ...state, activeChallengePhraseId: phraseId };
}

export function abandonActiveChallengePhrase(state: GameState): GameState {
  return { ...state, activeChallengePhraseId: undefined };
}

export function getActiveChallengePhrase(state: GameState): ChallengePhrase | undefined {
  if (!state.activeChallengePhraseId) return undefined;
  return CHALLENGE_PHRASES.find(p => p.id === state.activeChallengePhraseId);
}

export function isCommandAllowedUnderConstraint(
  constraint: ChallengePhraseConstraint,
  command: PendingCommand,
): boolean {
  if (constraint.type === 'physicalOnly') {
    return command.action !== 'skill';
  }
  return true;
}

export function isChallengePhraseConstraintViolated(
  constraint: ChallengePhraseConstraint,
  progress: ChallengePhraseProgress,
): boolean {
  if (constraint.type === 'turnLimit') {
    if (progress.roundsUsed === undefined || constraint.turnLimit === undefined) return false;
    return progress.roundsUsed > constraint.turnLimit;
  }
  if (constraint.type === 'physicalOnly') {
    return progress.usedSkill === true;
  }
  return false;
}

export function grantChallengePhraseReward(state: GameState, phrase: ChallengePhrase): GameState {
  return {
    ...state,
    currency: state.currency + phrase.reward.currencyBonus,
    activeChallengePhraseId: undefined,
  };
}
