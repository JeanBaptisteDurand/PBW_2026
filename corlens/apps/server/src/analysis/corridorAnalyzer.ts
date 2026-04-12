import type { XRPLClientWrapper } from "../xrpl/client.js";
import type {
  CorridorRequest,
  CorridorPath,
  CorridorPathHop,
  CorridorAnalysis,
  RiskFlagData,
} from "@corlens/core";
import { fetchAccountInfo } from "../xrpl/fetchers.js";
import { logger } from "../logger.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const KNOWN_HEX_CURRENCIES: Record<string, string> = {
  RLUSD: "524C555344000000000000000000000000000000",
  SOLO: "534F4C4F00000000000000000000000000000000",
};

function toCurrencyWire(currency: string): string {
  if (currency === "XRP") return "XRP";
  if (currency.length === 3) return currency;
  return KNOWN_HEX_CURRENCIES[currency.toUpperCase()] ?? currency;
}

const REVERSE_HEX: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_HEX_CURRENCIES).map(([k, v]) => [v, k]),
);

function decodeCurrencyName(hex: string): string {
  if (!hex || hex.length <= 3) return hex;
  if (REVERSE_HEX[hex]) return REVERSE_HEX[hex];
  // Try ASCII decode
  let ascii = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code > 0) ascii += String.fromCharCode(code);
  }
  const trimmed = ascii.trim();
  if (/^[\x20-\x7E]+$/.test(trimmed)) return trimmed;
  return hex;
}

const ALLOW_CLAWBACK_FLAG = 0x80000000;
const GLOBAL_FREEZE_FLAG = 0x00400000;
const NO_FREEZE_FLAG = 0x00200000;
const DISABLE_MASTER_FLAG = 0x00100000;
const DEPOSIT_AUTH_FLAG = 0x01000000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assessAccountRisk(
  client: XRPLClientWrapper,
  account: string,
): Promise<{ riskFlags: RiskFlagData[]; riskScore: number }> {
  const flags: RiskFlagData[] = [];
  let score = 0;

  try {
    const resp = (await fetchAccountInfo(client, account)) as any;
    const ad = resp?.result?.account_data;
    if (!ad) return { riskFlags: flags, riskScore: score };

    const f = ad.Flags ?? 0;

    if ((f & GLOBAL_FREEZE_FLAG) !== 0) {
      flags.push({ flag: "GLOBAL_FREEZE", severity: "HIGH", detail: "Global freeze active" });
      score += 50;
    }

    if ((f & ALLOW_CLAWBACK_FLAG) !== 0) {
      flags.push({ flag: "CLAWBACK_ENABLED", severity: "HIGH", detail: "Can reclaim tokens" });
      score += 30;
    }

    if ((f & NO_FREEZE_FLAG) !== 0) {
      score -= 10; // bonus — gave up freeze power
    }

    const masterDisabled = (f & DISABLE_MASTER_FLAG) !== 0;
    const hasRegularKey = !!ad.RegularKey;
    const hasSigner = (ad.signer_lists ?? []).length > 0;

    if (masterDisabled && !hasRegularKey && !hasSigner) {
      // Blackholed — good for immutability, mild positive
      score -= 5;
    }

    if (!hasSigner && !masterDisabled) {
      flags.push({ flag: "NO_MULTISIG", severity: "LOW", detail: "Single key controls account" });
      score += 10;
    }

    if (!ad.Domain) {
      flags.push({ flag: "UNVERIFIED_ISSUER", severity: "LOW", detail: "No domain set" });
      score += 5;
    }

    if ((f & DEPOSIT_AUTH_FLAG) !== 0) {
      score += 5;
    }
  } catch (err: any) {
    logger.warn("[corridor] Failed to assess account risk", { account, error: err?.message });
    score += 20; // unknown = risky
  }

  return { riskFlags: flags, riskScore: Math.max(0, score) };
}

// ─── Main Analyzer ───────────────────────────────────────────────────────────

export async function analyzeCorridors(
  client: XRPLClientWrapper,
  request: CorridorRequest,
): Promise<CorridorAnalysis> {
  const sourceAccount =
    request.sourceAccount ?? request.sourceIssuer ?? "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";

  // Build destination amount (use hex currency codes for non-standard currencies)
  const destCurrencyWire = toCurrencyWire(request.destCurrency);
  const destAmount: any =
    request.destCurrency === "XRP"
      ? String(Math.round(Number(request.amount) * 1_000_000))
      : { currency: destCurrencyWire, issuer: request.destIssuer, value: request.amount };

  // Build source currencies
  const srcCurrencyWire = toCurrencyWire(request.sourceCurrency);
  const sourceCurrencies: any[] = [];
  if (request.sourceCurrency === "XRP") {
    sourceCurrencies.push({ currency: "XRP" });
  } else {
    sourceCurrencies.push({
      currency: srcCurrencyWire,
      issuer: request.sourceIssuer,
    });
  }

  // Call ripple_path_find. We retry ONLY on thrown errors (transient
  // network / connection issues); an empty-alternatives response is treated
  // as authoritative "no path exists right now" and returned immediately.
  // This is critical for refresh throughput — pathfind takes 3-8 seconds and
  // at ~100 corridors we cannot afford to burn 3× that on every dead route.
  logger.info("[corridor] Finding paths", { request });
  let alternatives: any[] = [];
  const MAX_PATHFIND_TRIES = 2;
  for (let attempt = 1; attempt <= MAX_PATHFIND_TRIES; attempt++) {
    try {
      const pathResp = (await client.pathFind({
        subcommand: "create",
        source_account: sourceAccount,
        destination_account: request.destIssuer,
        destination_amount: destAmount,
        source_currencies: sourceCurrencies,
      })) as any;
      alternatives = pathResp?.result?.alternatives ?? [];
      if (alternatives.length > 0) {
        logger.info("[corridor] Found paths", { count: alternatives.length, attempt });
      } else {
        logger.debug("[corridor] pathfind returned 0 alternatives", { attempt });
      }
      // Whether or not alternatives were found, the call succeeded — stop retrying.
      break;
    } catch (err: any) {
      logger.warn("[corridor] Path find threw", { attempt, error: err?.message });
      if (attempt < MAX_PATHFIND_TRIES) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  // Also add the default direct path
  if (alternatives.length === 0) {
    // No paths found — return empty
    return {
      request,
      paths: [],
      defaultPathIndex: -1,
      recommendedPathIndex: -1,
    };
  }

  // Flatten alternatives × paths_computed into individual paths
  // Each alternative may contain multiple paths_computed (different routes for same source currency)
  type RawPath = { steps: any[]; sourceAmount: any };
  const rawPaths: RawPath[] = [];
  for (const alt of alternatives) {
    const pathsComputed = alt.paths_computed ?? [];
    if (pathsComputed.length === 0) {
      // Default path (direct, no intermediaries)
      rawPaths.push({ steps: [], sourceAmount: alt.source_amount });
    } else {
      for (const steps of pathsComputed) {
        rawPaths.push({ steps, sourceAmount: alt.source_amount });
      }
    }
  }

  // Analyze each path
  const paths: CorridorPath[] = [];
  const accountRiskCache = new Map<string, { riskFlags: RiskFlagData[]; riskScore: number }>();

  for (let i = 0; i < Math.min(rawPaths.length, 6); i++) {
    const raw = rawPaths[i];
    const pathSteps = raw.steps;

    // Parse source amount as cost
    let cost = 0;
    if (typeof raw.sourceAmount === "string") {
      cost = Number(raw.sourceAmount) / 1_000_000; // XRP drops
    } else {
      cost = Number(raw.sourceAmount?.value ?? 0);
    }

    // Analyze each hop
    const hops: CorridorPathHop[] = [];
    let totalRiskScore = 0;

    for (const step of pathSteps) {
      // Decode hex currency names back to readable
      const currency = step.currency
        ? decodeCurrencyName(step.currency)
        : undefined;

      const hop: CorridorPathHop = {
        account: step.account,
        currency,
        issuer: step.issuer,
        type: step.currency === "XRP"
          ? "xrp_bridge"
          : step.account
            ? "gateway"
            : "orderbook",
        riskFlags: [],
        riskScore: 0,
      };

      // Assess risk for gateway accounts
      const accountToCheck = step.account || step.issuer;
      if (accountToCheck) {
        if (!accountRiskCache.has(accountToCheck)) {
          const risk = await assessAccountRisk(client, accountToCheck);
          accountRiskCache.set(accountToCheck, risk);
        }
        const cached = accountRiskCache.get(accountToCheck)!;
        hop.riskFlags = cached.riskFlags;
        hop.riskScore = cached.riskScore;
        totalRiskScore += cached.riskScore;
      }

      hops.push(hop);
    }

    paths.push({
      index: i,
      hops,
      sourceAmount: typeof raw.sourceAmount === "string"
        ? String(Number(raw.sourceAmount) / 1_000_000)
        : raw.sourceAmount?.value ?? "0",
      cost,
      riskScore: totalRiskScore,
      isXrplDefault: false,
      isRecommended: false,
      reasoning: "",
    });
  }

  if (paths.length === 0) {
    return {
      request,
      paths: [],
      defaultPathIndex: -1,
      recommendedPathIndex: -1,
    };
  }

  // Mark XRPL default (cheapest)
  const cheapest = paths.reduce((min, p) => (p.cost < min.cost ? p : min), paths[0]);
  cheapest.isXrplDefault = true;
  const defaultPathIndex = cheapest.index;

  // Mark recommended (best risk-adjusted score)
  // Score = cost_normalized + risk_normalized * weight
  const maxCost = Math.max(...paths.map((p) => p.cost));
  const minCost = Math.min(...paths.map((p) => p.cost));
  const maxRisk = Math.max(...paths.map((p) => p.riskScore), 1);
  const costRange = maxCost - minCost || 1;

  for (const p of paths) {
    const costNorm = (p.cost - minCost) / costRange; // 0 = cheapest, 1 = most expensive
    const riskNorm = p.riskScore / maxRisk; // 0 = safest, 1 = riskiest
    (p as any)._compositeScore = costNorm * 0.3 + riskNorm * 0.7; // risk-weighted
  }

  const recommended = paths.reduce(
    (best, p) => ((p as any)._compositeScore < (best as any)._compositeScore ? p : best),
    paths[0],
  );
  recommended.isRecommended = true;
  const recommendedPathIndex = recommended.index;

  // Generate reasoning
  for (const p of paths) {
    const parts: string[] = [];
    if (p.isXrplDefault && p.isRecommended) {
      parts.push("Cheapest path is also the safest.");
    } else if (p.isXrplDefault) {
      parts.push(`Cheapest path (${p.sourceAmount} ${request.sourceCurrency}).`);
      if (p.riskScore > 0) {
        const risks = p.hops.flatMap((h) => h.riskFlags.map((f) => f.flag));
        parts.push(`Risk: ${risks.join(", ")}.`);
      }
    } else if (p.isRecommended) {
      const costDiff = ((p.cost - cheapest.cost) / cheapest.cost * 100).toFixed(2);
      parts.push(`+${costDiff}% cost but ${p.riskScore < cheapest.riskScore ? "lower" : "comparable"} risk.`);
      if (cheapest.riskScore > 0) {
        const defaultRisks = cheapest.hops.flatMap((h) => h.riskFlags.map((f) => f.flag));
        parts.push(`Avoids: ${defaultRisks.join(", ")}.`);
      }
    } else {
      parts.push(`Cost: ${p.sourceAmount} ${request.sourceCurrency}, Risk score: ${p.riskScore}.`);
    }
    p.reasoning = parts.join(" ");

    // Clean internal field
    delete (p as any)._compositeScore;
  }

  return {
    request,
    paths,
    defaultPathIndex,
    recommendedPathIndex,
  };
}
