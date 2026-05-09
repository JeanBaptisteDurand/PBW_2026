import { type ActorEntry, classifyOffChainBridgeStatus, rankActors } from "./_currency-meta.js";
import {
  type Phase,
  type PhaseContext,
  type PhaseEmit,
  type SharedState,
  type SplitLeg,
  nowIso,
} from "./types.js";

const VERDICT_LABEL: Record<string, string> = {
  SAFE: "SAFE — On-chain path approved",
  OFF_CHAIN_ROUTED: "APPROVED — Off-chain route via bridge asset",
  REJECTED: "REJECTED — All paths exceed risk tolerance",
  NO_PATHS: "NO PATHS — No viable route found",
};

function formatActorSection(
  L: string[],
  actors: ActorEntry[],
  label: string,
  limit: number,
  research: Map<string, string[]>,
): void {
  L.push(`\n### ${label} (${actors.length} total, top ${Math.min(limit, actors.length)} shown)`);
  L.push("");
  for (const a of rankActors(actors).slice(0, limit)) {
    const tags = [
      a.odl ? "ODL" : null,
      a.supportsRlusd ? "RLUSD" : null,
      a.supportsXrp ? "XRP" : null,
    ]
      .filter(Boolean)
      .join(", ");
    L.push(
      `**${a.name}** · ${a.type}${a.country ? ` · ${a.country}` : ""}${tags ? ` · ${tags}` : ""}`,
    );
    if (a.note) L.push(`> ${a.note}`);
    const bullets = research.get(a.key);
    if (bullets && bullets.length > 0) {
      const useful = bullets
        .filter(
          (b) =>
            !b.includes("As of my last knowledge") &&
            !b.includes("I do not have specific") &&
            b.trim().length > 10,
        )
        .slice(0, 3);
      for (const b of useful) L.push(b);
    }
    L.push("");
  }
}

function formatSplit(L: string[], plan: SplitLeg[]): void {
  L.push("\n## Recommended split plan");
  L.push("");
  L.push("| Allocation | Route | Reason |");
  L.push("|------------|-------|--------|");
  for (const leg of plan) {
    L.push(`| ${leg.percentage}% | ${leg.description} | ${leg.reason} |`);
  }
}

function generateReportMarkdown(
  state: SharedState,
  intent: { srcCcy: string; dstCcy: string; amount: string; maxRiskTolerance?: string },
): string {
  const L: string[] = [];
  const corridorType =
    state.corridor.category === "off-chain-bridge" ? "Off-chain bridge (RLUSD)" : "XRPL-native";
  const corridorStatus = state.corridor.status ?? "UNKNOWN";
  const tolerance = intent.maxRiskTolerance ?? "MED";
  const verdictLabel = VERDICT_LABEL[state.verdict] ?? state.verdict;
  const bridgeAsset = state.corridor.bridgeAsset ?? "RLUSD";

  L.push("# Corlens Safe Path Report");
  L.push(
    `\n> **${intent.srcCcy} → ${intent.dstCcy}** · ${intent.amount} ${intent.srcCcy} · ${new Date().toISOString().split("T")[0]}`,
  );

  // 1. Executive Summary
  L.push("\n## 1. Executive Summary");
  L.push("");
  L.push("| Field | Value |");
  L.push("|-------|-------|");
  L.push(`| Corridor | ${intent.srcCcy} → ${intent.dstCcy} |`);
  L.push(`| Amount | ${intent.amount} ${intent.srcCcy} |`);
  L.push(`| Risk tolerance | ${tolerance} |`);
  L.push(`| Verdict | **${verdictLabel}** |`);
  L.push(`| Corridor type | ${corridorType} |`);
  L.push(`| Bridge asset | ${bridgeAsset} |`);
  L.push(`| Status | ${corridorStatus} |`);

  // 2. Recommended Route
  L.push("\n## 2. Route");
  if (state.verdict === "SAFE") {
    L.push(
      `\nSelected on-chain path with ${state.paths.length - state.rejected.length} surviving alternative(s) after risk evaluation.`,
    );
  } else if (state.verdict === "OFF_CHAIN_ROUTED") {
    const topSrc = rankActors(state.srcActors).slice(0, 1)[0];
    const topDst = rankActors(state.dstActors).slice(0, 1)[0];
    L.push("");
    L.push(
      `This corridor settles **off-chain** via **${bridgeAsset}**. Funds flow through licensed exchange partners.`,
    );
    if (topSrc && topDst) {
      L.push("");
      L.push("```");
      L.push(
        `${intent.srcCcy} (fiat) → ${topSrc.name} → ${bridgeAsset} (XRPL) → ${topDst.name} → ${intent.dstCcy} (fiat)`,
      );
      L.push("```");
    }
  } else {
    L.push("\nNo viable route found for this corridor and risk tolerance.");
  }
  if (state.rejected.length > 0) {
    L.push(`\n**Rejected paths (${state.rejected.length}):**`);
    for (const r of state.rejected) L.push(`- ${r.pathId}: ${r.reason}`);
  }

  // 3. Corridor Classification
  L.push("\n## 3. Corridor Classification");
  L.push("");
  L.push("| Property | Value |");
  L.push("|----------|-------|");
  L.push(`| Type | ${corridorType} |`);
  L.push(`| Bridge | ${bridgeAsset} |`);
  L.push(`| Status | ${corridorStatus} |`);
  L.push(`| Source actors | ${state.srcActors.length} |`);
  L.push(`| Dest actors | ${state.dstActors.length} |`);

  // 4. Risk Flags
  L.push("\n## 4. Risk Flags");
  L.push("");
  if (state.deepAnalyses.size === 0) {
    L.push("No deep entity analyses produced flags.");
  } else {
    L.push("| Entity | Source | Detail |");
    L.push("|--------|--------|--------|");
    for (const [addr, data] of state.deepAnalyses) {
      const detail = data.ragInsight ? data.ragInsight.split("\n")[0]?.slice(0, 120) : "no insight";
      L.push(`| ${data.label} | ${addr.slice(0, 12)}… | ${detail} |`);
    }
  }

  if (state.partnerDepth) {
    L.push("\n## 5. Partner Depth (live)");
    L.push("");
    L.push("| Metric | Value |");
    L.push("|--------|-------|");
    L.push(`| Venue | ${state.partnerDepth.venue} |`);
    L.push(`| Book | ${state.partnerDepth.book} |`);
    L.push(
      `| Bid depth | ${state.partnerDepth.bidDepthBase} (${state.partnerDepth.bidCount} levels) |`,
    );
    L.push(
      `| Ask depth | ${state.partnerDepth.askDepthBase} (${state.partnerDepth.askCount} levels) |`,
    );
    L.push(
      `| Spread | ${state.partnerDepth.spreadBps !== null ? `${state.partnerDepth.spreadBps.toFixed(1)} bps` : "n/a"} |`,
    );
  }

  if (state.splitPlan) formatSplit(L, state.splitPlan);

  // Actor research
  L.push("\n## Actor Research");
  formatActorSection(L, state.srcActors, `${intent.srcCcy} on-ramps`, 5, state.actorResearch);
  formatActorSection(L, state.dstActors, `${intent.dstCcy} off-ramps`, 5, state.actorResearch);

  if (state.deepAnalyses.size > 0) {
    L.push("\n## Entity Audit Findings");
    L.push(`\n${state.deepAnalyses.size} XRPL accounts analyzed.\n`);
    for (const [addr, data] of state.deepAnalyses) {
      L.push(`### ${data.label}`);
      L.push(`\`${addr}\` · ${data.nodeCount} nodes · ${data.edgeCount} edges\n`);
      if (data.ragInsight) {
        const lines = data.ragInsight.split("\n").filter((l) => l.trim().length > 0);
        for (const line of lines.slice(0, 6)) L.push(line);
      }
      L.push("");
    }
  }

  if (state.corridorRagAnswer) {
    L.push("\n## Corridor Intelligence");
    L.push("");
    L.push(state.corridorRagAnswer);
  }

  // Compliance Justification
  L.push("\n## Compliance Justification");
  L.push("");
  L.push(state.reasoning || "(no reasoning collected)");

  // Historical Status
  L.push("\n## Historical Status");
  L.push("");
  L.push(
    `30-day sparkline data is available on the corridor detail page for ${intent.srcCcy} → ${intent.dstCcy}. Check the corridor health dashboard for trend information on liquidity depth, spread, and volume.`,
  );

  if (state.corridor.category === "off-chain-bridge" && state.srcActors.length > 0) {
    const cls = classifyOffChainBridgeStatus(state.srcActors, state.dstActors);
    L.push(`\n*Off-chain bridge status: ${cls.status}. ${cls.reason}*`);
  }

  // Disclaimer
  L.push("\n## Disclaimer");
  L.push("");
  L.push(
    "This report is generated by the Corlens Safe Path Agent for informational purposes only. It does not constitute financial, legal, or compliance advice. On-chain data may change between the time of analysis and execution. Off-chain actor information is sourced from public records and may not reflect the most current regulatory status. Always verify critical information independently before executing large-value transfers.",
  );

  L.push(`\n---\n*Generated by Corlens Safe Path Agent · ${new Date().toISOString()}*`);
  return L.join("\n");
}

export class ReportPhase implements Phase {
  readonly name = "report" as const;

  async run(ctx: PhaseContext, emit: PhaseEmit): Promise<void> {
    const { input, state, deps } = ctx;
    emit({
      kind: "step",
      step: "verdict",
      detail: "Computing final verdict and justification",
      at: nowIso(),
    });

    // Promote verdict if still NO_PATHS but corridor exists & off-chain bridge ran
    if (state.verdict === "NO_PATHS" && state.corridor.id && !state.isOnChain) {
      state.verdict = "OFF_CHAIN_ROUTED";
      state.riskScore = state.riskScore ?? 0.4;
    }

    let raw = "";
    if (state.verdict === "SAFE") {
      raw = `Selected on-chain path with ${state.paths.length - state.rejected.length} surviving alternative(s).`;
    } else if (state.verdict === "OFF_CHAIN_ROUTED") {
      const topSrc = rankActors(state.srcActors)
        .slice(0, 2)
        .map((a) => a.name)
        .join(", ");
      const topDst = rankActors(state.dstActors)
        .slice(0, 2)
        .map((a) => a.name)
        .join(", ");
      raw = `Off-chain route via ${state.corridor.bridgeAsset ?? "RLUSD"}. Src ramps: ${topSrc || "(none)"}. Dst ramps: ${topDst || "(none)"}.`;
    } else if (state.verdict === "REJECTED") {
      raw = `All ${state.paths.length} paths exceeded ${input.maxRiskTolerance ?? "MED"} tolerance.`;
    } else {
      raw = `No paths found for ${input.srcCcy} → ${input.dstCcy}.`;
    }

    let polished = raw;
    try {
      const allRagInsights = Array.from(state.deepAnalyses.values())
        .map((d) => d.ragInsight)
        .filter(Boolean)
        .join("\n");
      const actorFacts = Array.from(state.actorResearch.entries())
        .map(([k, v]) => `${k}: ${v.slice(0, 2).join("; ")}`)
        .join("\n");
      const result = await deps.ai.complete({
        purpose: "agent.report",
        messages: [
          {
            role: "system",
            content:
              "Write a 4-6 sentence compliance justification for a treasury routing decision. Include: corridor type, key actors researched, risk flags found, any deep analysis insights, split plan if applicable. Be factual and specific. This goes in a signed PDF.",
          },
          {
            role: "user",
            content: `Intent: ${input.amount} ${input.srcCcy} → ${input.dstCcy}, tolerance ${input.maxRiskTolerance ?? "MED"}. Verdict: ${state.verdict}. Raw: ${raw}. Actor research:\n${actorFacts}\nRAG insights:\n${allRagInsights}\nCorridor RAG: ${state.corridorRagAnswer ?? "(none)"}\nSplit: ${state.splitPlan ? state.splitPlan.map((l) => `${l.percentage}%: ${l.reason}`).join("; ") : "none"}.`,
          },
        ],
        temperature: 0.2,
        maxTokens: 500,
      });
      polished = result.content.trim();
    } catch {
      // fall back to raw reasoning
    }

    state.reasoning = `${state.reasoning}\n${polished}`.trim();
    const md = generateReportMarkdown(state, input);
    state.reportMarkdown = md;
    emit({ kind: "report", markdown: md, at: nowIso() });

    state.resultJson = {
      corridorId: state.corridor.id,
      corridorLabel: state.corridor.label,
      corridorStatus: state.corridor.status,
      verdict: state.verdict,
      riskScore: state.riskScore,
      paths: state.paths.length,
      rejected: state.rejected.length,
      splitPlan: state.splitPlan,
      partnerDepth: state.partnerDepth,
      analysisIds: state.analysisIds,
    };
  }
}
