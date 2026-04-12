import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

// ─── Docs Page ──────────────────────────────────────────────────────────
// Three tabs: MCP Server, REST API, Roadmap.
// Each tab is a full page — no scroll-to, real route via ?tab= query param.

type DocsTab = "mcp" | "api" | "roadmap";

const TABS: { key: DocsTab; label: string; icon: string }[] = [
  { key: "mcp", label: "MCP Server", icon: "⬡" },
  { key: "api", label: "REST API", icon: "◈" },
  { key: "roadmap", label: "Roadmap", icon: "→" },
];

// ── Endpoint type + data ────────────────────────────────────────────────

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
  params?: Array<{
    name: string;
    type: string;
    where: "query" | "path" | "body";
    desc: string;
  }>;
  response: string;
  curl: string;
  note?: string;
}

const CORRIDOR_ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/corridors",
    summary:
      "List every corridor in the atlas with cached status, actors, and route results.",
    response: `{
  corridors: CorridorListItem[]  // 2,436 entries
}`,
    curl: `curl http://localhost:3001/api/corridors`,
  },
  {
    method: "GET",
    path: "/api/corridors/:id",
    summary:
      "Fetch one corridor by slug with full analysis, route comparison, and actor registry.",
    params: [
      {
        name: "id",
        type: "string",
        where: "path",
        desc: "Corridor slug, e.g. 'usd-mxn' or 'jpy-php'.",
      },
    ],
    response: `{
  corridor: CorridorDetailResponse
  // includes: status, aiNote, routeResults[],
  // sourceActors[], destActors[], highlights, ...
}`,
    curl: `curl http://localhost:3001/api/corridors/usd-mxn`,
  },
  {
    method: "GET",
    path: "/api/corridors/:id/history",
    summary:
      "30-day status timeline for a corridor (GREEN/AMBER/RED events with timestamps).",
    params: [
      {
        name: "id",
        type: "string",
        where: "path",
        desc: "Corridor slug.",
      },
      {
        name: "days",
        type: "number",
        where: "query",
        desc: "Window size in days (default 30, max 90).",
      },
    ],
    response: `{
  corridorId: string,
  windowDays: number,
  events: Array<{
    status: "GREEN" | "AMBER" | "RED" | "UNKNOWN",
    pathCount: number,
    source: "scan" | "seed" | "manual",
    at: string  // ISO timestamp
  }>
}`,
    curl: `curl http://localhost:3001/api/corridors/usd-eur/history?days=7`,
  },
  {
    method: "GET",
    path: "/api/corridors/:id/partner-depth",
    summary:
      "Live measured orderbook depth from a partner venue (Bitso) or the XRPL DEX (GateHub pairs).",
    params: [
      {
        name: "id",
        type: "string",
        where: "path",
        desc: "Corridor slug. Supported: usd-mxn (Bitso), eur-xrp/usd-xrp/usd-eur/gbp-xrp etc. (XRPL DEX).",
      },
      {
        name: "actor",
        type: "string",
        where: "query",
        desc: "Partner key: 'bitso' or 'xrpl-dex' (default 'bitso').",
      },
    ],
    response: `{
  snapshot: {
    actor, book, venue,
    bidCount, askCount,
    topBid: { price, amount },
    topAsk: { price, amount },
    spreadBps: number,
    bidDepthBase, askDepthBase,
    fetchedAt, ttlSeconds
  }
}`,
    curl: `curl http://localhost:3001/api/corridors/eur-xrp/partner-depth?actor=xrpl-dex`,
  },
  {
    method: "POST",
    path: "/api/corridors/refresh/:id",
    summary:
      "Force a single corridor to re-scan (on-chain) or re-classify (off-chain-bridge).",
    params: [
      {
        name: "id",
        type: "string",
        where: "path",
        desc: "Corridor slug.",
      },
    ],
    response: `{
  refresh: RefreshResult,
  corridor: CorridorDetailResponse
}`,
    curl: `curl -X POST http://localhost:3001/api/corridors/refresh/usd-eur`,
  },
  {
    method: "POST",
    path: "/api/corridors/chat",
    summary:
      "RAG chat across the corridor atlas. Ask questions in natural language.",
    params: [
      {
        name: "message",
        type: "string",
        where: "body",
        desc: "User question.",
      },
      {
        name: "corridorId",
        type: "string?",
        where: "body",
        desc: "Optional: scope the chat to one corridor.",
      },
      {
        name: "chatId",
        type: "string?",
        where: "body",
        desc: "Optional: continue an existing chat session.",
      },
    ],
    response: `{
  chatId: string,
  message: { role: "assistant", content: string },
  sources: CorridorChatSource[]
}`,
    curl: `curl -X POST http://localhost:3001/api/corridors/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Which GCC corridors have RLUSD on both sides?"}'`,
  },
];

const SAFE_PATH_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/safe-path",
    summary:
      "Run the Safe Path AI Agent end-to-end. Returns a Server-Sent Events stream with the agent's reasoning, tool calls, and final compliance report.",
    params: [
      {
        name: "srcCcy",
        type: "string",
        where: "body",
        desc: 'Source currency code, e.g. "USD".',
      },
      {
        name: "dstCcy",
        type: "string",
        where: "body",
        desc: 'Destination currency code, e.g. "MXN".',
      },
      {
        name: "amount",
        type: "string",
        where: "body",
        desc: 'Amount in source currency, e.g. "1000".',
      },
      {
        name: "maxRiskTolerance",
        type: '"LOW" | "MED" | "HIGH"',
        where: "body",
        desc: "Maximum acceptable risk severity. LOW = strict, HIGH = permissive.",
      },
    ],
    response: `// SSE stream — each frame is data: <json>\\n\\n
// Event types in order:
{ type: "step", step: "connected" }
{ type: "corridor_context", corridor: CorridorPairDef }
{ type: "tool_call", name: "...", args: {...} }
{ type: "tool_result", name: "...", summary: "..." }
{ type: "corridor_update", analysis: CorridorAnalysis }
{ type: "path_active", pathIndex: 0 }
{ type: "account_crawled", address, name, flags[], score }
{ type: "path_rejected", pathIndex, reason, flags[] }
{ type: "partner_depth", snapshot: {...} }
{ type: "reasoning", text: "..." }
{ type: "result", result: SafePathResult }
// Final frame:
data: [DONE]`,
    curl: `curl -N -X POST http://localhost:3001/api/safe-path \\
  -H "Content-Type: application/json" \\
  -d '{
    "srcCcy": "USD",
    "dstCcy": "MXN",
    "amount": "1000",
    "maxRiskTolerance": "MED"
  }'`,
    note: `The -N flag disables cURL buffering so you see events as they stream.
The agent typically runs for 15-60 seconds depending on corridor type.
The final "result" event contains the full SafePathResult with:
  - verdict: "SAFE" | "REJECTED" | "NO_PATHS"
  - reasoning: AI-written compliance justification
  - winningPath: { index, hops[], riskScore }
  - rejected: [{ pathIndex, reason, flags[] }]
  - splitPlan (for large amounts): [{ path, pct, rationale }]
  - corridorAnalysis: full corridor data used by the agent
  - complianceReport: downloadable markdown report`,
  },
];

const ENTITY_AUDIT_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/analysis",
    summary:
      "Start an entity audit. Queues a live XRPL crawl for the given address and returns a job ID. Poll the status endpoint until status is 'done', then fetch the graph.",
    params: [
      {
        name: "seedAddress",
        type: "string",
        where: "body",
        desc: 'XRPL address to audit, e.g. "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De".',
      },
      {
        name: "seedLabel",
        type: "string?",
        where: "body",
        desc: 'Optional label, e.g. "RLUSD Issuer".',
      },
      {
        name: "depth",
        type: "1 | 2 | 3",
        where: "body",
        desc: "Crawl depth. 1 = seed only (~seconds), 2 = seed + 8 hubs (~1-2 min), 3 = two hops.",
      },
    ],
    response: `{
  id: string,       // analysis job ID
  status: "queued"   // or "done" if cached
}`,
    curl: `curl -X POST http://localhost:3001/api/analysis \\
  -H "Content-Type: application/json" \\
  -d '{
    "seedAddress": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
    "seedLabel": "Bitstamp",
    "depth": 1
  }'`,
  },
  {
    method: "GET",
    path: "/api/analysis/:id/status",
    summary:
      'Poll analysis status. Returns "queued", "running", "done", or "error".',
    params: [
      {
        name: "id",
        type: "string",
        where: "path",
        desc: "Analysis job ID returned from POST /api/analysis.",
      },
    ],
    response: `{
  id: string,
  status: "queued" | "running" | "done" | "error",
  seedAddress: string,
  seedLabel: string | null,
  error: string | null,
  summaryJson: object | null,
  createdAt: string,
  updatedAt: string
}`,
    curl: `curl http://localhost:3001/api/analysis/{id}/status`,
  },
  {
    method: "GET",
    path: "/api/graph/:analysisId",
    summary:
      'Fetch the full knowledge graph for a completed analysis. Only available when status is "done".',
    params: [
      {
        name: "analysisId",
        type: "string",
        where: "path",
        desc: "Analysis ID.",
      },
    ],
    response: `{
  nodes: GraphNode[],   // 18 node types
  edges: GraphEdge[],   // 19 edge types
  stats: {
    totalNodes, totalEdges,
    highRiskCount, medRiskCount, lowRiskCount
  }
}`,
    curl: `curl http://localhost:3001/api/graph/{analysisId}`,
  },
];

// ── Reusable endpoint renderer ──────────────────────────────────────────

function EndpointCard({ e }: { e: Endpoint }) {
  return (
    <Card data-testid={`endpoint-${e.path}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
              e.method === "GET"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                : "bg-sky-500/15 text-sky-300 border border-sky-500/40"
            }`}
          >
            {e.method}
          </span>
          <code className="text-white">{e.path}</code>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-slate-300 space-y-3">
        <p>{e.summary}</p>
        {e.params && e.params.length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Parameters
            </div>
            <ul className="space-y-1 text-[11px]">
              {e.params.map((p) => (
                <li key={p.name} className="font-mono">
                  <span className="text-amber-300">{p.name}</span>
                  <span className="text-slate-500"> ({p.type})</span>
                  <span className="text-slate-600 text-[9px] ml-1 uppercase">
                    [{p.where}]
                  </span>
                  <span className="text-slate-400 ml-2">-- {p.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
            Response shape
          </div>
          <pre className="text-[11px] font-mono text-slate-300 bg-slate-950/60 border border-slate-800 rounded p-3 overflow-x-auto whitespace-pre-wrap">
            {e.response}
          </pre>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
            cURL example
          </div>
          <pre className="text-[11px] font-mono text-emerald-300 bg-slate-950/60 border border-slate-800 rounded p-3 overflow-x-auto whitespace-pre-wrap">
            {e.curl}
          </pre>
        </div>
        {e.note && (
          <div className="bg-slate-900/60 border border-slate-700 rounded p-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Notes
            </div>
            <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap">
              {e.note}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Roadmap card ────────────────────────────────────────────────────────

function RoadmapCard({
  status,
  statusColor,
  title,
  children,
}: {
  status: string;
  statusColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${statusColor}`}
          >
            {status}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-slate-400">{children}</CardContent>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab content components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function McpDocsContent({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <>
      <section className="mb-12">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-violet-400">
          Claude Integration
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">
          MCP Server for Claude
        </h1>
        <p className="text-sm text-slate-400 mb-6 max-w-3xl">
          Connect Claude to XRPLens via the{" "}
          <strong className="text-slate-200">Model Context Protocol</strong>.
          Claude can browse corridors, run entity audits, query RAG chats, and
          check live DEX depth -- all through natural conversation. Requires an
          API key from your XRPLens account.
        </p>

        {/* What is MCP */}
        <Card className="mb-4 border-violet-500/20">
          <CardHeader>
            <CardTitle className="text-sm">What is MCP?</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>
              <strong className="text-slate-200">MCP (Model Context Protocol)</strong>{" "}
              is an open standard that lets AI assistants like Claude connect to
              external tools and data sources. Think of it as a plugin system for
              Claude -- instead of copy-pasting data into chat, Claude can directly
              query XRPLens in real time.
            </p>
            <p>
              The XRPLens MCP server runs locally on your computer as a small
              background process. When Claude needs XRPL data, it calls a tool --
              the MCP server translates that into an API request to XRPLens and
              returns the result.
            </p>
          </CardContent>
        </Card>

        {/* Step 1: Prerequisites */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold">
                1
              </span>
              Prerequisites
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-3">
            <p>You need two things before starting:</p>
            <ul className="space-y-2 ml-1">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">a.</span>
                <span>
                  <strong className="text-slate-200">Node.js</strong> installed on
                  your computer (v18 or later).{" "}
                  <span className="text-slate-500">
                    Check with: <code className="text-slate-400">node --version</code>
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">b.</span>
                <span>
                  <strong className="text-slate-200">Claude Code</strong> or{" "}
                  <strong className="text-slate-200">Claude Desktop</strong> installed.
                  Claude Code is available at{" "}
                  <code className="text-xrp-400 text-[11px]">claude.ai/code</code>.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step 2: API key */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold">
                2
              </span>
              Get your XRPLens API key
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <ol className="space-y-1.5 ml-1 list-decimal list-inside">
              <li>
                Click <strong className="text-slate-200">Connect Wallet</strong> in the top-right
                corner of this site (you need a Crossmark browser extension)
              </li>
              <li>
                Go to{" "}
                <button
                  onClick={() => navigate("/premium")}
                  className="text-xrp-400 hover:underline"
                >
                  Premium
                </button>{" "}
                and pay with XRP or RLUSD to unlock premium features
              </li>
              <li>
                Go to your{" "}
                <button
                  onClick={() => navigate("/account")}
                  className="text-xrp-400 hover:underline"
                >
                  Account page
                </button>{" "}
                and click <strong className="text-slate-200">Generate API Key</strong>.
                Your key looks like <code className="text-slate-400 text-[11px]">xlens_a1b2c3...</code>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Step 3: Config */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold">
                3
              </span>
              Add the MCP server to Claude
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-4">
            {/* Claude Code */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">
                Option A: Claude Code (CLI)
              </div>
              <p className="mb-2">
                Open your terminal and run:
              </p>
              <pre className="text-[11px] font-mono text-emerald-300 bg-slate-950/60 border border-slate-800 rounded p-3 overflow-x-auto whitespace-pre-wrap">
{`claude mcp add xrplens -- npx @xrplens/mcp-server`}
              </pre>
              <p className="mt-2">
                Then set the environment variables. Edit{" "}
                <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">
                  ~/.claude/settings.json
                </code>{" "}
                and add:
              </p>
              <pre className="text-[11px] font-mono text-emerald-300 bg-slate-950/60 border border-slate-800 rounded p-3 mt-2 overflow-x-auto whitespace-pre-wrap">
{`{
  "mcpServers": {
    "xrplens": {
      "command": "npx",
      "args": ["@xrplens/mcp-server"],
      "env": {
        "XRPLENS_API_KEY": "xlens_paste-your-api-key-here",
        "XRPLENS_API_URL": "https://api.xrplens.dev"
      }
    }
  }
}`}
              </pre>
            </div>

            {/* Claude Desktop */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">
                Option B: Claude Desktop App
              </div>
              <p className="mb-2">
                Open Claude Desktop &rarr; Settings &rarr; Developer &rarr; Edit Config.
                Paste the same JSON block above into your{" "}
                <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">
                  claude_desktop_config.json
                </code>
                . Restart Claude Desktop.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/50 rounded p-3">
              <div className="text-[9px] font-bold uppercase tracking-widest text-amber-400 mb-1">
                Local development
              </div>
              <p className="text-[11px] text-slate-400">
                If you're running XRPLens locally, set{" "}
                <code className="text-slate-300">XRPLENS_API_URL</code> to{" "}
                <code className="text-slate-300">http://localhost:3001/api</code>{" "}
                instead.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Verify */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold">
                4
              </span>
              Verify it works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-3">
            <p>
              Open Claude Code or Claude Desktop and try:
            </p>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-300 italic">
              &ldquo;List all GREEN corridors in LATAM&rdquo;
            </div>
            <p>
              If Claude responds with corridor data (not &ldquo;I don't have access to...&rdquo;),
              you're all set. Claude now has access to{" "}
              <strong className="text-slate-200">7 tools</strong>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  name: "list_corridors",
                  desc: "Browse & filter 2,436 corridors",
                },
                {
                  name: "get_corridor",
                  desc: "Full detail for one corridor",
                },
                {
                  name: "run_safe_path",
                  desc: "Run the Safe Path AI Agent for a payment",
                },
                {
                  name: "ask_corridor",
                  desc: "RAG Q&A on corridor data",
                },
                {
                  name: "analyze_address",
                  desc: "Launch Entity Audit on any XRPL address",
                },
                {
                  name: "ask_analysis",
                  desc: "RAG Q&A on audit results",
                },
                {
                  name: "get_partner_depth",
                  desc: "Live DEX/exchange orderbook depth",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex items-start gap-2 bg-slate-900/50 border border-slate-800 rounded-lg p-2.5"
                >
                  <code className="text-[10px] font-mono text-violet-300 shrink-0 mt-0.5">
                    {t.name}
                  </code>
                  <span className="text-[11px] text-slate-500">{t.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Example prompts */}
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Example prompts for Claude
        </div>
        <div className="space-y-2 mb-8">
          {[
            "What's the safest USD to MXN corridor right now?",
            "Run a safe path analysis for 5000 USD to EUR with medium risk tolerance",
            "Audit the RLUSD issuer address and tell me about risk flags",
            "What's the live spread on EUR/XRP via GateHub?",
            "Show me all GREEN corridors in LATAM",
          ].map((q, i) => (
            <div
              key={i}
              className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-300 italic"
            >
              &ldquo;{q}&rdquo;
            </div>
          ))}
        </div>

        {/* Architecture note */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>
              The MCP server runs locally on your machine as a subprocess. It
              communicates with Claude via stdio (standard input/output) using the{" "}
              <strong className="text-slate-300">
                Model Context Protocol
              </strong>
              .
            </p>
            <p>
              When Claude needs XRPL data, it calls a tool — the MCP server
              translates that into an HTTP request to the XRPLens API, using your
              API key for authentication. The response is passed back to Claude as
              structured text.
            </p>
            <p>
              The same API endpoints that power the web app power the MCP server.
              No separate data layer, no stale cache — Claude sees what you see.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function ApiDocsContent({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <>
      {/* Overview */}
      <section className="mb-12">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/80">
          Public REST API
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">XRPLens API</h1>
        <p className="text-sm text-slate-400 mb-6 max-w-3xl">
          Everything the web app shows is served from a stable JSON API. Three
          product surfaces —{" "}
          <strong className="text-slate-200">Corridor Atlas</strong>,{" "}
          <strong className="text-slate-200">Safe Path Agent</strong>, and{" "}
          <strong className="text-slate-200">Entity Audit</strong> — each with
          their own endpoints. All public and rate-limited. Schemas mirror the{" "}
          <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">
            @xrplens/core
          </code>{" "}
          TypeScript types.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="text-left bg-slate-900/50 border border-slate-800 rounded-lg p-4 group">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
              6 endpoints
            </div>
            <div className="text-sm font-semibold text-white">
              Corridor Atlas API
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              List, detail, history, depth, refresh, chat
            </div>
          </div>
          <div className="text-left bg-slate-900/50 border border-slate-800 rounded-lg p-4 group">
            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-1">
              1 endpoint - SSE stream
            </div>
            <div className="text-sm font-semibold text-white">
              Safe Path Agent API
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Run the AI agent, get a compliance report
            </div>
          </div>
          <div className="text-left bg-slate-900/50 border border-slate-800 rounded-lg p-4 group">
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">
              3 endpoints
            </div>
            <div className="text-sm font-semibold text-white">
              Entity Audit API
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Start crawl, poll status, fetch graph
            </div>
          </div>
        </div>
      </section>

      {/* Corridor Atlas */}
      <section className="mb-12">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400">
          Corridor Atlas
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          Corridor Atlas API
        </h2>
        <p className="text-sm text-slate-400 mb-6 max-w-3xl">
          2,436 live fiat corridors across 48 currencies. Each corridor is
          identified by a slug (e.g.{" "}
          <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">
            usd-mxn
          </code>
          ). Corridors are classified by settlement type: native IOU orderbook,
          hybrid legacy, or off-chain RLUSD bridge. Status is refreshed hourly
          for on-chain lanes and derived from the actor registry for off-chain
          bridges.
        </p>
        <div className="space-y-4">
          {CORRIDOR_ENDPOINTS.map((e) => (
            <EndpointCard key={e.method + e.path} e={e} />
          ))}
        </div>
      </section>

      {/* Safe Path Agent */}
      <section className="mb-12">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-sky-400">
          Safe Path Agent
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          Safe Path Agent API
        </h2>
        <p className="text-sm text-slate-400 mb-4 max-w-3xl">
          Call the AI agent programmatically. Send two currencies and an amount
          -- receive a Server-Sent Events stream as the agent resolves the
          corridor, crawls XRPL, analyzes risk, and produces a compliance
          report.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] font-bold text-emerald-400 mb-1">
              Tool 1
            </div>
            <div className="text-xs font-semibold text-white">
              Entity Audit Crawler
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Crawls any XRPL account for risk flags -- clawback, freeze, AMM
              exposure, permissioned domains
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] font-bold text-emerald-400 mb-1">
              Tool 2
            </div>
            <div className="text-xs font-semibold text-white">
              Corridor Intelligence
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Queries the atlas for actor data, partner depth, corridor
              classification, and historical status
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="text-[10px] font-bold text-emerald-400 mb-1">
              Tool 3
            </div>
            <div className="text-xs font-semibold text-white">
              AI Chat + RAG
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Natural-language queries across the corridor atlas and account
              data for contextual reasoning
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {SAFE_PATH_ENDPOINTS.map((e) => (
            <EndpointCard key={e.method + e.path} e={e} />
          ))}
        </div>
      </section>

      {/* Entity Audit */}
      <section className="mb-12">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">
          Entity Audit
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          Entity Audit API
        </h2>
        <p className="text-sm text-slate-400 mb-4 max-w-3xl">
          The same crawler the Safe Path Agent calls internally -- exposed as
          standalone endpoints. Start a crawl, poll for completion, then fetch
          the full knowledge graph with 18 node types and 19 edge types. Preset
          addresses (RLUSD Issuer, Bitstamp, etc.) return cached results
          instantly.
        </p>
        <div className="space-y-4">
          {ENTITY_AUDIT_ENDPOINTS.map((e) => (
            <EndpointCard key={e.method + e.path} e={e} />
          ))}
        </div>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">TypeScript client</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400">
            The full typed client lives in{" "}
            <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">
              @xrplens/web/src/api/client.ts
            </code>
            . All response types are exported from{" "}
            <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">
              @xrplens/core
            </code>{" "}
            -- including <code>CorridorListItem</code>,{" "}
            <code>CorridorDetailResponse</code>, <code>CorridorActor</code>,{" "}
            <code>GraphNode</code>, <code>GraphEdge</code>.
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function RoadmapContent() {
  return (
    <section>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/80">
        Roadmap
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">
        What's next
      </h1>
      <p className="text-sm text-slate-400 mb-6 max-w-3xl">
        XRPLens evolves with the XRPL -- new amendments, new corridor types, deeper
        measurements. Here's what's live, what's coming, and what's on the horizon.
      </p>
      <div className="space-y-3">
        <RoadmapCard
          status="LIVE"
          statusColor="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
          title="GateHub DEX Depth (On-Ledger Orderbooks)"
        >
          <p>
            Live on-ledger orderbook depth from GateHub via XRPL{" "}
            <code className="text-xrp-400 text-[11px]">book_offers</code>.
            EUR/XRP, USD/XRP, EUR/USD, GBP/XRP, USD/GBP -- real bid/ask
            spreads, real depth, measured directly from the XRPL DEX. Extends
            the existing Bitso proof-of-concept to cover all major GateHub
            pairs.
          </p>
        </RoadmapCard>

        <RoadmapCard
          status="LIVE"
          statusColor="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
          title="MCP Server for Claude"
        >
          <p>
            Connect Claude to XRPLens via the Model Context Protocol. 7 tools
            let Claude browse corridors, run entity audits, query RAG chats, and
            check live DEX depth -- all through natural conversation. Runs
            locally, authenticates with your XRPLens API key.
          </p>
        </RoadmapCard>

        <RoadmapCard
          status="LIVE"
          statusColor="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
          title="XLS-80 Permissioned Domains"
        >
          <p>
            Went live on mainnet{" "}
            <strong className="text-slate-200">February 4, 2025</strong>.
            Permissioned Domains let issuers define KYC/credential gates on
            trust lines. XRPLens detects and flags these in the Entity Audit
            crawler -- the Safe Path Agent uses them to warn when a hop requires
            credentials the sender may not hold.
          </p>
        </RoadmapCard>

        <RoadmapCard
          status="LIVE"
          statusColor="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
          title="XLS-81 Permissioned DEX"
        >
          <p>
            Went live on mainnet{" "}
            <strong className="text-slate-200">February 18, 2025</strong>.
            Permissioned DEX restricts orderbook access to credentialed
            accounts. XRPLens flags offers behind permissioned books so the Safe
            Path Agent can route around them.
          </p>
        </RoadmapCard>

        <RoadmapCard
          status="VOTING"
          statusColor="bg-amber-500/15 text-amber-300 border border-amber-500/40"
          title="XLS-66 Lending Protocol"
        >
          <p>
            Currently in validator voting. Native lending on XRPL will introduce
            new node types (Vault, Loan) and risk flags (liquidation exposure,
            collateral ratio). XRPLens will add these to the knowledge graph the
            day the amendment activates.
          </p>
        </RoadmapCard>

        <RoadmapCard
          status="NEXT"
          statusColor="bg-sky-500/15 text-sky-300 border border-sky-500/40"
          title="Measured depth for every actor"
        >
          <p>
            Today we measure live orderbook depth from Bitso (USD/MXN) and
            GateHub (EUR, USD, GBP pairs on the XRPL DEX). The v2 vision: every
            actor row in the corridor atlas gets its own measured feed --
            Binance, Coinbase, Kraken, SBI Remit -- replacing categorical
            GREEN/AMBER/RED with basis-point-level precision. Measured, not
            assumed.
          </p>
        </RoadmapCard>

        <RoadmapCard
          status="NEXT"
          statusColor="bg-sky-500/15 text-sky-300 border border-sky-500/40"
          title="Better Pathfinding"
        >
          <p>
            Multi-source path_find (fan out across all issuer combos per
            corridor), ripple_path_find as fallback when streaming path_find
            fails, and path capacity aggregation for large amounts. Currently
            in design.
          </p>
        </RoadmapCard>

        <RoadmapCard
          status="NEXT"
          statusColor="bg-sky-500/15 text-sky-300 border border-sky-500/40"
          title="Corridor Volume History"
        >
          <p>
            Historical throughput data for corridors. Leveraging xrpl.to API
            for DEX volume aggregation and on-ledger account_tx scanning for
            gateway transaction classification. Will add volume sparklines
            alongside the existing availability sparklines on corridor detail
            pages.
          </p>
        </RoadmapCard>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ApiDocs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as DocsTab) || "mcp";
  const setTab = (t: DocsTab) => setSearchParams({ tab: t });

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-10 pb-28 flex gap-8">
        {/* Left sidebar */}
        <nav className="hidden lg:block w-52 shrink-0 sticky top-20 self-start">
          <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-3">
            Documentation
          </div>
          <ul className="space-y-0.5">
            {TABS.map((t) => (
              <li key={t.key}>
                <button
                  onClick={() => setTab(t.key)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 flex items-center gap-2 ${
                    activeTab === t.key
                      ? "bg-xrp-500/15 text-xrp-300 border border-xrp-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <span className="text-[10px] opacity-60">{t.icon}</span>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-2">
              Quick links
            </div>
            <ul className="space-y-1 text-[11px]">
              <li>
                <button
                  onClick={() => navigate("/corridors")}
                  className="text-slate-400 hover:text-xrp-400 transition"
                >
                  &larr; Corridor Atlas
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/safe-path")}
                  className="text-slate-400 hover:text-xrp-400 transition"
                >
                  &larr; Safe Path Agent
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/analyze")}
                  className="text-slate-400 hover:text-xrp-400 transition"
                >
                  &larr; Entity Audit
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {activeTab === "mcp" && <McpDocsContent navigate={navigate} />}
          {activeTab === "api" && <ApiDocsContent navigate={navigate} />}
          {activeTab === "roadmap" && <RoadmapContent />}
        </div>
      </div>
    </div>
  );
}
