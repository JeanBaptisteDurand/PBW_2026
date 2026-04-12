#!/usr/bin/env node
// ─── XRPLens MCP Server ────────────────────────────────────────────────
//
// Exposes the XRPLens REST API as MCP tools for Claude.
// Runs over stdio transport — add to claude_desktop_config.json or
// .claude/settings.json to use with Claude Code / Claude Desktop.
//
// Env vars:
//   XRPLENS_API_URL  — Base URL of the XRPLens API (default: https://api.xrplens.dev)
//   XRPLENS_API_KEY  — JWT token from your XRPLens account (required for premium features)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── .env loader ───────────────────────────────────────────────────────
// Reads a .env file next to this script (for the standalone zip package).
// Process.env values always take precedence over .env file values.
function loadEnv() {
  try {
    const dir = typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(dir, ".env");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // No .env file — that's fine, use process.env as-is
  }
}
loadEnv();

const API_BASE = process.env.XRPLENS_API_URL ?? "https://api.xrplens.dev";
const API_KEY = process.env.XRPLENS_API_KEY ?? "";

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Support both API key (xlens_...) and JWT Bearer token
  if (API_KEY) {
    if (API_KEY.startsWith("xlens_")) {
      headers["x-api-key"] = API_KEY;
    } else {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`XRPLens API ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "xrplens",
  version: "0.1.0",
});

// ─── Tool: list_corridors ───────────────────────────────────────────────

server.tool(
  "list_corridors",
  "List XRPL fiat corridors (2,436 total) with status, actors, and classification. Returns first 50 matches.",
  {
    region: z
      .string()
      .optional()
      .describe("Filter: GCC, LATAM, APAC, Europe, Americas, MEA, Africa"),
    status: z
      .string()
      .optional()
      .describe("Filter: GREEN, AMBER, RED, UNKNOWN"),
    currency: z
      .string()
      .optional()
      .describe("Filter by currency code, e.g. USD, EUR, MXN"),
  },
  async ({ region, status, currency }) => {
    const data = await apiFetch("/corridors");
    let corridors = data.corridors ?? [];
    if (region)
      corridors = corridors.filter(
        (c: any) => c.region?.toLowerCase() === region.toLowerCase(),
      );
    if (status)
      corridors = corridors.filter(
        (c: any) => c.status === status.toUpperCase(),
      );
    if (currency) {
      const ccy = currency.toUpperCase();
      corridors = corridors.filter(
        (c: any) =>
          c.source?.symbol === ccy || c.dest?.symbol === ccy,
      );
    }
    const summary = corridors
      .slice(0, 50)
      .map(
        (c: any) =>
          `${c.id} [${c.status}] ${c.source?.symbol}->${c.dest?.symbol} (${c.category}) -- ${c.aiNote?.slice(0, 100) ?? "no note"}`,
      );
    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${corridors.length} corridors (showing first 50):\n\n${summary.join("\n")}`,
        },
      ],
    };
  },
);

// ─── Tool: get_corridor ─────────────────────────────────────────────────

server.tool(
  "get_corridor",
  "Get full details for one corridor by slug (e.g. usd-mxn). Returns actors, routes, status, AI note.",
  { id: z.string().describe("Corridor slug, e.g. 'usd-mxn', 'eur-gbp'") },
  async ({ id }) => {
    const data = await apiFetch(
      `/corridors/${encodeURIComponent(id)}`,
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(data.corridor, null, 2),
        },
      ],
    };
  },
);

// ─── Tool: ask_corridor ─────────────────────────────────────────────────

server.tool(
  "ask_corridor",
  "Ask a natural-language question about a corridor or the entire atlas. Uses RAG grounded in real corridor data.",
  {
    question: z
      .string()
      .describe("Your question about XRPL corridors"),
    corridorId: z
      .string()
      .optional()
      .describe("Optional: scope to one corridor slug"),
  },
  async ({ question, corridorId }) => {
    const data = await apiFetch("/corridors/chat", {
      method: "POST",
      body: JSON.stringify({ message: question, corridorId }),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: data.message?.content ?? "No response",
        },
      ],
    };
  },
);

// ─── Tool: analyze_address ──────────────────────────────────────────────

server.tool(
  "analyze_address",
  "Launch an Entity Audit on any XRPL address. Crawls the account and builds a knowledge graph with risk flags. Depth 1 = seconds, depth 2 = 1-2 min.",
  {
    address: z.string().describe("XRPL r-address to audit"),
    label: z.string().optional().describe("Human label for the address"),
    depth: z
      .number()
      .min(1)
      .max(3)
      .optional()
      .describe("Crawl depth 1-3 (default 1)"),
  },
  async ({ address, label, depth }) => {
    const start = await apiFetch("/analyze", {
      method: "POST",
      body: JSON.stringify({
        seedAddress: address,
        seedLabel: label,
        depth: depth ?? 1,
      }),
    });

    const analysisId = start.id;
    let status = start.status;
    const deadline = Date.now() + 120_000;

    while (
      (status === "queued" || status === "running") &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await apiFetch(`/analyze/${analysisId}/status`);
      status = poll.status;
    }

    if (status !== "done") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Analysis ${analysisId} is ${status}. Check back later with ask_analysis.`,
          },
        ],
      };
    }

    const graph = await apiFetch(`/analysis/${analysisId}/graph`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Analysis complete. ${graph.nodes?.length ?? 0} nodes, ${graph.edges?.length ?? 0} edges.\nStats: ${JSON.stringify(graph.stats)}\n\nUse ask_analysis to query this graph.\nAnalysis ID: ${analysisId}`,
        },
      ],
    };
  },
);

// ─── Tool: ask_analysis ─────────────────────────────────────────────────

server.tool(
  "ask_analysis",
  "Ask a question about a completed Entity Audit. Uses RAG grounded in the knowledge graph data.",
  {
    analysisId: z
      .string()
      .describe("Analysis ID from analyze_address"),
    question: z.string().describe("Your question about this analysis"),
  },
  async ({ analysisId, question }) => {
    const data = await apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({ analysisId, message: question }),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: data.message?.content ?? data.content ?? "No response",
        },
      ],
    };
  },
);

// ─── Tool: run_safe_path ────────────────────────────────────────────────

server.tool(
  "run_safe_path",
  "Run the Safe Path AI Agent for a cross-border payment. The agent resolves the corridor, crawls XRPL accounts, analyzes risk, and produces a compliance verdict. Takes 15-60 seconds.",
  {
    srcCcy: z.string().describe('Source currency code, e.g. "USD"'),
    dstCcy: z.string().describe('Destination currency code, e.g. "MXN"'),
    amount: z.string().describe('Amount in source currency, e.g. "1000"'),
    maxRiskTolerance: z
      .enum(["LOW", "MED", "HIGH"])
      .optional()
      .describe("Risk tolerance: LOW = strict, MED = balanced, HIGH = permissive (default: MED)"),
  },
  async ({ srcCcy, dstCcy, amount, maxRiskTolerance }) => {
    // Safe Path returns SSE — we consume the stream and collect events
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

    const res = await fetch(`${API_BASE}/safe-path`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        srcCcy,
        dstCcy,
        amount,
        maxRiskTolerance: maxRiskTolerance ?? "MED",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Safe Path API ${res.status}: ${text}`);
    }

    // Read SSE stream, collect key events
    const body = await res.text();
    const lines = body.split("\n");
    const steps: string[] = [];
    let finalResult: any = null;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "step") {
          steps.push(`[${evt.step}] ${evt.detail ?? ""}`);
        } else if (evt.type === "tool_call") {
          steps.push(`Tool: ${evt.name}(${JSON.stringify(evt.args).slice(0, 80)})`);
        } else if (evt.type === "tool_result") {
          steps.push(`Result: ${evt.name} -- ${evt.summary?.slice(0, 120) ?? ""}`);
        } else if (evt.type === "reasoning") {
          steps.push(`Reasoning: ${(evt.text ?? evt.content ?? "").slice(0, 200)}`);
        } else if (evt.type === "account_crawled") {
          steps.push(`Crawled: ${evt.name ?? evt.address} (score: ${evt.score})`);
        } else if (evt.type === "result") {
          finalResult = evt.result;
        }
      } catch {
        // skip malformed lines
      }
    }

    if (!finalResult) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Safe Path agent completed but no final result was returned.\n\nAgent log:\n${steps.join("\n")}`,
          },
        ],
      };
    }

    const output = [
      `VERDICT: ${finalResult.verdict}`,
      `Reasoning: ${finalResult.reasoning ?? ""}`,
      "",
      `Risk Score: ${finalResult.winningPath?.riskScore ?? "N/A"}`,
      `Corridor: ${srcCcy} -> ${dstCcy} (${amount} ${srcCcy})`,
      "",
    ];

    if (finalResult.winningPath) {
      output.push(
        `Winning Path: ${finalResult.winningPath.hops?.map((h: any) => h.account ?? h.label ?? "hop").join(" -> ") ?? "direct"}`,
      );
    }

    if (finalResult.rejected?.length) {
      output.push(
        "",
        `Rejected paths: ${finalResult.rejected.length}`,
        ...finalResult.rejected.map(
          (r: any) => `  Path ${r.pathIndex}: ${r.reason} [${r.flags?.join(", ") ?? ""}]`,
        ),
      );
    }

    if (finalResult.splitPlan?.length) {
      output.push(
        "",
        "Split routing plan:",
        ...finalResult.splitPlan.map(
          (leg: any) => `  ${leg.pct}% via path ${leg.path}: ${leg.rationale}`,
        ),
      );
    }

    if (finalResult.analysisIds?.length) {
      output.push(
        "",
        `Deep analyses spawned: ${finalResult.analysisIds.join(", ")}`,
        "Use ask_analysis to query any of these.",
      );
    }

    output.push("", "--- Agent Log ---", ...steps.slice(-20));

    return {
      content: [
        {
          type: "text" as const,
          text: output.join("\n"),
        },
      ],
    };
  },
);

// ─── Tool: get_partner_depth ────────────────────────────────────────────

server.tool(
  "get_partner_depth",
  "Get live measured orderbook depth for a corridor from a partner venue (Bitso) or the XRPL DEX (GateHub pairs).",
  {
    corridorId: z
      .string()
      .describe("Corridor slug, e.g. 'usd-mxn', 'eur-xrp'"),
    actor: z
      .string()
      .optional()
      .describe("Partner key: 'bitso' or 'xrpl-dex' (default: bitso)"),
  },
  async ({ corridorId, actor }) => {
    const data = await apiFetch(
      `/corridors/${encodeURIComponent(corridorId)}/partner-depth?actor=${actor ?? "bitso"}`,
    );
    const s = data.snapshot;
    return {
      content: [
        {
          type: "text" as const,
          text: `${s.venue} ${s.book}\nBid: ${s.bidCount} offers, top ${s.topBid?.price ?? "--"}\nAsk: ${s.askCount} offers, top ${s.topAsk?.price ?? "--"}\nSpread: ${s.spreadBps?.toFixed(1) ?? "--"} bps\nDepth: ${s.bidDepthBase} / ${s.askDepthBase}`,
        },
      ],
    };
  },
);

// ─── Start ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
