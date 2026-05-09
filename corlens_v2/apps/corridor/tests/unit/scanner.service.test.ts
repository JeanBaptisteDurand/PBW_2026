import { describe, expect, it, vi } from "vitest";
import { createScannerService } from "../../src/services/scanner.service.js";

describe("scanner.service", () => {
  it("returns GREEN status when path_find succeeds with multiple paths", async () => {
    const marketData = {
      pathFind: vi.fn().mockResolvedValue({ result: { alternatives: [{ paths_computed: [], source_amount: "100" }, { paths_computed: [], source_amount: "100" }] } }),
      bookOffers: vi.fn(),
      partnerDepth: vi.fn(),
    };
    const svc = createScannerService({ marketData: marketData as never, timeoutMs: 5000 });
    const out = await svc.scan({ id: "usd-mxn", source: { currency: "USD" }, dest: { currency: "MXN" }, amount: "100" });
    expect(out.status).toBe("GREEN");
    expect(out.pathCount).toBe(2);
  });

  it("returns RED on path_find error", async () => {
    const marketData = {
      pathFind: vi.fn().mockRejectedValue(new Error("xrpl unreachable")),
      bookOffers: vi.fn(),
      partnerDepth: vi.fn(),
    };
    const svc = createScannerService({ marketData: marketData as never, timeoutMs: 5000 });
    const out = await svc.scan({ id: "usd-mxn", source: { currency: "USD" }, dest: { currency: "MXN" }, amount: "100" });
    expect(out.status).toBe("RED");
    expect(out.error).toMatch(/xrpl unreachable/);
  });

  it("returns RED status when source or dest is missing", async () => {
    const marketData = { pathFind: vi.fn(), bookOffers: vi.fn(), partnerDepth: vi.fn() };
    const svc = createScannerService({ marketData: marketData as never, timeoutMs: 5000 });
    const out = await svc.scan({ id: "x", source: null, dest: null, amount: null });
    expect(out.status).toBe("RED");
  });
});
