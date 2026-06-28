import { Colors } from './theme';

export interface FloatingNumberConfig {
  text: string;
  color: number;
  x: number;
  y: number;
  targetY: number;
  duration: number;
  alphaFrom: number;
  alphaTo: number;
}

export function createFloatingNumberConfig(
  amount: number,
  isHeal: boolean,
  x: number,
  y: number,
): FloatingNumberConfig {
  return {
    text: String(amount),
    color: isHeal ? Colors.TEXT_ACCENT : Colors.TEXT_RED,
    x,
    y,
    targetY: y - 30,
    duration: 600,
    alphaFrom: 1,
    alphaTo: 0,
  };
}

export function createMissConfig(x: number, y: number): FloatingNumberConfig {
  return {
    text: 'MISS',
    color: Colors.TEXT_DIM,
    x,
    y,
    targetY: y - 30,
    duration: 600,
    alphaFrom: 1,
    alphaTo: 0,
  };
}
