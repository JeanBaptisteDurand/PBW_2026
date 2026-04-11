import type {
  CorridorLiquiditySnapshot,
  CorridorRouteCandidate,
} from "@xrplens/core";
import type { XRPLClientWrapper } from "../xrpl/client.js";
import { logger } from "../logger.js";

// ─── Liquidity scanner with per-pass cache ─────────────────────────────────
// Each refresh pass instantiates a ScanCache that memoizes by (asset, asset)
// pair so we never re-issue book_offers / amm_info / gateway_balances calls
// across the dozens of routes that share the same legs.

const KNOWN_HEX: Record<string, string> = {
  RLUSD: "524C555344000000000000000000000000000000",
  SOLO: "534F4C4F00000000000000000000000000000000",
};

function toWireCurrency(c: string): string {
  if (c === "XRP") return "XRP";
  if (c.length === 3) return c;
  return KNOWN_HEX[c.toUpperCase()] ?? c;
}

interface Asset {
  currency: string;
  issuer?: string;
}

function iouAsset(currency: string, issuer: string): Asset {
  return { currency: toWireCurrency(currency), issuer };
}

const XRP_ASSET: Asset = { currency: "XRP" };

// ─── Cache key helpers ─────────────────────────────────────────────────────

function assetKey(a: Asset): string {
  return a.currency === "XRP" ? "XRP" : `${a.currency}:${a.issuer}`;
}
function pairKey(a: Asset, b: Asset): string {
  return `${assetKey(a)}|${assetKey(b)}`;
}

// ─── Per-pass cache ────────────────────────────────────────────────────────

export class ScanCache {
  private books = new Map<string, Promise<number>>();
  private amms = new Map<string, Promise<CorridorLiquiditySnapshot["amm"] | undefined>>();
  private obligations = new Map<string, Promise<string | undefined>>();

  constructor(private client: XRPLClientWrapper) {}

  async bookOffers(takerGets: Asset, takerPays: Asset): Promise<number> {
    const key = pairKey(takerGets, takerPays);
    let p = this.books.get(key);
    if (!p) {
      p = (async () => {
        try {
          const r = (await this.client.request("book_offers", {
            taker_gets: takerGets,
            taker_pays: takerPays,
            limit: 20,
            ledger_index: "validated",
          })) as any;
          return (r?.result?.offers ?? []).length;
        } catch (err: any) {
          logger.debug("[scanner] book_offers failed", { error: err?.message });
          return 0;
        }
      })();
      this.books.set(key, p);
    }
    return p;
  }

  async ammPool(
    a1: Asset,
    a2: Asset,
  ): Promise<CorridorLiquiditySnapshot["amm"] | undefined> {
    // AMM pools are unordered — normalize so XRP/IOU and IOU/XRP share a slot.
    const [x, y] = a1.currency === "XRP" ? [a1, a2] : [a2, a1];
    const key = pairKey(x, y);
    let p = this.amms.get(key);
    if (!p) {
      p = (async () => {
        try {
          const r = (await this.client.request("amm_info", {
            asset: x,
            asset2: y,
            ledger_index: "validated",
          })) as any;
          const amm = r?.result?.amm;
          if (!amm) return undefined;
          const amountA = amm.amount;
          const amountB = amm.amount2;
          return {
            xrpReserve:
              typeof amountA === "string"
                ? amountA
                : typeof amountB === "string"
                  ? amountB
                  : undefined,
            iouReserve:
              typeof amountA === "object" ? amountA?.value : amountB?.value,
            tvlUsd: null,
          };
        } catch (err: any) {
          logger.debug("[scanner] amm_info miss", { error: err?.message });
          return undefined;
        }
      })();
      this.amms.set(key, p);
    }
    return p;
  }

  async gatewayObligation(
    issuer: string,
    currency: string,
  ): Promise<string | undefined> {
    const key = `${issuer}:${currency}`;
    let p = this.obligations.get(key);
    if (!p) {
      p = (async () => {
        try {
          const r = (await this.client.request("gateway_balances", {
            account: issuer,
            ledger_index: "validated",
          })) as any;
          const obligations = r?.result?.obligations ?? {};
          const wire = toWireCurrency(currency);
          return obligations[wire] ?? obligations[currency];
        } catch (err: any) {
          logger.debug("[scanner] gateway_balances failed", { error: err?.message });
          return undefined;
        }
      })();
      this.obligations.set(key, p);
    }
    return p;
  }
}

// ─── Public: scan one route ────────────────────────────────────────────────

export async function scanRouteLiquidity(
  cache: ScanCache,
  route: CorridorRouteCandidate,
): Promise<CorridorLiquiditySnapshot> {
  const snap: CorridorLiquiditySnapshot = { notes: [] };

  const destAsset = iouAsset(route.request.destCurrency, route.request.destIssuer);
  const srcIsXRP = route.request.sourceCurrency === "XRP";
  const srcAsset = srcIsXRP
    ? XRP_ASSET
    : iouAsset(route.request.sourceCurrency, route.request.sourceIssuer ?? "");

  // 1. XRP ↔ dest leg
  if (route.request.destCurrency !== "XRP") {
    const toIou = await cache.bookOffers(XRP_ASSET, destAsset);
    const toXrp = await cache.bookOffers(destAsset, XRP_ASSET);
    snap.xrpLeg = { toIouOffers: toIou, toXrpOffers: toXrp };
  }

  // 2. AMM pool for XRP ↔ dest
  if (route.request.destCurrency !== "XRP") {
    const amm = await cache.ammPool(XRP_ASSET, destAsset);
    if (amm) snap.amm = amm;
  }

  // 3. Direct cross-book — only for IOU sources, different (issuer or currency)
  if (!srcIsXRP && srcAsset.issuer) {
    const sameIssuerSameCurrency =
      route.request.sourceCurrency === route.request.destCurrency &&
      route.request.sourceIssuer === route.request.destIssuer;
    if (!sameIssuerSameCurrency) {
      const fwd = await cache.bookOffers(srcAsset, destAsset);
      const rev = await cache.bookOffers(destAsset, srcAsset);
      snap.directBook = { fwdOffers: fwd, revOffers: rev };
    }
  }

  // 4. Issuer obligation for the destination
  const obligation = await cache.gatewayObligation(
    route.request.destIssuer,
    route.request.destCurrency,
  );
  if (obligation) snap.issuerObligation = obligation;

  // ─── Synthesised notes ────────────────────────────────────────────────
  const notes: string[] = [];
  if (snap.xrpLeg) {
    const { toIouOffers, toXrpOffers } = snap.xrpLeg;
    if (toIouOffers >= 20 && toXrpOffers >= 20) notes.push("XRP legs deep both ways (20/20)");
    else if (toIouOffers >= 10 || toXrpOffers >= 10)
      notes.push(`XRP legs usable (${toIouOffers}/${toXrpOffers})`);
    else if (toIouOffers + toXrpOffers === 0) notes.push("No XRP orderbook activity");
    else notes.push(`XRP legs thin (${toIouOffers}/${toXrpOffers})`);
  }
  if (snap.directBook) {
    const { fwdOffers, revOffers } = snap.directBook;
    if (fwdOffers + revOffers >= 20) notes.push(`Direct cross-book deep (${fwdOffers}/${revOffers})`);
    else if (fwdOffers + revOffers > 0) notes.push(`Direct cross-book thin (${fwdOffers}/${revOffers})`);
  }
  if (snap.amm && snap.amm.xrpReserve) {
    const xrp = Number(snap.amm.xrpReserve) / 1_000_000;
    notes.push(
      `AMM pool ~${xrp.toLocaleString(undefined, { maximumFractionDigits: 0 })} XRP`,
    );
  }
  if (snap.issuerObligation) {
    const val = Number(snap.issuerObligation);
    notes.push(
      `Issuer float: ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${route.request.destCurrency}`,
    );
  }
  snap.notes = notes;

  return snap;
}

// ─── Liquidity-only scoring (used to pick path_find candidates) ────────────

/** Returns a non-negative depth score; bigger = better. */
export function liquidityDepthScore(snap: CorridorLiquiditySnapshot | null): number {
  if (!snap) return 0;
  let score = 0;
  if (snap.xrpLeg) score += snap.xrpLeg.toIouOffers + snap.xrpLeg.toXrpOffers;
  if (snap.directBook) score += (snap.directBook.fwdOffers + snap.directBook.revOffers) * 1.5;
  if (snap.amm?.xrpReserve) {
    const xrp = Number(snap.amm.xrpReserve) / 1_000_000;
    if (xrp > 1000) score += Math.min(xrp / 1000, 30);
  }
  return score;
}

// ─── Hashing — covers all routes' liquidity ────────────────────────────────

export function liquidityHash(snaps: Array<CorridorLiquiditySnapshot | null>): string {
  const payload = JSON.stringify(
    snaps.map((s) =>
      s
        ? {
            x: s.xrpLeg,
            d: s.directBook,
            a: s.amm ? { x: s.amm.xrpReserve, i: s.amm.iouReserve } : null,
            o: s.issuerObligation,
          }
        : null,
    ),
  );
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h << 5) + h) ^ payload.charCodeAt(i);
  return (h >>> 0).toString(16);
}
