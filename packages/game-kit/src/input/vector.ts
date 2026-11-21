export interface Vec {
  x: number;
  y: number;
}

export function keyVector(k: { left: boolean; right: boolean; up: boolean; down: boolean }): Vec {
  const x = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  const y = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  if (x !== 0 && y !== 0) return { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 };
  return { x, y };
}

export function joystickVector(origin: Vec, pointer: Vec, radius: number, deadZone = 8): Vec {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len < deadZone || len === 0) return { x: 0, y: 0 };
  const scale = Math.min(len / radius, 1) / len;
  return { x: dx * scale, y: dy * scale };
}
