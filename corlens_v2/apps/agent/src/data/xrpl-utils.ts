// Stable XRPL on-ledger addresses used by the agent for entity analysis.
// These are canonical, immutable addresses — no need to load from the corridor
// service. Split from the old currency-meta.ts after the corridor connector
// started serving CurrencyMeta (Phase 3 refactor).

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
