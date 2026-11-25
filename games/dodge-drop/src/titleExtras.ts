import Phaser from 'phaser';
import { artImage, usedArtKeys } from './art.ts';
import { addButton, cssColor, getKit, landscapeFont, markButtonTap, textResolution, type Kit, type TitleExtrasContext } from '@gf/game-kit';
import { renderBoostBar } from './boostBar.ts';
import { emptyBoosts, toggleBoost, sanitizeBoosts, type RunBoosts } from './boosts.ts';
import { mergeMedals } from './medals.ts';
import { missionLabel } from './missionLabel.ts';
import { missionReward, missionTarget, rankProgress, sanitizeMissions, swapCost, swapMission, type MissionState } from './missions.ts';
import { drawCurrencyIcon, ensureUiTextures } from './playArt.ts';
import { browserTiltEnv, detectTilt, requestTilt } from './tiltSensor.ts';
import { availableTiers, sanitizeStartTier, type StartTier } from './progression.ts';
import { sanitizeWorkshop, shieldCapacity } from './workshop.ts';

const TIERS: Array<{ id: StartTier; key: string }> = [
  { id: 'none', key: 'tier.none' },
  { id: 'bronze', key: 'tierChip.bronze' },
  { id: 'silver', key: 'tierChip.silver' },
  { id: 'gold', key: 'tierChip.gold' },
];

/** Title extras: start-tier chips and the three active missions with skip buttons. */
export function ddTitleExtras(scene: Phaser.Scene, ctx: TitleExtrasContext): void {
  const kit = getKit(scene);
  const { theme } = kit;
  let objs: Phaser.GameObjects.GameObject[] = [];
  let medals: string[] = [];
  let tier: StartTier = 'none';
  let missions: MissionState | null = null;
  let coins = 0;
  let boosts: RunBoosts = emptyBoosts();
  let shieldCap = 1;
  let control: 'drag' | 'tilt' = 'drag';
  let tiltAvail = false;
  let chain: Promise<void> = Promise.resolve();
  const persist = (fn: () => Promise<void>): void => { chain = chain.then(fn); };

  const land = ctx.landscape;
  /** Landscape never goes below the legibility floor; portrait keeps the v2.8.4 sizes. */
  const fs = (size: number): number => landscapeFont(size, land);

  const txt = (x: number, y: number, s: string, size: number, color: number, ox = 0.5): Phaser.GameObjects.Text => {
    const t = scene.add
      .text(x, y, s, { fontFamily: theme.font, fontSize: `${fs(size)}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 4 })
      .setOrigin(ox, 0.5);
    t.setResolution(textResolution(scene));
    objs.push(t);
    return t;
  };

  const toast = (msg: string): void => {
    const t = scene.add
      .text(ctx.width / 2, land ? ctx.menuBottom + 44 : ctx.below - 70, msg, { fontFamily: theme.font, fontSize: `${fs(24)}px`, fontStyle: 'bold', color: cssColor(theme.danger), stroke: '#1a1033', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(5);
    t.setResolution(textResolution(scene));
    scene.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 400, onComplete: () => t.destroy() });
  };

  const render = (): void => {
    if (!scene.sys.isActive() || !missions) return;
    ensureUiTextures(scene);
    for (const o of objs) o.destroy();
    objs = [];
    const ms = missions;
    const enabled = availableTiers(medals);

    // Top-center star coin balance: clear of the site's top-left back icon and the top-right icon buttons.
    const balTxt = txt(0, 60, String(coins), 32, 0xffe14d, 0);
    const balW = 38 + 8 + balTxt.width;
    // Landscape: top of the left column (the centre column holds the title).
    const balX = land ? ctx.left.x0 + 8 : ctx.width / 2 - balW / 2;
    objs.push(drawCurrencyIcon(scene, balX + 19, 60, 38));
    balTxt.setX(balX + 46);

    // Single-run quick-buy boost strip between Title (0.30) and Tap to Start (0.55).
    const leftCx = (ctx.left.x0 + ctx.left.x1) / 2;
    const barObjs = renderBoostBar(scene, kit, {
      cx: land ? leftCx : ctx.width / 2,
      y: land ? Math.round(ctx.extrasTop + 76) : Math.round(ctx.height * 0.45),
      height: land ? 64 : undefined,
      vertical: land ? { step: 72, width: Math.min(420, ctx.left.x1 - ctx.left.x0), fontSize: 26 } : undefined,
      coins,
      boosts,
      shieldCap,
      depth: 2,
      showLabel: true,
      onToggle: (id) => {
        const res = toggleBoost({ coins, boosts, shieldCap }, id);
        if (!res.ok) return;
        coins = res.coins;
        boosts = res.boosts;
        const c = res.coins;
        const b = res.boosts;
        kit.audio.sfx(res.action === 'buy' ? 'pickup' : 'click');
        persist(async () => {
          await kit.save.setNumber('coins', c);
          await kit.save.setJSON('boosts', b);
        });
        render();
      },
    });
    objs.push(...barObjs);

    // Start chips
    // Landscape: 2x2 grid under the boost buttons in the left column.
    const chipCx = (i: number): number => (land ? leftCx + (i % 2 === 0 ? -106 : 106) : ctx.width / 2 + (i - 1.5) * 162);
    const chipCy = (i: number): number => (land ? ctx.extrasTop + 76 + 3 * 72 + 56 + Math.floor(i / 2) * 76 : ctx.below + 24);
    TIERS.forEach((tr, i) => {
      const on = enabled.includes(tr.id);
      const sel = on && tier === tr.id;
      const btn = addButton(scene, chipCx(i), chipCy(i), kit.t(tr.key), {
        width: land ? 204 : 150, height: land ? 62 : 46, fontSize: fs(21),
        fill: sel ? theme.accent : on ? theme.primary : theme.muted,
        textColor: sel ? 0x1a1033 : 0xffffff,
        // a dark stroke on dark text smears into a blurry blob: selected chips have no stroke
        strokeThickness: sel ? 0 : 4,
        onClick: () => {
          if (!on) {
            toast(kit.t(`tierLocked.${tr.id}`));
            return;
          }
          if (tier === tr.id) return;
          tier = tr.id;
          const v = tr.id;
          persist(() => kit.save.setJSON('startTier', v));
          render();
        },
      });
      if (!on) btn.setAlpha(0.4);
      objs.push(btn);
      if (!on) objs.push(drawLock(scene, chipCx(i) + (land ? 86 : 62), chipCy(i) - (land ? 20 : 14)));
    });

    // Tilt on/off icon next to mute/fullscreen: only on devices that can really deliver tilt readings.
    if (__GK_TEST_HOOKS__) (window as unknown as { __ddTitle?: object }).__ddTitle = { tiltToggle: tiltAvail, control };
    if (__GK_TEST_HOOKS__) {
      const w = window as unknown as { __dd?: Record<string, unknown> };
      w.__dd = w.__dd ?? {};
      /** Test hook: every registered texture key (loaded art and generated fallbacks). */
      w.__dd.textures = () => Object.keys(scene.textures.list);
      /** Test hook: art keys actually drawn by this scene. */
      w.__dd.art = () => usedArtKeys(scene);
    }
    if (tiltAvail) {
      const on = control === 'tilt';
      // Flush with the icons actually shown (mute, then fullscreen when available).
      const tiltX = kit.nextTopRightX(ctx.width);
      const g = scene.add.graphics();
      g.fillStyle(0x1a1033, 0.5);
      g.fillCircle(0, 0, 28);
      if (on) {
        g.lineStyle(3, theme.accent, 1);
        g.strokeCircle(0, 0, 28);
      }
      const icon = scene.add.image(0, 0, 'dd-tilt').setDisplaySize(40, 40).setTint(on ? theme.accent : theme.muted).setAlpha(on ? 1 : 0.7);
      const c = scene.add.container(tiltX, 60, [g, icon]);
      c.setSize(76, 76);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        markButtonTap(scene);
        if (control === 'tilt') {
          control = 'drag';
          persist(() => kit.save.setJSON('control', 'drag'));
          render();
          kit.hintBelow(scene, tiltX, 60, kit.t('tiltOff'));
          return;
        }
        // Must be called synchronously from this tap: iOS only shows its motion prompt from a user gesture.
        void requestTilt(browserTiltEnv()).then((ok) => {
          if (!scene.sys.isActive()) return;
          if (ok) {
            control = 'tilt';
            persist(() => kit.save.setJSON('control', 'tilt'));
            kit.hintBelow(scene, tiltX, 60, kit.t('tiltOn'));
          } else {
            control = 'drag';
            tiltAvail = false;
            persist(() => kit.save.setJSON('control', 'drag'));
            toast(kit.t('tiltFailed'));
          }
          render();
        });
      });
      objs.push(c);
    }

    // Missions
    // Dark panel keeps the list readable over the falling backdrop blocks.
    const panel = scene.add.graphics().setDepth(1);
    panel.fillStyle(0x1a1033, 0.72);
    const cost = swapCost();
    // Landscape: the right column, two lines per mission (label, then reward + skip) so nothing is cramped.
    const rowH = land ? 124 : 52;
    const y0 = land ? ctx.extrasTop : ctx.menuBottom + 12;
    const px0 = land ? ctx.right.x0 : 6;
    const pw = land ? ctx.right.x1 - ctx.right.x0 : ctx.width - 12;
    panel.fillRoundedRect(px0, y0, pw, 3 * rowH, 18);
    objs.push(panel);
    ms.active.forEach((m, i) => {
      const y = land ? y0 + 34 + i * rowH : y0 + 26 + i * 52;
      const ry = land ? y + 52 : y;
      // Difficulty: 1-3 small dots (drawn). A star always means currency.
      const dotX = land ? px0 + 26 : 30;
      for (let k = 0; k <= m.tier - 1; k++) {
        panel.fillStyle(theme.accent, 1);
        panel.fillCircle(dotX + k * 14, y, 5);
      }
      txt(land ? px0 + 26 + m.tier * 14 + 14 : 98, y, missionLabel(kit.t(`mission.${m.id}`), m, m.progress), 24, theme.text, 0);
      // Reward in star coins.
      const rw = txt(land ? px0 + 26 : 548, ry, `+${missionReward(m)}`, 24, 0xffe14d, land ? 0 : 1);
      objs.push(drawCurrencyIcon(scene, land ? rw.x + rw.width + 20 : rw.x + 17, ry, fs(24)));
      const afford = coins >= cost;
      const btn = addButton(scene, land ? px0 + pw - 100 - 14 : 648, ry, kit.t('skip') + ' ' + cost, {
        width: land ? 200 : 128, height: land ? 54 : 42, fontSize: fs(22),
        fill: afford ? theme.primary : theme.muted,
        textColor: 0xffffff,
        strokeThickness: 4,
        onClick: () => {
          const res = swapMission(ms, i, coins, Math.random);
          if (!res.ok) return;
          missions = res.state;
          coins = res.coins;
          const st = res.state;
          const c = res.coins;
          persist(async () => {
            await kit.save.setJSON('missions', st);
            await kit.save.setNumber('coins', c);
          });
          render();
        },
      });
      const text = btn.list[1] as Phaser.GameObjects.Text;
      text.x -= 11;
      btn.add(artImage(scene, text.x + text.width / 2 + 13, 0, 'dd-star').setDisplaySize(fs(20), fs(20)));
      if (!afford) btn.setAlpha(0.6);
      objs.push(btn);
    });

    const rp = rankProgress(ms.stars);
    txt(land ? ctx.right.x1 : ctx.width - 24, land ? y0 + 3 * rowH + 30 : ctx.menuBottom - 4, kit.t('rank').replace('{n}', String(ms.rank)).replace('{a}', String(rp.have)).replace('{b}', String(rp.need)), 22, theme.muted, 1);
    // Keep extras above the panel and the backdrop blocks that spawn later.
    for (const o of objs) if (o !== panel) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(2);
  };

  void load(kit).then((s) => {
    if (!scene.sys.isActive()) return;
    medals = s.medals;
    tier = s.tier;
    missions = s.missions;
    coins = s.coins;
    boosts = s.boosts;
    shieldCap = s.shieldCap;
    control = s.control;
    if (s.fresh) persist(() => kit.save.setJSON('missions', s.missions));
    render();
    void detectTilt(browserTiltEnv()).then((d) => {
      if (!scene.sys.isActive() || !d.available) return;
      tiltAvail = true;
      render();
    });
  });
}

/** Small drawn padlock (no emoji/font dependency) for locked start chips. */
function drawLock(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0x1a1033, 0.9);
  g.fillCircle(0, 0, 13);
  g.lineStyle(3, 0xffffff, 1);
  g.beginPath();
  g.arc(0, -2, 5, Math.PI, 0, false);
  g.strokePath();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(-6, -2, 12, 9, 2);
  return g;
}

async function load(kit: Kit): Promise<{
  medals: string[]; tier: StartTier; missions: MissionState; coins: number;
  boosts: RunBoosts; shieldCap: number; fresh: boolean; control: 'drag' | 'tilt';
}> {
  const [rawMedals, rawTier, rawMissions, coins, rawControl, rawWs, rawBoosts] = await Promise.all([
    kit.save.getJSON<unknown>('medals', []),
    kit.save.getJSON<unknown>('startTier', 'none'),
    kit.save.getJSON<unknown>('missions', null),
    kit.save.getNumber('coins', 0),
    kit.save.getJSON<unknown>('control', 'drag'),
    kit.save.getJSON<unknown>('workshop', {}),
    kit.save.getJSON<unknown>('boosts', null),
  ]);
  const medals = mergeMedals(rawMedals, []);
  const shieldCap = shieldCapacity(sanitizeWorkshop(rawWs).shieldStack);
  const missions = sanitizeMissions(rawMissions, Math.random);
  return {
    medals,
    tier: sanitizeStartTier(rawTier, medals),
    missions,
    coins: Math.max(0, Math.floor(coins)),
    boosts: sanitizeBoosts(rawBoosts, shieldCap),
    shieldCap,
    control: rawControl === 'tilt' ? 'tilt' : 'drag',
    fresh: JSON.stringify(rawMissions) !== JSON.stringify(missions),
  };
}
