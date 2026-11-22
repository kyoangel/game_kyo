import Phaser from 'phaser';
import { addButton, cssColor, getKit, type Kit, type ResultsContext } from '@gf/game-kit';
import { formatTime, sanitizeOwned } from './format.ts';
import { MEDALS, mergeMedals } from './medals.ts';
import { emptyStats, missionTarget, sanitizeMissions, type Mission } from './missions.ts';
import { sanitizeAssist, sanitizeStartTier } from './progression.ts';
import { RUN_STATE_KEY, type RunState } from './runState.ts';
import { settleRun, type Goal, type Saved, type Settled } from './settle.ts';
import { sanitizeWorkshop } from './workshop.ts';

const EMPTY: RunState = { score: 0, seconds: 0, stars: 0, medals: [], headStart: 0, startTier: 'none', stats: emptyStats() };
const BAR_W = 440;
const BAR_H = 14;

function style(kit: Kit, size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: kit.theme.font, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 5, align: 'center' };
}

function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));
}

function goalName(kit: Kit, g: Goal): string {
  return kit.t(g.kind === 'workshop' ? `upgrade.${g.id}` : `skin.${g.id}`);
}

function goalText(kit: Kit, g: Goal, balance: number): string {
  const ready = balance >= g.cost;
  const vars = { name: goalName(kit, g), lv: g.level, n: Math.max(0, g.cost - balance) };
  const key = g.kind === 'workshop' ? (ready ? 'goalReady' : 'goalMore') : ready ? 'goalSkinReady' : 'goalSkinMore';
  return fill(kit.t(key), vars);
}

/** Results hook: coin breakdown, medals, near-goal bar, missions, rank-up, optional rewarded x2. Lays out in [ctx.top, ~height*0.8]. */
export function ddResults(scene: Phaser.Scene, ctx: ResultsContext): void {
  const kit = getKit(scene);
  const { theme } = kit;
  const cx = scene.scale.width / 2;
  const run = (scene.registry.get(RUN_STATE_KEY) as RunState | undefined) ?? EMPTY;
  const top = ctx.top;

  let bonusHook: ((extra: number) => void) | null = null;

  // Serialize read-modify-write so the x2 bonus never races the first credit.
  let chain: Promise<void> = Promise.resolve();
  const credit = (amount: number): void => {
    if (amount <= 0) return;
    chain = chain.then(async () => {
      const cur = await kit.save.getNumber('coins', 0);
      await kit.save.setNumber('coins', cur + amount);
    });
  };

  // Immediate (no storage needed): coins placeholder, survived, medal slots.
  const coinsText = scene.add.text(cx - 100, top + 28, `+0 ${kit.t('coins')}`, style(kit, 52, 0xffe14d)).setOrigin(0.5);
  scene.add.text(cx, top + 100, `${kit.t('survived')} ${formatTime(run.seconds)}`, style(kit, 30, theme.text)).setOrigin(0.5);

  const slots = scene.add.graphics();
  const slotX = (i: number): number => cx + (i - 1.5) * 100;
  const slotY = top + 150;
  const drawSlots = (owned: Set<string>): void => {
    slots.clear();
    MEDALS.forEach((m, i) => {
      const x = slotX(i);
      const fresh = run.medals.includes(m.id);
      if (owned.has(m.id)) {
        slots.fillStyle(m.color, fresh ? 1 : 0.7);
        slots.fillCircle(x, slotY, 22);
        slots.fillStyle(0xffffff, 0.45);
        slots.fillCircle(x - 7, slotY - 7, 7);
        slots.lineStyle(4, 0xffffff, fresh ? 0.95 : 0.4);
        slots.strokeCircle(x, slotY, 22);
      } else {
        slots.fillStyle(0x1a1033, 0.55);
        slots.fillCircle(x, slotY, 22);
        slots.lineStyle(3, m.color, 0.35);
        slots.strokeCircle(x, slotY, 22);
      }
    });
  };
  drawSlots(new Set(run.medals));
  if (run.medals.length > 0) {
    const names = run.medals.map((id) => kit.t(`medal.${id}`)).join(' + ');
    scene.add.text(cx, top + 190, names, style(kit, 24, theme.accent)).setOrigin(0.5);
  }

  const save = kit.save;
  void Promise.all([
    save.getNumber('coins', 0),
    save.getNumber('lossStreak', 0),
    save.getJSON<unknown>('assist', {}),
    save.getJSON<unknown>('startTier', 'none'),
    save.getJSON<unknown>('medals', []),
    save.getJSON<unknown>('missions', null),
    save.getJSON<unknown>('workshop', {}),
    save.getJSON<unknown>('skins', []),
  ]).then(([coins, streak, rawAssist, rawTier, rawMedals, rawMissions, rawWs, rawSkins]) => {
    const savedMedals = mergeMedals(rawMedals, []);
    const saved: Saved = {
      coins: Math.max(0, Math.floor(coins)),
      lossStreak: Math.max(0, Math.floor(streak)),
      assist: sanitizeAssist(rawAssist),
      startTier: sanitizeStartTier(rawTier, savedMedals),
      medals: savedMedals,
      missions: sanitizeMissions(rawMissions, Math.random),
      workshop: sanitizeWorkshop(rawWs),
      ownedSkins: sanitizeOwned(rawSkins),
    };
    const settled = settleRun(run, saved, Math.random);

    // Persist (coins via credit; medals already saved by PlayScene).
    credit(settled.coin.coins);
    chain = chain.then(async () => {
      await save.setNumber('lossStreak', settled.lossStreak);
      await save.setJSON('assist', settled.assist);
      await save.setJSON('startTier', settled.startTier);
      await save.setJSON('missions', settled.missions.state);
    });

    if (__GK_TEST_HOOKS__) {
      const w = window as unknown as { __dd?: Record<string, unknown> };
      w.__dd = w.__dd ?? {};
      w.__dd.results = {
        coins: settled.coin.coins,
        goal: settled.goal,
        missions: settled.missions.state.active,
        completed: settled.missions.completed.map((m) => m.id),
        lossStreak: settled.lossStreak,
        assist: settled.assist,
        startTier: settled.startTier,
      };
    }

    if (scene.sys.isActive()) render(settled, saved.missions.active);
  });

  function render(s: Settled, before: Mission[]): void {
    const coin = s.coin;
    let shown = coin.coins;
    coinsText.setText(`+${shown} ${kit.t('coins')}`);
    drawSlots(new Set(s.medals));

    if (coin.floorApplied || coin.multiplier > 1) {
      const txt = coin.floorApplied
        ? fill(kit.t('coinsMin'), { n: coin.coins, m: coin.floor })
        : fill(kit.t('coinsMult'), { n: coin.coins, x: coin.multiplier.toFixed(2) });
      scene.add.text(cx, top + 70, txt, style(kit, 24, theme.muted)).setOrigin(0.5);
    }

    // Near-goal bar
    let goalTo = s.goalTo;
    if (s.goal) {
      const g = s.goal;
      const text = scene.add.text(cx, top + 222, goalText(kit, g, s.goalFrom), style(kit, 28, theme.text)).setOrigin(0.5);
      const barY = top + 248;
      const g2 = scene.add.graphics();
      let pulse: Phaser.Tweens.Tween | null = null;
      const paint = (frac: number): void => {
        g2.clear();
        g2.fillStyle(0x1a1033, 0.7);
        g2.fillRoundedRect(cx - BAR_W / 2, barY - BAR_H / 2, BAR_W, BAR_H, 7);
        if (frac > 0) {
          g2.fillStyle(theme.accent, 1);
          g2.fillRoundedRect(cx - BAR_W / 2, barY - BAR_H / 2, Math.max(BAR_H, BAR_W * frac), BAR_H, 7);
        }
      };
      const refresh = (): void => {
        text.setText(goalText(kit, g, goalTo));
        if (goalTo >= g.cost && !pulse) {
          text.setColor(cssColor(theme.accent));
          pulse = scene.tweens.add({ targets: text, alpha: 0.6, scaleX: 1.06, scaleY: 1.06, duration: 450, yoyo: true, repeat: -1 });
        }
      };
      const f0 = Math.min(1, s.goalFrom / g.cost);
      const f1 = Math.min(1, goalTo / g.cost);
      paint(f0);
      scene.tweens.addCounter({
        from: f0, to: f1, duration: 600,
        onUpdate: (tw) => paint(tw.getValue() ?? f1),
        onComplete: () => paint(f1),
      });
      refresh();
      bonusHook = (extra: number): void => {
        goalTo += extra;
        paint(Math.min(1, goalTo / g.cost));
        refresh();
      };
    }

    // Missions
    const doneIds = new Set(s.missions.completed.map((m) => m.id));
    s.missions.state.active.forEach((now, i) => {
      const y = top + 284 + i * 28;
      const old = before[i]!;
      if (doneIds.has(old.id) && !(now.id === old.id && now.tier === old.tier)) {
        const t = scene.add.text(cx, y, `✓ ${kit.t(`mission.${old.id}`)} ${missionTarget(old)}/${missionTarget(old)}  +${old.tier}★`, style(kit, 24, 0x58ff9a)).setOrigin(0.5).setScale(0.4);
        scene.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
        scene.time.delayedCall(1800, () => {
          if (scene.sys.isActive()) t.setText(missionLine(kit, now)).setColor(cssColor(theme.muted)).setAlpha(0.7);
        });
      } else {
        scene.add.text(cx, y, missionLine(kit, now), style(kit, 24, theme.text)).setOrigin(0.5);
      }
    });

    // Rank up
    if (s.missions.rankAfter > s.missions.rankBefore) {
      const rt = scene.add.text(cx, top + 372, fill(kit.t('rankUp'), { n: s.missions.rankAfter }), style(kit, 36, 0xffe14d)).setOrigin(0.5).setScale(0.3);
      scene.tweens.add({ targets: rt, scale: 1, duration: 400, ease: 'Back.Out' });
      kit.fx(scene).burst(cx, top + 372, { color: 0xffe14d, count: 24, speed: 340, lifespanMs: 600 });
      kit.audio.sfx('medal');
    }

    // Rewarded x2
    if (ctx.rewardedAds && coin.coins > 0) {
      let used = false;
      let busy = false;
      const btn = addButton(scene, cx + 200, top + 28, '×2', {
        width: 200, height: 64, fill: theme.accent, textColor: 0x1a1033, fontSize: 34,
        onClick: () => {
          if (used || busy) return;
          busy = true;
          void kit.showRewarded().then((res) => {
            busy = false;
            if (res !== 'rewarded' || used) return;
            used = true;
            credit(coin.coins);
            if (!scene.sys.isActive()) return;
            shown = coin.coins * 2;
            coinsText.setText(`+${shown} ${kit.t('coins')}`);
            bonusHook?.(coin.coins);
            kit.audio.sfx('pickup');
            btn.destroy();
          });
        },
      });
    }
  }
}

function missionLine(kit: Kit, m: Mission): string {
  return `${kit.t(`mission.${m.id}`)} ${Math.min(m.progress, missionTarget(m))}/${missionTarget(m)}`;
}
