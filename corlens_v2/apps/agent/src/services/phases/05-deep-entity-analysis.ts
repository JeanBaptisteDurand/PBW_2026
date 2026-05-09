import type { PathClient } from "../../connectors/path.js";
import { KNOWN_XRPL_ADDRESSES, RLUSD_ISSUER, USDC_ISSUER, rankActors } from "./_currency-meta.js";
import {
  type DeepAnalysisResult,
  type Phase,
  type PhaseContext,
  type PhaseEmit,
  nowIso,
} from "./types.js";

async function deepAnalyze(
  path: PathClient,
  emit: PhaseEmit,
  address: string,
  label: string,
): Promise<{ analysisId: string } & DeepAnalysisResult> {
  emit({
    kind: "tool-call",
    name: "deepAnalyze",
    args: { address, label, depth: 2 },
    at: nowIso(),
  });

  let analysisId: string;
  try {
    const started = await path.analyze({ seedAddress: address, seedLabel: label, depth: 2 });
    analysisId = started.id;
  } catch (err) {
    emit({
      kind: "tool-result",
      name: "deepAnalyze",
      summary: `Analyze failed: ${(err as Error).message}`,
      at: nowIso(),
    });
    return { analysisId: "", label, nodeCount: 0, edgeCount: 0 };
  }

  emit({
    kind: "analysis-started",
    analysisId,
    address,
    label,
    at: nowIso(),
  });

  // Poll until done or 45s timeout
  type AnalysisRow = { status?: string; error?: string };
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const a = (await path.getAnalysis(analysisId)) as AnalysisRow | null;
      if (a?.status === "done") break;
      if (a?.status === "error") {
        emit({
          kind: "tool-result",
          name: "deepAnalyze",
          summary: `Analysis failed: ${a.error ?? "unknown"}`,
          at: nowIso(),
        });
        return { analysisId, label, nodeCount: 0, edgeCount: 0 };
      }
    } catch {
      // transient; keep polling until deadline
    }
  }

  let nodeCount = 0;
  let edgeCount = 0;
  try {
    const graph = (await path.getGraph(analysisId)) as {
      nodes?: unknown[];
      edges?: unknown[];
    } | null;
    if (graph) {
      nodeCount = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
      edgeCount = Array.isArray(graph.edges) ? graph.edges.length : 0;
    }
  } catch {
    // graph fetch failed; counts stay zero
  }

  emit({
    kind: "analysis-complete",
    analysisId,
    nodeCount,
    edgeCount,
    at: nowIso(),
  });
  emit({
    kind: "tool-result",
    name: "deepAnalyze",
    summary: `${label} (${address.slice(0, 10)}…): ${nodeCount} nodes, ${edgeCount} edges.`,
    at: nowIso(),
  });

  let ragInsight: string | undefined;
  try {
    const chat = await path.chat({
      analysisId,
      message:
        "What are the top risk flags, concentration risks, and governance concerns for this entity? List the most critical findings in 3-5 bullet points. Include any frozen trust lines, clawback exposure, thin AMM pools, or unverified issuers.",
    });
    ragInsight = chat.answer;
    emit({
      kind: "rag-answer",
      question: "risk assessment",
      answer: chat.answer,
      at: nowIso(),
    });
  } catch (err) {
    emit({
      kind: "tool-result",
      name: "deepAnalyzeRag",
      summary: `RAG query failed: ${(err as Error).message}`,
      at: nowIso(),
    });
  }

  return { analysisId, label, nodeCount, edgeCount, ragInsight };
}

async function findActorAddress(
  path: PathClient,
  emit: PhaseEmit,
  actor: { key: string; name: string },
): Promise<{ address: string; analysisId: string } | null> {
  const fallbackKey = actor.key.split("-")[0] ?? actor.key;
  const known = KNOWN_XRPL_ADDRESSES[actor.key] ?? KNOWN_XRPL_ADDRESSES[fallbackKey];
  if (!known) return null;

  emit({
    kind: "tool-call",
    name: "findActorAddress",
    args: { actor: actor.name, method: "known_registry" },
    at: nowIso(),
  });
  emit({
    kind: "tool-result",
    name: "findActorAddress",
    summary: `${actor.name} XRPL address: ${known.address.slice(0, 12)}… (from known registry)`,
    at: nowIso(),
  });
  const result = await deepAnalyze(path, emit, known.address, `${actor.name} (${known.label})`);
  if (!result.analysisId) return null;
  return { address: known.address, analysisId: result.analysisId };
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(fn));
  }
}

export class DeepEntityAnalysisPhase implements Phase {
  readonly name = "deep-entity-analysis" as const;

  async run(ctx: PhaseContext, emit: PhaseEmit): Promise<void> {
    const { input, state, deps } = ctx;
    emit({
      kind: "step",
      step: "deep_analysis",
      detail: "Running deep entity analysis on critical XRPL accounts",
      at: nowIso(),
    });

    const targets: Array<{ address: string; label: string }> = [];
    const seen = state.analyzedAddresses;

    // Always include the RLUSD issuer
    if (!seen.has(RLUSD_ISSUER)) {
      targets.push({ address: RLUSD_ISSUER, label: "RLUSD Issuer" });
      seen.add(RLUSD_ISSUER);
    }
    for (const issuer of state.srcIssuers) {
      if (!seen.has(issuer.address)) {
        targets.push({ address: issuer.address, label: `${input.srcCcy} issuer (${issuer.name})` });
        seen.add(issuer.address);
      }
    }
    for (const issuer of state.dstIssuers) {
      if (!seen.has(issuer.address)) {
        targets.push({ address: issuer.address, label: `${input.dstCcy} issuer (${issuer.name})` });
        seen.add(issuer.address);
      }
    }
    if (!state.isOnChain && !seen.has(USDC_ISSUER)) {
      targets.push({ address: USDC_ISSUER, label: "Circle USDC Issuer" });
      seen.add(USDC_ISSUER);
    }

    await runInBatches(targets, 3, async ({ address, label }) => {
      const result = await deepAnalyze(deps.path, emit, address, label);
      if (!result.analysisId) return;
      state.deepAnalyses.set(address, {
        label,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
        ragInsight: result.ragInsight,
      });
      state.analysisIds.push(result.analysisId);
      state.analysisSummaries.push({
        id: result.analysisId,
        address,
        label,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
      });
      if (result.ragInsight) state.ragInsights.set(address, result.ragInsight);
    });

    // Phase 4.5: actor address discovery + analysis
    emit({
      kind: "step",
      step: "actor_address_discovery",
      detail: "Discovering XRPL addresses for top off-chain actors",
      at: nowIso(),
    });

    const topActors = [
      ...rankActors(state.srcActors).slice(0, 3),
      ...rankActors(state.dstActors).slice(0, 3),
    ];
    const actorTargets = topActors.filter((a) => {
      const fallback = a.key.split("-")[0] ?? a.key;
      const known = KNOWN_XRPL_ADDRESSES[a.key] ?? KNOWN_XRPL_ADDRESSES[fallback];
      return known && !seen.has(known.address);
    });

    await runInBatches(actorTargets.slice(0, 4), 2, async (actor) => {
      const found = await findActorAddress(deps.path, emit, actor);
      if (!found) return;
      seen.add(found.address);
      // We need richer info; refetch graph for stats already happened in deepAnalyze.
      // Reuse what's already in deepAnalyses for the address if present.
      const cached = state.deepAnalyses.get(found.address);
      if (cached) {
        state.analysisIds.push(found.analysisId);
        state.analysisSummaries.push({
          id: found.analysisId,
          address: found.address,
          label: actor.name,
          nodeCount: cached.nodeCount,
          edgeCount: cached.edgeCount,
        });
      }
    });

    if (state.analysisSummaries.length > 0) {
      emit({
        kind: "analyses-summary",
        analyses: state.analysisSummaries,
        at: nowIso(),
      });
    }
  }
}
