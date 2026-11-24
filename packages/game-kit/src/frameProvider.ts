export interface CanvasSize { width: number; height: number }
export type CanvasSizeProvider = (viewW: number, viewH: number) => CanvasSize;

export function resolveCanvasSize(provider: CanvasSizeProvider | undefined, fallback: CanvasSize, viewW: number, viewH: number): CanvasSize {
  if (!provider) return fallback;
  const s = provider(viewW, viewH);
  return Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 0 && s.height > 0 ? s : fallback;
}
