import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Spec: Icon filenames follow pattern assets/ui/element-{id}.png
// served from public/ → actual paths: public/assets/ui/element-{id}.png

const PUBLIC_DIR = resolve(__dirname, '../../public');

function iconPath(element: string): string {
  return resolve(PUBLIC_DIR, 'assets', 'ui', `element-${element}.png`);
}

// AC-8 (asset side): element icon files must exist in public/assets/ui/

describe('element icon assets exist at public/assets/ui/element-{id}.png', () => {
  it('fire icon exists: public/assets/ui/element-fire.png', () => {
    expect(existsSync(iconPath('fire'))).toBe(true);
  });

  it('ice icon exists: public/assets/ui/element-ice.png', () => {
    expect(existsSync(iconPath('ice'))).toBe(true);
  });

  it('thunder icon exists: public/assets/ui/element-thunder.png', () => {
    expect(existsSync(iconPath('thunder'))).toBe(true);
  });

  it('toxin icon exists: public/assets/ui/element-toxin.png', () => {
    expect(existsSync(iconPath('toxin'))).toBe(true);
  });

  it('physical icon exists: public/assets/ui/element-physical.png', () => {
    // Spec note: physical icon can be omitted (no icon shown for purely physical skills)
    // Test presence anyway so the implementer makes an explicit decision
    expect(existsSync(iconPath('physical'))).toBe(true);
  });
});
