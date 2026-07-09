import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { BaseScene } from './scenes/BaseScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { PrepScene } from './scenes/PrepScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { ShopScene } from './scenes/ShopScene';
import { EquipmentScene } from './scenes/EquipmentScene';
import { SkillTreeScene } from './scenes/SkillTreeScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: '#111827',
  pixelArt: true,
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [TitleScene, BaseScene, BattleScene, ResultScene, PrepScene, WorldMapScene, ShopScene, EquipmentScene, SkillTreeScene],
};

const boot = () => new Phaser.Game(config);
if (document.fonts?.load) {
  Promise.race([
    document.fonts.load('12px "Fusion Pixel 12px Proportional"'),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]).then(boot);
} else {
  boot();
}
