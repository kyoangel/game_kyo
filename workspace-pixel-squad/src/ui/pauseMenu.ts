export const PAUSE_OVERLAY_ALPHA = 0.7;
export const PAUSE_OVERLAY_COLOR = 0x000000;

export enum PauseMenuAction {
  Resume = 'resume',
  Restart = 'restart',
  Abandon = 'abandon',
}

export type ButtonVariant = 'active' | 'idle' | 'danger' | 'disabled';

export interface PauseMenuOption {
  action: PauseMenuAction;
  label: string;
  variant: ButtonVariant;
}

export function createPauseMenuOptions(): PauseMenuOption[] {
  return [
    { action: PauseMenuAction.Resume,  label: '繼續',    variant: 'active' },
    { action: PauseMenuAction.Restart, label: '重新開始', variant: 'danger' },
    { action: PauseMenuAction.Abandon, label: '放棄任務', variant: 'danger' },
  ];
}
