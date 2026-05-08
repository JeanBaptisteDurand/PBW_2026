import type { Redis } from "ioredis";

export type CacheServiceOptions = {
  redis: Redis;
  prefix?: string;
};

export type CacheService = ReturnType<typeof createCacheService>;

export function createCacheService(opts: CacheServiceOptions) {
  const prefix = opts.prefix ?? "";

  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await opts.redis.get(prefix + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    },

    async set<T>(key: string, ttlSeconds: number, value: T): Promise<void> {
      await opts.redis.set(prefix + key, JSON.stringify(value), "EX", ttlSeconds);
    },

    async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
      const cached = await this.get<T>(key);
      if (cached !== null) return cached;
      const fresh = await fetcher();
      await this.set(key, ttlSeconds, fresh);
      return fresh;
    },
  };
}
