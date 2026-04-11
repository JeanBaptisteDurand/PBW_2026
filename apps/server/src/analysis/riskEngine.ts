import type { RiskFlagData } from "@xrplens/core";
import type { CrawlResult } from "./crawler.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const GLOBAL_FREEZE_FLAG = 0x00400000;
const ALLOW_CLAWBACK_FLAG = 0x80000000; // lsfAllowTrustLineClawback
const HIGH_TRANSFER_FEE_THRESHOLD = 1_010_000_000; // > 1% fee

// ─── Main Function ────────────────────────────────────────────────────────────

export function computeRiskFlags(crawl: CrawlResult, seedAddress: string): RiskFlagData[] {
  const flags: RiskFlagData[] = [];

  // ── 1. CONCENTRATED_LIQUIDITY (HIGH) ──────────────────────────────────────
  // Top 3 LPs > 80% of pool total
  {
    const holders = crawl.lpHolders;
    if (holders.length > 0) {
      const sorted = [...holders].sort(
        (a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)),
      );
      const total = sorted.reduce((sum, h) => sum + Math.abs(Number(h.balance)), 0);
      const top3 = sorted.slice(0, 3).reduce((sum, h) => sum + Math.abs(Number(h.balance)), 0);
      const percentage = total > 0 ? top3 / total : 0;

      if (percentage > 0.8) {
        flags.push({
          flag: "CONCENTRATED_LIQUIDITY",
          severity: "HIGH",
          detail: `Top 3 LPs hold ${(percentage * 100).toFixed(1)}% of pool liquidity`,
          data: { top3Percentage: percentage, holderCount: holders.length },
        });
      }
    }
  }

  // ── 2. SINGLE_GATEWAY_DEPENDENCY (HIGH) ───────────────────────────────────
  {
    const isIssuer = Object.keys(crawl.gatewayBalances?.obligations ?? {}).length > 0;
    if (crawl.paths.length === 0 && isIssuer && crawl.trustLines.length > 50) {
      flags.push({
        flag: "SINGLE_GATEWAY_DEPENDENCY",
        severity: "HIGH",
        detail: "No alternative payment paths found — single gateway dependency",
        data: { trustLineCount: crawl.trustLines.length },
      });
    }
  }

  // ── 3. LOW_DEPTH_ORDERBOOK (MED) ──────────────────────────────────────────
  {
    const isIssuer = Object.keys(crawl.gatewayBalances?.obligations ?? {}).length > 0;
    const noOffers = crawl.asks.length === 0 && crawl.bids.length === 0;
    if (noOffers && isIssuer) {
      flags.push({
        flag: "LOW_DEPTH_ORDERBOOK",
        severity: "MED",
        detail: "No offers in the order book",
        data: { askCount: 0, bidCount: 0 },
      });
    } else if (crawl.asks.length > 0 && crawl.bids.length > 0) {
      const bestAsk = crawl.asks[0];
      const bestBid = crawl.bids[0];
      const askPrice = bestAsk?.quality ? Number(bestAsk.quality) : null;
      const bidPrice = bestBid?.quality ? Number(bestBid.quality) : null;

      if (askPrice !== null && bidPrice !== null && askPrice > 0 && bidPrice > 0) {
        const mid = (askPrice + bidPrice) / 2;
        const spread = mid > 0 ? Math.abs(askPrice - bidPrice) / mid : 0;

        if (spread > 0.05) {
          flags.push({
            flag: "LOW_DEPTH_ORDERBOOK",
            severity: "MED",
            detail: `Order book spread is ${(spread * 100).toFixed(2)}% (threshold: 5%)`,
            data: { spread, askPrice, bidPrice },
          });
        }
      }
    }
  }

  // ── 4. THIN_AMM_POOL (MED) ────────────────────────────────────────────────
  {
    if (crawl.ammPool) {
      let xrpReserve = 0;
      let tokenReserve = 0;

      if (crawl.ammPool.amount) {
        if (typeof crawl.ammPool.amount === "string") {
          xrpReserve = Number(crawl.ammPool.amount) / 1_000_000;
        } else {
          tokenReserve = Number(crawl.ammPool.amount.value ?? 0);
        }
      }
      if (crawl.ammPool.amount2) {
        if (typeof crawl.ammPool.amount2 === "string") {
          xrpReserve = Number(crawl.ammPool.amount2) / 1_000_000;
        } else {
          tokenReserve = Number(crawl.ammPool.amount2.value ?? 0);
        }
      }

      const tvl = xrpReserve * 2 + tokenReserve * 1;

      if (tvl < 100_000) {
        flags.push({
          flag: "THIN_AMM_POOL",
          severity: "MED",
          detail: `AMM pool TVL estimated at $${tvl.toFixed(2)} (threshold: $100,000)`,
          data: { tvlUsd: tvl, xrpReserve, tokenReserve },
        });
      }
    }
  }

  // ── 5. UNVERIFIED_ISSUER (LOW) ────────────────────────────────────────────
  if (!crawl.issuerInfo?.Domain) {
    flags.push({
      flag: "UNVERIFIED_ISSUER",
      severity: "LOW",
      detail: "Issuer account has no Domain field set",
      data: { address: seedAddress },
    });
  }

  // ── 6. RLUSD_IMPERSONATOR (HIGH) ─────────────────────────────────────────
  {
    const CANONICAL_RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
    const RLUSD_HEX_UPPER = "524C555344000000000000000000000000000000";
    const issuedCurrencies = Object.keys(crawl.gatewayBalances?.obligations ?? {});

    const issuedRLUSD = issuedCurrencies.some(
      (c) => c.toUpperCase() === "RLUSD" || c.toUpperCase() === RLUSD_HEX_UPPER,
    );

    if (issuedRLUSD && seedAddress !== CANONICAL_RLUSD_ISSUER) {
      flags.push({
        flag: "RLUSD_IMPERSONATOR",
        severity: "HIGH",
        detail: `Account ${seedAddress} issues RLUSD but is NOT the canonical RLUSD issuer`,
        data: { canonicalIssuer: CANONICAL_RLUSD_ISSUER, address: seedAddress },
      });
    }
  }

  // ── 7. FROZEN_TRUST_LINE (HIGH) ───────────────────────────────────────────
  const frozenLines = crawl.trustLines.filter((l: any) => l.freeze === true);
  if (frozenLines.length > 0) {
    flags.push({
      flag: "FROZEN_TRUST_LINE",
      severity: "HIGH",
      detail: `${frozenLines.length} trust line(s) are frozen`,
      data: {
        frozenCount: frozenLines.length,
        frozenAccounts: frozenLines.slice(0, 5).map((l: any) => l.account),
      },
    });
  }

  // ── 8. GLOBAL_FREEZE (HIGH) ───────────────────────────────────────────────
  const issuerFlags = crawl.issuerInfo?.Flags ?? 0;
  if ((issuerFlags & GLOBAL_FREEZE_FLAG) !== 0) {
    flags.push({
      flag: "GLOBAL_FREEZE",
      severity: "HIGH",
      detail: "Issuer has GlobalFreeze flag set — all trust lines are frozen",
      data: { flags: issuerFlags },
    });
  }

  // ── 9. HIGH_TRANSFER_FEE (MED) ──────────────────────────────────────────
  const transferRate = crawl.issuerInfo?.TransferRate ?? 0;
  if (transferRate > HIGH_TRANSFER_FEE_THRESHOLD) {
    const feePct = ((transferRate - 1_000_000_000) / 10_000_000).toFixed(2);
    flags.push({
      flag: "HIGH_TRANSFER_FEE",
      severity: "MED",
      detail: `Transfer fee is ${feePct}% (threshold: 1%)`,
      data: { transferRate, feePercentage: Number(feePct) },
    });
  }

  // ── 10. CLAWBACK_ENABLED (HIGH) ──────────────────────────────────────────
  if ((issuerFlags & ALLOW_CLAWBACK_FLAG) !== 0) {
    flags.push({
      flag: "CLAWBACK_ENABLED",
      severity: "HIGH",
      detail: "Issuer has AllowTrustLineClawback enabled — can forcibly reclaim tokens",
      data: { flags: issuerFlags },
    });
  }

  return flags;
}
