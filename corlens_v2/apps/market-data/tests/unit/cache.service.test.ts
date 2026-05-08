import { describe, expect, it, vi } from "vitest";
import { createCacheService } from "../../src/services/cache.service.js";

class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();
  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
    return e.value;
  }
  async set(key: string, value: string, mode: "EX", ttl: number): Promise<"OK"> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return "OK";
  }
}

describe("cache.service", () => {
  it("returns cached value when present", async () => {
    const r = new FakeRedis();
    await r.set("k", JSON.stringify({ x: 1 }), "EX", 60);
    const cache = createCacheService({ redis: r as never });
    const fetcher = vi.fn(async () => ({ x: 999 }));
    const result = await cache.getOrSet("k", 60, fetcher);
    expect(result).toEqual({ x: 1 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls fetcher and stores result on miss", async () => {
    const r = new FakeRedis();
    const cache = createCacheService({ redis: r as never });
    const fetcher = vi.fn(async () => ({ y: 2 }));
    const result = await cache.getOrSet("k", 60, fetcher);
    expect(result).toEqual({ y: 2 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await r.get("k")).toBe(JSON.stringify({ y: 2 }));
  });

  it("does not cache when fetcher throws", async () => {
    const r = new FakeRedis();
    const cache = createCacheService({ redis: r as never });
    await expect(cache.getOrSet("k", 60, async () => { throw new Error("fail"); })).rejects.toThrow("fail");
    expect(await r.get("k")).toBeNull();
  });

  it("namespaces keys with the given prefix", async () => {
    const r = new FakeRedis();
    const cache = createCacheService({ redis: r as never, prefix: "md:" });
    await cache.getOrSet("foo", 60, async () => 1);
    expect(await r.get("md:foo")).toBe("1");
  });
});
