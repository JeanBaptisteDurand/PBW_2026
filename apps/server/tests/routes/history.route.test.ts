// xrplens/apps/server/tests/routes/history.route.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";

// Must mock BEFORE importing the router
vi.mock("../../src/xrpl/client.js", async () => {
  return {
    createXRPLClient: () => ({
      connect: async () => {},
      disconnect: async () => {},
      request: async () => ({ result: { transactions: [] } }),
    }),
  };
});

vi.mock("../../src/analysis/historyOrchestrator.js", async () => {
  return {
    streamHistory: async function* () {
      yield {
        type: "seed_ready",
        seed: {
          id: "rSeed11111111111111111111111111111",
          kind: "seed",
          address: "rSeed11111111111111111111111111111",
          depth: 0,
          txCount: 0,
          crawlStatus: "skipped",
        },
        lightNodes: [],
        heavyQueue: [],
        edges: [],
        txTypeSummary: [],
      };
      yield {
        type: "done",
        stats: { nodes: 1, edges: 0, crawlsRun: 0, durationMs: 1, truncated: false },
      };
    },
  };
});

import { historyRouter } from "../../src/routes/history.js";

let server: Server;
let port = 0;

beforeAll(async () => {
  const app = express();
  app.use("/api/history", historyRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as any).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("GET /api/history/stream", () => {
  it("rejects invalid address with 400", async () => {
    const r = await fetch(
      `http://localhost:${port}/api/history/stream?address=notvalid&depth=1`,
    );
    expect(r.status).toBe(400);
  });

  it("streams SSE events and ends with done", async () => {
    const r = await fetch(
      `http://localhost:${port}/api/history/stream?address=rSeed11111111111111111111111111111&depth=1`,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const text = await r.text();
    expect(text).toContain('"type":"seed_ready"');
    expect(text).toContain('"type":"done"');
  });
});
