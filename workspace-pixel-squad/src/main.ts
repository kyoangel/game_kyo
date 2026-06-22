import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }
  create() {
    this.add.text(180, 320, 'Pixel Squad', {
      fontSize: '24px', color: '#e5e7eb',
    }).setOrigin(0.5);
  }
}

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
  scene: [BootScene],
};

new Phaser.Game(config);
