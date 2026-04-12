# GateHub DEX Depth + MCP Server + Docs Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GateHub on-ledger orderbook depth to corridor pages, create an MCP server exposing the XRPLens API to Claude, and restructure the Developers page into a multi-page Docs section (MCP, API, Roadmap).

**Architecture:** The GateHub enrichment extends the existing `partnerDepth.ts` to call XRPL `book_offers` via the existing QuickNode client. The MCP server is a new lightweight package that HTTP-calls the existing Express API. The Docs page becomes a route with `?tab=` query params for MCP/API/Roadmap sections, each rendering as a full page (not scroll targets).

**Tech Stack:** XRPL SDK (already installed), `@modelcontextprotocol/sdk` (new dep), React Router query params, existing Tailwind/component library.

---

### Task 1: GateHub DEX Depth — Server-Side Fetcher

**Files:**
- Modify: `apps/server/src/corridors/partnerDepth.ts`
- Modify: `apps/server/src/corridors/catalog.ts` (reference only — addresses already there)

- [ ] **Step 1: Add `fetchXrplDexDepth` function to partnerDepth.ts**

Add a new fetcher that calls `book_offers` on both sides of a pair via the XRPL client, aggregates depth, and returns the same `PartnerDepthSnapshot` format. Add it after the existing `fetchBitsoDepth` function.

```typescript
// After line 103 in partnerDepth.ts, add:

import { createXRPLClient, type XRPLClientWrapper } from "../xrpl/client.js";

// Lazy-init shared XRPL client for DEX depth queries
let dexClient: XRPLClientWrapper | null = null;
async function getDexClient(): Promise<XRPLClientWrapper> {
  if (!dexClient) {
    dexClient = createXRPLClient();
    await dexClient.connect();
  }
  return dexClient;
}

interface DexPair {
  base: { currency: string; issuer?: string };
  quote: { currency: string; issuer?: string };
  venue: string; // display name e.g. "GateHub DEX"
}

async function fetchXrplDexDepth(pair: DexPair): Promise<PartnerDepthSnapshot> {
  const client = await getDexClient();

  // Ask side: people selling base for quote
  const asksRes = (await client.request("book_offers", {
    taker_gets: pair.base,
    taker_pays: pair.quote,
    limit: 50,
    ledger_index: "validated",
  })) as any;
  const asks = asksRes?.result?.offers ?? [];

  // Bid side: people selling quote for base
  const bidsRes = (await client.request("book_offers", {
    taker_gets: pair.quote,
    taker_pays: pair.base,
    limit: 50,
    ledger_index: "validated",
  })) as any;
  const bids = bidsRes?.result?.offers ?? [];

  // Extract amounts — TakerGets is what the maker is offering
  function offerAmount(offer: any): number {
    const gets = offer.taker_gets_funded ?? offer.TakerGets;
    if (typeof gets === "string") return Number(gets) / 1_000_000; // XRP in drops
    return Number(gets?.value ?? 0);
  }
  function offerPrice(offer: any): number {
    const gets = offer.TakerGets;
    const pays = offer.TakerPays;
    const getsVal = typeof gets === "string" ? Number(gets) / 1_000_000 : Number(gets?.value ?? 0);
    const paysVal = typeof pays === "string" ? Number(pays) / 1_000_000 : Number(pays?.value ?? 0);
    return getsVal > 0 ? paysVal / getsVal : 0;
  }

  const bidDepth = bids.reduce((s: number, o: any) => s + offerAmount(o), 0);
  const askDepth = asks.reduce((s: number, o: any) => s + offerAmount(o), 0);

  const topBid = bids[0]
    ? { price: offerPrice(bids[0]).toFixed(6), amount: offerAmount(bids[0]).toFixed(2) }
    : null;
  const topAsk = asks[0]
    ? { price: offerPrice(asks[0]).toFixed(6), amount: offerAmount(asks[0]).toFixed(2) }
    : null;

  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }

  const baseCcy = pair.base.currency === "XRP" ? "XRP" : pair.base.currency;
  return {
    actor: "xrpl-dex",
    book: `${baseCcy}/${pair.quote.currency}`,
    venue: pair.venue,
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bidDepth.toFixed(2),
    askDepthBase: askDepth.toFixed(2),
    source: "XRPL book_offers (on-ledger)",
    fetchedAt: new Date().toISOString(),
    ttlSeconds: CACHE_TTL_MS / 1000,
  };
}
```

- [ ] **Step 2: Add GateHub DEX pairs to PARTNER_DEPTH_BOOKS and extend the switch**

```typescript
// Replace the PARTNER_DEPTH_BOOKS and fetchPartnerDepth switch:

// DEX pair definitions for on-ledger orderbooks
const GATEHUB = "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq";
const GATEHUB_GBP = "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g";

const DEX_PAIRS: Record<string, DexPair> = {
  "eur-xrp:xrpl-dex": {
    base: { currency: "EUR", issuer: GATEHUB },
    quote: { currency: "XRP" },
    venue: "GateHub DEX (XRPL)",
  },
  "xrp-eur:xrpl-dex": {
    base: { currency: "XRP" },
    quote: { currency: "EUR", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "usd-xrp:xrpl-dex": {
    base: { currency: "USD", issuer: GATEHUB },
    quote: { currency: "XRP" },
    venue: "GateHub DEX (XRPL)",
  },
  "xrp-usd:xrpl-dex": {
    base: { currency: "XRP" },
    quote: { currency: "USD", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "usd-eur:xrpl-dex": {
    base: { currency: "USD", issuer: GATEHUB },
    quote: { currency: "EUR", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "eur-usd:xrpl-dex": {
    base: { currency: "EUR", issuer: GATEHUB },
    quote: { currency: "USD", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "gbp-xrp:xrpl-dex": {
    base: { currency: "GBP", issuer: GATEHUB_GBP },
    quote: { currency: "XRP" },
    venue: "GateHub DEX (XRPL)",
  },
  "usd-gbp:xrpl-dex": {
    base: { currency: "USD", issuer: GATEHUB },
    quote: { currency: "GBP", issuer: GATEHUB_GBP },
    venue: "GateHub DEX (XRPL)",
  },
};

// Update the PARTNER_DEPTH_BOOKS export to include DEX pairs
export const PARTNER_DEPTH_BOOKS: Record<string, string> = {
  "usd-mxn:bitso": "xrp_mxn",
  "mxn-usd:bitso": "xrp_mxn",
  // DEX pairs use special "dex:" prefix to signal the different fetcher
  ...Object.fromEntries(Object.keys(DEX_PAIRS).map(k => [k, `dex:${k}`])),
};

// Update fetchPartnerDepth to handle both Bitso and DEX
export async function fetchPartnerDepth(
  actor: string,
  book: string,
): Promise<PartnerDepthSnapshot> {
  const key = cacheKey(actor, book);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }
  let snapshot: PartnerDepthSnapshot;
  if (actor === "xrpl-dex") {
    const pairKey = book.replace("dex:", "");
    const pair = DEX_PAIRS[pairKey];
    if (!pair) throw new Error(`Unknown DEX pair: ${pairKey}`);
    snapshot = await fetchXrplDexDepth(pair);
  } else if (actor === "bitso") {
    snapshot = await fetchBitsoDepth(book);
  } else {
    throw new Error(`partner-depth: actor "${actor}" not supported.`);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, snapshot });
  logger.info("[partner-depth] fetched", {
    actor, book, bids: snapshot.bidCount, asks: snapshot.askCount,
    spreadBps: snapshot.spreadBps?.toFixed(1),
  });
  return snapshot;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/corridors/partnerDepth.ts
git commit -m "feat(depth): add GateHub on-ledger DEX depth via book_offers"
```

---

### Task 2: MCP Server — New Package

**Files:**
- Create: `apps/mcp-server/package.json`
- Create: `apps/mcp-server/tsconfig.json`
- Create: `apps/mcp-server/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@xrplens/mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "xrplens-mcp": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/index.ts — the MCP server**

The server uses stdio transport, exposes 7 tools that call the XRPLens REST API. The API base URL and API key are passed as env vars.

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.XRPLENS_API_URL ?? "https://api.xrplens.dev";
const API_KEY = process.env.XRPLENS_API_KEY ?? "";

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

const server = new McpServer({
  name: "xrplens",
  version: "0.1.0",
});

// ─── Tool: list_corridors ───────────────────────────────────────
server.tool(
  "list_corridors",
  "List all 2,436 XRPL fiat corridors with status, actors, and classification. Use filters to narrow results.",
  { region: z.string().optional().describe("Filter by region: GCC, LATAM, APAC, Europe, Americas, MEA, Africa"),
    status: z.string().optional().describe("Filter by status: GREEN, AMBER, RED, UNKNOWN"),
    currency: z.string().optional().describe("Filter by currency code, e.g. USD, EUR, MXN") },
  async ({ region, status, currency }) => {
    const data = await apiFetch("/corridors");
    let corridors = data.corridors ?? [];
    if (region) corridors = corridors.filter((c: any) => c.region?.toLowerCase() === region.toLowerCase());
    if (status) corridors = corridors.filter((c: any) => c.status === status.toUpperCase());
    if (currency) {
      const ccy = currency.toUpperCase();
      corridors = corridors.filter((c: any) => c.source?.currency === ccy || c.dest?.currency === ccy);
    }
    const summary = corridors.slice(0, 50).map((c: any) =>
      `${c.id} [${c.status}] ${c.source?.currency}→${c.dest?.currency} (${c.category}) — ${c.aiNote?.slice(0, 100) ?? "no note"}`
    );
    return { content: [{ type: "text", text: `Found ${corridors.length} corridors (showing first 50):\n\n${summary.join("\n")}` }] };
  }
);

// ─── Tool: get_corridor ─────────────────────────────────────────
server.tool(
  "get_corridor",
  "Get full details for a specific corridor by slug (e.g. usd-mxn). Returns actors, routes, status, AI analysis.",
  { id: z.string().describe("Corridor slug, e.g. 'usd-mxn', 'eur-gbp'") },
  async ({ id }) => {
    const data = await apiFetch(`/corridors/${encodeURIComponent(id)}`);
    return { content: [{ type: "text", text: JSON.stringify(data.corridor, null, 2) }] };
  }
);

// ─── Tool: get_corridor_history ─────────────────────────────────
server.tool(
  "get_corridor_history",
  "Get the status timeline for a corridor over the last N days (default 30). Shows GREEN/AMBER/RED events.",
  { id: z.string().describe("Corridor slug"), days: z.number().optional().describe("Window in days (default 30, max 90)") },
  async ({ id, days }) => {
    const data = await apiFetch(`/corridors/${encodeURIComponent(id)}/history?days=${days ?? 30}`);
    const events = data.events ?? [];
    const lines = events.map((e: any) => `${e.at} — ${e.status} (${e.pathCount} paths)`);
    return { content: [{ type: "text", text: `${events.length} events over ${data.windowDays} days:\n\n${lines.join("\n")}` }] };
  }
);

// ─── Tool: ask_corridor ─────────────────────────────────────────
server.tool(
  "ask_corridor",
  "Ask a natural-language question about a corridor or the entire atlas. Uses RAG grounded in real corridor data.",
  { question: z.string().describe("Your question about XRPL corridors"), corridorId: z.string().optional().describe("Optional: scope to one corridor") },
  async ({ question, corridorId }) => {
    const data = await apiFetch("/corridors/chat", {
      method: "POST",
      body: JSON.stringify({ message: question, corridorId }),
    });
    return { content: [{ type: "text", text: data.message?.content ?? "No response" }] };
  }
);

// ─── Tool: analyze_address ──────────────────────────────────────
server.tool(
  "analyze_address",
  "Launch an Entity Audit on any XRPL address. Returns a knowledge graph with risk flags. Depth 1 = seconds, depth 2 = minutes.",
  { address: z.string().describe("XRPL r-address to audit"), label: z.string().optional(), depth: z.number().min(1).max(3).optional().describe("Crawl depth 1-3 (default 1)") },
  async ({ address, label, depth }) => {
    const start = await apiFetch("/analyze", {
      method: "POST",
      body: JSON.stringify({ seedAddress: address, seedLabel: label, depth: depth ?? 1 }),
    });
    // Poll for completion (max 120s)
    const analysisId = start.id;
    let status = start.status;
    const deadline = Date.now() + 120_000;
    while ((status === "queued" || status === "running") && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await apiFetch(`/analyze/${analysisId}/status`);
      status = poll.status;
    }
    if (status !== "done") {
      return { content: [{ type: "text", text: `Analysis ${analysisId} is ${status}. Check back later.` }] };
    }
    const graph = await apiFetch(`/analysis/${analysisId}/graph`);
    return { content: [{ type: "text", text: `Analysis complete. ${graph.nodes?.length ?? 0} nodes, ${graph.edges?.length ?? 0} edges.\nStats: ${JSON.stringify(graph.stats)}\n\nUse ask_analysis to query this graph. Analysis ID: ${analysisId}` }] };
  }
);

// ─── Tool: ask_analysis ─────────────────────────────────────────
server.tool(
  "ask_analysis",
  "Ask a question about a completed Entity Audit analysis. Uses RAG grounded in the knowledge graph.",
  { analysisId: z.string().describe("Analysis ID from analyze_address"), question: z.string() },
  async ({ analysisId, question }) => {
    const data = await apiFetch("/chat", {
      method: "POST",
      body: JSON.stringify({ analysisId, message: question }),
    });
    return { content: [{ type: "text", text: data.message?.content ?? data.content ?? "No response" }] };
  }
);

// ─── Tool: get_partner_depth ────────────────────────────────────
server.tool(
  "get_partner_depth",
  "Get live measured orderbook depth for a corridor from a partner venue or the XRPL DEX.",
  { corridorId: z.string().describe("Corridor slug, e.g. 'usd-mxn'"), actor: z.string().optional().describe("Partner key: 'bitso' or 'xrpl-dex'") },
  async ({ corridorId, actor }) => {
    const data = await apiFetch(`/corridors/${encodeURIComponent(corridorId)}/partner-depth?actor=${actor ?? "bitso"}`);
    const s = data.snapshot;
    return { content: [{ type: "text", text: `${s.venue} ${s.book}\nBid: ${s.bidCount} offers, top ${s.topBid?.price ?? "—"}\nAsk: ${s.askCount} offers, top ${s.topAsk?.price ?? "—"}\nSpread: ${s.spreadBps?.toFixed(1) ?? "—"} bps\nDepth: ${s.bidDepthBase} / ${s.askDepthBase}` }] };
  }
);

// ─── Start ──────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
```

- [ ] **Step 4: Install dependencies**

Run: `cd apps/mcp-server && pnpm install`

- [ ] **Step 5: Verify it compiles**

Run: `cd apps/mcp-server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/mcp-server/
git commit -m "feat(mcp): add MCP server exposing XRPLens API to Claude"
```

---

### Task 3: Docs Page Redesign — Tab-Based Routing (MCP, API, Roadmap)

**Files:**
- Modify: `apps/web/src/routes/ApiDocs.tsx` → full rewrite as multi-tab Docs page
- Modify: `apps/web/src/components/layout/Navbar.tsx` — rename "API" → "Docs"

- [ ] **Step 1: Update Navbar label**

In `Navbar.tsx`, change the NAV_LINKS entry:

```typescript
// Change:
{ to: "/developers", label: "API" },
// To:
{ to: "/developers", label: "Docs" },
```

- [ ] **Step 2: Rewrite ApiDocs.tsx as tab-routed Docs page**

The page uses `?tab=mcp|api|roadmap` query params. Each tab renders a completely different page content (not scroll sections). The left sidebar stays, but clicking switches the tab param, not scrolls.

Keep ALL existing endpoint data arrays (CORRIDOR_ENDPOINTS, SAFE_PATH_ENDPOINTS, ENTITY_AUDIT_ENDPOINTS) and components (EndpointCard, RoadmapCard) as-is. Just restructure the layout.

The three tabs:
1. **MCP** (default) — How to connect XRPLens to Claude Code, setup instructions, API key info
2. **API** — The existing REST API docs (Overview + Corridor Atlas + Safe Path + Entity Audit sections)
3. **Roadmap** — The existing roadmap section

Replace the `ApiDocs` component's internal state and rendering:

```typescript
// Replace the SECTIONS array and the active/scrollTo state with:

type DocsTab = "mcp" | "api" | "roadmap";

const TABS: { key: DocsTab; label: string; icon: string }[] = [
  { key: "mcp", label: "MCP Server", icon: "⬡" },
  { key: "api", label: "REST API", icon: "◈" },
  { key: "roadmap", label: "Roadmap", icon: "→" },
];

// In the component, use useSearchParams:
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ApiDocs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as DocsTab) || "mcp";
  const setTab = (t: DocsTab) => setSearchParams({ tab: t });
  // ... render
}
```

The left sidebar renders TABS instead of SECTIONS, and calls `setTab()` instead of `scrollTo()`.

The main content area renders one of three components based on `activeTab`:
- `activeTab === "mcp"` → `<McpDocsContent />`
- `activeTab === "api"` → `<ApiDocsContent />` (all existing endpoint sections)
- `activeTab === "roadmap"` → `<RoadmapContent />` (existing roadmap section)

- [ ] **Step 3: Create the MCP docs content**

The MCP tab content explains:
1. What MCP is (one line)
2. What the XRPLens MCP server does (7 tools)
3. How to set it up with Claude Code (requires XRPLENS_API_KEY)
4. Config JSON for `claude_desktop_config.json`
5. Example queries

```tsx
function McpDocsContent() {
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
          Claude can browse corridors, run entity audits, query RAG chats, and check
          live DEX depth — all through natural conversation. Requires an API key
          from your XRPLens account.
        </p>

        {/* Setup card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-violet-400">1</span> Get your API key
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>
              Connect your wallet on XRPLens and upgrade to Premium. Your API key is
              available on your{" "}
              <button onClick={() => navigate("/account")} className="text-xrp-400 hover:underline">
                Account page
              </button>.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-violet-400">2</span> Add to Claude Code
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-3">
            <p>Add this to your <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">claude_desktop_config.json</code> or <code className="text-xrp-400 bg-slate-900 px-1 rounded text-[11px]">.claude/settings.json</code>:</p>
            <pre className="text-[11px] font-mono text-emerald-300 bg-slate-950/60 border border-slate-800 rounded p-3 overflow-x-auto whitespace-pre-wrap">{`{
  "mcpServers": {
    "xrplens": {
      "command": "npx",
      "args": ["@xrplens/mcp-server"],
      "env": {
        "XRPLENS_API_KEY": "your-api-key-here",
        "XRPLENS_API_URL": "https://api.xrplens.dev"
      }
    }
  }
}`}</pre>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-violet-400">3</span> Start asking
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>Once configured, Claude has access to 7 tools:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {[
                { name: "list_corridors", desc: "Browse & filter 2,436 corridors" },
                { name: "get_corridor", desc: "Full detail for one corridor" },
                { name: "get_corridor_history", desc: "30-day status timeline" },
                { name: "ask_corridor", desc: "RAG Q&A on corridor data" },
                { name: "analyze_address", desc: "Launch Entity Audit on any address" },
                { name: "ask_analysis", desc: "RAG Q&A on audit results" },
                { name: "get_partner_depth", desc: "Live DEX/exchange orderbook depth" },
              ].map(t => (
                <div key={t.name} className="flex items-start gap-2 bg-slate-900/50 border border-slate-800 rounded-lg p-2.5">
                  <code className="text-[10px] font-mono text-violet-300 shrink-0">{t.name}</code>
                  <span className="text-[11px] text-slate-500">{t.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Example prompts */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          Example prompts
        </div>
        <div className="space-y-2">
          {[
            "What's the safest USD→MXN corridor right now?",
            "Show me all GREEN corridors in LATAM",
            "Audit the RLUSD issuer address and tell me about risk flags",
            "What's the live spread on EUR/XRP via GateHub?",
            "Which corridors have the most ODL partners?",
          ].map((q, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-300 italic">
              "{q}"
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Extract API content and Roadmap content into separate components**

Move the existing sections into:
- `ApiDocsContent` — contains overview cards + all three endpoint sections + TypeScript client card
- `RoadmapContent` — contains the existing roadmap section

These are just extractions of existing JSX — no new content. The endpoint data arrays stay at module level.

- [ ] **Step 5: Verify it compiles and renders**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/ApiDocs.tsx apps/web/src/components/layout/Navbar.tsx
git commit -m "feat(docs): restructure API page into Docs with MCP/API/Roadmap tabs"
```

---

### Task 4: Update PRODUCT_CONTEXT.md

**Files:**
- Modify: `PRODUCT_CONTEXT.md`

- [ ] **Step 1: Add GateHub DEX depth section**

In PARTIE 3 (Architecture Technique), after the pgvector section, add a section about GateHub DEX integration explaining that XRPLens queries on-ledger orderbooks via `book_offers` for EUR/XRP, USD/XRP, EUR/USD, GBP/XRP, USD/GBP pairs through GateHub gateway addresses.

- [ ] **Step 2: Add MCP Server section**

In PARTIE 4 (Produits Détaillés), after the Entity Audit section, add a new "Produit 4: MCP Server" section explaining the 7 tools, the stdio transport, and that it requires an API key.

- [ ] **Step 3: Update chiffres**

In PARTIE 6, update the key numbers:
- Add "8" GateHub DEX pairs with live depth
- Add "7" MCP tools for Claude integration
- Add "MCP Server" to the product flow sentence

- [ ] **Step 4: Commit**

```bash
git add PRODUCT_CONTEXT.md
git commit -m "docs: add GateHub DEX depth + MCP server to product context"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Verify server compiles**

Run: `cd apps/server && npx tsc --noEmit`

- [ ] **Step 2: Verify web compiles**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 3: Verify MCP server compiles**

Run: `cd apps/mcp-server && npx tsc --noEmit`

- [ ] **Step 4: Start the dev server and verify pages load**

Run: `cd apps/server && pnpm dev` — check no crash on startup
Run: `cd apps/web && pnpm dev` — check /developers loads with MCP tab, /developers?tab=api shows API docs, /developers?tab=roadmap shows roadmap

- [ ] **Step 5: Verify auth/account flow still works**

Navigate to the site, connect wallet, check /account page loads with profile/safe-path/audits/history tabs. Verify no regressions.
