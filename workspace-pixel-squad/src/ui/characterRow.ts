// Battle HUD row layout — see docs/specs/pixel-squad/battle-hud-retro-reskin.md
//
// Each character row has two x-anchors instead of one:
//   labelX    — fixed, hosts name/archetype text, the HP bar, and HP number.
//   portraitX — offset toward the team's centerline, hosts the sprite, its
//               tap hitbox, animation, and the status/weakness/command icons
//               that should visually track the character, not the label.
export const ROW_LAYOUT = {
  BAR_WIDTH: 50,
  BAR_GAP: 14,
  BAR_HEIGHT: 8,
  PORTRAIT_INSET: 0.75,
} as const;

export interface RowAnchors {
  labelX: number;
  barNearX: number;
  barFarX: number;
  portraitX: number;
}

export function computeRowAnchors(cx: number, isPlayer: boolean): RowAnchors {
  const dir = isPlayer ? 1 : -1;
  const labelX = cx;
  const barNearX = cx + dir * ROW_LAYOUT.BAR_GAP;
  const barFarX = barNearX + dir * ROW_LAYOUT.BAR_WIDTH;
  const portraitX = barNearX + dir * ROW_LAYOUT.BAR_WIDTH * ROW_LAYOUT.PORTRAIT_INSET;
  return { labelX, barNearX, barFarX, portraitX };
}

// V2 layout — tenchi2-style row: stacked name/number on the outer edge,
// a fixed 10-segment HP bar, and the sprite standing on the bar itself.
// See docs/specs/pixel-squad/battle-screen-tenchi2-homage.md "版面配置".
export const ROW_V2 = {
  EDGE_MARGIN: 6, // 名字距畫布邊緣
  NAME_DY: -20, // 名字 y = cy + NAME_DY
  NUMBER_DY: -4, // 兵力數字 y = cy + NUMBER_DY
  BAR_EDGE_INSET: 58, // 血條外側端距畫布邊緣
  SEGMENTS: 10,
  SEGMENT_W: 8,
  SEGMENT_GAP: 1,
  BAR_DY: 18, // 血條上緣 y = cy + BAR_DY
  BAR_HEIGHT: 8,
  SPRITE_INSET: 0.8, // sprite x 在條上靠中線 80% 處
  SPRITE_DY: -10, // sprite 中心 y = cy + SPRITE_DY(44×56,底邊貼條上緣)
  STEP_DX: 12, // 前進一步位移(往中線)
} as const;

export interface RowLayoutV2 {
  nameX: number; // 名字錨點 x
  nameOriginX: 0 | 1; // 我方 0(左對齊)、敵方 1(右對齊)
  barX: number; // 血條最左段的左緣 x
  barWidth: number; // 10 段總寬 = 89
  segmentXs: number[]; // 每段左緣 x,由外側往中線排序(我方遞增、敵方遞減)
  spriteX: number;
  stepDX: number; // 我方 +12、敵方 -12
}

export function computeRowLayoutV2(isPlayer: boolean, canvasWidth: number): RowLayoutV2 {
  const pitch = ROW_V2.SEGMENT_W + ROW_V2.SEGMENT_GAP;
  const barWidth = ROW_V2.SEGMENTS * ROW_V2.SEGMENT_W + (ROW_V2.SEGMENTS - 1) * ROW_V2.SEGMENT_GAP;
  const barX = isPlayer ? ROW_V2.BAR_EDGE_INSET : canvasWidth - ROW_V2.BAR_EDGE_INSET - barWidth;
  const segmentXs = Array.from({ length: ROW_V2.SEGMENTS }, (_, i) =>
    isPlayer ? barX + i * pitch : barX + (ROW_V2.SEGMENTS - 1 - i) * pitch
  );
  const inset = barWidth * ROW_V2.SPRITE_INSET;
  const spriteX = Math.round(isPlayer ? barX + inset : barX + barWidth - inset);
  return {
    nameX: isPlayer ? ROW_V2.EDGE_MARGIN : canvasWidth - ROW_V2.EDGE_MARGIN,
    nameOriginX: isPlayer ? 0 : 1,
    barX,
    barWidth,
    segmentXs,
    spriteX,
    stepDX: isPlayer ? ROW_V2.STEP_DX : -ROW_V2.STEP_DX,
  };
}

export function fillSegments(hp: number, maxHp: number, segments: number): number {
  if (hp <= 0 || maxHp <= 0) return 0;
  return Math.min(segments, Math.max(1, Math.ceil((hp / maxHp) * segments)));
}
