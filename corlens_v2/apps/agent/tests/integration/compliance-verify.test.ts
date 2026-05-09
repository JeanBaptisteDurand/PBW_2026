import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadAgentEnv } from "../../src/env.js";

const env = loadAgentEnv({
  PORT: "3006",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  CORRIDOR_BASE_URL: "http://localhost:3004",
  PATH_BASE_URL: "http://localhost:3005",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  IDENTITY_BASE_URL: "http://identity:3001",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
});

const RUN_ID = "33333333-3333-3333-3333-333333330002";
const HASH = "a".repeat(64);

describe("GET /api/compliance/verify", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp(env);
    await app.prisma.safePathRun.deleteMany({ where: { id: RUN_ID } });
    await app.prisma.safePathRun.deleteMany({ where: { auditHash: HASH } });
    await app.prisma.safePathRun.create({
      data: {
        id: RUN_ID,
        srcCcy: "USD",
        dstCcy: "MXN",
        amount: "100",
        maxRiskTolerance: "MED",
        verdict: "SAFE",
        reasoning: "Healthy corridor.",
        resultJson: { riskScore: 0.2 },
        reportMarkdown: null,
        corridorId: null,
        analysisIds: [],
        riskScore: 0.2,
        auditHash: HASH,
      },
    });
  });

  afterAll(async () => {
    await app.prisma.safePathRun.deleteMany({ where: { id: RUN_ID } });
    await app.close();
  });

  it("returns 200 with the run metadata for a known hash", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/compliance/verify?hash=${HASH}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.runId).toBe(RUN_ID);
    expect(body.verdict).toBe("SAFE");
    expect(body.srcCcy).toBe("USD");
    expect(body.dstCcy).toBe("MXN");
    expect(typeof body.generatedAt).toBe("string");
  });

  it("returns 404 valid:false for an unknown hash", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/compliance/verify?hash=${"b".repeat(64)}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ valid: false, error: "not_found" });
  });

  it("rejects non-hex hash with 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/compliance/verify?hash=not-a-valid-hash",
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects too-short hash with 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/compliance/verify?hash=abc",
    });
    expect(res.statusCode).toBe(400);
  });
});
