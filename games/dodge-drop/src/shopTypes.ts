import Phaser from 'phaser';
import { cssColor, landscapeFont, sceneIsLandscape, type Kit } from '@gf/game-kit';
import type { RunBoosts } from './boosts.ts';
import type { Workshop } from './workshop.ts';

export type ShopTab = 'upgrades' | 'skins' | 'boosts';
export const SHOP_TABS: readonly ShopTab[] = ['upgrades', 'skins', 'boosts'];

export function sanitizeShopTab(raw: unknown): ShopTab {
  return SHOP_TABS.includes(raw as ShopTab) ? (raw as ShopTab) : 'upgrades';
}

export interface ShopState {
  coins: number;
  workshop: Workshop;
  owned: string[];
  selected: string;
  boosts: RunBoosts;
}

/** What each Shop tab panel gets: the scene, shared mutable state, and hooks to track objects and re-render. */
export interface ShopCtx {
  scene: Phaser.Scene;
  kit: Kit;
  state: ShopState;
  /** Track an object so the next refresh destroys it. */
  add<T extends Phaser.GameObjects.GameObject>(o: T): T;
  /** Re-render the whole shop (balance + active tab). */
  refresh(): void;
  /** Serialize storage writes. */
  persist(fn: () => Promise<void>): void;
}

/** Y of the first content row below the header and tabs (portrait). */
export const PANEL_TOP = 252;

/**
 * Where the i-th card of a list tab goes. Portrait: one column (rows 134 apart from `rowY0`).
 * Landscape (1440x810): two 680-wide columns starting under the single header row, with a legibility font floor.
 */
export interface ShopGrid {
  land: boolean;
  /** X offset to add to the portrait x of card i. */
  ox(i: number): number;
  /** Centre Y of card i. */
  y(i: number): number;
  /** Font size honouring the landscape floor. */
  fs(size: number): number;
  /** Card height (landscape cards are taller so 26 px descriptions can take three lines). */
  rowH: number;
}
export const SHOP_LAND_ROW0 = 210;
export const SHOP_LAND_COL = 720;
export const SHOP_LAND_STEP = 152;
export function shopGrid(scene: Phaser.Scene, rowY0: number, step = 134): ShopGrid {
  const land = sceneIsLandscape(scene);
  return {
    land,
    ox: (i) => (land ? (i % 2) * SHOP_LAND_COL : 0),
    y: (i) => (land ? SHOP_LAND_ROW0 + Math.floor(i / 2) * SHOP_LAND_STEP : rowY0 + i * step),
    rowH: land ? 142 : 124,
    fs: (size) => landscapeFont(size, land),
  };
}

export function shopStyle(kit: Kit, size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: kit.theme.font, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 5, align: 'center' };
}

/**
 * Wrapped description text that never runs past `maxWidth` and never takes more than `maxLines` lines:
 * the font shrinks (down to `minSize`) until it fits.
 */
export function fitText(
  scene: Phaser.Scene, kit: Kit, x: number, y: number, str: string, color: number,
  opts: { size: number; minSize: number; maxWidth: number; maxLines: number; twoLineSize?: number },
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, { ...shopStyle(kit, opts.size, color), align: 'left', strokeThickness: 3, wordWrap: { width: opts.maxWidth, useAdvancedWrap: true } }).setOrigin(0, 0.5);
  let size = opts.size;
  while (size > opts.minSize && t.getWrappedText().length > opts.maxLines) {
    size -= 1;
    t.setFontSize(size);
  }
  // Two lines are taller: use the smaller two-line size when it still keeps the text within maxLines.
  if (opts.twoLineSize && t.getWrappedText().length > 1 && size > opts.twoLineSize) {
    t.setFontSize(opts.twoLineSize);
    size = opts.twoLineSize;
    while (size > opts.minSize && t.getWrappedText().length > opts.maxLines) {
      size -= 1;
      t.setFontSize(size);
    }
  }
  return t;
}
