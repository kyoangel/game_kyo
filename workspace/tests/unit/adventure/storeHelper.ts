import type { KeyValueStore } from "../../../src/adventure/storage";

/** In-memory KeyValueStore; `failWrites` makes setItem throw like a full or blocked localStorage. */
export function memoryStore(initial: Record<string, string> = {}, failWrites = false): KeyValueStore & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      if (failWrites) throw new Error("QuotaExceededError");
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}
