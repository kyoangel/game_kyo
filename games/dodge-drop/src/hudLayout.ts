import type { Frame } from './frame.ts';

/** Panel text in canvas px: 40 * (450/810) = 22 css px at an 800x450 iframe. */
export const MIN_PANEL_FONT = 40;
/** In-field text in logic px: 40 * zoom 0.633 * 0.556 = 14 css px at 800x450. */
export const MIN_FIELD_FONT = 40;

export interface Anchor { x: number; y: number; originX?: number; panel?: boolean }
export interface HudAnchors {
  score: Anchor; combo: Anchor; timer: Anchor; shields: Anchor; best: Anchor; missions: Anchor;
  mute: { x: number; y: number };
}

export function fieldFont(f: Frame, size: number): number {
  return f.mode === 'landscape' ? Math.max(size, MIN_FIELD_FONT) : size;
}

export function hudAnchors(f: Frame): HudAnchors {
  if (f.mode === 'portrait') {
    return {
      score: { x: 24, y: 18, originX: 0, panel: false },
      combo: { x: 24, y: 76, originX: 0, panel: false },
      timer: { x: f.width - 100, y: 24, originX: 1, panel: false },
      shields: { x: 220, y: 44, originX: 0, panel: false },
      best: { x: 24, y: 120, originX: 0, panel: false },
      missions: { x: f.width / 2, y: 120, originX: 0.5, panel: false },
      mute: { x: f.width - 48, y: 48 },
    };
  }
  const left = 32;
  const rightPanelX = f.fieldX + f.dispW + 32;
  return {
    score: { x: left, y: 40, originX: 0, panel: true },
    combo: { x: left, y: 140, originX: 0, panel: true },
    best: { x: left, y: 250, originX: 0, panel: true },
    timer: { x: f.width - 32, y: 40, originX: 1, panel: true },
    shields: { x: rightPanelX, y: 150, originX: 0, panel: true },
    missions: { x: rightPanelX, y: 280, originX: 0, panel: true },
    mute: { x: f.width - 56, y: f.height - 56 },
  };
}
