import type { PathClient } from "../../connectors/path.js";
import {
  KNOWN_XRPL_ADDRESSES,
  RLUSD_ISSUER,
  USDC_ISSUER,
  rankActors,
} from "../../data/xrpl-utils.js";
import { EventQueue } from "./_event-queue.js";
import {
  type DeepAnalysisResult,
  type Phase,
  type PhaseContext,
  type RiskFlag,
  type SafePathEvent,
  errMessage,
  nowIso,
} from "./types.js";

async function deepAnalyze(
  path: PathClient,
  q: EventQueue,
  address: string,
  label: string,
): Promise<{ analysisId: string; graphFlags: RiskFlag[] } & DeepAnalysisResult> {
  q.push({
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
    q.push({
      kind: "tool-result",
      name: "deepAnalyze",
      summary: `Analyze failed: ${errMessage(err)}`,
      at: nowIso(),
    });
    return { analysisId: "", label, nodeCount: 0, edgeCount: 0, graphFlags: [] };
  }

  q.push({
    kind: "analysis-started",
    analysisId,
    address,
    label,
    at: nowIso(),
  });

  type AnalysisRow = { status?: string; error?: string };
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const a = (await path.getAnalysis(analysisId)) as AnalysisRow | null;
      if (a?.status === "done") break;
      if (a?.status === "error") {
        q.push({
          kind: "tool-result",
          name: "deepAnalyze",
          summary: `Analysis failed: ${a.error ?? "unknown"}`,
          at: nowIso(),
        });
        return { analysisId, label, nodeCount: 0, edgeCount: 0, graphFlags: [] };
      }
    } catch {
      // transient; keep polling until deadline
    }
  }

  let nodeCount = 0;
  let edgeCount = 0;
  type GraphNode = {
    riskFlags?: Array<{ flag: string; severity: string; detail: string; data?: unknown }>;
  };
  type GraphResponse = { nodes?: GraphNode[]; edges?: unknown[] } | null;
  let graphFlags: RiskFlag[] = [];
  try {
    const graphResponse = (await path.getGraph(analysisId)) as GraphResponse;
    if (graphResponse) {
      nodeCount = Array.isArray(graphResponse.nodes) ? graphResponse.nodes.length : 0;
      edgeCount = Array.isArray(graphResponse.edges) ? graphResponse.edges.length : 0;
      // Approach A: flatten per-node risk flags from the single graph call,
      // avoiding a second HTTP request to the same endpoint.
      graphFlags = (graphResponse.nodes ?? []).flatMap((n) =>
        (n.riskFlags ?? []).map((rf) => ({
          flag: rf.flag,
          severity: rf.severity as RiskFlag["severity"],
          detail: rf.detail,
          data: rf.data as Record<string, unknown> | undefined,
        })),
      );
    }
  } catch (err) {
    // graph fetch failed; counts and flags stay at zero/empty
    console.warn(
      { analysisId, error: err instanceof Error ? err.message : String(err) },
      "deep-entity-analysis: failed to fetch graph, emitting account-crawled with empty flags",
    );
  }

  q.push({
    kind: "analysis-complete",
    analysisId,
    nodeCount,
    edgeCount,
    at: nowIso(),
  });
  q.push({
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
    q.push({
      kind: "rag-answer",
      question: "risk assessment",
      answer: chat.answer,
      at: nowIso(),
    });
  } catch (err) {
    q.push({
      kind: "tool-result",
      name: "deepAnalyzeRag",
      summary: `RAG query failed: ${errMessage(err)}`,
      at: nowIso(),
    });
  }

  return { analysisId, label, nodeCount, edgeCount, ragInsight, graphFlags };
}

async function findActorAddress(
  path: PathClient,
  q: EventQueue,
  actor: { key: string; name: string },
): Promise<{ address: string; analysisId: string } | null> {
  const fallbackKey = actor.key.split("-")[0] ?? actor.key;
  const known = KNOWN_XRPL_ADDRESSES[actor.key] ?? KNOWN_XRPL_ADDRESSES[fallbackKey];
  if (!known) return null;

  q.push({
    kind: "tool-call",
    name: "findActorAddress",
    args: { actor: actor.name, method: "known_registry" },
    at: nowIso(),
  });
  q.push({
    kind: "tool-result",
    name: "findActorAddress",
    summary: `${actor.name} XRPL address: ${known.address.slice(0, 12)}… (from known registry)`,
    at: nowIso(),
  });
  const result = await deepAnalyze(path, q, known.address, `${actor.name} (${known.label})`);
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

  async *run(ctx: PhaseContext): AsyncGenerator<SafePathEvent> {
    const { input, state, deps } = ctx;
    yield {
      kind: "step",
      step: "deep_analysis",
      detail: "Running deep entity analysis on critical XRPL accounts",
      at: nowIso(),
    };

    const queue = new EventQueue();
    const targets: Array<{ address: string; label: string }> = [];
    const seen = state.analyzedAddresses;

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

    const work = (async () => {
      await runInBatches(targets, 3, async ({ address, label }) => {
        const result = await deepAnalyze(deps.path, queue, address, label);
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

        // Emit account-crawled for each newly-analyzed address so downstream
        // phases (and the SSE client) know this entity was crawled. Phase 06
        // uses ctx.state.crawledAddresses to avoid double-emitting.
        //
        // Risk flags: graphFlags are extracted inline from the getGraph response
        // already fetched inside deepAnalyze (Approach A — no second HTTP call).
        // Since each deep analysis is seeded with a single address (one seed →
        // one graph), every flag in the result belongs to this target.
        // Severity weights: HIGH=30, MED=15, LOW=5, capped at 100.
        if (!state.crawledAddresses.has(address)) {
          state.crawledAddresses.add(address);
          const riskFlags: RiskFlag[] = result.graphFlags;
          let riskScore = 0;
          for (const rf of riskFlags) {
            riskScore += rf.severity === "HIGH" ? 30 : rf.severity === "MED" ? 15 : 5;
          }
          riskScore = Math.min(100, riskScore);
          queue.push({
            kind: "account-crawled",
            address,
            name: label,
            reason: "deep-entity-analysis",
            score: riskScore,
            flags: riskFlags,
            at: nowIso(),
          });
        }
      });

      queue.push({
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
        const found = await findActorAddress(deps.path, queue, actor);
        if (!found) return;
        seen.add(found.address);
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
        queue.push({
          kind: "analyses-summary",
          analyses: state.analysisSummaries,
          at: nowIso(),
        });
      }
    })().finally(() => queue.end());

    for await (const ev of queue.drain()) yield ev;
    await work;
  }
}
