import Phaser from 'phaser';
import { addButton, cssColor, textResolution, type Kit } from '@gf/game-kit';
import { BOOST_COSTS, BOOST_IDS, canBuyBoost, type BoostId, type RunBoosts } from './boosts.ts';

export interface BoostBarOpts {
  cx: number;
  y: number;
  coins: number;
  boosts: RunBoosts;
  shieldCap: number;
  depth?: number;
  /** Button height (default 54). */
  height?: number;
  showLabel?: boolean;
  onBuy: (id: BoostId) => void;
}

/**
 * Renders the 3-button single-run boost bar (Shield 10★, Mini 40★, Chomp 100★).
 * Returns all created GameObjects so callers can destroy/re-render cleanly.
 */
export function renderBoostBar(scene: Phaser.Scene, kit: Kit, opts: BoostBarOpts): Phaser.GameObjects.GameObject[] {
  const { theme } = kit;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const depth = opts.depth ?? 2;

  if (opts.showLabel) {
    const lbl = scene.add
      .text(opts.cx, opts.y - 44, kit.t('boostsLabel'), {
        fontFamily: theme.font,
        fontSize: '20px',
        fontStyle: 'bold',
        color: cssColor(theme.muted),
        stroke: '#1a1033',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(depth);
    lbl.setResolution(textResolution(scene));
    objs.push(lbl);
  }

  const btnW = 208;
  const btnH = opts.height ?? 54;
  const step = 220;

  BOOST_IDS.forEach((id, i) => {
    const bx = opts.cx + (i - 1) * step;
    const cost = BOOST_COSTS[id];
    const canBuy = canBuyBoost(opts.boosts, id, opts.coins, opts.shieldCap);
    const equipped =
      id === 'shield' ? opts.boosts.shields > 0 : id === 'shrink' ? opts.boosts.shrink : opts.boosts.chomp;
    const maxed =
      id === 'shield' ? opts.boosts.shields >= opts.shieldCap : equipped;

    const name = kit.t(`boost.${id}`);
    let label: string;
    if (id === 'shield') {
      const countTag = opts.boosts.shields > 0 ? `×${opts.boosts.shields}` : '';
      label = maxed ? `🛡 ${name}${countTag}` : `🛡 ${name}${countTag} ${cost}★`;
    } else if (id === 'shrink') {
      label = equipped ? `✓ ${name}` : `🔹 ${name} ${cost}★`;
    } else {
      label = equipped ? `✓ ${name}` : `🟡 ${name} ${cost}★`;
    }

    const fill = equipped ? theme.accent : canBuy ? theme.primary : theme.muted;
    const textColor = equipped ? 0x1a1033 : 0xffffff;
    const btn = addButton(scene, bx, opts.y, label, {
      width: btnW,
      height: btnH,
      fontSize: 20,
      fill,
      textColor,
      strokeThickness: equipped ? 0 : 4,
      onClick: () => {
        if (!canBuy) return;
        opts.onBuy(id);
      },
    });
    if (!canBuy && !equipped) btn.setAlpha(0.55);
    btn.setDepth(depth);
    objs.push(btn);
  });

  return objs;
}
