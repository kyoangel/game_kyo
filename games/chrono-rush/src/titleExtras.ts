import Phaser from 'phaser';
import { addButton, getKit, markButtonTap, type TitleExtrasContext } from '@gf/game-kit';
import manifest from '../game.json';
import { FEATURES } from './balance.ts';
import { BOOST_CATALOG, type BoostId } from './boosts.ts';
import { CHAPTERS, EPISODES_PER_CHAPTER, getChapterForLoop } from './chapters.ts';
import { defaultMeta, isBoostsUnlocked, sanitizeMeta, selectStageLoop, togglePreRunBoost, type MetaSave } from './meta.ts';
import { META_SAVE_KEY } from './PlayScene.ts';

export const TITLE_META_EVENT = 'chrono:titleMetaChanged';

/** Title-screen Quick Stage Selector (with scrollable Dropdown + live Boss/biome preview) and Pre-Run Boost pills. */
export function heroTitleExtras(scene: Phaser.Scene, ctx: TitleExtrasContext): void {
  const kit = getKit(scene);
  const { width, height } = ctx;
  const cx = width / 2;
  const font = kit.theme.font;

  let meta: MetaSave = defaultMeta();
  let layer: Phaser.GameObjects.GameObject[] = [];
  let dropdownLayer: Phaser.GameObjects.GameObject[] = [];
  let dropdownOpen = false;
  let scrollY = 0;
  let saving: Promise<void> = Promise.resolve();
  let alive = true;

  const cleanupDropdownListeners: Array<() => void> = [];
  const clearDropdown = (): void => {
    for (const fn of cleanupDropdownListeners) fn();
    cleanupDropdownListeners.length = 0;
    for (const o of dropdownLayer) o.destroy();
    dropdownLayer = [];
    dropdownOpen = false;
  };

  scene.events.once('shutdown', () => {
    alive = false;
    clearDropdown();
  });

  const persist = (next: MetaSave): void => {
    meta = next;
    scene.events.emit(TITLE_META_EVENT, meta);
    saving = saving.then(() => kit.save.setJSON(META_SAVE_KEY, meta));
    render();
  };

  const openDropdown = (): void => {
    clearDropdown();
    dropdownOpen = true;

    const totalStages = Math.max(CHAPTERS.length * EPISODES_PER_CHAPTER, meta.maxUnlockedLoop);
    const panelW = 460;
    const panelH = 340;
    const px = cx;
    const py = height * 0.48;
    const listTop = py - panelH / 2 + 48;
    const listH = panelH - 60;
    const rowH = 44;
    const contentH = totalStages * rowH;
    const maxScroll = Math.max(0, contentH - listH);

    // Center current selected stage in view
    scrollY = Phaser.Math.Clamp((meta.loop - 1) * rowH - listH / 2 + rowH / 2, 0, maxScroll);

    const addD = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      dropdownLayer.push(o);
      return o;
    };

    // Click-outside backdrop closes dropdown safely without starting the game
    const backdrop = addD(
      scene.add
        .rectangle(cx, height / 2, width, height, 0x09050f, 0.55)
        .setDepth(40)
        .setInteractive({ useHandCursor: false }),
    );
    backdrop.on('pointerdown', () => {
      markButtonTap(scene);
      kit.audio.sfx('click');
      clearDropdown();
      render();
    });

    // Panel frame (absorbs clicks inside panel)
    const panel = addD(
      scene.add
        .rectangle(px, py, panelW, panelH, 0x13092b, 0.98)
        .setStrokeStyle(3, 0xfacc15)
        .setDepth(41)
        .setInteractive(),
    );
    panel.on('pointerdown', () => markButtonTap(scene));

    addD(
      scene.add
        .text(px - panelW / 2 + 20, py - panelH / 2 + 24, kit.t('stages.title').split('（')[0].split('(')[0].trim(), {
          fontFamily: font,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#facc15',
        })
        .setOrigin(0, 0.5)
        .setDepth(42),
    );

    const closeBtn = addD(
      addButton(scene, px + panelW / 2 - 28, py - panelH / 2 + 24, '✕', {
        width: 34,
        height: 30,
        fill: 0x475569,
        fontSize: 16,
        onClick: () => {
          kit.audio.sfx('click');
          clearDropdown();
          render();
        },
      }).setDepth(44),
    );
    void closeBtn;

    // Scrollable container + geometry mask
    const listContainer = addD(scene.add.container(px, listTop - scrollY).setDepth(43));
    const maskGfx = addD(scene.add.graphics().setVisible(false));
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(px - panelW / 2 + 10, listTop, panelW - 20, listH);
    listContainer.setMask(maskGfx.createGeometryMask());

    // Scrollbar thumb
    const scrollTrackX = px + panelW / 2 - 12;
    const thumbH = Math.max(28, (listH / Math.max(listH, contentH)) * listH);
    const thumb = addD(
      scene.add.rectangle(scrollTrackX, listTop + thumbH / 2, 6, thumbH, 0xfacc15, maxScroll > 0 ? 0.7 : 0).setDepth(44),
    );

    const applyScroll = (nextY: number): void => {
      scrollY = Phaser.Math.Clamp(nextY, 0, maxScroll);
      listContainer.y = listTop - scrollY;
      if (maxScroll > 0) {
        const frac = scrollY / maxScroll;
        thumb.y = listTop + thumbH / 2 + frac * (listH - thumbH);
      }
    };
    applyScroll(scrollY);

    let dragStartY: number | null = null;
    let dragStartScroll = 0;
    let dragged = false;

    for (let loopNum = 1; loopNum <= totalStages; loopNum++) {
      const y = (loopNum - 1) * rowH + rowH / 2;
      const unlocked = loopNum <= meta.maxUnlockedLoop;
      const selected = loopNum === meta.loop;
      const info = getChapterForLoop(loopNum);
      const rec = meta.stageRecords[String(loopNum)];
      const isS = rec?.medal === 'S';

      const bgColor = selected ? 0x4c1d95 : isS ? 0x2a2414 : unlocked ? 0x1e163b : 0x110c21;
      const strokeColor = selected ? 0xfacc15 : isS ? 0xeab308 : 0x334155;
      const rowBg = scene.add
        .rectangle(0, y, panelW - 36, rowH - 6, bgColor, unlocked ? 0.96 : 0.6)
        .setStrokeStyle(selected || isS ? 2 : 1, strokeColor);

      const titleTxt = scene.add
        .text(-panelW / 2 + 30, y, `${kit.t(`chapter.${info.chapter.id}`)} ${info.roman}`, {
          fontFamily: font,
          fontSize: '16px',
          fontStyle: 'bold',
          color: unlocked ? (isS ? '#fef08a' : '#ffffff') : '#64748b',
        })
        .setOrigin(0, 0.5);

      const rightLabel = !unlocked
        ? '🔒'
        : rec
          ? `★ ${rec.medal}  ${rec.bestTimeLeft.toFixed(1)}s`
          : 'OPEN';
      const rightColor = !unlocked
        ? '#64748b'
        : rec?.medal === 'S'
          ? '#facc15'
          : rec?.medal === 'A'
            ? '#38bdf8'
            : rec?.medal === 'B'
              ? '#e2e8f0'
              : '#94a3b8';

      const rightTxt = scene.add
        .text(panelW / 2 - 34, y, rightLabel, {
          fontFamily: font,
          fontSize: '16px',
          fontStyle: 'bold',
          color: rightColor,
        })
        .setOrigin(1, 0.5);

      rowBg.setInteractive({ useHandCursor: unlocked });
      rowBg.on('pointerdown', (p: Phaser.Input.Pointer) => {
        markButtonTap(scene);
        dragStartY = p.y;
        dragStartScroll = scrollY;
        dragged = false;
      });
      rowBg.on('pointerup', () => {
        markButtonTap(scene);
        if (dragged) return;
        if (!unlocked) {
          kit.audio.sfx('click');
          return;
        }
        const next = selectStageLoop(meta, loopNum);
        clearDropdown();
        if (next) {
          kit.audio.sfx('medal');
          persist(next);
        } else {
          kit.audio.sfx('click');
          render();
        }
      });

      listContainer.add([rowBg, titleTxt, rightTxt]);
    }

    const onWheel = (_p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number): void => {
      if (!dropdownOpen) return;
      applyScroll(scrollY + dy * 0.55);
    };
    const onMove = (p: Phaser.Input.Pointer): void => {
      if (dragStartY === null || !p.isDown) return;
      const delta = dragStartY - p.y;
      if (Math.abs(delta) > 6) dragged = true;
      applyScroll(dragStartScroll + delta);
    };
    const onUp = (): void => {
      dragStartY = null;
    };
    scene.input.on('wheel', onWheel);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    cleanupDropdownListeners.push(() => {
      scene.input.off('wheel', onWheel);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
    });
  };

  const render = (): void => {
    for (const o of layer) o.destroy();
    layer = [];
    if (!alive) return;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      layer.push(o);
      return o;
    };

    // Subtle version badge in bottom-left corner so players can always confirm the latest deployed build
    add(
      scene.add
        .text(18, height - 16, `v${manifest.version}`, {
          fontFamily: font,
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#94a3b8',
          stroke: '#09050f',
          strokeThickness: 3,
        })
        .setOrigin(0, 1)
        .setDepth(21)
        .setAlpha(0.85),
    );

    // Top-left Crystal balance badge
    add(scene.add.rectangle(108, 44, 152, 46, 0x13092b, 0.85).setStrokeStyle(2, 0x38bdf8).setDepth(20));
    add(scene.add.image(56, 44, 'px-crystal').setScale(0.75).setDepth(21));
    add(
      scene.add
        .text(78, 44, `${meta.crystals}`, {
          fontFamily: font,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#38bdf8',
          stroke: '#09050f',
          strokeThickness: 4,
        })
        .setOrigin(0, 0.5)
        .setDepth(21),
    );

    // Quick Stage Selector right below CAMP button (clickable pill opens scrollable dropdown!)
    const stageY = ctx.menuBottom + 36;
    if (FEATURES.chapterSelect) {
      const info = getChapterForLoop(meta.loop);
      const rec = meta.stageRecords[String(meta.loop)];
      const medalPart = rec ? `  •  ★${rec.medal} ${rec.bestTimeLeft.toFixed(1)}s` : '';
      const stageLabel = `${kit.t(`chapter.${info.chapter.id}`)} ${info.roman}${medalPart}  ${dropdownOpen ? '▴' : '▾'}`;

      add(
        addButton(scene, cx, stageY, stageLabel, {
          width: 376,
          height: 48,
          fill: 0x1e163b,
          textColor: 0xfef08a,
          strokeThickness: 3,
          fontSize: 17,
          onClick: () => {
            kit.audio.sfx('click');
            if (dropdownOpen) {
              clearDropdown();
              render();
            } else {
              openDropdown();
              render();
            }
          },
        }).setDepth(22),
      );

      const canPrev = meta.loop > 1;
      const canNext = meta.loop < meta.maxUnlockedLoop;
      add(
        addButton(scene, cx - 222, stageY, '◀', {
          width: 52,
          height: 46,
          fill: canPrev ? 0x312e81 : 0x1e293b,
          fontSize: 22,
          onClick: () => {
            clearDropdown();
            const next = selectStageLoop(meta, meta.loop - 1);
            if (!next) {
              kit.audio.sfx('click');
              return;
            }
            kit.audio.sfx('medal');
            persist(next);
          },
        }).setDepth(22),
      );
      add(
        addButton(scene, cx + 222, stageY, '▶', {
          width: 52,
          height: 46,
          fill: canNext ? 0x312e81 : 0x1e293b,
          fontSize: 22,
          onClick: () => {
            clearDropdown();
            const next = selectStageLoop(meta, meta.loop + 1);
            if (!next) {
              kit.audio.sfx('click');
              return;
            }
            kit.audio.sfx('medal');
            persist(next);
          },
        }).setDepth(22),
      );
    }

    // 4 Quick Pre-Run Boost pills right below Stage Selector (unlocked at Hard Mode / Loop 26+)
    if (FEATURES.preRunBoosts) {
      const boostY = stageY + 62;
      if (!isBoostsUnlocked(meta)) {
        add(
          scene.add
            .rectangle(cx, boostY, 540, 38, 0x13092b, 0.78)
            .setStrokeStyle(2, 0x475569)
            .setDepth(21),
        );
        add(
          scene.add
            .text(cx, boostY, kit.t('stages.boostsLocked'), {
              fontFamily: font,
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#fef08a',
            })
            .setOrigin(0.5)
            .setDepth(22),
        );
      } else {
        const pillW = 166;
        const gap = 10;
        const totalW = BOOST_CATALOG.length * pillW + (BOOST_CATALOG.length - 1) * gap;
        const startX = cx - totalW / 2 + pillW / 2;

        BOOST_CATALOG.forEach((b, i) => {
          const bx = startX + i * (pillW + gap);
          const armed = meta.activeBoosts.includes(b.id);
          const affordable = !armed && meta.crystals >= b.cost;
          const shortEff = kit.t(`boost.${b.id}.short`);
          const label = armed ? `✓ ${b.icon} ${shortEff}\nON` : `${b.icon} ${shortEff}\n${b.cost} 💎`;
          add(
            addButton(scene, bx, boostY, label, {
              width: pillW,
              height: 52,
              fill: armed ? 0x16a34a : affordable ? b.color : 0x1e293b,
              textColor: 0xffffff,
              strokeThickness: 3,
              fontSize: 14,
              onClick: () => {
                const next = togglePreRunBoost(meta, b.id as BoostId);
                if (!next) {
                  kit.audio.sfx('click');
                  return;
                }
                kit.audio.sfx(armed ? 'click' : 'medal');
                persist(next);
              },
            }).setDepth(22),
          );
        });
      }
    }
  };

  void kit.save
    .getJSON<unknown>(META_SAVE_KEY, null)
    .then((raw) => {
      if (!alive) return;
      meta = sanitizeMeta(raw);
      render();
    })
    .catch(() => {
      if (!alive) return;
      meta = defaultMeta();
      render();
    });
}
