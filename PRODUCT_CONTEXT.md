# XRPLens — Full Product Context

> Document complet pour passer le contexte du produit à une IA de rédaction. Contient le pitch, l'architecture technique détaillée, et la description exhaustive de chaque feature.

---

# PARTIE 1 : PITCH

## The One-Liner

> **The first public, forward-looking corridor health catalogue for XRPL-settled cross-border payments — plus the agent that routes capital through it safely.**

Two products in one repo, one mission: make the infrastructure that moves money on XRPL **legible, auditable, and trustworthy** — for institutions, fintechs, and the 700M people at the bottom of the remittance pipeline.

## What we built

### 1. Corridor Atlas — 2,436 live fiat lanes, classified by *how* they settle on XRPL

| | Number |
|---|---:|
| Total corridors | **2,436** |
| Currencies covered | **48** (every major fiat with real actors) |
| Off-chain-bridge corridors (RLUSD-anchored) | 2,322 |
| XRPL-native on-chain fiat corridors | 42 |
| Stablecoin on/off-ramps + XRP off-ramps + cross-stable | 72 |
| Off-chain-bridge **GREEN** rate | **100% (2,322 / 2,322)** |
| Real-world actors in the registry | ~200 (CEXes, ODL partners, banks, mobile-money bridges, hubs) |

#### The three corridor types — how any fiat reaches any fiat through XRPL

The key insight: **the XRPL payment network is much bigger than the 7 currencies with on-chain IOU gateways.** With RLUSD as a universal bridge asset (launched Dec 2024, $1B+ cap by Q1 2026), any fiat that can reach RLUSD through a CEX can reach any other fiat that can reach RLUSD through another CEX.

**XRPL-native (42 corridors, ~2%)** — Both currencies have real IOU trust lines on XRPL (GateHub, Bitstamp). Real orderbooks on the XRPL DEX. XRPLens runs `path_find` against the live ledger every hour.

```
USD (you have) → USD.GateHub (IOU on XRPL) → XRPL DEX orderbook → EUR.GateHub (IOU) → EUR (you receive)
```

**Hybrid / legacy** — On-chain IOU trust lines exist but are dead — zero live paths. XRPLens detects this automatically and hides the useless on-chain table.

```
CHF (you have) → Bitcoin Suisse (off-chain) → RLUSD on XRPL → Kraken (off-chain) → USD (you receive)
```

**Off-chain bridge (2,322 corridors, ~95%)** — Neither currency has an on-chain IOU trust line. Settlement through real-world partners holding RLUSD or XRP on XRPL.

```
USD (you have) → Coinbase/Kraken (buy RLUSD) → RLUSD on XRPL → Bitso (sell RLUSD for MXN) → MXN (recipient receives)
```

**100% of the 2,322 off-chain-bridge corridors are GREEN** because every currency in the atlas has at least one partner with confirmed RLUSD or XRP support.

### 2. Safe Path Agent — the AI agent (`/safe-path`)

Pick two currencies and an amount. The AI agent does everything else:

1. **Resolves the corridor** from the atlas
2. **Queries the Corridor RAG chat** for intel ("Best routes? Most reliable actors? Known issues?")
3. **Plans its approach with AI** (GPT-4o-mini generates a 4-5 sentence investigation plan)
4. **Runs web research** on top actors (exchange reputation, licensing, incidents)
5. **Launches deep Entity Audit analyses** (depth-2 BFS) on critical accounts — RLUSD issuer, source issuers, dest issuers, top actor XRPL addresses
6. **Queries each analysis's RAG chat** for risk summaries ("3-5 bullets on flags, concentration, governance")
7. **Crawls hop accounts** inline for risk flags (clawback, global freeze, deposit restrictions)
8. **Fetches live partner depth** (Bitso orderbook for USD↔MXN)
9. **Analyzes on-chain paths** via XRPL `path_find` for native corridors
10. **Proposes split routing** for large amounts ("60% via path A, 40% via path B")
11. **Generates a downloadable compliance report** with all evidence

The whole run streams live as SSE events into a side-by-side UI: agent reasoning log + live path discovery graph building node by node. The agent **actually launches real Entity Audit analyses, waits for them to complete, then queries their RAG chat** — it's not mocked.

### 3. Entity Audit (`/analyze`) — proof the agent's tools are real

Paste any XRPL address — the same crawler the Safe Path Agent calls internally runs standalone. 18 node types, 19 edge types, full knowledge graph. Each analysis gets its own **RAG chat** where you can ask questions grounded in the graph data.

### 4. Public REST API + `/developers`

Six endpoints, fully documented. Same API the web client uses.

## Competitive validation

**No direct competitor exists.**

| Category | Who's there | Why they're NOT us |
|---|---|---|
| XRPL explorers | XRPScan, Bithomp | Raw on-chain data only. Nobody catalogues fiat corridors. |
| Ripple's own tools | Liquidity Hub | Partner-only, closed. Not public. |
| Stablecoin dashboards | Artemis, DefiLlama | RLUSD supply only. Zero routing data. |
| Blockchain forensics | Chainalysis, Elliptic | KYT / sanctions focus. Not corridor health. |
| Cross-chain aggregators | LI.FI, Jumper | XRPL not integrated. Fiat is onramp-only. |
| Closest adjacent | Utility Scan | Historical ODL volume leaderboard. No classification, no agent. |

## The Impact Case

| Metric | Value |
|---|---|
| Global remittances annually | $800B+ |
| Average fee (World Bank Q1 2025) | **6.49%** |
| Total fees paid globally per year | **~$52B** — almost entirely by poor people |
| UN SDG target by 2030 | 3% |
| Ripple ODL volume in 2024 | $15B+ (32% YoY growth) |
| Active ODL corridor pairs | 70+ |
| Countries covered | 55+ |
| RLUSD market cap (Q1 2026) | $1B+ |

XRPLens doesn't send remittances. It makes the rails trustworthy enough for institutional liquidity to stay in the pool. Thinner pool = wider spread = higher fee for the person at the bottom.

## Track record

Third iteration of the same engine. **SuiLens** — 3rd at Sui hackathon. **BaseLens** — 1st at MBC 2025. **XRPLens** — for the ledger the world's payment infrastructure runs on.

## The product flow in one sentence

**Browse corridors (atlas) → Route money through them (Safe Path Agent) → Prove the tools are real (Entity Audit).**

---

# PARTIE 2 : QUALITÉS PRINCIPALES

## 1. AI Agent — Safe Path Finding

C'est le cœur du produit. Le Safe Path Agent est un **agent IA tool-using** qui ne se contente pas de chercher dans une base — il **lance de vraies analyses, fait de la recherche web, crawle des comptes XRPL, et utilise les RAG chats** de Corridor et d'Entity Audit.

### Ce que l'agent fait réellement (dans l'ordre) :

**Phase 1 — Résolution du corridor.** L'agent cherche la paire de devises dans le catalogue statique (2 436 corridors). Il récupère la catégorie (on-chain / hybrid / off-chain-bridge), le bridge asset, et les acteurs des deux côtés.

**Phase 1.5 — Query du Corridor RAG Chat.** L'agent **appelle le chat RAG du corridor** avec la question : "Best routes? Most reliable actors? Known issues?" Les réponses sont grounded dans les données du catalogue via retrieval-augmented generation.

**Phase 2 — Planification IA.** GPT-4o-mini génère un plan d'investigation de 4-5 phrases basé sur le contexte du corridor, les acteurs, et les findings du RAG. Ce plan est émis comme événement "reasoning" dans le stream SSE.

**Phase 3 — Recherche parallèle sur les acteurs.** L'agent lance en parallèle :
- **Web research** sur les top 3 source actors + top 3 dest actors (réputation, licences, incidents — via GPT-4o-mini qui utilise ses connaissances)
- **Fetch de la profondeur partenaire** (appel live à l'API publique Bitso pour USD↔MXN : bid/ask, spread en bps, profondeur en XRP)

**Phase 4 — Deep Entity Analysis.** L'agent **lance de vraies analyses Entity Audit** (depth-2 BFS) sur les comptes critiques :
- L'issuer RLUSD (toujours)
- Tous les issuers source (si corridor on-chain)
- Tous les issuers dest (si corridor on-chain)
- L'issuer USDC (pour corridors off-chain)

Pour chaque analyse lancée, l'agent **attend qu'elle soit terminée** (polling avec timeout 45s), puis **indexe les résultats pour le RAG**, puis **query le RAG de cette analyse** : "Give me 3-5 bullets about risk flags, concentration, and governance."

**Phase 5 — Analyse des adresses d'acteurs.** Pour les top acteurs, l'agent :
- Cherche leur adresse XRPL dans un registre hardcodé (Bitstamp, Kraken, Binance, GateHub, Sologenic)
- Si pas dans le registre → **demande à GPT-4o-mini** de trouver l'adresse XRPL
- Lance un `deepAnalyze()` (depth-2) sur chaque adresse trouvée

**Phase 6 — Analyse des chemins on-chain.** Pour les corridors XRPL-native, l'agent analyse les chemins via `path_find`, filtre par tolérance au risque, et construit un split plan si le montant dépasse $50k avec plusieurs chemins disponibles.

**Output final :** verdict (SAFE / REJECTED / NO_PATHS / OFF_CHAIN_ROUTED), chemin gagnant, risk score, chemins rejetés avec raisons, split plan, rapport markdown complet, et **liste de tous les analysis IDs spawned** (pour que l'utilisateur puisse aller les consulter dans Entity Audit).

### L'agent utilise les RAG chats de Corridor ET d'Analyze

C'est un point clé : le Safe Path Agent **n'est pas isolé**. Il consomme les deux autres produits :
- Il query le **Corridor RAG chat** pour avoir de l'intel sur le corridor
- Il **lance des Entity Audit analyses** et query leur **RAG chat** pour des résumés de risque
- Il utilise les résultats de ces analyses pour justifier ses décisions

C'est un vrai agent orchestrateur qui utilise tout l'écosystème XRPLens.

## 2. Corridor Atlas + Corridor RAG Chat

Chaque corridor a sa propre page détaillée avec un **chat RAG dédié**. L'utilisateur peut poser des questions en langage naturel sur n'importe quel corridor : "Quels sont les acteurs ODL sur ce corridor ?", "Y a-t-il des risques de concentration ?", "Quel est le meilleur chemin pour ce montant ?"

Le RAG est grounded dans les données du catalogue : acteurs, status, highlights, notes IA, historique. Pas d'hallucination — tout est ancré dans les données réelles.

Le Corridor RAG chat est aussi **utilisé par le Safe Path Agent** comme source d'intelligence en Phase 1.5.

## 3. Entity Audit + Analyze RAG Chat

Chaque analyse Entity Audit génère un knowledge graph complet. Ce graph est **indexé pour le RAG** (embeddings OpenAI text-embedding-3-small stockés dans pgvector). L'utilisateur peut ensuite poser des questions sur ce graph spécifique via le chat RAG :
- "What are the highest-risk counterparties?"
- "Which AMM pools have the most concentrated liquidity?"
- "Are there any RLUSD impersonator tokens?"
- "What compliance actions should I take before routing capital?"

Les réponses sont générées par GPT-4o-mini avec le contexte complet du graph (tous les nœuds non-account + top 150 accounts + top 400 edges + tous les risk flags).

Le Analyze RAG chat est aussi **utilisé par le Safe Path Agent** en Phase 4 pour obtenir des résumés de risque sur les comptes crawlés.

## 4. Wallet Integration — Crossmark + Paiements RLUSD/XRP

XRPLens intègre **Crossmark** comme wallet browser pour XRPL. Les utilisateurs peuvent connecter leur wallet Crossmark directement sur le site.

**Paiements acceptés :** XRPLens accepte **RLUSD et XRP** comme moyens de paiement pour les features premium. Le paiement se fait directement on-chain via Crossmark — l'utilisateur signe la transaction dans son wallet, et XRPLens vérifie la transaction sur le ledger.

## 5. GateHub DEX Depth — On-Ledger Orderbook Measurement

XRPLens mesure la profondeur réelle des orderbooks GateHub **directement sur le ledger XRPL** via la commande `book_offers`. Pas d'API tierce — les données viennent du DEX on-chain.

**Paires supportées :**
- EUR/XRP, USD/XRP, GBP/XRP (fiat IOU vs XRP natif)
- EUR/USD, USD/GBP (cross-IOU direct)

**Adresses GateHub utilisées :**
- `rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq` — issuer principal (EUR, USD, BTC, ETH, USDT, USDC)
- `r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g` — issuer GBP dédié

**Ce que ça mesure :** bid/ask count, top bid/ask price, spread en basis points, profondeur cumulative en devise de base. Cache 60s. Même format `PartnerDepthSnapshot` que Bitso.

**Pourquoi c'est important :** GateHub a **$4.84M USD** et **2.18M EUR** en obligations on-chain. Les orderbooks sont actifs avec 20k-73k de depth. C'est la preuve que les corridors XRPL-native ont de la liquidité réelle, mesurée, pas supposée.

## 6. MCP Server — Claude Integration

XRPLens expose un **serveur MCP** (Model Context Protocol) qui permet à Claude (Claude Code, Claude Desktop) d'interagir directement avec l'API XRPLens.

**7 outils MCP :**
1. `list_corridors` — Browse et filtre les 2 436 corridors
2. `get_corridor` — Détail complet d'un corridor
3. `get_corridor_history` — Timeline 30 jours
4. `ask_corridor` — RAG Q&A sur les données corridor
5. `analyze_address` — Lance un Entity Audit sur une adresse XRPL
6. `ask_analysis` — RAG Q&A sur les résultats d'audit
7. `get_partner_depth` — Profondeur live DEX/exchange

**Architecture :** Le serveur MCP tourne localement sur la machine de l'utilisateur, communique avec Claude via stdio. Il traduit les appels d'outils en requêtes HTTP vers l'API REST XRPLens, authentifiées par l'API key de l'utilisateur (JWT Premium).

**Configuration :** L'utilisateur ajoute le serveur dans `claude_desktop_config.json` ou `.claude/settings.json` avec son `XRPLENS_API_KEY`.

---

# PARTIE 3 : ARCHITECTURE TECHNIQUE DÉTAILLÉE

## Infrastructure — QuickNode

XRPLens utilise des **endpoints RPC dédiés QuickNode** pour se connecter au XRPL :

- **Mainnet (production) :** `wss://maximum-clean-putty.xrp-mainnet.quiknode.pro/...` — endpoint WebSocket dédié
- **Testnet (dev) :** `wss://capable-greatest-wave.xrp-testnet.quiknode.pro/...` — endpoint WebSocket dédié
- **Rate limiting :** 50 req/sec (intervalle minimum 20ms entre requêtes)
- **Fallback :** Si QuickNode est down → xrplcluster.com → s1.ripple.com → s2.ripple.com
- **Retry logic :** 3 tentatives par endpoint avec backoff exponentiel
- **Client :** `xrpl` SDK v4.1.0 (bibliothèque officielle XRPL pour Node.js)

QuickNode est utilisé pour **toutes les interactions avec le ledger XRPL** : path_find, account_info, account_objects, account_lines, book_offers, etc.

## Stack technique complète

| Composant | Technologie | Version | Usage |
|-----------|-----------|---------|-------|
| **Runtime** | Node.js | - | Serveur backend |
| **Framework HTTP** | Express.js | 4.21.0 | API REST + SSE streaming |
| **Frontend** | React + TypeScript | - | Application web SPA |
| **Build** | Vite | - | Bundler frontend |
| **CSS** | Tailwind CSS | - | Styling utility-first |
| **Graph UI** | ReactFlow | - | Visualisation interactive nœuds/liens |
| **3D Globe** | Canvas API custom | - | Globe interactif landing page |
| **ORM** | Prisma | 6.1.0 | Accès base de données typé |
| **Database** | PostgreSQL | - | Stockage principal (analyses, graphs, chats, corridors) |
| **Vector DB** | pgvector (extension PG) | - | Embeddings 1536-dim pour RAG |
| **Queue** | BullMQ | 5.30.0 | File d'attente de jobs asynchrones |
| **Cache/Queue backend** | Redis + ioredis | 5.4.0 | Backend pour BullMQ |
| **LLM (chat/reasoning)** | OpenAI GPT-4o-mini | SDK 4.70.0 | Chat RAG, compliance, explications, planning agent |
| **Embeddings** | OpenAI text-embedding-3-small | SDK 4.70.0 | Indexation RAG (1536 dimensions) |
| **XRPL Client** | xrpl SDK | 4.1.0 | Communication WebSocket avec le ledger |
| **RPC Provider** | QuickNode | Dédié | Endpoints mainnet + testnet |
| **Validation** | Zod | 3.23.0 | Validation de schémas config + API |
| **Logging** | Winston | 3.17.0 | Logs structurés |
| **Wallet** | Crossmark | - | Connexion wallet browser XRPL |
| **Paiements** | RLUSD + XRP on-chain | - | Paiements via Crossmark |
| **Monorepo** | Turborepo | - | Gestion du monorepo (apps/server, apps/web, packages/core) |

## PostgreSQL — Schéma de base de données

ORM Prisma avec extension pgvector activée. Tables principales :

**analyses** — Métadonnées d'analyse
- `id` (UUID), `seedAddress`, `seedLabel`, `depth` (1-3), `status` (queued/running/done/error)
- `summaryJson` (stats BFS, résumé risques, métadonnées crawl)
- Index composite : `(seedAddress, depth, status)` pour lookup rapide de cache

**nodes** — Nœuds du knowledge graph
- `id` (UUID), `analysisId` (FK), `nodeId` (ID graph), `kind` (NodeKind), `label`, `data` (JSON)
- `aiExplanation` (texte généré par IA, nullable)
- Métadonnées BFS stockées dans `data._meta` (profondeur, hub count, hubs crawlés)
- Contrainte unique : `(analysisId, nodeId)`

**edges** — Liens du knowledge graph
- `id`, `analysisId` (FK), `edgeId`, `source`, `target`, `kind` (EdgeKind), `label`, `data`

**riskFlags** — Flags de risque par nœud
- `id`, `analysisId` (FK), `nodeId`, `flag` (type), `severity` (HIGH/MED/LOW), `detail`, `data`

**ragDocuments** — Documents vectorisés pour RAG (Entity Audit)
- `id`, `analysisId` (FK), `content` (texte), `metadata` (JSON)
- `embedding` — **vector(1536)** via pgvector — embedding OpenAI text-embedding-3-small
- Insertion via SQL brut pour le cast pgvector : `INSERT ... ${embeddingStr}::vector`

**corridorRagDocuments** — Documents vectorisés pour RAG (Corridors)
- Même structure que ragDocuments mais liée aux corridors
- `embedding` — **vector(1536)** via pgvector

**ragChats + ragMessages** — Historique des conversations RAG
- `ragChats` : `id`, `analysisId` (FK), `createdAt`
- `ragMessages` : `id`, `chatId` (FK), `role` (user/assistant), `content`, `sources` (JSON)

**corridors** — État des corridors (rafraîchi toutes les heures)
- `id` (slug : "usd-mxn"), `status` (GREEN/AMBER/RED/UNKNOWN)
- `aiNote` (description générée par IA), `liquidityHash` (invalidation cache)
- `routesJson`, `analysisJson`, `liquidityJson` (résultats complets des scans)

**corridorStatusEvents** — Log append-only d'historique de status
- Enregistre chaque changement de status pour la sparkline 30 jours
- Ne déduplique PAS les événements consécutifs de même status (préserve la cadence)

**complianceReports** — Rapports de conformité générés
- `id`, `analysisId` (FK), `title`, `content` (JSON = ComplianceReportData complet)

## BullMQ — Système de queues

### Queue `analysis` — Analyses Entity Audit
- **Concurrency :** 1 (un seul worker traite à la fois)
- **Retry :** 2 tentatives avec backoff exponentiel (délai initial 2000ms)
- **Rétention completed :** 24h, max 100 jobs
- **Rétention failed :** 7 jours
- **Job data :** `{ analysisId: UUID, seedAddress: string, seedLabel?: string, depth: 1|2|3 }`

**Flow d'un job analysis :**
1. `POST /api/analysis` crée un record Analysis (status = "queued")
2. Job enqueued dans BullMQ
3. Worker prend le job → status = "running"
4. BFS crawl sur XRPL (depth 1/2/3) via QuickNode
5. Nœuds/liens/risk flags stockés dans PostgreSQL
6. Status = "done"
7. RAG indexing lancé en background (embeddings OpenAI → pgvector)
8. Explications IA générées en background (GPT-4o-mini par nœud)

### Queue `corridor-refresh` — Rafraîchissement des corridors
- **Cron :** `"0 * * * *"` (toutes les heures)
- **Concurrency :** 1
- **Retry :** 2 tentatives avec backoff exponentiel (5000ms)
- **Rétention completed :** 24h, max 48 jobs
- **Rétention failed :** 7 jours

**Flow du refresh :**
1. Job cron déclenché toutes les heures
2. Pour chaque corridor XRPL-native (42 corridors) :
   - Lance `path_find` via QuickNode contre le mainnet
   - Mesure profondeur orderbook, nombre de chemins, coût en XRP
   - Enregistre CorridorStatusEvent si changement de status
   - Met à jour le record corridor dans PostgreSQL
3. Pour les corridors off-chain-bridge : classification déterministe (pas de scan)
4. Optionnel : régénération des notes IA si `forceAiNote: true`

## Redis — Usage

Redis est utilisé **exclusivement comme backend pour BullMQ** :
- Stockage des jobs (pending, active, completed, failed)
- État des workers
- Données de completion et métadonnées
- Connexion via `ioredis` v5.4.0 avec `maxRetriesPerRequest: null` (requis par BullMQ)
- URL par défaut : `redis://localhost:6379` (configurable via `REDIS_URL`)

Pas de caching applicatif dans Redis. Pas de PubSub. Redis = pure queue backend.

## pgvector — Embeddings et RAG

### Stockage des embeddings
- Extension PostgreSQL pgvector activée dans le schéma Prisma
- Colonnes `embedding` de type `vector(1536)` sur les tables `ragDocuments` et `corridorRagDocuments`
- Embeddings générés par **OpenAI text-embedding-3-small** (1536 dimensions)

### Indexation RAG (Entity Audit)
Après chaque analyse terminée, la fonction `indexAnalysisForRag()` :
1. Récupère tous les nœuds + risk flags de l'analyse
2. Crée des documents texte :
   - Nœuds : `[${kind}] ${label}: ${data}\n\nAI Analysis: ${aiExplanation}`
   - Flags : `[${severity}] ${flag}: ${detail}`
3. Génère les embeddings par batch de 20 (un seul appel OpenAI par batch)
4. Insère dans PostgreSQL via SQL brut avec cast `::vector`

### Chat RAG (Entity Audit)
Quand un utilisateur pose une question sur `/chat/:analysisId` :
1. Récupère le contexte complet de l'analyse :
   - TOUS les nœuds non-account (issuer, token, ammPool, etc.)
   - Top 150 nœuds account
   - Top 400 edges
   - TOUS les risk flags
2. Construit un string de contexte avec métadonnées BFS
3. Récupère l'historique chat (10 derniers messages)
4. Appelle GPT-4o-mini avec : system prompt (expert XRPL analyst) + contexte complet + historique + question

### Chat RAG (Corridors)
Même approche mais grounded dans les données du catalogue de corridors (acteurs, status, highlights).

**Note :** Les embeddings sont stockés via pgvector mais la recherche par similarité vectorielle n'est pas encore utilisée pour le retrieval. Le RAG actuel fonctionne par **context stuffing** (tout le contexte pertinent est injecté dans le prompt). La recherche vectorielle est prête pour une future version.

## OpenAI — Utilisation détaillée de l'IA

Toute l'IA passe par **OpenAI** exclusivement. Pas d'autre provider LLM.

### Modèles utilisés

| Modèle | Usage | Temperature | Max tokens |
|--------|-------|-------------|------------|
| **gpt-4o-mini** | Chat RAG (analyse) | 0.3 | 2000 |
| **gpt-4o-mini** | Chat RAG (corridors) | 0.3 | 2000 |
| **gpt-4o-mini** | Explications par nœud | 0.3 | - |
| **gpt-4o-mini** | Rapports de conformité | 0.3 | 1000 |
| **gpt-4o-mini** | Notes IA corridor | 0.3 | - |
| **gpt-4o-mini** | Safe Path Agent (planning) | 0.2 | - |
| **gpt-4o-mini** | Safe Path Agent (web research) | 0 | - |
| **gpt-4o-mini** | Safe Path Agent (address lookup) | 0 | - |
| **text-embedding-3-small** | Embeddings RAG | - | - |

Temperature basse partout (0 à 0.3) — le produit privilégie la factualité et la déterminisme.

### Où l'IA est utilisée concrètement

1. **Chat avec une analyse** (`/chat/:analysisId`) — L'utilisateur pose des questions sur le graph d'une analyse. GPT-4o-mini répond avec le contexte complet du graph injecté dans le prompt.

2. **Chat avec un corridor** (`/corridors/:id` chat) — Questions sur un corridor spécifique. Réponses grounded dans les données du catalogue.

3. **Explications par nœud** — Après un crawl, GPT-4o-mini génère une explication compliance pour chaque nœud du graph (issuer, token, AMM pool, etc.).

4. **Rapports de conformité** — GPT-4o-mini génère un rapport structuré (résumé, évaluation risques, breakdown entités, concentration, recommandations) à partir des données de l'analyse.

5. **Notes IA corridor** — Commentaire de 130-200 mots sur chaque corridor (status, acteurs, viabilité). Généré une fois, caché pour réutilisation.

6. **Safe Path Agent — Planning** — GPT-4o-mini génère le plan d'investigation de l'agent basé sur le contexte corridor + acteurs + findings RAG.

7. **Safe Path Agent — Web research** — GPT-4o-mini simule une recherche web sur les acteurs (réputation, licence, incidents). Utilise les connaissances du modèle, pas un vrai moteur de recherche.

8. **Safe Path Agent — Address lookup** — Quand un acteur n'est pas dans le registre hardcodé, GPT-4o-mini est interrogé : "What is ${actor.name}'s XRPL r-address?"

9. **Embeddings RAG** — text-embedding-3-small génère les vecteurs 1536-dim pour l'indexation des documents dans pgvector.

**Graceful degradation :** Si `OPENAI_API_KEY` n'est pas configuré, le système continue de fonctionner sans IA. Les features IA (chat, explications, rapports, agent planning) sont désactivées mais le crawl, le graph, et le catalogue fonctionnent.

## Wallet & Paiements — Crossmark + RLUSD/XRP

### Crossmark Integration
- **Crossmark** est un wallet browser pour XRPL (extension Chrome/Firefox)
- Les utilisateurs connectent leur wallet Crossmark directement sur le site
- L'intégration permet de signer des transactions XRPL depuis le navigateur

### Paiements acceptés
- **RLUSD** — Stablecoin Ripple sur XRPL (issuer : `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`)
- **XRP** — Token natif du XRPL
- Le paiement se fait on-chain : l'utilisateur signe via Crossmark, XRPLens vérifie la transaction sur le ledger

---

# PARTIE 4 : PRODUITS DÉTAILLÉS

## Produit 1 : Corridor Atlas

### Concept
Catalogue classifié de 2 436 corridors fiat-pair. Trois types de settlement : XRPL-native (42), Hybrid/Legacy (variable), Off-chain bridge (2 322).

### Données par corridor
- Source / destination (devise, type fiat/stable, drapeau emoji, label)
- Catégorie : `off-chain-bridge` | `xrpl-native` | `hybrid`
- Région : GCC, LATAM, APAC, Europe, Americas, MEA, Africa
- Tier de liquidité : T1 (flagship) à T4 (emerging)
- Status : GREEN / AMBER / RED / UNKNOWN
- Routes candidates (par paire d'issuers pour on-chain, bridge RLUSD pour off-chain)
- Acteurs source/dest : partenaires réels avec flags `odl`, `supportsRlusd`, `supportsXrp`, type (cex/bank/mobile-money/hub), nom, URL
- Note IA : commentaire 130-200 mots sur le corridor
- Highlights : faits clés ("2 ODL partners", "16 confirmed RLUSD venues")
- Snapshot liquidité : profondeur orderbook, bid/ask, spread (corridors on-chain)
- `lastRefreshedAt` : timestamp du dernier scan

### Pages

**/corridors** — Globe 3D interactif (Canvas API custom) avec 220 arcs colorés par status. Clic sur un label de devise → panneau droit listant tous les corridors de cette devise. Clic sur un chip corridor → page détaillée. Filtrage en temps réel par région, devise, status.

**/corridors/:id** — Page détaillée :
- Bannière status colorée (amber/sky/emerald) par type de corridor
- **Table de comparaison de routes** (on-chain only) : une ligne par paire d'issuers, colonnes path count / bid / ask / spread / coût / risk score. Bordure bleue = XRPL DEFAULT (cheapest), bordure verte = XRPLENS RECOMMENDED (meilleur ratio risque/coût).
- **Graph d'acteurs partenaires** (ReactFlow 5 colonnes) : source currency ← source actors ← RLUSD bridge ← dest actors → dest currency. Nœuds colorés par type d'acteur. Légende 15 entrées.
- **Registre d'acteurs** : source-side (top 15) + dest-side (top 3), chacun avec badges ODL/RLUSD/XRP
- **Sparkline 30 jours** : timeline GREEN/AMBER/RED avec timestamps
- **Badge profondeur live** (USD↔MXN) : orderbook Bitso temps réel, top bid/ask, spread en bps, profondeur en XRP, point vert pulsant "Live · Measured, not assumed", refresh 60s
- **Chat RAG corridor** : bulle de chat pour poser des questions sur ce corridor spécifique

**/route?from=USD&to=MXN&amount=1000** — Calculateur instantané : verdict card GREEN/AMBER/RED, top 3 ramps source + dest, narrative one-line du flow, estimation du montant délivré. URL partageable.

### API Corridor
- `GET /api/corridors` — Liste des 2 436 corridors avec status caché
- `GET /api/corridors/:id` — Corridor complet (routes, acteurs, analyse)
- `GET /api/corridors/:id/history` — Timeline 30j (fenêtres jusqu'à 90j)
- `GET /api/corridors/:id/partner-depth` — Snapshot live Bitso (USD↔MXN)
- `POST /api/corridors/refresh/:id` — Force un re-scan
- `POST /api/corridors/:id/chat` — RAG Q&A sur un corridor

## Produit 2 : Safe Path Agent

### Concept
Agent IA tool-using qui répond : "Pour ce paiement spécifique, quel est le chemin XRPL le plus sûr maintenant, et pourquoi ?" Contrairement à `/route` (lookup instantané pré-calculé), le Safe Path Agent itère en temps réel avec des outils live.

### Les 6+ outils techniques de l'agent

**1. webSearch(query)** — Recherche sur un acteur (réputation, licence, incidents). Utilise GPT-4o-mini avec ses connaissances (pas un vrai moteur de recherche). Retourne 3-5 bullet points.

**2. deepAnalyze(address, label)** — Lance une **vraie analyse Entity Audit** depth-2 BFS. Crée un job dans BullMQ, attend la completion (polling 45s timeout), déclenche l'indexation RAG, puis query le RAG pour un résumé. Vérifie d'abord le cache (analyse existante depth≥2).

**3. crawlAccount(address, reason)** — Audit inline léger d'un compte. Vérifie les flags on-chain (GLOBAL_FREEZE +50, CLAWBACK_ENABLED +30, DEPOSIT_RESTRICTED +5, etc.). Résout le nom via l'API publique XRPScan (timeout 5s). Cache les résultats par session.

**4. findAndAnalyzeActorAddress(actor)** — Lookup registre hardcodé (Bitstamp, Kraken, Binance, GateHub, Sologenic) → sinon fallback GPT-4o-mini pour deviner l'adresse XRPL. Puis lance `deepAnalyze()`.

**5. fetchPartnerDepth(corridorId, actor)** — Appel live API publique Bitso : `GET /api/v3/order_book/?book=xrp_mxn&aggregate=true`. Retourne bid/ask counts, spread bps, profondeur cumulative, TTL 60s. Actuellement uniquement Bitso XRP→MXN.

**6. analyzeCorridors(request)** — Analyse des chemins de paiement on-chain via XRPL `path_find`. Retourne path score, hops, risk flags par route.

### Stream SSE (Server-Sent Events)

L'agent émet des événements en temps réel :
- `{ type: "step", step: "…", detail: "…" }` — progression narrative
- `{ type: "tool_call", name: "…", args: {…} }` — invocation d'outil
- `{ type: "tool_result", name: "…", summary: "…" }` — résultat d'outil
- `{ type: "corridor_context", corridor: {…} }` — contexte corridor résolu
- `{ type: "reasoning", content: "…" }` — plan de l'agent (GPT-4o-mini)
- `{ type: "account_crawled", address: "…", name: "…", flags: […], score: 15 }` — résultat audit
- `{ type: "analysis_spawned", analysisId: "…", address: "…" }` — analyse lancée
- `{ type: "split_plan", legs: […] }` — plan de split routing
- `{ type: "result", result: SafePathResult }` — verdict final

### Moteur de risque
Flags **HIGH** (rejet automatique) : CLAWBACK_ENABLED, GLOBAL_FREEZE, DEEP_FROZEN_TRUST_LINE (XLS-77), AMM_CLAWBACK_EXPOSURE (XLS-73)

Flags **MED/LOW** (pondérés, pas de rejet) : NO_MULTISIG, UNVERIFIED_ISSUER, CONCENTRATED_LIQUIDITY, HIGH_TRANSFER_FEE, RLUSD_IMPERSONATOR, etc.

### API
- `POST /api/safe-path` — SSE streaming endpoint. Input : `{ srcCcy, dstCcy, amount, maxRiskTolerance? }`. Output : stream SSE d'événements.

## Produit 3 : Entity Audit

### Modèle de graph

**18 types de nœuds :** issuer, token, ammPool, orderBook, account, escrow, check, payChannel, nft, nftOffer, signerList, did, credential, mpToken, oracle, depositPreauth, offer, permissionedDomain, ticket, bridge, vault

**19 types de liens :** ISSUED_BY, TRUSTS, PROVIDES_LIQUIDITY, TRADES_ON, ROUTES_THROUGH, ESCROWS_TO, GOVERNS, POOLS_WITH, CHECKS_TO, CHANNELS_TO, OWNS_NFT, NFT_OFFER_FOR, SIGNED_BY, HAS_DID, HAS_CREDENTIAL, HAS_OFFER, ISSUED_MPT, PROVIDES_ORACLE, PREAUTHORIZES

### 17+ détecteurs de risque automatisés

**HIGH :** CLAWBACK_ENABLED, GLOBAL_FREEZE, DEEP_FROZEN_TRUST_LINE, BLACKHOLED_ACCOUNT

**MEDIUM :** NO_MULTISIG, UNVERIFIED_ISSUER, CONCENTRATED_LIQUIDITY, SINGLE_GATEWAY_DEPENDENCY, AMM_CLAWBACK_EXPOSURE, HIGH_TRANSFER_FEE, RLUSD_IMPERSONATOR, ACTIVE_CHECKS, HIGH_TX_VELOCITY

**LOW :** LOW_DEPTH_ORDERBOOK, THIN_AMM_POOL, STALE_OFFER, DEPOSIT_RESTRICTED, NO_REGULAR_KEY, NORIPPLE_MISCONFIGURED, PERMISSIONED_DOMAIN_DEPENDENCY

### Modes de crawl (BFS)
- **Depth 1 (quick)** — Seed address uniquement, 1-2 secondes
- **Depth 2 (deep)** — Seed + tous les voisins lourds (gateways, issuers, holders majeurs), 30-120 secondes
- **Depth 3 (very deep)** — Deux hops de multi-BFS, 5+ minutes, audit institutionnel complet

### Pages

**/analyze** — Formulaire : adresse XRPL + label optionnel + sélecteur de profondeur (1/2/3). Presets rapides : RLUSD Issuer, Bitstamp, Sologenic, Binance, DIA Oracle, AMM pools. Analyses preset cachées = retour instantané.

**/graph/:analysisId** — Visualisation ReactFlow interactive :
- 18 types de nœuds avec couleurs et formes uniques, arrangement en anneaux concentriques
- Clic sur nœud → sidebar : kind, label, adresse, flags de risque avec severity badge, explication IA, données JSON brutes
- Zoom, pan, minimap, légende avec filtres toggle
- Stats bar : node count, edge count, badges HIGH/MED/LOW
- Boutons : "AI Chat"
- Les analyses sont liées au compte utilisateur (userId) et visibles dans l'historique du profil

**/chat/:analysisId** — Chat RAG grounded dans le graph. Suggestions intégrées. Historique de conversation persisté. Réponses ancrées dans les données réelles (nœuds + edges + risk flags).

**Note :** La compliance report n'est plus une page standalone pour Entity Audit — elle est maintenant intégrée exclusivement dans le Safe Path Agent, qui génère un rapport markdown complet avec toutes les preuves.

### API Entity Audit
- `POST /api/analysis` — Lancer une analyse : `{ seedAddress, seedLabel?, depth }` (lie automatiquement au userId si authentifié)
- `GET /api/analysis/:id` — Statut : `{ status, nodeCount?, edgeCount? }`
- `GET /api/analysis/:id/graph` — Graph complet : `{ nodes, edges, stats }`
- `POST /api/chat` — Message RAG : `{ analysisId, message, chatId? }`
- `GET /api/chat/:chatId` — Historique chat

---

# PARTIE 5 : PAGES ADDITIONNELLES

**/account** — Page profil utilisateur avec 4 onglets :
- **Profile** : adresse wallet, date d'inscription, status premium, détails subscription (txHash lié à l'explorateur XRPL), bouton déconnexion
- **Safe Path** : historique de tous les runs Safe Path (sauvegardés en DB), clic pour voir les détails ou re-ouvrir la page complète avec données chargées. Bannière live quand un run est en cours (le SSE persiste même en changeant de page via un store global)
- **Entity Audits** : historique de toutes les analyses liées au compte, clic pour ouvrir le graph (done) ou reprendre le polling (running/queued)
- **Account History** : l'explorateur de transactions XRPL (anciennement `/history`) est maintenant embarqué directement dans cet onglet

**/developers** — Documentation complète avec 3 onglets (navigation par `?tab=`) :
- **MCP Server** (onglet par défaut) : instructions de setup pour Claude Code/Claude Desktop, liste des 7 outils MCP, exemples de prompts, explication de l'architecture stdio
- **REST API** : documentation complète des endpoints avec exemples cURL, schémas de réponse inline, organisée par produit (Corridor Atlas, Safe Path Agent, Entity Audit)
- **Roadmap** : features live (GateHub DEX, MCP Server, XLS-80, XLS-81), en voting (XLS-66), et prochaines étapes (multi-actor depth, better pathfinding, corridor volume history)

**/ (Landing page SaaS)** :
- Hero : "The missing map for XRPL cross-border payments"
- Stats : 2 436 corridors, 48 devises, ~200 acteurs, 100% off-chain GREEN
- 3 cartes produit cliquables (Corridor Atlas, Safe Path Agent, Entity Audit)
- Explainer des 3 types de corridors
- Deep-dive Safe Path Agent : schéma radial avec l'agent au centre et ses 7 outils autour (Corridor RAG, Deep Analyze, Analysis RAG, Web Research, Crawl Accounts, Partner Depth, Compliance Report)
- Showcase des 17+ risk flags
- 2 surfaces AI chat (corridor RAG + entity audit RAG)
- Grille specs techniques
- Table positionnement compétitif
- CTA footer

### Nouvelles API (ajoutées récemment)
- `GET /api/auth/profile` — Données complètes du profil (user + subscriptions + analyses)
- `GET /api/safe-path/history` — Liste des runs SafePath de l'utilisateur
- `GET /api/safe-path/:id` — Détail complet d'un run SafePath (resultJson, reportMarkdown, etc.)

### Persistance des runs SafePath
Les résultats de chaque run Safe Path sont sauvegardés en base (table `SafePathRun`) : verdict, reasoning, resultJson complet, rapport markdown, analysisIds liés. Cela permet de retrouver l'historique dans le profil et de recharger les résultats visuels.

### Dockerisation
Le projet est entièrement dockerisé :
- **Dockerfile multi-stage** : deps → build → server (Node.js) + web (nginx)
- **docker-compose.yml** : PostgreSQL (pgvector), Redis, server, web
- **Seed data** : le dump actuel de la DB est inclus comme seed pour les déploiements frais (corridors, analyses pré-calculées, status events 30 jours)
- Nginx reverse-proxy avec support SSE pour le streaming de l'agent

---

# PARTIE 6 : CHIFFRES & POSITIONNEMENT

## Chiffres clés

- **2 436** corridors fiat-pair classifiés
- **48** devises couvertes
- **~200** acteurs réels documentés (CEX, banques, ODL partners, mobile-money)
- **18** types de nœuds dans le knowledge graph
- **19** types de liens
- **17+** détecteurs de risque automatisés
- **8** paires GateHub DEX avec profondeur live on-ledger (EUR/XRP, USD/XRP, GBP/XRP, EUR/USD, USD/GBP, etc.)
- **7** outils live pour le Safe Path Agent (Corridor RAG, Deep Analyze, Analysis RAG, Web Research, Crawl Accounts, Partner Depth, Compliance Report)
- **7** outils MCP pour Claude (list_corridors, get_corridor, get_corridor_history, ask_corridor, analyze_address, ask_analysis, get_partner_depth)
- **7** amendements XLS trackés (XLS-30 AMM, XLS-39 Clawback, XLS-73, XLS-77, XLS-80, XLS-81, XLS-85)
- **6** endpoints API publics
- **3** types de corridors (XRPL-native, hybrid, off-chain-bridge)
- **3** profondeurs de crawl (quick, deep, very deep)
- **2** surfaces RAG chat (corridor + entity audit)
- **2** moyens de paiement acceptés (RLUSD + XRP via Crossmark)
- **1** serveur MCP pour intégration Claude

## Utilisateurs cibles

- **Institutions** — FX desks, PSPs, corporates nécessitant un routing corridor grade compliance
- **Développeurs** — Construisant des intégrations XRPL
- **Fintechs** — Plateformes de remittance digitale
- **Régulateurs** — Comprendre l'écosystème RLUSD

## Résumé en une phrase

XRPLens est l'infrastructure manquante pour les paiements cross-border XRPL : un catalogue de 2 436 corridors avec RAG chat, un agent IA qui lance de vraies analyses et utilise les RAG chats pour router le capital en sécurité, un outil d'audit on-chain avec knowledge graph, de la profondeur DEX live via GateHub `book_offers`, et un serveur MCP pour que Claude puisse interroger l'ensemble — le tout connecté à QuickNode, powered by OpenAI, avec paiements RLUSD/XRP via Crossmark.
