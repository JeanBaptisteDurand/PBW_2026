# XRPLens — Roadmap

> Companion to [PITCH.md](../../PITCH.md), [xrpl-fiat-actors.md](./xrpl-fiat-actors.md),
> and [actor-upgrade-spec.md](./actor-upgrade-spec.md).
>
> **Rule of thumb:** the product roadmap is paced by the XRPL validator
> vote. Every major XLS-\* amendment that matters to cross-border
> payments is a beat on our timeline — the day it activates, XRPLens
> classifies it automatically. We build on the spec, not on the headlines.

---

## Now (shipped in the hackathon build)

### Corridor Atlas — v1 ✅
- 2,436 corridors across 48 currencies, 3 kinds (XRPL-native / hybrid-legacy / off-chain-bridge)
- ~200 real-world actors in the research registry with ODL/RLUSD/XRP flags and source URLs
- Live XRPL `path_find` + liquidity scan on 42 on-chain fiat corridors every hour
- Actor-quality classifier for off-chain-bridge corridors: **100% GREEN** on 2,322 lanes
- AI commentary per corridor (OpenAI for top tier, deterministic fallback otherwise)
- Globe visualisation with 220 arcs + right-side selection panel
- Real-world partner graph (5-column ReactFlow with node/edge legend)
- Three-kind banner system eliminates incoherence on hybrid corridors

### Decision tools — v1 ✅
- **`/route?from=X&to=Y&amount=Z`** — single-page decision UX that ranks the top 3 source + 3 destination partners and renders a one-line payment narrative
- **Delivered-amount quote** on on-chain-active corridor headers (deliver X dest → quote Y source spend)
- **30-day status sparkline** backed by the `CorridorStatusEvent` append-only log
- **Live Bitso orderbook badge** on USD↔MXN corridor pages — "measured, not assumed" v1 proof
- **Public REST API** with 5 documented endpoints at `/api-docs`

### Compliance & safety (Safe Path Agent) ✅
- Tool-using agent that iterates across candidate paths, calls 6 live tools against mainnet
- Rejects routes that trip XLS-73 AMM Clawback Exposure or XLS-77 Deep Freeze
- One-click compliance PDF export with risk evidence + agent justification embedded

---

## Next — paced by the XRPL validator vote

The single most important thing about XRPLens' roadmap is that we don't pick it unilaterally. Every major XRPL protocol amendment that touches cross-border payments, stablecoins, or compliance is a feature we're already preparing to classify the day it activates.

### XLS amendments we track

> Status notation: **LIVE** = active on mainnet; **VOTING** = validator voting open; **DRAFT** = XRPL-Standards PR not yet advanced to vote; **DISABLED** = pulled after a bug, replacement in development. Verify at [xrpl.org/resources/known-amendments](https://xrpl.org/resources/known-amendments) and [xrpscan.com/amendments](https://xrpscan.com/amendments).
>
> **All status entries below verified April 2026** against multiple primary sources — see the [research output](#xls-research-sources) at the end of this doc.

#### Payments and liquidity

**XLS-30 — Automated Market Maker (AMM)** · LIVE
Native AMM on the XRPL DEX. Every AMM pool XRPLens discovers through a `findAMMs` scan is an XLS-30 artefact. **XRPLens already scans AMM reserves and surfaces them in on-chain corridor liquidity snapshots.**

**XLS-38 — XChainBridge** · LIVE
Lets assets move between the mainnet and a trust-minimised sidechain under a federated signer set. Not yet relevant to fiat corridors directly, but a future RLUSD sidechain (or EVM-on-XRPL deployment) settles through this. **Roadmap:** when a production sidechain carrying RLUSD goes live, XRPLens classifies those routes as a new category: `xchain-bridge`.

**XLS-47 — PriceOracle** · LIVE
Native on-ledger asset-pair pricing, signed by attested oracle providers. **Why it matters:** XRPLens currently has no FX reference for computing corridor slippage — we display raw `recommendedCost` / `amount` numbers without comparing to market FX. With XLS-47, every corridor health score can be normalised against an on-ledger oracle quote. **Roadmap:** Phase 2. Add an `oracleFX` field to corridor liquidity snapshots; render slippage in % rather than raw spread.

**XLS-56 — Multi-Purpose Tokens (MPT)** · LIVE
A lighter-weight token primitive than IOUs — no trust line required, built-in metadata, compliance flags. RLUSD itself is moving onto MPT and bank-issued stablecoins are likely to follow. **Why it matters:** the corridor atlas currently models fiat proxies only through IOUs and native stablecoin issuers; MPT opens a third category. **Roadmap:** when the first MPT-issued fiat proxy launches, XRPLens adds an `mpt-issued` badge to the currency metadata and scans MPT issuance graphs as a new route type.

**XLS-85 — Token Escrow** · LIVE (Feb 2026)
Extends native `Escrow` from XRP-only to issued tokens including RLUSD and MPTs. Makes time-locked multi-leg payment patterns possible. **Why it matters:** escrow-anchored corridor routing (payer escrows RLUSD for N hours; if no dispute, payee claims) is the building block for institutional trade finance on XRPL. Locked corridor float (vesting, OTC, conditional settlement) is now observable on-ledger. **Roadmap:** XRPLens adds an `escrow-anchored` hop kind to the route graph and surfaces total locked RLUSD float per actor as a Tier 4 (live depth) data point.

**XLS-56 — Batch** · DISABLED
The original Batch amendment was **pulled in rippled v3.1.1 (Feb 23 2026)** after Cantina AI's Apex tool flagged a signer-validation bug on Feb 19. A replacement, **BatchV1_1**, is in development. **Why it matters once it ships:** atomic multi-leg corridor routing — pay USD, swap to RLUSD, deliver MXN, all in one ledger-atomic transaction. Until then, XRPLens routes are sequenced, not atomic. **Roadmap:** watch-list. The day BatchV1_1 ships, `/route` becomes an *executable* primitive, not just a decision tool.

#### Institutional and DeFi

**XLS-65 — Single Asset Vault** · LIVE (per Ripple's 2026 roadmap)
A tokenised vault primitive that holds a single asset and mints share tokens. Used for institutional on-ledger custody — think "tokenised money market fund on XRPL." **Why it matters for XRPLens:** vault shares are what institutions use to hold idle corridor float overnight. A corridor that ends in "deposit to XLS-65 vault" is earning yield during settlement. **Roadmap:** corridor detail pages gain a "yield-bearing endpoint?" flag when any vault terminates the route.

**XLS-66 — Lending Protocol** · VALIDATOR VOTING (open Jan 28 2026, XRPL v3.1.0)
On-chain, fixed-term, under-collateralised institutional lending native to XRPL. Built on top of Single Asset Vaults isolating risk per-asset. Enables borrowing against vault shares or RLUSD balances to bridge working capital without unwinding positions. **Why it matters:** institutional corridor operators (PSPs funding RLUSD liquidity on the Bitso side of USD→MXN) can lever up their corridor float — meaning the same balance sheet moves 2-3x the settlement volume. **Roadmap:** XRPLens adds a `leverage-available` signal per corridor when a lending market exists on either actor's XRPL address. **Watch list:** the day the vote passes, ship corridor-float yield analytics.

#### Identity and compliance

**XLS-40 — Decentralised Identifiers (DID)** · LIVE
Native W3C-compliant `DIDSet` / `DIDDelete` transactions. **Why it matters:** every off-chain actor in the XRPLens registry (Bitso, Rain, Tranglo) could eventually publish a DID that XRPLens consumes as their canonical identity anchor. The T1 tier in [actor-upgrade-spec.md](./actor-upgrade-spec.md) becomes a DID fetch instead of manual scraping. **Roadmap:** actor detail page gains a "verified identity" chip when a matching DID is found on-chain.

**XLS-70 — Credentials** · LIVE (Sept 2025)
On-ledger credential issuance tied to DIDs — "Regulator X attests that Account Y holds licence Z." Required prerequisite for XLS-80/81. **Why it matters:** this is the substrate for the T2 regulatory tier in the actor upgrade spec. Instead of scraping the FCA register, we fetch a credential issued *by* the FCA to the actor's XRPL account. **Roadmap:** compliance export PDF cites on-chain credential hashes as evidence, not just scraped registry pages.

**XLS-77 — Deep Freeze (trust line)** · LIVE
Issuer can deep-freeze a specific trust line, blocking both sending and receiving. **XRPLens already flags this** in the Safe Path agent risk engine. On the corridor side, a deep-freezable IOU issuer gets a visible warning badge.

**XLS-73 — AMM Clawback Exposure** · LIVE
Flags AMM pools where LPs are exposed to issuer clawback. **XRPLens already flags this** in the Safe Path agent's `runRiskEngine` tool.

#### ⭐ The marquee pair — XLS-80 and XLS-81 — both LIVE

**XLS-80 — Permissioned Domains** · ✅ **LIVE on mainnet (Feb 4 2026, 9:57 UTC, 91%+ validator approval)**
Creates credential-gated segments of the public XRPL where only accounts holding specific issuer-signed credentials (XLS-70) can transact. **Why it matters for XRPLens — this is the single most important amendment for our thesis.** It makes per-corridor jurisdictional fencing a native ledger primitive: you can now scope a USD→MXN corridor to only MSB-licensed participants and surface "which domain did this payment route through?" as first-class graph metadata. **Roadmap:** Phase 1 priority. Add a `permissionedDomain` field to every corridor edge sourced directly from ledger state. Filter `/route` results by user credential set. Export domain membership in the compliance PDF.

**XLS-81 — Permissioned DEX** · ✅ **LIVE on mainnet (~Feb 18 2026, 82.35% validator support)**
Native order books where offers only match between accounts with matching credentials inside a Permissioned Domain. **Why it matters:** on-chain FX now has a compliant venue. XRPLens can distinguish "open DEX liquidity" from "institutional gated liquidity" and attribute corridor fills/slippage to each. **No existing explorer surfaces this distinction.** **Roadmap:** new corridor kind — `xrpl-native-permissioned` — for fiat pairs that settle through an XLS-81 venue. This is the **first thing that goes into v0.2** because the primitive is already live and XRPLens can be first-to-market with the classification.

#### Pending fixes (cleanup amendments)

`fixAMMClawbackRounding`, `fixTokenEscrowV1`, `fixMPTDeliveredAmount`, `fixPriceOracleOrder`, `fixXChainRewardRounding` — all currently in voting, all relevant cleanup for the primitives XRPLens depends on. **Roadmap:** monitor; rerun affected scans within 24h of activation to refresh stale liquidity snapshots.

---

## 30–90 day product roadmap (audit-derived)

Ordered by judge-to-customer impact per unit of work.

### Month 1 — Close the obvious gaps

1. **Expand live partner depth from Bitso to 5 venues** (1 per week):
   Kraken, Uphold, Mercado Bitcoin, Bitkub, VALR. All have public orderbook APIs. Each unlocks a whole region's corridors with one integration. See the delivery order in [actor-upgrade-spec.md](./actor-upgrade-spec.md#priority-partners-to-upgrade-first-the-demo-order).

2. **Alert subscriptions**:
   `/api/corridors/alerts` — webhook + email subscriptions on `corridor.status.drop` and `partnerDepth.thin` events. First recurring-revenue feature.

3. **Fee + ETA schema in actor registry**:
   Tier 3 from the actor upgrade spec. Add structured `feePct` + `etaMinutes` per deposit/withdrawal method. `/route` quotes become real.

4. **Historical depth time-series** for the five live-depth partners:
   Sample every 15 minutes, store 30 days. Sparkline of depth alongside the existing status sparkline. "Bitso `xrp_mxn` depth held above 50k XRP for the last 30 days" is a quotable signal for PSP buyers.

### Month 2 — Open the category

5. **Publish the corridor actor atlas as a versioned open dataset** on GitHub:
   Yes, same file already in the repo. But versioned releases (`v1.0.0`, `v1.1.0`) with changelog, JSON export, and a minimal JavaScript SDK. Plant the "XRPLens corridor taxonomy" flag as an open standard before a competitor coins their own.

6. **XRPLens Classification Standard**:
   Short markdown spec defining the three-kind taxonomy (XRPL-native / hybrid / off-chain-bridge) + the actor scoring formula. Submitted as a talk / write-up to the Ripple dev community.

7. **API keys + rate limits + billing scaffolding**:
   Stripe integration. Free tier, $99/mo indie tier, $2k/mo enterprise tier (which is really a conversation starter). First 10 paying customers are the beachhead.

8. **`/route` API polish**:
   Add `?maxFeePct`, `?onlyODL=true`, `?excludeJurisdictions=RU,IR` filters. Decision UX for compliance teams.

### Month 3 — The first paid pilot

9. **Sign the first PSP pilot**:
   Outreach to 3 PSPs currently evaluating Ripple Payments integration. Offer a 30-day free trial with an enterprise API key + a dedicated corridor scorecard report. Target: one paid pilot at $5k/month.

10. **Regulatory posture v1 (Tier 2)**:
    Add `licences` + `jurisdictions` + `sanctionedBy` to the actor schema for the top 50 partners. Auto-refresh from OFAC, EU sanctions list, FCA/MAS/DFSA registers. Unlock the `/route?excludeJurisdictions=...` filter for compliance buyers.

11. **Corridor alerts email digest**:
    Weekly "what changed on your watched corridors" email. Free, but gated by account creation. Drives list growth.

12. **Second Ripple partner integration**:
    Tranglo or Onafriq — require partner API keys, bigger effort, but **each unlocks 25+ corridors at once** through a single integration. Demonstrates the one-integration-many-corridors leverage that's unique to hub partners.

---

## 6-month stretch goals

- **XLS-81 Permissioned DEX integration** on day one of activation — new corridor kind, new route filter
- **MPT-issued fiat proxy** detection — when the first bank-issued MPT stablecoin launches
- **Reputation tier (T5)** — Trustpilot + Reddit + incident timeline per actor
- **Mobile responsive polish** — globe + actor graph have to work on phones
- **i18n** — Spanish, Portuguese, Japanese, Arabic; the corridor atlas is inherently cross-lingual
- **Execution** (the pivot) — partnership with one CEX to actually settle a USD→MXN through the picked corridor. Tool → payment rail.

---

## Business milestones

| Milestone | Metric | Target |
|---|---|---|
| Open dataset | GitHub stars | 500 |
| First paid pilot | ARR | $60k |
| First 10 paying customers | ARR | $200k |
| First Ripple partnership conversation | — | Signed NDA by end of Q3 |
| Series seed (if the pivot to execution works) | — | $1.5M |

**TAM ceiling** (from the audit): ~1,500–3,000 potential paying customers across PSPs, fintechs, stablecoin issuers, and compliance teams, at $5-25k/yr each. Realistic ceiling is **$10-70M ARR** if we win the category. First-year realistic: **$200k ARR**, which is enough for a seed round.

---

## Risks

- **Ripple builds this internally and gives it away free.** Closest existing version (Liquidity Hub) is partner-only — we've verified that in the competitor scan — but they could flip a switch. Mitigation: be so useful they either acquire or partner instead of building.
- **Actor registry goes stale.** Today it's hand-curated. Mitigation: versioned releases + a scraping pipeline that verifies ODL/RLUSD flags automatically.
- **RLUSD loses momentum.** If adoption stalls, the off-chain-bridge layer becomes less interesting. Mitigation: corridor taxonomy is asset-agnostic — same primitives classify USDC-on-XRPL, MPT fiat proxies, or a hypothetical future bridge asset.
- **Utility Scan pivots.** Nearest adjacent tool could extend into classification + actor modeling. Mitigation: our lead is the research atlas (200 actors hand-researched) — hard to replicate in under a month of full-time analyst work, and we're publishing it as an open dataset to cement the flag.

---

## Changelog

- **v0.1 (hackathon)** — corridor atlas + Safe Path agent + `/route` + live Bitso depth + status sparkline + public API + three-kind classification. This doc.
- **v0.2 (week 2)** — expand live depth to 5 venues, ship alerts, **ship XLS-81 Permissioned DEX corridor classification** (the primitive activated Feb 2026; first-mover slot is open).
- **v1.0 (month 2)** — versioned open dataset + billing + XLS-47 PriceOracle integration for slippage normalisation.
- **v1.1 (month 3)** — first paid pilot signed + XLS-85 Token Escrow locked-float visibility.
- **v2.0 (month 6)** — XLS-66 Lending integration the day it activates. BatchV1_1 watch list — pivot `/route` from decision tool to executable primitive.

---

## XLS Research Sources

All XLS amendment statuses above were verified April 2026 against:

- [XRPL Known Amendments — official](https://xrpl.org/resources/known-amendments)
- [XRPLF/XRPL-Standards GitHub](https://github.com/XRPLF/XRPL-Standards)
- [XRPL Activates XLS-80 Permissioned Domains — BSC News](https://bsc.news/post/xrp-ledger-permissioned-domains-xls-80)
- [XRPL to Activate Permissioned Domains as XLS-80 Goes Live — MEXC](https://www.mexc.com/news/633488)
- [XRP Ledger rolls out members-only DEX (XLS-81) for regulated institutions — CoinDesk](https://www.coindesk.com/tech/2026/02/18/xrp-ledger-rolls-out-members-only-dex-for-regulated-institutions)
- [Ripple Director Explains How XLS-81 Brings Institutional Liquidity — CryptoBasic](https://thecryptobasic.com/2026/02/12/ripple-director-explains-how-the-upcoming-xls-81-could-bring-institutional-liquidity-to-xrp/)
- [XRPL Blocks Critical Batch Amendment Bug Before Mainnet — CoinCentral](https://coincentral.com/xrpl-blocks-critical-batch-amendment-bug-before-reaching-mainnet-launch/)
- [XRPL Batch Amendment Security Patch — Cryptonomist](https://en.cryptonomist.ch/2026/02/27/xrpl-batch-amendment-security/)
- [XRP Ledger Launches Token Escrow Amendment on Mainnet (XLS-85) — The Coin Republic](https://www.thecoinrepublic.com/2026/02/13/xrp-news-xrp-ledger-launches-token-escrow-amendment-on-mainnet/)
- [Beyond XRP: How XRPL Is Upgrading TradFi With New Token Escrow — U.Today](https://u.today/beyond-xrp-how-xrpl-is-upgrading-tradfi-with-new-token-escrow)
- [XRPL's New Lending Protocol — 24/7 Wall St.](https://247wallst.com/investing/2026/02/01/xrpls-new-lending-protocol-could-attract-institutional-capital-what-it-means-for-xrp/)
- [XLS-0066 Lending Protocol — XRPLF GitHub](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0066-lending-protocol)
- [Five New XRPL Amendments to Transform 2026 — TradingView/U.Today](https://www.tradingview.com/news/u_today:fb3ba2d67094b:0-five-new-xrpl-amendments-on-way-to-transform-2026-what-to-watch/)
