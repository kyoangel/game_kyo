/**
 * Simple geometric enemy portraits (spec 5.2), drawn straight onto a canvas.
 * No DOM access: callers pass the 2D context and the square size in pixels.
 */
import type { EnemyShape } from "./enemies";

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, sides: number, rotation: number): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function eyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, spread: number, radius: number): void {
  [-1, 1].forEach((side) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx + side * spread, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(cx + side * spread, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Draw `shape` filled with `color` inside a `size` x `size` box at the origin.
 * `time` (ms) makes it bob gently; pass 0 for a still frame.
 */
export function drawEnemyArt(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape,
  color: string,
  size: number,
  time = 0,
): void {
  const c = size / 2;
  const r = size * 0.38;
  const bob = Math.sin(time / 350) * size * 0.02;
  ctx.save();
  ctx.translate(0, bob);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (shape) {
    case "circle":
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();
      eyes(ctx, c, c - r * 0.1, r * 0.35, r * 0.2);
      break;
    case "square":
      ctx.beginPath();
      ctx.roundRect(c - r, c - r, r * 2, r * 2, size * 0.06);
      ctx.fill();
      eyes(ctx, c, c - r * 0.1, r * 0.4, r * 0.2);
      break;
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(c, c - r * 1.05);
      ctx.lineTo(c + r * 1.05, c + r * 0.85);
      ctx.lineTo(c - r * 1.05, c + r * 0.85);
      ctx.closePath();
      ctx.fill();
      eyes(ctx, c, c + r * 0.2, r * 0.3, r * 0.17);
      break;
    case "snowflake":
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI) / 3;
        ctx.moveTo(c - r * Math.cos(angle), c - r * Math.sin(angle));
        ctx.lineTo(c + r * Math.cos(angle), c + r * Math.sin(angle));
      }
      ctx.stroke();
      eyes(ctx, c, c, r * 0.22, r * 0.14);
      break;
    case "diamond":
      polygon(ctx, c, c, r * 1.1, 4, 0);
      ctx.fill();
      eyes(ctx, c, c, r * 0.3, r * 0.17);
      break;
    case "hexagon":
      polygon(ctx, c, c, r, 6, 0);
      ctx.fill();
      eyes(ctx, c, c - r * 0.05, r * 0.35, r * 0.18);
      break;
    case "spiral":
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI * 4;
        const rad = (t / (Math.PI * 4)) * r;
        const px = c + rad * Math.cos(t + time / 900);
        const py = c + rad * Math.sin(t + time / 900);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    case "shadowSquare":
      ctx.beginPath();
      ctx.roundRect(c - r, c - r, r * 2, r * 2, size * 0.04);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.beginPath();
      ctx.roundRect(c - r * 0.6, c - r * 0.6, r * 1.2, r * 1.2, size * 0.03);
      ctx.stroke();
      eyes(ctx, c, c, r * 0.28, r * 0.15);
      break;
    case "ring":
      ctx.lineWidth = size * 0.12;
      ctx.beginPath();
      ctx.arc(c, c, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(c, c, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}
