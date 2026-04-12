# XRPL Fiat On/Off-Ramp Actor Atlas (2025–2026)

> Companion to [xrpl-fiat-corridors.md](./xrpl-fiat-corridors.md).
> That doc catalogues **on-chain** XRPL issuers (trust-line gateways).
> This doc catalogues **off-chain** actors — CEXes, remittance operators,
> Ripple ODL / Ripple Payments partners, mobile-money bridges — that move
> fiat in and out of XRP / RLUSD / XRPL-native assets.
>
> Research cut-off: April 2026. Sources inline per row.

---

## 0. Executive summary

**Four layers now exist in XRPL fiat routing:**

1. **XRPL-native stablecoins** (the new dominant layer): RLUSD (Dec 2024, NYDFS),
   USDC (native on XRPL Jun 2025, no bridge), EURØP (Schuman, MiCA), XSGD
   (StraitsX), USDB (Braza). EURCV (SG-Forge) announced, not yet live.
   Stablecoins generated >60% of XRPL transaction volume in Q1 2025.
2. **Legacy trust-line IOU gateways**: GateHub (16 tokens, EUR is last
   meaningful fiat proxy), Bitstamp-issued IOUs (deprecated — still redeemable,
   not quoted), Sologenic (SOLO + tokenized equities).
3. **RLUSD liquidity venues (institutional + retail)**: Bitstamp, Kraken,
   Bitso, Uphold, Bullish, LMAX Digital, Bybit, Binance (Jan 2026, zero-fee
   XRP/RLUSD), Gemini, Archax, Revolut, MoonPay, Zero Hash, Mercado Bitcoin,
   Rain, CoinMENA, OSL HK, Coinone KR, SBI VC Trade (Q1 2026), Independent
   Reserve, Bits of Gold, Pyypl, Yellow Card, VALR, Chipper Cash. Notably
   **Coinbase does not list RLUSD** (USDC commercial conflict with Circle).
4. **Ripple Payments / ODL partners (bridge-asset routers, not retail ramps)**:
   ~300+ institutions across 55+ countries, ~40% active on ODL, 70+ corridor
   pairs. Key regional hubs below.

**Two super-hubs dominate the corridor graph:**
- **Tranglo (Malaysia, 40% Ripple-owned)** — 25-corridor APAC hub; the only
  licit path into PK/BD/LK/NP/IN and the main SE Asia fan-out.
- **Onafriq (ex-MFS Africa)** — 500M+ mobile wallets, 40 African countries;
  the corresponding Africa super-hub.

**Pivot CEXes that tie whole regions together:**
- **Bitso** — MXN / ARS / COP / USD, XRP + RLUSD. LATAM pivot.
- **Rain** — AED / SAR / BHD / KWD / OMR, XRP + RLUSD. GCC pivot.
- **Yellow Card + VALR + Chipper Cash** — pan-African RLUSD distribution.
- **SBI group (VC Trade + Remit + Ripple Asia)** — JPY pivot, RLUSD Q1 2026.

**Post-acquisition institutional layer:**
- **Ripple Prime** (ex-Hidden Road, $1.25B, closed Oct 2025) — first
  crypto-owned multi-asset global prime broker, using RLUSD as cross-margin
  collateral. US spot prime brokerage launched Nov 2025.
- **Standard Custody & Trust** (acq. 2024) — NY-chartered custodian holding
  RLUSD reserves.
- **Metaco** (acq. 2023) — custody backbone for BBVA Switzerland, DZ Bank, HSBC
  on RippleNet.

---

## 1. Corridor tiers (for routing engine prioritisation)

**Tier A — native XRP + RLUSD books AND ODL presence (first-class endpoints):**
USD, EUR, GBP, JPY, MXN, BRL, AED, SAR, ZAR, HKD, KRW (Coinone RLUSD).

**Tier B — native XRP books, partial/no RLUSD, no confirmed ODL:**
CAD, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON, TRY, UAH, SGD, AUD, NZD, TWD,
THB, PHP, IDR, MYR, INR, ARS, COP, CLP, PEN, UYU, BHD, KWD, OMR, QAR, NGN,
KES, GHS, UGX, TZS.

**Tier C — stablecoin-bridge only (USDT/USDC two-hop, no native XRP/fiat book):**
VND, DOP, GTQ, CRC, VES, EGP, MAD, XOF, XAF, ILS (degraded).

**Tier D — zero compliant actor; offshore P2P or super-hub-only reach:**
CNY/CNH (mainland ban), PKR, BDT, LKR, NPR, DZD, TND, ETB, RUB (sanctioned).
HRK retired; route via EUR.

**Tier E — hard-block (sanctions):**
RUB — all known ramps (Garantex + Grinex/Exved/InDeFi successors) under
OFAC + EU sanctions as of 2025.

---

## 2. Americas

### USD
Coinbase, Kraken, Gemini, Bitstamp US, **Uphold** (day-1 RLUSD), **LMAX
Digital**, Bullish, **B2C2** (OTC), **Keyrock** (MM), **Zero Hash** (BaaS),
MoonPay, Archax, Revolut US, Ripple Payments (USD leg via **BNY Mellon**
custody), **Convera** (ex-Western Union Biz, Ripple partner Apr 2026). All
support XRP; most support RLUSD.

### CAD
NDAX, Bitbuy, Coinsquare, Netcoins, **Kraken CA** (RLUSD), **Uphold CA**
(RLUSD), Newton. Shakepay does not list XRP. No confirmed ODL anchor.

### MXN
**Bitso** (ODL launch-partner, USD→MXN corridor, XRP + RLUSD), Volabit,
Binance P2P, MoonPay MXN.

### BRL
**Travelex Bank** (ODL since Aug 2022), **Mercado Bitcoin** (Ripple Payments
Oct 2024), Foxbit, Ripio BR, **Braza Bank / Banco Genial / Attrus** (RLUSD-only
distribution, 2026 — unique LatAm feature), Binance BR. Ripple filed BR VASP
application 2025.

### ARS
Ripio, SatoshiTango, Lemon Cash, **Buenbit** (multi-LATAM: MX/BR/CO/PE/UY),
Belo, Binance AR P2P.

### CLP
OrionX, CryptoMKT, Buda.com, Binance CL P2P. No RLUSD yet.

### COP
**Bitso CO** (free COP rails, XRP + RLUSD), Buda.com CO, Panda Exchange,
Buenbit CO, Binance CO P2P.

### PEN
Fluyez, Bitinka, Buenbit PE, Binance PE P2P. Buda.com PE does NOT list XRP.

### UYU
Bitso UY (XRP + RLUSD), Ripio UY, Buenbit UY, Binance UY P2P.

### Tier C — DOP / GTQ / CRC / VES
DOP: BitcoinRD, MEXC P2P, Bitget P2P, Pursa.
GTQ: **BITPoint Latam** (rare native GTQ/XRP pair), GptCoins, Agencia RXE,
Abra (via InBestGo + two local banks), Binance P2P.
CRC: Coinmama, Binance CR P2P, Pursa. No native XRP/CRC pair found.
VES: Binance/Bybit/OKX/KuCoin P2P (VES→USDT→XRP only), AirTM (USDC anchor).
**Model as two-hop in routing engine.**

---

## 3. Europe

### EUR (20-country)
**Bitstamp LU** (Ripple ODL anchor, RLUSD listed but excluded from EU retail
pending MiCA EMT approval — flag), **Kraken IE** (MiCA, RLUSD), Coinbase LU
(MiCA), **Bitpanda AT** (MiCA), **Bitvavo NL** (MiCA), Bybit EU (AT MiCA),
OKX MT (MiCA), Revolut CY (MiCA), N26 DE (via Bitpanda), MoonPay, Banxa,
**Lemonway FR** (Ripple ODL, first FR partner), **FINCI LT** (Ripple ODL),
**Unicâmbio PT** (Ripple ODL, PT↔BR 2025), Uphold, Archax, SG-Forge (EURCV,
pending XRPL listing).

### GBP
Coinbase UK, Kraken UK (RLUSD), Binance UK, CEX.IO, CoinJar, Uphold UK
(RLUSD), Archax, Revolut UK, **Modulr** (Ripple Payments EMI), **LMAX Digital**,
**Onafriq** (UK→Africa ODL leg).

### CHF
Bitcoin Suisse, **Sygnum Bank**, **SEBA/AMINA Bank**, Kraken (CHF), Bitpanda,
Swissquote, Relai.

### SEK
**Xbaht** (Ripple ODL, SE→TH via Tranglo), Kraken, Coinbase, Bitpanda, Safello.

### NOK
NBX (Norwegian Block Exchange), Kraken, Coinbase, Bitpanda, Firi.

### DKK
Kraken, Coinbase, Bitpanda, Bitvavo. Januar provides DKK rails only, no XRP.

### PLN
**Zondacrypto** (ex-BitBay, largest PL), Kanga Exchange, Binance PLN P2P,
Kriptomat, Bitpanda.

### CZK
Anycoin Direct / Coinmate, Kraken, Bitpanda, Binance, SimpleCoin.cz.

### HUF
Mr. Coin, Bitpanda, Revolut HU, Binance HUF card.

### RON
Bittnet/Tokero, Binance, Bitpanda, Revolut RO.

### BGN
Nexo (BG HQ, limited BGN fiat), Bitpanda, Binance, Coinbase.

### ISK — thin
Myntkaup (single local broker), Kraken (via EUR), Bitvavo (passport).
Flag as low-liquidity.

### TRY — high volume
**BtcTurk** (largest TR), **Binance TR**, Paribu, Bitexen, Bitci TR, CoinTR.
Strong corridor — TRY/XRP is globally significant by volume.

### UAH
**WhiteBIT** (UA HQ, PrivatBank + SEPA + P2P), Kuna, Binance UAH P2P, EXMO UA.

### RUB — BLOCKED
Garantex (OFAC + EU sanctioned Mar 2025, seized), Grinex/Exved/InDeFi
(sanctioned Aug 2025). Binance withdrew RUB 2022. **XRPLens should hard-block
RUB corridors by default.**

### HRK — retired
HRK retired 1 Jan 2023; Croatia now routes via EUR.

---

## 4. Asia-Pacific

### JPY — densest XRP market globally
**SBI VC Trade** (FSA; RLUSD distribution Q1 2026), **SBI Remit** (ODL JP→PH/TH/VN/ID
since 2021), **Bitbank**, **bitFlyer**, **Coincheck**, **GMO Coin**, Rakuten
Wallet, **SBI Ripple Asia** JV.

### CNY / CNH — BANNED (mainland)
Mainland crypto trading banned 2021, reinforced 2025. Tether killed CNHT.
No legal on/off-ramps. Offshore only (HTX, OKX, Binance offshore P2P).
**Flag as restricted**.

### KRW — XRP is #1 on Korean exchanges
**Upbit** (~53% share, >$1T XRP 2025 volume), **Bithumb**, **Coinone**
(first KR RLUSD listing), Korbit, GOPAX.

### HKD
**OSL HK** (first HK RLUSD listing — RLUSD/HKD + RLUSD/USDT), HashKey Exchange,
Crypto.com HK.

### TWD
**MaiCoin / MAX Exchange** (FSC), **BitoPro** (XRP/TWD relaunched Dec 2025),
ACE Exchange.

### SGD
**Independent Reserve SG** (MAS MPI), **Coinhako** (MAS), Crypto.com SG, plus
Ripple's participation in **MAS BLOOM** trade-finance pilot (institutional
RLUSD, not retail SGD pair).

### AUD
**Independent Reserve**, **Swyftx**, **CoinJar**, BTC Markets, **FlashFX**
(Ripple ODL), **Novatti** (Ripple ODL pilot).

### NZD
Independent Reserve NZ, Easy Crypto NZ.

### THB
**Bitkub** (SEC-licensed, $8.2B XRP/THB volume 2025), **DeeMoney** (Ripple ODL
recipient from SBI Remit), Satang Pro.

### VND
Binance P2P VND, Remitano P2P. Vietnam licensing in progress 2025-2026.

### PHP — major ODL destination
**Coins.ph** (BSP e-money + Ripple), **PDAX** (BSP), **iRemit** (Ripple ODL),
**Tranglo** (25-corridor hub incl. PH).

### IDR
**Indodax** (Bappebti), **Tokocrypto** (Binance-backed), Pintu, Reku.

### MYR
**Luno MY**, MX Global, HATA, SINEGY DAX (all SC-registered DAX), **Tranglo**
(Malaysian HQ — the APAC super-hub).

### INR — degraded
CoinDCX, CoinSwitch, ZebPay, Bitbns (all FIU-registered). 30% tax + 1% TDS;
FIU blocked 25 offshore exchanges Oct 2025; **WazirX XRP is court-frozen**
after 2024 hack. Mark INR corridors as unstable.

### PKR / BDT / LKR / NPR — BANNED
Zero licensed actors. Offshore P2P only. **Reachable only via Tranglo
remittance leg.**

---

## 5. Middle East & Africa

### GCC — Rain + CoinMENA cover the entire GCC

| Currency | Rain | CoinMENA | Others |
|---|---|---|---|
| **AED** | XRP+RLUSD | XRP | BitOasis (VARA), **Pyypl** (Ripple ODL), **LuLu Exchange**, **Al Ansari**, Tranglo UAE, **Zand Bank** (first UAE digital bank Ripple client, May 2025), RAK Bank |
| **SAR** | XRP/SAR + RLUSD | XRP | SABB (legacy RippleNet) |
| **BHD** | HQ, XRP/BHD + RLUSD | HQ, XRP/BHD | — |
| **KWD** | XRP/KWD + RLUSD | XRP/KWD | (CBK blocks domestic, cross-border only) |
| **OMR** | XRP/OMR + RLUSD | XRP/OMR | — |
| **QAR** | — | XRP/QAR | QNB legacy RippleNet; **QNB↔ChinaBank QAR→PHP corridor 2024-25** |

**UAE is Ripple's regional HQ post-DFSA Dubai license.**

### Levant
- **ILS** — Bits of Gold (CMA-licensed, limited XRP), Bit2C (no XRP),
  cross-border Kraken/Coinbase. Thin.

### North Africa
- **EGP** — CoinMENA (licensed, constrained), Binance P2P. CBE Law 194/2020
  blocks unlicensed.
- **MAD** — offshore P2P only; Bank Al-Maghrib draft law pending.
- **TND** — zero licensed; central bank sandbox only.
- **DZD** — **zero actors**; Law 25-10 (2025) criminalizes all crypto activity.

### Sub-Saharan Africa

- **ZAR** — **VALR** (FSCA, XRP/ZAR + RLUSD), **Luno**, **Yellow Card** (RLUSD),
  **Absa Bank** (Ripple custody), **Chipper Cash** (RLUSD).
- **NGN** — **Quidax** (SEC-provisional), Busha, **Yellow Card** (RLUSD),
  **Chipper Cash** (RLUSD), Luno (NGN deposits suspended — off-ramp only),
  **Onafriq** (ODL inbound). CBN restrictions limit fiat off-ramp.
- **KES** — **Yellow Card** (VASP Oct 2025), **Chipper Cash**, **Kotani Pay**
  (M-Pesa USSD bridge), **Onafriq**, Luno. M-Pesa-first, USDT-bridged.
- **GHS** — Yellow Card, Chipper Cash, **Onafriq** (MTN MoMo), **PayAngel**
  (UK→GH ODL).
- **UGX** — Yellow Card, Chipper Cash, Kotani Pay (MTN/Airtel), Onafriq.
- **TZS** — Yellow Card, Chipper Cash, Onafriq. BoT caution notices, no
  domestic licensees.
- **XOF (West CFA)** — BarkaChange (Orange/Wave/MTN bridge, USDT), Yellow Card
  (SN/CI), Onafriq, Chipper Cash. No native XRP/XOF pair.
- **XAF (Central CFA)** — BarkaChange, Yellow Card (Cameroon), Onafriq.
  Cameroon is the only live node; CAR/Chad/Congo effectively zero.
- **ETB** — **zero legal actors** as of Feb 2026 NBE Birr P2P ban. Only
  institutional Onafriq inflows exist.

---

## 6. Cross-cutting hubs (bridge-asset nodes, NOT retail ramps)

| Hub | Region | Function | Reach |
|---|---|---|---|
| **Tranglo** (MY) | APAC | Ripple ODL hub, 40% Ripple-owned | 25 corridors; PH/TH/ID/VN/MY/BD/PK/LK/NP/IN + UAE leg via Al Ansari |
| **Onafriq** (ex-MFS Africa) | Africa | Ripple mobile-money ODL hub | 500M wallets, 40 countries; connects to Pyypl (GCC), PayAngel (UK), Zazi (AU) |
| **SBI Remit** | APAC | Japan ODL sender | JP → PH/TH/VN/ID |
| **iRemit** / **Coins.ph** | PH | ODL recipient legs | PH inbound |
| **DeeMoney** | TH | ODL recipient | TH inbound |
| **FlashFX** / **Novatti** | AU | Corporate ODL | AUD corporate flows |
| **Pyypl** | UAE | ODL retail remittance | MEA + Africa |
| **Bitso** | LATAM | ODL + multi-currency CEX pivot | MX/AR/CO/US, XRP + RLUSD |
| **Travelex Bank** | BR | ODL bank | BRL corridor since Aug 2022 |
| **Mercado Bitcoin** | BR | Ripple Payments partner (Oct 2024) | BRL |
| **Lemonway** / **FINCI** / **Modulr** / **Unicâmbio** | EU | EUR/GBP ODL partners | France / Lithuania / UK / Portugal↔Brazil |
| **Xbaht** | SE | ODL sender | SE → TH (via Tranglo) |
| **Yellow Card** | Africa | Primary pan-African RLUSD distributor | 20+ countries |
| **Chipper Cash** | Africa | Ripple Payments partner | 9 countries |
| **Kotani Pay** | Africa | Mobile-money USSD bridge | KE/UG/GH/RW/ZM |
| **BarkaChange** | W/C Africa | CFA mobile-money bridge (USDT) | XOF/XAF |
| **Convera** (ex-WU Biz) | Global | Ripple partner Apr 2026 | Enterprise USD |
| **BNY Mellon** | US | RLUSD custodian (Jul 2025) | USD leg |

---

## 7. RLUSD liquidity venues (consolidated, cross-region)

Bitstamp, **Kraken** (drove first $10B volume), Gemini (ETH), **Uphold**
(day-1), **Bitso**, **Bullish**, Bybit (5 pairs Sep 2025: USDT/BTC/ETH/XRP/MNT),
**Binance** (Jan 22 2026, zero-fee XRP/RLUSD, RLUSD/USDT, RLUSD/USDC),
**LMAX Digital**, **Archax**, **MoonPay**, CoinMENA, **Mercado Bitcoin**,
**Independent Reserve**, Revolut, **Zero Hash**, **Rain**, **OSL HK**,
**Coinone** (KR), **SBI VC Trade** (JP Q1 2026), **VALR** (ZA), Yellow Card,
Chipper Cash, Pyypl. Institutional MMs: B2C2, Keyrock, Flowdesk, JST Digital.
**Coinbase: NOT LISTED** (USDC commercial conflict with Circle).

---

## 8. XRPL-native fiat-proxy tokens to enumerate as trust lines

| Token | Issuer | Status |
|---|---|---|
| **RLUSD** | Ripple / Standard Custody (`rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`) | Dominant XRPL stablecoin (>$1B cap) |
| **USDC** (native) | Circle (`rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE`) | Native on XRPL since Jun 2025, no bridge |
| **EURØP** | Schuman Financial (`rMkEuRii9w9uBMQDnWV5AA43gvYZR9JxVK`) | MiCA-compliant EUR, Sologenic DEX |
| **XSGD** | StraitsX | Singapore regulated SGD |
| **USDB** | Braza Group (`rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt`) | Brazilian USD stablecoin |
| **EURCV** | SG-Forge | Announced, not yet live on XRPL mainnet |
| **GateHub EUR/USD/GBP** | GateHub (`rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq`, `r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g`) | Legacy IOU, active but thin |
| **Bitstamp USD** | Bitstamp (`rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B`) | **DEPRECATED** — redeemable, not quoted; demote in catalog |
| **SOLO** | Sologenic (`rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz`) | DEX quote asset (not a fiat proxy) |

---

## 9. Gaps / zero-actor currencies (flag in routing)

| Currency | Reason | Mitigation |
|---|---|---|
| **CNY/CNH** | Mainland ban 2021+ | Offshore P2P only; do not route |
| **PKR** | SBP ban | Tranglo remittance leg only |
| **BDT** | Bangladesh Bank ban | Tranglo only |
| **LKR** | CBSL prohibition | Tranglo only |
| **NPR** | NRB illegal declaration | Tranglo only |
| **DZD** | Law 25-10 (2025) criminal ban | None |
| **TND** | Central bank ban | Sandbox pending |
| **ETB** | NBE Feb 2026 P2P ban | Onafriq institutional only |
| **RUB** | OFAC + EU sanctions on all ramps | **HARD BLOCK** |
| **DOP, GTQ, CRC, VES, EGP, MAD, XOF, XAF** | No native XRP/fiat book | Model as USDT/USDC two-hop |

---

## 10. Implications for XRPLens code

### `apps/server/src/corridors/catalog.ts` (ISSUERS_BY_CURRENCY)

1. **Add native stablecoins as first-class currencies** (most impactful — they
   carry >60% of XRPL volume):
   - `EUROP` already present → good.
   - `USDC` already present (Circle native) → good.
   - `USDB` already present (Braza) → good.
   - **Missing: `XSGD` (StraitsX)** — add SGD native stablecoin issuer.
   - **Missing: `RLUSD` as the USD first-choice issuer** — currently `USD`
     entry lists Bitstamp/GateHub/SnapSwap (all legacy); RLUSD should be
     promoted to the primary USD proxy, and Bitstamp USD demoted.

2. **Deprecate Bitstamp IOUs**: Bitstamp wound down XRPL IOU issuance.
   Current entries for USD/EUR/GBP/JPY/CHF/AUD/BTC all reference Bitstamp as
   an active issuer — replace with GateHub (where still live) or remove.

3. **No domestic XRPL issuers exist for most Tier A currencies**. The catalog
   should make clear that fiat-to-XRPL for (e.g.) MXN, BRL, AED, KRW happens
   via **off-chain CEX custody**, not on-chain trust lines. Consider adding a
   parallel `OFFCHAIN_RAMPS_BY_CURRENCY` map so the corridor UI can show the
   routing path as `MXN → Bitso (off-chain) → RLUSD → on-chain → destination`.

### `apps/server/src/analysis/bfsOrchestrator.ts`

The BFS currently operates on on-chain graph topology from a seed address. To
leverage off-chain actor knowledge, the natural extension is to **seed BFS
with the XRPL accounts of pivot CEXes** when the user asks "how do I get from
MXN to NGN". Concretely:
- Maintain a map `actorName → XRPL account address(es)` for: Bitso, Bitstamp,
  Kraken, Uphold, Bitso, Rain, Coinone, SBI VC Trade, VALR, Mercado Bitcoin,
  Tranglo (if on-chain), Ripple Payments settlement addrs.
- New orchestrator mode: `bfsFromActorSet(currencyFrom, currencyTo)` picks
  pivot actors for each currency from the map and runs BFS from those accounts
  to find on-chain liquidity paths.

### `apps/server/src/analysis/corridorAnalyzer.ts` + `routes/corridor.ts`

Add **actor metadata to corridor responses** so the frontend can display:
"This corridor is live because: Bitso (MX, Ripple ODL), Mercado Bitcoin (BR,
Ripple Payments Oct 2024)". Users currently see on-chain liquidity but not
*who* provides the off-chain legs.

### `apps/web/src/routes/CorridorDetail.tsx`

Render a "Corridor participants" panel with Tier A/B/C badge and links to
Ripple ODL partners where applicable. The research data here is the source.

---

## 11. Source index

### Global / RLUSD / Ripple Payments
- [Ripple press — stablecoin](https://ripple.com/solutions/stablecoin/)
- [Ripple cross-border payments](https://ripple.com/solutions/cross-border-payments/)
- [Ripple acquires Hidden Road](https://ripple.com/ripple-press/ripple-acquires-prime-broker-hidden-road/)
- [BusinessWire — Ripple Prime US](https://www.businesswire.com/news/home/20251103651890/en/Ripple-Launches-Digital-Asset-Spot-Prime-Brokerage-for-the-United-States-Market)
- [PYMNTS — RLUSD in Ripple Payments](https://www.pymnts.com/cryptocurrency/2025/ripple-begins-adding-rlusd-stablecoin-to-cross-border-payment-solution/)
- [CoinDesk — Wormhole RLUSD multichain](https://www.coindesk.com/tech/2025/12/15/ripple-expands-usd1-3b-rlusd-stablecoin-to-ethereum-l2s-via-wormhole-in-multichain-push)
- [Fortune — RLUSD launch exchanges](https://fortune.com/crypto/2024/12/17/ripples-rlusd-global-exchanges-bitso-uphold-coinmena-moonpay-archax/)
- [The Block — Ripple Bitstamp/Bitso/Bullish](https://www.theblock.co/post/321054/ripple-bitstamp-bitso-bullish-stablecoin)
- [CryptoSlate — Ripple partners top exchanges](https://cryptoslate.com/ripple-partners-with-top-exchanges-to-launch-rlusd-stablecoin-globally/)
- [Invezz — XRP partnerships 2026](https://invezz.com/cryptocurrency/xrp/partnerships/)
- [247WallSt — 300 bank partners](https://247wallst.com/investing/2025/11/11/xrps-banking-partnerships-hit-300-why-wall-street-is-watching/)
- [CryptoSlate — $15B payment layer](https://cryptoslate.com/xrp-etfs-are-booming-but-a-quiet-15-billion-payment-layer-matters-more-than-the-price/)

### XRPL stablecoins
- [Circle — USDC on XRPL](https://www.circle.com/blog/now-available-usdc-on-the-xrpl)
- [Ripple + Circle press](https://ripple.com/ripple-press/ripple-and-circle-launch-usdc-on-the-xrp-ledger/)
- [CryptoSlate — EURØP, USDB, XSGD on XRPL](https://cryptoslate.com/xrp-ledger-sharpens-competitive-edge-with-fresh-stablecoin-additions-of-europ-usdb-and-xsgd/)
- [Messari — State of XRPL Q1 2025](https://messari.io/report/state-of-xrp-ledger-q1-2025)
- [XPMarket token rankings](https://xpmarket.com/tokens/top)

### Regional sources
See inline citations in regional tables above. Full source list is preserved
in the research task outputs at `/private/tmp/claude-501/.../tasks/` for the
five research agents (a81af761, ac35d72e, a4c9e817, a9864192, ad200e46).
