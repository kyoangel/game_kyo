import Phaser from 'phaser';
import { getKit } from '@gf/game-kit';
import { SKINS } from './economy.ts';
import { skinTextureKey } from './skinArt.ts';

function blockKey(scene: Phaser.Scene): string {
  const key = 'dd-title-block';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, 64, 64, 14);
  g.generateTexture(key, 64, 64);
  g.destroy();
  return key;
}

/** Title backdrop: slow falling translucent blocks plus the selected skin idling near the bottom. */
export function ddTitleBackdrop(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const key = blockKey(scene);
  for (let i = 0; i < 12; i++) {
    const sx = 0.8 + Math.random() * 1.6;
    const img = scene.add.image(40 + Math.random() * (width - 80), -100, key).setTint(i % 3 === 0 ? 0xffa14d : 0xff4fa3).setAlpha(0.14 + Math.random() * 0.1).setScale(sx, sx * (0.5 + Math.random() * 0.4));
    scene.tweens.add({
      targets: img,
      y: height + 120,
      angle: (Math.random() - 0.5) * 40,
      duration: 9000 + Math.random() * 7000,
      delay: Math.random() * 9000,
      repeat: -1,
      onRepeat: () => { img.x = 40 + Math.random() * (width - 80); },
    });
  }
  const kit = getKit(scene);
  void kit.save.getJSON<string>('skin', 'cyan').then((sid) => {
    if (!scene.sys.isActive()) return;
    const skin = SKINS.find((s) => s.id === sid) ?? SKINS[0]!;
    const img = scene.add.image(width / 2, height * 0.9, skinTextureKey(scene, skin)).setScale(1.6);
    if (skin.color === 'cycle') img.setTint(0xff7ad9);
    scene.tweens.add({ targets: img, y: height * 0.9 - 24, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: img, angle: 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
}
