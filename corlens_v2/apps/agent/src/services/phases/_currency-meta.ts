// Slim port of v1's catalog ISSUERS_BY_CURRENCY / ACTORS_BY_CURRENCY /
// classifyOffChainBridgeStatus. v2 corridor service does not yet expose a
// per-currency meta endpoint; we keep a hard-coded subset for the major
// currencies the agent needs. Currencies not listed fall back to empty arrays
// (off-chain corridor with no on-chain IOU).

export const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
export const USDC_ISSUER = "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE";
export const XRP_RLUSD_AMM = "rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3";

export type IssuerEntry = { key: string; name: string; address: string };

export type ActorEntry = {
  key: string;
  name: string;
  type: string;
  country?: string;
  supportsXrp?: boolean;
  supportsRlusd?: boolean;
  odl?: boolean;
  note?: string;
};

const ADDR = {
  BITSTAMP: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
  GATEHUB: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
  GATEHUB_GBP: "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g",
  GATEHUB_USDC: "rcEGREd8NmkKRE8GE424sksyt1tJVFZwu",
  GATEHUB_USDT: "rcvxE9PS9YBwxtGg1qNeewV6ZB3wGubZq",
  RLUSD: RLUSD_ISSUER,
  CIRCLE_USDC: USDC_ISSUER,
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

// v1 KNOWN_XRPL_ADDRESSES: well-known exchange hot wallets
export const KNOWN_XRPL_ADDRESSES: Record<string, { address: string; label: string }> = {
  bitstamp: { address: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", label: "Bitstamp" },
  "bitstamp-us": { address: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", label: "Bitstamp" },
  "bitstamp-eu": { address: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", label: "Bitstamp" },
  kraken: { address: "rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh", label: "Kraken" },
  "kraken-eu": { address: "rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh", label: "Kraken" },
  "kraken-uk": { address: "rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh", label: "Kraken" },
  binance: { address: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh", label: "Binance" },
  gatehub: { address: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq", label: "GateHub" },
  sologenic: { address: "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz", label: "Sologenic" },
};

// v1 PARTNER_DEPTH_BOOKS subset: actor-key → "<partnerActor>:<book>" used by
// v2 market-data partner-depth route. Only known stable pairs; a corridor /
// actor not present here gracefully degrades.
export const PARTNER_DEPTH_BOOKS: Record<string, { actor: string; book: string }> = {
  "usd-mxn:bitso": { actor: "bitso", book: "xrp_mxn" },
  "mxn-usd:bitso": { actor: "bitso", book: "xrp_mxn" },
  "usd-eur:kraken": { actor: "kraken", book: "XXRPZUSD" },
  "eur-usd:kraken": { actor: "kraken", book: "XXRPZUSD" },
};

export function rankActors(actors: ActorEntry[]): ActorEntry[] {
  return [...actors].sort((a, b) => {
    const sa = (a.odl ? 100 : 0) + (a.supportsRlusd ? 50 : 0) + (a.supportsXrp ? 10 : 0);
    const sb = (b.odl ? 100 : 0) + (b.supportsRlusd ? 50 : 0) + (b.supportsXrp ? 10 : 0);
    return sb - sa;
  });
}

export type OffChainBridgeClassification = {
  status: "GREEN" | "AMBER" | "RED";
  srcScore: number;
  dstScore: number;
  reason: string;
};

function scoreActorSide(actors: ActorEntry[] | undefined): number {
  if (!actors || actors.length === 0) return 0;
  let best = 0;
  for (const a of actors) {
    let s = 0;
    if (a.odl) s += 3;
    if (a.supportsRlusd) s += 2;
    if (a.supportsXrp) s += 1;
    if (s > best) best = s;
  }
  const breadth = Math.min(3, actors.length - 1);
  return best + breadth;
}

export function classifyOffChainBridgeStatus(
  srcActors: ActorEntry[],
  dstActors: ActorEntry[],
): OffChainBridgeClassification {
  const srcScore = scoreActorSide(srcActors);
  const dstScore = scoreActorSide(dstActors);
  const m = Math.min(srcScore, dstScore);
  if (m >= 4) {
    return {
      status: "GREEN",
      srcScore,
      dstScore,
      reason: `Both sides strong: src ${srcScore}, dst ${dstScore}. ODL partners and/or RLUSD venues confirmed.`,
    };
  }
  if (m >= 2) {
    return {
      status: "AMBER",
      srcScore,
      dstScore,
      reason: `Workable but single-counterparty risk: src ${srcScore}, dst ${dstScore}.`,
    };
  }
  return {
    status: "RED",
    srcScore,
    dstScore,
    reason: `Thin coverage: src ${srcScore}, dst ${dstScore}.`,
  };
}
