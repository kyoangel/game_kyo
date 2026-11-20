import type { PlatformStorage } from './types.ts';

/** localStorage-backed storage that never throws; falls back to memory (private mode, blocked storage). */
export function createSafeLocalStorage(prefix: string): PlatformStorage {
  const memory = new Map<string, string>();
  const ls = (): Storage | null => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  };
  return {
    async get(key) {
      const k = prefix + key;
      try {
        const v = ls()?.getItem(k);
        if (v !== null && v !== undefined) return v;
      } catch {
        // fall through to memory
      }
      return memory.get(k) ?? null;
    },
    async set(key, value) {
      const k = prefix + key;
      memory.set(k, value);
      try {
        ls()?.setItem(k, value);
      } catch {
        // memory copy already stored
      }
    },
  };
}
