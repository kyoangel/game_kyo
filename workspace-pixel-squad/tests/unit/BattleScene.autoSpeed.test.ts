import { describe, it, expect, beforeAll } from 'vitest';
import { readBattleSceneSource, extractMethod } from './support/extractMethod';

// Feature: auto-battle (自動攻擊) runs at 4x speed. Every action's pacing is
// driven by three independent Phaser subsystems, all scoped to this scene
// instance (none of them leak game-wide):
//   - this.time.timeScale       — delayedCall/addEvent (typewriter reveal,
//                                  the fixed pauses between steps)
//   - this.tweens.timeScale     — position tweens (stepForward/stepBack,
//                                  CharacterAnimator's walk/hit-shake) and
//                                  rollHpNumber's tweens.addCounter
//   - sprite.anims.timeScale    — per-sprite animation playback (walk/
//                                  attack/death frames). This is set
//                                  per-GameObject rather than via the
//                                  game-wide this.anims.globalTimeScale,
//                                  which would otherwise leak 4x speed into
//                                  every other scene for the rest of the
//                                  session once battle ended.
// enterAutoMode() speeds everything up; startCommandPhase() (the sole
// return path to player control, from every exit: stop button, a normal
// round ending, boss-phase transitions) resets it back to normal.

describe('BattleScene — auto-battle 4x speed', () => {
  let source: string;

  beforeAll(() => {
    source = readBattleSceneSource();
  });

  it('defines a setBattleSpeed() helper that scales time, tweens, and each view\'s sprite anims — not the game-wide globalTimeScale', () => {
    const body = extractMethod(source, 'setBattleSpeed');
    expect(body).not.toBe('');
    expect(body).toMatch(/this\.time\.timeScale\s*=/);
    expect(body).toMatch(/this\.tweens\.timeScale\s*=/);
    expect(body).toMatch(/anims\.timeScale\s*=/);
    expect(body).not.toMatch(/globalTimeScale/);
  });

  it('enterAutoMode() speeds the scene up to 4x', () => {
    const body = extractMethod(source, 'enterAutoMode');
    expect(body).toMatch(/this\.setBattleSpeed\(4\)/);
  });

  it('startCommandPhase() resets speed back to 1x — the sole return path to player control from any auto-mode exit', () => {
    const body = extractMethod(source, 'startCommandPhase');
    expect(body).toMatch(/this\.setBattleSpeed\(1\)/);
  });
});
