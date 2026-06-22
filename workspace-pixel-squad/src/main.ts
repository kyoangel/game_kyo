import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { AllocateScene } from './scenes/AllocateScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: '#111827',
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [BattleScene, ResultScene, AllocateScene],
};

new Phaser.Game(config);
