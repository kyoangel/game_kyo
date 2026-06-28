export const FADE_IN_DURATION_MS = 300;
export const FADE_OUT_DURATION_MS = 200;

export interface FadeConfig {
  alphaFrom: number;
  alphaTo: number;
  duration: number;
  color: number;
}

export function buildFadeInConfig(): FadeConfig {
  return {
    alphaFrom: 1,
    alphaTo: 0,
    duration: FADE_IN_DURATION_MS,
    color: 0x000000,
  };
}

export function buildFadeOutConfig(): FadeConfig {
  return {
    alphaFrom: 0,
    alphaTo: 1,
    duration: FADE_OUT_DURATION_MS,
    color: 0x000000,
  };
}
