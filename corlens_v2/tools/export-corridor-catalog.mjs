#!/usr/bin/env node
// Exports the full 2436-corridor catalog from the v1 monolith into
// corlens_v2/apps/corridor/seed/corridors.json.
//
// Run from anywhere:
//   node corlens_v2/tools/export-corridor-catalog.mjs
//
// Implementation note: v1's catalog.ts imports from "@corlens/core". The
// import only resolves inside corlens/apps/server, so this script invokes
// tsx from that directory to evaluate a small loader and pipe stdout JSON
// back to us.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const v2Root = resolve(__dirname, "..");
const v1ServerDir = resolve(v2Root, "..", "corlens", "apps", "server");
const seedFile = resolve(v2Root, "apps", "corridor", "seed", "corridors.json");

const loaderSrc = `
import { CORRIDOR_CATALOG } from "./src/corridors/catalog.ts";
const out = CORRIDOR_CATALOG.map((c) => ({
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
  highlights: c.highlights ?? [],
  amount: c.amount ?? null,
  source: c.source ?? null,
  dest: c.dest ?? null,
}));
process.stdout.write(JSON.stringify(out));
`;

const loaderPath = resolve(v1ServerDir, ".export-loader.mts");
writeFileSync(loaderPath, loaderSrc);

let raw;
try {
  raw = execFileSync(
    resolve(v1ServerDir, "node_modules", ".bin", "tsx"),
    [".export-loader.mts"],
    { cwd: v1ServerDir, maxBuffer: 64 * 1024 * 1024 },
  ).toString();
} finally {
  try {
    execFileSync("rm", [loaderPath]);
  } catch {
    // best-effort cleanup
  }
}

const corridors = JSON.parse(raw);
mkdirSync(dirname(seedFile), { recursive: true });
writeFileSync(
  seedFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: corridors.length,
      corridors,
    },
    null,
    2,
  ),
);

console.log(`Wrote ${corridors.length} corridors to ${seedFile}`);
