# Actor Upgrade Spec — what a "complete" actor row looks like

> Companion to [xrpl-fiat-actors.md](./xrpl-fiat-actors.md) (the registry)
> and [roadmap.md](./roadmap.md) (the delivery plan).
>
> **Purpose:** catalogue every attribute XRPLens should know about each
> off-chain partner in the corridor registry. Today we have ~8 fields
> per actor (name, type, country, XRP/RLUSD/ODL flags, direction, note,
> URL). This doc is the v2/v3 vision — the full data model that turns
> the actor row from a research fact into a real-time product surface.
>
> **Demo anchor:** the Bitso `xrp_mxn` live orderbook badge shipped in
> v1 is the proof-of-concept for the **Measured, not assumed** tier
> below. Every other tier is a follow-on from there.

---

## The five upgrade tiers

Each actor row can be upgraded across five independent tiers. Tiers
unlock features in the UI. Lower tiers are cheaper to build; higher tiers
are harder to replicate and drive the pricing model.

| Tier | Name | What it adds | Cost to ship | Defensibility |
|---:|---|---|---|---|
| 1 | **Identity** | canonical name, legal entity, domains, logo, founded date | low — scraping + manual | low — anyone can do it |
| 2 | **Regulatory** | licences, jurisdictions, VASP registrations, sanctions flags | medium — regulatory data + monitoring | medium — boring but painful |
| 3 | **Capabilities** | full asset support matrix, supported networks, API availability, fee schedule, limits | medium — partner API aggregation | medium |
| 4 | **Measured, not assumed** *(v1 demo for Bitso is here)* | **live orderbook depth, spread, fill probability, outage history, uptime %** | high — per-partner integration + monitoring infra | **HIGH** |
| 5 | **Reputation** | user sentiment, support responsiveness, incident post-mortems, partner ratings | highest — continuous scraping + editorial | **HIGHEST** — hardest to copy |

---

## Tier 1 — Identity (the business card)

**Fields to add per actor:**

```ts
interface ActorIdentity {
  legalName: string;          // "Bitso SAPI de CV"
  dbaName?: string;           // "Bitso"
  founded?: string;           // "2014"
  headquarters?: string;      // "Mexico City, MX"
  parentCompany?: string;     // null | "Tranglo Sdn Bhd" | "Ripple Labs"
  primaryDomain?: string;     // "bitso.com"
  logoUrl?: string;           // CDN link
  socials?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
  description?: string;       // 1-sentence positioning
}
```

**UI impact:**
- Actor card gets a logo, not just a type badge
- Hover card on the partner graph shows "founded / HQ / parent"
- API returns structured identity for integrators

**How to get it:** scrape OpenCorporates, LinkedIn, Wikipedia, partner press kits. Offline job, refresh monthly.

---

## Tier 2 — Regulatory posture (the compliance lens)

**The single biggest unlock for enterprise buyers.** Compliance teams at PSPs and fintechs need to know which partners are licensed where *before* they route a payment.

```ts
interface ActorRegulatory {
  licences: Array<{
    authority: string;        // "CNBV Mexico" | "DFSA UAE" | "MAS Singapore"
    type: string;             // "VASP" | "Payment Institution" | "E-Money Institution" | "Broker-Dealer"
    scope: string[];          // ["custody", "exchange", "transmission"]
    licenceNumber?: string;
    issuedAt?: string;
    expiresAt?: string;
    sourceUrl: string;        // official regulator registry link
  }>;
  jurisdictions: {
    operatesIn: string[];     // ISO-2 countries where actively licensed
    deniedFrom: string[];     // jurisdictions they explicitly exclude
    sanctionedBy: string[];   // OFAC / EU / UN sanction designations
    warningsFrom: string[];   // regulators that have issued cautions
  };
  complianceScore: number;    // 0-100, derived
  lastAuditedAt: string;
}
```

**UI impact:**
- Red exclamation icon next to any actor with sanctions or warnings
- Jurisdiction filter on `/route` — "only show partners licensed in EU"
- Compliance export PDF includes the full licence chain per route
- Actor detail shows a map of operating jurisdictions

**How to get it:** regulatory registries (FCA, DFSA, MAS, BaFin, CNBV, CNMV), OFAC SDN list, EU sanctions list. Automated daily refresh.

**Business value:** this is the feature a compliance buyer pays $15k/year for.

---

## Tier 3 — Capabilities matrix (the technical spec)

```ts
interface ActorCapabilities {
  assets: {
    fiat: string[];           // ISO-4217 codes supported for deposit/withdrawal
    crypto: string[];         // BTC, ETH, XRP, RLUSD, USDC, …
    xrplIous: string[];       // XRPL-native tokens the actor holds
  };
  networks: {
    onRampFiat: Array<{ method: "wire" | "sepa" | "ach" | "card" | "cash" | "mobile_money"; feePct?: number; minAmount?: string; maxAmount?: string }>;
    offRampFiat: Array<{ method: string; feePct?: number; etaMinutes?: number }>;
  };
  apis: {
    publicOrderbook?: string;        // URL if available
    publicTradeFeed?: string;
    partnerAPI?: string;             // OAuth / key / none
    webhookSupport?: boolean;
    rateLimit?: string;              // "60 req/min"
  };
  limits: {
    dailyMaxPerUser?: string;        // "100,000 USD equiv"
    dailyMaxTotal?: string;
    kycTiers?: Array<{ tier: number; limit: string; requirements: string[] }>;
  };
  xrplIntegration: {
    hasXrplAccount: boolean;
    knownAccountAddresses?: string[];  // r-addresses we can scan on-chain
    supportsDestinationTag: boolean;
    supportsMemo: boolean;
  };
}
```

**UI impact:**
- `/route` can factor in **real fees** when ranking partners (today we ignore them)
- Actor detail shows supported deposit methods with fees and ETAs
- `xrplIntegration.knownAccountAddresses` lets us **cross-scan on-chain activity** — "Bitso holds 12.4M RLUSD on XRPL right now"
- API consumers can filter by capability: "give me all corridors where both sides support SEPA + instant withdrawal"

**How to get it:** public fee pages + API docs scraping, supplemented by direct partner outreach for non-public details.

---

## Tier 4 — Measured, not assumed ⭐ *(v1 Bitso demo is here)*

**The highest-value tier. This is the v2 vision.** Every actor row gets a live measured feed right next to its research-based classification.

```ts
interface ActorLiveDepth {
  // What XRPLens already shows for Bitso (v1 PoC):
  orderbook: {
    venue: string;                 // "Bitso"
    book: string;                  // "xrp_mxn"
    bidCount: number;
    askCount: number;
    topBid: { price: string; amount: string };
    topAsk: { price: string; amount: string };
    spreadBps: number;
    bidDepthBase: string;          // cumulative base-currency depth
    askDepthBase: string;
    fetchedAt: string;
  };
  // The next level up — simulated fill pricing:
  quotes: Array<{
    sizeBase: string;              // "1000 XRP", "10000 XRP", "100000 XRP"
    slippageBps: number;           // what the spread looks like at that size
    effectivePrice: string;
  }>;
  // Historical — the real moat:
  depthHistory: Array<{
    at: string;
    midPrice: string;
    bidDepthBase: string;
    askDepthBase: string;
  }>;                              // 30-day rolling, one sample per 15min
  // Reliability signal:
  uptime: {
    last24h: number;               // 0.0 — 1.0
    last7d: number;
    last30d: number;
    incidents: Array<{
      startedAt: string;
      resolvedAt?: string;
      kind: "api_down" | "withdrawals_disabled" | "delisted" | "maintenance";
      evidence: string;            // status page URL
    }>;
  };
}
```

**UI impact:**
- Every actor in the partner graph gets a **live pulse dot** ( green = fresh, amber = stale, red = unreachable )
- `/route` quote becomes **real** — "USD → MXN via Bitso, deliver ~16,842 MXN, 18 bps slippage at this size"
- Corridor status can be downgraded from GREEN to AMBER automatically when a partner's orderbook thins below threshold, regardless of the categorical score
- API subscribers can webhook on `partnerDepth.drop` events — the first real alerting product

**How to get it:** per-partner integration. Bitso (done, v1), Kraken (easy, public API), Uphold (SDK), Mercado Bitcoin (public), Bitkub (public), Rain (API on request), VALR (public), Independent Reserve (public). Mobile-money hubs (Kotani Pay, BarkaChange) require partner API keys. Budget: 1 integration per week.

**Business value:** this is where the product becomes a **monitor**, not an atlas. Bloomberg Terminal energy.

---

## Tier 5 — Reputation & social (the human layer)

The most editorial, the hardest to automate, the highest moat.

```ts
interface ActorReputation {
  incidents: Array<{
    at: string;
    title: string;                // "Withdrawals paused after custody audit"
    severity: "low" | "med" | "high" | "critical";
    resolvedAt?: string;
    postMortemUrl?: string;
    impact: string;               // narrative summary
  }>;
  sentiment: {
    trustpilot?: { score: number; reviewCount: number; lastUpdated: string };
    reddit?: { mentions30d: number; netSentiment: number }; // -1..+1
    twitter?: { mentions30d: number; netSentiment: number };
    appStoreAvg?: number;         // 0-5
  };
  support: {
    responseTimeHours?: number;   // median, measured from public tickets
    supportedChannels: string[];
    availabilityHours: string;    // "24/7" | "business hours JPY"
    languages: string[];
  };
  partnerRatings?: {
    rippleODLTier?: string;       // if Ripple publishes a tier
    internalXRPLensScore: number; // 0-100, editorial
  };
}
```

**UI impact:**
- Actor detail page gets a "reputation" tab with timeline of incidents
- `/route` ranking factors in 30-day incident count (AMBER if >1 high-severity)
- Corridor chat RAG can answer "has Bitso had any incidents recently?"

**How to get it:** social listening (Reddit, X, Trustpilot), app store scraping, manual editorial curation of incidents. This is the hardest thing to replicate and the most valuable to a buyer who's doing due diligence.

---

## Feature matrix — what each tier unlocks in the product

| Feature | T1 Identity | T2 Regulatory | T3 Capabilities | T4 Live Depth | T5 Reputation |
|---|:---:|:---:|:---:|:---:|:---:|
| Actor card has logo | ✓ | ✓ | ✓ | ✓ | ✓ |
| Jurisdiction filter on `/route` | | ✓ | ✓ | ✓ | ✓ |
| Compliance PDF export with licence chain | | ✓ | ✓ | ✓ | ✓ |
| Real fee + ETA in `/route` quote | | | ✓ | ✓ | ✓ |
| On-chain activity cross-scan (holds N RLUSD) | | | ✓ | ✓ | ✓ |
| **Live orderbook badge** (Bitso v1) | | | | ✓ | ✓ |
| **Real quote** with simulated slippage | | | | ✓ | ✓ |
| Automatic status downgrade on depth thinning | | | | ✓ | ✓ |
| Webhook alerts on partner drop | | | | ✓ | ✓ |
| Incident timeline per actor | | | | | ✓ |
| Reputation-weighted corridor ranking | | | | | ✓ |
| RAG chat answers "any incidents lately?" | | | | | ✓ |

---

## Priority partners to upgrade first (the demo order)

Order by **importance × upgrade difficulty**. Easy wins first, hard partners later.

1. **Bitso** ⭐ — T4 live depth (xrp_mxn) ✓ **DONE v1**. Next: T1 identity + T2 regulatory.
2. **Kraken** — T4 public orderbook API (RLUSD/USD, RLUSD/EUR, XRP/USD). Easy.
3. **Uphold** — T4 SDK, multi-asset. Medium.
4. **Mercado Bitcoin** — T4 public API. Easy. Critical for BRL corridors.
5. **Bitstamp (EU)** — T4 public orderbook. Easy. Validates the legacy-IOU-on-chain story.
6. **Bitkub** — T4 public API. Easy. Critical for THB corridors.
7. **VALR** — T4 public API. Easy. Anchors ZAR corridors.
8. **Rain** — T4 API on request. Medium. Anchors all GCC corridors with one integration.
9. **Coins.ph / PDAX** — T4 partner API required. Medium. Critical for PHP corridors.
10. **Tranglo** — T4 partner API required + editorial (opaque B2B hub). Hard but high-value — unlocks depth for 25 APAC corridors at once.
11. **Onafriq** — same as Tranglo, for Africa.
12. **Yellow Card** — T4 partner API + T5 reputation (African fintech sentiment is specific). Medium-hard.

Target: **2 partners live per week** = 6 months to full T4 coverage across the top ~50 actors. The remaining long tail stays at T1/T2 and is fine for an atlas.

---

## Data model evolution

```ts
// Current (v1) — in apps/server/src/corridors/catalog.ts
interface CorridorActor {
  key: string;
  name: string;
  type: CorridorActorType;
  country?: string;
  supportsXrp?: boolean;
  supportsRlusd?: boolean;
  direction: CorridorActorDirection;
  odl?: boolean;
  note?: string;
  url?: string;
}

// Target (v2) — extends without breaking
interface CorridorActorComplete extends CorridorActor {
  identity?: ActorIdentity;              // T1
  regulatory?: ActorRegulatory;          // T2
  capabilities?: ActorCapabilities;      // T3
  liveDepth?: ActorLiveDepth;            // T4 — fetched on request, cached
  reputation?: ActorReputation;          // T5
  // Meta
  lastVerifiedAt: string;                // every tier has its own verification timestamp
  tierCompleteness: { [K in 1|2|3|4|5]: number };  // 0..1 per tier
}
```

---

## What this means for the hackathon demo

**Today:** we have T0 (research atlas) on 200 actors, and a **v1 T4 demo on Bitso** (live `xrp_mxn` orderbook on the USD↔MXN corridor page).

**At the podium, show:**
1. The T0 atlas — 2,436 corridors, 200 actors classified
2. The Bitso T4 badge — *"this is measured, not assumed. 60s TTL. Public API. Every other actor gets this in v2."*
3. This spec — *"we know what complete looks like. We scoped 5 tiers, we shipped tier 1 on one actor, we have a delivery order."*

That's the difference between "we built a research atlas" and "we built the first product in a category, we know exactly where it goes next, and we shipped the proof of the hardest tier on our flagship partner." That's what a judge wants to hear.
