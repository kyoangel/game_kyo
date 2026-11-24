// games/dodge-drop/src/frame.ts
/** Pure viewport -> logical frame model. Field-local coordinates are always 0..FIELD_W. */
export const FIELD_W = 720;
export const FIELD_H = 1280;
export type FrameMode = 'portrait' | 'landscape';

export interface Frame {
  mode: FrameMode;
  /** Logical canvas size. */
  width: number;
  height: number;
  /** Logic play field (always 720x1280; all gameplay maths and fairness use this). */
  fieldW: number;
  fieldH: number;
  /** Camera zoom applied to the field and the on-canvas rectangle it occupies (dispW = fieldW * zoom). */
  zoom: number;
  fieldX: number;
  fieldY: number;
  dispW: number;
  dispH: number;
  playerY: number;
  stripTop: number;
  stripBottom: number;
}

/** Windows wider than this (w/h) get the landscape frame. */
export const LANDSCAPE_MIN_RATIO = 1.15;

const PORTRAIT: Frame = {
  mode: 'portrait', width: 720, height: 1280, fieldX: 0, fieldY: 0, zoom: 1,
  fieldW: FIELD_W, fieldH: FIELD_H, dispW: FIELD_W, dispH: FIELD_H,
  playerY: 1000, stripTop: 1060, stripBottom: 1280,
};
const L_W = 1440;
const L_H = 810;
const L_ZOOM = L_H / FIELD_H;
const LANDSCAPE: Frame = {
  mode: 'landscape', width: L_W, height: L_H, fieldX: (L_W - FIELD_W * L_ZOOM) / 2, fieldY: 0, zoom: L_ZOOM,
  fieldW: FIELD_W, fieldH: FIELD_H, dispW: FIELD_W * L_ZOOM, dispH: L_H,
  playerY: 1000, stripTop: 1060, stripBottom: 1280,
};

export function pickMode(viewW: number, viewH: number, override?: FrameMode): FrameMode {
  if (override) return override;
  if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) return 'portrait';
  return viewW / viewH >= LANDSCAPE_MIN_RATIO ? 'landscape' : 'portrait';
}

export function frameFor(mode: FrameMode): Frame {
  return { ...(mode === 'landscape' ? LANDSCAPE : PORTRAIT) };
}

export function parseLayoutOverride(search: string): FrameMode | undefined {
  const v = new URLSearchParams(search).get('layout');
  return v === 'portrait' || v === 'landscape' ? v : undefined;
}
