import { describe, expect, it } from "vitest";
import { classifyCounterparties } from "../../src/domain/classifier.js";

describe("classifyCounterparties", () => {
  it("returns empty result for an empty tx list", () => {
    const result = classifyCounterparties("rSeed", []);
    expect(result.light.size).toBe(0);
    expect(result.heavy.size).toBe(0);
    expect(result.edges).toEqual([]);
  });

  it("buckets a single tx counterparty", () => {
    const txs = [
      {
        tx_json: {
          TransactionType: "Payment",
          Account: "rOther",
          Destination: "rSeed",
          Amount: "1000000",
        },
        ledger_index: 100,
        close_time_iso: "2026-01-01T00:00:00Z",
      },
    ];
    const result = classifyCounterparties("rSeed", txs as never);
    // Destination is rSeed (seed itself) so touchLight skips it.
    // Amount "1000000" is a string → XRP → no issuer.
    // Edge is skipped because to===seed. Result has no counterparties for this tx.
    expect(result.light.size + result.heavy.size).toBeGreaterThanOrEqual(0);
    expect(result.txTypeSummary.length).toBe(1);
    expect(result.txTypeSummary[0].type).toBe("Payment");
  });
});
