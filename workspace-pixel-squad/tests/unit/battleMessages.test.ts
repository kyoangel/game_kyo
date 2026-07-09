import { describe, it, expect } from 'vitest';
import {
  attackMessage,
  skillMessage,
  damageMessage,
  missMessage,
  defeatMessage,
  defendMessage,
  healMessage,
} from '../../src/ui/battleMessages';

describe('battleMessages', () => {
  it('攻擊', () => expect(attackMessage('Rex')).toBe('Rex 的攻擊!'));
  it('技能', () => expect(skillMessage('Nyx', '狙擊')).toBe('Nyx 使出 狙擊!'));
  it('傷害', () => expect(damageMessage('敵人', 142)).toBe('敵人 受到 142 點傷害!'));
  it('暴擊前綴', () => expect(damageMessage('敵人', 300, { crit: true })).toBe('會心一擊!敵人 受到 300 點傷害!'));
  it('弱點前綴', () => expect(damageMessage('敵人', 200, { weakness: true })).toBe('擊中弱點!敵人 受到 200 點傷害!'));
  it('暴擊優先於弱點', () =>
    expect(damageMessage('敵人', 400, { crit: true, weakness: true })).toBe('會心一擊!敵人 受到 400 點傷害!'));
  it('MISS', () => expect(missMessage('Echo')).toBe('Echo 閃過了攻擊!'));
  it('擊敗', () => expect(defeatMessage('demon')).toBe('demon 被擊敗了!'));
  it('防禦', () => expect(defendMessage('Rook')).toBe('Rook 擺出防禦姿態。'));
  it('回復', () => expect(healMessage('Mira', 80)).toBe('Mira 回復了 80 點兵力!'));
});
