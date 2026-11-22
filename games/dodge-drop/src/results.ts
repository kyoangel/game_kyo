import Phaser from 'phaser';
import { addButton, cssColor, getKit, type Kit, type ResultsContext } from '@gf/game-kit';
import { coinsForRun } from './economy.ts';
import { formatTime } from './format.ts';
import { MEDALS, mergeMedals } from './medals.ts';
import { emptyStats } from './missions.ts';
import { RUN_STATE_KEY, type RunState } from './runState.ts';

const EMPTY: RunState = { score: 0, seconds: 0, stars: 0, medals: [], headStart: 0, startTier: 'none', stats: emptyStats() };

function style(kit: Kit, size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: kit.theme.font, fontSize: `${size}px`, fontStyle: 'bold', color: cssColor(color), stroke: '#1a1033', strokeThickness: 5, align: 'center' };
}

/** Results hook: coins, survived time, medals, optional rewarded x2. Lays out in [ctx.top, ~height*0.8]. */
export function ddResults(scene: Phaser.Scene, ctx: ResultsContext): void {
  const kit = getKit(scene);
  const { theme } = kit;
  const cx = scene.scale.width / 2;
  const run = (scene.registry.get(RUN_STATE_KEY) as RunState | undefined) ?? EMPTY;
  const n = coinsForRun(run.score, run.stars);

  // Credit immediately; serialize read-modify-write so the x2 bonus never races it.
  let chain: Promise<void> = Promise.resolve();
  const credit = (amount: number): void => {
    if (amount <= 0) return;
    chain = chain.then(async () => {
      const cur = await kit.save.getNumber('coins', 0);
      await kit.save.setNumber('coins', cur + amount);
    });
  };
  credit(n);

  let y = ctx.top + 30;
  const coinsText = scene.add.text(cx, y, `+${n} ${kit.t('coins')}`, style(kit, 52, 0xffe14d)).setOrigin(0.5);
  y += 62;
  scene.add.text(cx, y, `${kit.t('survived')} ${formatTime(run.seconds)}`, style(kit, 38, theme.text)).setOrigin(0.5);
  y += 78;

  // medal collection: 4 slots, this run's medals glow
  const slots = scene.add.graphics();
  const slotX = (i: number): number => cx + (i - 1.5) * 110;
  const draw = (owned: Set<string>): void => {
    slots.clear();
    MEDALS.forEach((m, i) => {
      const x = slotX(i);
      if (owned.has(m.id)) {
        slots.fillStyle(m.color, run.medals.includes(m.id) ? 1 : 0.7);
        slots.fillCircle(x, y, 30);
        slots.fillStyle(0xffffff, 0.45);
        slots.fillCircle(x - 9, y - 9, 9);
        slots.lineStyle(4, 0xffffff, run.medals.includes(m.id) ? 0.95 : 0.4);
        slots.strokeCircle(x, y, 30);
      } else {
        slots.fillStyle(0x1a1033, 0.55);
        slots.fillCircle(x, y, 30);
        slots.lineStyle(3, m.color, 0.35);
        slots.strokeCircle(x, y, 30);
      }
    });
  };
  draw(new Set(run.medals));
  void kit.save.getJSON<unknown>('medals', []).then((saved) => {
    if (scene.sys.isActive()) draw(new Set(mergeMedals(saved, run.medals)));
  });
  const nameY = y + 54;
  if (run.medals.length > 0) {
    const names = run.medals.map((id) => kit.t(`medal.${id}`)).join(' + ');
    scene.add.text(cx, nameY, names, style(kit, 30, theme.accent)).setOrigin(0.5);
  }

  if (ctx.rewardedAds && n > 0) {
    let used = false;
    let busy = false;
    const btn = addButton(scene, cx, nameY + 96, `×2  +${n}`, {
      width: 300,
      height: 72,
      fill: theme.accent,
      textColor: 0x1a1033,
      fontSize: 36,
      onClick: () => {
        if (used || busy) return;
        busy = true;
        void kit.showRewarded().then((res) => {
          busy = false;
          if (res !== 'rewarded' || used) return;
          used = true;
          credit(n);
          if (!scene.sys.isActive()) return;
          coinsText.setText(`+${n * 2} ${kit.t('coins')}`);
          kit.audio.sfx('pickup');
          btn.destroy();
        });
      },
    });
  }
}
