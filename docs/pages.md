# XRPLens — All pages

## Corridor features

| # | Path | Name | What it shows |
|---|---|---|---|
| 1 | `/corridors` | Corridor Atlas | Globe with 220 arcs across 38 financial centres. Click a currency label → right-side panel lists every corridor involving that currency. Click a chip → corridor detail page. |
| 2 | `/corridors/usd-mxn` | Corridor Detail (off-chain-bridge example) | Green banner. Live Bitso orderbook depth badge (pulsing green dot). Actor registry (15 USD + 3 MXN). Partner graph with colour legend. Status sparkline. |
| 3 | `/corridors/usd-eur` | Corridor Detail (XRPL-native example) | Amber banner. Delivered-amount quote badges. XRPL on-chain IOU orderbook table (16 candidates). Selected route detail. Actor registry + partner graph. |
| 4 | `/corridors/chf-usd` | Corridor Detail (hybrid legacy example) | Sky-blue banner. Routes table hidden (legacy IOUs dead). Only actor graph + description. |
| 5 | `/corridors/inr-eur` | Corridor Detail (cross-region off-chain example) | INR actors on one side, EUR actors on the other. Shows that any fiat can reach any other fiat via RLUSD. |
| 6 | `/route?from=USD&to=MXN&amount=1000` | Route Calculator | Verdict card (GREEN / AMBER / RED). Top 3 source ramps + top 3 dest ramps, ranked by ODL > RLUSD > XRP. "How this route settles" narrative. Quick-try chips. |
| 7 | `/route?from=JPY&to=PHP&amount=100000` | Route Calculator (SBI Remit flagship) | SBI VC Trade / SBI Remit on source side, Coins.ph / iRemit on destination side. |
| 8 | `/route?from=AED&to=INR&amount=3700` | Route Calculator (UAE → India) | Pyypl / LuLu / Rain on source, CoinDCX / CoinSwitch on dest. |
| 9 | `/developers` | API Documentation | 6 endpoint cards with cURL examples and response schemas. |

## Core features (pre-existing)

| # | Path | Name | What it shows |
|---|---|---|---|
| 10 | `/` | Home | Landing page with feature cards. |
| 11 | `/analyze` | Analyze | Paste any XRPL address → live knowledge graph builds (18 node types, 19 edge types). |
| 12 | `/safe-path` | Safe Path Agent | Type a natural-language payment intent → tool-using AI agent iterates candidate paths, rejects risky ones, returns a winning path with justification. |
| 13 | `/history` | History | Browse past analyses. |

---

## FAQ

### What's the difference between `/route` and `/safe-path`?

They solve different problems for different users.

**`/route` (Route Calculator)** answers: *"Which corridor should I use to send money from currency A to currency B?"*

It's a **lookup tool**. You pick two currencies + an amount, and it instantly shows you:
- Which corridor in the atlas matches (off-chain-bridge, XRPL-native, or hybrid)
- The top 3 ranked partners on each side (sorted by ODL > RLUSD > XRP support)
- A one-line narrative of how the payment settles on XRPL
- The corridor's GREEN/AMBER/RED status

It runs in milliseconds because it reads from the pre-computed atlas. No XRPL calls happen at query time. Think of it as Google Maps showing you the route — it tells you which road to take, but it doesn't drive you there.

**`/safe-path` (Safe Path Agent)** answers: *"Given this specific payment, what is the actual safest XRPL path right now, and why?"*

It's a **live AI agent**. You describe a payment intent in natural language ("€10M EUR→PHP, no HIGH risk hops, settle in 24h"), and the agent:
1. Calls `findCandidatePaths` against the live XRPL mainnet
2. Crawls each candidate account for risk flags
3. Runs the risk engine (concentrated liquidity, AMM clawback exposure, deep freeze, etc.)
4. Iterates, rejects bad paths, picks the winner
5. Writes a justification — the compliance artifact

This takes 30-60 seconds because it's doing real XRPL path_find + account crawling in real time. Think of it as a human analyst who evaluates the route for you — slower, but gives you a defensible decision with evidence.

**In short:**
- `/route` = "which corridor?" → instant atlas lookup, pre-computed
- `/safe-path` = "is this specific path safe right now?" → live agent, real-time XRPL queries, compliance-grade

A typical flow: use `/route` to pick the corridor, then use `/safe-path` to validate the specific path before sending.

---

### What are the "1000 USD" / "Scan amount" / "Deliver" numbers?

When XRPLens scans an on-chain corridor (like USD→EUR), it needs to ask the XRPL ledger: "If I wanted to deliver X amount of the destination currency, how much source currency would it cost?"

This is done via XRPL's `path_find` command, which requires a **destination amount** as input.

- **`Deliver: 1000 EUR`** = the amount XRPLens asked the ledger to deliver on the destination side. This is a fixed test amount per currency, set to roughly ~$1000 equivalent. It's the same on every scan.
- **`Quote: 1,109.02 USD`** = the answer the ledger gave back — "to deliver 1000 EUR, you'd need to spend 1,109.02 USD through this route." This is a **real live quote** from the XRPL path_find engine, not an estimate.

For off-chain-bridge corridors (like USD→MXN), there is no `path_find` because there are no on-chain IOU trust lines between those currencies. That's why those pages hide the amount badges entirely — there's nothing to quote on-ledger.

The test amounts per currency are rough $1000 equivalents:
- USD: 1,000 · EUR: 1,000 · JPY: 100,000 · MXN: 17,000 · BRL: 5,000 · KRW: 1,400,000 · etc.

---

### What's the difference between the three corridor types?

Every fiat pair in the world that can reach XRPL falls into one of three categories, depending on **how** the money actually moves through the ledger:

#### 🟡 XRPL-native (on-chain)

**Example: USD → EUR**

Both currencies have **real IOU trust lines** issued on XRPL by gateways (GateHub, Bitstamp). There are actual orderbooks on the XRPL DEX where you can trade USD.GateHub for EUR.GateHub directly — or route through XRP as a bridge asset.

XRPLens runs a real `path_find` against the ledger every hour, counts offers, measures AMM pool depth, and derives GREEN/AMBER/RED from what it actually finds on-chain.

```
USD (you have) → USD.GateHub (IOU on XRPL) → XRPL DEX orderbook → EUR.GateHub (IOU on XRPL) → EUR (you receive)
```

There are only about **7 currencies** with active XRPL IOU issuers: USD, EUR, GBP, JPY, CNY, CHF, AUD. Everything else is off-chain-bridge or hybrid.

#### 🔵 Hybrid (legacy XRPL)

**Example: CHF → USD**

The on-chain IOU trust lines **technically exist** (Bitstamp issued CHF IOUs years ago), but they're **dead** — zero live paths on the last scan, 1 offer on the XRP→CHF leg. Nobody uses them anymore.

The real flow today runs through off-chain partners: Bitcoin Suisse or Sygnum (Swiss banks that list XRP) → RLUSD on XRPL → Kraken or Coinbase (US exchanges). XRPLens labels these as "hybrid" and hides the useless on-chain routes table so the page tells one coherent story.

```
CHF (you have) → Bitcoin Suisse (off-chain) → RLUSD on XRPL → Kraken (off-chain) → USD (you receive)
```

#### 🟢 Off-chain-bridge

**Example: USD → MXN, AED → INR, JPY → PHP, NGN → KES**

Neither currency has an on-chain IOU trust line on XRPL. There is no MXN.GateHub or NGN.Bitstamp. The payment **cannot be path_find'd on the ledger**.

Instead, the flow goes through real-world partners who hold RLUSD (or XRP) on XRPL:

```
USD (you have) → Coinbase/Kraken/Uphold (buy RLUSD) → RLUSD on XRPL → Bitso (sell RLUSD for MXN) → MXN (recipient receives)
```

XRPLens catalogues the **real-world actors** on each side (CEXes, Ripple ODL partners, banks, mobile-money bridges) and derives GREEN/AMBER/RED from their quality:
- GREEN = ODL partners and/or RLUSD venues on both sides (production-ready rail)
- AMBER = at least one XRPL-connected venue on each side (workable)
- RED = one side lacks a confirmed venue (thin coverage)

This is the **vast majority** of the atlas: 2,322 of 2,436 corridors are off-chain-bridge. That's because RLUSD (launched Dec 2024) is a universal bridge asset — any fiat that can reach RLUSD through a CEX can reach any other fiat that can reach RLUSD through another CEX. The XRPL leg is always RLUSD (or XRP), even though neither endpoint currency has an on-chain trust line.

**This is the key insight the product is built on:** the XRPL payment network is much bigger than the 7 currencies with IOU gateways. With RLUSD, it's **48 currencies and counting** — the limiting factor is off-chain partners, not on-chain issuers.
