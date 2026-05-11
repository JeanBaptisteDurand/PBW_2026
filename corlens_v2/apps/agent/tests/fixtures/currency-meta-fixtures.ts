// Test-only fixture data for currency-meta dictionaries.
// These were previously exported from src/data/xrpl-utils.ts but moved here
// after Phase 3 made the corridor connector the single source of truth for
// currency-meta. Production code must NOT import from this file.

import type { ActorEntry, IssuerEntry } from "../../src/data/xrpl-utils.js";

// Canonical XRPL issuer addresses referenced by the fixture data below.
const ADDR = {
  BITSTAMP: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
  GATEHUB: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
  GATEHUB_GBP: "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g",
  GATEHUB_USDC: "rcEGREd8NmkKRE8GE424sksyt1tJVFZwu",
  GATEHUB_USDT: "rcvxE9PS9YBwxtGg1qNeewV6ZB3wGubZq",
  RLUSD: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
  CIRCLE_USDC: "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE",
  SCHUMAN_EUROP: "rMkEuRii9w9uBMQDnWV5AA43gvYZR9JxVK",
  JPY_MR_EXCHANGE: "rB3gZey7VWHYRqJHLoHDEJXJ2pEPNieKiS",
  JPY_TOKYO: "rMAz5ZnK73nyNUL4foAvaxdreczCkG3vA6",
  CNY_RIPPLEFOX: "rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y",
  SNAPSWAP: "rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q",
  BBRL_BRAZA: "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt",
  SOLOGENIC: "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
} as const;

export const ISSUERS_BY_CURRENCY: Record<string, IssuerEntry[]> = {
  USD: [
    { key: "rlusd", name: "Ripple (RLUSD)", address: ADDR.RLUSD },
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB },
    { key: "snap", name: "SnapSwap", address: ADDR.SNAPSWAP },
    { key: "bs", name: "Bitstamp (legacy)", address: ADDR.BITSTAMP },
  ],
  EUR: [
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB },
    { key: "europ", name: "Schuman EURØP", address: ADDR.SCHUMAN_EUROP },
    { key: "snap", name: "SnapSwap", address: ADDR.SNAPSWAP },
  ],
  GBP: [
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB_GBP },
    { key: "snap", name: "SnapSwap", address: ADDR.SNAPSWAP },
  ],
  JPY: [
    { key: "mx", name: "Mr. Exchange", address: ADDR.JPY_MR_EXCHANGE },
    { key: "tokyo", name: "Tokyo JPY Gateway", address: ADDR.JPY_TOKYO },
  ],
  CNY: [{ key: "fox", name: "RippleFox", address: ADDR.CNY_RIPPLEFOX }],
  RLUSD: [{ key: "ripple", name: "Ripple", address: ADDR.RLUSD }],
  USDC: [
    { key: "circle", name: "Circle", address: ADDR.CIRCLE_USDC },
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB_USDC },
  ],
  USDT: [{ key: "gh", name: "GateHub", address: ADDR.GATEHUB_USDT }],
  BBRL: [{ key: "braza", name: "Braza Bank", address: ADDR.BBRL_BRAZA }],
  SOLO: [{ key: "solo", name: "Sologenic", address: ADDR.SOLOGENIC }],
};

export const ACTORS_BY_CURRENCY: Record<string, ActorEntry[]> = {
  USD: [
    {
      key: "kraken",
      name: "Kraken",
      type: "cex",
      country: "US",
      supportsXrp: true,
      supportsRlusd: true,
    },
    { key: "coinbase", name: "Coinbase", type: "cex", country: "US", supportsXrp: true },
    {
      key: "uphold",
      name: "Uphold",
      type: "cex",
      country: "US",
      supportsXrp: true,
      supportsRlusd: true,
    },
    {
      key: "bitstamp-us",
      name: "Bitstamp US",
      type: "cex",
      country: "US",
      supportsXrp: true,
      supportsRlusd: true,
    },
    {
      key: "convera",
      name: "Convera",
      type: "odl",
      country: "US",
      supportsXrp: true,
      supportsRlusd: true,
      odl: true,
    },
  ],
  EUR: [
    {
      key: "bitstamp-eu",
      name: "Bitstamp (LU)",
      type: "cex",
      country: "LU",
      supportsXrp: true,
      supportsRlusd: true,
      odl: true,
    },
    {
      key: "kraken-eu",
      name: "Kraken (IE)",
      type: "cex",
      country: "IE",
      supportsXrp: true,
      supportsRlusd: true,
    },
    { key: "lemonway", name: "Lemonway", type: "odl", country: "FR", supportsXrp: true, odl: true },
  ],
  GBP: [
    {
      key: "kraken-uk",
      name: "Kraken UK",
      type: "cex",
      country: "UK",
      supportsXrp: true,
      supportsRlusd: true,
    },
    { key: "modulr", name: "Modulr", type: "odl", country: "UK", supportsXrp: true, odl: true },
  ],
  MXN: [
    {
      key: "bitso",
      name: "Bitso",
      type: "cex",
      country: "MX",
      supportsXrp: true,
      supportsRlusd: true,
      odl: true,
    },
  ],
  BRL: [
    {
      key: "travelex-bank",
      name: "Travelex Bank",
      type: "bank",
      country: "BR",
      supportsXrp: true,
      supportsRlusd: true,
      odl: true,
    },
    {
      key: "mercado-bitcoin",
      name: "Mercado Bitcoin",
      type: "cex",
      country: "BR",
      supportsXrp: true,
      supportsRlusd: true,
      odl: true,
    },
  ],
  JPY: [
    {
      key: "sbi-vc",
      name: "SBI VC Trade",
      type: "cex",
      country: "JP",
      supportsXrp: true,
      supportsRlusd: true,
      odl: true,
    },
    {
      key: "sbi-remit",
      name: "SBI Remit",
      type: "odl",
      country: "JP",
      supportsXrp: true,
      odl: true,
    },
  ],
  CNY: [],
  RLUSD: [{ key: "ripple", name: "Ripple", type: "issuer", country: "US", supportsRlusd: true }],
  XRP: [],
};
