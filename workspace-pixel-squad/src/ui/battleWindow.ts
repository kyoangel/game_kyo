// tenchi2-style double-line white window frame.
// See docs/specs/pixel-squad/battle-screen-tenchi2-homage.md "底部視窗帶".

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowFrame {
  bg: FrameRect;
  outer: FrameRect;
  inner: FrameRect;
}

export function windowFrameRects(x: number, y: number, w: number, h: number): WindowFrame {
  return {
    bg: { x, y, w, h },
    outer: { x: x + 1, y: y + 1, w: w - 2, h: h - 2 },
    inner: { x: x + 5, y: y + 5, w: w - 10, h: h - 10 },
  };
}

export function drawWindow(g: Phaser.GameObjects.Graphics, f: WindowFrame): void {
  g.fillStyle(0x000000, 1);
  g.fillRect(f.bg.x, f.bg.y, f.bg.w, f.bg.h);
  g.lineStyle(2, 0xffffff, 1);
  g.strokeRect(f.outer.x, f.outer.y, f.outer.w, f.outer.h);
  g.lineStyle(1, 0xffffff, 1);
  g.strokeRect(f.inner.x, f.inner.y, f.inner.w, f.inner.h);
}
