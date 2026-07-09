// Procedurally-drawn battlefield terrain strip (no image asset).
// See docs/specs/pixel-squad/battle-screen-tenchi2-homage.md "底部視窗帶".

export interface PatternRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

export function terrainPattern(width: number, topY: number): PatternRect[] {
  const rects: PatternRect[] = [];
  rects.push({ x: 0, y: topY, w: width, h: 24, color: 0x0a2a33 }); // 水帶底色
  rects.push({ x: 0, y: topY + 24, w: width, h: 32, color: 0x3a2416 }); // 地帶底色
  for (let row = 0; row < 2; row++) {
    // 波紋
    const y = topY + 6 + row * 12;
    const offset = row % 2 === 0 ? 0 : 6;
    for (let x = offset; x < width; x += 12) {
      rects.push({ x, y, w: 6, h: 2, color: 0x2e8ba3 });
    }
  }
  for (let row = 0; row < 4; row++) {
    // 碎石棋盤格
    const y = topY + 26 + row * 8;
    for (let col = 0; col < Math.floor(width / 8); col++) {
      if ((row + col) % 2 === 0) continue;
      rects.push({ x: col * 8 + 2, y: y + 2, w: 3, h: 3, color: 0xb0552a });
    }
  }
  return rects;
}

export function drawTerrainStrip(g: Phaser.GameObjects.Graphics, rects: PatternRect[]): void {
  for (const r of rects) {
    g.fillStyle(r.color, 1);
    g.fillRect(r.x, r.y, r.w, r.h);
  }
}
