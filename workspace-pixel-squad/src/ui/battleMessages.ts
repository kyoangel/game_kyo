// Battle message templates for the tenchi2-style typewriter window.
// See docs/specs/pixel-squad/battle-screen-tenchi2-homage.md "戰鬥演出".

export function attackMessage(name: string): string {
  return `${name} 的攻擊!`;
}

export function skillMessage(name: string, skill: string): string {
  return `${name} 使出 ${skill}!`;
}

export function damageMessage(name: string, dmg: number, opts?: { crit?: boolean; weakness?: boolean }): string {
  const prefix = opts?.crit ? '會心一擊!' : opts?.weakness ? '擊中弱點!' : '';
  return `${prefix}${name} 受到 ${dmg} 點傷害!`;
}

export function missMessage(name: string): string {
  return `${name} 閃過了攻擊!`;
}

export function defeatMessage(name: string): string {
  return `${name} 被擊敗了!`;
}

export function defendMessage(name: string): string {
  return `${name} 擺出防禦姿態。`;
}

export function healMessage(name: string, amount: number): string {
  return `${name} 回復了 ${amount} 點兵力!`;
}
