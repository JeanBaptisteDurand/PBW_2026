import type {
  CorridorAnalysis,
  CorridorPairDef,
  CorridorRouteCandidate,
  CorridorRouteResult,
  CorridorStatus,
  RiskFlagData,
} from "@corlens/core";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { createXRPLClient, type XRPLClientWrapper } from "../xrpl/client.js";
import { analyzeCorridors } from "../analysis/corridorAnalyzer.js";
import { CORRIDOR_CATALOG, classifyOffChainBridgeStatus } from "./catalog.js";
import {
  ScanCache,
  liquidityDepthScore,
  liquidityHash,
  scanRouteLiquidity,
} from "./scanner.js";
import { generateCorridorAiNote, generateCorridorAiNoteLocal } from "./aiNote.js";
import { indexCorridorForRag } from "./ragIndex.js";

// ─── Tunables ──────────────────────────────────────────────────────────────
// These conservative defaults make a cold-start refresh succeed reliably
// against the public xrplcluster.com / s1.ripple.com endpoints. The XRPL
// client itself already throttles every request to ~120ms apart and retries
// twice; the values here govern *between-corridor* and *between-route*
// pacing on top of that.

const MS_BETWEEN_CORRIDORS = 200;
const MS_BETWEEN_ROUTE_PATHFINDS = 150;
// Data-completeness first: path_find up to 5 routes per corridor (enough to
// cover most 3×3 fiat pairs) so the routes-comparison graph always has
// multiple real edges, not just one. Low-importance corridors still get a
// cheaper tier so the full refresh stays inside the hourly window.
const MAX_PATHFIND_ROUTES_HIGH = 5;
const MAX_PATHFIND_ROUTES_LOW = 3;
const MIN_LIQUIDITY_DEPTH_FOR_PATHFIND = 4; // lowered — even modest books are worth a pathfind attempt
const PATHFIND_IMPORTANCE_THRESHOLD = 70; // anything ≥70 gets the high tier
const AI_NOTE_IMPORTANCE_THRESHOLD = 75; // only burn OpenAI tokens on the top tier + anything with live paths

// ─── Status helpers ────────────────────────────────────────────────────────

function classifyAnalysis(analysis: CorridorAnalysis | null): CorridorStatus {
  if (!analysis || analysis.paths.length === 0) return "RED";
  const cheapest = analysis.paths[analysis.defaultPathIndex] ?? analysis.paths[0];
  const flags = cheapest.hops.flatMap((h) => h.riskFlags);
  if (flags.some((f) => f.severity === "HIGH")) return "RED";
  if (flags.some((f) => f.severity === "MED")) return "AMBER";
  if (flags.length > 0) return "AMBER";
  return "GREEN";
}

function collectUniqueFlags(analysis: CorridorAnalysis | null): RiskFlagData[] {
  if (!analysis) return [];
  const byFlag = new Map<string, RiskFlagData>();
  for (const p of analysis.paths) {
    for (const h of p.hops) {
      for (const f of h.riskFlags) {
        if (!byFlag.has(f.flag)) byFlag.set(f.flag, f);
      }
    }
  }
  return Array.from(byFlag.values());
}

// ─── Catalog seeding ───────────────────────────────────────────────────────

export async function seedCorridorCatalog(): Promise<void> {
  let createdNotes = 0;
  let repairedNotes = 0;
  for (const entry of CORRIDOR_CATALOG) {
    const winningRoute = entry.routes[0];
    // Every corridor — on-chain or off-chain-bridge — gets a deterministic
    // local AI note at seed time so there are never blank cards.
    //
    // Seed status derivation:
    //  - off-chain-bridge: derived from actor quality via
    //    classifyOffChainBridgeStatus (GREEN if both sides strong, AMBER
    //    if workable, RED if thin). This is the honest framing for these
    //    corridors — their status reflects real-world rail quality, not
    //    on-chain XRPL depth.
    //  - on-chain: seeded AMBER. Gets overwritten on the first refresh
    //    when live path_find + liquidity data arrives.
    const seedStatus =
      entry.category === "off-chain-bridge"
        ? classifyOffChainBridgeStatus(entry).status
        : "AMBER";
    const seedAiNote = generateCorridorAiNoteLocal(entry, {
      status: seedStatus,
      routes: [],
      winner: null,
    });
    const existing = await prisma.corridor.findUnique({
      where: { id: entry.id },
      select: { aiNote: true, status: true },
    });
    await prisma.corridor.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        label: entry.label,
        shortLabel: entry.shortLabel,
        flag: entry.flag,
        tier: entry.tier,
        importance: entry.importance,
        region: entry.region,
        category: entry.category,
        description: entry.description,
        useCase: entry.useCase,
        highlights: entry.highlights as any,
        relatedIds: (entry.relatedCorridorIds ?? []) as any,
        amount: entry.amount,
        sourceJson: entry.source as any,
        destJson: entry.dest as any,
        requestJson: winningRoute?.request as any,
        status: seedStatus,
        aiNote: seedAiNote,
      },
      update: {
        label: entry.label,
        shortLabel: entry.shortLabel,
        flag: entry.flag,
        tier: entry.tier,
        importance: entry.importance,
        region: entry.region,
        category: entry.category,
        description: entry.description,
        useCase: entry.useCase,
        highlights: entry.highlights as any,
        relatedIds: (entry.relatedCorridorIds ?? []) as any,
        amount: entry.amount,
        sourceJson: entry.source as any,
        destJson: entry.dest as any,
        requestJson: winningRoute?.request as any,
        // Repair pass: backfill missing notes and flip any lingering
        // UNKNOWN statuses to the seed status. For off-chain-bridge
        // corridors we ALWAYS overwrite the status with the classifier
        // result — these lanes have no live scan to respect, so the
        // actor-derived status is authoritative every time the catalog
        // is reseeded (actor registry changes → status changes).
        ...(existing?.aiNote && entry.category !== "off-chain-bridge"
          ? {}
          : { aiNote: seedAiNote }),
        ...(entry.category === "off-chain-bridge"
          ? { status: seedStatus }
          : existing?.status && existing.status !== "UNKNOWN"
            ? {}
            : { status: seedStatus }),
      },
    });
    if (!existing) createdNotes++;
    else if (!existing.aiNote || existing.status === "UNKNOWN") repairedNotes++;
    // Seed initial status events for brand-new corridors so the
    // sparkline has data points from day 1. Create one event per day
    // for the last 30 days so the "Status history - last 30 days"
    // chart is fully populated immediately for every corridor type.
    if (!existing) {
      const dayMs = 24 * 60 * 60 * 1000;
      const seedEvents = [];
      for (let d = 29; d >= 0; d--) {
        seedEvents.push({
          corridorId: entry.id,
          status: seedStatus,
          pathCount: 0,
          recCost: null,
          source: "seed" as const,
          at: new Date(Date.now() - d * dayMs),
        });
      }
      await prisma.corridorStatusEvent.createMany({ data: seedEvents });
    }
  }
  logger.info("[corridors] catalog seeded", {
    count: CORRIDOR_CATALOG.length,
    createdNotes,
    repairedNotes,
  });
}

// ─── Best route picker ────────────────────────────────────────────────────

interface PickContext {
  liquidityScore: number;
  hasAnalysis: boolean;
  status: CorridorStatus;
  riskScore: number;
  pathCount: number;
}

function scoreRoute(ctx: PickContext): number {
  // Lower score = better. The scoring is intentionally simple — we add
  // penalties for the things that hurt and subtract for liquidity depth.
  let score = 0;
  if (ctx.pathCount === 0) score += 1000; // hard reject
  if (ctx.status === "RED") score += 200;
  if (ctx.status === "AMBER") score += 40;
  if (ctx.status === "UNKNOWN") score += 60;
  score += ctx.riskScore;
  score -= ctx.liquidityScore * 1.5;
  return score;
}

// ─── Refresh one corridor ─────────────────────────────────────────────────

export interface RefreshResult {
  corridorId: string;
  ok: boolean;
  reusedAiNote: boolean;
  routesScanned: number;
  routesPathFound: number;
  bestRouteId: string | null;
  error?: string;
}

export async function refreshCorridor(
  entry: CorridorPairDef,
  opts: {
    client?: XRPLClientWrapper;
    cache?: ScanCache;
    forceAiNote?: boolean;
  } = {},
): Promise<RefreshResult> {
  const started = Date.now();
  const ownClient = !opts.client;
  const client = opts.client ?? createXRPLClient();
  const cache = opts.cache ?? new ScanCache(client);

  try {
    if (ownClient) await client.connect();

    // Off-chain-bridge corridors (MXN↔NGN, UAE↔IN, etc.) have no on-chain
    // IOU trust lines — the XRPL hop is RLUSD held by off-chain CEX / ODL
    // partners catalogued in ACTORS_BY_CURRENCY. There is nothing to
    // path_find; we derive status from real-world rail quality via
    // classifyOffChainBridgeStatus (ODL + RLUSD + XRP actor scoring) and
    // generate a deterministic AI note from the actor list.
    if (entry.category === "off-chain-bridge" || entry.routes.length === 0) {
      const classification = classifyOffChainBridgeStatus(entry);
      const aiNote = generateCorridorAiNoteLocal(entry, {
        status: classification.status,
        routes: [],
        winner: null,
      });
      // Append to status history so the detail page sparkline has a
      // data point for every refresh (even off-chain-bridge ones where
      // nothing on XRPL changed — the timeline shows refresh cadence
      // and any classifier drift from actor registry edits).
      await prisma.corridorStatusEvent.create({
        data: {
          corridorId: entry.id,
          status: classification.status,
          pathCount: 0,
          recCost: null,
          source: "scan",
        },
      });
      await prisma.corridor.update({
        where: { id: entry.id },
        data: {
          status: classification.status,
          bestRouteId: null,
          pathCount: 0,
          recRiskScore: null,
          recHops: null,
          recCost: null,
          flagsJson: [] as any,
          analysisJson: null as any,
          liquidityJson: null as any,
          routesJson: [] as any,
          requestJson: null as any,
          aiNote,
          liquidityHash: `offchain:${entry.id}`,
          aiNoteHash: aiNote ? `offchain:${entry.id}` : null,
          lastRefreshedAt: new Date(),
          lastError: null,
        },
      });
      return {
        corridorId: entry.id,
        ok: true,
        reusedAiNote: false,
        routesScanned: 0,
        routesPathFound: 0,
        bestRouteId: null,
      };
    }

    // ── Phase 1: scan liquidity for every route ──
    const scanned: Array<{ candidate: CorridorRouteCandidate; result: CorridorRouteResult; depthScore: number }> = [];
    for (const route of entry.routes) {
      const liquidity = await scanRouteLiquidity(cache, route);
      const depthScore = liquidityDepthScore(liquidity);
      scanned.push({
        candidate: route,
        depthScore,
        result: {
          ...route,
          status: "UNKNOWN",
          pathCount: 0,
          recommendedRiskScore: null,
          recommendedHops: null,
          recommendedCost: null,
          flags: [],
          liquidity,
          analysis: null,
          isWinner: false,
          score: undefined,
          scannedAt: new Date().toISOString(),
        },
      });
    }

    // ── Phase 2: rank by liquidity, pick top-N for path_find ──
    // Every corridor runs path_find on *some* routes (we always want at
    // least one real edge in the graph). High-importance corridors get more
    // routes analysed — that's what fills the routes-comparison graph with
    // multiple real edges. Routes below the depth threshold are still
    // skipped because path_find on an empty book wastes 5-10 seconds.
    scanned.sort((a, b) => b.depthScore - a.depthScore);
    const corridorImportant = entry.importance >= PATHFIND_IMPORTANCE_THRESHOLD;
    const maxPathfindRoutes = corridorImportant
      ? MAX_PATHFIND_ROUTES_HIGH
      : MAX_PATHFIND_ROUTES_LOW;
    const pathfindPool = scanned
      .slice(0, maxPathfindRoutes)
      .filter((s) => s.depthScore >= MIN_LIQUIDITY_DEPTH_FOR_PATHFIND);
    let pathFoundCount = 0;
    for (const entry of pathfindPool) {
      try {
        const analysis = await analyzeCorridors(client, entry.candidate.request);
        const status = classifyAnalysis(analysis);
        const flags = collectUniqueFlags(analysis);
        const rec =
          analysis && analysis.recommendedPathIndex >= 0
            ? analysis.paths[analysis.recommendedPathIndex]
            : null;
        entry.result.analysis = analysis;
        entry.result.status = status;
        entry.result.pathCount = analysis?.paths.length ?? 0;
        entry.result.recommendedRiskScore = rec?.riskScore ?? null;
        entry.result.recommendedHops = rec?.hops.length ?? null;
        entry.result.recommendedCost = rec?.sourceAmount ?? null;
        entry.result.flags = flags;
        if (entry.result.pathCount > 0) pathFoundCount++;
      } catch (err: any) {
        logger.warn("[corridors] route analysis failed", {
          id: entry.candidate.routeId,
          error: err?.message,
        });
        entry.result.rejectedReason = err?.message ?? "analysis failed";
      }
      // Pace path_find calls inside one corridor
      await new Promise((r) => setTimeout(r, MS_BETWEEN_ROUTE_PATHFINDS));
    }

    // ── Phase 3: score + pick winner ──
    // Every route that is still UNKNOWN after path_find gets a deterministic
    // fallback status derived from liquidity depth alone. Thresholds tuned
    // so modest but real books land GREEN — the board shouldn't punish
    // corridors that actually work just because the depth isn't whale-tier.
    //
    //   depth >= 15  → GREEN   (real, tradeable book)
    //   depth >=  5  → AMBER   (usable for small flows)
    //   depth >   0  → AMBER   (something is there, flag for review)
    //   depth == 0   → RED     (genuinely empty leg)
    for (const s of scanned) {
      if (s.result.status === "UNKNOWN") {
        if (s.depthScore >= 15) s.result.status = "GREEN";
        else if (s.depthScore > 0) s.result.status = "AMBER";
        else s.result.status = "RED";
      }
    }

    let winner: typeof scanned[0] | null = null;
    for (const s of scanned) {
      const score = scoreRoute({
        liquidityScore: s.depthScore,
        hasAnalysis: s.result.analysis != null,
        status: s.result.status,
        riskScore: s.result.recommendedRiskScore ?? 50,
        pathCount: s.result.pathCount,
      });
      s.result.score = score;
      if (!winner || score < (winner.result.score ?? Infinity)) {
        winner = s;
      }
    }
    if (winner) winner.result.isWinner = true;

    // Routes that weren't path_found get a clear reason
    for (const s of scanned) {
      if (s.result.analysis === null && !s.result.rejectedReason) {
        s.result.rejectedReason =
          s.depthScore < MIN_LIQUIDITY_DEPTH_FOR_PATHFIND
            ? `skipped — liquidity depth ${s.depthScore.toFixed(1)} < ${MIN_LIQUIDITY_DEPTH_FOR_PATHFIND}`
            : `not path-found (top-${maxPathfindRoutes} liquidity rule)`;
      }
    }

    const allRouteResults = scanned.map((s) => s.result);
    const liqHash = liquidityHash(allRouteResults.map((r) => r.liquidity));

    // ── Phase 4: AI note (skip when nothing changed) ──
    // We only pay the OpenAI tax on corridors that BOTH have live paths AND
    // are in the importance top tier. Everything else gets the deterministic
    // local fallback in generateCorridorAiNoteLocal — still informative, but
    // zero API cost. This is critical for refresh throughput since most
    // corridors in a 100+ catalog will not produce a live path on the first
    // scan and OpenAI calls can otherwise dominate the refresh window.
    const existing = await prisma.corridor.findUnique({ where: { id: entry.id } });
    // Never persist UNKNOWN — coerce to RED so every corridor has a
    // decisive status on the board.
    const rawWinnerStatus = winner?.result.status ?? "RED";
    let winnerStatus: CorridorStatus =
      rawWinnerStatus === "UNKNOWN" ? "RED" : rawWinnerStatus;

    // Grace rule: don't downgrade a corridor from GREEN/AMBER to RED on a
    // single transient scan failure. path_find can intermittently return 0
    // paths due to XRPL node load or rate limits. Only persist RED if the
    // corridor was already RED/UNKNOWN, or if the last 3 scans were all RED.
    if (winnerStatus === "RED" && existing?.status && existing.status !== "RED" && existing.status !== "UNKNOWN") {
      const recentEvents = await prisma.corridorStatusEvent.findMany({
        where: { corridorId: entry.id },
        orderBy: { at: "desc" },
        take: 3,
        select: { status: true },
      });
      const allRecentRed = recentEvents.length >= 3 && recentEvents.every((e) => e.status === "RED");
      if (!allRecentRed) {
        // Keep the previous healthy status — this scan was likely a transient failure
        winnerStatus = existing.status as CorridorStatus;
        logger.info("[corridors] Grace rule: kept %s status for %s (transient RED scan)", existing.status, entry.id);
      }
    }
    const winnerHasPaths = (winner?.result.pathCount ?? 0) > 0;
    const importanceHighEnough = entry.importance >= AI_NOTE_IMPORTANCE_THRESHOLD;
    const aiWorthwhile = winnerHasPaths && importanceHighEnough;
    const needsAi =
      aiWorthwhile &&
      (opts.forceAiNote ||
        !existing?.aiNote ||
        existing?.liquidityHash !== liqHash ||
        existing?.status !== winnerStatus);

    let aiNote: string | null = existing?.aiNote ?? null;
    let reusedAiNote = true;
    if (needsAi) {
      try {
        aiNote = await generateCorridorAiNote(entry, {
          status: winnerStatus,
          routes: allRouteResults,
          winner: winner?.result ?? null,
        });
        reusedAiNote = false;
      } catch (err: any) {
        logger.warn("[corridors] AI note generation failed", {
          id: entry.id,
          error: err?.message,
        });
      }
    } else if (!aiWorthwhile && !existing?.aiNote) {
      // Deterministic local fallback — never calls OpenAI. Keeps low-priority
      // dead lanes from looking blank on the board.
      aiNote = generateCorridorAiNoteLocal(entry, {
        status: winnerStatus,
        routes: allRouteResults,
        winner: winner?.result ?? null,
      });
    }

    // ── Phase 5: persist ──
    // Append status history row for the sparkline / trend analytics.
    // Runs BEFORE the main update so a row exists even if the update
    // errors out — the timeline then records the attempt.
    await prisma.corridorStatusEvent.create({
      data: {
        corridorId: entry.id,
        status: winnerStatus,
        pathCount: winner?.result.pathCount ?? 0,
        recCost: winner?.result.recommendedCost ?? null,
        source: "scan",
      },
    });
    await prisma.corridor.update({
      where: { id: entry.id },
      data: {
        status: winnerStatus,
        bestRouteId: winner?.result.routeId ?? null,
        pathCount: winner?.result.pathCount ?? 0,
        recRiskScore: winner?.result.recommendedRiskScore ?? null,
        recHops: winner?.result.recommendedHops ?? null,
        recCost: winner?.result.recommendedCost ?? null,
        flagsJson: (winner?.result.flags ?? []) as any,
        analysisJson: (winner?.result.analysis ?? null) as any,
        liquidityJson: (winner?.result.liquidity ?? null) as any,
        routesJson: allRouteResults as any,
        requestJson: (winner?.result.request ?? null) as any,
        aiNote,
        liquidityHash: liqHash,
        aiNoteHash: aiNote ? liqHash : null,
        lastRefreshedAt: new Date(),
        lastError: null,
      },
    });

    // ── Phase 6: re-index RAG only when AI note changed ──
    if (!reusedAiNote && aiNote) {
      try {
        await indexCorridorForRag(entry.id);
      } catch (err: any) {
        logger.warn("[corridors] RAG indexing failed", {
          id: entry.id,
          error: err?.message,
        });
      }
    }

    logger.info("[corridors] refreshed", {
      id: entry.id,
      status: winnerStatus,
      bestRouteId: winner?.result.routeId,
      routesScanned: scanned.length,
      pathFound: pathFoundCount,
      reusedAiNote,
      durationMs: Date.now() - started,
    });

    return {
      corridorId: entry.id,
      ok: true,
      reusedAiNote,
      routesScanned: scanned.length,
      routesPathFound: pathFoundCount,
      bestRouteId: winner?.result.routeId ?? null,
    };
  } catch (err: any) {
    logger.error("[corridors] refresh failed", { id: entry.id, error: err?.message });
    try {
      await prisma.corridor.update({
        where: { id: entry.id },
        data: {
          lastError: err?.message ?? "unknown error",
          lastRefreshedAt: new Date(),
        },
      });
    } catch {
      // swallow — DB write failures are already logged upstream
    }
    return {
      corridorId: entry.id,
      ok: false,
      reusedAiNote: false,
      routesScanned: 0,
      routesPathFound: 0,
      bestRouteId: null,
      error: err?.message,
    };
  } finally {
    if (ownClient) {
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
    }
  }
}

// ─── Refresh all ───────────────────────────────────────────────────────────

export async function refreshAllCorridors(
  opts: { forceAiNote?: boolean } = {},
): Promise<{ total: number; ok: number; failed: number; reused: number }> {
  await seedCorridorCatalog();

  const client = createXRPLClient();
  await client.connect();
  const cache = new ScanCache(client);

  let ok = 0;
  let failed = 0;
  let reused = 0;
  try {
    for (const entry of CORRIDOR_CATALOG) {
      const res = await refreshCorridor(entry, {
        client,
        cache,
        forceAiNote: opts.forceAiNote,
      });
      if (res.ok) ok++;
      else failed++;
      if (res.reusedAiNote) reused++;
      // Pace between corridors so the public RPC nodes don't throttle us
      await new Promise((r) => setTimeout(r, MS_BETWEEN_CORRIDORS));
    }
  } finally {
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
  }

  logger.info("[corridors] refresh pass complete", {
    total: CORRIDOR_CATALOG.length,
    ok,
    failed,
    reused,
  });
  return { total: CORRIDOR_CATALOG.length, ok, failed, reused };
}
