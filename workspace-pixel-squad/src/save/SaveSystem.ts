import type { GameState } from '../types';

const KEY = (slot: 0 | 1 | 2) => `pixelSquad_save_${slot}`;

export interface SlotMeta {
  slot: 0 | 1 | 2;
  empty: boolean;
  chapterName?: string;
  squadSize?: number;
  savedAt?: number;
}

export function saveSlot(state: GameState): void {
  localStorage.setItem(KEY(state.slotId), JSON.stringify(state));
}

export function loadSlot(slot: 0 | 1 | 2): GameState | null {
  const raw = localStorage.getItem(KEY(slot));
  if (!raw) return null;
  try { return JSON.parse(raw) as GameState; }
  catch { return null; }
}

export function deleteSlot(slot: 0 | 1 | 2): void {
  localStorage.removeItem(KEY(slot));
}

export function listSlots(): SlotMeta[] {
  return ([0, 1, 2] as const).map(slot => {
    const state = loadSlot(slot);
    if (!state) return { slot, empty: true };
    return {
      slot,
      empty: false,
      chapterName: state.stageProgress.inChapterRun?.chapterId ?? '基地',
      squadSize: state.squad.length,
      savedAt: state.savedAt,
    };
  });
}
