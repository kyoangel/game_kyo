import Phaser from 'phaser';
import { addButton } from '@gf/game-kit';
import { drawCurrencyIcon } from './playArt.ts';
import { shopStyle, type ShopCtx } from './shopTypes.ts';
import { buyUpgrade, effectValue, MAX_LEVEL, nextCost, UPGRADE_IDS, type UpgradeId } from './workshop.ts';

const ROW_Y0 = 300;
const ROW_STEP = 134;
const ROW_H = 124;

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
      case 'nearMiss': g.fillTriangle(x, y - 34, x - 12, y + 4, x + 12, y + 4); g.fillTriangle(x, y + 34, x - 12, y - 4, x + 12, y - 4); break;
      case 'combo': g.fillRect(x - 32, y + 8, 16, 24); g.fillRect(x - 8, y - 8, 16, 40); g.fillRect(x + 16, y - 28, 16, 60); break;
      case 'luck': g.fillStyle(0xffe14d, 1); g.fillCircle(x, y, 30); g.fillStyle(0xffffff, 0.5); g.fillCircle(x - 9, y - 9, 8); break;
    }
  }

/** Upgrades tab: the 7 permanent workshop rows. */
export function renderUpgradesPanel(ctx: ShopCtx): void {
  const { scene, kit, state } = ctx;
  const { theme } = kit;
  UPGRADE_IDS.forEach((id, i) => {
    const y = ROW_Y0 + i * ROW_STEP;
    const level = state.workshop[id];
    const cost = nextCost(level);
    const affordable = cost !== null && state.coins >= cost;

    const bg = ctx.add(scene.add.graphics());
    bg.fillStyle(0x1a1033, 0.7);
    bg.fillRoundedRect(20, y - ROW_H / 2, 680, ROW_H, 22);
    bg.lineStyle(3, theme.primary, 0.45);
    bg.strokeRoundedRect(20, y - ROW_H / 2, 680, ROW_H, 22);
    drawIcon(bg, id, 80, y, theme.accent);

    const maxMagnet = id === 'magnet' && level >= MAX_LEVEL;
    const desc = kit.t(maxMagnet ? 'up.magnet.descMax' : `up.${id}.desc`).replace('{v}', String(effectValue(id, level)));
    ctx.add(scene.add.text(150, y - 27, kit.t(`up.${id}.name`), shopStyle(kit, 30, theme.text)).setOrigin(0, 0.5));
    ctx.add(scene.add.text(150, y + 3, desc, { ...shopStyle(kit, 22, theme.muted), strokeThickness: 3 }).setOrigin(0, 0.5));
    for (let k = 0; k < MAX_LEVEL; k++) {
      bg.fillStyle(k < level ? theme.accent : 0x3a2b66, 1);
      bg.fillCircle(159 + k * 26, y + 37, 9);
    }

    if (cost === null) {
      ctx.add(scene.add.text(600, y, kit.t('maxed'), shopStyle(kit, 34, theme.accent)).setOrigin(0.5));
    } else {
      ctx.add(addButton(scene, 600, y, String(cost), {
        width: 170, height: 80, fontSize: 38,
        fill: affordable ? theme.primary : theme.muted,
        textColor: affordable ? 0xffe14d : 0xaaaaaa,
        onClick: () => onBuy(ctx, id, y),
      }));
      ctx.add(drawCurrencyIcon(scene, 541, y, 34)).setDepth(3);
    }
  });
}

function onBuy(ctx: ShopCtx, id: UpgradeId, y: number): void {
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
  kit.fx(ctx.scene).burst(600, y, { color: 0xffe14d, count: 24, speed: 360 });
}
