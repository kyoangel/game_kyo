import Phaser from 'phaser';
import { addButton } from '@gf/game-kit';
import { drawCurrencyIcon } from './playArt.ts';
import { fitText, shopGrid, shopStyle, type ShopCtx } from './shopTypes.ts';
import { upgradeDesc } from './upgradeDesc.ts';
import { buyUpgrade, maxLevel, nextCost, UPGRADE_IDS, type UpgradeId } from './workshop.ts';

const ROW_Y0 = 300;
const ROW_STEP = 134;

function drawIcon(g: Phaser.GameObjects.Graphics, id: UpgradeId, x: number, y: number, color: number): void {
    g.lineStyle(7, color, 1);
    g.fillStyle(color, 1);
    switch (id) {
      case 'shield': g.strokeCircle(x, y, 34); break;
      case 'shieldStack': g.strokeCircle(x, y, 34); g.strokeCircle(x, y, 22); g.strokeCircle(x, y, 10); break;
      case 'startShield': g.strokeCircle(x, y, 34); g.strokeCircle(x, y, 18); break;
      case 'magnet':
        g.beginPath(); g.arc(x, y - 4, 28, Math.PI, 0, false); g.strokePath();
        g.fillRect(x - 34, y - 4, 12, 30); g.fillRect(x + 22, y - 4, 12, 30);
        break;
      case 'luck': g.fillStyle(0xffe14d, 1); g.fillCircle(x, y, 30); g.fillStyle(0xffffff, 0.5); g.fillCircle(x - 9, y - 9, 8); break;
      case 'grazeCharge':
        // Graze gauge segments charging a shield ring.
        g.strokeCircle(x + 8, y, 22);
        for (let i = 0; i < 3; i++) g.fillRoundedRect(x - 36 + i * 10, y + 14 - i * 12, 7, 12 + i * 12, 3);
        break;
    }
  }

/** Upgrades tab: the permanent workshop rows. */
export function renderUpgradesPanel(ctx: ShopCtx): void {
  const { scene, kit, state } = ctx;
  const { theme } = kit;
  const grid = shopGrid(scene, ROW_Y0, ROW_STEP);
  const { fs } = grid;
  UPGRADE_IDS.forEach((id, i) => {
    const y = grid.y(i);
    const ox = grid.ox(i);
    const level = state.workshop[id];
    const cost = nextCost(level, maxLevel(id));
    const affordable = cost !== null && state.coins >= cost;

    const bg = ctx.add(scene.add.graphics());
    bg.fillStyle(0x1a1033, 0.7);
    bg.fillRoundedRect(20 + ox, y - grid.rowH / 2, 680, grid.rowH, 22);
    bg.lineStyle(3, theme.primary, 0.45);
    bg.strokeRoundedRect(20 + ox, y - grid.rowH / 2, 680, grid.rowH, 22);
    drawIcon(bg, id, 80 + ox, y, theme.accent);

    const desc = upgradeDesc((k) => kit.t(k), id, level);
    const name = ctx.add(scene.add.text(150 + ox, y - (grid.land ? 52 : 27), kit.t(`up.${id}.name`), shopStyle(kit, fs(30), theme.text)).setOrigin(0, 0.5));
    // Text column ends at x=499, >= 16 px clear of the price button (left edge 515); long text wraps to 2 lines.
    const descText = ctx.add(fitText(scene, kit, 150 + ox, y + (grid.land ? 14 : 7), String(desc), theme.muted, grid.land ? { size: 26, minSize: 26, maxWidth: 349, maxLines: 3 } : { size: 22, minSize: 15, maxWidth: 349, maxLines: 2, twoLineSize: 17 }));
    if (!grid.land && descText.getWrappedText().length > 1) {
      // Two-line description: lift the name a little so the lines clear it and the level dots.
      name.setY(y - 34);
      descText.setY(y + 4);
    }
    for (let k = 0; k < maxLevel(id); k++) {
      bg.fillStyle(k < level ? theme.accent : 0x3a2b66, 1);
      // Landscape: dots sit after the name (the description may need all three lines below it).
      if (grid.land) bg.fillCircle(150 + ox + name.width + 28 + k * 22, y - 52, 8);
      else bg.fillCircle(159 + ox + k * 26, y + 37, 9);
    }

    if (cost === null) {
      ctx.add(scene.add.text(600 + ox, y, kit.t('maxed'), shopStyle(kit, 34, theme.accent)).setOrigin(0.5));
    } else {
      ctx.add(addButton(scene, 600 + ox, y, String(cost), {
        width: 170, height: 80, fontSize: 38,
        fill: affordable ? theme.primary : theme.muted,
        textColor: affordable ? 0xffe14d : 0xaaaaaa,
        onClick: () => onBuy(ctx, id, y, ox),
      }));
      ctx.add(drawCurrencyIcon(scene, 541 + ox, y, 34)).setDepth(3);
    }
  });
}

function onBuy(ctx: ShopCtx, id: UpgradeId, y: number, ox: number): void {
  const { state, kit } = ctx;
  const res = buyUpgrade({ coins: state.coins, levels: state.workshop }, id);
  if (!res.ok) return;
  state.coins = res.coins;
  state.workshop = res.levels;
  const coins = res.coins;
  const levels = res.levels;
  ctx.persist(async () => {
    await kit.save.setNumber('coins', coins);
    await kit.save.setJSON('workshop', levels);
  });
  kit.audio.sfx('pickup');
  ctx.refresh();
  kit.fx(ctx.scene).burst(600 + ox, y, { color: 0xffe14d, count: 24, speed: 360 });
}
