import Phaser from 'phaser';
import { addButton, getKit, type ResultsContext } from '@gf/game-kit';
import { getChapterForLoop } from './chapters.ts';
import { playDefeatJingle, playVictoryFanfare } from './fanfare.ts';
import { HARD_MODE_LOOP, recordStageClear, sanitizeMeta, type RunSummary } from './meta.ts';
import { LAST_RUN_KEY, META_SAVE_KEY } from './PlayScene.ts';

/** Custom RPG Results panel in GameOverScene's right column: commits Crystals & Loop, adds Camp + [R] Retry. */
export function heroResults(scene: Phaser.Scene, ctx: ResultsContext): void {
  const kit = getKit(scene);
  const { width, height } = scene.scale;
  const cx = ctx.cx ?? width / 2;
  const cy = ctx.landscape ? height * 0.5 : height * 0.66;
  const font = kit.theme.font;

  const summary = scene.game.registry.get(LAST_RUN_KEY) as RunSummary | undefined;

  if (summary) {
    scene.game.registry.set(LAST_RUN_KEY, undefined);
    if (summary.bossSlain) {
      if (!summary.fanfarePlayed) playVictoryFanfare(kit.audio.muted);
    } else {
      if (!summary.fanfarePlayed) playDefeatJingle(kit.audio.muted);
    }
    void kit.save.getJSON<unknown>(META_SAVE_KEY, null).then((raw) => {
      let meta = sanitizeMeta(raw);
      meta = { ...meta, crystals: meta.crystals + summary.crystalsEarned };
      if (summary.bossSlain) {
        meta = recordStageClear(meta, summary.loop, summary.timeLeft);
      }
      return kit.save.setJSON(META_SAVE_KEY, meta);
    });
  }

  const panelW = 580;
  const panelH = 490;
  const accent = summary?.bossSlain ? 0xfacc15 : 0xf43f5e;
  scene.add.rectangle(cx, cy, panelW, panelH, 0x160d2e, 0.96).setStrokeStyle(4, accent);

  const headingKey = summary?.reason === 'victory' ? 'victory' : summary?.reason === 'defeated' ? 'defeated' : 'timeUp';
  scene.add
    .text(cx, cy - 190, kit.t(headingKey), {
      fontFamily: font,
      fontSize: '38px',
      fontStyle: 'bold',
      color: summary?.bossSlain ? '#facc15' : '#fda4af',
      stroke: '#09050f',
      strokeThickness: 6,
    })
    .setOrigin(0.5);

  if (summary) {
    const curStage = getChapterForLoop(summary.loop);
    const nextStage = getChapterForLoop(summary.loop + 1);
    const curTitle = kit.t(`chapter.${curStage.chapter.id}`);
    const nextTitle = kit.t(`chapter.${nextStage.chapter.id}`);
    const stageDisplay = !summary.bossSlain
      ? `${curTitle} ${curStage.roman}`
      : curStage.chapter.id === nextStage.chapter.id
        ? `${curTitle} ${curStage.roman} → ${nextStage.roman}`
        : `→ ${nextTitle} ${nextStage.roman} ★`;
    const medalStr = summary.medal ? `★ ${summary.medal}  (${summary.timeLeft.toFixed(1)}s)` : null;
    const rows: Array<[string, string]> = [
      [kit.t('statLv'), `LV ${summary.level}`],
      [kit.t('statKills'), `${summary.kills}`],
      [kit.t('statLoop'), stageDisplay],
      [kit.t('statCrystals'), `+${summary.crystalsEarned} 💎`],
    ];
    if (medalStr) rows.push([kit.t('statMedal'), medalStr]);
    rows.forEach(([k, v], i) => {
      const ry = cy - 118 + i * 44;
      scene.add.rectangle(cx, ry, 496, 36, 0x1e1b4b, 0.88);
      scene.add.text(cx - 226, ry, k, { fontFamily: font, fontSize: '18px', color: '#cbd5e1' }).setOrigin(0, 0.5);
      const valColor =
        i === 3 ? '#38bdf8' : i === 4 ? (summary.medal === 'S' ? '#facc15' : summary.medal === 'A' ? '#38bdf8' : '#e2e8f0') : i === 2 && summary.bossSlain ? '#facc15' : '#ffffff';
      scene.add
        .text(cx + 226, ry, v, {
          fontFamily: font,
          fontSize: i === 2 ? '17px' : '20px',
          fontStyle: 'bold',
          color: valColor,
        })
        .setOrigin(1, 0.5);
    });

    if (summary.bossSlain && summary.loop === HARD_MODE_LOOP - 1) {
      scene.add
        .text(cx, cy + 98, kit.t('stages.hardModeUnlocked'), {
          fontFamily: font,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#facc15',
          align: 'center',
          wordWrap: { width: 520 },
        })
        .setOrigin(0.5);
    } else if (summary.skinsUnlocked.length > 0) {
      scene.add
        .text(cx, cy + 92, `★ ${kit.t('skinUnlocked')}: ${summary.skinsUnlocked.join(', ')}`, {
          fontFamily: font,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#facc15',
        })
        .setOrigin(0.5);
    } else if (summary.defeatTip) {
      scene.add
        .text(cx, cy + 102, kit.t(summary.defeatTip), {
          fontFamily: font,
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#7dd3fc',
          align: 'center',
          wordWrap: { width: 520 },
        })
        .setOrigin(0.5);
    }
  }

  let busy = false;
  const retryNow = (): void => {
    if (busy) return;
    busy = true;
    kit.audio.sfx('medal');
    void kit.retry();
  };

  addButton(scene, cx - 134, cy + 174, kit.t('camp'), {
    width: 244,
    height: 62,
    fill: 0x0284c7,
    fontSize: 24,
    onClick: () => {
      if (busy) return;
      busy = true;
      kit.audio.sfx('click');
      kit.goTo('Camp');
    },
  });

  const isVictory = summary?.bossSlain === true;
  addButton(scene, cx + 134, cy + 174, kit.t(isVictory ? 'nextLoop' : 'playAgain'), {
    width: 244,
    height: 62,
    fill: isVictory ? 0xd97706 : 0x16a34a,
    fontSize: 24,
    onClick: retryNow,
  });

  // Hotkey [R] for instant retry on Results screen (supports Zhuyin IME too)
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === 'ㄐ') {
      e.preventDefault();
      window.removeEventListener('keydown', onKey, true);
      retryNow();
    }
  };
  window.addEventListener('keydown', onKey, true);
  scene.events.once('shutdown', () => window.removeEventListener('keydown', onKey, true));
}
