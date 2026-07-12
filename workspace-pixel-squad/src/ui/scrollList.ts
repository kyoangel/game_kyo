// Drag-to-scroll math for scene lists whose content can exceed the fixed
// viewport (e.g. BaseScene's squad+bench+supply list, which overflows once
// a full 5-person squad plus bench/inventory rows are all rendered). The
// Phaser wiring (container, mask, pointer events) lives in the scene itself;
// this stays pure so it's testable outside a canvas/WebGL context.

export function computeMaxScroll(contentHeight: number, viewportHeight: number): number {
  return Math.max(0, contentHeight - viewportHeight);
}

export function clampScroll(target: number, maxScroll: number): number {
  return Math.min(Math.max(target, 0), maxScroll);
}
