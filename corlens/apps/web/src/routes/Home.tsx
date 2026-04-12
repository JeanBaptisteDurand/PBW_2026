import { useNavigate } from "react-router-dom";
import { RLUSD_ISSUER } from "@corlens/core";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { HomeBackground } from "../fragments/Home/HomeBackground";

// ─── Home / SaaS-style landing page ─────────────────────────────────────
// Respects the established design system: uses --page-accent-*, CSS vars
// from design-tokens, and the app-theme-home class set by Layout.tsx.
// New sections are added as self-contained blocks within the same file
// to keep fragment count stable. All styling via Tailwind + CSS vars.

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="app-content-min-height relative overflow-hidden">
      <HomeBackground />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — Hero
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <Badge variant="info" className="px-3 py-1 text-xs">
            Corridor Intelligence + AI Agent
          </Badge>

          <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-white">
            The missing map for{" "}
            <span className="text-[color:var(--page-accent-400)]">
              XRPL cross-border payments
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
            2,436 fiat corridors classified by how they settle on XRPL. An AI
            agent that routes capital through them safely — with live risk
            analysis, split routing, and downloadable compliance reports.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/corridors")}>
              Browse Corridor Atlas
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate("/safe-path")}
            >
              Route with Safe Path Agent
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                navigate(`/analyze?address=${RLUSD_ISSUER}&label=RLUSD`)
              }
            >
              Audit an Entity
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — Stats bar
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-4 rounded-xl border border-[color:var(--app-glass-panel-border)] bg-[var(--app-glass-panel-bg)] px-8 py-6 shadow-[var(--app-glass-panel-shadow)] backdrop-blur-md">
          {[
            { value: "2,436", label: "Live corridors" },
            { value: "48", label: "Currencies" },
            { value: "~200", label: "Real-world actors" },
            { value: "100%", label: "Off-chain GREEN" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-[color:var(--page-accent-400)]">
                {s.value}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2b — Powered-by strip (data sources & partners)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-5xl px-6 pb-14">
        <div className="flex flex-col items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600">
            Powered by
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { name: "QuickNode", desc: "XRPL node infra" },
              { name: "GateHub", desc: "IOU gateway" },
              { name: "Bitso", desc: "MXN liquidity" },
              { name: "Ripple", desc: "RLUSD issuer" },
              { name: "XRPL DEX", desc: "On-chain orderbooks" },
            ].map((p) => (
              <div key={p.name} className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-semibold text-white">{p.name}</span>
                <span className="text-[9px] text-slate-500">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — The three products (corridor → agent → audit)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="text-center mb-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--page-accent-400)] mb-2">
            Three products, one mission
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Browse corridors. Route money. Prove the tools are real.
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            Make the infrastructure that moves money on XRPL legible,
            auditable, and trustworthy — for institutions, fintechs, and the
            700M people at the bottom of the remittance pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Corridor Atlas */}
          <Card
            className="group relative overflow-hidden cursor-pointer transition-all duration-200 hover:border-[color:var(--page-accent-500)]/60 hover:shadow-lg"
            onClick={() => navigate("/corridors")}
          >
            <div
              aria-hidden
              className="home-feature-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-2xl text-[color:var(--page-accent-400)]">
                  ◈
                </span>
                <Badge variant="info">2,436 lanes</Badge>
              </div>
              <CardTitle className="mt-3">Corridor Atlas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-400 mb-3">
                Every fiat-to-fiat lane that can settle through XRPL. Classified
                by how it actually moves money: native IOU orderbooks, hybrid
                legacy, or off-chain RLUSD bridge via named partners.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <MiniTag>3D Globe</MiniTag>
                <MiniTag>AI commentary</MiniTag>
                <MiniTag>30-day sparkline</MiniTag>
                <MiniTag>Actor registry</MiniTag>
              </div>
            </CardContent>
          </Card>

          {/* Safe Path Agent */}
          <Card
            className="group relative overflow-hidden cursor-pointer transition-all duration-200 hover:border-[color:var(--page-accent-500)]/60 hover:shadow-lg"
            onClick={() => navigate("/safe-path")}
          >
            <div
              aria-hidden
              className="home-feature-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-2xl text-[color:var(--page-accent-400)]">
                  ◎
                </span>
                <Badge variant="info">AI Agent</Badge>
              </div>
              <CardTitle className="mt-3">Safe Path Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-400 mb-3">
                A real tool-using agent, not a chatbot. Calls six tools against
                the live XRPL, rejects risky paths, proposes split routing, and
                generates a downloadable compliance report.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <MiniTag>SSE streaming</MiniTag>
                <MiniTag>Split routing</MiniTag>
                <MiniTag>Risk rejection</MiniTag>
                <MiniTag>PDF report</MiniTag>
              </div>
            </CardContent>
          </Card>

          {/* Entity Audit */}
          <Card
            className="group relative overflow-hidden cursor-pointer transition-all duration-200 hover:border-[color:var(--page-accent-500)]/60 hover:shadow-lg"
            onClick={() =>
              navigate(`/analyze?address=${RLUSD_ISSUER}&label=RLUSD`)
            }
          >
            <div
              aria-hidden
              className="home-feature-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-2xl text-[color:var(--page-accent-400)]">
                  ◉
                </span>
                <Badge variant="info">18 types</Badge>
              </div>
              <CardTitle className="mt-3">Entity Audit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-400 mb-3">
                The same crawler the agent calls internally — exposed standalone.
                18 node types, 19 edge types, crawled live on XRPL mainnet. The
                proof the agent's tools are not mocked.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <MiniTag>Knowledge graph</MiniTag>
                <MiniTag>Risk flags</MiniTag>
                <MiniTag>AI explanation</MiniTag>
                <MiniTag>Live crawl</MiniTag>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — How the corridor atlas works (left text / right mock)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(43,196,157,0.06) 40%, rgba(123,99,224,0.06) 60%, transparent 100%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400 mb-2">
              Corridor Atlas
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Three corridor types — how any fiat reaches any fiat through XRPL
            </h2>
            <div className="space-y-4">
              <CorridorType
                color="text-amber-400"
                border="border-amber-500/30"
                label="XRPL-Native"
                count="42 corridors"
                desc="Both currencies have live IOU trust lines on XRPL (GateHub, Bitstamp). Real orderbooks on the XRPL DEX. CorLens runs path_find every hour."
                example="USD.GateHub → XRPL DEX → EUR.GateHub"
              />
              <CorridorType
                color="text-sky-400"
                border="border-sky-500/30"
                label="Hybrid / Legacy"
                count="Variable"
                desc="On-chain IOUs exist but are dead — zero live paths. The real flow runs through off-chain partners and RLUSD. CorLens auto-detects and hides the useless routes."
                example="CHF → Bitcoin Suisse → RLUSD → Kraken → USD"
              />
              <CorridorType
                color="text-emerald-400"
                border="border-emerald-500/30"
                label="Off-Chain Bridge"
                count="2,322 corridors · 95%"
                desc="Neither currency has on-chain IOUs. Payments settle through real-world partners holding RLUSD or XRP on XRPL. 100% GREEN status."
                example="USD → Coinbase (buy RLUSD) → XRPL → Bitso (sell for MXN)"
              />
            </div>
          </div>

          {/* Right: corridor detail mock card */}
          <div className="rounded-xl border border-[color:var(--app-glass-panel-border)] bg-[var(--app-glass-panel-bg)] p-5 shadow-[var(--app-glass-panel-shadow)] backdrop-blur-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🇺🇸</span>
              <span className="text-slate-500">→</span>
              <span className="text-sm">🇲🇽</span>
              <span className="ml-2 text-xs font-bold text-white">
                USD → MXN
              </span>
              <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                GREEN
              </span>
            </div>
            <div className="text-[9px] uppercase tracking-widest text-slate-600 mb-2">
              Off-chain bridge · Cross-region · Priority 90/99
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded p-3 mb-3">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                AI Commentary
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Real-world fiat lane from US Dollar to Mexican Peso. The route
                bridges via RLUSD held by 15 source-side and 3 destination-side
                partners. 2 Ripple ODL partners service this corridor. 16 of 18
                actors publish confirmed RLUSD support.
              </p>
            </div>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-slate-950/60 border border-slate-800 rounded p-2 text-center">
                <div className="text-[9px] text-slate-500 uppercase">
                  On-ramps
                </div>
                <div className="text-sm font-bold text-white">15</div>
              </div>
              <div className="flex-1 bg-slate-950/60 border border-slate-800 rounded p-2 text-center">
                <div className="text-[9px] text-slate-500 uppercase">
                  Off-ramps
                </div>
                <div className="text-sm font-bold text-white">3</div>
              </div>
              <div className="flex-1 bg-slate-950/60 border border-slate-800 rounded p-2 text-center">
                <div className="text-[9px] text-slate-500 uppercase">
                  ODL partners
                </div>
                <div className="text-sm font-bold text-emerald-400">2</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Live · Measured, not assumed
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Bitso XRP/MXN · 350k XRP bid · 6 bps spread · 60s refresh
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — Safe Path Agent deep-dive (radial tool diagram)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="text-center mb-12">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-400 mb-2">
            AI Agent
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            One orchestrator. Seven real tools. Not mocked.
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            The Safe Path Agent queries the Corridor RAG, launches Entity Audit
            analyses, queries their RAG chats, crawls XRPL accounts, researches
            actors online, and generates compliance reports — all streamed live.
          </p>
        </div>

        {/* Radial agent diagram */}
        <div className="relative mx-auto" style={{ maxWidth: 720, height: 600 }}>
          {/* Center hub */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-sky-600/30 to-violet-600/30 border-2 border-sky-400/60 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(14,165,233,0.25)]">
              <span className="text-lg font-bold text-white">Safe Path</span>
              <span className="text-[10px] text-sky-300 font-semibold uppercase tracking-wider">Agent</span>
            </div>
          </div>

          {/* SVG connector lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 720 600">
            {[
              [360, 300, 360, 70],   // top
              [360, 300, 600, 120],  // top-right
              [360, 300, 640, 350],  // right
              [360, 300, 520, 530],  // bottom-right
              [360, 300, 200, 530],  // bottom-left
              [360, 300, 80, 350],   // left
              [360, 300, 120, 120],  // top-left
            ].map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(56,189,248,0.15)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}
          </svg>

          {/* Tool nodes radiating around */}
          {[
            { x: "50%", y: 70, color: "violet", icon: "RAG", title: "Corridor RAG", desc: "Queries corridor intelligence for route strategy" },
            { x: "83%", y: 120, color: "emerald", icon: "BFS", title: "Deep Analyze", desc: "Launches Entity Audit (depth-2 BFS) on critical accounts" },
            { x: "89%", y: 350, color: "sky", icon: "AI", title: "Analysis RAG", desc: "Queries each analysis RAG for risk summaries" },
            { x: "72%", y: 530, color: "amber", icon: "WEB", title: "Web Research", desc: "Investigates actor reputation and licensing" },
            { x: "28%", y: 530, color: "red", icon: "ACC", title: "Crawl Accounts", desc: "Flags clawback, freeze, permissions on each hop" },
            { x: "11%", y: 350, color: "emerald", icon: "LIQ", title: "Partner Depth", desc: "Live orderbook depth from Bitso and DEX" },
            { x: "17%", y: 120, color: "sky", icon: "RPT", title: "Compliance Report", desc: "Generates full compliance report with evidence" },
          ].map((tool, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: tool.x, top: tool.y }}
            >
              <div className={`w-[130px] rounded-lg border border-${tool.color}-500/30 bg-slate-950/80 backdrop-blur p-3 text-center`}>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-${tool.color}-500/15 border border-${tool.color}-500/40 text-[10px] font-bold text-${tool.color}-300 mb-1.5`}>
                  {tool.icon}
                </div>
                <div className="text-[11px] font-semibold text-white leading-tight">
                  {tool.title}
                </div>
                <div className="text-[9px] text-slate-500 leading-snug mt-0.5">
                  {tool.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500 max-w-xl mx-auto mb-5">
            The agent queries the <strong className="text-violet-400">Corridor RAG</strong> for route intel,
            then launches <strong className="text-emerald-400">Entity Audit analyses</strong> and
            queries <strong className="text-sky-400">their RAG chats</strong> for risk summaries.
            It's a real orchestrator consuming the entire CorLens ecosystem.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/safe-path")}
            className="bg-sky-600 hover:bg-sky-500"
          >
            Try Safe Path Agent
          </Button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — Risk flags + AI Chat capabilities
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(239,68,68,0.04) 30%, rgba(123,99,224,0.06) 70%, transparent 100%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Risk flags */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400 mb-2">
              Security layer
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              17+ automated risk detectors
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              The Entity Audit crawler scans every account on every hop and
              flags issues automatically. The Safe Path Agent rejects paths
              with HIGH-severity flags — here's what it catches:
            </p>
            <div className="space-y-2">
              <RiskFlagRow
                severity="HIGH"
                flag="CLAWBACK_ENABLED"
                detail="Issuer can recall tokens from any holder. RLUSD issuer has this — the agent flags it and explains why."
              />
              <RiskFlagRow
                severity="HIGH"
                flag="GLOBAL_FREEZE"
                detail="Issuer has frozen all trust lines. No tokens can move. Instant corridor death."
              />
              <RiskFlagRow
                severity="HIGH"
                flag="DEEP_FROZEN_TRUST_LINE"
                detail="XLS-77 individual trust line freeze. Targeted, surgical — harder to detect without crawling."
              />
              <RiskFlagRow
                severity="MED"
                flag="AMM_CLAWBACK_EXPOSURE"
                detail="XLS-73 — AMM pool where one side's issuer has clawback enabled. Liquidity could vanish."
              />
              <RiskFlagRow
                severity="MED"
                flag="NO_MULTISIG"
                detail="Single-signer account controlling significant issuance. Key compromise = total loss."
              />
              <RiskFlagRow
                severity="MED"
                flag="UNVERIFIED_ISSUER"
                detail="Issuer not verified by any known registry. Could be legitimate, could be a scam token."
              />
              <RiskFlagRow
                severity="LOW"
                flag="PERMISSIONED_DOMAIN_DEPENDENCY"
                detail="XLS-80 — trust line gated by KYC credentials. Route may fail if sender lacks the credential."
              />
            </div>
          </div>

          {/* AI Chat capabilities */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-400 mb-2">
              AI-Powered intelligence
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Two AI chat surfaces, one knowledge base
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              Every product surface has an AI chat grounded in real data — not
              hallucinated, not generic. RAG-powered, scoped to context.
            </p>

            {/* Corridor Chat */}
            <div className="rounded-xl border border-violet-500/20 bg-[var(--app-glass-panel-bg)] p-5 mb-4 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/40 text-xs">
                  💬
                </span>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Corridor RAG Chat
                  </div>
                  <div className="text-[10px] text-slate-500">
                    On every corridor page + atlas-wide
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <ChatBubble role="user">
                  Which GCC corridors have RLUSD on both sides?
                </ChatBubble>
                <ChatBubble role="ai">
                  5 GCC corridors have confirmed RLUSD support on both legs:
                  SAR↔USD, AED↔USD, QAR↔USD, BHD↔USD, KWD↔USD. All via
                  Rain Financial (Bahrain) as the regional RLUSD gateway...
                </ChatBubble>
              </div>
            </div>

            {/* Graph Chat */}
            <div className="rounded-xl border border-emerald-500/20 bg-[var(--app-glass-panel-bg)] p-5 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs">
                  🤖
                </span>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Entity Audit Chat
                  </div>
                  <div className="text-[10px] text-slate-500">
                    On every knowledge graph
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <ChatBubble role="user">
                  Why does the RLUSD issuer have clawback enabled?
                </ChatBubble>
                <ChatBubble role="ai">
                  RLUSD is a regulated stablecoin issued by Ripple. Clawback
                  (XLS-39) is enabled for regulatory compliance — it lets the
                  issuer recall tokens in case of fraud or sanctions enforcement.
                  This is expected for institutional stablecoins...
                </ChatBubble>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7 — Technical specs grid
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="text-center mb-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--page-accent-400)] mb-2">
            Under the hood
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Built for institutional trust
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: "18", label: "Node types", sub: "Knowledge graph" },
            { value: "19", label: "Edge types", sub: "Relationship model" },
            { value: "17+", label: "Risk detectors", sub: "Automated flags" },
            { value: "6", label: "Agent tools", sub: "Safe Path Agent" },
            { value: "7", label: "XLS amendments", sub: "Tracked live" },
            { value: "6", label: "API endpoints", sub: "Public REST" },
            { value: "60s", label: "Depth refresh", sub: "Bitso live feed" },
            { value: "1hr", label: "Path scan", sub: "On-chain corridors" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[color:var(--app-glass-panel-border)] bg-[var(--app-glass-panel-bg)] p-4 text-center backdrop-blur-md"
            >
              <div className="text-xl font-bold text-[color:var(--page-accent-400)]">
                {s.value}
              </div>
              <div className="text-xs font-semibold text-white mt-1">
                {s.label}
              </div>
              <div className="text-[10px] text-slate-500">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8 — The gap we fill (competitive positioning)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(43,196,157,0.04) 50%, transparent 100%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--page-accent-400)] mb-2">
            No competitor exists
          </div>
          <h2 className="text-3xl font-bold text-white mb-6">
            The gap CorLens fills
          </h2>
          <div className="overflow-hidden rounded-xl border border-[color:var(--app-glass-panel-border)] backdrop-blur-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="text-left px-4 py-2.5">Category</th>
                  <th className="text-left px-4 py-2.5">Who's there</th>
                  <th className="text-left px-4 py-2.5">Why they're not us</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  ["XRPL explorers", "XRPScan, Bithomp", "Raw on-chain data only. No corridor concept."],
                  ["Ripple tools", "Liquidity Hub", "Partner-only, closed. Not public."],
                  ["Stablecoin dashboards", "Artemis, DefiLlama", "RLUSD supply only. Zero routing data."],
                  ["Blockchain forensics", "Chainalysis, Elliptic", "KYT/sanctions focus. Not corridor health."],
                  ["Cross-chain agg.", "LI.FI, Jumper", "XRPL not integrated. Fiat is onramp-only."],
                  ["Closest adjacent", "Utility Scan", "Historical ODL volume only. No classification, no agent."],
                ].map(([cat, who, why]) => (
                  <tr key={cat} className="bg-[var(--app-glass-panel-bg)]">
                    <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">
                      {cat}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{who}</td>
                    <td className="px-4 py-2.5 text-slate-500">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 9 — CTA footer
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-5xl px-6 pb-20 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Ready to explore?
        </h2>
        <p className="text-sm text-slate-400 mb-6 max-w-xl mx-auto">
          Browse the corridor atlas, let the AI agent route your capital, or
          audit any entity on XRPL — all live on mainnet, right now.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          <Button size="lg" onClick={() => navigate("/corridors")}>
            Browse Corridor Atlas
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate("/safe-path")}
          >
            Route with Safe Path Agent
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate("/developers")}
          >
            Read the API Docs
          </Button>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          Open source. Built for Hack the Block — Paris Blockchain Week 2026.
        </p>
        <div className="flex justify-center gap-2 mb-8">
          <Badge variant="default">RLUSD</Badge>
          <Badge variant="default">ODL Corridors</Badge>
          <Badge variant="default">AI Agent</Badge>
          <Badge variant="default">Compliance</Badge>
        </div>
        <div className="flex items-center justify-center gap-6 opacity-60">
          <a href="https://www.quicknode.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-100 transition-opacity">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2z" fill="#0B3BF4"/>
              <path d="M22.5 18.5l-3 5.196a1 1 0 01-.866.5h-6a1 1 0 01-.866-.5l-3-5.196a1 1 0 010-1l3-5.196a1 1 0 01.866-.5h6a1 1 0 01.866.5l3 5.196a1 1 0 010 1z" fill="white"/>
            </svg>
            <span className="text-xs font-semibold text-slate-400">QuickNode</span>
          </a>
          <div className="w-px h-5 bg-slate-700" />
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="#23292F"/>
              <path d="M23.07 11.49l-1.43-.83-1.42-.82-1.43-.83-1.42-.82L16 7.37l-1.37.82-1.43.82-1.42.83-1.43.82-1.42.83v1.64l1.42.82V15.6l-1.42.82v1.65l1.42.82 1.43.83 1.42.82 1.43.83L16 22.19l1.37-.82 1.43-.83 1.42-.82 1.43-.83 1.42-.82v-1.65l-1.42-.82v-1.65l1.42-.82zm-8.5 7.45l-1.42-.82-1.43-.83v-1.64l1.43.82 1.42.82 1.43.83v1.64zm5.68-3.28l-1.43.83-1.42.82-1.43.82v-1.64l1.43-.82 1.42-.83 1.43-.82z" fill="white"/>
            </svg>
            <span className="text-xs font-semibold text-slate-400">XRP Ledger</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Inline sub-components (kept here to respect fragment structure) ───────

function MiniTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/50">
      {children}
    </span>
  );
}

function CorridorType({
  color,
  border,
  label,
  count,
  desc,
  example,
}: {
  color: string;
  border: string;
  label: string;
  count: string;
  desc: string;
  example: string;
}) {
  return (
    <div className={`rounded-lg border ${border} bg-slate-950/40 p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold ${color}`}>{label}</span>
        <span className="text-[10px] text-slate-500 font-mono">{count}</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{desc}</p>
      <code className="text-[10px] text-slate-500 font-mono">{example}</code>
    </div>
  );
}

function RiskFlagRow({
  severity,
  flag,
  detail,
}: {
  severity: "HIGH" | "MED" | "LOW";
  flag: string;
  detail: string;
}) {
  const colors =
    severity === "HIGH"
      ? "bg-red-500/10 text-red-400 border-red-500/30"
      : severity === "MED"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : "bg-slate-700/40 text-slate-400 border-slate-700";
  return (
    <div className={`rounded-lg border ${colors.split(" ").slice(2).join(" ")} bg-slate-950/40 p-3`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`px-1.5 py-0 rounded text-[9px] font-bold border ${colors}`}
        >
          {severity}
        </span>
        <span className="text-[11px] font-mono font-semibold text-white">
          {flag}
        </span>
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">{detail}</p>
    </div>
  );
}

function ChatBubble({
  role,
  children,
}: {
  role: "user" | "ai";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
        role === "user"
          ? "bg-slate-800 text-slate-300 ml-8"
          : "bg-slate-900/80 border border-slate-800 text-slate-300 mr-4"
      }`}
    >
      <span
        className={`text-[9px] font-bold uppercase tracking-widest ${
          role === "user" ? "text-slate-500" : "text-violet-400"
        } block mb-0.5`}
      >
        {role === "user" ? "You" : "AI"}
      </span>
      {children}
    </div>
  );
}
