import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { chatCompletion } from "./openai.js";

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert XRPL analyst explaining graph nodes to compliance officers and institutional investors evaluating XRP Ledger accounts and tokens.

Your explanations should:
- Be clear and accessible to non-technical compliance professionals
- Focus on what this entity means for risk assessment and due diligence
- Highlight compliance-relevant details (security posture, regulatory signals, red flags)
- Be concise (3-5 sentences max for the main explanation, then bullet points for key facts)
- Use the specific data provided — don't make up numbers

Format: Start with a plain-English explanation paragraph, then a "Key Facts" section with bullet points.`;

// ─── Node Explanation Prompts by Kind ────────────────────────────────────────

function buildPrompt(kind: string, label: string, data: any, riskFlags: any[]): string {
  const flagLines = riskFlags.length > 0
    ? `\nRisk Flags:\n${riskFlags.map((f: any) => `- [${f.severity}] ${f.flag}: ${f.detail}`).join("\n")}`
    : "\nNo risk flags on this node.";

  const dataStr = JSON.stringify(data, null, 2);

  switch (kind) {
    case "issuer":
      return `Explain this XRPL token issuer account for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: Who is this entity? What tokens do they issue? What's their security setup? Any compliance concerns?`;

    case "token":
      return `Explain this XRPL issued token for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What is this token? How widely held is it? Is it a legitimate token or potentially a scam? What should an investor know?`;

    case "ammPool":
      return `Explain this XRPL AMM (Automated Market Maker) liquidity pool for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What assets does this pool trade? How deep is the liquidity? Is the LP distribution healthy? What risks should institutional LPs be aware of?`;

    case "orderBook":
      return `Explain this XRPL DEX order book for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What trading pair is this? How liquid is the market? Is the spread reasonable? What does the depth tell us about market health?`;

    case "account":
      return `Explain this XRPL account (trust line holder) for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What role does this account play in the ecosystem? How significant is their position? Any notable flags?`;

    case "escrow":
      return `Explain this XRPL escrow for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What funds are locked? What are the release conditions? Who is the destination? Why does this matter for compliance?`;

    case "check":
      return `Explain this XRPL check (like a paper check, but on-chain) for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: Who issued this check? Who can cash it? What's the amount? Why are outstanding checks a compliance consideration?`;

    case "payChannel":
      return `Explain this XRPL payment channel for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: Who are the parties? How much is locked in the channel? What's the settle delay? Why do payment channels matter for fund flow analysis?`;

    case "nft":
      return `Explain this XRPL NFT for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: Who issued this NFT? What does the URI point to? Is there a transfer fee (royalty)? Any red flags?`;

    case "signerList":
      return `Explain this XRPL multi-signature setup (SignerList) for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: How many signers are there? What's the quorum? Is this institutional-grade security? What does this tell us about the account's governance?`;

    case "did":
      return `Explain this XRPL Decentralized Identifier (DID) for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What is a DID on XRPL? What identity information is linked? How does this support KYC/AML compliance?`;

    case "credential":
      return `Explain this XRPL Credential (on-chain attestation) for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: Who issued this credential? What type is it (KYC, AML, accreditation)? What does it attest? How does this support compliance workflows?`;

    case "mpToken":
      return `Explain this XRPL Multi-Purpose Token (MPT) for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What is an MPT vs a regular trust line token? What's the supply? Is there a transfer fee? What's the issuance model?`;

    case "oracle":
      return `Explain this XRPL price oracle for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: Who provides this oracle? What price data does it publish? How recent is the data? Why do oracles matter for DeFi risk?`;

    case "depositPreauth":
      return `Explain this XRPL deposit pre-authorization for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: Who is pre-authorized? What does this mean for the account's access controls? How does this relate to DepositAuth compliance?`;

    case "offer":
      return `Explain this XRPL DEX offer (open order) for a compliance officer.

Node: ${label}
Data: ${dataStr}
${flagLines}

Cover: What is being traded? How large is the order? Is there an expiration? What does this tell us about the account's trading activity?`;

    default:
      return `Explain this XRPL graph node for a compliance officer.

Node type: ${kind}
Label: ${label}
Data: ${dataStr}
${flagLines}

Cover: What is this entity? Why does it appear in the analysis? What compliance implications does it have?`;
  }
}

// ─── Generate All Node Explanations ─────────────────────────────────────────

export async function generateNodeExplanations(
  analysisId: string,
  updateProgress?: (step: string, detail?: string) => void,
): Promise<void> {
  logger.info("[explanations] Starting node explanation generation", { analysisId });
  updateProgress?.("generating_explanations", "Generating AI explanations for graph nodes");

  const dbNodes = await prisma.node.findMany({
    where: { analysisId },
    select: { id: true, nodeId: true, kind: true, label: true, data: true },
  });

  const dbRiskFlags = await prisma.riskFlag.findMany({
    where: { analysisId },
  });

  // Group flags by db node id
  const flagsByNodeId = new Map<string, any[]>();
  for (const flag of dbRiskFlags) {
    const existing = flagsByNodeId.get(flag.nodeId) ?? [];
    existing.push({ flag: flag.flag, severity: flag.severity, detail: flag.detail });
    flagsByNodeId.set(flag.nodeId, existing);
  }

  // Skip account nodes (too many, not very interesting individually) — only explain non-account nodes
  const nodesToExplain = dbNodes.filter((n) => n.kind !== "account");

  logger.info("[explanations] Nodes to explain", {
    total: dbNodes.length,
    explaining: nodesToExplain.length,
    skippedAccounts: dbNodes.length - nodesToExplain.length,
  });

  if (nodesToExplain.length === 0) {
    logger.info("[explanations] No nodes to explain");
    return;
  }

  // Process in batches of 5 for speed
  const BATCH_SIZE = 5;
  let generated = 0;
  let errors = 0;

  for (let i = 0; i < nodesToExplain.length; i += BATCH_SIZE) {
    const batch = nodesToExplain.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(nodesToExplain.length / BATCH_SIZE);

    updateProgress?.(
      "generating_explanations",
      `Generating AI explanations (batch ${batchNum}/${totalBatches})`,
    );

    const results = await Promise.allSettled(
      batch.map(async (node) => {
        const flags = flagsByNodeId.get(node.id) ?? [];
        // Strip the BFS `_meta` wrapper we stash inside node.data so prompt
        // content stays clean (the LLM doesn't need to see importance/isHub
        // as a structured field — they're not node semantics).
        const rawData = (node.data ?? {}) as Record<string, unknown>;
        const cleanData = { ...rawData };
        delete cleanData._meta;
        const prompt = buildPrompt(node.kind, node.label, cleanData, flags);

        const explanation = await chatCompletion(
          [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          { maxTokens: 500, temperature: 0.3 },
        );

        await prisma.node.update({
          where: { id: node.id },
          data: { aiExplanation: explanation },
        });

        return explanation;
      }),
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        generated++;
      } else {
        errors++;
        logger.warn("[explanations] Failed to generate explanation", {
          nodeId: batch[j].nodeId,
          error: (results[j] as PromiseRejectedResult).reason?.message,
        });
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < nodesToExplain.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  logger.info("[explanations] Node explanations complete", {
    analysisId,
    generated,
    errors,
    skippedAccounts: dbNodes.length - nodesToExplain.length,
  });
}
