import { describe, it, expect } from 'vitest';
import { computeRowAnchors, ROW_LAYOUT } from '../../src/ui/characterRow';

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
