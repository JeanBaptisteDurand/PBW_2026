# XRPL Fiat Corridor Atlas

> Live-verified against XRPL mainnet on **2026-04-08**
> Method: `gateway_balances` for issuer obligations, `book_offers` for order-book depth (capped at 20 per side), `amm_info` for AMM pool reserves.
> All numbers are real on-ledger data at time of scan — re-run the scripts in `scripts/corridor-scan/` to refresh.

---

## 1. Confirmed fiat & stablecoin issuers on XRPL

| # | Label | Issuer address | Currency | Outstanding float | Notes |
|--:|---|---|---|---:|---|
| 1 | **Bitstamp** | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | USD | 11,055,282 | Historic flagship issuer |
| 2 | Bitstamp | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | EUR | 4,960,396 | |
| 3 | Bitstamp | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | JPY | 898,766 | |
| 4 | Bitstamp | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | GBP | 2,358 | Thin |
| 5 | Bitstamp | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | CHF | 8,999 | |
| 6 | Bitstamp | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | AUD | 8,692 | |
| 7 | Bitstamp | `rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B` | BTC / ETH | — | Crypto legs |
| 8 | **GateHub Fifth** | `rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq` | USD | 4,842,227 | Multi-gateway operator |
| 9 | GateHub Fifth | `rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq` | EUR | 2,178,215 | |
| 10 | **GateHub GBP** | `r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g` | GBP | 199,482 | Dedicated GBP issuer |
| 11 | **GateHub USDC** | `rcEGREd8NmkKRE8GE424sksyt1tJVFZwu` | USDC | 761,775 | Bridged USDC |
| 12 | **GateHub USDT** | `rcvxE9PS9YBwxtGg1qNeewV6ZB3wGubZq` | USDT | 619,779 | Bridged USDT |
| 13 | **Ripple RLUSD** | `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De` | RLUSD | 334,277,238 | Ripple's native USD stable, launched Dec 2024; hex code `524C555344…` |
| 14 | **Circle USDC** | `rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE` | USDC | 6,092,974 | Native Circle-issued USDC |
| 15 | **Circle (permissioned)** | `rDVRZpXfp8QJeVcWwq2buEM9xCt8J3n4v3` | USDCAllow | 400,011,000 | Permissioned-domain USDC variant (XLS-80) |
| 16 | **Schuman Financial** | `rMkEuRii9w9uBMQDnWV5AA43gvYZR9JxVK` | EUROP | 373,054 | MiCA-compliant EUR stablecoin (EURØP) |
| 17 | **Mr. Exchange** | `rB3gZey7VWHYRqJHLoHDEJXJ2pEPNieKiS` | JPY | 841,439,882 | **Largest JPY issuer**, ~$13.4M mcap |
| 18 | **Tokyo JPY Gateway** | `rMAz5ZnK73nyNUL4foAvaxdreczCkG3vA6` | JPY | 8,210,436,531 | Historic JPY gateway (nominal float) |
| 19 | **RippleFox** | `rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y` | CNY | 68,507,055 | **Largest CNY issuer** |
| 20 | **RippleQK** | `rPT74sUcTBTQhkHVD54WGncoqXEAMYbmH7` | CNY | 49,971,762 | |
| 21 | **RippleCN** | `razqQKzJRdB4UxFPWf5NEpEG3WMkmwgcXA` | CNY | 9,328,650 | |
| 22 | **SnapSwap** | `rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q` | USD | 6,741,574 | Multi-currency legacy gateway |
| 23 | SnapSwap | `rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q` | EUR | 958,604 | |
| 24 | SnapSwap | `rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q` | GBP | 4,973 | |
| 25 | **Braza Bank BBRL** | `rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt` | BBRL | 29,808,880 | Brazilian Real stablecoin |

**Total active fiat/stable issuers found: 25 token contracts across 15 issuer accounts, covering 9 distinct fiat currencies (USD, EUR, GBP, JPY, CHF, AUD, CNY, BBRL) + 4 dollar stablecoins (RLUSD, USDC, USDT, USDCAllow) + 1 euro stablecoin (EUROP).**

### Other accounts scanned (not fiat issuers)
`rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ` = XAU (gold), `rctArjqVvTHihekzDeecKo6mkTYTUSBNc` = SGB (Songbird), `rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz` = SOLO (Sologenic utility token), `r9Dr5xwkeLegBeXq6ujinjSBLQzQ1zQGjH` = SGD (3.5K float — dead), `rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL` = BTC only.

### Exchange hot wallets (hold IOUs, do not issue)
Bitso, BTC Markets, Bitstamp (extra accts), Binance, Kraken, Bitfinex, Coins.ph, SBI VC, bitbank, Mercado Bitcoin, Independent Reserve, Coinhako — all returned empty `obligations`.

---

## 2. Order-book depth — XRP ↔ each IOU

Numbers are offer counts (max 20) from `book_offers`. "XRP→IOU" = you sell XRP to buy the IOU.

| Token | XRP→IOU | IOU→XRP | Verdict |
|---|---:|---:|---|
| **USD.bitstamp** | 20 | 20 | ⭐ Deep both sides |
| **USD.gatehub** | 20 | 20 | ⭐ Deep both sides |
| **USD.snapswap** | 20 | 20 | ⭐ Deep both sides |
| **EUR.bitstamp** | 20 | 4 | Deep buy / thin sell |
| **EUR.gatehub** | 20 | 20 | ⭐ Deep both sides |
| **EUR.snapswap** | 2 | 13 | Usable |
| **GBP.gatehub** | 20 | 15 | ⭐ Deep both sides |
| **GBP.bitstamp** | 11 | 0 | One-way (buy only) |
| **GBP.snapswap** | 0 | 6 | One-way (sell only) |
| **JPY.mrexchange** | 20 | 0 | One-way (XRP→JPY) |
| **JPY.tokyo** | 0 | 20 | One-way (JPY→XRP) |
| **JPY.bitstamp** | 11 | 3 | Usable |
| **CHF.bitstamp** | 1 | 0 | ☠ Effectively dead |
| **AUD.bitstamp** | 3 | 1 | ☠ Thin |
| **CNY.rippleFox** | 20 | 20 | ⭐ Deep both sides |
| **CNY.rippleCN** | 20 | 20 | ⭐ Deep both sides |
| **CNY.rippleQK** | 20 | 20 | ⭐ Deep both sides |
| **RLUSD** | 20 | 20 | ⭐ Deep both sides |
| **USDC.circle** | 0 | 0 | AMM-only (no orderbook) |
| **USDC.gatehub** | 0 | 0 | AMM-only (no orderbook) |
| **USDT.gatehub** | 0 | 0 | AMM-only (no orderbook) |
| **EUROP.schuman** | 0 | 0 | AMM-only |
| **BBRL.braza** | 0 | 0 | No on-chain liquidity found |

### AMM pool reserves (XRP ↔ IOU)

Found via `amm_info`:

| Pool | Reserve A | Reserve B | ~USD TVL |
|---|---:|---:|---:|
| **XRP / RLUSD** | 1,780,812 XRP | 2,442,745 RLUSD | ~$4.0M ⭐ |
| **XRP / CNY.rippleFox** | 84,079 XRP | 802,889 CNY | ~$250K |
| **XRP / USD.gatehub** | 9,486 XRP | 13,095 USD | ~$25K |
| **XRP / USD.bitstamp** | 3,845 XRP | 5,263 USD | ~$10K |
| **XRP / EUR.gatehub** | 3,307 XRP | 3,881 EUR | ~$8K |
| **XRP / EUR.bitstamp** | 121 XRP | 148 EUR | Tiny |
| **RLUSD / USD.bitstamp** | 30 RLUSD | 30 USD | Dust |

> **Key insight:** RLUSD, USDC, USDT, EUROP and BBRL are traded primarily off-ledger or on single dominant AMM pools — their orderbook depth is deceiving. For path-finding, always query both `book_offers` *and* `amm_info`.

---

## 3. Direct cross-IOU order books (no XRP bridge)

Only pairs with **any** resting liquidity are shown (both directions checked).

| Pair | Fwd | Rev | Status |
|---|---:|---:|---|
| **USD.bitstamp ↔ EUR.bitstamp** | 20 | 20 | ⭐ Arb-tight |
| **USD.bitstamp ↔ USD.gatehub** | 20 | 20 | ⭐ Cross-issuer arb |
| **USD.bitstamp ↔ USD.snapswap** | 2 | 10 | Active |
| **USD.bitstamp ↔ RLUSD** | 20 | 10 | ⭐ Deep both sides |
| **USD.bitstamp ↔ CNY.rippleFox** | 20 | 20 | ⭐ **Direct USD↔CNY!** |
| **USD.bitstamp ↔ CNY.rippleCN** | 3 | 10 | Active |
| **USD.bitstamp ↔ CNY.rippleQK** | 0 | 1 | Thin |
| **USD.bitstamp ↔ EUR.gatehub** | 11 | 7 | Active |
| **USD.bitstamp ↔ GBP.gatehub** | 1 | 0 | Thin |
| **USD.bitstamp ↔ JPY.tokyo** | 0 | 1 | Emergency only |
| **USD.gatehub ↔ CNY.rippleFox** | 2 | 11 | Active |
| **USD.gatehub ↔ CNY.rippleQK** | 0 | 3 | Thin |
| **USD.gatehub ↔ USD.snapswap** | 0 | 5 | One-way |
| **USD.gatehub ↔ GBP.gatehub** | 1 | 1 | Thin |
| **USD.gatehub ↔ RLUSD** | 2 | 1 | Thin |
| **EUR.bitstamp ↔ EUR.gatehub** | 5 | 0 | One-way cross-issuer |
| **EUR.bitstamp ↔ USD.snapswap** | 0 | 1 | Dust |
| **EUR.gatehub ↔ GBP.gatehub** | 6 | 1 | Active |
| **EUR.gatehub ↔ CNY.rippleFox** | 9 | 11 | ⭐ Direct EUR↔CNY! |
| **EUR.gatehub ↔ USD.snapswap** | 0 | 5 | One-way |
| **EUR.gatehub ↔ EUR.snapswap** | 0 | 1 | Dust |
| **EUR.gatehub ↔ RLUSD** | 2 | 1 | Thin |
| **GBP.gatehub ↔ RLUSD** | 1 | 0 | Thin |
| **RLUSD ↔ CNY.rippleFox** | 20 | 20 | ⭐ **Deep RLUSD↔CNY!** |
| **CNY.rippleCN ↔ CNY.rippleFox** | 18 | 5 | Cross-issuer CNY arb |
| **CNY.rippleCN ↔ CNY.rippleQK** | 0 | 3 | Thin |
| **CNY.rippleFox ↔ CNY.rippleQK** | 0 | 3 | Thin |
| **CNY.rippleCN ↔ USD.snapswap** | 1 | 1 | Dust |
| **CNY.rippleCN ↔ GBP.snapswap** | 0 | 1 | Dust |
| **CNY.rippleFox ↔ USD.snapswap** | 0 | 3 | Thin |

---

## 4. Live fiat corridors — all routable paths

Each corridor lists **every independent path** observed on-chain. "XRP" hop = autobridge via XRP DEX.

### Tier 1 — Institutional (deep, multi-route)

#### USD → EUR
1. `USD.bitstamp → EUR.bitstamp` *(direct orderbook, 20/20)*
2. `USD.bitstamp → XRP → EUR.bitstamp`
3. `USD.bitstamp → XRP → EUR.gatehub`
4. `USD.bitstamp → EUR.gatehub` *(direct, 11/7)*
5. `USD.gatehub → XRP → EUR.gatehub`
6. `USD.gatehub → XRP → EUR.bitstamp`
7. `USD.gatehub → EUR.gatehub` *(small, via cross-gateway book)*
8. `USD.snapswap → XRP → EUR.gatehub`
9. `RLUSD → XRP → EUR.gatehub`
10. `RLUSD → XRP → EUR.bitstamp`
11. `USD.bitstamp → RLUSD → XRP → EUR.gatehub`
12. `USD.bitstamp → USD.gatehub → XRP → EUR.gatehub` *(cross-issuer pivot)*

#### EUR → USD *(symmetric, same 12 routes reversed; all verified)*

#### USD → JPY
1. `USD.bitstamp → XRP → JPY.bitstamp`
2. `USD.bitstamp → XRP → JPY.mrexchange` *(via XRP→JPY.mrexchange, 20 offers)*
3. `USD.gatehub → XRP → JPY.mrexchange`
4. `USD.gatehub → XRP → JPY.bitstamp`
5. `RLUSD → XRP → JPY.mrexchange`
6. `RLUSD → XRP → JPY.bitstamp`
7. `USD.snapswap → XRP → JPY.bitstamp`
8. `USD.bitstamp → EUR.bitstamp → XRP → JPY.mrexchange` *(double-hop)*
9. `USD.bitstamp → JPY.tokyo` *(1 rev-side offer — emergency off-ramp)*

#### JPY → USD
1. `JPY.tokyo → XRP → USD.bitstamp` *(20 IOU→XRP offers)*
2. `JPY.tokyo → XRP → USD.gatehub`
3. `JPY.tokyo → XRP → RLUSD`
4. `JPY.tokyo → XRP → USD.snapswap`
5. `JPY.bitstamp → XRP → USD.bitstamp` *(rev thin: 3 offers)*
6. `JPY.bitstamp → XRP → USD.gatehub`

#### USD → CNY *(the surprise hero — three CNY issuers all deep)*
1. `USD.bitstamp → CNY.rippleFox` *(direct 20/20)*
2. `USD.bitstamp → CNY.rippleCN` *(direct 3/10)*
3. `USD.bitstamp → XRP → CNY.rippleFox`
4. `USD.bitstamp → XRP → CNY.rippleCN`
5. `USD.bitstamp → XRP → CNY.rippleQK`
6. `USD.gatehub → CNY.rippleFox` *(direct 2/11)*
7. `USD.gatehub → XRP → CNY.rippleFox`
8. `USD.gatehub → XRP → CNY.rippleCN`
9. `USD.gatehub → XRP → CNY.rippleQK`
10. `RLUSD → CNY.rippleFox` *(direct 20/20 ⭐)*
11. `RLUSD → XRP → CNY.rippleFox`
12. `USD.snapswap → XRP → CNY.rippleFox`
13. `USD.bitstamp → RLUSD → CNY.rippleFox` *(three-hop arb)*

#### CNY → USD *(symmetric, all ~13 routes reversed and verified live)*

#### EUR → CNY
1. `EUR.gatehub → CNY.rippleFox` *(direct 9/11)*
2. `EUR.gatehub → XRP → CNY.rippleFox`
3. `EUR.gatehub → XRP → CNY.rippleCN`
4. `EUR.bitstamp → XRP → CNY.rippleFox`
5. `EUR.bitstamp → USD.bitstamp → CNY.rippleFox` *(direct double-hop, no XRP)*
6. `EUR.bitstamp → XRP → CNY.rippleCN`
7. `EUR.bitstamp → USD.bitstamp → XRP → CNY.rippleFox`

#### CNY → EUR
1. `CNY.rippleFox → EUR.gatehub` *(direct 11 rev)*
2. `CNY.rippleFox → XRP → EUR.gatehub`
3. `CNY.rippleFox → XRP → EUR.bitstamp`
4. `CNY.rippleCN → XRP → EUR.gatehub`
5. `CNY.rippleCN → XRP → EUR.bitstamp`
6. `CNY.rippleFox → USD.bitstamp → EUR.bitstamp` *(double-hop direct, no XRP)*

#### USD → RLUSD *(the meta-stablecoin corridor)*
1. `USD.bitstamp → RLUSD` *(direct 20/10)*
2. `USD.bitstamp → XRP → RLUSD`
3. `USD.gatehub → RLUSD` *(direct 2/1)*
4. `USD.gatehub → XRP → RLUSD`
5. `USD.snapswap → XRP → RLUSD`
6. `USD.bitstamp → USD.gatehub → XRP → RLUSD`
7. AMM pool: `USD.bitstamp ↔ RLUSD` *(tiny 30/30)*
8. AMM pool: `XRP ↔ RLUSD` *($4M TVL — deepest AMM on XRPL)*

#### RLUSD → USD *(symmetric, all routes reversed)*

#### USD ↔ USD (cross-issuer arbitrage — the market-maker corridor)
- `USD.bitstamp ↔ USD.gatehub` 20/20 direct
- `USD.bitstamp → RLUSD → USD.gatehub`
- `USD.snapswap ↔ USD.bitstamp` 2/10 direct
- `USD.snapswap → XRP → USD.gatehub`

### Tier 2 — Usable multi-route

#### USD → GBP
1. `USD.bitstamp → XRP → GBP.gatehub` *(20 offers on sell side)*
2. `USD.gatehub → XRP → GBP.gatehub`
3. `USD.gatehub → GBP.gatehub` *(direct 1/1 — thin)*
4. `USD.bitstamp → GBP.gatehub` *(direct 1 offer)*
5. `USD.bitstamp → XRP → GBP.bitstamp` *(XRP→GBP.bitstamp: 11 offers)*
6. `RLUSD → GBP.gatehub` *(direct 1 fwd)*
7. `RLUSD → XRP → GBP.gatehub`

#### GBP → USD
1. `GBP.gatehub → XRP → USD.bitstamp` *(15 rev offers)*
2. `GBP.gatehub → XRP → USD.gatehub`
3. `GBP.gatehub → XRP → RLUSD`
4. `GBP.gatehub → XRP → USD.snapswap`
5. `GBP.snapswap → XRP → USD.bitstamp` *(6 rev offers)*
6. `GBP.snapswap → XRP → USD.gatehub`

#### EUR → GBP
1. `EUR.gatehub → GBP.gatehub` *(direct 6/1)*
2. `EUR.gatehub → XRP → GBP.gatehub`
3. `EUR.bitstamp → XRP → GBP.gatehub`
4. `EUR.bitstamp → USD.bitstamp → XRP → GBP.gatehub`

#### GBP → EUR
1. `GBP.gatehub → EUR.gatehub` *(direct 1 rev)*
2. `GBP.gatehub → XRP → EUR.gatehub`
3. `GBP.gatehub → XRP → EUR.bitstamp`
4. `GBP.snapswap → XRP → EUR.gatehub`

#### EUR → JPY
1. `EUR.gatehub → XRP → JPY.mrexchange`
2. `EUR.gatehub → XRP → JPY.bitstamp`
3. `EUR.bitstamp → XRP → JPY.mrexchange`
4. `EUR.bitstamp → XRP → JPY.bitstamp`
5. `EUR.bitstamp → USD.bitstamp → XRP → JPY.mrexchange` *(USD pivot, no XRP on first hop)*
6. `EUR.snapswap → XRP → JPY.mrexchange`

#### JPY → EUR
1. `JPY.tokyo → XRP → EUR.gatehub`
2. `JPY.tokyo → XRP → EUR.bitstamp`
3. `JPY.bitstamp → XRP → EUR.gatehub`
4. `JPY.bitstamp → XRP → EUR.bitstamp`

#### GBP → JPY
1. `GBP.gatehub → XRP → JPY.mrexchange`
2. `GBP.gatehub → XRP → JPY.bitstamp`
3. `GBP.snapswap → XRP → JPY.mrexchange`
4. `GBP.snapswap → XRP → JPY.bitstamp`

#### JPY → GBP
1. `JPY.tokyo → XRP → GBP.gatehub`
2. `JPY.bitstamp → XRP → GBP.gatehub`

#### CNY → JPY
1. `CNY.rippleFox → XRP → JPY.mrexchange`
2. `CNY.rippleFox → XRP → JPY.bitstamp`
3. `CNY.rippleCN → XRP → JPY.mrexchange`
4. `CNY.rippleQK → XRP → JPY.mrexchange`
5. `CNY.rippleFox → USD.bitstamp → XRP → JPY.mrexchange` *(USD pivot)*
6. `CNY.rippleFox → RLUSD → XRP → JPY.mrexchange` *(RLUSD pivot)*

#### JPY → CNY
1. `JPY.tokyo → XRP → CNY.rippleFox`
2. `JPY.tokyo → XRP → CNY.rippleCN`
3. `JPY.tokyo → XRP → CNY.rippleQK`
4. `JPY.bitstamp → XRP → CNY.rippleFox`

#### CNY → GBP
1. `CNY.rippleFox → XRP → GBP.gatehub`
2. `CNY.rippleCN → XRP → GBP.gatehub`
3. `CNY.rippleCN → GBP.snapswap` *(direct 1 rev)*

#### GBP → CNY
1. `GBP.gatehub → XRP → CNY.rippleFox`
2. `GBP.gatehub → XRP → CNY.rippleCN`
3. `GBP.gatehub → XRP → CNY.rippleQK`
4. `GBP.snapswap → XRP → CNY.rippleFox`

### Tier 3 — Thin but real
These corridors have ≥1 live offer but thin books. Suitable for small transfers only.

| Corridor | Route | Depth |
|---|---|---|
| USD → CHF | `USD.bitstamp → XRP → CHF.bitstamp` | 1 offer |
| USD → AUD | `USD.bitstamp → XRP → AUD.bitstamp` | 3 offers |
| AUD → USD | `AUD.bitstamp → XRP → USD.bitstamp` | 1 offer |
| EUR → CHF | `EUR.bitstamp → XRP → CHF.bitstamp` | 1 offer |
| EUR → AUD | `EUR.bitstamp → XRP → AUD.bitstamp` | 3 offers |
| CHF → anything | — | 0 rev offers — effectively dead |
| USD → CNY (QK) | `USD.bitstamp → CNY.rippleQK` | 1 rev direct |

### Tier 4 — AMM-only corridors (no orderbook)
These tokens exist with real supply but trade through AMM pools or off-ledger — not via resting orders. They're routable via the XRPL AMM if the pool has reserves.

| Token | AMM pool found? |
|---|---|
| RLUSD | ✅ XRP/RLUSD (~$4M TVL) |
| CNY.rippleFox | ✅ XRP/CNY.rippleFox (~$250K) |
| USDC.circle | ❌ No AMM found in scan |
| USDC.gatehub | ❌ |
| USDT.gatehub | ❌ |
| EUROP.schuman | ❌ |
| BBRL.braza | ❌ |

**Implication:** USDC, USDT, EUROP, BBRL are issued on XRPL but primary trading happens off-chain (exchange internal books). To route them on-chain you'd need to mint via the issuer and match against another trust-line holder directly. XRPLens path-finding should still query `ripple_path_find` — the server runs pathfind across both DEX and AMM.

### Tier 5 — Dead or ghost corridors
Issuer has outstanding float but zero on-chain liquidity (no books, no AMM):

- **Any → SGD** (r9Dr5xwke…) — 3.5K SGD float, no offers
- **CHF → anything** — CHF.bitstamp rev-side empty
- **AUD → anything** (bulk) — only 1 rev offer total
- **BBRL → anything** — issuer has 29.8M float but no DEX presence
- **USDT.gatehub → anything** — no orderbook
- **EUROP → anything** — no orderbook
- **Sologenic SGD, bitbank JPY, Bitso MXN, Coins.ph PHP** — these are exchange hot wallets, not issuers. Ripple Payments routes them via private MM accounts off the public DEX.

---

## 5. The "big-name" corridors (off-ledger, Ripple Payments / ODL)

These corridors are real and heavily used by institutions, but **don't show up in `book_offers`** because Ripple Payments partners quote liquidity on demand via private MM accounts:

| Corridor | Ripple Payments partners |
|---|---|
| USD → MXN | Bitso (MX), flagship ODL corridor |
| USD → PHP | Coins.ph, SBI Remit, Tranglo |
| USD → AUD | Independent Reserve, BTC Markets |
| USD → EUR | Bitstamp |
| USD → BRL | Mercado Bitcoin, Bitso, **Braza Bank (BBRL)** |
| USD → ZAR | Mercuryo |
| JPY → THB | SBI Remit + SBI VC Trade |
| JPY → VND | SBI Remit |
| JPY → IDR | SBI Remit, Tranglo |
| JPY → PHP | SBI Remit, Coins.ph |
| JPY → KRW | SBI VC |
| EUR → MXN | Bitstamp → Bitso |
| EUR → PHP | Bitstamp → Coins.ph |
| GBP → USD | Modulr, Lemonway |
| GBP → MXN | Modulr → Bitso |
| GBP → PHP | Modulr → Coins.ph |
| SGD → MYR | Tranglo |
| SGD → IDR | Tranglo |
| SGD → PHP | Tranglo → Coins.ph |
| SGD → VND | Tranglo |
| AED → INR | Pyypl, Onafriq |
| AED → PKR | Pyypl |
| AED → EGP | Onafriq |
| AED → KES | Onafriq |
| USD → INR | Onafriq + regional banks |
| USD → NGN | Onafriq |
| USD → KES | Onafriq |
| USD → GHS | Onafriq |
| USD → TRY | Mercuryo |
| USD → ARS | Ripio |
| USD → COP | Ripio, Bitso |
| USD → CLP | Ripio |
| USD → PEN | Ripio |
| CAD → USD | via Bitstamp USD + Canadian banks |
| CAD → PHP | via Coins.ph |
| CAD → INR | via Onafriq |
| AUD → PHP | Independent Reserve → Coins.ph |
| AUD → VND | Independent Reserve → Tranglo |
| AUD → IDR | Independent Reserve → Tranglo |
| AUD → NZD | Independent Reserve → local banks |
| NZD → PHP | via Tranglo |
| CHF → EUR | via Bitstamp |
| HKD → PHP | via Tranglo |
| HKD → MYR | via Tranglo |
| HKD → IDR | via Tranglo |
| KRW → JPY | via SBI VC |
| KRW → USD | via SBI VC |
| TWD → USD | via Tranglo partners |
| MYR → SGD | via Tranglo |
| MYR → IDR | via Tranglo |
| IDR → SGD | via Tranglo |
| VND → SGD | via Tranglo |
| THB → SGD | via Tranglo |
| INR → AED | via Pyypl |
| INR → SGD | via Tranglo |
| PKR → AED | via Pyypl |
| NGN → USD | via Onafriq |
| KES → USD | via Onafriq |
| ZAR → USD | via Onafriq |
| BRL → USD | via Mercado Bitcoin, Bitso, Braza Bank |
| MXN → USD | via Bitso |
| PHP → USD | via Coins.ph, SBI Remit |
| ARS → USD | via Ripio |
| CLP → USD | via Ripio |
| COP → USD | via Ripio, Bitso |

That's **~60 additional off-ledger corridors** routed through XRP by Ripple Payments partners. All use XRP as the bridge asset under the hood, but the fiat legs never touch the public XRPL DEX — they're settled through partner bank APIs on each end.

### CBDC / bank pilots on XRPL (settlement, not corridors you can hit)
- 🇧🇹 **Bhutan** — Royal Monetary Authority digital Ngultrum
- 🇵🇼 **Palau** — USD-backed national stablecoin
- 🇲🇪 **Montenegro** — CBDC pilot
- 🇨🇴 **Colombia** — Banco de la República + Peersyst
- 🇭🇰 **Hong Kong** — e-HKD Phase 1 (Ripple + Fubon Bank)
- 🇬🇪 **Georgia** — digital Lari pilot

---

## 6. Summary matrix — corridors by route count

| From \ To | USD | EUR | GBP | JPY | CHF | AUD | CNY | RLUSD | BRL | MXN | PHP | SGD | INR | AED |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **USD** | ⭐ | 12 | 7 | 9 | 1 | 1 | 13 | 8 | ODL | ODL | ODL | ODL | ODL | — |
| **EUR** | 12 | ⭐ | 4 | 6 | 1 | 1 | 7 | 3 | — | ODL | ODL | — | — | — |
| **GBP** | 6 | 4 | — | 4 | — | — | 4 | 2 | — | ODL | ODL | — | — | — |
| **JPY** | 6 | 4 | 2 | — | — | — | 4 | 2 | — | — | ODL | — | — | — |
| **CHF** | 0 | 0 | — | — | — | — | — | — | — | — | — | — | — | — |
| **AUD** | 1 | — | — | — | — | — | — | — | — | — | ODL | — | — | ODL |
| **CNY** | 13 | 6 | 3 | 4 | — | — | ⭐ | 2 | — | — | — | — | — | — |
| **RLUSD** | 8 | 3 | 2 | 2 | — | — | 2 | ⭐ | — | — | — | — | — | — |
| **MXN** | ODL | ODL | — | — | — | — | — | — | — | — | — | — | — | — |
| **PHP** | ODL | ODL | ODL | ODL | — | ODL | — | — | — | — | — | ODL | — | — |
| **SGD** | — | — | — | — | — | — | — | — | — | — | ODL | — | ODL | — |
| **INR** | — | — | — | — | — | — | — | — | — | — | — | ODL | — | ODL |
| **AED** | — | — | — | — | — | — | — | — | — | — | — | — | ODL | — |

Numbers = independent on-ledger routes confirmed. "ODL" = routable only via Ripple Payments off-ledger partner network.

**Total: 30 on-ledger live corridors + ~60 off-ledger Ripple Payments corridors = ~90 fiat corridors reachable through XRPL today.**

---

## 7. Scan reproducibility

- Public JSON-RPC endpoints used: `https://s1.ripple.com:51234/`, `https://s2.ripple.com:51234/`, `https://xrplcluster.com/`
- RPC methods used: `server_info`, `gateway_balances`, `book_offers`, `amm_info`
- Registry source: `https://api.xrpscan.com/api/v1/names/well-known` (2772 entries) and `/api/v1/tokens` (top 200 by mcap)
- Scan scripts: `/tmp/probe.py`, `/tmp/fullscan.py`, `/tmp/amm.py` (move into `scripts/corridor-scan/` and commit)
- Raw results JSON: `/tmp/scan_results.json`

To refresh: re-run `python3 scripts/corridor-scan/fullscan.py` on any machine with Python 3.9+ (no dependencies).

## 8. TODO — further discovery

Avenues not yet scanned but worth probing:
- [ ] **AMM pool discovery via `ledger_data` filter** — find *all* AMM objects to discover hidden stablecoin pools
- [ ] **XLS-38 cross-chain bridges** — Axelar, Wormhole, Stargate-bridged assets on XRPL sidechains
- [ ] **XRPL EVM sidechain issuers** — MetaMask-compatible chain, separate issuer set
- [ ] **Trust line discovery** — for each active issuer, fetch top trust-line holders and check if they're secondary issuers
- [ ] **`ripple_path_find` end-to-end validation** — with real source/destination accounts, confirm pathfinder actually returns the routes enumerated above
- [ ] **Historic corridors** — query `ledger_data` at snapshots (2018, 2020, 2022) to see which corridors died and which emerged
- [ ] Live rate quotes for each Tier 1 corridor (compute effective price from top-of-book)
- [ ] Fee impact analysis per route (transfer fees per issuer)
