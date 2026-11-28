import type Phaser from 'phaser';

/**
 * Neon night-sky theme (owner pick 2026-11-28): falling obstacles are storm clouds, the player is an original little
 * plane. Shapes are drawn procedurally. A cloud silhouette always stays inside its w x h box (flat-ish bottom, lobes on
 * top), so what you see matches the rectangular hit box.
 */

/** Lobe circles (x, y, r) of a cloud filling the box (x0, y0, w, h); the body is a rounded rect under them. */
export function cloudLobes(x0: number, y0: number, w: number, h: number): { x: number; y: number; r: number }[] {
  const n = Math.max(2, Math.round(w / 38));
  const out: { x: number; y: number; r: number }[] = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    // Puffy middle, smaller edges, slight alternation so it never reads as a row of equal balls.
    const centre = mid === 0 ? 1 : 1 - Math.abs(i - mid) / mid;
    const r = Math.min(w / 2, h / 2, h * (0.32 + 0.18 * centre + (i % 2 === 0 ? 0.02 : -0.04)));
    const x = x0 + r * 0.8 + ((w - 1.6 * r) * (i + 0.5)) / n;
    // Every lobe sits on the body line (bottom at 0.78 h) and never pokes above y0.
    out.push({ x: Math.min(x0 + w - r, Math.max(x0 + r, x)), y: Math.max(y0 + r, y0 + h * 0.78 - r), r });
  }
  return out;
}

/** Fills the cloud silhouette, grown by `grow` px on every side (for rims and glows). */
export function fillCloud(g: Phaser.GameObjects.Graphics, x0: number, y0: number, w: number, h: number, grow = 0): void {
  const bodyTop = y0 + h * 0.4;
  const bodyH = h - h * 0.4;
  g.fillRoundedRect(x0 - grow, bodyTop - grow, w + grow * 2, bodyH + grow * 2, Math.min(bodyH / 2, 14) + grow);
  for (const l of cloudLobes(x0, y0, w, h)) g.fillCircle(l.x, l.y, l.r + grow);
}

/** Zig-zag lightning bolt centred at (cx, cy), height s. */
export function boltPoints(cx: number, cy: number, s: number): Phaser.Types.Math.Vector2Like[] {
  const k = s / 24;
  return [
    { x: cx + 3 * k, y: cy - 12 * k }, { x: cx - 6 * k, y: cy + 2 * k }, { x: cx - 1 * k, y: cy + 2 * k },
    { x: cx - 4 * k, y: cy + 12 * k }, { x: cx + 6 * k, y: cy - 2 * k }, { x: cx + 1 * k, y: cy - 2 * k },
  ];
}

/** Storm cloud: violet body with a lit top and dark belly, neon rim + glow in `rim`, lightning bolts. */
export function drawStormCloud(g: Phaser.GameObjects.Graphics, x0: number, y0: number, w: number, h: number, rim: number, glowPad: number): void {
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(rim, 0.06 * (5 - i));
    fillCloud(g, x0, y0, w, h, (i * glowPad) / 4);
  }
  g.fillStyle(rim, 1);
  fillCloud(g, x0, y0, w, h, 0);
  g.fillStyle(0x5b3a91, 1);
  fillCloud(g, x0 + 2.5, y0 + 2.5, w - 5, h - 5, 0);
  // Dark belly.
  g.fillStyle(0x2a1347, 0.85);
  g.fillRoundedRect(x0 + 3, y0 + h * 0.62, w - 6, h * 0.38 - 3, Math.min(10, h * 0.19));
  // Lit lobe tops.
  g.fillStyle(0xb9a2ff, 0.55);
  for (const l of cloudLobes(x0 + 2.5, y0 + 2.5, w - 5, h - 5)) g.fillCircle(l.x - l.r * 0.2, l.y - l.r * 0.35, l.r * 0.5);
  // One bolt per ~70 px, in the belly.
  const bolts = Math.max(1, Math.round(w / 70));
  for (let i = 0; i < bolts; i++) {
    const cx = x0 + (w * (i + 0.5)) / bolts;
    const pts = boltPoints(cx, y0 + h * 0.66, h * 0.5);
    g.fillStyle(0xffe14d, 1);
    g.fillPoints(pts, true);
    g.lineStyle(1.5, 0xffffff, 0.9);
    g.strokePoints(pts, true);
  }
}

/** Harmless fluffy cloud (Chomp mode: edible). */
export function drawFluffyCloud(g: Phaser.GameObjects.Graphics, x0: number, y0: number, w: number, h: number, body: number, glow: number, glowPad: number): void {
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(glow, 0.08 * (5 - i));
    fillCloud(g, x0, y0, w, h, (i * glowPad) / 4);
  }
  g.fillStyle(glow, 1);
  fillCloud(g, x0, y0, w, h, 0);
  g.fillStyle(body, 1);
  fillCloud(g, x0 + 2.5, y0 + 2.5, w - 5, h - 5, 0);
  g.fillStyle(0xffffff, 0.55);
  for (const l of cloudLobes(x0 + 3, y0 + 3, w - 6, h - 6)) g.fillCircle(l.x - l.r * 0.25, l.y - l.r * 0.3, l.r * 0.4);
}

/**
 * Original little plane, nose up, in `fill`, drawn into a 64 x 64 box: round fuselage with a bubble canopy, swept
 * wings with rounded tips, a small twin tail. `emblem` marks the skin (its former shape) on the fuselage.
 */
export function drawPlane(g: Phaser.GameObjects.Graphics, fill: number, emblem: string): void {
  const c = 32;
  const wing: Phaser.Types.Math.Vector2Like[] = [
    { x: c - 6, y: 26 }, { x: 6, y: 38 }, { x: 4, y: 42 }, { x: 8, y: 45 }, { x: c - 6, y: 41 },
    { x: c + 6, y: 41 }, { x: 56, y: 45 }, { x: 60, y: 42 }, { x: 58, y: 38 }, { x: c + 6, y: 26 },
  ];
  const tail: Phaser.Types.Math.Vector2Like[] = [
    { x: c - 4, y: 48 }, { x: 18, y: 56 }, { x: 19, y: 60 }, { x: c, y: 57 }, { x: 45, y: 60 }, { x: 46, y: 56 }, { x: c + 4, y: 48 },
  ];
  g.lineStyle(3, 0xffffff, 0.95);
  g.fillStyle(fill, 1);
  g.fillPoints(tail, true);
  g.strokePoints(tail, true);
  g.fillPoints(wing, true);
  g.strokePoints(wing, true);
  // Fuselage: capsule from the nose (y 4) to the tail (y 58).
  g.fillRoundedRect(c - 9, 4, 18, 54, 9);
  g.strokeRoundedRect(c - 9, 4, 18, 54, 9);
  // Wing stripes.
  g.fillStyle(0xffffff, 0.35);
  g.fillPoints([{ x: 12, y: 39 }, { x: c - 10, y: 32 }, { x: c - 10, y: 35 }, { x: 11, y: 42 }], true);
  g.fillPoints([{ x: 52, y: 39 }, { x: c + 10, y: 32 }, { x: c + 10, y: 35 }, { x: 53, y: 42 }], true);
  // Canopy.
  g.fillStyle(0x1a1033, 1);
  g.fillEllipse(c, 18, 11, 16);
  g.fillStyle(0xb8f6ff, 1);
  g.fillEllipse(c, 17, 8, 12);
  g.fillStyle(0xffffff, 0.9);
  g.fillEllipse(c - 1.5, 14, 3, 5);
  // Emblem.
  g.fillStyle(0x1a1033, 0.8);
  const y = 40;
  switch (emblem) {
    case 'circle': g.fillCircle(c, y, 4); break;
    case 'triangle': g.fillTriangle(c, y - 5, c + 5, y + 4, c - 5, y + 4); break;
    case 'diamond': g.fillPoints([{ x: c, y: y - 5 }, { x: c + 4, y }, { x: c, y: y + 5 }, { x: c - 4, y }], true); break;
    case 'hexagon': g.fillPoints([0, 1, 2, 3, 4, 5].map((i) => ({ x: c + 4.5 * Math.cos((i * Math.PI) / 3), y: y + 4.5 * Math.sin((i * Math.PI) / 3) })), true); break;
    case 'star': g.fillPoints([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
      const r = i % 2 === 0 ? 5.5 : 2.4;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      return { x: c + r * Math.cos(a), y: y + r * Math.sin(a) };
    }), true); break;
    default: g.fillRect(c - 3.5, y - 3.5, 7, 7);
  }
}

/** Exhaust flame (white core, yellow, orange), pointing down, 24 x 40 box. */
export function drawFlame(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xff7a2e, 0.5);
  g.fillEllipse(12, 16, 22, 32);
  g.fillStyle(0xffa14d, 1);
  g.fillTriangle(3, 8, 21, 8, 12, 38);
  g.fillEllipse(12, 8, 18, 12);
  g.fillStyle(0xffe14d, 1);
  g.fillTriangle(6, 8, 18, 8, 12, 28);
  g.fillEllipse(12, 8, 12, 9);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(12, 7, 6, 7);
}
