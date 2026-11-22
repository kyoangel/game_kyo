import Phaser from 'phaser';
import { addButton, cssColor, getKit, type Kit, type TitleExtrasContext } from '@gf/game-kit';
import { mergeMedals } from './medals.ts';
import { missionLabel } from './missionLabel.ts';
import { sanitizeMissions, skipCost, skipMission, type MissionState } from './missions.ts';
import { availableTiers, sanitizeStartTier, type StartTier } from './progression.ts';

const TIERS: Array<{ id: StartTier; key: string }> = [
  { id: 'none', key: 'tier.none' },
  { id: 'bronze', key: 'medal.bronze' },
  { id: 'silver', key: 'medal.silver' },
  { id: 'gold', key: 'medal.gold' },
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
  let chain: Promise<void> = Promise.resolve();
  const persist = (fn: () => Promise<void>): void => { chain = chain.then(fn); };

  const txt = (x: number, y: number, s: string, size: number, color: number, ox = 0.5): Phaser.GameObjects.Text => {
    const t = scene.add
      .text(x, y, s, { fontFamily: theme.font, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 4 })
      .setOrigin(ox, 0.5);
    objs.push(t);
    return t;
  };

  const render = (): void => {
    if (!scene.sys.isActive() || !missions) return;
    for (const o of objs) o.destroy();
    objs = [];
    const ms = missions;
    const enabled = availableTiers(medals);

    // Start chips
    const cy = ctx.below + 24;
    TIERS.forEach((tr, i) => {
      const on = enabled.includes(tr.id);
      const sel = on && tier === tr.id;
      const btn = addButton(scene, ctx.width / 2 + (i - 1.5) * 162, cy, kit.t(tr.key), {
        width: 150, height: 44, fontSize: 22,
        fill: sel ? theme.accent : on ? theme.primary : theme.muted,
        textColor: sel ? 0x1a1033 : 0xffffff,
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

    // Missions
    const y0 = ctx.menuBottom + 12;
    // Dark panel keeps the list readable over the falling backdrop blocks.
    const panel = scene.add.graphics().setDepth(1);
    panel.fillStyle(0x1a1033, 0.72);
    panel.fillRoundedRect(12, y0, ctx.width - 24, 3 * 52, 18);
    objs.push(panel);
    ms.active.forEach((m, i) => {
      const y = y0 + 26 + i * 52;
      txt(24, y, '★'.repeat(m.tier), 22, theme.accent, 0);
      txt(100, y, missionLabel(kit.t(`mission.${m.id}`), m, m.progress), 22, theme.text, 0);
      const cost = skipCost(m);
      const afford = coins >= cost;
      const btn = addButton(scene, 640, y, `${kit.t('skip')} ${cost}`, {
        width: 140, height: 40, fontSize: 20,
        fill: afford ? theme.primary : theme.muted,
        onClick: () => {
          const res = skipMission(ms, i, coins, Math.random);
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
      if (!afford) btn.setAlpha(0.6);
      objs.push(btn);
    });

    txt(ctx.width - 24, ctx.menuBottom - 4, kit.t('rank').replace('{n}', String(ms.rank)), 22, theme.muted, 1);
    // Keep extras above the panel and the backdrop blocks that spawn later.
    for (const o of objs) if (o !== panel) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(2);
  };

  void load(kit).then((s) => {
    if (!scene.sys.isActive()) return;
    medals = s.medals;
    tier = s.tier;
    missions = s.missions;
    coins = s.coins;
    if (s.fresh) persist(() => kit.save.setJSON('missions', s.missions));
    render();
  });
}

async function load(kit: Kit): Promise<{ medals: string[]; tier: StartTier; missions: MissionState; coins: number; fresh: boolean }> {
  const [rawMedals, rawTier, rawMissions, coins] = await Promise.all([
    kit.save.getJSON<unknown>('medals', []),
    kit.save.getJSON<unknown>('startTier', 'none'),
    kit.save.getJSON<unknown>('missions', null),
    kit.save.getNumber('coins', 0),
  ]);
  const medals = mergeMedals(rawMedals, []);
  return {
    medals,
    tier: sanitizeStartTier(rawTier, medals),
    missions: sanitizeMissions(rawMissions, Math.random),
    coins: Math.max(0, Math.floor(coins)),
    fresh: rawMissions === null || rawMissions === undefined,
  };
}
