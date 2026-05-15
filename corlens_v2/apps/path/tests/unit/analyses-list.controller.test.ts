import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { registerAnalysesListRoutes } from "../../src/controllers/analyses-list.controller.js";
import type { AnalysisRepo, AnalysisRow } from "../../src/repositories/analysis.repo.js";

function makeRow(overrides: Partial<AnalysisRow>): AnalysisRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    status: "done",
    seedAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
    seedLabel: null,
    depth: 1,
    error: null,
    summaryJson: null,
    userId: "user-1",
    createdAt: new Date("2026-05-15T12:00:00.000Z"),
    updatedAt: new Date("2026-05-15T12:00:01.000Z"),
    ...overrides,
  };
}

function makeApp(repo: AnalysisRepo) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerAnalysesListRoutes(app, repo);
  return app;
}

describe("path analyses-list controller", () => {
  it("GET /api/analyses returns the user's analyses in createdAt desc", async () => {
    const rows = [
      makeRow({
        id: "00000000-0000-0000-0000-000000000003",
        createdAt: new Date("2026-05-15T13:00:00.000Z"),
      }),
      makeRow({
        id: "00000000-0000-0000-0000-000000000002",
        createdAt: new Date("2026-05-15T12:30:00.000Z"),
      }),
      makeRow({
        id: "00000000-0000-0000-0000-000000000001",
        createdAt: new Date("2026-05-15T12:00:00.000Z"),
      }),
    ];
    const repo = {
      listForUser: vi.fn(async () => rows),
    } as unknown as AnalysisRepo;
    const app = makeApp(repo);
    const res = await app.inject({
      method: "GET",
      url: "/api/analyses",
      headers: { "x-user-id": "user-1" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analyses).toHaveLength(3);
    expect(body.analyses[0].id).toBe("00000000-0000-0000-0000-000000000003");
    expect(body.analyses[2].id).toBe("00000000-0000-0000-0000-000000000001");
    expect(repo.listForUser).toHaveBeenCalledWith("user-1", 20);
    await app.close();
  });

  it("returns empty list when user has no analyses", async () => {
    const repo = {
      listForUser: vi.fn(async () => []),
    } as unknown as AnalysisRepo;
    const app = makeApp(repo);
    const res = await app.inject({
      method: "GET",
      url: "/api/analyses",
      headers: { "x-user-id": "user-2" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().analyses).toEqual([]);
    await app.close();
  });

  it("clamps limit to [1,100] and forwards it to repo", async () => {
    const repo = {
      listForUser: vi.fn(async () => []),
    } as unknown as AnalysisRepo;
    const app = makeApp(repo);
    const res = await app.inject({
      method: "GET",
      url: "/api/analyses?limit=5",
      headers: { "x-user-id": "user-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(repo.listForUser).toHaveBeenCalledWith("user-1", 5);
    const tooBig = await app.inject({
      method: "GET",
      url: "/api/analyses?limit=999",
      headers: { "x-user-id": "user-1" },
    });
    expect(tooBig.statusCode).toBe(400);
    await app.close();
  });

  it("emits stats from summaryJson when present, null otherwise", async () => {
    const repo = {
      listForUser: vi.fn(async () => [
        makeRow({
          summaryJson: {
            stats: { nodeCount: 3, edgeCount: 2, riskCounts: { HIGH: 0, MED: 1, LOW: 2 } },
          },
        }),
        makeRow({
          id: "00000000-0000-0000-0000-000000000002",
          summaryJson: null,
        }),
      ]),
    } as unknown as AnalysisRepo;
    const app = makeApp(repo);
    const res = await app.inject({
      method: "GET",
      url: "/api/analyses",
      headers: { "x-user-id": "user-1" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analyses[0].stats).toEqual({
      nodeCount: 3,
      edgeCount: 2,
      riskCounts: { HIGH: 0, MED: 1, LOW: 2 },
    });
    expect(body.analyses[1].stats).toBeNull();
    await app.close();
  });

  it("treats a missing x-user-id header as anonymous (null userId)", async () => {
    const repo = {
      listForUser: vi.fn(async () => []),
    } as unknown as AnalysisRepo;
    const app = makeApp(repo);
    const res = await app.inject({ method: "GET", url: "/api/analyses" });
    expect(res.statusCode).toBe(200);
    expect(repo.listForUser).toHaveBeenCalledWith(null, 20);
    await app.close();
  });
});
