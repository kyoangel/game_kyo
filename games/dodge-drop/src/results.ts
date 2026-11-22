import Phaser from 'phaser';
import { addButton, cssColor, getKit, type Kit, type ResultsContext } from '@gf/game-kit';
import { renderBoostBar } from './boostBar.ts';
import { buyBoost, sanitizeBoosts, type RunBoosts } from './boosts.ts';
import { formatTime, sanitizeOwned } from './format.ts';
import { MEDALS, mergeMedals } from './medals.ts';
import { drawCurrencyIcon } from './playArt.ts';
import { missionLabel } from './missionLabel.ts';
import { emptyStats, missionTarget, sanitizeMissions, type Mission } from './missions.ts';
import { sanitizeAssist, sanitizeStartTier } from './progression.ts';
import { RUN_STATE_KEY, type RunState } from './runState.ts';
import { settleRun, type Goal, type Saved, type Settled } from './settle.ts';
import { sanitizeWorkshop, shieldCapacity } from './workshop.ts';

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
  const coinsText = scene.add.text(cx - 80, top + 28, `+0 ${kit.t('coins')}`, style(kit, 46, 0xffe14d)).setOrigin(0.5);
  const coinIcon = drawCurrencyIcon(scene, 0, top + 28, 48);
  const setCoins = (n: number): void => {
    coinsText.setText(`+${n} ${kit.t('coins')}`);
    coinIcon.setX(coinsText.x - coinsText.width / 2 - 30);
  };
  setCoins(0);
  scene.add.text(cx, top + 100, `${kit.t('survived')} ${formatTime(run.seconds)}`, style(kit, 30, theme.text)).setOrigin(0.5);

  const slots = scene.add.graphics();
  // six medals in one row (smaller spacing keeps the layout below unchanged)
  const slotX = (i: number): number => cx + (i - (MEDALS.length - 1) / 2) * 108;
  const slotY = top + 156;
  MEDALS.forEach((m, i) => {
    scene.add.text(slotX(i), top + 184, formatTime(m.seconds), style(kit, 18, theme.muted)).setOrigin(0.5);
  });
  const drawSlots = (owned: Set<string>): void => {
    slots.clear();
    MEDALS.forEach((m, i) => {
      const x = slotX(i);
      const fresh = run.medals.includes(m.id);
      const has = owned.has(m.id);
      const a = has ? (fresh ? 1 : 0.7) : 0.4;
      // two-tail ribbon above the disc
      slots.fillStyle(m.color, a);
      slots.fillTriangle(x - 14, slotY - 34, x - 2, slotY - 34, x + 4, slotY - 10);
      slots.fillTriangle(x + 14, slotY - 34, x + 2, slotY - 34, x - 4, slotY - 10);
      if (has) {
        slots.fillStyle(m.color, a);
        slots.fillCircle(x, slotY, 20);
        slots.fillStyle(0xffffff, 0.45);
        slots.fillCircle(x - 6, slotY - 6, 6);
        slots.lineStyle(4, 0xffffff, fresh ? 0.95 : 0.4);
        slots.strokeCircle(x, slotY, 20);
      } else {
        slots.fillStyle(0x1a1033, 0.55);
        slots.fillCircle(x, slotY, 20);
        slots.lineStyle(3, m.color, 0.35);
        slots.strokeCircle(x, slotY, 20);
      }
    });
  };
  drawSlots(new Set(run.medals));
  if (run.medals.length > 0) {
    const names = run.medals.map((id) => kit.t(`medal.${id}`)).join(' + ');
    scene.add.text(cx, top + 208, names, style(kit, 22, theme.accent)).setOrigin(0.5);
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
    save.getJSON<unknown>('boosts', null),
  ]).then(([coins, streak, rawAssist, rawTier, rawMedals, rawMissions, rawWs, rawSkins, rawBoosts]) => {
    const savedMedals = mergeMedals(rawMedals, []);
    const workshop = sanitizeWorkshop(rawWs);
    const shieldCap = shieldCapacity(workshop.shieldStack);
    const saved: Saved = {
      coins: Math.max(0, Math.floor(coins)),
      lossStreak: Math.max(0, Math.floor(streak)),
      assist: sanitizeAssist(rawAssist),
      startTier: sanitizeStartTier(rawTier, savedMedals),
      medals: savedMedals,
      missions: sanitizeMissions(rawMissions, Math.random),
      workshop,
      ownedSkins: sanitizeOwned(rawSkins),
    };
    const settled = settleRun(run, saved, Math.random);
    const initialBoosts = sanitizeBoosts(rawBoosts, shieldCap);

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

    if (scene.sys.isActive()) render(settled, saved.missions.active, initialBoosts, shieldCap);
  });

  function render(s: Settled, before: Mission[], initialBoosts: RunBoosts, shieldCap: number): void {
    const coin = s.coin;
    let shown = coin.coins;
    let liveCoins = s.coinsAfter;
    let liveBoosts = initialBoosts;
    setCoins(shown);
    drawSlots(new Set(s.medals));

    // Top-left live star coin balance so players can immediately see what they can spend on boosts.
    // Dark pill so the paused play HUD (score) never shows through the balance.
    const pill = scene.add.graphics().setDepth(2);
    pill.fillStyle(0x1a1033, 0.92);
    pill.fillRoundedRect(12, 32, 170, 56, 28);
    drawCurrencyIcon(scene, 42, 60, 38).setDepth(2);
    const balText = scene.add.text(70, 60, String(liveCoins), style(kit, 32, 0xffe14d)).setOrigin(0, 0.5).setDepth(2);

    let boostObjs: Phaser.GameObjects.GameObject[] = [];
    const paintBoostBar = (): void => {
      for (const o of boostObjs) o.destroy();
      boostObjs = renderBoostBar(scene, kit, {
        cx,
        // Between the retry hint (0.82H) and Home (0.91H) without touching either.
        y: Math.round(scene.scale.height * 0.858),
        height: 44,
        coins: liveCoins,
        boosts: liveBoosts,
        shieldCap,
        depth: 4,
        showLabel: false,
        onBuy: (id) => {
          const res = buyBoost({ coins: liveCoins, boosts: liveBoosts, shieldCap }, id);
          if (!res.ok) return;
          const delta = res.coins - liveCoins;
          liveCoins = res.coins;
          liveBoosts = res.boosts;
          const nextBoosts = res.boosts;
          balText.setText(String(liveCoins));
          kit.audio.sfx('pickup');
          chain = chain.then(async () => {
            const cur = await save.getNumber('coins', 0);
            await save.setNumber('coins', Math.max(0, cur + delta));
            await save.setJSON('boosts', nextBoosts);
          });
          paintBoostBar();
        },
      });
    };
    paintBoostBar();

    if (coin.floorApplied || coin.multiplier > 1) {
      const txt = coin.floorApplied
        ? fill(kit.t('coinsMin'), { m: coin.floor })
        : fill(kit.t('coinsMult'), { x: coin.multiplier.toFixed(2) });
      scene.add.text(cx, top + 70, txt, style(kit, 24, theme.muted)).setOrigin(0.5);
    }

    // Near-goal bar
    let goalTo = s.goalTo;
    if (s.goal) {
      const g = s.goal;
      const text = scene.add.text(cx, top + 236, goalText(kit, g, s.goalFrom), style(kit, 28, theme.text)).setOrigin(0.5);
      const barY = top + 262;
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

    // Missions: a completed mission stays visible as its check row (replacement is shown on the title).
    const doneIds = new Set(s.missions.completed.map((m) => m.id));
    before.forEach((old, i) => {
      const y = top + 298 + i * 28;
      const target = missionTarget(old);
      if (doneIds.has(old.id)) {
        const label = missionLabel(kit.t(`mission.${old.id}`), old, target);
        const t = scene.add.text(cx, y, `✓ ${label} +${old.tier}★`, style(kit, 24, 0x58ff9a)).setOrigin(0.5).setScale(0.4);
        scene.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
      } else {
        const now = s.missions.state.active[i] ?? old;
        scene.add.text(cx, y, missionLabel(kit.t(`mission.${now.id}`), now, now.progress), style(kit, 24, theme.text)).setOrigin(0.5);
      }
    });

    // Rank up: beside the "Survived" line so it never crowds the retry prompt.
    if (s.missions.rankAfter > s.missions.rankBefore) {
      const rx = cx + 215;
      const ry = top + 100;
      const rt = scene.add.text(rx, ry, fill(kit.t('rankUp'), { n: s.missions.rankAfter }), style(kit, 30, 0xffe14d)).setOrigin(0.5).setScale(0.3);
      scene.tweens.add({ targets: rt, scale: 1, duration: 400, ease: 'Back.Out' });
      kit.fx(scene).burst(rx, ry, { color: 0xffe14d, count: 24, speed: 340, lifespanMs: 600 });
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
            liveCoins += coin.coins;
            balText.setText(String(liveCoins));
            setCoins(shown);
            bonusHook?.(coin.coins);
            paintBoostBar();
            kit.audio.sfx('pickup');
            btn.destroy();
          });
        },
      });
    }
  }
}
