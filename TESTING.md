# XRPLens Manual Testing Guide

This document lists every XRPL address verified to work with XRPLens, what data each one exercises, and questions to ask in the AI Chat to validate behavior.

## Quick start

1. **Start services** (from `xrplens/`):
   ```bash
   docker compose up -d                    # postgres + redis
   pnpm -C apps/server tsx --env-file=.env src/index.ts   # API on :3001
   pnpm -C apps/web dev                    # frontend on :3000
   ```
2. Open http://localhost:3000/analyze
3. Pick **Entity Audit** or **Corridor Analysis** below.

---

## ENTITY AUDIT — Tested addresses

Each address is verified to produce a working knowledge graph. The "what's interesting" column tells you which features it exercises so you can target specific tests.

### Token issuers / gateways

| # | Address | Label | What's interesting |
|---|---------|-------|-------------------|
| 1 | `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` | RLUSD Issuer | clawback enabled, depositAuth, frozen trust line, signer list, AMM pool |
| 2 | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | Bitstamp Gateway | 8 currencies (AUD, BTC, CHF, ETH, EUR, GBP, JPY, USD), TransferRate 0.15%, RegularKey |
| 3 | `rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz` | Sologenic SOLO | RegularKey = blackhole address, noFreeze, TransferRate 0.01%, AMM pool |
| 4 | `rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr` | CasinoCoin (CSC) | No domain, AMM pool, single token |
| 5 | `rHXuEaRYnnJHbDeuBH5w8yPh5uwNVh5zAg` | Elysian (ELS) | RegularKey blackhole, AMM pool |
| 6 | `rXmagwMmnFtVet3uL26Q2iwk287SRvVMJ` | Magnetic (MAG) | NFT marketplace ecosystem token |
| 7 | `rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq` | GateHub Gateway | EUR + USD, MessageKey set, RegularKey, TransferRate 0.2% |
| 8 | `rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL` | GateHub BTC | BTC issuer |
| 9 | `rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h` | GateHub ETH | ETH issuer |

### AMM pools (analyze pool address directly)

| # | Address | Label | Reserves |
|---|---------|-------|----------|
| 10 | `rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3` | XRP/RLUSD AMM | 1.79M XRP + 2.4M RLUSD, vote slots, auction slot |
| 11 | `rMEJo9H5XvTe17UoAJzj8jtKVvTRcxwngo` | XRP/SOLO AMM | 66K XRP + 3.1M SOLO |
| 12 | `rHUpaqUPbwzKZdzQ8ZQCme18FrgW9pB4am` | XRP/USD.Bitstamp AMM | XRP/USD pool |
| 13 | `rf7g4JWCxu9oE1MKsWTihL9whY75AphCaV` | XRP/CSC AMM | XRP/CSC pool |
| 14 | `rs9ineLqrCzeAGS1bxsrW8x2n3bRJYAh3Q` | XRP/USD.GateHub AMM | XRP/USD pool |

### Exchanges

| # | Address | Label | What's interesting |
|---|---------|-------|-------------------|
| 15 | `rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh` | Binance hot wallet | 30 trust lines, 2 self-escrows |
| 16 | `rs8ZPbYqgecRcDzQpJYAMhSxSi5htsjnza` | Binance cold | ~17B XRP, no flags, no domain |
| 17 | `rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh` | Kraken | 28 trust lines, MessageKey, LowQualityOut on BTC line |
| 18 | `rw2ciyaNshpHe7bCHo4bRWq6pqqynnWKQg` | Coinbase | 1 Check + 10 Escrows + 21 trust lines |
| 19 | `rKfzfrk1RsUxWmHimWyNwk8AoWHoFneu4m` | Uphold | Checks + escrows |

### Whales / institutional

| # | Address | Label | What's interesting |
|---|---------|-------|-------------------|
| 20 | `rB3WNZc45gxzW31zxfXdkx8HusAhoqscPn` | Ripple Escrow 1 | 15 escrows = ~5B XRP, 4-of-8 multisig SignerList |
| 21 | `r9UUEXn3cx2seufBkDa8F86usfjWM6HiYp` | Ripple Escrow 2 | Different escrow distribution |
| 22 | `rDdXiA3M4mYTQ4cFpWkVXfc2UaAXCFWeCK` | Ripple Escrow 3 | Different escrow distribution |
| 23 | `r3kmLJN5D28dHuH8vZNUZpMC43pEHpaocV` | Ripple Operations | 80 trust lines, RegularKey |
| 24 | `rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh` | Ripple Historical | TransferRate set, disableMasterKey |

### Special / oracle / bot

| # | Address | Label | What's interesting |
|---|---------|-------|-------------------|
| 25 | `rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY` | XRP Tip Bot | 700+ escrows, depositAuth, MessageKey, ownerCount=734 |
| 26 | `rP24Lp7bcUHvEW7T7c8xkxtQKKd9fZyra7` | DIA Oracle Provider | 2 Oracle objects with XRP/USD, BTC/USD, ETH/USD price feeds |
| 27 | `rGeyCsqc6vKXuyTGF39WJxmTRemoV3c97h` | Internet Archive | Donation address, minimal data |

### Rare object type test accounts

| # | Address | Label | What's interesting |
|---|---------|-------|-------------------|
| 28 | `rhSTwqSK13zdRmzHMZZP8i7DnuG27pwX76` | XRPL Feature Tester | **Has every rare type**: DID, MPTokenIssuance, MPToken, Credential, PermissionedDomain, PayChannel, Tickets, NFTokenPage, NFTokenOffer, Escrow, Offers |
| 29 | `rwKgwydb7NRHNS8gVpG6QEP2tYqPhroYrK` | NFT Holder (Cuentos De Hada) | 23 NFTokenPage, 66 NFTokenOffer, 19 active DEX offers, 1 PayChannel |
| 30 | `rfjquSFSKXnDYdQyGWuXBSSSW87jfpX7Qm` | Bithomp infrastructure | NFTs, Checks, historic DID activity |
| 31 | `rNFta7UKwcoiCpxEYbhH2v92numE3cceB6` | MPToken Issuer | MPTokenIssuance object |
| 32 | `rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn` | Doc Tutorial Account | Credential + PayChannel + DepositPreauth + Ticket + active Offer + Check |
| 33 | `ra5nK24KXen9AHvsdFTKHSANinZseWnPcX` | Doc Issuer Account | Credential + PayChannel + Check |
| 34 | `r9c6A65SmhhZALrkMTpqc9X3kGjv5gtNNk` | RLUSD DepositPreauth | 2 DepositPreauth + SignerList |

---

## CORRIDOR ANALYSIS — Tested corridors

In the **Corridor Analysis** tab, fill in source and destination currency. Each one has been verified to return at least one path with risk scoring.

| Corridor | Source Currency | Source Issuer | Destination Currency | Destination Issuer | Amount |
|----------|----------------|---------------|---------------------|--------------------|--------|
| **XRP → RLUSD** | XRP | (empty) | RLUSD | `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` | 1000 |
| **XRP → USD.Bitstamp** | XRP | (empty) | USD | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | 1000 |
| **XRP → EUR.GateHub** | XRP | (empty) | EUR | `rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq` | 500 |
| **XRP → SOLO** | XRP | (empty) | SOLO | `rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz` | 5000 |

The corridor view shows:
- **Blue border** path = XRPL DEFAULT (cheapest, what the protocol picks)
- **Green border** path = XRPLENS RECOMMENDED (best risk/cost ratio)
- Each hop colored by risk: green (safe) / yellow (medium) / red (high)
- Risk badges per hop (CLAWBACK_ENABLED, NO_MULTISIG, FROZEN_TRUST_LINE, etc.)

> **Note:** Most XRPL corridors only return 1 path because the network has limited liquidity diversity for IOU tokens. When only 1 path exists, it's marked both DEFAULT and RECOMMENDED. The infrastructure handles multi-path scenarios when they exist.

---

## AI CHAT — Questions to ask

After running an analysis, click **AI Chat** in the graph view. The chat is grounded in the analysis data.

### Built-in suggestions
- "What are the highest-risk counterparties?"
- "Which AMM pools have the most concentrated liquidity?"
- "Are there any RLUSD impersonator tokens?"
- "What compliance actions should I take before routing capital?"

### Specific questions to test against each entity type

#### For RLUSD Issuer (`rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`)
- "Is RLUSD's clawback flag enabled?"
- "How many trust lines does RLUSD have?"
- "What's the multisig configuration of RLUSD?"
- "Which accounts hold the most RLUSD?"
- "What's the total RLUSD supply outstanding?"
- "Is there any frozen trust line on RLUSD?"

#### For Bitstamp Gateway (`rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B`)
- "What currencies does Bitstamp issue?"
- "What is Bitstamp's transfer fee?"
- "Does Bitstamp use a regular key?"
- "How much USD has Bitstamp issued in total?"
- "Is Bitstamp's domain verified?"

#### For Sologenic (`rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz`)
- "Is the Sologenic issuer blackholed?"
- "Can Sologenic freeze trust lines?"
- "What is the SOLO transfer rate?"
- "Why is Sologenic considered safer than other token issuers?"

#### For AMM Pools (e.g., `rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3`)
- "What's the trading fee on this AMM pool?"
- "Who controls the auction slot?"
- "What's the LP concentration risk?"
- "Is there enough liquidity for a $1M trade?"
- "What are the vote slots on this pool?"

#### For Ripple Escrow (`rB3WNZc45gxzW31zxfXdkx8HusAhoqscPn`)
- "How much XRP is locked in escrow?"
- "What's the multisig configuration?"
- "When do these escrows release?"
- "Are these escrows self-referencing?"

#### For DIA Oracle (`rP24Lp7bcUHvEW7T7c8xkxtQKKd9fZyra7`)
- "What price feeds does this oracle provide?"
- "How often is this oracle updated?"
- "Who is the provider?"

#### For XRP Tip Bot (`rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY`)
- "How many escrows does this account have?"
- "What's the transaction velocity pattern?"
- "Does this account have deposit authorization?"

#### For Coinbase (`rw2ciyaNshpHe7bCHo4bRWq6pqqynnWKQg`)
- "Are there any outstanding checks for this account?"
- "What escrows is Coinbase receiving?"
- "What's the total value of pending checks?"

#### For NFT Holder (`rwKgwydb7NRHNS8gVpG6QEP2tYqPhroYrK`)
- "How many NFTs does this account own?"
- "Are there active NFT marketplace offers?"
- "What's the buy/sell offer ratio?"

#### For Feature Tester (`rhSTwqSK13zdRmzHMZZP8i7DnuG27pwX76`)
- "What rare XRPL features does this account use?"
- "Does this account have a DID?"
- "Are there any MPTokens issued?"
- "What permissioned domains does it have?"
- "What credentials does it hold?"

---

## COMPLIANCE REPORT — How to test

1. Run an Entity Audit on any address above
2. Click **Compliance Report** in the graph view header (or sidebar)
3. Click **Generate Report** — takes 30s–2min depending on graph size
4. Verify the report contains:
   - **Title** with date
   - **Summary** (AI-generated)
   - **Risk Assessment** with overall risk level + flags
   - **Entity Breakdown** (counts of all node types)
   - **Concentration Analysis** (top holders, HHI)
   - **Gateway Analysis** (obligations, gateways)
   - **Recommendations** (5 actionable items)
5. Click **Print / Export PDF** to save it

---

## What to check on the GRAPH VIEW

For every entity audit, verify:

1. **Stats bar** at top shows: node count, edge count, HIGH/MED/LOW badges
2. **Click any node** → sidebar opens on the right with:
   - Node kind label (uppercase, colored)
   - Node label
   - Risk Flags section (if any)
   - AI Explanation section (if generated)
   - Node Data JSON (full raw data)
3. **Sidebar closes** when you click the X
4. **Edges** render between nodes with labels
5. **Zoom controls** + **minimap** + **legend** visible
6. **Compliance Report** button → navigates to /compliance/:id
7. **AI Chat** button → navigates to /chat/:id

---

## Automated test coverage

The Playwright suite (`apps/web/e2e/`) has **67 tests**, all passing:

**`full-app.spec.ts`** — 39 tests covering:
- Home page navigation
- Analyze page (Entity + Corridor tabs)
- Graph rendering for 9 different analyses (RLUSD, Bitstamp, Binance, TipBot, Oracle, RippleEscrow, Coinbase, AMM_Pool, GateHub)
- Node click → sidebar with data
- Risk flags display
- Issuer node fields (balance, transferRate, regularKey, messageKey, isBlackholed)
- Specific node types (oracle, escrow, signerList, check, ammPool)
- Compliance Report and AI Chat navigation

**`extended.spec.ts`** — 28 tests covering:
- Compliance Report end-to-end (Generate → Render → Print)
- Chat page suggestions, message send, AI response
- Corridor analysis (path search, hop chain, reasoning)
- All rare node types: credential, depositPreauth, ticket, payChannel, offer, nft, nftOffer, mpToken (via API + UI click)

Run:
```bash
cd apps/web
pnpm exec playwright test e2e/full-app.spec.ts e2e/extended.spec.ts
```

---

## Coverage matrix: which test address has which node type

| Object Type | Test Address |
|------------|--------------|
| `issuer` | All |
| `token` | RLUSD, Bitstamp, Sologenic, GateHub, etc. |
| `account` | All token issuers (trust line holders) |
| `ammPool` | RLUSD, Sologenic, GateHub, AMM pool addresses |
| `orderBook` | All token issuers |
| `escrow` | Ripple Escrow, XRP Tip Bot, Coinbase, Binance, Doc Account, Feature Tester |
| `check` | Coinbase, Bithomp, Doc Account, Doc Issuer |
| `payChannel` | NFT Holder, Doc Account, Doc Issuer, Feature Tester |
| `nft` | NFT Holder, Bithomp, Feature Tester |
| `nftOffer` | NFT Holder, Feature Tester |
| `signerList` | RLUSD, Ripple Escrow, RLUSD Preauth |
| `did` | Feature Tester |
| `credential` | XRP Tip Bot, Doc Account, Doc Issuer, Feature Tester |
| `mpToken` | MPT Issuer, Feature Tester |
| `oracle` | DIA Oracle |
| `depositPreauth` | XRP Tip Bot, Doc Account, RLUSD Preauth, Feature Tester |
| `offer` | NFT Holder, Doc Account, Feature Tester |
| `permissionedDomain` | Feature Tester |
| `ticket` | Doc Account, Feature Tester |

---

## Known limitations

- **Multi-path corridors are rare on mainnet.** XRPL's path_find usually returns 1 alternative because IOU liquidity is concentrated. The XRPLENS RECOMMENDED logic kicks in when there are 2+ paths.
- **Vault, Bridge, Delegate** ledger types — minimal mainnet usage; XRPLens parses them but no test address yet.
- **AI explanation step** for large graphs (200+ nodes) takes 3–5 minutes. The data is available in the graph immediately, but AI explanations populate progressively.
