import type { Rng } from "../grid";

/** Small deterministic generator (mulberry32): the same seed always gives the same sequence in [0, 1). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `?seed=N` support for e2e tests (spec 10). Only honoured in dev builds
 * (`dev` = `import.meta.env.DEV`): a production build ignores the parameter.
 * Returns null when there is no usable seed.
 */
export function seededRngFromSearch(search: string, dev: boolean): Rng | null {
  if (!dev) return null;
  const raw = new URLSearchParams(search).get("seed");
  if (raw === null || !/^-?\d+$/.test(raw)) return null;
  return mulberry32(Number(raw));
}
