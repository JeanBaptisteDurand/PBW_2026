// Pure risk flag computation — ported from v1 corlens/apps/server/src/analysis/riskEngine.ts
// No I/O. No logger. No xrpl/openai/prisma imports.

import type { RiskFlagData, CrawlResult } from "./types.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const GLOBAL_FREEZE_FLAG = 0x00400000;
const ALLOW_CLAWBACK_FLAG = 0x80000000; // lsfAllowTrustLineClawback
const DEPOSIT_AUTH_FLAG = 0x01000000;   // lsfDepositAuth
const DISABLE_MASTER_FLAG = 0x00100000; // lsfDisableMasterKey
const HIGH_TRANSFER_FEE_THRESHOLD = 1_010_000_000; // > 1% fee

// XLS-77 Deep Freeze flags on RippleState (trust line) ledger entries.
// Defined in rippled LedgerFormats.cpp / SF_LEDGER_ENTRY field map.
// Deep Freeze blocks the holder from BOTH sending and receiving (vs. normal
// freeze which only blocks sending). Distinguishes a sanctions-grade action
// from a commercial dispute.
const LSF_LOW_DEEP_FREEZE = 0x02000000;
const LSF_HIGH_DEEP_FREEZE = 0x04000000;
const DEEP_FREEZE_MASK = LSF_LOW_DEEP_FREEZE | LSF_HIGH_DEEP_FREEZE;

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
  // No alternative payment paths found, but is an actual token issuer with significant trust lines
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
  // No offers, or spread > 5% — only flag for actual token issuers
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
  // TVL < $100k. Estimate: XRP reserve * $2 + token reserve * $1
  {
    if (crawl.ammPool) {
      let xrpReserve = 0;
      let tokenReserve = 0;

      if (crawl.ammPool.amount) {
        if (typeof crawl.ammPool.amount === "string") {
          // XRP in drops
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

  // ── 5. STALE_OFFER (LOW) ─────────────────────────────────────────────────
  // Simplified detection — XRPL offer objects don't carry timestamps directly.
  // A more complete implementation would cross-reference the CreatedLedger
  // against current ledger index to estimate age. Skipped for now.
  // (No flag emitted here without reliable timestamp data.)

  // ── 6. UNVERIFIED_ISSUER (LOW) ────────────────────────────────────────────
  // issuerInfo.Domain is falsy
  if (!crawl.issuerInfo?.Domain) {
    flags.push({
      flag: "UNVERIFIED_ISSUER",
      severity: "LOW",
      detail: "Issuer account has no Domain field set",
      data: { address: seedAddress },
    });
  }

  // ── 7. RLUSD_IMPERSONATOR (HIGH) ─────────────────────────────────────────
  // If the account issues RLUSD but is NOT the canonical issuer, flag it.
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

  // ── 8. FROZEN_TRUST_LINE (HIGH) ───────────────────────────────────────────
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

  // ── 9. GLOBAL_FREEZE (HIGH) ───────────────────────────────────────────────
  const issuerFlags = crawl.issuerInfo?.Flags ?? 0;
  if ((issuerFlags & GLOBAL_FREEZE_FLAG) !== 0) {
    flags.push({
      flag: "GLOBAL_FREEZE",
      severity: "HIGH",
      detail: "Issuer has GlobalFreeze flag set — all trust lines are frozen",
      data: { flags: issuerFlags },
    });
  }

  // ── 10. HIGH_TRANSFER_FEE (MED) ──────────────────────────────────────────
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

  // ── 11. CLAWBACK_ENABLED (HIGH) ──────────────────────────────────────────
  // If the issuer has the AllowTrustLineClawback flag, tokens can be clawed back
  if ((issuerFlags & ALLOW_CLAWBACK_FLAG) !== 0) {
    flags.push({
      flag: "CLAWBACK_ENABLED",
      severity: "HIGH",
      detail: "Issuer has AllowTrustLineClawback enabled — can forcibly reclaim tokens",
      data: { flags: issuerFlags },
    });
  }

  // ── 12. NO_MULTISIG (LOW) ────────────────────────────────────────────────
  // No SignerList — only flag for token issuers (not regular accounts)
  {
    const isIssuer = Object.keys(crawl.gatewayBalances?.obligations ?? {}).length > 0;
    if (isIssuer) {
      const hasSignerList = crawl.accountObjects.some(
        (o: any) => o.LedgerEntryType === "SignerList",
      );
      const signerListsFromInfo = crawl.issuerInfo?.signer_lists ?? [];
      if (!hasSignerList && signerListsFromInfo.length === 0) {
        flags.push({
          flag: "NO_MULTISIG",
          severity: "LOW",
          detail: "Token issuer has no SignerList — single key controls all operations",
          data: { address: seedAddress },
        });
      }
    }
  }

  // ── 13. ACTIVE_CHECKS (MED) ─────────────────────────────────────────────
  // Outstanding checks represent financial obligations
  {
    const checks = crawl.accountObjects.filter(
      (o: any) => o.LedgerEntryType === "Check",
    );
    if (checks.length > 0) {
      const totalXrpChecks = checks
        .filter((c: any) => typeof c.SendMax === "string")
        .reduce((sum: number, c: any) => sum + Number(c.SendMax) / 1_000_000, 0);

      flags.push({
        flag: "ACTIVE_CHECKS",
        severity: "MED",
        detail: `${checks.length} outstanding check(s) — potential liabilities`,
        data: { checkCount: checks.length, totalXrpExposure: totalXrpChecks },
      });
    }
  }

  // ── 14. HIGH_TX_VELOCITY (MED) ──────────────────────────────────────────
  // Only flag when fetch limit is maxed AND dominant type is > 90% (bot/spam pattern)
  {
    const txCount = crawl.accountTransactions?.length ?? 0;
    if (txCount >= 200) {
      // Check if many are the same type (potential spam/bot)
      const typeCounts = new Map<string, number>();
      for (const tx of crawl.accountTransactions ?? []) {
        const txType =
          tx?.tx_json?.TransactionType ??
          tx?.tx?.TransactionType ??
          tx?.TransactionType ??
          "Unknown";
        typeCounts.set(txType, (typeCounts.get(txType) ?? 0) + 1);
      }
      const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const dominantPct = dominantType ? dominantType[1] / txCount : 0;

      // Only flag if dominant type is > 90% — indicates bot/automated activity
      if (dominantPct > 0.9) {
        flags.push({
          flag: "HIGH_TX_VELOCITY",
          severity: "MED",
          detail: `${txCount} recent transactions — ${(dominantPct * 100).toFixed(0)}% are ${dominantType![0]}`,
          data: {
            txCount,
            dominantType: dominantType?.[0],
            dominantPercentage: dominantPct,
          },
        });
      }
    }
  }

  // ── 15. DEPOSIT_RESTRICTED (LOW) ────────────────────────────────────────
  // DepositAuth flag means only pre-authorized accounts can send to this account
  if ((issuerFlags & DEPOSIT_AUTH_FLAG) !== 0) {
    flags.push({
      flag: "DEPOSIT_RESTRICTED",
      severity: "LOW",
      detail: "Account has DepositAuth enabled — only pre-authorized senders accepted",
      data: { flags: issuerFlags },
    });
  }

  // ── 16. BLACKHOLED_ACCOUNT (HIGH) ──────────────────────────────────────
  // DisableMaster + no RegularKey + no SignerList = permanently inaccessible
  {
    const masterDisabled = (issuerFlags & DISABLE_MASTER_FLAG) !== 0;
    const hasRegularKey = !!crawl.issuerInfo?.RegularKey;
    const hasSignerList =
      crawl.accountObjects.some((o: any) => o.LedgerEntryType === "SignerList") ||
      (crawl.issuerInfo?.signer_lists ?? []).length > 0;

    if (masterDisabled && !hasRegularKey && !hasSignerList) {
      flags.push({
        flag: "BLACKHOLED_ACCOUNT",
        severity: "HIGH",
        detail: "Account is blackholed — master key disabled, no regular key, no signer list. Settings are permanently immutable.",
        data: { flags: issuerFlags },
      });
    }
  }

  // ── 17. NO_REGULAR_KEY (LOW) ───────────────────────────────────────────
  // Token issuers without a regular key have a single point of failure
  {
    const isIssuer = Object.keys(crawl.gatewayBalances?.obligations ?? {}).length > 0;
    const masterDisabled = (issuerFlags & DISABLE_MASTER_FLAG) !== 0;
    if (isIssuer && !crawl.issuerInfo?.RegularKey && !masterDisabled) {
      flags.push({
        flag: "NO_REGULAR_KEY",
        severity: "LOW",
        detail: "Token issuer has no RegularKey set — single master key is the only signing authority",
        data: { address: seedAddress },
      });
    }
  }

  // ── 18. NORIPPLE_MISCONFIGURED (MED) ────────────────────────────────────
  // noripple_check returned problems for this gateway
  {
    const problems = crawl.noripppleProblems ?? [];
    if (problems.length > 0) {
      flags.push({
        flag: "NORIPPLE_MISCONFIGURED",
        severity: "MED",
        detail: `${problems.length} trust line rippling misconfiguration(s) detected`,
        data: { problemCount: problems.length, problems: problems.slice(0, 5) },
      });
    }
  }

  // ── 19. DEEP_FROZEN_TRUST_LINE (HIGH) — XLS-77 ──────────────────────────
  // XLS-77 Deep Freeze blocks the holder from BOTH sending AND receiving on a
  // trust line — distinguishes a sanctions-grade action from a commercial
  // dispute (a normal freeze only blocks the holder from sending).
  // Detected by the lsfLowDeepFreeze (0x02000000) / lsfHighDeepFreeze
  // (0x04000000) bits on a RippleState ledger entry, defined in rippled
  // LedgerFormats.cpp under the XLS-77 amendment.
  // We check two sources for robustness:
  //   1. Raw RippleState objects from account_objects (always present)
  //   2. Parsed account_lines (newer xrpl.js exposes deep_freeze /
  //      deep_freeze_peer booleans; older versions do not — fall through)
  {
    const rippleStates = crawl.accountObjects.filter(
      (o: any) => o.LedgerEntryType === "RippleState",
    );
    const deepFrozenStates = rippleStates.filter(
      (rs: any) => ((rs.Flags ?? 0) & DEEP_FREEZE_MASK) !== 0,
    );

    const deepFrozenLines = crawl.trustLines.filter(
      (l: any) => l.deep_freeze === true || l.deep_freeze_peer === true,
    );

    const totalDeepFrozen = deepFrozenStates.length + deepFrozenLines.length;
    if (totalDeepFrozen > 0) {
      const sample = [
        ...deepFrozenStates.slice(0, 3).map((rs: any) => ({
          highParty: rs.HighLimit?.issuer,
          lowParty: rs.LowLimit?.issuer,
          flags: rs.Flags,
        })),
        ...deepFrozenLines.slice(0, 3).map((l: any) => ({
          account: l.account,
          currency: l.currency,
          balance: l.balance,
        })),
      ];

      flags.push({
        flag: "DEEP_FROZEN_TRUST_LINE",
        severity: "HIGH",
        detail: `${totalDeepFrozen} trust line(s) under XLS-77 Deep Freeze — holders cannot send OR receive (sanctions-grade restriction)`,
        data: {
          deepFrozenCount: totalDeepFrozen,
          xlsAmendment: "XLS-77",
          sample,
        },
      });
    }
  }

  // ── 20. AMM_CLAWBACK_EXPOSURE (HIGH) — XLS-73 ───────────────────────────
  // XLS-73 (AMM Clawback) lets a token issuer with AllowTrustLineClawback
  // claw back tokens that LPs have already deposited into an AMM pool —
  // before the amendment, deposits were "protected". Every LP in such a pool
  // is exposed.
  // We surface this on the *consumer* side (per pool), distinct from the
  // existing CLAWBACK_ENABLED flag which fires on the issuer side.
  {
    if (crawl.ammPool) {
      const checkAsset = (asset: any): { currency: string; issuer: string } | null => {
        if (typeof asset === "string") return null; // XRP
        if (!asset || !asset.currency || !asset.issuer) return null;
        return { currency: asset.currency, issuer: asset.issuer };
      };

      const exposedAssets: Array<{ currency: string; issuer: string }> = [];
      for (const asset of [checkAsset(crawl.ammPool.amount), checkAsset(crawl.ammPool.amount2)]) {
        if (!asset) continue;
        // Resolve the issuer's flags. If the asset issuer is the seed account,
        // use issuerInfo (always populated). Otherwise look it up in
        // topAccounts (populated for top trust line holders / LP holders).
        let assetIssuerFlags = 0;
        if (asset.issuer === seedAddress) {
          assetIssuerFlags = crawl.issuerInfo?.Flags ?? 0;
        } else {
          const topAccounts = crawl.topAccounts as Map<string, any>;
          const enriched = topAccounts.get?.(asset.issuer);
          assetIssuerFlags = enriched?.Flags ?? 0;
        }
        if ((assetIssuerFlags & ALLOW_CLAWBACK_FLAG) !== 0) {
          exposedAssets.push(asset);
        }
      }

      if (exposedAssets.length > 0) {
        flags.push({
          flag: "AMM_CLAWBACK_EXPOSURE",
          severity: "HIGH",
          detail: `AMM pool contains ${exposedAssets.length} clawback-enabled asset(s) — XLS-73 lets the issuer claw tokens already deposited as LP, exposing every LP in the pool`,
          data: {
            poolAccount: crawl.ammPool.account,
            xlsAmendment: "XLS-73",
            exposedAssets,
          },
        });
      }
    }
  }

  return flags;
}
