import Phaser from 'phaser';
import { getKit } from '../kit.ts';
import { joystickVector, keyVector, type Vec } from './vector.ts';

export interface GameInput {
  vector(): Vec;
  dragDx(): number;
  readonly usingTouch: boolean;
}

export function createInput(scene: Phaser.Scene, opts: { joystick?: boolean; joystickRadius?: number } = {}): GameInput {
  const useJoystick = opts.joystick ?? true;
  const radius = opts.joystickRadius ?? 90;
  const theme = getKit(scene).theme;
  const kb = scene.input.keyboard;
  const cursors = kb?.createCursorKeys();
  const wasd = kb?.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key> | undefined;

  let usingTouch = false;
  let origin: Vec | null = null;
  let pointerPos: Vec = { x: 0, y: 0 };
  let activeId = -1;
  let dragAcc = 0;
  let lastX = 0;

  const base = scene.add.circle(0, 0, radius, theme.accent, 0.35).setDepth(900).setVisible(false).setScrollFactor(0);
  const knob = scene.add.circle(0, 0, radius * 0.4, theme.accent, 0.35).setDepth(901).setVisible(false).setScrollFactor(0);

  const onDown = (p: Phaser.Input.Pointer): void => {
    if (activeId !== -1) return;
    if (p.wasTouch) usingTouch = true;
    activeId = p.id;
    lastX = p.x;
    if (useJoystick) {
      origin = { x: p.x, y: p.y };
      pointerPos = { x: p.x, y: p.y };
      base.setPosition(p.x, p.y).setVisible(true);
      knob.setPosition(p.x, p.y).setVisible(true);
    }
  };
  const onMove = (p: Phaser.Input.Pointer): void => {
    if (p.id !== activeId) return;
    dragAcc += p.x - lastX;
    lastX = p.x;
    if (origin) {
      pointerPos = { x: p.x, y: p.y };
      const v = joystickVector(origin, pointerPos, radius, 0);
      knob.setPosition(origin.x + v.x * radius, origin.y + v.y * radius);
    }
  };
  const onUp = (p: Phaser.Input.Pointer): void => {
    if (p.id !== activeId) return;
    activeId = -1;
    origin = null;
    base.setVisible(false);
    knob.setVisible(false);
  };
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  scene.events.once('shutdown', () => {
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.off('pointerupoutside', onUp);
    base.destroy();
    knob.destroy();
  });

  return {
    vector() {
      const k = keyVector({
        left: !!(cursors?.left.isDown || wasd?.A.isDown),
        right: !!(cursors?.right.isDown || wasd?.D.isDown),
        up: !!(cursors?.up.isDown || wasd?.W.isDown),
        down: !!(cursors?.down.isDown || wasd?.S.isDown),
      });
      if (k.x !== 0 || k.y !== 0) return k;
      if (origin) return joystickVector(origin, pointerPos, radius);
      return { x: 0, y: 0 };
    },
    dragDx() {
      const d = dragAcc;
      dragAcc = 0;
      return d;
    },
    get usingTouch() {
      return usingTouch;
    },
  };
}
