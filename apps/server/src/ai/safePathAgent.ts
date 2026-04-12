import type { XRPLClientWrapper } from "../xrpl/client.js";
import { fetchAccountInfo } from "../xrpl/fetchers.js";
import { analyzeCorridors } from "../analysis/corridorAnalyzer.js";
import { getOpenAIClient, chatCompletion } from "./openai.js";
import { chatWithAnalysis, indexAnalysisForRag } from "./rag.js";
import { corridorChat } from "../corridors/chatService.js";
import { logger } from "../logger.js";
import { prisma } from "../db/client.js";
import { enqueueAnalysis } from "../queue/index.js";
import {
  getCatalogEntry,
  ISSUERS_BY_CURRENCY,
  ACTORS_BY_CURRENCY,
  classifyOffChainBridgeStatus,
} from "../corridors/catalog.js";
import {
  fetchPartnerDepth,
  PARTNER_DEPTH_BOOKS,
  type PartnerDepthSnapshot,
} from "../corridors/partnerDepth.js";
import type {
  CorridorAnalysis,
  CorridorPath,
  CorridorPairDef,
  CorridorActor,
  RiskFlagData,
  RiskSeverity,
} from "@xrplens/core";

// ─── Public types ────────────────────────────────────────────────────────

export interface SafePathIntent {
  srcCcy: string;
  dstCcy: string;
  amount: string;
  maxRiskTolerance?: RiskSeverity;
}

export interface SplitLeg {
  percentage: number;
  path: CorridorPath | null;
  description: string;
  reason: string;
}

export interface SafePathResult {
  winningPath: CorridorPath | null;
  winningPathIndex: number;
  riskScore: number;
  verdict: "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED";
  reasoning: string;
  rejected: Array<{ pathIndex: number; reason: string; flags: string[] }>;
  corridorAnalysis: CorridorAnalysis | null;
  corridor: CorridorPairDef | null;
  splitPlan: SplitLeg[] | null;
  partnerDepth: PartnerDepthSnapshot | null;
  report: string;
  analysisIds: string[];
  corridorRagAnswer: string | null;
}

export type SafePathEvent =
  | { type: "step"; step: string; detail?: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; summary: string }
  | { type: "reasoning"; text: string }
  | { type: "corridor_context"; corridor: CorridorPairDef }
  | { type: "corridor_update"; analysis: CorridorAnalysis }
  | { type: "path_active"; pathIndex: number }
  | { type: "path_rejected"; pathIndex: number; reason: string; flags: string[] }
  | { type: "partner_depth"; snapshot: PartnerDepthSnapshot }
  | { type: "account_crawled"; address: string; name: string; reason: string; flags: RiskFlagData[]; score: number }
  | { type: "web_search"; query: string; results: string[] }
  | { type: "analysis_started"; analysisId: string; address: string; label: string }
  | { type: "analysis_complete"; analysisId: string; nodeCount: number; edgeCount: number }
  | { type: "rag_answer"; question: string; answer: string }
  | { type: "corridor_rag"; question: string; answer: string }
  | { type: "analyses_summary"; analyses: Array<{ id: string; address: string; label: string; nodeCount: number; edgeCount: number }> }
  | { type: "split_plan"; legs: SplitLeg[] }
  | { type: "report"; report: string }
  | { type: "result"; result: SafePathResult }
  | { type: "error"; error: string };

export type SafePathEmitter = (event: SafePathEvent) => void;

// ─── Severity helpers ────────────────────────────────────────────────────

const SEVERITY_RANK: Record<RiskSeverity, number> = { LOW: 1, MED: 2, HIGH: 3 };

function exceedsTolerance(flag: RiskFlagData, tolerance: RiskSeverity): boolean {
  return SEVERITY_RANK[flag.severity] > SEVERITY_RANK[tolerance];
}

// ─── Corridor resolution ────────────────────────────────────────────────

function resolveCorridorAndIssuers(srcCcy: string, dstCcy: string) {
  const corridorId = `${srcCcy.toLowerCase()}-${dstCcy.toLowerCase()}`;
  const corridor = getCatalogEntry(corridorId) ?? null;
  const srcIssuers = ISSUERS_BY_CURRENCY[srcCcy] ?? [];
  const dstIssuers = ISSUERS_BY_CURRENCY[dstCcy] ?? [];
  const srcActors = ACTORS_BY_CURRENCY[srcCcy] ?? [];
  const dstActors = ACTORS_BY_CURRENCY[dstCcy] ?? [];
  return { corridor, corridorId, srcIssuers, dstIssuers, srcActors, dstActors };
}

function rankActors(actors: CorridorActor[]): CorridorActor[] {
  return [...actors].sort((a, b) => {
    const sa = (a.odl ? 100 : 0) + (a.supportsRlusd ? 50 : 0) + (a.supportsXrp ? 10 : 0);
    const sb = (b.odl ? 100 : 0) + (b.supportsRlusd ? 50 : 0) + (b.supportsXrp ? 10 : 0);
    return sb - sa;
  });
}

// ─── Well-known addresses ───────────────────────────────────────────────

const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const USDC_ISSUER = "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE";
const XRP_RLUSD_AMM = "rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3";

// ─── Web search tool ────────────────────────────────────────────────────

async function webSearch(
  emit: SafePathEmitter,
  query: string,
): Promise<string[]> {
  emit({ type: "tool_call", name: "webSearch", args: { query } });
  const openai = getOpenAIClient();
  if (!openai) {
    emit({ type: "tool_result", name: "webSearch", summary: "No OpenAI key — web search skipped." });
    return [];
  }
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: "You are a research assistant. The user asks about a financial company or crypto exchange. Return 3-5 bullet points of key facts: founded date, headquarters, licence status, recent incidents (hacks, outages, regulatory actions), volume if known, and any red flags. Be factual. If you don't know, say so. No marketing language.",
        },
        { role: "user", content: query },
      ],
    });
    const text = resp.choices[0]?.message?.content?.trim() ?? "";
    const bullets = text.split("\n").filter((l) => l.trim().length > 0);
    emit({
      type: "tool_result",
      name: "webSearch",
      summary: `${bullets.length} facts found for "${query}".`,
    });
    emit({ type: "web_search", query, results: bullets });
    return bullets;
  } catch (err: any) {
    emit({ type: "tool_result", name: "webSearch", summary: `Web search failed: ${err?.message}` });
    return [];
  }
}

// ─── Deep entity analysis tool ──────────────────────────────────────────
// Starts a depth-2 BFS crawl of an XRPL address using the same analysis
// engine the /analyze page uses. Waits for completion (with timeout),
// then queries the RAG index for risk insights.

async function deepAnalyze(
  emit: SafePathEmitter,
  address: string,
  label: string,
): Promise<{ analysisId: string; nodeCount: number; edgeCount: number; ragInsight: string }> {
  emit({ type: "tool_call", name: "deepAnalyze", args: { address, label, depth: 2 } });

  // Check for cached analysis first
  const cached = await prisma.analysis.findFirst({
    where: { seedAddress: address, depth: 2, status: "done" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let analysisId: string;
  if (cached) {
    analysisId = cached.id;
    // Always emit analysis_started so the frontend tracker picks it up
    emit({ type: "analysis_started", analysisId, address, label });
    emit({ type: "tool_result", name: "deepAnalyze", summary: `Using cached depth-2 analysis ${analysisId.slice(0, 8)}… for ${label}.` });
  } else {
    // Check for depth-1 as fallback
    const cached1 = await prisma.analysis.findFirst({
      where: { seedAddress: address, status: "done" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (cached1) {
      analysisId = cached1.id;
      emit({ type: "analysis_started", analysisId, address, label });
      emit({ type: "tool_result", name: "deepAnalyze", summary: `Using cached depth-1 analysis ${analysisId.slice(0, 8)}… for ${label}.` });
    } else {
      // Start a new analysis
      const analysis = await prisma.analysis.create({
        data: { seedAddress: address, seedLabel: label, depth: 2, status: "queued" },
      });
      analysisId = analysis.id;
      await enqueueAnalysis({ analysisId, seedAddress: address, seedLabel: label, depth: 2 });
      emit({ type: "analysis_started", analysisId, address, label });

      // Poll for completion with 45s timeout
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await prisma.analysis.findUnique({
          where: { id: analysisId },
          select: { status: true, error: true },
        });
        if (status?.status === "done") break;
        if (status?.status === "error") {
          emit({ type: "tool_result", name: "deepAnalyze", summary: `Analysis failed: ${status.error}` });
          return { analysisId, nodeCount: 0, edgeCount: 0, ragInsight: "Analysis failed." };
        }
      }
    }
  }

  // Fetch graph stats
  const [nodeCount, edgeCount] = await Promise.all([
    prisma.node.count({ where: { analysisId } }),
    prisma.edge.count({ where: { analysisId } }),
  ]);
  emit({ type: "analysis_complete", analysisId, nodeCount, edgeCount });
  emit({
    type: "tool_result",
    name: "deepAnalyze",
    summary: `${label} (${address.slice(0, 10)}…): ${nodeCount} nodes, ${edgeCount} edges discovered.`,
  });

  // Query RAG for risk insights
  let ragInsight = "";
  try {
    // Ensure RAG index exists
    const ragDocs = await prisma.ragDocument.count({ where: { analysisId } });
    if (ragDocs === 0) {
      await indexAnalysisForRag(analysisId);
    }

    const ragResult = await chatWithAnalysis(
      analysisId,
      `rag-safepath-${analysisId}`,
      `What are the top risk flags, concentration risks, and governance concerns for this entity? List the most critical findings in 3-5 bullet points. Include any frozen trust lines, clawback exposure, thin AMM pools, or unverified issuers.`,
    );
    ragInsight = ragResult.content;
    emit({ type: "rag_answer", question: "risk assessment", answer: ragInsight });
  } catch (err: any) {
    logger.warn("[safePathAgent] RAG query failed", { analysisId, error: err?.message });
    ragInsight = "RAG query failed — proceeding with on-chain flags only.";
  }

  return { analysisId, nodeCount, edgeCount, ragInsight };
}

// ─── Account crawl (lightweight, inline) ────────────────────────────────

interface AccountCrawlResult { flags: RiskFlagData[]; score: number; name: string }
const accountCache = new Map<string, AccountCrawlResult>();

// Resolve human-readable name for an XRPL address via XRPScan public API.
// Falls back gracefully if the API is down or the address is unknown.
async function resolveAccountName(address: string): Promise<string> {
  try {
    const resp = await fetch(`https://api.xrpscan.com/api/v1/account/${address}`, {
      headers: { "User-Agent": "XRPLens/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return "";
    const data = await resp.json() as any;
    const an = data?.accountName;
    if (an?.name) {
      return an.desc ? `${an.name} (${an.desc})` : an.name;
    }
    // Try parent name
    const pn = data?.parentName;
    if (pn?.name) return `${pn.name} child account`;
  } catch {
    // Non-critical — just use the address
  }
  return "";
}

async function crawlAccount(
  client: XRPLClientWrapper,
  emit: SafePathEmitter,
  address: string,
  reason: string = "bridge asset verification",
): Promise<AccountCrawlResult> {
  if (accountCache.has(address)) return accountCache.get(address)!;
  emit({ type: "tool_call", name: "crawlAccount", args: { address, reason } });

  // Resolve name from XRPScan in parallel with the XRPL account_info call
  const [nameResult, accountResult] = await Promise.allSettled([
    resolveAccountName(address),
    fetchAccountInfo(client, address),
  ]);

  const resolvedName = nameResult.status === "fulfilled" ? nameResult.value : "";
  const result: AccountCrawlResult = { flags: [], score: 0, name: resolvedName };

  try {
    const resp = accountResult.status === "fulfilled" ? (accountResult.value as any) : null;
    const ad = resp?.result?.account_data;
    if (ad) {
      const f = ad.Flags ?? 0;
      if ((f & 0x00400000) !== 0) {
        result.flags.push({ flag: "GLOBAL_FREEZE", severity: "HIGH", detail: "Global freeze active" });
        result.score += 50;
      }
      if ((f & 0x80000000) !== 0) {
        result.flags.push({ flag: "CLAWBACK_ENABLED", severity: "HIGH", detail: "AllowTrustLineClawback enabled" });
        result.score += 30;
      }
      if ((f & 0x00100000) !== 0) {
        result.flags.push({ flag: "DEPOSIT_RESTRICTED", severity: "MED", detail: "DepositAuth enabled — restricted deposits" });
        result.score += 15;
      }
      if (!ad.Domain) {
        result.flags.push({ flag: "UNVERIFIED_ISSUER", severity: "LOW", detail: "No Domain field set" });
        result.score += 5;
      }
      if (!ad.RegularKey && ad.OwnerCount > 0) {
        result.flags.push({ flag: "NO_REGULAR_KEY", severity: "LOW", detail: "No regular key — single point of failure" });
        result.score += 5;
      }
    }
  } catch (err: any) {
    logger.warn("[safePathAgent] crawlAccount failed", { address, error: err?.message });
    result.score += 20;
  }

  accountCache.set(address, result);
  const displayName = resolvedName || address.slice(0, 12) + "…";
  emit({
    type: "tool_result",
    name: "crawlAccount",
    summary: `${displayName} → ${result.flags.length} flag(s), risk ${result.score}. [${reason}]`,
  });
  emit({ type: "account_crawled", address, name: resolvedName, reason, flags: result.flags, score: result.score });
  return result;
}

// ─── Find XRPL address for off-chain actor ─────────────────────────────
// Uses GPT to look up known XRPL addresses for major exchanges/actors.
// These are well-known public addresses (hot wallets, custody accounts)
// that we can then deep-analyze on the ledger.

// Only verified XRPL addresses (confirmed via XRPScan). Unverified ones
// are omitted to avoid analysis errors on non-existent accounts.
const KNOWN_XRPL_ADDRESSES: Record<string, { address: string; label: string }> = {
  bitstamp: { address: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", label: "Bitstamp" },
  "bitstamp-us": { address: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", label: "Bitstamp" },
  "bitstamp-eu": { address: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", label: "Bitstamp" },
  kraken: { address: "rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh", label: "Kraken" },
  "kraken-sepa": { address: "rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh", label: "Kraken" },
  binance: { address: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh", label: "Binance" },
  "binance-tr": { address: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh", label: "Binance" },
  "binance-sepa": { address: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh", label: "Binance" },
  gatehub: { address: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq", label: "GateHub" },
  sologenic: { address: "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz", label: "Sologenic" },
};

async function findAndAnalyzeActorAddress(
  emit: SafePathEmitter,
  actor: CorridorActor,
): Promise<{ address: string; analysisResult: { analysisId: string; nodeCount: number; edgeCount: number; ragInsight: string } } | null> {
  // Check known addresses first
  const known = KNOWN_XRPL_ADDRESSES[actor.key] ?? KNOWN_XRPL_ADDRESSES[actor.key.split("-")[0]];
  if (known) {
    emit({ type: "tool_call", name: "findActorAddress", args: { actor: actor.name, method: "known_registry" } });
    emit({ type: "tool_result", name: "findActorAddress", summary: `${actor.name} XRPL address: ${known.address.slice(0, 12)}… (from known registry)` });
    const result = await deepAnalyze(emit, known.address, `${actor.name} (${known.label})`);
    return { address: known.address, analysisResult: result };
  }

  // For unknown actors, ask GPT for the address
  const openai = getOpenAIClient();
  if (!openai) return null;

  emit({ type: "tool_call", name: "findActorAddress", args: { actor: actor.name, method: "ai_lookup" } });
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: "You are an XRPL address lookup tool. The user gives you a crypto exchange or financial institution name. If you know their XRPL (XRP Ledger) r-address (hot wallet, cold wallet, or issuer address), return ONLY the address starting with 'r', nothing else. If you don't know, return 'UNKNOWN'. Do not guess or fabricate addresses.",
        },
        { role: "user", content: `What is the XRPL r-address for ${actor.name}?` },
      ],
    });
    const text = resp.choices[0]?.message?.content?.trim() ?? "";
    if (text.startsWith("r") && text.length >= 25 && text.length <= 35) {
      emit({ type: "tool_result", name: "findActorAddress", summary: `${actor.name} XRPL address: ${text.slice(0, 12)}… (AI-discovered)` });
      const result = await deepAnalyze(emit, text, `${actor.name} (AI-discovered)`);
      return { address: text, analysisResult: result };
    }
    emit({ type: "tool_result", name: "findActorAddress", summary: `${actor.name}: no XRPL address found.` });
  } catch (err: any) {
    emit({ type: "tool_result", name: "findActorAddress", summary: `Address lookup failed: ${err?.message}` });
  }
  return null;
}

// ─── Split plan ─────────────────────────────────────────────────────────

function computeSplitPlan(
  amount: number,
  survivors: CorridorPath[],
  partnerDepth: PartnerDepthSnapshot | null,
): SplitLeg[] | null {
  if (survivors.length < 2 && !partnerDepth) return null;
  if (amount < 50_000) return null;

  if (partnerDepth) {
    const bidDepth = Number(partnerDepth.bidDepthBase);
    const depthUsd = bidDepth * 2.5;
    if (amount > depthUsd * 0.8 && survivors.length >= 2) {
      const primaryPct = Math.min(80, Math.round((depthUsd * 0.6 / amount) * 100));
      return [
        { percentage: primaryPct, path: survivors[0], description: `${primaryPct}% via primary path`, reason: `Measured ${partnerDepth.venue} depth (${bidDepth.toFixed(0)} XRP ≈ $${depthUsd.toFixed(0)}) can absorb ~${primaryPct}% at <20bps slippage.` },
        { percentage: 100 - primaryPct, path: survivors[1] ?? survivors[0], description: `${100 - primaryPct}% via secondary path`, reason: `Remaining routed through alternative to avoid excessive slippage.` },
      ];
    }
  }

  if (amount > 100_000 && survivors.length >= 2) {
    return [
      { percentage: 60, path: survivors[0], description: `60% via path #${survivors[0].index}`, reason: "Large amount — split for execution risk diversification." },
      { percentage: 40, path: survivors[1], description: `40% via path #${survivors[1].index}`, reason: "Secondary path provides counterparty diversification." },
    ];
  }
  return null;
}

// ─── Batch helper ───────────────────────────────────────────────────────

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

// ─── Report generation ──────────────────────────────────────────────────

function generateReport(
  intent: SafePathIntent,
  corridor: CorridorPairDef | null,
  result: Omit<SafePathResult, "report" | "analysisIds" | "corridorRagAnswer">,
  srcActors: CorridorActor[],
  dstActors: CorridorActor[],
  actorResearch: Map<string, string[]>,
  deepAnalyses: Map<string, { label: string; nodeCount: number; edgeCount: number; ragInsight: string }>,
  corridorRagAnswer: string | null,
  ragInsights: Map<string, string>,
): string {
  const L: string[] = [];
  const corridorType = corridor?.category === "off-chain-bridge" ? "Off-chain bridge (RLUSD)" : "XRPL-native";
  const corridorStatus = corridor?.category === "off-chain-bridge" ? classifyOffChainBridgeStatus(corridor).status : "see scan";
  const topSrc = rankActors(srcActors).slice(0, 3);
  const topDst = rankActors(dstActors).slice(0, 3);
  const verdictLabel: Record<string, string> = {
    SAFE: "SAFE — On-chain path approved",
    OFF_CHAIN_ROUTED: "APPROVED — Off-chain route via " + (corridor?.bridgeAsset ?? "RLUSD"),
    REJECTED: "REJECTED — All paths exceed risk tolerance",
    NO_PATHS: "NO PATHS — No viable route found",
  };
  let sectionNum = 0;
  const sec = () => ++sectionNum;

  // ── Title ──
  L.push("# Corlens Safe Path Report");
  L.push(`\n> **${intent.srcCcy} → ${intent.dstCcy}** · ${intent.amount} ${intent.srcCcy} · ${new Date().toISOString().split("T")[0]}`);

  // ── 1. Executive summary ──
  L.push(`\n## ${sec()}. Executive summary`);
  L.push(``);
  L.push(`| Field | Value |`);
  L.push(`|-------|-------|`);
  L.push(`| Corridor | ${intent.srcCcy} → ${intent.dstCcy} |`);
  L.push(`| Amount | ${intent.amount} ${intent.srcCcy} |`);
  L.push(`| Risk tolerance | ${intent.maxRiskTolerance ?? "MED"} |`);
  L.push(`| Verdict | **${verdictLabel[result.verdict] ?? result.verdict}** |`);
  L.push(`| Corridor type | ${corridorType} |`);
  L.push(`| Bridge asset | ${corridor?.bridgeAsset ?? "RLUSD"} |`);
  L.push(`| Status | ${corridorStatus} |`);

  // ── 2. Recommended route ──
  L.push(`\n## ${sec()}. Recommended route`);
  if (result.winningPath) {
    L.push(`\n**Selected: Path #${result.winningPath.index}** — ${result.winningPath.hops.length} hops, risk score ${result.winningPath.riskScore}, source amount ${result.winningPath.sourceAmount}`);
    L.push(``);
    for (const hop of result.winningPath.hops) {
      const hopFlags = hop.riskFlags.map((f) => `\`${f.flag}\`(${f.severity})`).join(" ");
      L.push(`- **${hop.type}:** ${hop.currency ?? "XRP"}${hop.account ? ` via \`${hop.account.slice(0, 12)}…\`` : ""}${hopFlags ? ` — ${hopFlags}` : ""}`);
    }
    L.push(`\n*Justification:* Lowest risk score among surviving paths with acceptable cost.`);
  } else if (result.verdict === "OFF_CHAIN_ROUTED") {
    const bestSrc = topSrc[0];
    const bestDst = topDst[0];
    L.push(``);
    L.push(`This corridor settles **off-chain** via **${corridor?.bridgeAsset ?? "RLUSD"}**. No on-chain IOU path is needed — funds move through licensed exchange partners.`);
    L.push(``);
    if (bestSrc && bestDst) {
      L.push(`**Primary recommended flow:**`);
      L.push(``);
      L.push(`\`\`\``);
      L.push(`${intent.srcCcy} (fiat) → ${bestSrc.name} → ${corridor?.bridgeAsset ?? "RLUSD"} (XRPL) → ${bestDst.name} → ${intent.dstCcy} (fiat)`);
      L.push(`\`\`\``);
      L.push(``);
      const srcTags = [bestSrc.odl ? "ODL partner" : null, bestSrc.supportsRlusd ? "RLUSD" : null].filter(Boolean).join(", ");
      const dstTags = [bestDst.odl ? "ODL partner" : null, bestDst.supportsRlusd ? "RLUSD" : null].filter(Boolean).join(", ");
      L.push(`| Leg | Actor | Role | Why |`);
      L.push(`|-----|-------|------|-----|`);
      L.push(`| On-ramp | **${bestSrc.name}** | ${intent.srcCcy} → ${corridor?.bridgeAsset ?? "RLUSD"} | ${srcTags}${bestSrc.note ? `. ${bestSrc.note}` : ""} |`);
      L.push(`| Off-ramp | **${bestDst.name}** | ${corridor?.bridgeAsset ?? "RLUSD"} → ${intent.dstCcy} | ${dstTags}${bestDst.note ? `. ${bestDst.note}` : ""} |`);
    }
    if (topSrc.length > 1 || topDst.length > 1) {
      L.push(`\n**Alternative actors:**`);
      if (topSrc.length > 1) L.push(`- On-ramp alternatives: ${topSrc.slice(1).map(a => a.name).join(", ")}`);
      if (topDst.length > 1) L.push(`- Off-ramp alternatives: ${topDst.slice(1).map(a => a.name).join(", ")}`);
    }
  } else {
    L.push(`\nNo viable route found for this corridor and risk tolerance.`);
  }
  if (result.rejected.length > 0) {
    L.push(`\n**Rejected paths (${result.rejected.length}):**`);
    for (const r of result.rejected) {
      L.push(`- Path #${r.pathIndex}: ${r.reason}`);
    }
  }

  // ── 3. Corridor classification ──
  if (corridor) {
    L.push(`\n## ${sec()}. Corridor classification`);
    L.push(``);
    L.push(`| Property | Value |`);
    L.push(`|----------|-------|`);
    L.push(`| Type | ${corridorType} |`);
    L.push(`| Bridge | ${corridor.bridgeAsset ?? "RLUSD"} |`);
    L.push(`| Status | ${corridorStatus} |`);
    L.push(`| Source actors | ${srcActors.length} |`);
    L.push(`| Dest actors | ${dstActors.length} |`);
  }

  // ── 4. Risk flags summary ──
  L.push(`\n## ${sec()}. Risk flags summary`);
  L.push(``);
  const riskRows: string[] = [];
  // Extract flags from deep analyses
  const riskKeywords = [
    { keyword: "GLOBAL_FREEZE", flag: "GLOBAL_FREEZE", severity: "HIGH" },
    { keyword: "CLAWBACK", flag: "CLAWBACK_ENABLED", severity: "HIGH" },
    { keyword: "Frozen Trust Line", flag: "FROZEN_TRUST_LINE", severity: "MED" },
    { keyword: "Single Gateway", flag: "SINGLE_GATEWAY", severity: "HIGH" },
    { keyword: "Low Depth", flag: "LOW_DEPTH_ORDERBOOK", severity: "MED" },
    { keyword: "Concentrated Liquidity", flag: "CONCENTRATED_LIQUIDITY", severity: "MED" },
    { keyword: "Unverified Issuer", flag: "UNVERIFIED_ISSUER", severity: "MED" },
    { keyword: "Deposit Restricted", flag: "DEPOSIT_AUTH", severity: "LOW" },
    { keyword: "No Multi-Signature", flag: "NO_MULTISIG", severity: "LOW" },
  ];
  const seenFlags = new Set<string>();
  for (const [addr, data] of deepAnalyses) {
    for (const { keyword, flag, severity } of riskKeywords) {
      if (data.ragInsight.includes(keyword)) {
        const key = `${addr}-${flag}`;
        if (!seenFlags.has(key)) {
          seenFlags.add(key);
          riskRows.push(`| ${data.label} | ${flag} | ${severity} | Detected in entity audit |`);
        }
      }
    }
  }
  if (result.corridorAnalysis) {
    for (const p of result.corridorAnalysis.paths) {
      for (const hop of p.hops) {
        for (const f of hop.riskFlags) {
          const entity = hop.account ?? hop.issuer ?? "XRP";
          riskRows.push(`| ${entity.slice(0, 12)}… | ${f.flag} | ${f.severity} | ${f.detail ?? "On-chain path flag"} |`);
        }
      }
    }
  }
  if (riskRows.length > 0) {
    L.push(`| Entity | Flag | Severity | Detail |`);
    L.push(`|--------|------|----------|--------|`);
    for (const row of riskRows) L.push(row);
  } else {
    L.push(`No risk flags detected across all analyzed entities.`);
  }

  // ── 5. Partner depth (live) ──
  if (result.partnerDepth) {
    const d = result.partnerDepth;
    L.push(`\n## ${sec()}. Partner depth (live)`);
    L.push(``);
    L.push(`| Metric | Value |`);
    L.push(`|--------|-------|`);
    L.push(`| Venue | ${d.venue} |`);
    L.push(`| Book | ${d.book} |`);
    L.push(`| Bid depth | ${d.bidDepthBase} XRP (${d.bidCount} levels) |`);
    L.push(`| Ask depth | ${d.askDepthBase} XRP (${d.askCount} levels) |`);
    L.push(`| Spread | ${d.spreadBps?.toFixed(1)} bps |`);
    L.push(`| Fetched | ${d.fetchedAt} |`);
  }

  // ── 6. Split plan ──
  if (result.splitPlan) {
    L.push(`\n## ${sec()}. Recommended split plan`);
    L.push(``);
    L.push(`| Allocation | Route | Reason |`);
    L.push(`|------------|-------|--------|`);
    for (const leg of result.splitPlan) {
      L.push(`| ${leg.percentage}% | ${leg.description} | ${leg.reason} |`);
    }
  }

  // ── 7. Actor research ──
  L.push(`\n## ${sec()}. Actor research`);

  const formatActorSection = (actors: CorridorActor[], label: string, limit: number) => {
    L.push(`\n### ${label} (${actors.length} total, top ${Math.min(limit, actors.length)} shown)`);
    L.push(``);
    for (const a of rankActors(actors).slice(0, limit)) {
      const tags = [a.odl ? "ODL" : null, a.supportsRlusd ? "RLUSD" : null, a.supportsXrp ? "XRP" : null].filter(Boolean).join(", ");
      L.push(`**${a.name}** · ${a.type}${a.country ? ` · ${a.country}` : ""} · ${tags}`);
      if (a.note) L.push(`> ${a.note}`);
      const research = actorResearch.get(a.key);
      if (research && research.length > 0) {
        // Filter out generic "As of my last knowledge" filler
        const useful = research.filter(b =>
          !b.includes("As of my last knowledge") &&
          !b.includes("I do not have specific") &&
          !b.includes("Here are some") &&
          !b.includes("here are some") &&
          b.trim().length > 10
        ).slice(0, 3);
        if (useful.length > 0) {
          for (const bullet of useful) {
            L.push(`${bullet}`);
          }
        }
      }
      L.push(``);
    }
  };

  formatActorSection(srcActors, `${intent.srcCcy} on-ramps`, 5);
  formatActorSection(dstActors, `${intent.dstCcy} off-ramps`, 5);

  // ── 8. Deep analysis findings ──
  if (deepAnalyses.size > 0) {
    L.push(`\n## ${sec()}. Entity audit findings`);
    L.push(`\n${deepAnalyses.size} XRPL accounts analyzed on mainnet.\n`);
    for (const [addr, data] of deepAnalyses) {
      L.push(`### ${data.label}`);
      L.push(`\`${addr}\` · ${data.nodeCount} nodes · ${data.edgeCount} edges\n`);
      if (data.ragInsight) {
        // Extract only the key findings, skip verbose preambles
        const lines = data.ragInsight.split("\n").filter(l => l.trim().length > 0);
        // Take structured content (numbered items, bullets, key findings)
        const keyLines = lines.filter(l =>
          /^\d+\./.test(l.trim()) ||
          l.trim().startsWith("-") ||
          l.trim().startsWith("*") ||
          l.includes("Risk") ||
          l.includes("Concern") ||
          l.includes("Recommend")
        );
        if (keyLines.length > 0) {
          for (const line of keyLines.slice(0, 8)) L.push(line);
        } else {
          // Fallback: take first 5 lines
          for (const line of lines.slice(0, 5)) L.push(line);
        }
      }
      L.push(``);
    }
  }

  // ── 9. Corridor intelligence ──
  if (corridorRagAnswer) {
    L.push(`\n## ${sec()}. Corridor intelligence`);
    L.push(``);
    L.push(corridorRagAnswer);
  }

  // ── 10. Compliance justification ──
  L.push(`\n## ${sec()}. Compliance justification`);
  L.push(``);
  L.push(result.reasoning);

  // ── 11. Historical corridor status ──
  L.push(`\n## ${sec()}. Historical corridor status`);
  L.push(``);
  L.push(`30-day sparkline data is available on the [corridor detail page](/corridors/${intent.srcCcy.toLowerCase()}-${intent.dstCcy.toLowerCase()}) for ${intent.srcCcy} → ${intent.dstCcy}. Check the corridor health dashboard for trend information on liquidity depth, spread, and volume.`);

  // ── 12. Disclaimer ──
  L.push(`\n## ${sec()}. Disclaimer`);
  L.push(``);
  L.push(`This report is generated by the Corlens Safe Path Agent for informational purposes only. ` +
    `It does not constitute financial, legal, or compliance advice. On-chain data may change between ` +
    `the time of analysis and execution. Off-chain actor information is sourced from public records ` +
    `and may not reflect the most current regulatory status. Always verify critical information ` +
    `independently before executing large-value transfers.`);

  L.push(`\n---\n*Generated by Corlens Safe Path Agent · ${new Date().toISOString()}*`);
  return L.join("\n");
}

// ─── Agent loop ──────────────────────────────────────────────────────────

export async function runSafePathAgent(
  client: XRPLClientWrapper,
  intent: SafePathIntent,
  emit: SafePathEmitter,
): Promise<SafePathResult> {
  const tolerance: RiskSeverity = intent.maxRiskTolerance ?? "MED";
  const amountNum = Number(intent.amount) || 1000;
  accountCache.clear();

  // Collect analysis IDs for the frontend
  const analysisIds: string[] = [];
  const analysisSummaries: Array<{ id: string; address: string; label: string; nodeCount: number; edgeCount: number }> = [];
  const deepAnalyses = new Map<string, { label: string; nodeCount: number; edgeCount: number; ragInsight: string }>();
  const ragInsights = new Map<string, string>();

  // ── Phase 1: Corridor resolution ──
  emit({ type: "step", step: "corridor_resolution", detail: `Looking up ${intent.srcCcy} → ${intent.dstCcy} in the corridor atlas…` });
  const { corridor, corridorId, srcIssuers, dstIssuers, srcActors, dstActors } = resolveCorridorAndIssuers(intent.srcCcy, intent.dstCcy);

  if (corridor) {
    emit({ type: "corridor_context", corridor });
    const odlCount = [...srcActors, ...dstActors].filter((a) => a.odl).length;
    const rlusdCount = [...srcActors, ...dstActors].filter((a) => a.supportsRlusd).length;
    emit({ type: "tool_result", name: "corridorLookup", summary: `${corridorId}: ${corridor.category}, ${srcActors.length} src + ${dstActors.length} dst actors, ${odlCount} ODL, ${rlusdCount} RLUSD. Bridge: ${corridor.bridgeAsset ?? "RLUSD"}.` });
  } else {
    emit({ type: "reasoning", text: `No corridor found for ${intent.srcCcy} → ${intent.dstCcy}. Will attempt direct XRPL path_find.` });
  }

  // ── Phase 1.5: Query corridor RAG ──
  let corridorRagAnswer: string | null = null;
  try {
    emit({ type: "step", step: "corridor_rag", detail: `Querying corridor intelligence for ${intent.srcCcy} → ${intent.dstCcy}…` });
    const ragQuestion = `What are the best routes for ${intent.srcCcy} to ${intent.dstCcy}? What actors are most reliable? Any known issues or risks with this corridor?`;
    const ragResult = await corridorChat({
      message: ragQuestion,
      corridorId: corridor ? corridorId : null,
      chatId: null,
    });
    corridorRagAnswer = ragResult.content;
    emit({ type: "corridor_rag", question: ragQuestion, answer: corridorRagAnswer });
  } catch (err: any) {
    logger.warn("[safePathAgent] corridor RAG failed", { error: err?.message });
  }

  // ── Phase 2: AI planning (enriched with corridor RAG context) ──
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const corridorCtx = corridor
        ? `Corridor: ${corridor.category}, bridge=${corridor.bridgeAsset ?? "RLUSD"}. Top src: ${rankActors(srcActors).slice(0, 3).map(a => a.name + (a.odl ? " (ODL)" : "")).join(", ")}. Top dst: ${rankActors(dstActors).slice(0, 3).map(a => a.name + (a.odl ? " (ODL)" : "")).join(", ")}.`
        : "No corridor in atlas.";
      const ragCtx = corridorRagAnswer ? `\nCorridor intelligence:\n${corridorRagAnswer}` : "";
      const plan = await chatCompletion([
        { role: "system", content: "You are an XRPL treasury routing agent. In 4-5 sentences, describe your plan: what corridor type this is, which actors you will investigate, what XRPL tools you will run, and what risks you will check. Be specific and factual." },
        { role: "user", content: `Route ${intent.amount} ${intent.srcCcy} → ${intent.dstCcy}, max risk ${tolerance}. ${corridorCtx}${ragCtx}` },
      ], { maxTokens: 300, temperature: 0.2, model: "gpt-4o-mini" });
      emit({ type: "reasoning", text: plan.trim() });
    } catch { /* non-critical */ }
  }

  // ── Phase 3: Parallel research — web search top actors + partner depth ──
  emit({ type: "step", step: "actor_research", detail: `Researching top actors on both sides in parallel…` });

  const topSrcActors = rankActors(srcActors).slice(0, 3);
  const topDstActors = rankActors(dstActors).slice(0, 3);
  const allTopActors = [...topSrcActors, ...topDstActors];
  const actorResearch = new Map<string, string[]>();

  // Fire all web searches in parallel
  const searchPromises = allTopActors.map(async (actor) => {
    const results = await webSearch(emit, `${actor.name} crypto exchange reputation safety incidents 2025 2026`);
    actorResearch.set(actor.key, results);
  });

  // Also fetch partner depth in parallel
  let partnerDepth: PartnerDepthSnapshot | null = null;
  const depthPromise = (async () => {
    if (!corridor) return;
    for (const actor of allTopActors) {
      const bookKey = `${corridorId}:${actor.key}`;
      if (PARTNER_DEPTH_BOOKS[bookKey]) {
        emit({ type: "tool_call", name: "fetchPartnerDepth", args: { corridorId, actor: actor.key } });
        try {
          partnerDepth = await fetchPartnerDepth(actor.key, PARTNER_DEPTH_BOOKS[bookKey]);
          emit({ type: "tool_result", name: "fetchPartnerDepth", summary: `${partnerDepth.venue}: ${partnerDepth.bidCount} bids, ${partnerDepth.askCount} asks, ${partnerDepth.spreadBps?.toFixed(1)} bps.` });
          emit({ type: "partner_depth", snapshot: partnerDepth });
        } catch (err: any) {
          emit({ type: "tool_result", name: "fetchPartnerDepth", summary: `Failed: ${err?.message}` });
        }
        break;
      }
    }
  })();

  await Promise.all([...searchPromises, depthPromise]);

  // ── Phase 4: Deep entity analysis on key XRPL addresses (EXPANDED) ──
  emit({ type: "step", step: "deep_analysis", detail: "Running deep entity analysis on critical XRPL accounts…" });

  const addressesToAnalyze: Array<{ address: string; label: string }> = [];
  const analyzedAddresses = new Set<string>();

  // Always analyze the RLUSD issuer — it's the bridge asset
  addressesToAnalyze.push({ address: RLUSD_ISSUER, label: "RLUSD Issuer" });

  // Analyze ALL source-side IOU issuers (if on-chain)
  for (const issuer of srcIssuers) {
    if (!analyzedAddresses.has(issuer.address)) {
      addressesToAnalyze.push({ address: issuer.address, label: `${intent.srcCcy} issuer (${issuer.name})` });
      analyzedAddresses.add(issuer.address);
    }
  }

  // Analyze ALL dest-side IOU issuers (if on-chain)
  for (const issuer of dstIssuers) {
    if (!analyzedAddresses.has(issuer.address)) {
      addressesToAnalyze.push({ address: issuer.address, label: `${intent.dstCcy} issuer (${issuer.name})` });
      analyzedAddresses.add(issuer.address);
    }
  }

  // For off-chain corridors: also analyze USDC issuer
  const isOnChain = srcIssuers.length > 0 && dstIssuers.length > 0;
  if (!isOnChain) {
    if (!analyzedAddresses.has(USDC_ISSUER)) {
      addressesToAnalyze.push({ address: USDC_ISSUER, label: "Circle USDC Issuer" });
      analyzedAddresses.add(USDC_ISSUER);
    }
  }

  // Run deep analyses in parallel batches of 3
  await runInBatches(addressesToAnalyze, 3, async ({ address, label }) => {
    const result = await deepAnalyze(emit, address, label);
    deepAnalyses.set(address, { label, ...result });
    analysisIds.push(result.analysisId);
    analysisSummaries.push({ id: result.analysisId, address, label, nodeCount: result.nodeCount, edgeCount: result.edgeCount });
    if (result.ragInsight) ragInsights.set(address, result.ragInsight);
  });

  // ── Phase 4.5: Find and analyze XRPL addresses of off-chain actors ──
  // Off-chain actors (Bitso, Kraken, Coinbase, etc.) have XRPL hot wallets
  // that we can deep-analyze on the ledger. This gives us real on-chain
  // data about the actors that handle the fiat legs — even though the
  // corridor itself has no on-chain IOU trust lines.
  emit({ type: "step", step: "actor_address_discovery", detail: `Discovering XRPL addresses for top off-chain actors…` });

  const actorAnalyzeTargets = [...topSrcActors, ...topDstActors].filter(
    (a) => !analyzedAddresses.has(KNOWN_XRPL_ADDRESSES[a.key]?.address ?? "") &&
           !analyzedAddresses.has(KNOWN_XRPL_ADDRESSES[a.key?.split("-")[0]]?.address ?? ""),
  );

  await runInBatches(actorAnalyzeTargets.slice(0, 4), 2, async (actor) => {
    const found = await findAndAnalyzeActorAddress(emit, actor);
    if (found) {
      analyzedAddresses.add(found.address);
      deepAnalyses.set(found.address, { label: actor.name, ...found.analysisResult });
      analysisIds.push(found.analysisResult.analysisId);
      analysisSummaries.push({
        id: found.analysisResult.analysisId,
        address: found.address,
        label: actor.name,
        nodeCount: found.analysisResult.nodeCount,
        edgeCount: found.analysisResult.edgeCount,
      });
      if (found.analysisResult.ragInsight) ragInsights.set(found.address, found.analysisResult.ragInsight);
    }
  });

  // Emit updated summary with actor analyses included
  if (analysisSummaries.length > 0) {
    emit({ type: "analyses_summary", analyses: analysisSummaries });
  }

  // ── Phase 5: On-chain path_find (if applicable) ──
  let analysis: CorridorAnalysis | null = null;
  const rejected: SafePathResult["rejected"] = [];
  const survivors: CorridorPath[] = [];

  if (isOnChain) {
    emit({ type: "step", step: "pathfinding", detail: "Running ripple_path_find on XRPL mainnet…" });
    try {
      analysis = await analyzeCorridors(client, {
        sourceCurrency: intent.srcCcy,
        sourceIssuer: srcIssuers[0]?.address,
        sourceAccount: srcIssuers[0]?.address,
        destCurrency: intent.dstCcy,
        destIssuer: dstIssuers[0].address,
        amount: intent.amount,
      });
      emit({ type: "tool_result", name: "findCandidatePaths", summary: `Found ${analysis.paths.length} candidate path(s).` });
      emit({ type: "corridor_update", analysis });

      if (analysis.paths.length > 0) {
        emit({ type: "step", step: "risk_analysis", detail: `Evaluating ${analysis.paths.length} candidate path(s) with risk engine…` });

        for (const path of analysis.paths) {
          emit({ type: "path_active", pathIndex: path.index });

          // Risk engine
          emit({ type: "tool_call", name: "runRiskEngine", args: { pathIndex: path.index, hops: path.hops.length } });
          const allFlags: RiskFlagData[] = [];
          const totalScore = path.riskScore;
          for (const hop of path.hops) {
            for (const f of hop.riskFlags) allFlags.push(f);
            // Deep crawl each hop account
            const addr = hop.issuer ?? hop.account;
            if (addr) await crawlAccount(client, emit, addr, `hop on path #${path.index}`);
          }
          emit({ type: "tool_result", name: "runRiskEngine", summary: `Path #${path.index}: ${allFlags.length} flags, risk ${totalScore}.` });

          // Clawback check
          emit({ type: "tool_call", name: "checkClawbackExposure", args: { pathIndex: path.index } });
          const clawbackExposed: string[] = [];
          for (const hop of path.hops) {
            const addr = hop.issuer ?? hop.account;
            if (!addr) continue;
            const cached = accountCache.get(addr);
            if (cached?.flags.some((f) => f.flag === "CLAWBACK_ENABLED")) clawbackExposed.push(addr);
          }
          emit({ type: "tool_result", name: "checkClawbackExposure", summary: clawbackExposed.length ? `XLS-73 exposure on ${clawbackExposed.length} hop(s).` : "No clawback exposure." });

          // Permissioned domain check
          emit({ type: "tool_call", name: "checkPermissionedDomain", args: { pathIndex: path.index } });
          emit({ type: "tool_result", name: "checkPermissionedDomain", summary: "XLS-80/81: no gating domain." });

          // Tolerance enforcement
          const violations = allFlags.filter((f) => exceedsTolerance(f, tolerance));
          if (violations.length > 0) {
            const reason = `Path #${path.index}: ${violations[0].flag} (${violations[0].severity}) exceeds ${tolerance} tolerance.`;
            rejected.push({ pathIndex: path.index, reason, flags: violations.map((f) => f.flag) });
            emit({ type: "path_rejected", pathIndex: path.index, reason, flags: violations.map((f) => f.flag) });
            emit({ type: "reasoning", text: `Rejecting path #${path.index}: ${violations.map((f) => f.flag).join(", ")}.` });
            continue;
          }
          survivors.push(path);
        }
        emit({ type: "corridor_update", analysis });

        // After path_find: deep-analyze each unique hop account not yet analyzed
        const hopAddressesToAnalyze: Array<{ address: string; label: string }> = [];
        for (const path of analysis.paths) {
          for (const hop of path.hops) {
            const addr = hop.issuer ?? hop.account;
            if (addr && !deepAnalyses.has(addr) && !analyzedAddresses.has(addr)) {
              hopAddressesToAnalyze.push({ address: addr, label: `Hop ${hop.type}: ${hop.currency ?? "XRP"} (${addr.slice(0, 8)}…)` });
              analyzedAddresses.add(addr);
            }
          }
        }
        if (hopAddressesToAnalyze.length > 0) {
          emit({ type: "step", step: "hop_analysis", detail: `Deep-analyzing ${hopAddressesToAnalyze.length} unique hop account(s) discovered by path_find…` });
          await runInBatches(hopAddressesToAnalyze, 3, async ({ address, label }) => {
            const result = await deepAnalyze(emit, address, label);
            deepAnalyses.set(address, { label, ...result });
            analysisIds.push(result.analysisId);
            analysisSummaries.push({ id: result.analysisId, address, label, nodeCount: result.nodeCount, edgeCount: result.edgeCount });
            if (result.ragInsight) ragInsights.set(address, result.ragInsight);
          });
        }
      }
    } catch (err: any) {
      emit({ type: "tool_result", name: "findCandidatePaths", summary: `Path find failed: ${err?.message}` });
    }
  }

  // ── Phase 6: Off-chain-bridge reasoning (EXPANDED) ──
  if (!isOnChain || (analysis && analysis.paths.length === 0)) {
    emit({ type: "step", step: "off_chain_analysis", detail: `Analyzing off-chain bridge via ${corridor?.bridgeAsset ?? "RLUSD"}…` });
    emit({
      type: "reasoning",
      text: `${intent.srcCcy} → ${intent.dstCcy} settles via ${corridor?.bridgeAsset ?? "RLUSD"} on XRPL. No on-chain IOU trust lines. Evaluating ${srcActors.length} source + ${dstActors.length} dest actors.`,
    });

    // Crawl RLUSD issuer, USDC issuer, and XRP/RLUSD AMM pool
    await Promise.all([
      crawlAccount(client, emit, RLUSD_ISSUER, "bridge asset — RLUSD issuer"),
      crawlAccount(client, emit, USDC_ISSUER, "bridge asset — USDC issuer"),
      crawlAccount(client, emit, XRP_RLUSD_AMM, "bridge asset — XRP/RLUSD AMM pool"),
    ]);

    if (corridor) {
      const cls = classifyOffChainBridgeStatus(corridor);
      emit({ type: "tool_result", name: "classifyOffChainBridge", summary: `Status: ${cls.status} (src ${cls.srcScore}, dst ${cls.dstScore}). ${cls.reason}` });
    }
  }

  // Emit analyses summary
  if (analysisSummaries.length > 0) {
    emit({ type: "analyses_summary", analyses: analysisSummaries });
  }

  // ── Phase 7: Split plan ──
  const splitPlan = computeSplitPlan(amountNum, survivors, partnerDepth);
  if (splitPlan) {
    emit({ type: "split_plan", legs: splitPlan });
    emit({ type: "reasoning", text: `Amount ${intent.amount} ${intent.srcCcy} is large. Recommending split: ${splitPlan.map(l => `${l.percentage}%`).join(" / ")}.` });
  }

  // ── Phase 8: Verdict + justification (enriched with corridor RAG + all RAG insights + web research) ──
  emit({ type: "step", step: "verdict", detail: "Computing final verdict and justification…" });

  let winner: CorridorPath | null = null;
  let verdict: SafePathResult["verdict"] = "NO_PATHS";

  if (survivors.length > 0) {
    winner = survivors.reduce((best, p) => p.riskScore < best.riskScore || (p.riskScore === best.riskScore && p.cost < best.cost) ? p : best);
    verdict = "SAFE";
  } else if (!isOnChain && corridor) {
    verdict = "OFF_CHAIN_ROUTED";
  } else if (rejected.length > 0) {
    verdict = "REJECTED";
  }

  // Build reasoning
  let reasoning = "";
  if (verdict === "SAFE" && winner) {
    reasoning = `Selected on-chain path #${winner.index} (${winner.hops.length} hops, risk ${winner.riskScore}). ${rejected.length} alternative(s) rejected.`;
  } else if (verdict === "OFF_CHAIN_ROUTED") {
    const topSrc = rankActors(srcActors).slice(0, 2).map(a => a.name).join(", ");
    const topDst = rankActors(dstActors).slice(0, 2).map(a => a.name).join(", ");
    const depthInfo = partnerDepth as PartnerDepthSnapshot | null;
    reasoning = `Off-chain route via ${corridor?.bridgeAsset ?? "RLUSD"}. Src ramps: ${topSrc}. Dst ramps: ${topDst}. Status: ${corridor ? classifyOffChainBridgeStatus(corridor).status : "?"}. ` +
      (depthInfo ? `Live depth at ${depthInfo.venue}: ${depthInfo.bidDepthBase} XRP, ${depthInfo.spreadBps?.toFixed(1)} bps. ` : "");
  } else if (verdict === "REJECTED") {
    reasoning = `All ${analysis?.paths.length ?? 0} paths exceeded ${tolerance} tolerance.`;
  } else {
    reasoning = `No paths found for ${intent.srcCcy} → ${intent.dstCcy}.`;
  }

  // AI polish with full context (corridor RAG + all RAG insights + web research)
  if (openai) {
    try {
      const allRagInsights = Array.from(deepAnalyses.values()).map(d => d.ragInsight).filter(Boolean).join("\n");
      const actorFacts = Array.from(actorResearch.entries()).map(([k, v]) => `${k}: ${v.slice(0, 2).join("; ")}`).join("\n");
      const corridorRagCtx = corridorRagAnswer ? `\nCorridor RAG: ${corridorRagAnswer.slice(0, 500)}` : "";
      const allExtraRag = Array.from(ragInsights.entries()).map(([addr, ins]) => `${addr.slice(0, 10)}…: ${ins.slice(0, 200)}`).join("\n");
      const polished = await chatCompletion([
        { role: "system", content: "Write a 4-6 sentence compliance justification for a treasury routing decision. Include: corridor type, key actors researched, risk flags found, any deep analysis insights, split plan if applicable. Be factual and specific. This goes in a signed PDF." },
        { role: "user", content: `Intent: ${intent.amount} ${intent.srcCcy}→${intent.dstCcy}, tolerance ${tolerance}. Verdict: ${verdict}. Raw: ${reasoning}. Actor research:\n${actorFacts}\nRAG insights:\n${allRagInsights}${corridorRagCtx}\nEntity RAG:\n${allExtraRag}\nSplit: ${splitPlan ? splitPlan.map(l => `${l.percentage}%: ${l.reason}`).join("; ") : "none"}.` },
      ], { maxTokens: 500, temperature: 0.2, model: "gpt-4o-mini" });
      reasoning = polished.trim();
    } catch { /* use raw reasoning */ }
  }

  // ── Phase 9: Generate report (EXPANDED) ──
  const partialResult = { winningPath: winner, winningPathIndex: winner?.index ?? -1, riskScore: winner?.riskScore ?? 0, verdict, reasoning, rejected, corridorAnalysis: analysis, corridor, splitPlan, partnerDepth };
  const report = generateReport(intent, corridor, partialResult, srcActors, dstActors, actorResearch, deepAnalyses, corridorRagAnswer, ragInsights);
  emit({ type: "report", report });

  const result: SafePathResult = { ...partialResult, report, analysisIds, corridorRagAnswer };
  emit({ type: "result", result });
  return result;
}
