// Kept as a compat shim — the source of truth moved to the server catalog
// (apps/server/src/corridors/catalog.ts) and is fetched via GET /api/corridors.
//
// Legacy consumers (Safe Path demo, old Playwright tests) still import the
// narrow CorridorDef shape from this file. We keep the original six entries
// here so those callers keep working without needing a backend round-trip.

import { RLUSD_ISSUER } from "@corlens/core";
import type { CorridorRequest } from "@corlens/core";

const BITSTAMP = "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B";
const GATEHUB = "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq";
const SOLOGENIC = "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz";
const RIPPLE_HISTORICAL = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";

export interface CorridorDef {
  id: string;
  label: string;
  shortLabel: string;
  flag: string;
  description: string;
  useCase: string;
  request: CorridorRequest;
}

/**
 * @deprecated These six corridors are kept as a minimal offline set for
 * Safe Path demo & legacy tests. Prefer `api.listCorridors()` which returns
 * the full live-scanned catalog from the server cache.
 */
export const CORRIDORS: CorridorDef[] = [
  {
    id: "usd-bs-usd-gh",
    label: "USD Gateway Cross-Settlement",
    shortLabel: "USD.Bitstamp → USD.GateHub",
    flag: "💵 ↔ 💵",
    description:
      "Institutional cash rebalancing between two USD-issuing gateways.",
    useCase: "Treasury rebalancing.",
    request: {
      sourceCurrency: "USD",
      sourceIssuer: BITSTAMP,
      sourceAccount: BITSTAMP,
      destCurrency: "USD",
      destIssuer: GATEHUB,
      amount: "5000",
    },
  },
  {
    id: "usd-bs-eur-gh",
    label: "Transatlantic USD → EUR",
    shortLabel: "USD.Bitstamp → EUR.GateHub",
    flag: "🇺🇸 → 🇪🇺",
    description: "Cross-currency FX lane from USD to EUR.",
    useCase: "Corporate cross-border payables.",
    request: {
      sourceCurrency: "USD",
      sourceIssuer: BITSTAMP,
      sourceAccount: BITSTAMP,
      destCurrency: "EUR",
      destIssuer: GATEHUB,
      amount: "1000",
    },
  },
  {
    id: "usd-bs-rlusd",
    label: "Fiat → RLUSD On-Ramp",
    shortLabel: "USD.Bitstamp → RLUSD",
    flag: "💵 → 🏦",
    description: "Classic institutional stablecoin on-ramp.",
    useCase: "RLUSD treasury allocations.",
    request: {
      sourceCurrency: "USD",
      sourceIssuer: BITSTAMP,
      sourceAccount: BITSTAMP,
      destCurrency: "RLUSD",
      destIssuer: RLUSD_ISSUER,
      amount: "500",
    },
  },
  {
    id: "usd-bs-btc-bs",
    label: "USD → Wrapped BTC",
    shortLabel: "USD.Bitstamp → BTC.Bitstamp",
    flag: "💵 → ₿",
    description: "Institutional spot lane.",
    useCase: "Exchange spot desk settlement.",
    request: {
      sourceCurrency: "USD",
      sourceIssuer: BITSTAMP,
      sourceAccount: BITSTAMP,
      destCurrency: "BTC",
      destIssuer: BITSTAMP,
      amount: "0.01",
    },
  },
  {
    id: "xrp-usd-bs",
    label: "XRP → USD Off-Ramp",
    shortLabel: "XRP → USD.Bitstamp",
    flag: "XRP → 💵",
    description: "Native XRP off-ramp.",
    useCase: "ODL destination leg.",
    request: {
      sourceCurrency: "XRP",
      sourceAccount: RIPPLE_HISTORICAL,
      destCurrency: "USD",
      destIssuer: BITSTAMP,
      amount: "10",
    },
  },
  {
    id: "xrp-solo",
    label: "XRP → SOLO Brokerage",
    shortLabel: "XRP → SOLO",
    flag: "XRP → 🪙",
    description: "Sologenic brokerage lane.",
    useCase: "Tokenized asset access.",
    request: {
      sourceCurrency: "XRP",
      sourceAccount: RIPPLE_HISTORICAL,
      destCurrency: "SOLO",
      destIssuer: SOLOGENIC,
      amount: "100",
    },
  },
];

export function getCorridorById(id: string): CorridorDef | undefined {
  return CORRIDORS.find((c) => c.id === id);
}
