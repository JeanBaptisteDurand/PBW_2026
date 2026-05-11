import { readFileSync } from "node:fs";
import type { corridor as cc } from "@corlens/contracts";
import type { CurrencyMetaRepo } from "../repositories/currency-meta.repo.js";

type ActorEntry = cc.ActorEntry;

export type SeedResult = { seeded: number; alreadyPresent: number };

export function createCurrencyMetaSeeder(deps: {
  repo: CurrencyMetaRepo;
  seedPath: string;
}): {
  seedIfEmpty(): Promise<SeedResult>;
  globalHubs(): ActorEntry[];
} {
  let cachedHubs: ActorEntry[] | null = null;
  function load() {
    const raw = readFileSync(deps.seedPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      currencies: { code: string; issuers: unknown; actors: unknown }[];
      globalHubs: ActorEntry[];
    };
    cachedHubs = parsed.globalHubs;
    return parsed;
  }
  return {
    async seedIfEmpty() {
      const existing = await deps.repo.count();
      if (existing > 0) {
        if (cachedHubs === null) load();
        return { seeded: 0, alreadyPresent: existing };
      }
      const parsed = load();
      const seeded = await deps.repo.upsertMany(parsed.currencies);
      return { seeded, alreadyPresent: 0 };
    },
    globalHubs() {
      if (cachedHubs === null) load();
      return cachedHubs ?? [];
    },
  };
}
