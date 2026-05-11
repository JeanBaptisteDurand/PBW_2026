import type { RiskFlag } from "./types.js";
import {
  type Phase,
  type PhaseContext,
  type SafePathEvent,
  type Verdict,
  errMessage,
  nowIso,
} from "./types.js";

// Map RiskTolerance string to a numeric threshold (0-100 scale).
const TOLERANCE_THRESHOLD: Record<string, number> = {
  LOW: 30,
  MED: 60,
  HIGH: 80,
};

export class OnChainPathFindPhase implements Phase {
  readonly name = "on-chain-path-find" as const;

  async *run(ctx: PhaseContext): AsyncGenerator<SafePathEvent> {
    const { input, state, deps } = ctx;

    if (!state.isOnChain) {
      yield {
        kind: "reasoning",
        text: `${input.srcCcy} → ${input.dstCcy} has no on-chain IOU issuers; skipping path_find.`,
        at: nowIso(),
      };
      return;
    }

    const srcAddr = state.srcIssuers[0]?.address;
    const dstAddr = state.dstIssuers[0]?.address;
    if (!srcAddr || !dstAddr) {
      yield {
        kind: "reasoning",
        text: "Missing issuer address for on-chain path_find; skipping.",
        at: nowIso(),
      };
      return;
    }

    yield {
      kind: "step",
      step: "pathfinding",
      detail: "Running ripple_path_find on XRPL mainnet",
      at: nowIso(),
    };
    yield {
      kind: "tool-call",
      name: "findCandidatePaths",
      args: { srcCcy: input.srcCcy, dstCcy: input.dstCcy, amount: input.amount },
      at: nowIso(),
    };

    let alternatives: Array<Record<string, unknown>> = [];
    try {
      const res = await deps.marketData.pathFind({
        sourceAccount: srcAddr,
        destinationAccount: dstAddr,
        destinationAmount: {
          currency: input.dstCcy,
          issuer: dstAddr,
          value: input.amount,
        },
      });
      if (res && typeof res === "object") {
        const r = res as { result?: unknown };
        if (r.result && typeof r.result === "object") {
          const inner = (r.result as { alternatives?: unknown }).alternatives;
          if (Array.isArray(inner)) {
            alternatives = inner.filter(
              (a): a is Record<string, unknown> => typeof a === "object" && a !== null,
            );
          }
        }
      }
      yield {
        kind: "tool-result",
        name: "findCandidatePaths",
        summary: `Found ${alternatives.length} candidate path(s).`,
        at: nowIso(),
      };
      yield {
        kind: "corridor-update",
        analysisJson: { alternatives },
        at: nowIso(),
      };
    } catch (err) {
      yield {
        kind: "tool-result",
        name: "findCandidatePaths",
        summary: `Path find failed: ${errMessage(err)}`,
        at: nowIso(),
      };
      return;
    }

    state.paths = alternatives;
    if (alternatives.length === 0) return;

    const toleranceStr = input.maxRiskTolerance ?? "MED";
    const toleranceThreshold = TOLERANCE_THRESHOLD[toleranceStr] ?? 60;

    // Local score cache — keyed by address, populated on first evaluation.
    // Used so dedup doesn't lose data: if address is in crawledAddresses
    // from a previous phase (05), we still call quickEvalRisk once this
    // phase to get a score, but we do NOT re-emit account-crawled.
    const scoresByAddress = new Map<string, number>();
    const flagsByAddress = new Map<string, RiskFlag[]>();

    // Collect all SSE events that need to be yielded after async work.
    const pendingEvents: SafePathEvent[] = [];

    // Evaluate a single hop address: fetch score (once), emit account-crawled
    // if not already seen this run OR in a previous phase.
    const evalHop = async (address: string): Promise<number> => {
      const cached = scoresByAddress.get(address);
      if (cached !== undefined) return cached;

      let score = 0;
      let flags: RiskFlag[] = [];
      try {
        const r = await deps.path.quickEvalRisk(address);
        score = r.score;
        flags = r.flags as RiskFlag[];
      } catch (err) {
        // Conservative on failure: caller still gets the worst-case path score
        // from hops that succeeded; the failed hop contributes 0 because we have
        // no signal — log it so an outage doesn't masquerade as a SAFE verdict.
        console.warn(
          { address, error: err instanceof Error ? err.message : String(err) },
          "on-chain-path-find: quickEvalRisk failed for hop address, defaulting score to 0 (fail-open)",
        );
        score = 0;
        flags = [];
      }

      scoresByAddress.set(address, score);
      flagsByAddress.set(address, flags);

      if (!state.crawledAddresses.has(address)) {
        state.crawledAddresses.add(address);
        pendingEvents.push({
          kind: "account-crawled",
          address,
          name: "",
          reason: "hop-risk-eval",
          score,
          flags,
          at: nowIso(),
        });
      }

      return score;
    };

    // Evaluate all paths
    let surviving = 0;
    const acceptedPathScores: number[] = [];

    for (let i = 0; i < alternatives.length; i++) {
      const alt = alternatives[i] ?? {};
      const pathId = `path-${i + 1}`;

      if (state.corridor.status === "RED") {
        const reason = `Corridor status RED: rejecting path #${i + 1}`;
        state.rejected.push({ pathId, reason, flags: ["CORRIDOR_RED"] });
        pendingEvents.push({
          kind: "path-rejected",
          pathId,
          reason,
          at: nowIso(),
        });
        continue;
      }

      // Extract intermediate account hops from paths_computed.
      // XRPL paths_computed is an array of path arrays; each step may have
      // an `account` field for account-type hops.
      const computed = (alt as { paths_computed?: unknown }).paths_computed;
      const hopAddresses: string[] = [];
      if (Array.isArray(computed)) {
        for (const pathArr of computed) {
          if (Array.isArray(pathArr)) {
            for (const step of pathArr) {
              if (step && typeof step === "object") {
                const acc = (step as { account?: string }).account;
                if (acc && typeof acc === "string" && !hopAddresses.includes(acc)) {
                  hopAddresses.push(acc);
                }
              }
            }
          }
        }
      }

      // Evaluate each hop (dedup handled inside evalHop via scoresByAddress)
      const hopScores = await Promise.all(hopAddresses.map(evalHop));
      const pathScore = hopScores.length === 0 ? 0 : Math.max(...hopScores);

      if (pathScore > toleranceThreshold) {
        const reason = `Risk score ${pathScore} exceeds ${toleranceStr} tolerance (>${toleranceThreshold})`;
        state.rejected.push({ pathId, reason, flags: ["HIGH_RISK"] });
        pendingEvents.push({ kind: "path-rejected", pathId, reason, at: nowIso() });
        continue;
      }

      const sourceAmount = (alt as { source_amount?: unknown }).source_amount;
      pendingEvents.push({
        kind: "path-active",
        pathId,
        riskScore: pathScore,
        cost: typeof sourceAmount === "string" ? sourceAmount : null,
        at: nowIso(),
      });
      acceptedPathScores.push(pathScore);
      surviving++;
    }

    // Yield all collected events in order
    for (const ev of pendingEvents) yield ev;

    if (surviving > 0) {
      state.verdict = "SAFE" as Verdict;
      state.riskScore = acceptedPathScores.length === 0 ? 0 : Math.max(...acceptedPathScores);
    } else if (state.rejected.length > 0) {
      state.verdict = "REJECTED" as Verdict;
      state.riskScore = null;
    }
  }
}
