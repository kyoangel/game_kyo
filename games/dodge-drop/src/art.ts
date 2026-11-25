import type Phaser from 'phaser';

export interface ArtFile {
  key: string;
  file: string;
  /** Display size (px) of the procedural texture that has this key; loaded art is scaled to it. */
  size?: number;
  /** Neon tint applied to the (white/light) loaded sprite; the procedural texture is already coloured. */
  tint?: number;
}

/** Keys are the existing procedural texture keys; a loaded file wins, a missing one falls back to the generator. */
export const ART_FILES: readonly ArtFile[] = [
  // star.png (thin sparkle) and shield.png (plain ring) are shipped but NOT mapped: at gameplay size they read
  // worse than the procedural coin star / crest, and the ring would look like the player's own shield ring.
  { key: 'dd-ring', file: 'ring.png', size: 170, tint: 0x58ff9a },
  { key: 'dd-bg-far', file: 'bg-far.png' },
  { key: 'dd-bg-mid', file: 'bg-mid.png' },
  { key: 'dd-panel-art', file: 'panel-art.png' },
  { key: 'dd-logo', file: 'logo.png' },
];

export const artUrl = (f: ArtFile): string => `assets/art/${f.file}`;

export function missingArtKeys(files: readonly ArtFile[], shipped: ReadonlySet<string>): string[] {
  return files.filter((f) => !shipped.has(f.file)).map((f) => f.key);
}

export function preloadArt(scene: Phaser.Scene): void {
  for (const f of ART_FILES) scene.load.image(f.key, artUrl(f));
  scene.load.on('loaderror', () => { /* a missing file leaves the key unset; procedural generators fill it */ });
}

/** True when the texture under `key` came from a loaded image file (not a runtime-generated canvas). */
export function isLoadedArt(scene: Phaser.Scene, key: string): boolean {
  if (!scene.textures.exists(key)) return false;
  const src = scene.textures.get(key).getSourceImage() as { tagName?: string };
  return src.tagName === 'IMG';
}

/** Scale that makes loaded art occupy the same footprint as the procedural texture of that key (1 for procedural). */
export function artScale(scene: Phaser.Scene, key: string): number {
  const f = ART_FILES.find((a) => a.key === key);
  if (!f?.size || !isLoadedArt(scene, key)) return 1;
  return f.size / scene.textures.get(key).source[0]!.width;
}

/** Adds an image with `key`, tinted when it is loaded neon art. */
export const artImage = (scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image =>
  styleArt(scene, scene.add.image(x, y, key), key);

/** Tints loaded art to its neon colour; clears the tint on procedural textures. */
export function styleArt<T extends Phaser.GameObjects.Image>(scene: Phaser.Scene, img: T, key: string): T {
  const f = ART_FILES.find((a) => a.key === key);
  if (f?.tint !== undefined && isLoadedArt(scene, key)) img.setTint(f.tint);
  else img.clearTint();
  return img;
}
