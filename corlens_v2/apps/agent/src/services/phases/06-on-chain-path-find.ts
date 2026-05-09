import {
  type Phase,
  type PhaseContext,
  type SafePathEvent,
  type Verdict,
  errMessage,
  nowIso,
} from "./types.js";

const SEVERITY_RANK: Record<string, number> = { LOW: 1, MED: 2, HIGH: 3 };

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

    const tolerance = input.maxRiskTolerance ?? "MED";
    const toleranceRank = SEVERITY_RANK[tolerance] ?? 2;

    // v2 graceful degradation: market-data path_find only returns raw XRPL
    // alternatives — risk evaluation per-hop is the job of the path service's
    // risk-engine, which the agent does not call here. We surface each
    // alternative as path-active with a synthetic riskScore derived from the
    // hop count (longer paths = slightly higher risk). When the corridor
    // status is RED we mark all paths rejected to honour the v1 behaviour.
    let surviving = 0;
    for (let i = 0; i < alternatives.length; i++) {
      const alt = alternatives[i] ?? {};
      const pathId = `path-${i + 1}`;
      const computed = (alt as { paths_computed?: unknown }).paths_computed;
      const hops = Array.isArray(computed) ? computed.length : 0;
      const synthScore = Math.min(0.95, 0.1 + hops * 0.1);

      if (state.corridor.status === "RED") {
        const reason = `Corridor status RED: rejecting path #${i + 1}`;
        state.rejected.push({ pathId, reason, flags: ["CORRIDOR_RED"] });
        yield {
          kind: "path-rejected",
          pathId,
          reason,
          at: nowIso(),
        };
        continue;
      }
      if (synthScore > 0.8 && toleranceRank < 3) {
        const reason = `Synthetic risk ${synthScore.toFixed(2)} exceeds ${tolerance} tolerance`;
        state.rejected.push({ pathId, reason, flags: ["HIGH_RISK"] });
        yield { kind: "path-rejected", pathId, reason, at: nowIso() };
        continue;
      }
      const sourceAmount = (alt as { source_amount?: unknown }).source_amount;
      yield {
        kind: "path-active",
        pathId,
        riskScore: synthScore,
        cost: typeof sourceAmount === "string" ? sourceAmount : null,
        at: nowIso(),
      };
      surviving++;
    }

    if (surviving > 0) {
      state.verdict = "SAFE" as Verdict;
      state.riskScore = 0.2;
    } else if (state.rejected.length > 0) {
      state.verdict = "REJECTED" as Verdict;
    }
  }
}
