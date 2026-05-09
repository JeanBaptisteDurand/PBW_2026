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

type FakeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function makeIdentityFetch(state: { isPremium: boolean; userExists: boolean }): FakeFetch {
  return async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/internal/premium-status")) {
      if (!state.userExists) {
        return new Response(JSON.stringify({ error: "user not found" }), { status: 404 });
      }
      return new Response(JSON.stringify({ isPremium: state.isPremium, expiresAt: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  };
}

const TEST_RUN_ID = "33333333-3333-3333-3333-333333330001";

describe("GET /api/compliance/:id/pdf", () => {
  let appPremium: Awaited<ReturnType<typeof buildApp>>;
  let appNonPremium: Awaited<ReturnType<typeof buildApp>>;
  let appUnknownUser: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    appPremium = await buildApp(env, {
      fetch: makeIdentityFetch({ isPremium: true, userExists: true }) as unknown as typeof fetch,
    });
    appNonPremium = await buildApp(env, {
      fetch: makeIdentityFetch({ isPremium: false, userExists: true }) as unknown as typeof fetch,
    });
    appUnknownUser = await buildApp(env, {
      fetch: makeIdentityFetch({ isPremium: false, userExists: false }) as unknown as typeof fetch,
    });

    await appPremium.prisma.safePathRun.deleteMany({ where: { id: TEST_RUN_ID } });
    await appPremium.prisma.safePathRun.create({
      data: {
        id: TEST_RUN_ID,
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
        auditHash: "deadbeef".repeat(8),
      },
    });
  });

  afterAll(async () => {
    await appPremium.prisma.safePathRun.deleteMany({ where: { id: TEST_RUN_ID } });
    await appPremium.close();
    await appNonPremium.close();
    await appUnknownUser.close();
  });

  it("returns 200 with application/pdf for a premium user", async () => {
    const res = await appPremium.inject({
      method: "GET",
      url: `/api/compliance/${TEST_RUN_ID}/pdf`,
      headers: { "x-user-id": "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/pdf/);
    expect(res.headers["content-disposition"]).toContain(`compliance-${TEST_RUN_ID}.pdf`);
    expect(res.rawPayload.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("returns 402 for a non-premium user", async () => {
    const res = await appNonPremium.inject({
      method: "GET",
      url: `/api/compliance/${TEST_RUN_ID}/pdf`,
      headers: { "x-user-id": "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error).toBe("premium_required");
  });

  it("returns 401 when X-User-Id is missing", async () => {
    const res = await appPremium.inject({
      method: "GET",
      url: `/api/compliance/${TEST_RUN_ID}/pdf`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("missing_user");
  });

  it("returns 401 user_not_found when identity returns 404", async () => {
    const res = await appUnknownUser.inject({
      method: "GET",
      url: `/api/compliance/${TEST_RUN_ID}/pdf`,
      headers: { "x-user-id": "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("user_not_found");
  });

  it("returns 404 for an unknown runId after passing premium check", async () => {
    const res = await appPremium.inject({
      method: "GET",
      url: "/api/compliance/00000000-0000-0000-0000-000000000000/pdf",
      headers: { "x-user-id": "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.statusCode).toBe(404);
  });
});
