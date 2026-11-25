import Phaser from 'phaser';
import { artImage } from './art.ts';
import { addButton } from '@gf/game-kit';
import { BOOST_COSTS, BOOST_IDS, buyBoost, canBuyBoost } from './boosts.ts';
import { boostIconKey, drawCurrencyIcon } from './playArt.ts';
import { fitText, shopGrid, shopStyle, type ShopCtx } from './shopTypes.ts';
import { shieldCapacity } from './workshop.ts';

const ROW_Y0 = 300;
const ROW_STEP = 134;

/** Boosts tab: the 3 next-run boosts with icon, name, description, price and owned state. */
export function renderBoostsPanel(ctx: ShopCtx): void {
  const { scene, kit, state } = ctx;
  const { theme } = kit;
  const shieldCap = shieldCapacity(state.workshop.shieldStack);
  const grid = shopGrid(scene, ROW_Y0, ROW_STEP);
  const { fs } = grid;
  BOOST_IDS.forEach((id, i) => {
    const y = grid.y(i);
    const ox = grid.ox(i);
    const b = state.boosts;
    const maxed = id === 'shield' ? b.shields >= shieldCap : id === 'shrink' ? b.shrink : b.chomp;
    const has = id === 'shield' ? b.shields > 0 : id === 'shrink' ? b.shrink : b.chomp;
    const canBuy = canBuyBoost(b, id, state.coins, shieldCap);

    const bg = ctx.add(scene.add.graphics());
    bg.fillStyle(0x1a1033, 0.7);
    bg.fillRoundedRect(20 + ox, y - grid.rowH / 2, 680, grid.rowH, 22);
    bg.lineStyle(3, theme.primary, 0.45);
    bg.strokeRoundedRect(20 + ox, y - grid.rowH / 2, 680, grid.rowH, 22);
    ctx.add(artImage(scene, 84 + ox, y, boostIconKey(id)).setDisplaySize(84, 84));

    const tag = id === 'shield' ? `  (${b.shields}/${shieldCap})` : '';
    ctx.add(scene.add.text(150 + ox, y - (grid.land ? 52 : 28), `${kit.t(`boost.${id}`)}${tag}`, shopStyle(kit, 32, theme.text)).setOrigin(0, 0.5));
    // Ends at x=480, >= 16 px clear of the price button (left edge 515).
    ctx.add(fitText(scene, kit, 150 + ox, y + (grid.land ? 14 : 20), kit.t(`boostDesc.${id}`), theme.muted, { size: fs(20), minSize: fs(15), maxWidth: 330, maxLines: grid.land ? 3 : 2 }));

    if (maxed) {
      ctx.add(scene.add.image(600 + ox, y - 14, 'dd-check-green').setDisplaySize(36, 36));
      ctx.add(scene.add.text(600 + ox, y + 22, kit.t('boostReady'), { ...shopStyle(kit, fs(22), 0x58ff9a), strokeThickness: 3 }).setOrigin(0.5));
      return;
    }
    const shift = grid.land && has ? -13 : 0;
    ctx.add(addButton(scene, 600 + ox, y + shift, String(BOOST_COSTS[id]), {
      width: 170, height: grid.land && has ? 66 : 80, fontSize: 38,
      fill: canBuy ? theme.primary : theme.muted,
      textColor: canBuy ? 0xffe14d : 0xaaaaaa,
      onClick: () => {
        const res = buyBoost({ coins: state.coins, boosts: state.boosts, shieldCap }, id);
        if (!res.ok) return;
        state.coins = res.coins;
        state.boosts = res.boosts;
        const coins = res.coins;
        const boosts = res.boosts;
        kit.audio.sfx('pickup');
        ctx.persist(async () => {
          await kit.save.setNumber('coins', coins);
          await kit.save.setJSON('boosts', boosts);
        });
        ctx.refresh();
      },
    }));
    ctx.add(drawCurrencyIcon(scene, 541 + ox, y + shift, 34)).setDepth(3);
    if (has) ctx.add(scene.add.text(600 + ox, y + (grid.land ? 46 : 52), kit.t('boostReady'), { ...shopStyle(kit, fs(16), 0x58ff9a), strokeThickness: 2 }).setOrigin(0.5));
  });
}
