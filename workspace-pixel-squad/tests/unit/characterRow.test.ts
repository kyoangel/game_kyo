import { describe, it, expect } from 'vitest';
import { computeRowAnchors, ROW_LAYOUT, computeRowLayoutV2, fillSegments, ROW_V2 } from '../../src/ui/characterRow';

describe('computeRowAnchors', () => {
  it('ally (isPlayer=true): bar and portrait extend rightward (toward centerline)', () => {
    const anchors = computeRowAnchors(90, true);
    expect(anchors.labelX).toBe(90);
    expect(anchors.barNearX).toBe(90 + ROW_LAYOUT.BAR_GAP);
    expect(anchors.barFarX).toBe(90 + ROW_LAYOUT.BAR_GAP + ROW_LAYOUT.BAR_WIDTH);
    expect(anchors.portraitX).toBe(
      90 + ROW_LAYOUT.BAR_GAP + ROW_LAYOUT.BAR_WIDTH * ROW_LAYOUT.PORTRAIT_INSET
    );
  });

  it('enemy (isPlayer=false): bar and portrait extend leftward (toward centerline)', () => {
    const anchors = computeRowAnchors(270, false);
    expect(anchors.labelX).toBe(270);
    expect(anchors.barNearX).toBe(270 - ROW_LAYOUT.BAR_GAP);
    expect(anchors.barFarX).toBe(270 - ROW_LAYOUT.BAR_GAP - ROW_LAYOUT.BAR_WIDTH);
    expect(anchors.portraitX).toBe(
      270 - ROW_LAYOUT.BAR_GAP - ROW_LAYOUT.BAR_WIDTH * ROW_LAYOUT.PORTRAIT_INSET
    );
  });

  it('ally portrait moves toward the centerline relative to labelX', () => {
    const anchors = computeRowAnchors(90, true);
    expect(anchors.portraitX).toBeGreaterThan(anchors.labelX);
  });

  it('enemy portrait moves toward the centerline relative to labelX', () => {
    const anchors = computeRowAnchors(270, false);
    expect(anchors.portraitX).toBeLessThan(anchors.labelX);
  });

  it('neither side crosses the screen centerline (x=180) at BAR_WIDTH=50/BAR_GAP=14', () => {
    const ally = computeRowAnchors(90, true);
    const enemy = computeRowAnchors(270, false);
    expect(ally.barFarX).toBeLessThan(180);
    expect(enemy.barFarX).toBeGreaterThan(180);
  });
});

describe('computeRowLayoutV2', () => {
  const W = 360;
  it('我方:名字左對齊在左緣、血條從 58 起、sprite 在條上 80% 處', () => {
    const r = computeRowLayoutV2(true, W);
    expect(r.nameX).toBe(6);
    expect(r.nameOriginX).toBe(0);
    expect(r.barX).toBe(58);
    expect(r.barWidth).toBe(89); // 10*8 + 9*1
    expect(r.spriteX).toBe(129); // round(58 + 89*0.8)
    expect(r.stepDX).toBe(12);
    expect(r.segmentXs).toHaveLength(10);
    expect(r.segmentXs[0]).toBe(58);            // 最外段
    expect(r.segmentXs[9]).toBe(58 + 9 * 9);    // 最內段(每段間距 9px)
  });
  it('敵方:鏡像', () => {
    const r = computeRowLayoutV2(false, W);
    expect(r.nameX).toBe(354);
    expect(r.nameOriginX).toBe(1);
    expect(r.barX).toBe(213); // 360-58-89
    expect(r.spriteX).toBe(231); // round(360-129.2)
    expect(r.stepDX).toBe(-12);
    expect(r.segmentXs[0]).toBe(213 + 9 * 9); // 最外段=最右段
    expect(r.segmentXs[9]).toBe(213);         // 最內段=最左段
  });
  it('兩側 sprite 不越過中線(含前進一步與前衝 24px)', () => {
    const p = computeRowLayoutV2(true, W);
    const e = computeRowLayoutV2(false, W);
    expect(p.spriteX + p.stepDX + 24 + 22).toBeLessThan(e.spriteX + e.stepDX - 24 - 22 + 44);
  });
});

describe('fillSegments', () => {
  it('滿血 10 段', () => expect(fillSegments(100, 100, 10)).toBe(10));
  it('過半 6 段', () => expect(fillSegments(51, 100, 10)).toBe(6));
  it('殘血至少 1 段', () => expect(fillSegments(1, 9999, 10)).toBe(1));
  it('0 血 0 段', () => expect(fillSegments(0, 100, 10)).toBe(0));
  it('負值視為 0', () => expect(fillSegments(-5, 100, 10)).toBe(0));
  it('溢血封頂', () => expect(fillSegments(150, 100, 10)).toBe(10));
});
