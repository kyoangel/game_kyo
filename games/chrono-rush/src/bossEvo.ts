import Phaser from 'phaser';

export interface BossEvoSpec {
  tier: 1 | 2 | 3 | 4 | 5;
  titleKey: '' | 'bossEvo.2' | 'bossEvo.3' | 'bossEvo.4' | 'bossEvo.5';
  scaleMult: number;
  tint: number | null;
  auraColor: number | null;
  hasCrown: boolean;
  hasRing: boolean;
  hasShadowEcho: boolean;
  hasOmegaDoubleRing: boolean;
  skyTop: number;
  skyMid: number;
  skyHorizon: number;
}

const EVO_TABLE: readonly BossEvoSpec[] = [
  // Episode I: Classic original Boss
  {
    tier: 1,
    titleKey: '',
    scaleMult: 1.0,
    tint: null,
    auraColor: null,
    hasCrown: false,
    hasRing: false,
    hasShadowEcho: false,
    hasOmegaDoubleRing: false,
    skyTop: 0x13092b,
    skyMid: 0x4c1d57,
    skyHorizon: 0x9a3412,
  },
  // Episode II: Awakened — Fiery crimson-gold glow + floating golden crown
  {
    tier: 2,
    titleKey: 'bossEvo.2',
    scaleMult: 1.06,
    tint: 0xffc2a8,
    auraColor: 0xf97316,
    hasCrown: true,
    hasRing: false,
    hasShadowEcho: false,
    hasOmegaDoubleRing: false,
    skyTop: 0x1a0826,
    skyMid: 0x5b194d,
    skyHorizon: 0xb91c1c,
  },
  // Episode III: Overlord — Astral violet tint + crown + rotating arcane ring
  {
    tier: 3,
    titleKey: 'bossEvo.3',
    scaleMult: 1.11,
    tint: 0xc4b5fd,
    auraColor: 0x818cf8,
    hasCrown: true,
    hasRing: true,
    hasShadowEcho: false,
    hasOmegaDoubleRing: false,
    skyTop: 0x11072e,
    skyMid: 0x3b126b,
    skyHorizon: 0x7e22ce,
  },
  // Episode IV: Calamity — Crimson-void tint + crown + ring + pulsing shadow echo
  {
    tier: 4,
    titleKey: 'bossEvo.4',
    scaleMult: 1.16,
    tint: 0xf9a8d4,
    auraColor: 0xf43f5e,
    hasCrown: true,
    hasRing: true,
    hasShadowEcho: true,
    hasOmegaDoubleRing: false,
    skyTop: 0x1c0416,
    skyMid: 0x6b0f35,
    skyHorizon: 0xbe123c,
  },
  // Episode V: True / Omega Finale — Golden radiance + double counter-rotating halo + crown + echo
  {
    tier: 5,
    titleKey: 'bossEvo.5',
    scaleMult: 1.22,
    tint: 0xfef08a,
    auraColor: 0xfacc15,
    hasCrown: true,
    hasRing: true,
    hasShadowEcho: true,
    hasOmegaDoubleRing: true,
    skyTop: 0x090414,
    skyMid: 0x450a0a,
    skyHorizon: 0xd97706,
  },
];

/** Returns visual & title evolution spec for Episode 1..5 (I..V) within a chapter. */
export function getBossEvo(episodeInChapter: number): BossEvoSpec {
  const idx = Math.max(0, Math.min(EVO_TABLE.length - 1, Math.floor(episodeInChapter) - 1));
  return EVO_TABLE[idx];
}

/** Formats Boss display name with generation title (e.g. "暗黑魔王・覺醒 II", "真・暗黑魔王 V"). */
export function formatBossName(baseName: string, evo: BossEvoSpec, evoLabel: string, roman: string): string {
  if (evo.tier === 1) return baseName;
  if (evo.tier === 5) return `${evoLabel}${baseName} ${roman}`;
  return `${baseName}・${evoLabel} ${roman}`;
}

export interface BossEvoRig {
  objects: Phaser.GameObjects.GameObject[];
  syncPosition: (x: number, y: number) => void;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

/**
 * Attaches generation-specific visual aura, crown, rotating magic ring, and shadow echo
 * around any Boss sprite (shared seamlessly by Title Screen & Boss Arena).
 */
export function createBossEvoRig(
  scene: Phaser.Scene,
  bossSprite: Phaser.GameObjects.Image,
  evo: BossEvoSpec,
  opts: { baseScale: number; screenSpace?: boolean; depthBehind: number; depthFront: number },
): BossEvoRig {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  const scale = opts.baseScale * evo.scaleMult;
  bossSprite.setScale(scale);
  if (evo.tint !== null) bossSprite.setTint(evo.tint);
  else bossSprite.clearTint();

  const x0 = bossSprite.x;
  const y0 = bossSprite.y;
  const prep = <T extends Phaser.GameObjects.GameObject & { setScrollFactor?: (x: number) => T; setDepth?: (d: number) => T }>(
    obj: T,
    depth: number,
  ): T => {
    if (opts.screenSpace && 'setScrollFactor' in obj && typeof obj.setScrollFactor === 'function') obj.setScrollFactor(0);
    if ('setDepth' in obj && typeof obj.setDepth === 'function') obj.setDepth(depth);
    objects.push(obj);
    return obj;
  };

  let auraDisc: Phaser.GameObjects.Arc | null = null;
  if (evo.auraColor !== null) {
    auraDisc = prep(scene.add.circle(x0, y0, 48 * scale, evo.auraColor, 0.2), opts.depthBehind);
    tweens.push(scene.tweens.add({ targets: auraDisc, scale: 1.18, alpha: 0.34, duration: 540, yoyo: true, repeat: -1 }));
  }

  let ringOuter: Phaser.GameObjects.Star | null = null;
  if (evo.hasRing && evo.auraColor !== null) {
    ringOuter = prep(scene.add.star(x0, y0, 8, 36 * scale, 54 * scale, evo.auraColor, 0.16).setStrokeStyle(2.5, evo.auraColor, 0.85), opts.depthBehind);
    tweens.push(scene.tweens.add({ targets: ringOuter, angle: 360, duration: 4800, repeat: -1 }));
  }

  let ringOmega: Phaser.GameObjects.Star | null = null;
  if (evo.hasOmegaDoubleRing) {
    ringOmega = prep(scene.add.star(x0, y0, 6, 44 * scale, 64 * scale, 0xf43f5e, 0.12).setStrokeStyle(3, 0xfef08a, 0.9), opts.depthBehind);
    tweens.push(scene.tweens.add({ targets: ringOmega, angle: -360, duration: 3200, repeat: -1 }));
  }

  let shadowEcho: Phaser.GameObjects.Image | null = null;
  if (evo.hasShadowEcho) {
    shadowEcho = prep(
      scene.add
        .image(x0 + 10, y0, bossSprite.texture.key)
        .setScale(scale * 1.08)
        .setFlipX(bossSprite.flipX)
        .setTint(evo.auraColor ?? 0xf43f5e)
        .setAlpha(0.32),
      opts.depthBehind,
    );
    tweens.push(scene.tweens.add({ targets: shadowEcho, alpha: 0.14, scaleX: scale * 1.16, duration: 460, yoyo: true, repeat: -1 }));
  }

  let crown: Phaser.GameObjects.Graphics | null = null;
  const crownOffsetY = -44 * scale;
  if (evo.hasCrown) {
    crown = prep(scene.add.graphics(), opts.depthFront);
    const cColor = evo.tier === 5 ? 0xfef08a : 0xfacc15;
    const gemColor = evo.tier === 5 ? 0xf43f5e : evo.auraColor ?? 0x38bdf8;
    const cw = 18 * (scale / 1.25);
    const ch = 12 * (scale / 1.25);
    crown.fillStyle(cColor, 1);
    crown.lineStyle(2, 0x13092b, 1);
    crown.beginPath();
    crown.moveTo(-cw, ch / 2);
    crown.lineTo(-cw * 0.85, -ch * 0.6);
    crown.lineTo(-cw * 0.35, 0);
    crown.lineTo(0, -ch);
    crown.lineTo(cw * 0.35, 0);
    crown.lineTo(cw * 0.85, -ch * 0.6);
    crown.lineTo(cw, ch / 2);
    crown.closePath();
    crown.fillPath();
    crown.strokePath();
    crown.fillStyle(gemColor, 1);
    crown.fillCircle(0, 0, Math.max(2.5, 3 * (scale / 1.25)));
    crown.setPosition(x0, y0 + crownOffsetY);
  }

  const syncPosition = (x: number, y: number): void => {
    if (auraDisc?.active) auraDisc.setPosition(x, y);
    if (ringOuter?.active) ringOuter.setPosition(x, y);
    if (ringOmega?.active) ringOmega.setPosition(x, y);
    if (shadowEcho?.active) {
      shadowEcho.setPosition(x + 12, y - 2);
      if (shadowEcho.texture.key !== bossSprite.texture.key) shadowEcho.setTexture(bossSprite.texture.key);
    }
    if (crown?.active) crown.setPosition(x, y + crownOffsetY);
  };

  const setVisible = (visible: boolean): void => {
    for (const o of objects) {
      if (o.active && 'setVisible' in o && typeof o.setVisible === 'function') o.setVisible(visible);
    }
  };

  const destroy = (): void => {
    for (const tw of tweens) tw.stop();
    tweens.length = 0;
    for (const o of objects) {
      if (o.active) o.destroy();
    }
    objects.length = 0;
  };

  return { objects, syncPosition, setVisible, destroy };
}
