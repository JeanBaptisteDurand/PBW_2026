#!/usr/bin/env node
// CorLens v2 MCP Server — exposes the v2 gateway as MCP tools over stdio.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

function loadEnv() {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
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
    // No .env file is fine
  }
}
loadEnv();

const API_BASE = process.env.CORLENS_API_URL ?? "http://localhost:8080/api";
const API_KEY = process.env.CORLENS_API_KEY ?? "";

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) {
    if (API_KEY.startsWith("xlens_")) headers["x-api-key"] = API_KEY;
    else headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CorLens API ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new McpServer({ name: "corlens", version: "0.1.0" });

server.tool(
  "list_corridors",
  "List XRPL fiat corridors with status, actors, and classification.",
  {
    region: z.string().optional().describe("Filter: GCC, LATAM, APAC, Europe, Americas, MEA, Africa"),
    status: z.string().optional().describe("Filter: GREEN, AMBER, RED, UNKNOWN"),
    currency: z.string().optional().describe("Filter by currency code, e.g. USD, EUR, MXN"),
    limit: z.number().min(1).max(500).optional().describe("Max corridors (default 100)"),
  },
  async ({ region, status, currency, limit }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status.toUpperCase());
    if (currency) params.set("currency", currency.toUpperCase());
    params.set("limit", String(limit ?? 100));
    let corridors: any[] = await apiFetch(`/corridors?${params.toString()}`);
    if (region) {
      corridors = corridors.filter(
        (c: any) => c.region?.toLowerCase() === region.toLowerCase(),
      );
    }
    const summary = corridors
      .slice(0, 50)
      .map(
        (c: any) =>
          `${c.id} [${c.status}] ${c.label} (${c.category}) -- ${c.recCost ?? "no recCost"}`,
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

server.tool(
  "get_corridor",
  "Get full details for one corridor by slug.",
  { id: z.string().describe("Corridor slug, e.g. 'usd-mxn'") },
  async ({ id }) => {
    const data = await apiFetch(`/corridors/${encodeURIComponent(id)}`);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.tool(
  "ask_corridor",
  "Ask a natural-language question about a corridor or the entire atlas.",
  {
    question: z.string().describe("Your question about XRPL corridors"),
    corridorId: z.string().optional().describe("Optional: scope to one corridor"),
  },
  async ({ question, corridorId }) => {
    const data = await apiFetch("/corridors/chat", {
      method: "POST",
      body: JSON.stringify({ message: question, corridorId }),
    });
    return {
      content: [{ type: "text" as const, text: data.answer ?? "No response" }],
    };
  },
);

server.tool(
  "analyze_address",
  "Launch an entity audit on any XRPL address. Crawls the account and builds a risk graph.",
  {
    address: z.string().describe("XRPL r-address"),
    label: z.string().optional().describe("Human label"),
    depth: z.number().min(1).max(3).optional().describe("Crawl depth 1-3 (default 1)"),
  },
  async ({ address, label, depth }) => {
    const start = await apiFetch("/analyze", {
      method: "POST",
      body: JSON.stringify({ seedAddress: address, seedLabel: label, depth: depth ?? 1 }),
    });
    const analysisId = start.id;
    let status = start.status;
    const deadline = Date.now() + 120_000;
    while ((status === "queued" || status === "running") && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await apiFetch(`/analysis/${analysisId}`);
      status = poll.status;
    }
    if (status !== "done") {
      return {
        content: [{ type: "text" as const, text: `Analysis ${analysisId} is ${status}.` }],
      };
    }
    const graph = await apiFetch(`/analysis/${analysisId}/graph`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Analysis complete. ${graph.nodes?.length ?? 0} nodes, ${graph.edges?.length ?? 0} edges.\nStats: ${JSON.stringify(graph.stats)}\n\nAnalysis ID: ${analysisId}`,
        },
      ],
    };
  },
);

server.tool(
  "ask_analysis",
  "Ask a question about a completed entity audit. Uses RAG over the graph data.",
  {
    analysisId: z.string().describe("Analysis ID from analyze_address"),
    question: z.string().describe("Your question about this analysis"),
  },
  async ({ analysisId, question }) => {
    const data = await apiFetch(`/analysis/${encodeURIComponent(analysisId)}/chat`, {
      method: "POST",
      body: JSON.stringify({ message: question }),
    });
    return {
      content: [{ type: "text" as const, text: data.answer ?? "No response" }],
    };
  },
);

server.tool(
  "run_safe_path",
  "Run the Safe Path agent for a cross-border payment. Streams SSE events; this tool collects them and returns the final verdict.",
  {
    srcCcy: z.string().describe('Source currency, e.g. "USD"'),
    dstCcy: z.string().describe('Destination currency, e.g. "MXN"'),
    amount: z.string().describe('Amount, e.g. "1000"'),
    maxRiskTolerance: z.enum(["LOW", "MED", "HIGH"]).optional(),
  },
  async ({ srcCcy, dstCcy, amount, maxRiskTolerance }) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
    const res = await fetch(`${API_BASE}/safe-path`, {
      method: "POST",
      headers,
      body: JSON.stringify({ srcCcy, dstCcy, amount, maxRiskTolerance: maxRiskTolerance ?? "MED" }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Safe Path API ${res.status}: ${text}`);
    }
    const body = await res.text();
    const lines = body.split("\n");
    const steps: string[] = [];
    let finalResult: any = null;
    let runId: string | null = null;
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      try {
        const evt = JSON.parse(payload);
        if (evt.kind === "phase-start") steps.push(`[start] ${evt.phase}`);
        else if (evt.kind === "phase-complete") steps.push(`[done] ${evt.phase} (${evt.durationMs}ms)`);
        else if (evt.kind === "reasoning") steps.push(`Reasoning: ${(evt.text ?? "").slice(0, 200)}`);
        else if (evt.kind === "corridor-context") steps.push(`Corridor: ${evt.label ?? "(none)"} status=${evt.status ?? "n/a"}`);
        else if (evt.kind === "path-active") steps.push(`Path active: ${evt.pathId} risk=${evt.riskScore}`);
        else if (evt.kind === "path-rejected") steps.push(`Path rejected: ${evt.pathId} -- ${evt.reason}`);
        else if (evt.kind === "result") finalResult = evt;
        else if (evt.kind === "result-persisted") runId = evt.runId;
        else if (evt.kind === "error") steps.push(`Error in ${evt.phase ?? "unknown"}: ${evt.message}`);
      } catch {
        // skip malformed lines
      }
    }
    if (!finalResult) {
      return {
        content: [{ type: "text" as const, text: `Safe Path completed but no result event was returned.\n\nLog:\n${steps.join("\n")}` }],
      };
    }
    const output = [
      `VERDICT: ${finalResult.verdict}`,
      `Risk score: ${finalResult.riskScore ?? "N/A"}`,
      `Corridor: ${srcCcy} -> ${dstCcy} (${amount} ${srcCcy})`,
      "",
      `Reasoning:\n${finalResult.reasoning ?? ""}`,
    ];
    if (runId) output.push("", `Run ID: ${runId}`, `Get markdown report: GET /api/compliance/${runId}`);
    output.push("", "--- Phase log ---", ...steps);
    return {
      content: [{ type: "text" as const, text: output.join("\n") }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
