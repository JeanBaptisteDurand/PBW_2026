import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createXRPLClient } from "../../src/xrpl/client.js";
import type { XRPLClientWrapper } from "../../src/xrpl/client.js";
import { analyzeCorridors } from "../../src/analysis/corridorAnalyzer.js";
import { fetchAccountInfo } from "../../src/xrpl/fetchers.js";
import type { CorridorRequest } from "@corlens/core";

// ─── Cross-check: CorLens vs raw XRPL rpc ────────────────────────────────
//
// Purpose: prove that the CorridorAnalysis CorLens returns matches what a
// reader could get by calling ripple_path_find + account_info themselves.
// Three properties we verify:
//
//   1. analyzeCorridors(USD.Bitstamp → RLUSD) returns ≥ 1 path
//   2. The winning path goes through the RLUSD canonical issuer
//   3. The risk flag attached to the RLUSD hop matches the raw
//      AllowTrustLineClawback (lsfAllowTrustLineClawback, 0x80000000)
//      bit on the RLUSD issuer's account_info
//
// If (3) diverges, CorLens is lying about the risk profile — this test
// catches that class of bug before it reaches the pitch.

const BITSTAMP = "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B";
const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const ALLOW_CLAWBACK_FLAG = 0x80000000;

describe("Corridor cross-check: CorLens matches raw XRPL rpc", () => {
  let client: XRPLClientWrapper;

  beforeAll(async () => {
    client = createXRPLClient();
    await client.connect();
  }, 30_000);

  afterAll(async () => {
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
  });

  it(
    "USD.Bitstamp → RLUSD: CorLens risk flags match raw account_info flags",
    async () => {
      // 1. Fetch the RLUSD issuer's raw account_data — this is the source
      //    of truth the risk engine must honor.
      const raw = (await fetchAccountInfo(client, RLUSD_ISSUER)) as any;
      const rawFlags = raw?.result?.account_data?.Flags ?? 0;
      const rawHasClawback = (rawFlags & ALLOW_CLAWBACK_FLAG) !== 0;
      expect(rawHasClawback, "RLUSD must have AllowClawback set on mainnet").toBe(true);

      // 2. Run CorLens corridor analysis end-to-end.
      const request: CorridorRequest = {
        sourceCurrency: "USD",
        sourceIssuer: BITSTAMP,
        sourceAccount: BITSTAMP,
        destCurrency: "RLUSD",
        destIssuer: RLUSD_ISSUER,
        amount: "100",
      };
      const analysis = await analyzeCorridors(client, request);

      // 3. Shape checks
      expect(analysis.paths.length).toBeGreaterThan(0);
      expect(analysis.recommendedPathIndex).toBeGreaterThanOrEqual(0);

      const recommended = analysis.paths[analysis.recommendedPathIndex];
      expect(recommended).toBeDefined();
      expect(recommended.hops.length).toBeGreaterThan(0);

      // 4. At least one hop should touch the RLUSD issuer — that hop is
      //    where the clawback flag must surface.
      const rlusdHop = recommended.hops.find(
        (h) => h.issuer === RLUSD_ISSUER || h.account === RLUSD_ISSUER,
      );
      expect(rlusdHop, "Recommended path should touch the RLUSD issuer").toBeDefined();

      const clawbackFlag = rlusdHop!.riskFlags.find((f) => f.flag === "CLAWBACK_ENABLED");
      expect(
        clawbackFlag,
        "CorLens must flag the RLUSD hop as CLAWBACK_ENABLED to match the raw ledger",
      ).toBeDefined();
      expect(clawbackFlag?.severity).toBe("HIGH");
    },
    90_000,
  );

  it(
    "USD.Bitstamp → USD.GateHub: at least one path resolves and all hops have risk scores",
    async () => {
      const request: CorridorRequest = {
        sourceCurrency: "USD",
        sourceIssuer: BITSTAMP,
        sourceAccount: BITSTAMP,
        destCurrency: "USD",
        destIssuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
        amount: "100",
      };
      const analysis = await analyzeCorridors(client, request);

      expect(analysis.paths.length).toBeGreaterThan(0);
      for (const path of analysis.paths) {
        expect(path.sourceAmount).toBeTruthy();
        expect(Number.isFinite(path.cost)).toBe(true);
        expect(Number.isFinite(path.riskScore)).toBe(true);
        // Every hop must have a parseable risk score (≥ 0) — catches the
        // class of bug where a hop silently returns NaN.
        for (const hop of path.hops) {
          expect(Number.isFinite(hop.riskScore)).toBe(true);
          expect(hop.riskScore).toBeGreaterThanOrEqual(0);
        }
      }

      // Both default and recommended must point at real paths.
      expect(analysis.paths[analysis.defaultPathIndex]).toBeDefined();
      expect(analysis.paths[analysis.recommendedPathIndex]).toBeDefined();
    },
    90_000,
  );

  it(
    "XRP → SOLO: clean lane — recommended path should have riskScore 0",
    async () => {
      const request: CorridorRequest = {
        sourceCurrency: "XRP",
        sourceAccount: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
        destCurrency: "SOLO",
        destIssuer: "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",
        amount: "100",
      };
      const analysis = await analyzeCorridors(client, request);

      expect(analysis.paths.length).toBeGreaterThan(0);
      const rec = analysis.paths[analysis.recommendedPathIndex];
      expect(rec.riskScore).toBe(0);

      // Verify independently that the SOLO issuer has no clawback flag.
      const raw = (await fetchAccountInfo(client, request.destIssuer)) as any;
      const rawFlags = raw?.result?.account_data?.Flags ?? 0;
      expect((rawFlags & ALLOW_CLAWBACK_FLAG) === 0).toBe(true);
    },
    90_000,
  );
});
