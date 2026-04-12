import type {
  CorridorActor,
  CorridorAsset,
  CorridorPairDef,
  CorridorRouteCandidate,
  CorridorCategory,
  CorridorRegion,
  CorridorTier,
} from "@corlens/core";
import { RLUSD_ISSUER } from "@corlens/core";

// ─── Issuer registry ───────────────────────────────────────────────────────
// Live-verified mainnet issuers. Adding an entry here automatically makes it
// a candidate route for every pair that uses this currency. See
// corlens/docs/xrpl-fiat-corridors.md for the full issuer scan notes.

export const ADDR = {
  BITSTAMP: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
  GATEHUB: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
  GATEHUB_GBP: "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g",
  GATEHUB_USDC: "rcEGREd8NmkKRE8GE424sksyt1tJVFZwu",
  GATEHUB_USDT: "rcvxE9PS9YBwxtGg1qNeewV6ZB3wGubZq",
  RLUSD: RLUSD_ISSUER,
  CIRCLE_USDC: "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE",
  SCHUMAN_EUROP: "rMkEuRii9w9uBMQDnWV5AA43gvYZR9JxVK",
  JPY_MR_EXCHANGE: "rB3gZey7VWHYRqJHLoHDEJXJ2pEPNieKiS",
  JPY_TOKYO: "rMAz5ZnK73nyNUL4foAvaxdreczCkG3vA6",
  CNY_RIPPLEFOX: "rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y",
  CNY_RIPPLECN: "razqQKzJRdB4UxFPWf5NEpEG3WMkmwgcXA",
  CNY_RIPPLEQK: "rPT74sUcTBTQhkHVD54WGncoqXEAMYbmH7",
  SNAPSWAP: "rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q",
  BBRL_BRAZA: "rH5CJsqvNqZGxrMyGaqLEoMWRYcVTAPZMt",
  SOLOGENIC: "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
  RIPPLE_HISTORICAL: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
} as const;

export interface IssuerEntry {
  key: string;
  name: string;
  address: string;
}

// Issuers are ordered by preference: healthiest/most-liquid issuer first,
// deprecated or legacy issuers last. Bitstamp wound down its XRPL IOU
// issuance after listing native RLUSD (see xrpl-fiat-actors.md §8), so
// Bitstamp entries are kept for legacy trust-line detection but are
// demoted behind GateHub (and behind RLUSD for USD).
export const ISSUERS_BY_CURRENCY: Record<string, IssuerEntry[]> = {
  USD: [
    // RLUSD is the dominant USD proxy on XRPL post-Dec 2024.
    { key: "rlusd", name: "Ripple (RLUSD)", address: ADDR.RLUSD },
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB },
    { key: "snap", name: "SnapSwap", address: ADDR.SNAPSWAP },
    { key: "bs", name: "Bitstamp (legacy)", address: ADDR.BITSTAMP },
  ],
  EUR: [
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB },
    { key: "europ", name: "Schuman EURØP", address: ADDR.SCHUMAN_EUROP },
    { key: "snap", name: "SnapSwap", address: ADDR.SNAPSWAP },
    { key: "bs", name: "Bitstamp (legacy)", address: ADDR.BITSTAMP },
  ],
  GBP: [
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB_GBP },
    { key: "snap", name: "SnapSwap", address: ADDR.SNAPSWAP },
    { key: "bs", name: "Bitstamp (legacy)", address: ADDR.BITSTAMP },
  ],
  JPY: [
    { key: "mx", name: "Mr. Exchange", address: ADDR.JPY_MR_EXCHANGE },
    { key: "tokyo", name: "Tokyo JPY Gateway", address: ADDR.JPY_TOKYO },
    { key: "bs", name: "Bitstamp (legacy)", address: ADDR.BITSTAMP },
  ],
  CNY: [
    { key: "fox", name: "RippleFox", address: ADDR.CNY_RIPPLEFOX },
    { key: "cn", name: "RippleCN", address: ADDR.CNY_RIPPLECN },
    { key: "qk", name: "RippleQK", address: ADDR.CNY_RIPPLEQK },
  ],
  CHF: [{ key: "bs", name: "Bitstamp (legacy)", address: ADDR.BITSTAMP }],
  AUD: [{ key: "bs", name: "Bitstamp (legacy)", address: ADDR.BITSTAMP }],
  RLUSD: [{ key: "ripple", name: "Ripple", address: ADDR.RLUSD }],
  USDC: [
    { key: "circle", name: "Circle", address: ADDR.CIRCLE_USDC },
    { key: "gh", name: "GateHub", address: ADDR.GATEHUB_USDC },
  ],
  USDT: [{ key: "gh", name: "GateHub", address: ADDR.GATEHUB_USDT }],
  EUROP: [{ key: "schuman", name: "Schuman Financial", address: ADDR.SCHUMAN_EUROP }],
  BBRL: [{ key: "braza", name: "Braza Bank", address: ADDR.BBRL_BRAZA }],
  BTC: [{ key: "bs", name: "Bitstamp", address: ADDR.BITSTAMP }],
  SOLO: [{ key: "solo", name: "Sologenic", address: ADDR.SOLOGENIC }],
};

// ─── Asset metadata ────────────────────────────────────────────────────────

const ASSET_META: Record<string, CorridorAsset> = {
  USD: { symbol: "USD", type: "fiat", flag: "💵", label: "US Dollar" },
  EUR: { symbol: "EUR", type: "fiat", flag: "💶", label: "Euro" },
  GBP: { symbol: "GBP", type: "fiat", flag: "💷", label: "British Pound" },
  JPY: { symbol: "JPY", type: "fiat", flag: "💴", label: "Japanese Yen" },
  CNY: { symbol: "CNY", type: "fiat", flag: "🇨🇳", label: "Chinese Yuan" },
  CHF: { symbol: "CHF", type: "fiat", flag: "🇨🇭", label: "Swiss Franc" },
  AUD: { symbol: "AUD", type: "fiat", flag: "🇦🇺", label: "Australian Dollar" },
  // Off-chain-anchored fiats (no on-chain XRPL IOU issuer)
  CAD: { symbol: "CAD", type: "fiat", flag: "🇨🇦", label: "Canadian Dollar" },
  MXN: { symbol: "MXN", type: "fiat", flag: "🇲🇽", label: "Mexican Peso" },
  BRL: { symbol: "BRL", type: "fiat", flag: "🇧🇷", label: "Brazilian Real" },
  ARS: { symbol: "ARS", type: "fiat", flag: "🇦🇷", label: "Argentine Peso" },
  CLP: { symbol: "CLP", type: "fiat", flag: "🇨🇱", label: "Chilean Peso" },
  COP: { symbol: "COP", type: "fiat", flag: "🇨🇴", label: "Colombian Peso" },
  PEN: { symbol: "PEN", type: "fiat", flag: "🇵🇪", label: "Peruvian Sol" },
  SEK: { symbol: "SEK", type: "fiat", flag: "🇸🇪", label: "Swedish Krona" },
  NOK: { symbol: "NOK", type: "fiat", flag: "🇳🇴", label: "Norwegian Krone" },
  DKK: { symbol: "DKK", type: "fiat", flag: "🇩🇰", label: "Danish Krone" },
  PLN: { symbol: "PLN", type: "fiat", flag: "🇵🇱", label: "Polish Złoty" },
  CZK: { symbol: "CZK", type: "fiat", flag: "🇨🇿", label: "Czech Koruna" },
  HUF: { symbol: "HUF", type: "fiat", flag: "🇭🇺", label: "Hungarian Forint" },
  RON: { symbol: "RON", type: "fiat", flag: "🇷🇴", label: "Romanian Leu" },
  TRY: { symbol: "TRY", type: "fiat", flag: "🇹🇷", label: "Turkish Lira" },
  UAH: { symbol: "UAH", type: "fiat", flag: "🇺🇦", label: "Ukrainian Hryvnia" },
  KRW: { symbol: "KRW", type: "fiat", flag: "🇰🇷", label: "South Korean Won" },
  HKD: { symbol: "HKD", type: "fiat", flag: "🇭🇰", label: "Hong Kong Dollar" },
  TWD: { symbol: "TWD", type: "fiat", flag: "🇹🇼", label: "Taiwan Dollar" },
  SGD: { symbol: "SGD", type: "fiat", flag: "🇸🇬", label: "Singapore Dollar" },
  NZD: { symbol: "NZD", type: "fiat", flag: "🇳🇿", label: "NZ Dollar" },
  THB: { symbol: "THB", type: "fiat", flag: "🇹🇭", label: "Thai Baht" },
  PHP: { symbol: "PHP", type: "fiat", flag: "🇵🇭", label: "Philippine Peso" },
  IDR: { symbol: "IDR", type: "fiat", flag: "🇮🇩", label: "Indonesian Rupiah" },
  MYR: { symbol: "MYR", type: "fiat", flag: "🇲🇾", label: "Malaysian Ringgit" },
  VND: { symbol: "VND", type: "fiat", flag: "🇻🇳", label: "Vietnamese Dong" },
  INR: { symbol: "INR", type: "fiat", flag: "🇮🇳", label: "Indian Rupee" },
  PKR: { symbol: "PKR", type: "fiat", flag: "🇵🇰", label: "Pakistani Rupee" },
  BDT: { symbol: "BDT", type: "fiat", flag: "🇧🇩", label: "Bangladeshi Taka" },
  LKR: { symbol: "LKR", type: "fiat", flag: "🇱🇰", label: "Sri Lankan Rupee" },
  NPR: { symbol: "NPR", type: "fiat", flag: "🇳🇵", label: "Nepalese Rupee" },
  AED: { symbol: "AED", type: "fiat", flag: "🇦🇪", label: "UAE Dirham" },
  SAR: { symbol: "SAR", type: "fiat", flag: "🇸🇦", label: "Saudi Riyal" },
  BHD: { symbol: "BHD", type: "fiat", flag: "🇧🇭", label: "Bahraini Dinar" },
  KWD: { symbol: "KWD", type: "fiat", flag: "🇰🇼", label: "Kuwaiti Dinar" },
  OMR: { symbol: "OMR", type: "fiat", flag: "🇴🇲", label: "Omani Rial" },
  QAR: { symbol: "QAR", type: "fiat", flag: "🇶🇦", label: "Qatari Riyal" },
  ILS: { symbol: "ILS", type: "fiat", flag: "🇮🇱", label: "Israeli Shekel" },
  EGP: { symbol: "EGP", type: "fiat", flag: "🇪🇬", label: "Egyptian Pound" },
  ZAR: { symbol: "ZAR", type: "fiat", flag: "🇿🇦", label: "South African Rand" },
  NGN: { symbol: "NGN", type: "fiat", flag: "🇳🇬", label: "Nigerian Naira" },
  KES: { symbol: "KES", type: "fiat", flag: "🇰🇪", label: "Kenyan Shilling" },
  GHS: { symbol: "GHS", type: "fiat", flag: "🇬🇭", label: "Ghanaian Cedi" },
  UGX: { symbol: "UGX", type: "fiat", flag: "🇺🇬", label: "Ugandan Shilling" },
  TZS: { symbol: "TZS", type: "fiat", flag: "🇹🇿", label: "Tanzanian Shilling" },
  XOF: { symbol: "XOF", type: "fiat", flag: "🌍", label: "West African CFA" },
  XAF: { symbol: "XAF", type: "fiat", flag: "🌍", label: "Central African CFA" },
  // Stablecoins / XRPL-native proxies
  BBRL: { symbol: "BBRL", type: "stable", flag: "🇧🇷", label: "Braza Real" },
  RLUSD: { symbol: "RLUSD", type: "stable", flag: "🏦", label: "Ripple USD" },
  USDC: { symbol: "USDC", type: "stable", flag: "🪙", label: "Circle USDC" },
  USDT: { symbol: "USDT", type: "stable", flag: "🟢", label: "Tether USD" },
  EUROP: { symbol: "EUROP", type: "stable", flag: "🇪🇺", label: "Schuman EUROP" },
  XRP: { symbol: "XRP", type: "xrp", flag: "✦", label: "XRP" },
  BTC: { symbol: "BTC", type: "crypto", flag: "₿", label: "Wrapped BTC" },
  SOLO: { symbol: "SOLO", type: "crypto", flag: "🪙", label: "Sologenic SOLO" },
};

function asset(symbol: string): CorridorAsset {
  return ASSET_META[symbol] ?? { symbol, type: "fiat", flag: "?" };
}

// ─── Amount defaults by currency ──────────────────────────────────────────

const DEFAULT_AMOUNT: Record<string, string> = {
  USD: "1000",
  EUR: "1000",
  GBP: "1000",
  JPY: "100000",
  CNY: "5000",
  CHF: "1000",
  AUD: "1000",
  RLUSD: "1000",
  USDC: "1000",
  USDT: "1000",
  EUROP: "1000",
  BBRL: "5000",
  XRP: "100",
  BTC: "0.01",
  SOLO: "100",
  // Off-chain-anchored fiats (rough ~$1000 USD equivalents for UI display)
  CAD: "1400",
  MXN: "17000",
  BRL: "5000",
  ARS: "1000000",
  CLP: "900000",
  COP: "4000000",
  PEN: "3700",
  SEK: "10000",
  NOK: "10500",
  DKK: "7000",
  PLN: "4000",
  CZK: "22000",
  HUF: "350000",
  RON: "4500",
  TRY: "33000",
  UAH: "40000",
  KRW: "1400000",
  HKD: "7800",
  TWD: "32000",
  SGD: "1350",
  NZD: "1600",
  THB: "36000",
  PHP: "56000",
  IDR: "16000000",
  MYR: "4700",
  VND: "25000000",
  INR: "83000",
  PKR: "280000",
  BDT: "110000",
  LKR: "300000",
  NPR: "133000",
  AED: "3700",
  SAR: "3750",
  BHD: "380",
  KWD: "310",
  OMR: "385",
  QAR: "3640",
  ILS: "3700",
  EGP: "49000",
  ZAR: "18500",
  NGN: "1500000",
  KES: "130000",
  GHS: "15000",
  UGX: "3750000",
  TZS: "2600000",
  XOF: "600000",
  XAF: "600000",
};

// ─── Region inference for auto-generated pairs ────────────────────────────

const CURRENCY_REGION: Record<string, CorridorRegion> = {
  USD: "global",
  EUR: "europe",
  GBP: "europe",
  CHF: "europe",
  EUROP: "europe",
  JPY: "asia",
  CNY: "asia",
  AUD: "oceania",
  BBRL: "latam",
  RLUSD: "global",
  USDC: "global",
  USDT: "global",
  XRP: "global",
  BTC: "global",
  SOLO: "global",
  // Off-chain-anchored fiats
  CAD: "global",
  MXN: "latam",
  BRL: "latam",
  ARS: "latam",
  CLP: "latam",
  COP: "latam",
  PEN: "latam",
  SEK: "europe",
  NOK: "europe",
  DKK: "europe",
  PLN: "europe",
  CZK: "europe",
  HUF: "europe",
  RON: "europe",
  TRY: "europe",
  UAH: "europe",
  KRW: "asia",
  HKD: "asia",
  TWD: "asia",
  SGD: "asia",
  NZD: "oceania",
  THB: "asia",
  PHP: "asia",
  IDR: "asia",
  MYR: "asia",
  VND: "asia",
  INR: "asia",
  PKR: "asia",
  BDT: "asia",
  LKR: "asia",
  NPR: "asia",
  AED: "middle_east",
  SAR: "middle_east",
  BHD: "middle_east",
  KWD: "middle_east",
  OMR: "middle_east",
  QAR: "middle_east",
  ILS: "middle_east",
  EGP: "africa",
  ZAR: "africa",
  NGN: "africa",
  KES: "africa",
  GHS: "africa",
  UGX: "africa",
  TZS: "africa",
  XOF: "africa",
  XAF: "africa",
};

function inferRegion(src: string, dst: string): CorridorRegion {
  if (src === "XRP" || dst === "XRP") return "global";
  const rs = CURRENCY_REGION[src] ?? "global";
  const rd = CURRENCY_REGION[dst] ?? "global";
  if (rs === rd) return rs;
  return "cross";
}

// ─── Importance scoring ───────────────────────────────────────────────────

// Each currency gets a popularity weight. Pair importance = sum of both
// weights, with a global / stablecoin boost.
const CURRENCY_WEIGHT: Record<string, number> = {
  USD: 50,
  EUR: 45,
  JPY: 40,
  CNY: 38,
  GBP: 35,
  RLUSD: 42,
  USDC: 30,
  USDT: 25,
  EUROP: 20,
  CHF: 12,
  AUD: 14,
  BBRL: 10,
  XRP: 30,
  BTC: 10,
  SOLO: 6,
  // Off-chain-anchored fiats — weight loosely reflects remittance volume
  MXN: 22, BRL: 20, CAD: 18, KRW: 18, INR: 20, SGD: 16, HKD: 16, TRY: 18,
  AED: 18, SAR: 14, ZAR: 14, NGN: 12, PHP: 16, THB: 14, IDR: 12, MYR: 10,
  VND: 10, TWD: 10, SEK: 12, NOK: 10, DKK: 10, PLN: 12, CZK: 8, HUF: 8,
  RON: 6, UAH: 8, NZD: 10, ARS: 8, COP: 8, CLP: 6, PEN: 6,
  PKR: 8, BDT: 6, LKR: 6, NPR: 4,
  BHD: 6, KWD: 6, OMR: 6, QAR: 8, ILS: 8, EGP: 8,
  KES: 10, GHS: 8, UGX: 6, TZS: 6, XOF: 8, XAF: 6,
};

function inferImportance(src: string, dst: string, boost = 0): number {
  const w = (CURRENCY_WEIGHT[src] ?? 10) + (CURRENCY_WEIGHT[dst] ?? 10) + boost;
  return Math.min(99, Math.max(5, w));
}

function inferTier(importance: number): CorridorTier {
  if (importance >= 80) return 1;
  if (importance >= 60) return 2;
  if (importance >= 40) return 3;
  if (importance >= 20) return 4;
  return 5;
}

// ─── Slug helpers ─────────────────────────────────────────────────────────

function pairSlug(src: string, dst: string): string {
  return `${src.toLowerCase()}-${dst.toLowerCase()}`;
}

// ─── Overrides for curated copy ───────────────────────────────────────────
// Pairs listed here override auto-generated copy. Every other pair gets a
// sensible default description generated from the symbols.

interface PairOverride {
  description?: string;
  useCase?: string;
  highlights?: string[];
  related?: string[];
  importanceBoost?: number;
}

const PAIR_OVERRIDES: Record<string, PairOverride> = {
  "usd-eur": {
    importanceBoost: 20,
    description:
      "The flagship transatlantic FX lane on XRPL. Direct USD↔EUR books inside Bitstamp clear the deepest fiat pair on the ledger.",
    useCase: "Transatlantic corporate payables, Bitstamp ↔ GateHub treasury rebalancing.",
    highlights: [
      "USD.Bitstamp ↔ EUR.Bitstamp direct book 20/20 — arb-tight both ways",
      "USD.Bitstamp → XRP → EUR.GateHub also deep (autobridge)",
      "9 candidate routes give the picker counterparty diversification",
    ],
    related: ["eur-usd", "usd-cny", "usd-rlusd"],
  },
  "eur-usd": {
    importanceBoost: 19,
    description: "The return leg out of euros into dollars. Symmetric to USD→EUR.",
    useCase: "European corporate USD payables, EUR liquidation.",
    highlights: ["Direct EUR↔USD Bitstamp book is 20/20", "GateHub fallback via XRP autobridge"],
    related: ["usd-eur"],
  },
  "usd-cny": {
    importanceBoost: 18,
    description:
      "The only major Asian fiat lane with a real direct orderbook. Three CNY issuers (RippleFox, RippleCN, RippleQK) give the picker counterparty diversification.",
    useCase: "Greater China settlement, corporate CNY procurement, SBI Asia rails.",
    highlights: [
      "USD.Bitstamp ↔ CNY.RippleFox direct book 20/20",
      "Three CNY issuers — automatic failover if one drops",
      "RLUSD ↔ CNY.RippleFox direct book also 20/20",
    ],
    related: ["cny-usd", "eur-cny", "rlusd-cny"],
  },
  "cny-usd": {
    importanceBoost: 15,
    description: "CNY repatriation. Picker rotates across the three CNY issuers.",
    useCase: "Chinese vendor USD payouts, CNY treasury liquidation.",
    highlights: ["3 CNY issuers × 3 USD issuers = 9 candidate routes"],
    related: ["usd-cny"],
  },
  "usd-jpy": {
    importanceBoost: 17,
    description:
      "USD → JPY bridged via XRP into Mr. Exchange (the deepest JPY issuer on XRPL with 841M JPY outstanding).",
    useCase: "Corporate cross-border JPY payables, SBI-adjacent flows.",
    highlights: [
      "JPY.Mr.Exchange has 841M JPY outstanding (~$13M float)",
      "JPY.Tokyo gives a second issuer for failover",
      "Bitstamp JPY also available as a tertiary route",
    ],
    related: ["jpy-usd", "eur-jpy"],
  },
  "jpy-usd": {
    importanceBoost: 14,
    description: "JPY → USD repatriation. Tokyo JPY Gateway has 20 sell-side offers.",
    useCase: "Japanese corporate USD payables, SBI Remit inbound.",
    highlights: ["JPY.Tokyo → XRP: 20 offers", "XRP → USD.Bitstamp: 20 offers"],
    related: ["usd-jpy"],
  },
  "usd-gbp": {
    description:
      "USD → GBP via the dedicated GateHub GBP issuer (the only GBP issuer with real bid liquidity on the ledger).",
    useCase: "US-UK corporate settlement, GBP treasury access.",
    highlights: ["GBP.GateHub XRP legs 20/15 — deep both sides", "Bitstamp GBP has near-zero sell side"],
    related: ["gbp-usd", "eur-gbp"],
  },
  "gbp-usd": {
    description: "GBP off-ramp. 15 live sell-side offers via GBP.GateHub.",
    useCase: "UK corporate repatriation, GBP liquidation.",
    highlights: ["Multi-issuer USD destinations let the picker pick the deepest book"],
    related: ["usd-gbp"],
  },
  "eur-cny": {
    importanceBoost: 10,
    description: "Europe to China in a single direct orderbook hop (EUR.GateHub ↔ CNY.RippleFox).",
    useCase: "European corporate suppliers paying Chinese vendors.",
    highlights: ["EUR.GateHub ↔ CNY.RippleFox direct book 9/11"],
    related: ["usd-cny", "cny-eur"],
  },
  "cny-eur": {
    importanceBoost: 7,
    description: "CNY → EUR via either the direct cross-book or USD pivot.",
    useCase: "Chinese corporate EU procurement.",
    highlights: ["Direct CNY.RippleFox ↔ EUR.GateHub", "Or two-hop via USD.Bitstamp"],
    related: ["eur-cny"],
  },
  "usd-chf": {
    description: "Swiss Franc lane — informational only. Single Bitstamp issuer with shallow book.",
    useCase: "Documentation of dead lane (SIX/SARON dominates Swiss FX).",
    highlights: ["⚠ Only 1 offer on the XRP→CHF leg", "Listed for completeness"],
  },
  "usd-aud": {
    description: "Australian Dollar lane — thin. Only Bitstamp issues AUD.",
    useCase: "Small retail AU flows, alternate ODL leg.",
    highlights: ["3 offers on XRP→AUD leg, 1 on the return"],
  },
};

// ─── Description fallback for auto-generated pairs ────────────────────────

function defaultDescription(src: string, dst: string): string {
  const srcLabel = ASSET_META[src]?.label ?? src;
  const dstLabel = ASSET_META[dst]?.label ?? dst;
  const srcIssuers = ISSUERS_BY_CURRENCY[src]?.length ?? 0;
  const dstIssuers = ISSUERS_BY_CURRENCY[dst]?.length ?? 0;
  const routeCount = srcIssuers * dstIssuers;
  return (
    `Cross-asset lane from ${srcLabel} to ${dstLabel}. The multi-route picker ` +
    `evaluates ${routeCount} candidate issuer combinations, scanning orderbook ` +
    `depth, AMM reserves, and cross-book fallbacks, then selects the deepest ` +
    `lowest-risk option.`
  );
}

function defaultUseCase(src: string, dst: string): string {
  if (src === "XRP") return `Native XRP off-ramp into ${dst} — validator payouts and ODL destination leg.`;
  const srcType = ASSET_META[src]?.type ?? "fiat";
  const dstType = ASSET_META[dst]?.type ?? "fiat";
  if (srcType === "stable" && dstType === "fiat") return `Stablecoin off-ramp into ${dst}.`;
  if (srcType === "fiat" && dstType === "stable") return `${src} on-ramp into the ${dst} stablecoin.`;
  if (srcType === "stable" && dstType === "stable") return `Cross-stablecoin arbitrage between ${src} and ${dst}.`;
  return `Cross-currency FX lane from ${src} to ${dst}.`;
}

function defaultHighlights(src: string, dst: string): string[] {
  const srcIssuers = ISSUERS_BY_CURRENCY[src] ?? [];
  const dstIssuers = ISSUERS_BY_CURRENCY[dst] ?? [];
  const hl: string[] = [];
  if (srcIssuers.length > 0 && dstIssuers.length > 0) {
    hl.push(
      `${srcIssuers.length * dstIssuers.length} candidate routes (${srcIssuers.length} ${src} issuers × ${dstIssuers.length} ${dst} issuers)`,
    );
  }
  if (srcIssuers.length === 1) hl.push(`Only one ${src} issuer — no counterparty diversification`);
  if (dstIssuers.length === 1) hl.push(`Only one ${dst} issuer — single-counterparty destination`);
  hl.push("Refreshed hourly, ranked by liquidity and risk");
  return hl;
}

// ─── Route generator ──────────────────────────────────────────────────────

function buildFiatRoutes(src: string, dst: string, amount: string): CorridorRouteCandidate[] {
  const srcIssuers = ISSUERS_BY_CURRENCY[src] ?? [];
  const dstIssuers = ISSUERS_BY_CURRENCY[dst] ?? [];
  const routes: CorridorRouteCandidate[] = [];
  for (const s of srcIssuers) {
    for (const d of dstIssuers) {
      if (src === dst && s.address === d.address) continue;
      routes.push({
        routeId: `${s.key}-${d.key}`,
        label: `${src}.${s.name} → ${dst}.${d.name}`,
        sourceIssuerKey: s.key,
        sourceIssuerName: s.name,
        destIssuerKey: d.key,
        destIssuerName: d.name,
        request: {
          sourceCurrency: src,
          sourceIssuer: s.address,
          sourceAccount: s.address,
          destCurrency: dst,
          destIssuer: d.address,
          amount,
        },
      });
    }
  }
  return routes;
}

function buildXrpRoutes(dst: string, amount: string): CorridorRouteCandidate[] {
  const dstIssuers = ISSUERS_BY_CURRENCY[dst] ?? [];
  return dstIssuers.map((d) => ({
    routeId: `x-${d.key}`,
    label: `XRP → ${dst}.${d.name}`,
    destIssuerKey: d.key,
    destIssuerName: d.name,
    request: {
      sourceCurrency: "XRP",
      sourceAccount: ADDR.RIPPLE_HISTORICAL,
      destCurrency: dst,
      destIssuer: d.address,
      amount,
    },
  }));
}

// ─── Pair builder ─────────────────────────────────────────────────────────

function buildPair(
  src: string,
  dst: string,
  category: CorridorCategory,
): CorridorPairDef | null {
  const srcIssuers = ISSUERS_BY_CURRENCY[src];
  const dstIssuers = ISSUERS_BY_CURRENCY[dst];
  // Skip pairs where either side has no issuer AND isn't XRP
  if (src !== "XRP" && (!srcIssuers || srcIssuers.length === 0)) return null;
  if (!dstIssuers || dstIssuers.length === 0) return null;

  const id = pairSlug(src, dst);
  const override = PAIR_OVERRIDES[id] ?? {};
  const amount = DEFAULT_AMOUNT[src] ?? "1000";
  const routes =
    src === "XRP"
      ? buildXrpRoutes(dst, amount)
      : buildFiatRoutes(src, dst, amount);
  if (routes.length === 0) return null;

  const importance = inferImportance(src, dst, override.importanceBoost ?? 0);
  const tier = inferTier(importance);

  return {
    id,
    label: `${src} → ${dst}`,
    shortLabel:
      routes.length > 1 ? `${src} → ${dst} (${routes.length} routes)` : `${src} → ${dst}`,
    flag: `${asset(src).flag} → ${asset(dst).flag}`,
    tier,
    importance,
    region: inferRegion(src, dst),
    category,
    description: override.description ?? defaultDescription(src, dst),
    useCase: override.useCase ?? defaultUseCase(src, dst),
    highlights: override.highlights ?? defaultHighlights(src, dst),
    relatedCorridorIds: override.related,
    source: asset(src),
    dest: asset(dst),
    amount,
    routes,
    sourceActors: ACTORS_BY_CURRENCY[src],
    destActors: ACTORS_BY_CURRENCY[dst],
  };
}

// ─── Off-chain actor registry ─────────────────────────────────────────────
// Research atlas: corlens/docs/xrpl-fiat-actors.md
// For each fiat currency, list the real-world CEX/remittance/ODL/bank
// actors that convert local fiat into an XRPL asset (XRP, RLUSD, USDC, or
// a native stablecoin). These annotate on-chain corridors AND act as the
// primary routing information for off-chain-bridge corridors (§9 below).
//
// Curation rules:
//  - One entry per notable actor per currency (not every exchange).
//  - Ripple ODL / Ripple Payments partners are marked `odl: true`.
//  - `supportsRlusd: true` only if research confirmed an RLUSD listing.
//  - Deprecated venues (Bitstamp IOUs, Garantex/Grinex, WazirX-frozen) are
//    omitted.

export const ACTORS_BY_CURRENCY: Record<string, CorridorActor[]> = {
  USD: [
    { key: "coinbase", name: "Coinbase", type: "cex", country: "US", supportsXrp: true, supportsRlusd: false, direction: "both", note: "no RLUSD (USDC commercial conflict)" },
    { key: "kraken", name: "Kraken", type: "cex", country: "US", supportsXrp: true, supportsRlusd: true, direction: "both", note: "drove first $10B RLUSD volume" },
    { key: "uphold", name: "Uphold", type: "cex", country: "US", supportsXrp: true, supportsRlusd: true, direction: "both", note: "day-1 RLUSD launch venue" },
    { key: "bitstamp-us", name: "Bitstamp US", type: "cex", country: "US", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "gemini", name: "Gemini", type: "cex", country: "US", supportsXrp: true, supportsRlusd: true, direction: "both", note: "NYDFS" },
    { key: "lmax", name: "LMAX Digital", type: "cex", country: "UK/US", supportsXrp: true, supportsRlusd: true, direction: "both", note: "institutional" },
    { key: "bullish", name: "Bullish", type: "cex", country: "GI", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "b2c2", name: "B2C2", type: "otc", country: "US/UK", supportsXrp: true, supportsRlusd: true, direction: "both", note: "RLUSD market-maker" },
    { key: "keyrock", name: "Keyrock", type: "otc", country: "BE", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "zerohash", name: "Zero Hash", type: "fintech", country: "US", supportsXrp: true, supportsRlusd: true, direction: "both", note: "BaaS" },
    { key: "moonpay", name: "MoonPay", type: "fintech", country: "US", supportsXrp: true, supportsRlusd: true, direction: "onramp" },
    { key: "bny", name: "BNY Mellon", type: "custodian", country: "US", supportsXrp: false, supportsRlusd: true, direction: "both", note: "RLUSD reserves custodian (Jul 2025)" },
    { key: "standard-custody", name: "Standard Custody & Trust", type: "custodian", country: "US", supportsXrp: false, supportsRlusd: true, direction: "both", note: "NY-chartered, RLUSD issuer entity" },
    { key: "convera", name: "Convera", type: "odl", country: "US", supportsXrp: true, supportsRlusd: true, direction: "both", odl: true, note: "ex-Western Union Biz, partner Apr 2026" },
    { key: "ripple-prime", name: "Ripple Prime (ex-Hidden Road)", type: "otc", country: "US", supportsXrp: true, supportsRlusd: true, direction: "both", note: "crypto-owned multi-asset prime broker, Oct 2025" },
  ],
  CAD: [
    { key: "ndax", name: "NDAX", type: "cex", country: "CA", supportsXrp: true, direction: "both" },
    { key: "bitbuy", name: "Bitbuy", type: "cex", country: "CA", supportsXrp: true, direction: "both" },
    { key: "coinsquare", name: "Coinsquare", type: "cex", country: "CA", supportsXrp: true, direction: "both" },
    { key: "kraken-ca", name: "Kraken CA", type: "cex", country: "CA", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "netcoins", name: "Netcoins", type: "cex", country: "CA", supportsXrp: true, direction: "both" },
  ],
  MXN: [
    { key: "bitso", name: "Bitso", type: "cex", country: "MX", supportsXrp: true, supportsRlusd: true, direction: "both", odl: true, note: "Ripple ODL launch partner, flagship US→MX corridor" },
    { key: "volabit", name: "Volabit", type: "cex", country: "MX", supportsXrp: true, direction: "both" },
    { key: "moonpay-mx", name: "MoonPay (MXN)", type: "fintech", country: "MX", supportsXrp: true, supportsRlusd: true, direction: "onramp" },
  ],
  BRL: [
    { key: "travelex-bank", name: "Travelex Bank", type: "bank", country: "BR", supportsXrp: true, supportsRlusd: true, direction: "both", odl: true, note: "first LATAM bank on ODL, Aug 2022" },
    { key: "mercado-bitcoin", name: "Mercado Bitcoin", type: "cex", country: "BR", supportsXrp: true, supportsRlusd: true, direction: "both", odl: true, note: "Ripple Payments partner Oct 2024" },
    { key: "braza-bank", name: "Braza Bank", type: "bank", country: "BR", supportsXrp: false, supportsRlusd: true, direction: "both", note: "RLUSD distribution, 2026" },
    { key: "banco-genial", name: "Banco Genial", type: "bank", country: "BR", supportsXrp: false, supportsRlusd: true, direction: "both" },
    { key: "attrus", name: "Attrus", type: "fintech", country: "BR", supportsXrp: false, supportsRlusd: true, direction: "both" },
    { key: "foxbit", name: "Foxbit", type: "cex", country: "BR", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "ripio-br", name: "Ripio BR", type: "cex", country: "BR", supportsXrp: true, supportsRlusd: true, direction: "both" },
  ],
  ARS: [
    { key: "ripio-ar", name: "Ripio", type: "cex", country: "AR", supportsXrp: true, direction: "both" },
    { key: "satoshitango", name: "SatoshiTango", type: "cex", country: "AR", supportsXrp: true, direction: "both" },
    { key: "lemon", name: "Lemon Cash", type: "fintech", country: "AR", supportsXrp: true, direction: "both" },
    { key: "buenbit", name: "Buenbit", type: "cex", country: "AR", supportsXrp: true, direction: "both", note: "multi-LATAM (MX/BR/CO/PE/UY)" },
    { key: "belo", name: "Belo", type: "fintech", country: "AR", supportsXrp: true, direction: "both" },
  ],
  COP: [
    { key: "bitso-co", name: "Bitso CO", type: "cex", country: "CO", supportsXrp: true, supportsRlusd: true, direction: "both", note: "free COP rails" },
    { key: "buda-co", name: "Buda.com", type: "cex", country: "CO", supportsXrp: true, direction: "both" },
    { key: "panda", name: "Panda Exchange", type: "cex", country: "CO", supportsXrp: true, direction: "both" },
  ],
  CLP: [
    { key: "orionx", name: "OrionX", type: "cex", country: "CL", supportsXrp: true, direction: "both" },
    { key: "cryptomkt", name: "CryptoMKT", type: "cex", country: "CL", supportsXrp: true, direction: "both" },
    { key: "buda-cl", name: "Buda.com", type: "cex", country: "CL", supportsXrp: true, direction: "both" },
    { key: "binance-clp-p2p", name: "Binance P2P (CLP)", type: "p2p", country: "CL", supportsXrp: true, supportsRlusd: true, direction: "both", note: "CLP P2P + RLUSD spot" },
  ],
  PEN: [
    { key: "fluyez", name: "Fluyez", type: "cex", country: "PE", supportsXrp: true, direction: "both" },
    { key: "bitinka", name: "Bitinka", type: "cex", country: "PE", supportsXrp: true, direction: "both" },
    { key: "buenbit-pe", name: "Buenbit PE", type: "cex", country: "PE", supportsXrp: true, direction: "both" },
    { key: "binance-pen-p2p", name: "Binance P2P (PEN)", type: "p2p", country: "PE", supportsXrp: true, supportsRlusd: true, direction: "both" },
  ],
  EUR: [
    { key: "bitstamp-eu", name: "Bitstamp (LU)", type: "cex", country: "LU", supportsXrp: true, supportsRlusd: true, direction: "both", odl: true, note: "Ripple ODL venue; RLUSD excluded from EU retail pending MiCA EMT" },
    { key: "kraken-eu", name: "Kraken (IE)", type: "cex", country: "IE", supportsXrp: true, supportsRlusd: true, direction: "both", note: "MiCA CASP" },
    { key: "coinbase-eu", name: "Coinbase EU", type: "cex", country: "LU", supportsXrp: true, direction: "both", note: "MiCA CASP" },
    { key: "bitpanda", name: "Bitpanda", type: "cex", country: "AT", supportsXrp: true, direction: "both", note: "MiCA CASP" },
    { key: "bitvavo", name: "Bitvavo", type: "cex", country: "NL", supportsXrp: true, direction: "both", note: "MiCA CASP" },
    { key: "bybit-eu", name: "Bybit EU", type: "cex", country: "AT", supportsXrp: true, supportsRlusd: true, direction: "both", note: "MiCA CASP" },
    { key: "okx-eu", name: "OKX Europe", type: "cex", country: "MT", supportsXrp: true, direction: "both", note: "MiCA CASP" },
    { key: "revolut-eu", name: "Revolut", type: "fintech", country: "CY", supportsXrp: true, direction: "onramp", note: "MiCA EMI" },
    { key: "n26", name: "N26", type: "bank", country: "DE", supportsXrp: true, direction: "onramp", note: "via Bitpanda" },
    { key: "lemonway", name: "Lemonway", type: "odl", country: "FR", supportsXrp: true, direction: "both", odl: true, note: "first FR Ripple ODL partner" },
    { key: "finci", name: "FINCI", type: "odl", country: "LT", supportsXrp: true, direction: "both", odl: true, note: "EMI, Ripple ODL" },
    { key: "unicambio", name: "Unicâmbio", type: "odl", country: "PT", supportsXrp: true, direction: "both", odl: true, note: "PT↔BR 2025" },
  ],
  GBP: [
    { key: "coinbase-uk", name: "Coinbase UK", type: "cex", country: "UK", supportsXrp: true, direction: "both", note: "FCA" },
    { key: "kraken-uk", name: "Kraken UK", type: "cex", country: "UK", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "cex-io", name: "CEX.IO", type: "cex", country: "UK", supportsXrp: true, direction: "both" },
    { key: "coinjar-uk", name: "CoinJar", type: "cex", country: "UK", supportsXrp: true, direction: "both" },
    { key: "uphold-uk", name: "Uphold UK", type: "cex", country: "UK", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "archax", name: "Archax", type: "cex", country: "UK", supportsXrp: true, supportsRlusd: true, direction: "both", note: "FCA-regulated digital securities" },
    { key: "revolut-uk", name: "Revolut UK", type: "fintech", country: "UK", supportsXrp: true, direction: "onramp" },
    { key: "modulr", name: "Modulr", type: "odl", country: "UK", supportsXrp: true, direction: "both", odl: true, note: "Ripple Payments EMI" },
    { key: "onafriq", name: "Onafriq", type: "hub", country: "UK/Africa", supportsXrp: true, direction: "both", odl: true, note: "UK→Africa ODL leg, 500M mobile wallets" },
  ],
  CHF: [
    { key: "bitcoin-suisse", name: "Bitcoin Suisse", type: "cex", country: "CH", supportsXrp: true, direction: "both", note: "FINMA" },
    { key: "sygnum", name: "Sygnum Bank", type: "bank", country: "CH", supportsXrp: true, direction: "both" },
    { key: "amina", name: "AMINA Bank (ex-SEBA)", type: "bank", country: "CH", supportsXrp: true, direction: "both" },
    { key: "swissquote", name: "Swissquote", type: "bank", country: "CH", supportsXrp: true, direction: "both" },
  ],
  SEK: [
    { key: "xbaht", name: "Xbaht", type: "odl", country: "SE", supportsXrp: true, direction: "both", odl: true, note: "SE→TH via Tranglo" },
    { key: "safello", name: "Safello", type: "cex", country: "SE", supportsXrp: true, direction: "onramp" },
  ],
  NOK: [
    { key: "nbx", name: "Norwegian Block Exchange", type: "cex", country: "NO", supportsXrp: true, direction: "both" },
    { key: "firi", name: "Firi", type: "cex", country: "NO", supportsXrp: true, direction: "both" },
  ],
  DKK: [
    { key: "januar", name: "Januar", type: "fintech", country: "DK", supportsXrp: false, direction: "onramp", note: "DKK rails only" },
  ],
  PLN: [
    { key: "zondacrypto", name: "Zondacrypto (ex-BitBay)", type: "cex", country: "PL", supportsXrp: true, direction: "both", note: "largest PL" },
    { key: "kanga", name: "Kanga Exchange", type: "cex", country: "PL", supportsXrp: true, direction: "both" },
  ],
  CZK: [
    { key: "coinmate", name: "Coinmate / Anycoin Direct", type: "cex", country: "CZ", supportsXrp: true, direction: "both" },
    { key: "simplecoin", name: "SimpleCoin.cz", type: "cex", country: "CZ", supportsXrp: true, direction: "onramp" },
  ],
  HUF: [
    { key: "mrcoin", name: "Mr. Coin", type: "cex", country: "HU", supportsXrp: true, direction: "both" },
  ],
  RON: [
    { key: "tokero", name: "Bittnet / Tokero", type: "cex", country: "RO", supportsXrp: true, direction: "both" },
  ],
  TRY: [
    { key: "btcturk", name: "BtcTurk", type: "cex", country: "TR", supportsXrp: true, direction: "both", note: "largest TR, high XRP/TRY volume" },
    { key: "binance-tr", name: "Binance TR", type: "cex", country: "TR", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "paribu", name: "Paribu", type: "cex", country: "TR", supportsXrp: true, direction: "both" },
    { key: "bitexen", name: "Bitexen", type: "cex", country: "TR", supportsXrp: true, direction: "both" },
  ],
  UAH: [
    { key: "whitebit", name: "WhiteBIT", type: "cex", country: "UA", supportsXrp: true, direction: "both", note: "PrivatBank + SEPA + P2P" },
    { key: "kuna", name: "Kuna", type: "cex", country: "UA", supportsXrp: true, direction: "both" },
  ],
  JPY: [
    { key: "sbi-vc", name: "SBI VC Trade", type: "cex", country: "JP", supportsXrp: true, supportsRlusd: true, direction: "both", odl: true, note: "FSA; RLUSD distribution Q1 2026" },
    { key: "sbi-remit", name: "SBI Remit", type: "odl", country: "JP", supportsXrp: true, direction: "onramp", odl: true, note: "JP→PH/TH/VN/ID since 2021" },
    { key: "bitbank", name: "Bitbank", type: "cex", country: "JP", supportsXrp: true, direction: "both" },
    { key: "bitflyer", name: "bitFlyer", type: "cex", country: "JP", supportsXrp: true, direction: "both" },
    { key: "coincheck", name: "Coincheck", type: "cex", country: "JP", supportsXrp: true, direction: "both" },
    { key: "gmo", name: "GMO Coin", type: "cex", country: "JP", supportsXrp: true, direction: "both" },
    { key: "rakuten-wallet", name: "Rakuten Wallet", type: "cex", country: "JP", supportsXrp: true, direction: "both" },
  ],
  KRW: [
    { key: "upbit", name: "Upbit", type: "cex", country: "KR", supportsXrp: true, direction: "both", note: "~53% market share, >$1T XRP volume 2025" },
    { key: "bithumb", name: "Bithumb", type: "cex", country: "KR", supportsXrp: true, direction: "both" },
    { key: "coinone", name: "Coinone", type: "cex", country: "KR", supportsXrp: true, supportsRlusd: true, direction: "both", note: "first KR RLUSD listing" },
    { key: "korbit", name: "Korbit", type: "cex", country: "KR", supportsXrp: true, direction: "both" },
    { key: "gopax", name: "GOPAX", type: "cex", country: "KR", supportsXrp: true, direction: "both" },
  ],
  HKD: [
    { key: "osl", name: "OSL HK", type: "cex", country: "HK", supportsXrp: true, supportsRlusd: true, direction: "both", note: "first HK RLUSD listing (SFC VATP)" },
    { key: "hashkey", name: "HashKey Exchange", type: "cex", country: "HK", supportsXrp: true, direction: "both", note: "licensed VATP" },
    { key: "crypto-com-hk", name: "Crypto.com HK", type: "cex", country: "HK", supportsXrp: true, direction: "both" },
  ],
  TWD: [
    { key: "maicoin", name: "MaiCoin / MAX", type: "cex", country: "TW", supportsXrp: true, direction: "both", note: "FSC" },
    { key: "bitopro", name: "BitoPro", type: "cex", country: "TW", supportsXrp: true, direction: "both" },
    { key: "ace", name: "ACE Exchange", type: "cex", country: "TW", supportsXrp: true, direction: "both" },
    { key: "binance-twd", name: "Binance (cross-border TWD)", type: "cex", country: "TW", supportsXrp: true, supportsRlusd: true, direction: "both", note: "TWD card on-ramp; RLUSD listed" },
  ],
  SGD: [
    { key: "ir-sg", name: "Independent Reserve SG", type: "cex", country: "SG", supportsXrp: true, direction: "both", note: "MAS MPI" },
    { key: "coinhako", name: "Coinhako", type: "cex", country: "SG", supportsXrp: true, direction: "both", note: "MAS" },
    { key: "bloom-pilot", name: "Ripple (MAS BLOOM pilot)", type: "odl", country: "SG", supportsRlusd: true, direction: "both", odl: true, note: "institutional trade-finance pilot" },
  ],
  AUD: [
    { key: "ir-au", name: "Independent Reserve", type: "cex", country: "AU", supportsXrp: true, direction: "both", note: "AUSTRAC" },
    { key: "swyftx", name: "Swyftx", type: "cex", country: "AU", supportsXrp: true, direction: "both" },
    { key: "coinjar-au", name: "CoinJar", type: "cex", country: "AU", supportsXrp: true, direction: "both" },
    { key: "btc-markets", name: "BTC Markets", type: "cex", country: "AU", supportsXrp: true, direction: "both" },
    { key: "flashfx", name: "FlashFX", type: "odl", country: "AU", supportsXrp: true, direction: "both", odl: true },
    { key: "novatti", name: "Novatti", type: "odl", country: "AU", supportsXrp: true, direction: "both", odl: true },
  ],
  NZD: [
    { key: "ir-nz", name: "Independent Reserve NZ", type: "cex", country: "NZ", supportsXrp: true, direction: "both" },
    { key: "easy-crypto", name: "Easy Crypto NZ", type: "cex", country: "NZ", supportsXrp: true, direction: "both" },
    { key: "kraken-nz", name: "Kraken (NZD wire)", type: "cex", country: "NZ", supportsXrp: true, supportsRlusd: true, direction: "both", note: "accepts NZD via wire; RLUSD listed" },
    { key: "binance-nz", name: "Binance (NZD on-ramp)", type: "cex", country: "NZ", supportsXrp: true, supportsRlusd: true, direction: "both" },
  ],
  THB: [
    { key: "bitkub", name: "Bitkub", type: "cex", country: "TH", supportsXrp: true, direction: "both", note: "SEC; $8.2B XRP/THB 2025 volume" },
    { key: "deemoney", name: "DeeMoney", type: "odl", country: "TH", supportsXrp: true, direction: "offramp", odl: true, note: "ODL recipient from SBI Remit" },
  ],
  PHP: [
    { key: "coins-ph", name: "Coins.ph", type: "cex", country: "PH", supportsXrp: true, direction: "both", odl: true, note: "BSP e-money + Ripple partner" },
    { key: "pdax", name: "PDAX", type: "cex", country: "PH", supportsXrp: true, direction: "both", note: "BSP-licensed" },
    { key: "iremit", name: "iRemit", type: "odl", country: "PH", supportsXrp: true, direction: "offramp", odl: true },
  ],
  IDR: [
    { key: "indodax", name: "Indodax", type: "cex", country: "ID", supportsXrp: true, direction: "both", note: "Bappebti" },
    { key: "tokocrypto", name: "Tokocrypto", type: "cex", country: "ID", supportsXrp: true, direction: "both" },
    { key: "pintu", name: "Pintu", type: "cex", country: "ID", supportsXrp: true, direction: "both" },
    { key: "reku", name: "Reku", type: "cex", country: "ID", supportsXrp: true, direction: "both" },
  ],
  MYR: [
    { key: "luno-my", name: "Luno MY", type: "cex", country: "MY", supportsXrp: true, direction: "both", note: "SC-registered DAX" },
    { key: "mx-global", name: "MX Global", type: "cex", country: "MY", supportsXrp: true, direction: "both" },
    { key: "sinegy", name: "SINEGY DAX", type: "cex", country: "MY", supportsXrp: true, direction: "both" },
    { key: "tranglo", name: "Tranglo", type: "hub", country: "MY", supportsXrp: true, direction: "both", odl: true, note: "25-corridor APAC ODL hub, 40% Ripple-owned" },
  ],
  VND: [
    { key: "remitano", name: "Remitano", type: "p2p", country: "VN", supportsXrp: true, direction: "both" },
    { key: "tranglo-vn", name: "Tranglo", type: "hub", country: "MY/VN", supportsXrp: true, direction: "both", odl: true, note: "APAC ODL hub; VN is part of Tranglo's 25-corridor coverage" },
    { key: "binance-vnd-p2p", name: "Binance P2P (VND)", type: "p2p", country: "VN", supportsXrp: true, supportsRlusd: true, direction: "both", note: "VND P2P + RLUSD/USDT offshore spot" },
  ],
  INR: [
    { key: "coindcx", name: "CoinDCX", type: "cex", country: "IN", supportsXrp: true, direction: "both", note: "FIU-registered; INR via UPI/IMPS" },
    { key: "coinswitch", name: "CoinSwitch", type: "cex", country: "IN", supportsXrp: true, direction: "both", note: "FIU-registered" },
    { key: "zebpay", name: "ZebPay", type: "cex", country: "IN", supportsXrp: true, direction: "both", note: "FIU-registered" },
    { key: "bitbns", name: "Bitbns", type: "cex", country: "IN", supportsXrp: true, direction: "both" },
  ],
  AED: [
    { key: "bitoasis", name: "BitOasis", type: "cex", country: "AE", supportsXrp: true, direction: "both", note: "VARA-licensed" },
    { key: "rain-ae", name: "Rain", type: "cex", country: "AE", supportsXrp: true, supportsRlusd: true, direction: "both", note: "ADGM/FSRA, RLUSD listed" },
    { key: "coinmena-ae", name: "CoinMENA", type: "cex", country: "AE", supportsXrp: true, direction: "both", note: "VARA + CBB" },
    { key: "pyypl", name: "Pyypl", type: "odl", country: "AE", supportsXrp: true, direction: "both", odl: true, note: "Ripple ODL retail remittance" },
    { key: "lulu", name: "LuLu Exchange", type: "remittance", country: "AE", supportsXrp: true, direction: "onramp", odl: true, note: "UAE→IN/PK via Ripple + Federal Bank" },
    { key: "al-ansari", name: "Al Ansari Exchange", type: "remittance", country: "AE", supportsXrp: true, direction: "onramp", odl: true, note: "via Tranglo" },
    { key: "zand", name: "Zand Bank", type: "bank", country: "AE", supportsXrp: true, direction: "both", odl: true, note: "first UAE digital bank Ripple client, May 2025" },
  ],
  SAR: [
    { key: "rain-sa", name: "Rain", type: "cex", country: "SA", supportsXrp: true, supportsRlusd: true, direction: "both", note: "XRP/SAR + RLUSD" },
    { key: "coinmena-sa", name: "CoinMENA", type: "cex", country: "SA", supportsXrp: true, direction: "both" },
    { key: "sabb", name: "SABB (Saudi British Bank)", type: "bank", country: "SA", supportsXrp: true, direction: "onramp", odl: true, note: "legacy RippleNet" },
  ],
  BHD: [
    { key: "rain-bh", name: "Rain", type: "cex", country: "BH", supportsXrp: true, supportsRlusd: true, direction: "both", note: "HQ; XRP/BHD + RLUSD" },
    { key: "coinmena-bh", name: "CoinMENA", type: "cex", country: "BH", supportsXrp: true, direction: "both", note: "HQ" },
  ],
  KWD: [
    { key: "rain-kw", name: "Rain", type: "cex", country: "KW", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "coinmena-kw", name: "CoinMENA", type: "cex", country: "KW", supportsXrp: true, direction: "both" },
  ],
  OMR: [
    { key: "rain-om", name: "Rain", type: "cex", country: "OM", supportsXrp: true, supportsRlusd: true, direction: "both" },
    { key: "coinmena-om", name: "CoinMENA", type: "cex", country: "OM", supportsXrp: true, direction: "both" },
  ],
  QAR: [
    { key: "coinmena-qa", name: "CoinMENA", type: "cex", country: "QA", supportsXrp: true, direction: "both" },
    { key: "qnb-chinabank", name: "QNB ↔ ChinaBank", type: "bank", country: "QA", supportsXrp: true, direction: "onramp", odl: true, note: "QAR→PHP corridor 2024-25" },
  ],
  ILS: [
    { key: "bits-of-gold", name: "Bits of Gold", type: "cex", country: "IL", supportsXrp: true, direction: "both", note: "CMA-licensed" },
    { key: "kraken-il", name: "Kraken (cross-border ILS)", type: "cex", country: "IL/US", supportsXrp: true, supportsRlusd: true, direction: "both", note: "serves IL residents via wire; RLUSD listed" },
    { key: "binance-il", name: "Binance (cross-border ILS)", type: "cex", country: "IL", supportsXrp: true, supportsRlusd: true, direction: "both", note: "ILS card on-ramp + RLUSD spot" },
  ],
  EGP: [
    { key: "coinmena-eg", name: "CoinMENA", type: "cex", country: "EG", supportsXrp: true, direction: "both", note: "constrained by CBE Law 194/2020" },
    { key: "binance-egp-p2p", name: "Binance P2P (EGP)", type: "p2p", country: "EG", supportsXrp: true, supportsRlusd: true, direction: "both", note: "P2P EGP → USDT → XRP/RLUSD; de-facto on-ramp" },
    { key: "bybit-egp-p2p", name: "Bybit P2P (EGP)", type: "p2p", country: "EG", supportsXrp: true, supportsRlusd: true, direction: "both" },
  ],
  ZAR: [
    { key: "valr", name: "VALR", type: "cex", country: "ZA", supportsXrp: true, supportsRlusd: true, direction: "both", note: "FSCA-licensed" },
    { key: "luno-za", name: "Luno", type: "cex", country: "ZA", supportsXrp: true, direction: "both" },
    { key: "yellow-card-za", name: "Yellow Card", type: "fintech", country: "ZA", supportsRlusd: true, direction: "both", note: "primary pan-African RLUSD distributor" },
    { key: "absa", name: "Absa Bank", type: "bank", country: "ZA", supportsXrp: true, direction: "both", note: "Ripple custody" },
    { key: "chipper-za", name: "Chipper Cash", type: "fintech", country: "ZA", supportsRlusd: true, direction: "both", odl: true },
  ],
  NGN: [
    { key: "quidax", name: "Quidax", type: "cex", country: "NG", supportsXrp: true, direction: "both", note: "SEC provisional" },
    { key: "busha", name: "Busha", type: "cex", country: "NG", supportsXrp: true, direction: "both", note: "SEC" },
    { key: "yellow-card-ng", name: "Yellow Card", type: "fintech", country: "NG", supportsRlusd: true, direction: "both" },
    { key: "chipper-ng", name: "Chipper Cash", type: "fintech", country: "NG", supportsRlusd: true, direction: "both", odl: true },
    { key: "onafriq-ng", name: "Onafriq", type: "hub", country: "NG", supportsXrp: true, direction: "both", odl: true, note: "mobile-money ODL inbound" },
  ],
  KES: [
    { key: "yellow-card-ke", name: "Yellow Card", type: "fintech", country: "KE", supportsRlusd: true, direction: "both", note: "VASP Oct 2025" },
    { key: "chipper-ke", name: "Chipper Cash", type: "fintech", country: "KE", supportsRlusd: true, direction: "both", odl: true },
    { key: "kotani", name: "Kotani Pay", type: "mobile-money", country: "KE", supportsRlusd: true, direction: "both", note: "M-Pesa USSD bridge" },
    { key: "onafriq-ke", name: "Onafriq", type: "hub", country: "KE", supportsXrp: true, direction: "both", odl: true },
  ],
  GHS: [
    { key: "yellow-card-gh", name: "Yellow Card", type: "fintech", country: "GH", supportsRlusd: true, direction: "both" },
    { key: "chipper-gh", name: "Chipper Cash", type: "fintech", country: "GH", supportsRlusd: true, direction: "both", odl: true },
    { key: "onafriq-gh", name: "Onafriq", type: "hub", country: "GH", supportsXrp: true, direction: "both", odl: true, note: "MTN MoMo" },
    { key: "payangel", name: "PayAngel", type: "odl", country: "UK/GH", supportsXrp: true, direction: "onramp", odl: true, note: "UK→GH via Ripple" },
  ],
  UGX: [
    { key: "yellow-card-ug", name: "Yellow Card", type: "fintech", country: "UG", supportsRlusd: true, direction: "both" },
    { key: "chipper-ug", name: "Chipper Cash", type: "fintech", country: "UG", supportsRlusd: true, direction: "both", odl: true },
    { key: "kotani-ug", name: "Kotani Pay", type: "mobile-money", country: "UG", direction: "both" },
  ],
  TZS: [
    { key: "yellow-card-tz", name: "Yellow Card", type: "fintech", country: "TZ", supportsRlusd: true, direction: "both" },
    { key: "chipper-tz", name: "Chipper Cash", type: "fintech", country: "TZ", supportsRlusd: true, direction: "both", odl: true },
  ],
  XOF: [
    { key: "barka-xof", name: "BarkaChange", type: "mobile-money", country: "XOF", direction: "both", note: "Orange/Wave/MTN bridge via USDT" },
    { key: "yellow-card-sn", name: "Yellow Card (SN/CI)", type: "fintech", country: "SN", supportsRlusd: true, direction: "both" },
    { key: "onafriq-xof", name: "Onafriq", type: "hub", country: "XOF", supportsXrp: true, direction: "both", odl: true },
  ],
  XAF: [
    { key: "barka-xaf", name: "BarkaChange", type: "mobile-money", country: "XAF", supportsXrp: true, direction: "both", note: "USDT-bridged; XRP-reachable via swap" },
    { key: "yellow-card-cm", name: "Yellow Card (CM)", type: "fintech", country: "CM", supportsRlusd: true, supportsXrp: true, direction: "both" },
    { key: "chipper-xaf", name: "Chipper Cash (CM)", type: "fintech", country: "CM", supportsRlusd: true, direction: "both", odl: true },
    { key: "onafriq-xaf", name: "Onafriq", type: "hub", country: "XAF", supportsXrp: true, direction: "both", odl: true, note: "Central Africa mobile-money ODL fan-out" },
  ],
  MAD: [],
  TND: [],
  DZD: [], // zero-actor: Law 25-10 criminal ban
  ETB: [], // zero-actor: NBE Feb 2026 P2P ban
  PKR: [], // zero-actor: SBP ban, Tranglo remittance only
  BDT: [],
  LKR: [],
  NPR: [],
  RUB: [], // hard-block: all historical ramps (Garantex, Grinex) sanctioned
};

// ─── Multi-market SEPA CEXes ──────────────────────────────────────────────
// Kraken, Bitpanda and Binance all accept SEPA deposits in every EUR-area
// and Nordic currency, list XRP across the board, and (in Kraken's case)
// also list RLUSD. These should therefore appear as valid on-ramps for
// SEK / NOK / DKK / PLN / CZK / HUF / RON / etc., not just EUR. Without
// them, small-market European corridors scored as "thin actor coverage"
// when in reality Kraken IE serves every one of them. We inject them
// programmatically into the thin entries to keep the list DRY.

const SEPA_MULTIMARKET_ACTORS: CorridorActor[] = [
  { key: "kraken-sepa", name: "Kraken (SEPA)", type: "cex", country: "IE", supportsXrp: true, supportsRlusd: true, direction: "both", note: "MiCA CASP; SEPA deposits in all EU/Nordic fiats" },
  { key: "bitpanda-sepa", name: "Bitpanda (SEPA)", type: "cex", country: "AT", supportsXrp: true, direction: "both", note: "MiCA CASP; SEPA" },
  { key: "binance-sepa", name: "Binance (SEPA)", type: "cex", country: "MT", supportsXrp: true, supportsRlusd: true, direction: "both", note: "RLUSD + XRP listed; SEPA rails" },
];

const THIN_EU_FIATS = ["SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "UAH"];
for (const fiat of THIN_EU_FIATS) {
  if (!ACTORS_BY_CURRENCY[fiat]) ACTORS_BY_CURRENCY[fiat] = [];
  // Prepend so they show first in the UI; de-dupe by key.
  const existingKeys = new Set(ACTORS_BY_CURRENCY[fiat].map((a) => a.key));
  for (const a of SEPA_MULTIMARKET_ACTORS.slice().reverse()) {
    if (!existingKeys.has(a.key)) {
      ACTORS_BY_CURRENCY[fiat].unshift({
        ...a,
        // Rename the display label to show the local currency accepted
        name: `${a.name} · ${fiat}`,
      });
    }
  }
}

// ─── Corridor status classifier ───────────────────────────────────────────
// For off-chain-bridge corridors (no on-chain routes to path_find) we
// derive GREEN / AMBER / RED from the quality of each side's actor list,
// NOT from XRPL depth. This is the honest framing: an off-chain-bridge
// corridor's quality is governed by the real-world partner network, and
// a corridor with ODL partners and RLUSD venues on both sides is
// production-grade even though there is nothing to path_find.
//
// Scoring per side (pick the highest-scoring actor, no double counting):
//   +3  actor is a Ripple ODL / Ripple Payments partner
//   +2  actor has confirmed RLUSD support
//   +1  actor has XRP support
//   +1  bonus per additional actor beyond the first (caps at +3)
//
// Corridor status:
//   GREEN  min(srcScore, dstScore) >= 4    (both sides strong)
//   AMBER  min(srcScore, dstScore) >= 2    (both sides workable)
//   RED    min(srcScore, dstScore) <  2    (at least one side thin)

export interface OffChainBridgeClassification {
  status: "GREEN" | "AMBER" | "RED";
  srcScore: number;
  dstScore: number;
  reason: string;
}

function scoreActorSide(actors: CorridorActor[] | undefined): number {
  if (!actors || actors.length === 0) return 0;
  let best = 0;
  for (const a of actors) {
    let s = 0;
    if (a.odl) s += 3;
    if (a.supportsRlusd) s += 2;
    if (a.supportsXrp) s += 1;
    if (s > best) best = s;
  }
  // Breadth bonus: multiple actors on a side reduce single-counterparty risk.
  const breadth = Math.min(3, actors.length - 1);
  return best + breadth;
}

export function classifyOffChainBridgeStatus(
  corridor: CorridorPairDef,
): OffChainBridgeClassification {
  const srcScore = scoreActorSide(corridor.sourceActors);
  const dstScore = scoreActorSide(corridor.destActors);
  const m = Math.min(srcScore, dstScore);
  let status: OffChainBridgeClassification["status"];
  let reason: string;
  if (m >= 4) {
    status = "GREEN";
    reason = `Both sides strong: src score ${srcScore}, dst score ${dstScore}. ODL partners and/or RLUSD venues confirmed on both legs.`;
  } else if (m >= 2) {
    status = "AMBER";
    reason = `Workable but single-counterparty risk: src score ${srcScore}, dst score ${dstScore}. At least one XRPL-connected venue on each side.`;
  } else {
    status = "RED";
    reason = `Thin coverage: src score ${srcScore}, dst score ${dstScore}. One side lacks a confirmed XRPL-connected venue.`;
  }
  return { status, srcScore, dstScore, reason };
}

// Cross-currency super-hubs that act as ODL fan-out nodes. Surfaced in
// every off-chain-bridge corridor they participate in.
export const GLOBAL_HUB_ACTORS: CorridorActor[] = [
  { key: "tranglo-hub", name: "Tranglo", type: "hub", country: "MY", supportsXrp: true, direction: "both", odl: true, note: "25-corridor APAC hub; PH/TH/ID/VN/MY/BD/PK/LK/NP/IN + UAE" },
  { key: "onafriq-hub", name: "Onafriq (ex-MFS Africa)", type: "hub", country: "ZA", supportsXrp: true, direction: "both", odl: true, note: "500M wallets, 40 African countries" },
  { key: "yellow-card-hub", name: "Yellow Card", type: "hub", country: "Africa", supportsRlusd: true, direction: "both", note: "primary pan-African RLUSD distributor, 20+ countries" },
  { key: "chipper-hub", name: "Chipper Cash", type: "hub", country: "Africa", supportsRlusd: true, direction: "both", odl: true, note: "9 countries" },
];

// ─── Mass generation ──────────────────────────────────────────────────────

const FIAT_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY", "CHF", "AUD"];
const STABLE_CURRENCIES = ["RLUSD", "USDC", "USDT", "EUROP", "BBRL"];
const ALL_STABLES = STABLE_CURRENCIES;

/**
 * 1. FIAT × FIAT matrix — every ordered pair of the 7 fiat currencies.
 *    7 × 6 = 42 corridors.
 */
function generateFiatMatrix(): CorridorPairDef[] {
  const out: CorridorPairDef[] = [];
  for (const src of FIAT_CURRENCIES) {
    for (const dst of FIAT_CURRENCIES) {
      if (src === dst) continue;
      const pair = buildPair(src, dst, "fiat-fiat");
      if (pair) out.push(pair);
    }
  }
  return out;
}

/**
 * 2. FIAT ↔ STABLECOIN on/off ramps. Not all combinations make sense
 *    (USDT has no orderbook, EUROP is EUR-only, etc.) so we gate per stable.
 */
const STABLECOIN_FIAT_MATRIX: Record<string, string[]> = {
  // Which fiats are worth pairing with each stable
  RLUSD: ["USD", "EUR", "GBP", "JPY", "CNY", "CHF", "AUD"],
  USDC: ["USD", "EUR", "GBP", "JPY"],
  USDT: ["USD", "EUR", "JPY"],
  EUROP: ["EUR", "USD", "GBP"],
  BBRL: ["USD", "EUR"],
};

function generateStablecoinFiat(): CorridorPairDef[] {
  const out: CorridorPairDef[] = [];
  for (const stable of ALL_STABLES) {
    const fiats = STABLECOIN_FIAT_MATRIX[stable] ?? [];
    for (const fiat of fiats) {
      const onramp = buildPair(fiat, stable, "stable-onramp");
      const offramp = buildPair(stable, fiat, "stable-offramp");
      if (onramp) out.push(onramp);
      if (offramp) out.push(offramp);
    }
  }
  return out;
}

/**
 * 3. CROSS-STABLECOIN pairs (RLUSD↔USDC, etc.) — every ordered pair.
 */
function generateStablecoinCross(): CorridorPairDef[] {
  const out: CorridorPairDef[] = [];
  for (const a of ALL_STABLES) {
    for (const b of ALL_STABLES) {
      if (a === b) continue;
      const pair = buildPair(a, b, "special");
      if (pair) out.push(pair);
    }
  }
  return out;
}

/**
 * 4. XRP off-ramps — XRP → every fiat and every stablecoin. Plus XRP →
 *    crypto (BTC, SOLO) as legacy brokerage lanes.
 */
function generateXrpOfframps(): CorridorPairDef[] {
  const out: CorridorPairDef[] = [];
  const targets = [
    ...FIAT_CURRENCIES.map((f) => ({ sym: f, cat: "xrp-offramp" as CorridorCategory })),
    ...ALL_STABLES.map((s) => ({ sym: s, cat: "xrp-offramp" as CorridorCategory })),
    { sym: "BTC", cat: "crypto-spot" as CorridorCategory },
    { sym: "SOLO", cat: "crypto-spot" as CorridorCategory },
  ];
  for (const t of targets) {
    const pair = buildPair("XRP", t.sym, t.cat);
    if (pair) out.push(pair);
  }
  return out;
}

// ─── Off-chain-bridge corridors ───────────────────────────────────────────
// These fiat↔fiat lanes have no on-chain XRPL IOU issuers on either side
// (e.g. MXN, NGN, KRW, AED). The real flow goes:
//
//   local fiat → off-chain CEX/ODL partner → RLUSD (or XRP) on XRPL →
//   off-chain partner on destination side → destination fiat
//
// Because RLUSD / XRP are universal bridge assets, EVERY currency with at
// least one actor in ACTORS_BY_CURRENCY can reach every other such currency
// via XRPL. The generator therefore emits the full cross-product — e.g.
// INR→EUR, NGN→KRW, PHP→MXN — instead of a hand-picked list. The answer
// to "wouldn't it be a corridor with that?" is yes, and now it is.
//
// Importance for auto-generated pairs comes from the CURRENCY_WEIGHT map.
// Flagship Ripple ODL corridors get an additional boost from the map below.
// On-chain fiat-fiat pairs (USD↔EUR, USD↔JPY, etc.) are emitted FIRST in
// assembleCatalog() and win id collisions, so the 42 on-chain lanes keep
// their real XRPL scanning while the 2000+ off-chain lanes ride on top.

const OFF_CHAIN_BOOST: Record<string, number> = {
  // --- flagship Ripple ODL corridors ---
  "usd-mxn": 18, "mxn-usd": 16, // Bitso
  "usd-brl": 14, "brl-usd": 12, // Travelex + Mercado Bitcoin
  "usd-php": 14, "php-usd": 12, // Tranglo + iRemit + Coins.ph
  "usd-inr": 14, "inr-usd": 12, // UAE + Federal Bank flows
  "usd-ngn": 12, "usd-kes": 11,
  "usd-sgd": 12, "usd-hkd": 12, "usd-krw": 12,
  "usd-aed": 12, "aed-usd": 11,
  "usd-zar": 10, "eur-zar": 10,
  "jpy-php": 14, "jpy-thb": 12, // SBI Remit
  "jpy-vnd": 11, "jpy-idr": 10,
  "eur-brl": 11, // Unicâmbio
  "eur-try": 11, "usd-try": 10, // BtcTurk
  "aed-inr": 13, "aed-php": 12, "aed-pkr": 11,
  "aed-bdt": 10, "aed-lkr": 9, "aed-npr": 8,
  "sar-inr": 11, "sar-php": 10, "sar-pkr": 10,
  "qar-php": 9,
  "gbp-ngn": 10, "eur-ngn": 10, "gbp-ghs": 10,
  "gbp-kes": 9, "eur-kes": 9,
  "zar-ngn": 9, "zar-kes": 8, // Onafriq intra-Africa
  "sgd-php": 10, "sgd-inr": 10,
  "hkd-php": 9, "aud-php": 10, // FlashFX/Novatti
  "myr-bdt": 8,
  // Cross-reachable secondary lanes the user explicitly asked about:
  // "INR → EUR via RLUSD" and symmetric pairs.
  "inr-eur": 10, "eur-inr": 10,
  "inr-gbp": 9, "gbp-inr": 9,
  "ngn-eur": 8, "kes-eur": 7,
  "mxn-eur": 8, "brl-eur": 9,
  "thb-sgd": 8, "php-sgd": 9,
  "krw-jpy": 10, "jpy-krw": 10,
};

// Currencies eligible for the full cross-product. Any currency with at
// least one entry in ACTORS_BY_CURRENCY qualifies — the bridge asset
// (RLUSD or XRP) is what links them, not per-currency listings.
function offChainEligibleCurrencies(): string[] {
  return Object.keys(ACTORS_BY_CURRENCY).filter(
    (c) => (ACTORS_BY_CURRENCY[c]?.length ?? 0) > 0,
  );
}

function buildOffChainBridgePair(
  src: string,
  dst: string,
  importanceBoost: number,
): CorridorPairDef | null {
  const srcActors = ACTORS_BY_CURRENCY[src];
  const dstActors = ACTORS_BY_CURRENCY[dst];
  // Off-chain corridors require at least one off-chain actor on each side.
  if (!srcActors || !dstActors || srcActors.length === 0 || dstActors.length === 0) {
    return null;
  }
  const importance = inferImportance(src, dst, importanceBoost);
  const tier = inferTier(importance);
  const id = pairSlug(src, dst);
  const srcLabel = ASSET_META[src]?.label ?? src;
  const dstLabel = ASSET_META[dst]?.label ?? dst;
  const srcFlag = ASSET_META[src]?.flag ?? asset(src).flag;
  const dstFlag = ASSET_META[dst]?.flag ?? asset(dst).flag;
  const odlCount =
    srcActors.filter((a) => a.odl).length +
    dstActors.filter((a) => a.odl).length;
  const rlusdCount =
    srcActors.filter((a) => a.supportsRlusd).length +
    dstActors.filter((a) => a.supportsRlusd).length;

  return {
    id,
    label: `${src} → ${dst}`,
    shortLabel: `${src} → ${dst}`,
    flag: `${srcFlag} → ${dstFlag}`,
    tier,
    importance,
    region: inferRegion(src, dst),
    category: "off-chain-bridge",
    description:
      `Real-world fiat lane from ${srcLabel} to ${dstLabel}. XRPL has no ` +
      `direct IOU trust line for either currency, so the route bridges via ` +
      `RLUSD held by ${srcActors.length} source-side and ${dstActors.length} ` +
      `destination-side partners. ${odlCount > 0 ? `${odlCount} Ripple ODL partner(s) service this corridor.` : "No Ripple ODL partner recorded on this lane yet — bridges rely on RLUSD liquidity held by regional CEXes."}`,
    useCase: `Cross-border ${srcLabel}→${dstLabel} settlement via the XRPL RLUSD layer.`,
    highlights: [
      `${srcActors.length} ${src} on-ramp${srcActors.length === 1 ? "" : "s"} · ${dstActors.length} ${dst} off-ramp${dstActors.length === 1 ? "" : "s"}`,
      `${rlusdCount} actor${rlusdCount === 1 ? "" : "s"} with confirmed RLUSD support`,
      `${odlCount} Ripple ODL / Ripple Payments partner${odlCount === 1 ? "" : "s"}`,
      "XRPL hop: RLUSD (no on-chain IOU trust line on either fiat leg)",
    ],
    source: asset(src),
    dest: asset(dst),
    amount: DEFAULT_AMOUNT[src] ?? "1000",
    routes: [], // intentionally empty — see refreshService handling
    sourceActors: srcActors,
    destActors: dstActors,
    bridgeAsset: "RLUSD",
  };
}

function generateOffChainBridgeCorridors(): CorridorPairDef[] {
  const out: CorridorPairDef[] = [];
  const currencies = offChainEligibleCurrencies();
  for (const src of currencies) {
    for (const dst of currencies) {
      if (src === dst) continue;
      const id = pairSlug(src, dst);
      const boost = OFF_CHAIN_BOOST[id] ?? 0;
      const pair = buildOffChainBridgePair(src, dst, boost);
      if (pair) out.push(pair);
    }
  }
  return out;
}

/**
 * 6. Final catalog assembly. Deduplicate by id in case any auto-generator
 *    collides with an override. On-chain generators run FIRST so that when
 *    an id collision happens (e.g. "usd-jpy" exists both as an on-chain
 *    fiat-fiat pair and an off-chain-bridge pair) the on-chain version
 *    wins — it has real routes to scan.
 */
function assembleCatalog(): CorridorPairDef[] {
  const all = [
    ...generateFiatMatrix(),
    ...generateStablecoinFiat(),
    ...generateStablecoinCross(),
    ...generateXrpOfframps(),
    ...generateOffChainBridgeCorridors(),
  ];
  const byId = new Map<string, CorridorPairDef>();
  for (const p of all) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  return Array.from(byId.values());
}

export const CORRIDOR_CATALOG: CorridorPairDef[] = assembleCatalog();

export function getCatalogEntry(id: string): CorridorPairDef | undefined {
  return CORRIDOR_CATALOG.find((c) => c.id === id);
}
