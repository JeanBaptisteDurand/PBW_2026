import { describe, expect, it } from "vitest";
import { computeStatus } from "../../src/services/status-compute.service.js";

describe("computeStatus", () => {
  it("UNKNOWN when no scan has happened", () => {
    expect(computeStatus({ pathCount: 0, hasError: false, lastRefreshedAt: null })).toBe("UNKNOWN");
  });
  it("RED on error", () => {
    expect(computeStatus({ pathCount: 0, hasError: true, lastRefreshedAt: new Date() })).toBe("RED");
  });
  it("RED when zero paths", () => {
    expect(computeStatus({ pathCount: 0, hasError: false, lastRefreshedAt: new Date() })).toBe("RED");
  });
  it("AMBER when 1 path", () => {
    expect(computeStatus({ pathCount: 1, hasError: false, lastRefreshedAt: new Date() })).toBe("AMBER");
  });
  it("GREEN when 2+ paths", () => {
    expect(computeStatus({ pathCount: 3, hasError: false, lastRefreshedAt: new Date() })).toBe("GREEN");
  });
});
