import { Colors } from './theme';

export function getCardBorderColor(characterId: string, activeCharacterId: string | null | undefined): number {
  if (activeCharacterId != null && characterId === activeCharacterId) {
    return Colors.BORDER_LIT;
  }
  return Colors.BORDER_DIM;
}

export function getCardBorderWidth(characterId: string, activeCharacterId: string | null | undefined): number {
  return activeCharacterId != null && characterId === activeCharacterId ? 2 : 1;
}
