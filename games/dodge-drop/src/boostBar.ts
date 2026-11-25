import Phaser from 'phaser';
import { artImage } from './art.ts';
import { addButton, cssColor, textResolution, type Kit } from '@gf/game-kit';
import { boostIconKey, ensureUiTextures } from './playArt.ts';
import { BOOST_COSTS, BOOST_IDS, canBuyBoost, canToggleBoost, type BoostId, type RunBoosts } from './boosts.ts';

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
  /** Landscape: stack the buttons vertically (first at `y`, label above it), with bigger text. */
  vertical?: { step: number; width: number; fontSize: number };
  /** Tap on a boost button: buy it, or undo an equipped one (see toggleBoost). */
  onToggle: (id: BoostId) => void;
}

/**
 * Renders the 3-button single-run boost bar. Tapping an equipped boost undoes it for a full refund.
 * Returns all created GameObjects so callers can destroy/re-render cleanly.
 */
export function renderBoostBar(scene: Phaser.Scene, kit: Kit, opts: BoostBarOpts): Phaser.GameObjects.GameObject[] {
  const { theme } = kit;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const depth = opts.depth ?? 2;
  ensureUiTextures(scene);

  if (opts.showLabel) {
    const lbl = scene.add
      .text(opts.cx, opts.y - (opts.vertical ? 56 : 44), kit.t('boostsLabel'), {
        fontFamily: theme.font,
        fontSize: `${opts.vertical ? opts.vertical.fontSize : 22}px`,
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

  const vert = opts.vertical;
  const btnW = vert ? vert.width : 208;
  const btnH = opts.height ?? 54;
  const step = vert ? vert.step : 220;

  BOOST_IDS.forEach((id, i) => {
    const bx = vert ? opts.cx : opts.cx + (i - 1) * step;
    const by = vert ? opts.y + i * step : opts.y;
    const cost = BOOST_COSTS[id];
    const canBuy = canBuyBoost(opts.boosts, id, opts.coins, opts.shieldCap);
    const canToggle = canToggleBoost(opts.boosts, id, opts.coins, opts.shieldCap);
    const equipped =
      id === 'shield' ? opts.boosts.shields > 0 : id === 'shrink' ? opts.boosts.shrink : opts.boosts.chomp;
    const maxed =
      id === 'shield' ? opts.boosts.shields >= opts.shieldCap : equipped;

    const name = kit.t(`boost.${id}`);
    const countTag = id === 'shield' ? ` ${opts.boosts.shields}/${opts.shieldCap}` : '';
    const showCost = !(id === 'shield' ? maxed : equipped);
    const label = showCost ? `${name}${countTag} ${cost}` : `${name}${countTag}`;

    const fill = equipped ? theme.accent : canBuy ? theme.primary : theme.muted;
    const textColor = equipped ? 0x1a1033 : 0xffffff;
    const btn = addButton(scene, bx, by, label, {
      width: btnW,
      height: btnH,
      fontSize: vert ? vert.fontSize : 20,
      fill,
      textColor,
      strokeThickness: equipped ? 0 : 4,
      onClick: () => {
        if (!canToggle) return;
        opts.onToggle(id);
      },
    });
    // Drawn icons (no emoji: some Android fonts render them as boxes). Label shifts right to make room.
    const text = btn.list[1] as Phaser.GameObjects.Text;
    text.x += showCost ? 6 : 14;
    const icon = artImage(scene, -btnW / 2 + 24, 0, maxed ? 'dd-check' : boostIconKey(id));
    icon.setDisplaySize(btnH * 0.58, btnH * 0.58);
    btn.add(icon);
    if (showCost) {
      const star = artImage(scene, text.x + text.width / 2 + 12, 0, 'dd-star').setDisplaySize(vert ? 26 : 20, vert ? 26 : 20);
      btn.add(star);
    }
    if (!canBuy && !equipped) btn.setAlpha(0.55);
    btn.setDepth(depth);
    objs.push(btn);
  });

  return objs;
}
