#!/usr/bin/env node
// Exports v1's ISSUERS_BY_CURRENCY + ACTORS_BY_CURRENCY + GLOBAL_HUB_ACTORS to JSON.
// Run from repo root: pnpm tsx corlens_v2/tools/export-currency-meta.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTORS_BY_CURRENCY,
  GLOBAL_HUB_ACTORS,
  ISSUERS_BY_CURRENCY,
} from "../../corlens/apps/server/src/corridors/catalog.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../apps/corridor/seed/currency-meta.json");

const codes = new Set([...Object.keys(ISSUERS_BY_CURRENCY), ...Object.keys(ACTORS_BY_CURRENCY)]);
const now = new Date().toISOString();
const currencies = [...codes].sort().map((code) => ({
  code,
  issuers: ISSUERS_BY_CURRENCY[code] ?? [],
  actors: ACTORS_BY_CURRENCY[code] ?? [],
  updatedAt: now,
}));
const payload = { currencies, globalHubs: GLOBAL_HUB_ACTORS };

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`Wrote ${currencies.length} currencies + ${GLOBAL_HUB_ACTORS.length} hubs to ${out}`);
