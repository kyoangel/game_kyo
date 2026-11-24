import type Phaser from 'phaser';
import type { Frame } from './frame.ts';

export const getFrame = (scene: Phaser.Scene): Frame => scene.registry.get('gk:frame') as Frame;
