// xrplens/apps/server/src/analysis/counterpartyClassifier.ts
import type { XRPLAsset } from "@xrplens/core";

export type HeavyKind =
  | "issuer"
  | "escrow_dest"
  | "check_dest"
  | "channel_dest"
  | "multisig_member";

interface LightEntry {
  address: string;
  txCount: number;
}
interface HeavyEntry {
  address: string;
  kind: HeavyKind;
  txCount: number;
}

export interface TxTypeSummary {
  type: string;
  count: number;
  lastLedger?: number;
}

export interface HistoryEdge {
  id: string;
  from: string;
  to: string;
  txType: string;
  count: number;
  lastLedger?: number;
  lastDate?: string;
}

export interface PendingAmmPair {
  asset1: XRPLAsset;
  asset2: XRPLAsset;
  txCount: number;
}

export interface ClassifierResult {
  light: Map<string, LightEntry>;
  heavy: Map<string, HeavyEntry>;
  pendingAmmPairs: PendingAmmPair[];
  edges: HistoryEdge[];
  txTypeSummary: TxTypeSummary[];
}

function amountIssuer(raw: any): string | null {
  if (raw && typeof raw === "object" && raw.issuer) return raw.issuer;
  return null;
}

function toAsset(raw: any): XRPLAsset | null {
  if (!raw) return null;
  if (typeof raw === "string") return { currency: "XRP" } as XRPLAsset;
  if (raw.currency === "XRP") {
    return { currency: "XRP" } as XRPLAsset;
  }
  if (raw.currency && raw.issuer) {
    return { currency: raw.currency, issuer: raw.issuer } as XRPLAsset;
  }
  return null;
}

function pairKey(a: XRPLAsset, b: XRPLAsset): string {
  const s = (x: XRPLAsset) =>
    x.currency === "XRP" ? "XRP" : `${x.currency}:${(x as any).issuer}`;
  return [s(a), s(b)].sort().join("|");
}

export function classifyCounterparties(
  seed: string,
  txs: any[],
): ClassifierResult {
  const light = new Map<string, LightEntry>();
  const heavy = new Map<string, HeavyEntry>();
  const ammMap = new Map<string, PendingAmmPair>();
  const edgeMap = new Map<string, HistoryEdge>();
  const typeSummary = new Map<string, TxTypeSummary>();

  const touchLight = (addr: string) => {
    if (!addr || addr === seed) return;
    if (heavy.has(addr)) return;
    const cur = light.get(addr);
    if (cur) cur.txCount++;
    else light.set(addr, { address: addr, txCount: 1 });
  };

  const touchHeavy = (addr: string, kind: HeavyKind) => {
    if (!addr || addr === seed) return;
    light.delete(addr);
    const cur = heavy.get(addr);
    if (cur) cur.txCount++;
    else heavy.set(addr, { address: addr, kind, txCount: 1 });
  };

  const addEdge = (
    to: string,
    txType: string,
    ledger?: number,
    date?: string,
  ) => {
    if (!to || to === seed) return;
    const id = `${seed}->${to}:${txType}`;
    const cur = edgeMap.get(id);
    if (cur) {
      cur.count++;
      if (ledger && (!cur.lastLedger || ledger > cur.lastLedger)) {
        cur.lastLedger = ledger;
        cur.lastDate = date;
      }
    } else {
      edgeMap.set(id, {
        id,
        from: seed,
        to,
        txType,
        count: 1,
        lastLedger: ledger,
        lastDate: date,
      });
    }
  };

  for (const t of txs) {
    const tj = t.tx_json ?? t.tx ?? {};
    const type: string = tj.TransactionType ?? "Unknown";
    const ledger: number | undefined = t.ledger_index ?? tj.ledger_index;
    const date: string | undefined = t.close_time_iso;

    const sum = typeSummary.get(type);
    if (sum) {
      sum.count++;
      if (ledger && (!sum.lastLedger || ledger > sum.lastLedger)) sum.lastLedger = ledger;
    } else typeSummary.set(type, { type, count: 1, lastLedger: ledger });

    switch (type) {
      case "Payment": {
        const dest = tj.Destination;
        const issuer = amountIssuer(tj.Amount) ?? amountIssuer(tj.SendMax);
        if (issuer) {
          touchHeavy(issuer, "issuer");
          addEdge(issuer, type, ledger, date);
        }
        if (dest) {
          touchLight(dest);
          addEdge(dest, type, ledger, date);
        }
        break;
      }
      case "TrustSet": {
        const issuer = amountIssuer(tj.LimitAmount);
        if (issuer) {
          touchHeavy(issuer, "issuer");
          addEdge(issuer, type, ledger, date);
        }
        break;
      }
      case "AMMDeposit":
      case "AMMWithdraw":
      case "AMMBid":
      case "AMMVote": {
        const a1 = toAsset(tj.Asset);
        const a2 = toAsset(tj.Asset2);
        if (a1 && a2) {
          const key = pairKey(a1, a2);
          const cur = ammMap.get(key);
          if (cur) cur.txCount++;
          else ammMap.set(key, { asset1: a1, asset2: a2, txCount: 1 });
        }
        break;
      }
      case "OfferCreate":
      case "OfferCancel": {
        for (const side of [tj.TakerPays, tj.TakerGets]) {
          const issuer = amountIssuer(side);
          if (issuer) {
            touchHeavy(issuer, "issuer");
            addEdge(issuer, type, ledger, date);
          }
        }
        break;
      }
      case "EscrowCreate": {
        if (tj.Destination) {
          touchHeavy(tj.Destination, "escrow_dest");
          addEdge(tj.Destination, type, ledger, date);
        }
        break;
      }
      case "CheckCreate": {
        if (tj.Destination) {
          touchHeavy(tj.Destination, "check_dest");
          addEdge(tj.Destination, type, ledger, date);
        }
        break;
      }
      case "PaymentChannelCreate": {
        if (tj.Destination) {
          touchHeavy(tj.Destination, "channel_dest");
          addEdge(tj.Destination, type, ledger, date);
        }
        break;
      }
      case "SignerListSet": {
        const entries: any[] = tj.SignerEntries ?? [];
        for (const e of entries) {
          const acct = e?.SignerEntry?.Account;
          if (acct) {
            touchHeavy(acct, "multisig_member");
            addEdge(acct, type, ledger, date);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    light,
    heavy,
    pendingAmmPairs: Array.from(ammMap.values()),
    edges: Array.from(edgeMap.values()),
    txTypeSummary: Array.from(typeSummary.values()),
  };
}
