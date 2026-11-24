import Phaser from 'phaser';

export interface TextBound { name: string; top: number; bottom: number; left: number; right: number; fontPx: number }

const registered = new Set<Phaser.Scene>();

function collect(list: Phaser.GameObjects.GameObject[], out: TextBound[], parentVisible: boolean, parentScale: number): void {
  for (const o of list) {
    const vis = parentVisible && (o as { visible?: boolean }).visible !== false && ((o as { alpha?: number }).alpha ?? 1) > 0.01;
    if (!vis || !o.active) continue;
    if (o instanceof Phaser.GameObjects.Text) {
      if (o.text.trim() === '') continue;
      const b = o.getBounds();
      out.push({
        name: o.text.slice(0, 40),
        top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        fontPx: parseFloat(String(o.style.fontSize)) * Math.abs(o.scaleY) * parentScale,
      });
    } else if (o instanceof Phaser.GameObjects.Container) {
      collect(o.list, out, vis, parentScale * Math.abs(o.scaleY));
    }
  }
}

/**
 * Test hook (PLATFORM=local builds only): `window.__dd.bounds()` lists the on-canvas bounds and effective font size
 * (canvas px) of every visible text in the registered scenes. Merges into an existing `__dd` object.
 */
export function registerBounds(scene: Phaser.Scene, extra?: Record<string, unknown>): void {
  if (!__GK_TEST_HOOKS__) return;
  registered.add(scene);
  scene.events.once('shutdown', () => registered.delete(scene));
  const w = window as unknown as { __dd?: Record<string, unknown> };
  w.__dd = Object.assign(w.__dd ?? {}, extra ?? {}, {
    bounds: (): TextBound[] => {
      const out: TextBound[] = [];
      for (const s of registered) if (s.sys.isActive()) collect(s.children.list, out, true, 1);
      return out;
    },
  });
}
