import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { registerComplianceAnalysisRoutes } from "../../src/controllers/compliance-analysis.controller.js";
import type { ComplianceAnalysisService } from "../../src/services/compliance-analysis.service.js";
import type { PdfRendererService } from "../../src/services/pdf-renderer.service.js";

/** A preHandler that always allows the request through (premium user). */
const allowPreHandler: preHandlerAsyncHookHandler = async (
  _req: FastifyRequest,
  _reply: FastifyReply,
) => {
  return;
};

/** A preHandler that always returns 402 (non-premium user). */
const denyPreHandler: preHandlerAsyncHookHandler = async (
  _req: FastifyRequest,
  reply: FastifyReply,
) => {
  reply.code(402).send({ error: "premium_required" });
  return reply;
};

/** A preHandler that returns 401 when x-user-id header is missing. */
const missingUserPreHandler: preHandlerAsyncHookHandler = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = req.headers["x-user-id"];
  if (typeof userId !== "string" || userId.length === 0) {
    reply.code(401).send({ error: "missing_user" });
    return reply;
  }
};

async function makeApp(
  svc: ComplianceAnalysisService,
  requirePremium: preHandlerAsyncHookHandler,
  pdfRenderer?: PdfRendererService,
) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerComplianceAnalysisRoutes(app, svc, requirePremium, pdfRenderer);
  return app;
}

const ANALYSIS_ID = "00000000-0000-0000-0000-000000000001";

const baseSvcResult = {
  analysisId: ANALYSIS_ID,
  markdown: "# x",
  auditHash: "0".repeat(64),
  data: {
    summary: {
      id: ANALYSIS_ID,
      seedAddress: "rSeedrSeedrSeedrSeedrSeedrSeedrSe",
      seedLabel: "Test",
      depth: 1,
      status: "done",
      error: null,
      stats: { nodeCount: 1, edgeCount: 0, riskCounts: { HIGH: 0, MED: 0, LOW: 0 } },
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    },
    flags: [],
  },
};

describe("compliance-analysis.controller", () => {
  it("POST returns 200 + markdown + auditHash", async () => {
    const svc = {
      build: vi.fn(async () => baseSvcResult),
    };
    const app = await makeApp(svc, allowPreHandler);
    const res = await app.inject({
      method: "POST",
      url: `/api/compliance/analysis/${ANALYSIS_ID}`,
      headers: { "x-user-id": "u1" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().markdown).toBe("# x");
    await app.close();
  });

  it("GET /api/compliance/analysis/:id returns 200", async () => {
    const svc = {
      build: vi.fn(async () => ({
        analysisId: ANALYSIS_ID,
        markdown: "# entity",
        auditHash: "a".repeat(64),
        data: {
          summary: {
            id: ANALYSIS_ID,
            seedAddress: "rSeedrSeedrSeedrSeedrSeedrSeedrSe",
            seedLabel: null,
            depth: 1,
            status: "done",
            error: null,
            stats: null,
            createdAt: "2026-05-11T00:00:00.000Z",
            updatedAt: "2026-05-11T00:01:00.000Z",
          },
          flags: [],
        },
      })),
    };
    const app = await makeApp(svc, allowPreHandler);
    const res = await app.inject({
      method: "GET",
      url: `/api/compliance/analysis/${ANALYSIS_ID}`,
      headers: { "x-user-id": "u1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().auditHash).toBe("a".repeat(64));
    await app.close();
  });

  it("GET PDF returns 402 when user is not premium", async () => {
    const svc = { build: vi.fn() };
    const app = await makeApp(svc, denyPreHandler);
    const res = await app.inject({
      method: "GET",
      url: `/api/compliance/analysis/${ANALYSIS_ID}/pdf`,
      headers: { "x-user-id": "u1" },
    });
    expect(res.statusCode).toBe(402);
    await app.close();
  });

  it("GET PDF returns 401 when x-user-id header is missing", async () => {
    const svc = { build: vi.fn() };
    const app = await makeApp(svc, missingUserPreHandler);
    const res = await app.inject({
      method: "GET",
      url: `/api/compliance/analysis/${ANALYSIS_ID}/pdf`,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET PDF returns 200 with application/pdf and correct content-disposition for premium user", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4 test");
    const svc = {
      build: vi.fn(async () => baseSvcResult),
    };
    const fakePdf: PdfRendererService = {
      computeAuditHash: vi.fn(() => "0".repeat(64)),
      render: vi.fn(async () => pdfBytes),
      renderEntity: vi.fn(async () => pdfBytes),
    };

    const app = await makeApp(svc, allowPreHandler, fakePdf);
    const res = await app.inject({
      method: "GET",
      url: `/api/compliance/analysis/${ANALYSIS_ID}/pdf`,
      headers: { "x-user-id": "u1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`compliance-analysis-${ANALYSIS_ID}.pdf`);
    expect(res.rawPayload.length).toBeGreaterThan(0);
    await app.close();
  });

  it("404 when analysis missing", async () => {
    const svc = {
      build: vi.fn(async () => {
        throw new Error("not_found");
      }),
    };
    const app = await makeApp(svc, allowPreHandler);
    const res = await app.inject({
      method: "GET",
      url: "/api/compliance/analysis/00000000-0000-0000-0000-000000000099",
      headers: { "x-user-id": "u1" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
