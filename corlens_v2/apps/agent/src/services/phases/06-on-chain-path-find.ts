import { type Phase, type PhaseContext, type PhaseEmit, type Verdict, nowIso } from "./types.js";

const SEVERITY_RANK: Record<string, number> = { LOW: 1, MED: 2, HIGH: 3 };

type Alternative = {
  paths_computed?: unknown[];
  source_amount?: unknown;
};

export class OnChainPathFindPhase implements Phase {
  readonly name = "on-chain-path-find" as const;

  async run(ctx: PhaseContext, emit: PhaseEmit): Promise<void> {
    const { input, state, deps } = ctx;

    if (!state.isOnChain) {
      emit({
        kind: "reasoning",
        text: `${input.srcCcy} → ${input.dstCcy} has no on-chain IOU issuers; skipping path_find.`,
        at: nowIso(),
      });
      return;
    }

    const srcAddr = state.srcIssuers[0]?.address;
    const dstAddr = state.dstIssuers[0]?.address;
    if (!srcAddr || !dstAddr) {
      emit({
        kind: "reasoning",
        text: "Missing issuer address for on-chain path_find; skipping.",
        at: nowIso(),
      });
      return;
    }

    emit({
      kind: "step",
      step: "pathfinding",
      detail: "Running ripple_path_find on XRPL mainnet",
      at: nowIso(),
    });
    emit({
      kind: "tool-call",
      name: "findCandidatePaths",
      args: { srcCcy: input.srcCcy, dstCcy: input.dstCcy, amount: input.amount },
      at: nowIso(),
    });

    let alternatives: Alternative[] = [];
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
      const result = (res as { result?: { alternatives?: Alternative[] } }).result;
      alternatives = result?.alternatives ?? [];
      emit({
        kind: "tool-result",
        name: "findCandidatePaths",
        summary: `Found ${alternatives.length} candidate path(s).`,
        at: nowIso(),
      });
      emit({
        kind: "corridor-update",
        analysisJson: { alternatives },
        at: nowIso(),
      });
    } catch (err) {
      emit({
        kind: "tool-result",
        name: "findCandidatePaths",
        summary: `Path find failed: ${(err as Error).message}`,
        at: nowIso(),
      });
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
      const alt = alternatives[i];
      const pathId = `path-${i + 1}`;
      const hops = Array.isArray(alt?.paths_computed) ? alt.paths_computed.length : 0;
      const synthScore = Math.min(0.95, 0.1 + hops * 0.1);

      if (state.corridor.status === "RED") {
        const reason = `Corridor status RED: rejecting path #${i + 1}`;
        state.rejected.push({ pathId, reason, flags: ["CORRIDOR_RED"] });
        emit({
          kind: "path-rejected",
          pathId,
          reason,
          at: nowIso(),
        });
        continue;
      }
      if (synthScore > 0.8 && toleranceRank < 3) {
        const reason = `Synthetic risk ${synthScore.toFixed(2)} exceeds ${tolerance} tolerance`;
        state.rejected.push({ pathId, reason, flags: ["HIGH_RISK"] });
        emit({ kind: "path-rejected", pathId, reason, at: nowIso() });
        continue;
      }
      emit({
        kind: "path-active",
        pathId,
        riskScore: synthScore,
        cost: typeof alt?.source_amount === "string" ? alt.source_amount : null,
        at: nowIso(),
      });
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
