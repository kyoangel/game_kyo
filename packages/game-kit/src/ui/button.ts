import Phaser from 'phaser';
import { getKit } from '../kit.ts';
import { cssColor } from '../theme.ts';

const handled = new WeakMap<Phaser.Scene, boolean>();

/** Mark the current pointer as handled by a UI control so scene-wide tap handlers (e.g. tap-to-start) skip it. */
export function markButtonTap(scene: Phaser.Scene): void {
  handled.set(scene, true);
  scene.input.once('pointerup', () => setTimeout(() => handled.set(scene, false), 0));
}

/** True once if a button handled the current pointer; scene-wide tap handlers should skip when it returns true. */
export function consumeButtonTap(scene: Phaser.Scene): boolean {
  const v = handled.get(scene) === true;
  handled.set(scene, false);
  return v;
}

/** Render text at the on-screen pixel density (canvas is FIT-scaled and devices are hi-dpi) so labels stay crisp. */
export function textResolution(scene: Phaser.Scene): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const fit = scene.scale.displaySize.width / scene.scale.width || 1;
  return Math.min(3, Math.max(1, Math.ceil(dpr * fit)));
}

/**
 * Minimum hit-area height (canvas px). The portrait canvas is 720 px wide, so on a 375 px phone one canvas px is
 * ~0.52 css px and 88 px is the 44 css px touch minimum. The drawn button keeps its own height; only the hit grows.
 */
export const MIN_TAP = 88;

/** Every live button per scene, for resolving taps where enlarged hit areas overlap. */
const sceneButtons = new WeakMap<Phaser.Scene, Set<Phaser.GameObjects.Container>>();

function hitCentre(b: Phaser.GameObjects.Container): { x: number; y: number } {
  const m = b.getWorldTransformMatrix();
  return { x: m.tx, y: m.ty };
}

/**
 * Where enlarged hit areas overlap (stacked rows), Phaser hands the tap to the top-most object. Re-route it to the
 * button whose centre is nearest the pointer so a tap on a button's lower edge never fires its neighbour.
 */
function nearestButtonAt(scene: Phaser.Scene, p: Phaser.Input.Pointer, self: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
  let best = self;
  let bestD = Infinity;
  for (const b of sceneButtons.get(scene) ?? []) {
    if (!b.active || !b.visible || !b.input?.enabled) continue;
    const c = hitCentre(b);
    const dx = Math.abs(p.worldX - c.x);
    const dy = Math.abs(p.worldY - c.y);
    if (dx > b.width / 2 || dy > b.height / 2) continue;
    const d = dy / b.height + dx / b.width; // normalised, so a wide button does not steal taps from a narrow neighbour
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

/** Test hook registry (PLATFORM=local builds): every live addButton container, for `window.__dd.tapTargets()`. */
const liveButtons = new Set<Phaser.GameObjects.Container>();

function registerTapTarget(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  if (!__GK_TEST_HOOKS__) return;
  liveButtons.add(c);
  c.once('destroy', () => liveButtons.delete(c));
  scene.events.once('shutdown', () => liveButtons.delete(c));
  const w = window as unknown as { __dd?: Record<string, unknown> };
  w.__dd = Object.assign(w.__dd ?? {}, {
    /** Hit-area height (canvas px) of every visible, active button: `{ name, h }`. */
    tapTargets: (): { name: string; h: number }[] =>
      [...liveButtons]
        .filter((b) => b.active && b.visible && b.alpha > 0.01 && b.input?.enabled === true && b.scene.sys.isActive())
        .map((b) => ({ name: (b.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined)?.text ?? 'button', h: b.input!.hitArea.height * Math.abs(b.scaleY) })),
  });
}

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  opts: { width?: number; height?: number; fill?: number; textColor?: number; fontSize?: number; strokeThickness?: number; onClick: () => void },
): Phaser.GameObjects.Container {
  const kit = getKit(scene);
  const { theme } = kit;
  const w = opts.width ?? 320;
  const h = opts.height ?? 76;
  const g = scene.add.graphics();
  g.fillStyle(opts.fill ?? theme.primary, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: theme.font,
      fontSize: `${opts.fontSize ?? 32}px`,
      color: cssColor(opts.textColor ?? 0xffffff),
      stroke: '#1a1033',
      strokeThickness: opts.strokeThickness ?? 4,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setResolution(textResolution(scene));
  const c = scene.add.container(x, y, [g, text]);
  c.setSize(w, Math.max(h, MIN_TAP));
  c.setInteractive({ useHandCursor: true });
  let set = sceneButtons.get(scene);
  if (!set) sceneButtons.set(scene, (set = new Set()));
  set.add(c);
  c.once('destroy', () => set.delete(c));
  scene.events.once('shutdown', () => set.delete(c));
  registerTapTarget(scene, c);
  c.on('pointerdown', (p: Phaser.Input.Pointer) => {
    const t = nearestButtonAt(scene, p, c);
    if (t !== c) { t.emit('pointerdown', p); return; }
    markButtonTap(scene);
    c.setScale(0.94);
    kit.audio.sfx('click');
  });
  const release = (): void => {
    c.setScale(1);
  };
  c.on('pointerout', release);
  c.on('pointerup', (p: Phaser.Input.Pointer) => {
    const t = nearestButtonAt(scene, p, c);
    if (t !== c) { t.emit('pointerup', p); return; }
    release();
    opts.onClick();
  });
  return c;
}
