import Phaser from 'phaser';
import { cssColor, type Kit } from '@gf/game-kit';
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

/** Y of the first content row below the header and tabs. */
export const PANEL_TOP = 252;

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
