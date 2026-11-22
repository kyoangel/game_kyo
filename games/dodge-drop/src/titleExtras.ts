import Phaser from 'phaser';
import { addButton, cssColor, getKit, textResolution, type Kit, type TitleExtrasContext } from '@gf/game-kit';
import { renderBoostBar } from './boostBar.ts';
import { buyBoost, emptyBoosts, sanitizeBoosts, type RunBoosts } from './boosts.ts';
import { mergeMedals } from './medals.ts';
import { missionLabel } from './missionLabel.ts';
import {
  allDone, localDay, missionReward, missionTarget, msUntilReset, rankProgress, sanitizeMissions, swapCost, swapMission, type MissionState,
} from './missions.ts';
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

  const txt = (x: number, y: number, s: string, size: number, color: number, ox = 0.5): Phaser.GameObjects.Text => {
    const t = scene.add
      .text(x, y, s, { fontFamily: theme.font, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 4 })
      .setOrigin(ox, 0.5);
    t.setResolution(textResolution(scene));
    objs.push(t);
    return t;
  };

  const toast = (msg: string): void => {
    const t = scene.add
      .text(ctx.width / 2, ctx.below - 70, msg, { fontFamily: theme.font, fontSize: '24px', fontStyle: 'bold', color: cssColor(theme.danger), stroke: '#1a1033', strokeThickness: 5 })
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

    // Top-left star coin balance (mirrors mute/fullscreen buttons at y = 60 on the right).
    const balIcon = drawCurrencyIcon(scene, 42, 60, 38).setDepth(2);
    objs.push(balIcon);
    txt(70, 60, String(coins), 32, 0xffe14d, 0);

    // Single-run quick-buy boost strip between Title (0.30) and Tap to Start (0.55).
    const barObjs = renderBoostBar(scene, kit, {
      cx: ctx.width / 2,
      y: Math.round(ctx.height * 0.45),
      coins,
      boosts,
      shieldCap,
      depth: 2,
      showLabel: true,
      onBuy: (id) => {
        const res = buyBoost({ coins, boosts, shieldCap }, id);
        if (!res.ok) return;
        coins = res.coins;
        boosts = res.boosts;
        const c = res.coins;
        const b = res.boosts;
        kit.audio.sfx('pickup');
        persist(async () => {
          await kit.save.setNumber('coins', c);
          await kit.save.setJSON('boosts', b);
        });
        render();
      },
    });
    objs.push(...barObjs);

    // Start chips
    const cy = ctx.below + 24;
    TIERS.forEach((tr, i) => {
      const on = enabled.includes(tr.id);
      const sel = on && tier === tr.id;
      const btn = addButton(scene, ctx.width / 2 + (i - 1.5) * 162, cy, kit.t(tr.key), {
        width: 150, height: 44, fontSize: 20,
        fill: sel ? theme.accent : on ? theme.primary : theme.muted,
        textColor: sel ? 0x1a1033 : 0xffffff,
        // a dark stroke on dark text smears into a blurry blob: selected chips have no stroke
        strokeThickness: sel ? 0 : 4,
        onClick: () => {
          if (!on || tier === tr.id) return;
          tier = tr.id;
          const v = tr.id;
          persist(() => kit.save.setJSON('startTier', v));
          render();
        },
      });
      if (!on) btn.setAlpha(0.4);
      objs.push(btn);
    });

    // Control chips (Drag / Tilt): only on devices that can really deliver tilt readings.
    if (__GK_TEST_HOOKS__) (window as unknown as { __ddTitle?: object }).__ddTitle = { tiltChip: tiltAvail, control };
    if (tiltAvail) {
      (['drag', 'tilt'] as const).forEach((id, i) => {
        const sel = control === id;
        const btn = addButton(scene, ctx.width / 2 + (i - 0.5) * 136, ctx.below - 22, kit.t(`control.${id}`), {
          width: 126, height: 40, fontSize: 20,
          fill: sel ? theme.accent : theme.primary,
          textColor: sel ? 0x1a1033 : 0xffffff,
          strokeThickness: sel ? 0 : 4,
          onClick: () => {
            if (id === 'drag') {
              if (control === 'drag') return;
              control = 'drag';
              persist(() => kit.save.setJSON('control', 'drag'));
              render();
              return;
            }
            // Must be called synchronously from this tap: iOS only shows its motion prompt from a user gesture.
            void requestTilt(browserTiltEnv()).then((ok) => {
              if (!scene.sys.isActive()) return;
              if (ok) {
                control = 'tilt';
                persist(() => kit.save.setJSON('control', 'tilt'));
              } else {
                control = 'drag';
                tiltAvail = false;
                persist(() => kit.save.setJSON('control', 'drag'));
                toast(kit.t('tiltFailed'));
              }
              render();
            });
          },
        });
        objs.push(btn);
      });
    }

    // Missions
    const y0 = ctx.menuBottom + 12;
    // Dark panel keeps the list readable over the falling backdrop blocks.
    const panel = scene.add.graphics().setDepth(1);
    panel.fillStyle(0x1a1033, 0.72);
    panel.fillRoundedRect(6, y0, ctx.width - 12, 3 * 52, 18);
    objs.push(panel);
    const cost = swapCost(ms);
    ms.active.forEach((m, i) => {
      const y = y0 + 26 + i * 52;
      const done = m.done === true;
      // Difficulty: 1-3 small dots (drawn). A star always means currency.
      for (let k = 0; k <= m.tier - 1; k++) {
        panel.fillStyle(done ? 0x58ff9a : theme.accent, 1);
        panel.fillCircle(30 + k * 14, y, 5);
      }
      if (done) {
        objs.push(scene.add.image(100, y, 'dd-check-green').setDisplaySize(26, 26));
      }
      txt(done ? 120 : 98, y, missionLabel(kit.t(`mission.${m.id}`), m, done ? missionTarget(m) : m.progress), 21, done ? 0x58ff9a : theme.text, 0);
      // Reward in star coins.
      const rw = txt(548, y, `+${missionReward(m)}`, 22, 0xffe14d, 1);
      objs.push(drawCurrencyIcon(scene, rw.x + 17, y, 24));
      if (done) return;
      const afford = coins >= cost;
      const free = cost === 0;
      const btn = addButton(scene, 648, y, free ? kit.t('swapFree') : kit.t('skip') + ' ' + cost, {
        width: 124, height: 40, fontSize: free ? 19 : 20,
        fill: free ? theme.accent : afford ? theme.primary : theme.muted,
        textColor: free ? 0x1a1033 : 0xffffff,
        strokeThickness: free ? 0 : 4,
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
      if (!free) {
        const text = btn.list[1] as Phaser.GameObjects.Text;
        text.x -= 11;
        btn.add(scene.add.image(text.x + text.width / 2 + 13, 0, 'dd-star').setDisplaySize(20, 20));
      }
      if (!afford) btn.setAlpha(0.6);
      objs.push(btn);
    });

    const rp = rankProgress(ms.stars);
    txt(ctx.width - 24, ctx.menuBottom - 4, kit.t('rank').replace('{n}', String(ms.rank)).replace('{a}', String(rp.have)).replace('{b}', String(rp.need)), 22, theme.muted, 1);
    if (allDone(ms)) {
      const left = Math.max(0, msUntilReset(new Date()));
      const h = Math.floor(left / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      const pad = (n: number): string => String(n).padStart(2, '0');
      const msg = kit.t('comeBack').replace('{h}', String(h)).replace('{m}', String(m)).replace('{hh}', pad(h)).replace('{mm}', pad(m));
      txt(ctx.width / 2, y0 + 3 * 52 + 30, msg, 22, theme.accent);
    }
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
  const missions = sanitizeMissions(rawMissions, Math.random, localDay(new Date()));
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
