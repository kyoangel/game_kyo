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
