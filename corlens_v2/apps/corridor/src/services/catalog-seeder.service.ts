import { readFileSync } from "node:fs";
import type { CorridorRepo } from "../repositories/corridor.repo.js";

type SeedCorridor = {
  id: string;
  label: string;
  shortLabel: string;
  flag: string;
  tier: number;
  importance: number;
  region: string;
  category: string;
  description: string;
  useCase: string;
  highlights: string[];
  amount: string | null;
  source: unknown;
  dest: unknown;
};

function normalizeAsset(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  if (typeof r.currency === "string") return raw;
  if (typeof r.symbol === "string") {
    const { symbol, ...rest } = r;
    return { currency: symbol, ...rest };
  }
  return raw;
}

export type CatalogSeederOptions = {
  repo: CorridorRepo;
  seedPath: string;
};

export function createCatalogSeeder(opts: CatalogSeederOptions) {
  return {
    async seedIfEmpty(): Promise<{ seeded: boolean; total: number }> {
      const existing = await opts.repo.count();
      if (existing > 0) return { seeded: false, total: existing };

      const raw = JSON.parse(readFileSync(opts.seedPath, "utf-8")) as { corridors: SeedCorridor[] };
      const rows = raw.corridors.map((c) => ({
        id: c.id,
        label: c.label,
        shortLabel: c.shortLabel,
        flag: c.flag,
        tier: c.tier,
        importance: c.importance,
        region: c.region,
        category: c.category,
        description: c.description,
        useCase: c.useCase,
        highlights: c.highlights,
        amount: c.amount,
        sourceJson: normalizeAsset(c.source),
        destJson: normalizeAsset(c.dest),
      }));
      await opts.repo.upsertSeed(rows);
      return { seeded: true, total: rows.length };
    },
  };
}

export type CatalogSeeder = ReturnType<typeof createCatalogSeeder>;
