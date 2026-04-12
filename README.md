# XRPLens (cor-lens.xyz)

### AI-powered risk intelligence & autonomous compliance agent for **XRPL DeFi**

**XRPLens** is a full-stack platform for mapping, understanding, and auditing the infrastructure behind cross-border payments on the **XRP Ledger**.

The system automatically catalogues 2,436 live fiat corridors, classifies how each one settles on XRPL, and exposes an interactive knowledge graph of every entity touching a corridor — issuers, AMM pools, liquidity providers, trust lines, escrows, and payment paths.

A built-in **Safe Path AI Agent** can receive natural-language instructions (for example: "route 1M from USD to MXN through the safest corridor") and **analyze the route autonomously** — crawling live XRPL state, flagging risks, proposing split plans, and generating a downloadable compliance report.

---

## What the platform does

| Feature | Description |
| --- | --- |
| Corridor Atlas | Browse 2,436 live fiat payment corridors across 48 currencies with real-time health status (GREEN / AMBER / RED), actor breakdown, and partner orderbook depth |
| Safe Path AI Agent | Multi-step AI agent that analyzes cross-border payment compliance by calling 7 tools against live XRPL data, proposes split routing for large amounts, and generates downloadable compliance reports |
| Entity Audit Graph | Crawl any XRPL address and visualize the trust line network, AMM pools, risk flags, and dependencies as an interactive knowledge graph (18 node types, 19 edge types) |
| RAG Chat | Natural language queries over crawled XRPL data — ask questions grounded in actual on-chain state, not hallucinated |
| MCP Server | Let Claude talk to XRPLens directly via the Model Context Protocol — downloadable zip for Claude Desktop / Claude Code |
| Wallet Auth & Premium | Crossmark wallet-based authentication with XRP payment for premium access |

---

## Architecture Overview

[![COR-Lens Architecture](./diagram.png)](https://drive.google.com/file/d/1zyPOv8MCnVEvU_j-_nEHFRvGnzhnh6GV/view?usp=sharing)
> *Click the diagram to view full-size interactive version*

**High-Level Flow**

1. User browses the Corridor Atlas — 2,436 corridors classified as **XRPL-native** (on-chain IOU orderbooks), **Hybrid** (dead on-chain + live off-chain), or **Off-chain bridge** (RLUSD-settled via real-world partners)
2. User triggers a Safe Path analysis — the AI agent streams live tool calls (corridor resolution, XRPL path_find, risk flag crawl, depth measurement, split routing) while building a discovery graph in real time
3. Agent generates a downloadable compliance report — corridor classification, actor lists with ODL/RLUSD badges, measured depth, risk flags, AI-written compliance justification
4. Optional: user runs a standalone Entity Audit on any XRPL address to verify the agent's tools are real — same crawler, same engine, exposed as a standalone product

---

## Tech Stack

**Core:** TypeScript, Node.js, pnpm

**Frontend:** React 18, Vite, ReactFlow, TailwindCSS, Radix UI, React Query, 3D Globe

**Web3 & Wallet:** Crossmark SDK, XRPL wallet-based auth, XRP/RLUSD payments

**Blockchain / Data Sources:** xrpl.js WebSocket client (XRPL Mainnet), Bitso public API (live orderbook depth), corridor actor registry

**AI & Data Layer:** OpenAI (chat + embeddings), PostgreSQL, pgvector, Redis, BullMQ, RAG system, SSE streaming

**MCP Integration:** Standalone MCP server (7 tools) for Claude Desktop / Claude Code

**Infra & Runtime:** Docker, Docker Compose, Express, Prisma, Caddy

**XRPL Features Implemented:**
Trust Lines, AMM Pools, DEX Orderbooks, path_find, Escrow, Signer Lists, XLS-73 AMM Clawback, XLS-77 Deep Freeze, RLUSD, ODL Corridors

---

## Local Setup

```bash
cd xrplens
pnpm install

# Set up environment
cp apps/server/.env.example apps/server/.env
# Edit .env with your DATABASE_URL, OPENAI_API_KEY, etc.

# Start (Postgres + Redis + server + web)
docker compose up
```

---

## Problem & Solution

**Problem:**
XRPL is the backbone of $15B/year in ODL cross-border payments serving 700M people who depend on remittances. But institutions entering XRPL DeFi cannot audit the infrastructure they are about to fund. Ripple's Liquidity Hub is partner-only. Chainalysis covers sanctions, not corridor health. XRPScan shows trust lines but doesn't know what a corridor is. No tool answers: *Which corridor do I use? How deep is the RLUSD liquidity? Is there a clawback risk on any hop?*

**XRPLens Solution:**

- Catalogues **2,436 fiat corridors** classified by *how* they settle on XRPL — on-chain IOU, hybrid, or off-chain RLUSD bridge via named real-world partners
- Derives **live health signals** from actual XRPL path_find results, orderbook depth, AMM pool state, and partner registry quality
- Exposes a **Safe Path AI Agent** that takes two currencies and an amount, runs a live multi-tool analysis, proposes split routing for large amounts, and generates an **auditable compliance report**
- Detects **XLS-73 AMM Clawback** and **XLS-77 Deep Freeze** risk flags on mainnet — amendments live on XRPL that no other tool flags
- Ships a **public REST API** (10 endpoints) and an **MCP server** (7 tools) for programmatic access and Claude integration
- Supports **live measured orderbook depth** from Bitso — the flagship ODL partner — refreshed every 60 seconds, spread in basis points. Measured, not assumed.

---

## Submission

- **Project Name:** XRPLens
- **Track:** Make Waves + Impact Finance
- **Network:** XRP Ledger Mainnet
- **Repository:** https://github.com/JeanBaptisteDurand/PBW
- **Live Demo:** https://cor-lens.xyz

---

## Project Structure

```
xrplens/
  apps/
    server/       Backend API (Express + Prisma + BullMQ)
    web/          Frontend (React + Vite)
    mcp-server/   MCP server for Claude integration
  packages/
    core/         Shared types and utilities
```

---

## Docs

- [XRPLENS.md](XRPLENS.md) — Full product context, architecture, and pitch
- [FEATURES.md](FEATURES.md) — Complete feature list
- [PITCH.md](PITCH.md) — 3-minute pitch script and judge objection handling
- [MCP.md](xrplens/apps/mcp-server/MCP.md) — MCP server documentation

---

## Safe Path AI Agent — Deep Dive

The Safe Path Agent ([safePathAgent.ts](xrplens/apps/server/src/ai/safePathAgent.ts), ~1,000 lines) is an **autonomous multi-tool AI agent** that evaluates cross-border payment routes in real time. It streams every tool call and reasoning step via SSE so the frontend can display the agent's thought process live.

### 9-Phase Execution Pipeline

| Phase | Action | What it does |
| --- | --- | --- |
| 1 | **Corridor Resolution** | Looks up the currency pair in the local corridor catalog (2,436 corridors, 52 currencies). Resolves issuers, actors, and corridor category (on-chain / hybrid / off-chain bridge) |
| 1.5 | **Corridor RAG** | Queries the corridor vector store (pgvector cosine search) for intelligence about this specific corridor — route history, risk flags, liquidity notes |
| 2 | **AI Planning** | GPT-4o-mini generates a 4-5 sentence plan: corridor type, which actors to investigate, which XRPL tools to run, which risks to check |
| 3 | **Parallel Actor Research** | Fires web searches on top actors (reputation, incidents, licences) + fetches live orderbook depth from partner APIs (e.g. Bitso XRP/MXN spread in bps) — all in parallel |
| 4 | **Deep Entity Analysis** | Launches BFS depth-2 crawls of every issuer and AMM pool on-chain. Waits for completion (45s timeout), indexes the results into the RAG store, then queries it for risk insights |
| 4.5 | **Actor Address Discovery** | Resolves XRPL r-addresses of off-chain actors (Bitstamp, Kraken, Binance…) via a verified registry or GPT fallback, then deep-analyzes those addresses too |
| 5 | **On-Chain Pathfinding** | Runs `ripple_path_find` on XRPL mainnet. For each candidate path: crawls every hop account (checking global freeze, clawback, deposit auth), runs the risk engine, enforces tolerance. Paths that exceed risk tolerance are rejected |
| 6 | **Off-Chain Bridge Reasoning** | For fiat-to-fiat corridors with no on-chain IOU trust lines: evaluates the quality of source/destination ramps, checks RLUSD issuer + USDC issuer + XRP/RLUSD AMM pool health |
| 7 | **Split Plan** | If amount > $50K and measured depth is insufficient: computes an optimal split (e.g. 60/40) based on real orderbook depth to keep slippage under 20bps |
| 8 | **Verdict + Justification** | GPT-4o-mini writes a 4-6 sentence compliance justification incorporating all findings — corridor RAG, actor research, deep analysis insights, split rationale. This goes into the signed PDF |
| 9 | **Report Generation** | Produces a 12-section Markdown report: executive summary, recommended route, corridor classification, risk flags, partner depth, split plan, actor research, entity audit findings, corridor intelligence, compliance justification, historical status, disclaimer |

### Agent Tools

| Tool | Purpose |
| --- | --- |
| `crawlAccount` | Checks an XRPL account's flags: global freeze, clawback (XLS-73), deposit auth, domain verification, regular key |
| `deepAnalyze` | Launches a full BFS depth-2 analysis + RAG indexing + risk insight query |
| `webSearch` | Asks GPT for key facts about an exchange (founded, HQ, licence, incidents, volume) |
| `findActorAddress` | Resolves an exchange's XRPL r-address from a verified registry (Bitstamp, Kraken, Binance, GateHub, Sologenic) or via GPT lookup |
| `fetchPartnerDepth` | Fetches live orderbook depth from partner exchange APIs |
| `corridorChat` | Queries the corridor RAG for cross-corridor intelligence |

All events are streamed as typed SSE events (`SafePathEvent`) — the frontend renders tool calls, reasoning steps, path acceptances/rejections, and the final report in real time.

---

## Team

Third iteration of the same engine. **SuiLens** — 3rd place at Sui hackathon. **BaseLens** — 1st place at MBC 2025. **XRPLens** — rebuilt for the ledger the world's payment infrastructure is running on.

Built for **Hack the Block 2026**, Paris Blockchain Week (April 11-12, 2026).
