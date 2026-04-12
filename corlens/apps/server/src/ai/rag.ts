import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { chatCompletion, createEmbeddings, getOpenAIClient } from "./openai.js";
import type { ChatMessage } from "@corlens/core";

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert XRPL risk analyst specializing in decentralized finance, stablecoin issuers, and token ecosystems on the XRP Ledger. You have deep knowledge of:

- XRPL trust lines and their risk implications (frozen lines, high limits, concentrated holdings)
- AMM (Automated Market Maker) pools: liquidity concentration, TVL analysis, LP token distribution
- XRPL payment paths and gateway dependencies
- Order book depth and spread analysis for liquidity risk
- Compliance considerations for stablecoins and token issuers
- Regulatory risk factors (unverified issuers, global freeze flags, high transfer fees)
- RLUSD (Ripple's stablecoin) ecosystem and impersonation risks

When analyzing data, always:
1. Prioritize HIGH severity risk flags as they indicate critical issues
2. Explain technical concepts in clear, accessible language
3. Provide actionable recommendations
4. Reference specific data points from the analysis when available
5. Consider the broader DeFi context and regulatory implications

Format your responses clearly with specific findings and recommendations.`;

// ─── Chat with Analysis ───────────────────────────────────────────────────────

export async function chatWithAnalysis(
  analysisId: string,
  chatId: string,
  message: string,
): Promise<ChatMessage> {
  // Fetch analysis context. Strategy (updated for BFS/deep analyses):
  // - Fetch ALL non-account nodes (issuer, token, ammPool, signerList, etc —
  //   these are the "primary" structural entities and each has its own AI
  //   explanation). In a depth>=2 analysis there may be multiple of each
  //   kind (one per crawled hub); we want all of them in context.
  // - Fetch top 150 account nodes for additional fan-out context (bumped
  //   from 100 because merged graphs have more).
  // - Bumped edge cap from 200 → 400 for the same reason.
  const [analysis, keyNodes, accountNodes, edges, riskFlags] = await Promise.all([
    prisma.analysis.findUnique({ where: { id: analysisId } }),
    prisma.node.findMany({
      where: { analysisId, NOT: { kind: "account" } },
    }),
    prisma.node.findMany({
      where: { analysisId, kind: "account" },
      take: 150,
    }),
    prisma.edge.findMany({ where: { analysisId }, take: 400 }),
    prisma.riskFlag.findMany({ where: { analysisId } }),
  ]);
  const nodes = [...keyNodes, ...accountNodes];

  // Fetch chat history (last 10 messages)
  const previousMessages = await prisma.ragMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const history = previousMessages.reverse();

  // Build context string
  const contextParts: string[] = [];

  if (analysis) {
    // Pull BFS metadata out of summaryJson.crawlSummary so the LLM knows
    // whether it's looking at a single-seed crawl or a multi-hub deep
    // analysis, and can cite hubs by address when answering.
    const summary = (analysis.summaryJson ?? {}) as Record<string, any>;
    const cs = (summary.crawlSummary ?? {}) as Record<string, any>;
    const depth: number = cs.depth ?? 1;
    const hubCount: number = cs.hubCount ?? 1;
    const hubs: Array<{ address: string; depth: number; status: string }> = cs.hubs ?? [];
    const crawledHubs = hubs.filter((h) => h.status === "crawled");

    let hubLine = "";
    if (depth > 1 && crawledHubs.length > 0) {
      const preview = crawledHubs
        .slice(0, 10)
        .map((h) => `${h.address.slice(0, 10)}… (d${h.depth})`)
        .join(", ");
      hubLine = `- BFS Depth: ${depth} — ${hubCount} crawled hub${hubCount === 1 ? "" : "s"}\n` +
        `- Crawled Hubs (first 10): ${preview}\n`;
    }

    contextParts.push(
      `## Analysis Context\n` +
      `- Seed Address: ${analysis.seedAddress}\n` +
      `- Seed Label: ${analysis.seedLabel ?? "N/A"}\n` +
      `- Status: ${analysis.status}\n` +
      `- Created: ${analysis.createdAt.toISOString()}\n` +
      hubLine,
    );
  }

  if (nodes.length > 0) {
    const nodesByKind = new Map<string, number>();
    for (const n of nodes) {
      nodesByKind.set(n.kind, (nodesByKind.get(n.kind) ?? 0) + 1);
    }
    const kindSummary = Array.from(nodesByKind.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    contextParts.push(
      `## Graph Structure\n` +
      `- Total Nodes: ${nodes.length} (${kindSummary})\n` +
      `- Total Edges: ${edges.length}\n`,
    );

    // Include all non-account node details with AI explanations.
    // Strip the BFS `_meta` wrapper we stash inside node.data so the LLM
    // context isn't cluttered with internal fields; surface `isHub` as a
    // human-readable hint instead.
    const keyNodes = nodes.filter((n) => n.kind !== "account");
    for (const node of keyNodes) {
      const rawData = (node.data ?? {}) as Record<string, any>;
      const meta = rawData._meta as { isHub?: boolean; importance?: string } | undefined;
      const cleanData: Record<string, unknown> = { ...rawData };
      delete cleanData._meta;
      const hubTag = meta?.isHub ? " (crawled hub)" : "";
      let section = `## ${node.kind.charAt(0).toUpperCase() + node.kind.slice(1)} Node: ${node.label}${hubTag}\n`;
      section += `- Data: ${JSON.stringify(cleanData, null, 2)}\n`;
      if (node.aiExplanation) {
        section += `- AI Analysis: ${node.aiExplanation}\n`;
      }
      contextParts.push(section);
    }
  }

  if (riskFlags.length > 0) {
    const flagLines = riskFlags.map(
      (f) => `- [${f.severity}] ${f.flag}: ${f.detail}`,
    );
    contextParts.push(`## Risk Flags\n${flagLines.join("\n")}\n`);
  } else {
    contextParts.push("## Risk Flags\nNo risk flags detected.\n");
  }

  const contextString = contextParts.join("\n");

  // Build messages array for OpenAI
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `Here is the current analysis data you should use to answer questions:\n\n${contextString}`,
    },
    // Include chat history
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    // Current user message
    { role: "user", content: message },
  ];

  const responseContent = await chatCompletion(messages);

  return {
    role: "assistant",
    content: responseContent,
  };
}

// ─── Index Analysis for RAG ───────────────────────────────────────────────────

export async function indexAnalysisForRag(analysisId: string): Promise<void> {
  if (!getOpenAIClient()) {
    logger.info("[rag] No API key — skipping RAG indexing", { analysisId });
    return;
  }

  logger.info("[rag] Starting RAG indexing", { analysisId });

  const [nodes, riskFlags] = await Promise.all([
    prisma.node.findMany({ where: { analysisId } }),
    prisma.riskFlag.findMany({ where: { analysisId } }),
  ]);

  const documents: Array<{ content: string; metadata: Record<string, unknown> }> = [];

  // Documents from nodes (include AI explanations when available)
  for (const node of nodes) {
    let content = `Node [${node.kind}] ${node.label}: ${JSON.stringify(node.data)}`;
    if (node.aiExplanation) {
      content += `\n\nAI Analysis: ${node.aiExplanation}`;
    }
    documents.push({
      content,
      metadata: {
        nodeId: node.nodeId,
        kind: node.kind,
        label: node.label,
        hasExplanation: !!node.aiExplanation,
      },
    });
  }

  // Documents from risk flags
  for (const flag of riskFlags) {
    const content = `Risk Flag [${flag.severity}] ${flag.flag}: ${flag.detail}. Data: ${JSON.stringify(flag.data)}`;
    documents.push({
      content,
      metadata: { flagId: flag.id, flag: flag.flag, severity: flag.severity },
    });
  }

  if (documents.length === 0) {
    logger.info("[rag] No documents to index", { analysisId });
    return;
  }

  // Create embeddings in batches
  const batchSize = 20;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const texts = batch.map((d) => d.content);

    try {
      const embeddings = await createEmbeddings(texts);

      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const embedding = embeddings[j];

        if (!embedding || embedding.length === 0) continue;

        // Store with vector casting via raw SQL
        const embeddingStr = `[${embedding.join(",")}]`;
        await prisma.$executeRaw`
          INSERT INTO "RagDocument" (id, "analysisId", content, metadata, embedding, "createdAt")
          VALUES (
            gen_random_uuid(),
            ${analysisId},
            ${doc.content},
            ${JSON.stringify(doc.metadata)}::jsonb,
            ${embeddingStr}::vector,
            NOW()
          )
        `;
      }

      logger.debug("[rag] Indexed batch", { analysisId, batch: i / batchSize + 1 });
    } catch (err: any) {
      logger.error("[rag] Failed to index batch", { analysisId, error: err?.message });
    }
  }

  logger.info("[rag] RAG indexing complete", { analysisId, docCount: documents.length });
}
