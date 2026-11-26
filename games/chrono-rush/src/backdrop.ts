import Phaser from 'phaser';
import { getKit } from '@gf/game-kit';
import { getChapterForLoop } from './chapters.ts';
import { defaultMeta, resolveHeroAppearance, sanitizeMeta, type MetaSave } from './meta.ts';
import { ensureHeroAppearance, ensurePixelArt } from './pixelArt.ts';
import { META_SAVE_KEY } from './PlayScene.ts';
import { TITLE_META_EVENT } from './titleExtras.ts';

/** Retro 16-bit fantasy landscape backdrop synced with the player's current Skin and Chapter Boss. */
export function heroTitleBackdrop(scene: Phaser.Scene): void {
  ensurePixelArt(scene);
  const kit = getKit(scene);
  const { width, height } = scene.scale;

  const g = scene.add.graphics();
  const drawBackdrop = (groundColor: number, roadOuter: number, roadInner: number): void => {
    g.clear();
    const bands = [
      { y: 0, h: height * 0.22, color: 0x13092b },
      { y: height * 0.22, h: height * 0.18, color: 0x26124d },
      { y: height * 0.4, h: height * 0.16, color: 0x4c1d57 },
      { y: height * 0.56, h: height * 0.12, color: 0x9a3412 },
      { y: height * 0.68, h: height * 0.32, color: groundColor },
    ];
    for (const b of bands) {
      g.fillStyle(b.color, 1);
      g.fillRect(0, b.y, width, b.h + 2);
    }

    g.fillStyle(0xfef08a, 0.85);
    const starCoords = [
      [90, 60], [210, 110], [340, 48], [520, 90], [740, 55],
      [890, 115], [1040, 72], [1180, 130], [160, 180], [1120, 190],
    ];
    for (const [sx, sy] of starCoords) g.fillRect(sx, sy, 4, 4);

    g.fillStyle(0x1e1b4b, 0.85);
    g.fillTriangle(0, height * 0.68, 220, height * 0.42, 460, height * 0.68);
    g.fillTriangle(340, height * 0.68, 620, height * 0.38, 920, height * 0.68);
    g.fillTriangle(800, height * 0.68, 1080, height * 0.4, 1320, height * 0.68);

    g.fillStyle(roadOuter, 0.78);
    g.fillRect(0, height * 0.78, width, 44);
    g.fillStyle(roadInner, 0.6);
    g.fillRect(0, height * 0.79, width, 24);
  };

  drawBackdrop(0x14532d, 0x92400e, 0xb45309);

  scene.add.image(155, height * 0.66, 'px-village').setScale(1.4);
  scene.add.image(width - 150, height * 0.61, 'px-castle').setScale(1.25);

  const hero = scene.add.image(275, height * 0.78, 'px-hero-0').setScale(1.65);
  const boss = scene.add.image(width - 270, height * 0.75, 'px-demon-0').setScale(1.25).setFlipX(true);

  scene.tweens.add({ targets: hero, y: hero.y - 8, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: boss, y: boss.y - 10, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const scan = scene.add.graphics();
  scan.fillStyle(0x000000, 0.08);
  for (let y = 0; y < height; y += 6) scan.fillRect(0, y, width, 2);

  // Sync hero Skin, current Chapter Boss, and ground biome from saved meta (and live stage switches!)
  let alive = true;
  const applyMetaVisuals = (meta: MetaSave): void => {
    if (!alive || !hero.active || !boss.active) return;
    const { weaponLook, armorLook, shieldLook } = resolveHeroAppearance(meta);
    const [h0] = ensureHeroAppearance(scene, weaponLook, armorLook, shieldLook);
    hero.setTexture(h0);

    const stage = getChapterForLoop(meta.loop);
    const ch = stage.chapter;
    boss.setTexture(`px-${ch.bossKind}-0`);
    drawBackdrop(ch.zoneColors[0], ch.roadOuter, ch.roadInner);
  };

  scene.events.on(TITLE_META_EVENT, applyMetaVisuals);
  scene.events.once('shutdown', () => {
    alive = false;
    scene.events.off(TITLE_META_EVENT, applyMetaVisuals);
  });
  void kit.save
    .getJSON<unknown>(META_SAVE_KEY, null)
    .then((raw) => applyMetaVisuals(sanitizeMeta(raw ?? defaultMeta())))
    .catch(() => {});
}
