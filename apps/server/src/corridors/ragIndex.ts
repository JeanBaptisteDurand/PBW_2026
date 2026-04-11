import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { createEmbeddings, getOpenAIClient } from "../ai/openai.js";

// ─── Corridor RAG indexer ──────────────────────────────────────────────────
// For each corridor we embed:
//   1. The AI note (corridor-level)
//   2. The static description + use case (corridor-level)
//   3. The highlights bullets (corridor-level)
//   4. ONE doc per route — its label, status, liquidity, risk, rationale
//   5. Each unique risk flag on the winner
// All carry corridorId AND routeId (when applicable) in metadata so cosine
// search can filter by "current corridor" or "specific route" context.

interface DocumentDraft {
  content: string;
  metadata: Record<string, unknown>;
}

function buildDrafts(corridor: any): DocumentDraft[] {
  const drafts: DocumentDraft[] = [];
  const base = {
    corridorId: corridor.id,
    label: corridor.label,
    shortLabel: corridor.shortLabel,
    tier: corridor.tier,
    region: corridor.region,
    category: corridor.category,
  };

  if (corridor.aiNote) {
    drafts.push({
      content: `${corridor.label} — AI commentary:\n${corridor.aiNote}`,
      metadata: { ...base, kind: "ai_note" },
    });
  }

  drafts.push({
    content: `${corridor.label} (${corridor.shortLabel}) — what it is: ${corridor.description}\nUse case: ${corridor.useCase}`,
    metadata: { ...base, kind: "description" },
  });

  const highlights = (corridor.highlights as string[] | null) ?? [];
  if (highlights.length > 0) {
    drafts.push({
      content: `${corridor.label} — highlights: ${highlights.join("; ")}`,
      metadata: { ...base, kind: "highlights" },
    });
  }

  // Per-route documents (the heart of the multi-route view)
  const routes = (corridor.routesJson as any[] | null) ?? [];
  for (const r of routes) {
    const liqParts: string[] = [];
    if (r.liquidity?.xrpLeg) {
      liqParts.push(
        `XRP orderbook ${r.liquidity.xrpLeg.toIouOffers}/${r.liquidity.xrpLeg.toXrpOffers}`,
      );
    }
    if (r.liquidity?.directBook) {
      liqParts.push(
        `direct book ${r.liquidity.directBook.fwdOffers}/${r.liquidity.directBook.revOffers}`,
      );
    }
    if (r.liquidity?.amm?.xrpReserve) {
      const xrp = Number(r.liquidity.amm.xrpReserve) / 1_000_000;
      liqParts.push(`AMM ${xrp.toFixed(0)} XRP`);
    }
    if (r.liquidity?.issuerObligation) {
      liqParts.push(`issuer float ${Number(r.liquidity.issuerObligation).toFixed(0)}`);
    }
    const verdict = r.isWinner
      ? "WINNER (picker selected this route)"
      : r.rejectedReason
        ? `REJECTED (${r.rejectedReason})`
        : "alternative";
    drafts.push({
      content:
        `${corridor.label} route ${r.routeId}: ${r.label}. ${verdict}. status=${r.status}, paths=${r.pathCount}` +
        (r.recommendedRiskScore != null ? `, risk=${r.recommendedRiskScore}` : "") +
        (liqParts.length > 0 ? `. Liquidity: ${liqParts.join(", ")}.` : "") +
        (r.rationale ? ` Rationale: ${r.rationale}` : ""),
      metadata: {
        ...base,
        kind: "route",
        routeId: r.routeId,
        sourceIssuer: r.sourceIssuerName,
        destIssuer: r.destIssuerName,
        isWinner: !!r.isWinner,
      },
    });
  }

  // Per-flag docs on the winner — used for "what risks does this corridor carry" questions
  const flags = (corridor.flagsJson as any[] | null) ?? [];
  for (const f of flags) {
    drafts.push({
      content: `${corridor.label} risk flag ${f.flag} (${f.severity}): ${f.detail}`,
      metadata: { ...base, kind: "risk_flag", flag: f.flag, severity: f.severity },
    });
  }

  return drafts;
}

export async function indexCorridorForRag(corridorId: string): Promise<void> {
  if (!getOpenAIClient()) {
    logger.debug("[corridors.rag] no OpenAI key, skipping index", { corridorId });
    return;
  }

  const corridor = await prisma.corridor.findUnique({ where: { id: corridorId } });
  if (!corridor) return;

  const drafts = buildDrafts(corridor);
  if (drafts.length === 0) return;

  await prisma.corridorRagDocument.deleteMany({ where: { corridorId } });

  const batchSize = 20;
  for (let i = 0; i < drafts.length; i += batchSize) {
    const batch = drafts.slice(i, i + batchSize);
    const texts = batch.map((d) => d.content);
    try {
      const embeddings = await createEmbeddings(texts);
      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const emb = embeddings[j];
        if (!emb || emb.length === 0) continue;
        const embStr = `[${emb.join(",")}]`;
        await prisma.$executeRaw`
          INSERT INTO "CorridorRagDocument" (id, "corridorId", content, metadata, embedding, "createdAt")
          VALUES (
            gen_random_uuid(),
            ${corridorId},
            ${doc.content},
            ${JSON.stringify(doc.metadata)}::jsonb,
            ${embStr}::vector,
            NOW()
          )
        `;
      }
    } catch (err: any) {
      logger.error("[corridors.rag] batch embed failed", {
        corridorId,
        error: err?.message,
      });
    }
  }

  logger.info("[corridors.rag] indexed", { corridorId, docCount: drafts.length });
}
