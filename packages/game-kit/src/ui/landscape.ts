import type Phaser from 'phaser';

/** Smallest text size (canvas px) on a landscape canvas: 26 * (450 / 810) = 14.4 css px at an 800x450 iframe. */
export const LANDSCAPE_MIN_FONT = 26;

/** True for a landscape canvas (wider than tall). Pure, so layouts can be unit-tested without Phaser. */
export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

export function sceneIsLandscape(scene: Phaser.Scene): boolean {
  return isLandscape(scene.scale.width, scene.scale.height);
}

/** Font size for the current canvas: unchanged in portrait, never below the landscape floor in landscape. */
export function landscapeFont(size: number, land: boolean): number {
  return land ? Math.max(size, LANDSCAPE_MIN_FONT) : size;
}
