import type { CorridorChatSource } from "@corlens/core";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { chatCompletion, createEmbedding, getOpenAIClient } from "../ai/openai.js";

// ─── Corridor chat with cosine-sim RAG ─────────────────────────────────────
// Two phases:
//   1. Semantic search over CorridorRagDocument via pgvector cosine distance
//      — optionally biased toward the current corridor the user is on.
//   2. Chat completion with the retrieved docs as grounded context.
//
// If the current corridor doesn't own many docs that match, we still include
// the top-K global matches so the assistant can answer cross-corridor
// questions ("is there a JPY→EUR corridor?").

const SYSTEM_PROMPT = `You are the CorLens Corridor Assistant — a tight, specific helper for answering questions about fiat payment corridors on the XRP Ledger.

You ground every answer in the retrieved context. Never invent offer counts, issuer addresses, or AMM sizes — use only numbers from the context. If the context doesn't cover a question, say so and suggest a related corridor instead of guessing.

Rules:
- Prefer short, direct answers over long explanations
- When the user is viewing a specific corridor, default to it unless they explicitly ask about another
- When comparing corridors, cite them by their short label (e.g. "USD.Bitstamp → CNY.RippleFox")
- When recommending a path, explain *why* using the live risk/liquidity numbers from context
- Don't praise Ripple or XRPL — stay analytical
- Keep responses under 180 words unless the question is explicitly broad`;

interface RetrievedDoc {
  corridorId: string;
  label: string;
  content: string;
  metadata: Record<string, unknown>;
  distance: number;
}

async function vectorSearch(
  queryEmbedding: number[],
  focusCorridorId: string | null,
  limit: number,
): Promise<RetrievedDoc[]> {
  const vec = `[${queryEmbedding.join(",")}]`;
  // Two-query strategy:
  //  - Pull a pool focused on the current corridor (weighted)
  //  - Pull a pool of global best matches
  // Merge + dedupe, then take top `limit`.
  const focused = focusCorridorId
    ? await prisma.$queryRaw<any[]>`
        SELECT d.id, d."corridorId", d.content, d.metadata,
               (d.embedding <=> ${vec}::vector) AS distance,
               c.label
        FROM "CorridorRagDocument" d
        JOIN "Corridor" c ON c.id = d."corridorId"
        WHERE d."corridorId" = ${focusCorridorId}
        ORDER BY d.embedding <=> ${vec}::vector
        LIMIT 6
      `
    : [];

  const global = await prisma.$queryRaw<any[]>`
    SELECT d.id, d."corridorId", d.content, d.metadata,
           (d.embedding <=> ${vec}::vector) AS distance,
           c.label
    FROM "CorridorRagDocument" d
    JOIN "Corridor" c ON c.id = d."corridorId"
    ORDER BY d.embedding <=> ${vec}::vector
    LIMIT ${limit}
  `;

  const merged = new Map<string, RetrievedDoc>();
  for (const row of focused) {
    merged.set(row.id, {
      corridorId: row.corridorId,
      label: row.label,
      content: row.content,
      metadata: row.metadata ?? {},
      distance: Number(row.distance),
    });
  }
  for (const row of global) {
    if (!merged.has(row.id)) {
      merged.set(row.id, {
        corridorId: row.corridorId,
        label: row.label,
        content: row.content,
        metadata: row.metadata ?? {},
        distance: Number(row.distance),
      });
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

// Fallback when there are no embeddings at all (no OpenAI key) — pull
// corridors matching the user's query by checking corridor IDs and labels
// for currency mentions, then fill remaining slots by importance.
async function fallbackDocs(
  focusCorridorId: string | null,
  limit: number,
  userMessage?: string,
): Promise<RetrievedDoc[]> {
  if (focusCorridorId) {
    const c = await prisma.corridor.findUnique({ where: { id: focusCorridorId } });
    if (c) {
      return [{
        corridorId: c.id,
        label: c.label,
        content:
          `${c.label} (${c.shortLabel}). ${c.description} Use case: ${c.useCase}. Status ${c.status}, ${c.pathCount} paths found. ` +
          `AI note: ${c.aiNote ?? "(no AI note yet)"}`,
        metadata: { corridorId: c.id, tier: c.tier, region: c.region, category: c.category },
        distance: 0,
      }];
    }
  }

  // Extract currency codes from the user message (3-letter uppercase words)
  const ccyMatches = userMessage?.match(/\b[A-Z]{3,4}\b/g) ?? [];
  const ccyLower = ccyMatches.map((c) => c.toLowerCase());

  let corridors;
  if (ccyLower.length > 0) {
    // Search corridors whose ID contains any mentioned currency
    const orConditions = ccyLower.flatMap((ccy) => [
      { id: { contains: ccy } },
      { label: { contains: ccy.toUpperCase(), mode: "insensitive" as const } },
    ]);
    corridors = await prisma.corridor.findMany({
      where: { OR: orConditions },
      orderBy: { importance: "desc" },
      take: Math.max(limit, 20),
    });
  } else {
    corridors = await prisma.corridor.findMany({
      orderBy: { importance: "desc" },
      take: limit,
    });
  }

  return corridors.map((c) => ({
    corridorId: c.id,
    label: c.label,
    content:
      `${c.label} (${c.shortLabel}). ${c.description} Use case: ${c.useCase}. Status ${c.status}, ${c.pathCount} paths found. ` +
      `AI note: ${c.aiNote ?? "(no AI note yet)"}`,
    metadata: { corridorId: c.id, tier: c.tier, region: c.region, category: c.category },
    distance: 0,
  }));
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface CorridorChatResult {
  chatId: string;
  content: string;
  sources: CorridorChatSource[];
}

export async function corridorChat(
  params: { message: string; corridorId?: string | null; chatId?: string | null },
): Promise<CorridorChatResult> {
  const focusId = params.corridorId ?? null;
  const focusCorridor = focusId
    ? await prisma.corridor.findUnique({ where: { id: focusId } })
    : null;

  // Chat session (per corridor OR global)
  let chat;
  if (params.chatId) {
    chat = await prisma.corridorRagChat.findUnique({ where: { id: params.chatId } });
    if (!chat) chat = await prisma.corridorRagChat.create({ data: { corridorId: focusId } });
  } else {
    chat = await prisma.corridorRagChat.create({ data: { corridorId: focusId } });
  }

  await prisma.corridorRagMessage.create({
    data: { chatId: chat.id, role: "user", content: params.message },
  });

  // Retrieve context
  let docs: RetrievedDoc[] = [];
  const hasKey = !!getOpenAIClient();
  if (hasKey) {
    try {
      const queryEmb = await createEmbedding(params.message);
      docs = await vectorSearch(queryEmb, focusId, 8);
    } catch (err: any) {
      logger.warn("[corridor.chat] vector search failed, falling back", {
        error: err?.message,
      });
    }
  }
  if (docs.length === 0) {
    docs = await fallbackDocs(focusId, 6, params.message);
  }

  const contextString = docs
    .map((d, i) => `[${i + 1}] ${d.label} (${d.corridorId}):\n${d.content}`)
    .join("\n\n");

  const focusHeader = focusCorridor
    ? `The user is currently viewing the corridor: ${focusCorridor.label} (${focusCorridor.shortLabel}). ID: ${focusCorridor.id}. Default to this corridor unless the user clearly asks about another.`
    : "The user is browsing the corridor atlas (all corridors). Answer from any corridor in context.";

  // Chat history
  const history = await prisma.corridorRagMessage.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const historyAsc = history.reverse();

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: focusHeader },
    {
      role: "system" as const,
      content: `Retrieved corridor context:\n\n${contextString}`,
    },
    ...historyAsc.slice(0, -1).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: params.message },
  ];

  const content = await chatCompletion(messages, { maxTokens: 500, temperature: 0.25 });

  const sources: CorridorChatSource[] = docs.slice(0, 5).map((d) => ({
    corridorId: d.corridorId,
    label: d.label,
    snippet: d.content.slice(0, 240),
    score: Number((1 - d.distance).toFixed(4)),
  }));

  await prisma.corridorRagMessage.create({
    data: {
      chatId: chat.id,
      role: "assistant",
      content,
      sources: sources as any,
    },
  });

  return { chatId: chat.id, content, sources };
}
