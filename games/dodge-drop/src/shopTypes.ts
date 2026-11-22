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
