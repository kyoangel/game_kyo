import type { PlatformStorage } from '@gf/platform';

export class SaveData {
  private readonly storage: PlatformStorage;
  private readonly slug: string;

  constructor(storage: PlatformStorage, slug: string) {
    this.storage = storage;
    this.slug = slug;
  }

  private k(key: string): string {
    return `${this.slug}:${key}`;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    try {
      const raw = await this.storage.get(this.k(key));
      if (raw === null || raw.trim() === '') return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }

  async setNumber(key: string, value: number): Promise<void> {
    await this.storage.set(this.k(key), String(value));
  }

  async getJSON<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await this.storage.get(this.k(key));
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.storage.set(this.k(key), JSON.stringify(value));
  }
}
