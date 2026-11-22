import Phaser from 'phaser';
import { addButton, cssColor, getKit, type Kit, type ResultsContext } from '@gf/game-kit';
import { renderBoostBar } from './boostBar.ts';
import { buyBoost, sanitizeBoosts, type RunBoosts } from './boosts.ts';
import { formatTime, sanitizeOwned } from './format.ts';
import { mergeMedals } from './medals.ts';
import { drawCurrencyIcon } from './playArt.ts';
import { emptyStats, sanitizeMissions } from './missions.ts';
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

/**
 * Clean results hook:
 * - Top-left pill shows live star-coin balance + green "+N" gain for this run.
 * - Center shows survived time, optional rank-up, next-goal progress bar, and optional rewarded x2.
 * - Bottom shows the 3-button quick-buy boost bar above the retry hint.
 */
export function ddResults(scene: Phaser.Scene, ctx: ResultsContext): void {
  const kit = getKit(scene);
  const { theme } = kit;
  const cx = scene.scale.width / 2;
  const run = (scene.registry.get(RUN_STATE_KEY) as RunState | undefined) ?? EMPTY;
  const top = ctx.top;

  let bonusHook: ((extra: number) => void) | null = null;

  // Serialize read-modify-write so the x2 bonus and boost buys never race the first credit.
  let chain: Promise<void> = Promise.resolve();
  const credit = (amount: number): void => {
    if (amount <= 0) return;
    chain = chain.then(async () => {
      const cur = await kit.save.getNumber('coins', 0);
      await kit.save.setNumber('coins', cur + amount);
    });
  };

  // Immediate: survived time.
  scene.add.text(cx, top + 20, `${kit.t('survived')} ${formatTime(run.seconds)}`, style(kit, 32, theme.text)).setOrigin(0.5);

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

    // Persist settled progress (coins via credit; medals already saved by PlayScene).
    credit(settled.coin.coins + settled.missionCoins);
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
        missionCoins: settled.missionCoins,
        goal: settled.goal,
        missions: settled.missions.state.active,
        completed: settled.missions.completed.map((m) => m.id),
        lossStreak: settled.lossStreak,
        assist: settled.assist,
        startTier: settled.startTier,
      };
    }

    if (scene.sys.isActive()) render(settled, initialBoosts, shieldCap);
  });

  function render(s: Settled, initialBoosts: RunBoosts, shieldCap: number): void {
    const coin = s.coin;
    const mCoins = s.missionCoins;
    let earnedTotal = coin.coins + mCoins;
    let liveCoins = s.coinsAfter;
    let liveBoosts = initialBoosts;

    // Top-left live star coin balance + "+N" earned indicator in one clean pill.
    const pill = scene.add.graphics().setDepth(2);
    drawCurrencyIcon(scene, 42, 60, 38).setDepth(3);
    const balText = scene.add.text(70, 60, String(liveCoins), style(kit, 32, 0xffe14d)).setOrigin(0, 0.5).setDepth(3);
    const gainText = scene.add.text(0, 60, '', style(kit, 26, 0x58ff9a)).setOrigin(0, 0.5).setDepth(3);

    const paintBalancePill = (): void => {
      balText.setText(String(liveCoins));
      if (earnedTotal > 0) {
        gainText.setText(`+${earnedTotal}`).setVisible(true);
        gainText.setX(balText.x + balText.width + 12);
      } else {
        gainText.setVisible(false);
      }
      const rightEdge = earnedTotal > 0 ? gainText.x + gainText.width : balText.x + balText.width;
      const pillW = Math.max(130, rightEdge + 10);
      pill.clear();
      pill.fillStyle(0x1a1033, 0.94);
      pill.fillRoundedRect(12, 32, pillW, 56, 28);
    };
    paintBalancePill();

    // Rank up: beside the "Survived" line so it never crowds the layout.
    if (s.missions.rankAfter > s.missions.rankBefore) {
      const rx = cx + 215;
      const ry = top + 20;
      const rt = scene.add.text(rx, ry, fill(kit.t('rankUp'), { n: s.missions.rankAfter }), style(kit, 28, 0xffe14d)).setOrigin(0.5).setScale(0.3);
      scene.tweens.add({ targets: rt, scale: 1, duration: 400, ease: 'Back.Out' });
      kit.fx(scene).burst(rx, ry, { color: 0xffe14d, count: 24, speed: 340, lifespanMs: 600 });
      kit.audio.sfx('medal');
    }

    // Near-goal bar with generous whitespace.
    let goalTo = s.goalTo;
    if (s.goal) {
      const g = s.goal;
      const text = scene.add.text(cx, top + 92, goalText(kit, g, s.goalFrom), style(kit, 26, theme.text)).setOrigin(0.5);
      const barY = top + 122;
      const g2 = scene.add.graphics();
      let pulse: Phaser.Tweens.Tween | null = null;
      const paint = (frac: number): void => {
        g2.clear();
        g2.fillStyle(0x1a1033, 0.75);
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

    // Quick-buy boost bar cleanly above "Tap anywhere to retry" (0.82H).
    let boostObjs: Phaser.GameObjects.GameObject[] = [];
    const paintBoostBar = (): void => {
      for (const o of boostObjs) o.destroy();
      boostObjs = renderBoostBar(scene, kit, {
        cx,
        y: Math.round(scene.scale.height * 0.745),
        height: 50,
        coins: liveCoins,
        boosts: liveBoosts,
        shieldCap,
        depth: 4,
        showLabel: true,
        onBuy: (id) => {
          const res = buyBoost({ coins: liveCoins, boosts: liveBoosts, shieldCap }, id);
          if (!res.ok) return;
          const delta = res.coins - liveCoins;
          liveCoins = res.coins;
          liveBoosts = res.boosts;
          const nextBoosts = res.boosts;
          paintBalancePill();
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

    // Optional Rewarded x2 button placed cleanly between near-goal bar and boost bar.
    if (ctx.rewardedAds && coin.coins > 0) {
      let used = false;
      let busy = false;
      const btn = addButton(scene, cx, top + 190, `×2 (+${coin.coins})`, {
        width: 240, height: 56, fill: theme.accent, textColor: 0x1a1033, fontSize: 28,
        onClick: () => {
          if (used || busy) return;
          busy = true;
          void kit.showRewarded().then((res) => {
            busy = false;
            if (res !== 'rewarded' || used) return;
            used = true;
            credit(coin.coins);
            if (!scene.sys.isActive()) return;
            earnedTotal = coin.coins * 2 + mCoins;
            liveCoins += coin.coins;
            paintBalancePill();
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
