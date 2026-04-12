// corlens/apps/server/tests/analysis/counterpartyClassifier.test.ts
import { describe, it, expect } from "vitest";
import { classifyCounterparties } from "../../src/analysis/counterpartyClassifier.js";

const SEED = "rSeed11111111111111111111111111111";
const ISSUER = "rIssuer1111111111111111111111111111";
const DEST = "rDest111111111111111111111111111111";
const SIGNER = "rSigner11111111111111111111111111111";

// Shape: XRPL account_tx api_version 2 item — { tx_json, meta, ledger_index, close_time_iso }
function tx(type: string, extra: Record<string, unknown> = {}, ledger = 1_000_000) {
  return {
    ledger_index: ledger,
    close_time_iso: "2026-04-08T12:00:00Z",
    tx_json: { TransactionType: type, Account: SEED, ...extra },
    meta: {},
  };
}

describe("classifyCounterparties", () => {
  it("routes XRP Payment destination to light", () => {
    const txs = [tx("Payment", { Destination: DEST, Amount: "1000000" })];
    const { light, heavy, edges, txTypeSummary } = classifyCounterparties(SEED, txs);
    expect(heavy.size).toBe(0);
    expect(light.get(DEST)?.txCount).toBe(1);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ from: SEED, to: DEST, txType: "Payment", count: 1 });
    expect(txTypeSummary).toEqual([{ type: "Payment", count: 1, lastLedger: 1_000_000 }]);
  });

  it("routes IOU Payment issuer to heavy and destination to light", () => {
    const txs = [
      tx("Payment", {
        Destination: DEST,
        Amount: { currency: "USD", issuer: ISSUER, value: "10" },
      }),
    ];
    const { light, heavy } = classifyCounterparties(SEED, txs);
    expect(heavy.get(ISSUER)?.kind).toBe("issuer");
    expect(light.get(DEST)).toBeTruthy();
  });

  it("routes TrustSet issuer to heavy", () => {
    const txs = [
      tx("TrustSet", {
        LimitAmount: { currency: "USD", issuer: ISSUER, value: "100" },
      }),
    ];
    const { heavy } = classifyCounterparties(SEED, txs);
    expect(heavy.get(ISSUER)?.kind).toBe("issuer");
  });

  it("routes AMMDeposit to pendingAmmPairs not heavy", () => {
    const txs = [
      tx("AMMDeposit", {
        Asset: { currency: "XRP" },
        Asset2: { currency: "USD", issuer: ISSUER },
      }),
    ];
    const { heavy, pendingAmmPairs } = classifyCounterparties(SEED, txs);
    expect(heavy.size).toBe(0);
    expect(pendingAmmPairs).toHaveLength(1);
    expect(pendingAmmPairs[0].txCount).toBe(1);
  });

  it("deduplicates AMM pairs across multiple tx", () => {
    const txs = [
      tx("AMMDeposit", {
        Asset: { currency: "XRP" },
        Asset2: { currency: "USD", issuer: ISSUER },
      }),
      tx("AMMWithdraw", {
        Asset: { currency: "XRP" },
        Asset2: { currency: "USD", issuer: ISSUER },
      }),
    ];
    const { pendingAmmPairs } = classifyCounterparties(SEED, txs);
    expect(pendingAmmPairs).toHaveLength(1);
    expect(pendingAmmPairs[0].txCount).toBe(2);
  });

  it("extracts issuers from OfferCreate TakerPays and TakerGets", () => {
    const txs = [
      tx("OfferCreate", {
        TakerPays: { currency: "USD", issuer: ISSUER, value: "1" },
        TakerGets: "1000000",
      }),
    ];
    const { heavy } = classifyCounterparties(SEED, txs);
    expect(heavy.get(ISSUER)?.kind).toBe("issuer");
  });

  it("routes EscrowCreate / CheckCreate / PaymentChannelCreate destinations to heavy with specific kinds", () => {
    const txs = [
      tx("EscrowCreate", { Destination: DEST, Amount: "1000000" }, 1),
      tx("CheckCreate", { Destination: DEST, SendMax: "1000000" }, 2),
      tx("PaymentChannelCreate", { Destination: DEST, Amount: "1000000" }, 3),
    ];
    const { heavy } = classifyCounterparties(SEED, txs);
    // Same dest address classified three times; last classification wins OR first stays.
    // Accept any of the three kinds for this dedup-by-address behavior.
    const kind = heavy.get(DEST)?.kind;
    expect(["escrow_dest", "check_dest", "channel_dest"]).toContain(kind);
  });

  it("routes SignerListSet entries to multisig_member heavy", () => {
    const txs = [
      tx("SignerListSet", {
        SignerEntries: [
          { SignerEntry: { Account: SIGNER, SignerWeight: 1 } },
        ],
      }),
    ];
    const { heavy } = classifyCounterparties(SEED, txs);
    expect(heavy.get(SIGNER)?.kind).toBe("multisig_member");
  });

  it("ignores NFT types for graph but counts in txTypeSummary", () => {
    const txs = [tx("NFTokenMint", { NFTokenTaxon: 0 })];
    const { heavy, light, edges, txTypeSummary } = classifyCounterparties(SEED, txs);
    expect(heavy.size).toBe(0);
    expect(light.size).toBe(0);
    expect(edges).toHaveLength(0);
    expect(txTypeSummary[0]).toMatchObject({ type: "NFTokenMint", count: 1 });
  });

  it("merges repeated Payment edges by (from,to,txType) with cumulative count", () => {
    const txs = [
      tx("Payment", { Destination: DEST, Amount: "1" }, 1),
      tx("Payment", { Destination: DEST, Amount: "2" }, 2),
      tx("Payment", { Destination: DEST, Amount: "3" }, 3),
    ];
    const { edges } = classifyCounterparties(SEED, txs);
    expect(edges).toHaveLength(1);
    expect(edges[0].count).toBe(3);
    expect(edges[0].lastLedger).toBe(3);
  });
});
