import Phaser from 'phaser';
import { PROTAGONIST_ANIM_KEYS } from '../data/sprites';
import {
  WALK_CONFIG,
  ATTACK_CONFIG,
  IDLE_CONFIG,
  HIT_CONFIG,
  CRIT_HIT_CONFIG,
  DIE_CONFIG,
  SKILL_CAST_CONFIG,
} from './AnimationState';

export class CharacterAnimator {
  private originX: number;
  private overlays: Phaser.GameObjects.Rectangle[] = [];

  constructor(
    private scene: Phaser.Scene,
    private body: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle,
    private isSprite: boolean,
  ) {
    this.originX = body.x;
  }

  playIdleLoop(): void {
    this.scene.tweens.killTweensOf(this.body);
    if (this.isSprite) {
      const sprite = this.body as Phaser.GameObjects.Sprite;
      if (this.scene.anims.exists(PROTAGONIST_ANIM_KEYS.idle)) {
        sprite.anims.play(PROTAGONIST_ANIM_KEYS.idle, true);
      }
    } else {
      this.scene.tweens.add({
        targets: this.body,
        scaleY: IDLE_CONFIG.rect.breathingScaleY,
        duration: IDLE_CONFIG.rect.breathingDuration,
        yoyo: IDLE_CONFIG.rect.yoyo,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  playWalk(facing: 'left' | 'right', onForwardLegDone: () => void): void {
    this.scene.tweens.killTweensOf(this.body);
    const direction = facing === 'right' ? 1 : -1;
    const targetX = this.originX + direction * WALK_CONFIG.stepPx;

    if (this.isSprite) {
      const sprite = this.body as Phaser.GameObjects.Sprite;
      const walkKey = facing === 'right' ? PROTAGONIST_ANIM_KEYS.walkRight : PROTAGONIST_ANIM_KEYS.walkLeft;
      if (this.scene.anims.exists(walkKey)) {
        sprite.anims.play(walkKey, true);
      }
    }

    this.scene.tweens.add({
      targets: this.body,
      x: targetX,
      duration: WALK_CONFIG.forwardDuration,
      ease: 'Linear',
      onComplete: () => onForwardLegDone(),
    });
  }

  playAttack(facing: 'left' | 'right', onComplete: () => void): void {
    if (this.isSprite) {
      const sprite = this.body as Phaser.GameObjects.Sprite;
      const attackKey = facing === 'right' ? PROTAGONIST_ANIM_KEYS.attackRight : PROTAGONIST_ANIM_KEYS.attackLeft;
      if (this.scene.anims.exists(attackKey)) {
        sprite.once('animationcomplete', () => onComplete());
        sprite.anims.play(attackKey, true);
        return;
      }
    }

    this.scene.tweens.add({
      targets: this.body,
      scaleX: 1.15,
      duration: ATTACK_CONFIG.totalDuration / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => onComplete(),
    });
  }

  playSkillCast(flashTint: 'white' | 'green' | 'blue', onComplete: () => void): void {
    const tintMap = { white: 0xffffff, green: 0x22c55e, blue: 0x3b82f6 } as const;
    const overlay = this.scene.add.rectangle(
      this.body.x, this.body.y, 44, 56, tintMap[flashTint], 0.7,
    ).setBlendMode(Phaser.BlendModes.ADD);
    this.overlays.push(overlay);

    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: SKILL_CAST_CONFIG.flashDuration,
      ease: 'Linear',
      onComplete: () => {
        overlay.destroy();
        this.overlays = this.overlays.filter(o => o !== overlay);
        onComplete();
      },
    });
  }

  playHit(isCrit: boolean, onComplete: () => void): void {
    const cfg = isCrit ? CRIT_HIT_CONFIG : HIT_CONFIG;

    const overlay = this.scene.add.rectangle(
      this.body.x, this.body.y, 44, 56, cfg.tintColor, cfg.flashAlpha,
    );
    this.overlays.push(overlay);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: cfg.flashDuration,
      ease: 'Linear',
      onComplete: () => {
        overlay.destroy();
        this.overlays = this.overlays.filter(o => o !== overlay);
      },
    });

    const baseX = this.body.x;
    const oscillations = cfg.shakeOscillations;
    const stepDur = HIT_CONFIG.shakeDuration / (oscillations * 2);
    let count = 0;

    const shake = () => {
      if (!this.body.active) { onComplete(); return; }
      if (count >= oscillations * 2) {
        this.body.x = baseX;
        onComplete();
        return;
      }
      const offset = count % 2 === 0 ? HIT_CONFIG.shakeAmplitude : -HIT_CONFIG.shakeAmplitude;
      this.scene.tweens.add({
        targets: this.body,
        x: baseX + offset,
        duration: stepDur,
        ease: 'Linear',
        onComplete: () => { count++; shake(); },
      });
    };
    shake();
  }

  playDie(_facing: 'left' | 'right', onComplete: () => void): void {
    this.scene.tweens.killTweensOf(this.body);
    if (this.isSprite) {
      const sprite = this.body as Phaser.GameObjects.Sprite;
      if (this.scene.anims.exists(PROTAGONIST_ANIM_KEYS.death)) {
        sprite.anims.play(PROTAGONIST_ANIM_KEYS.death, true);
        this.scene.time.delayedCall(DIE_CONFIG.sprite.totalDuration, () => {
          if (sprite.active) sprite.setAlpha(DIE_CONFIG.sprite.settleAlpha);
          onComplete();
        });
        return;
      }
    }

    this.scene.tweens.add({
      targets: this.body,
      alpha: DIE_CONFIG.rect.settleAlpha,
      angle: DIE_CONFIG.rect.rotationDeg,
      duration: DIE_CONFIG.rect.totalDuration,
      ease: 'Linear',
      onComplete: () => onComplete(),
    });
  }

  returnToIdle(): void {
    this.scene.tweens.killTweensOf(this.body);
    this.scene.tweens.add({
      targets: this.body,
      x: this.originX,
      scaleX: 1,
      duration: WALK_CONFIG.returnDuration,
      ease: 'Linear',
      onComplete: () => {
        if (this.body.active) this.playIdleLoop();
      },
    });
  }

  killAllTweens(): void {
    this.scene.tweens.killTweensOf(this.body);
    this.overlays.forEach(o => {
      if (o.active) {
        this.scene.tweens.killTweensOf(o);
        o.destroy();
      }
    });
    this.overlays = [];
  }
}
