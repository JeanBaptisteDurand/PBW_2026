import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import { registerCurrencyMetaRoutes } from "../../src/controllers/currency-meta.controller.js";
import type { CurrencyMetaService } from "../../src/services/currency-meta.service.js";

function makeApp(svc: CurrencyMetaService) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerCurrencyMetaRoutes(app, svc);
  return app;
}

describe("currency-meta.controller", () => {
  it("GET /api/corridors/currency-meta returns list + globalHubs with cache header", async () => {
    const svc = {
      async list() {
        return {
          currencies: [
            {
              code: "USD",
              issuers: [],
              actors: [],
              updatedAt: "2026-05-11T00:00:00.000Z",
            },
          ],
          globalHubs: [{ key: "tranglo", name: "Tranglo", type: "hub" }],
        };
      },
      async getByCode() {
        return null;
      },
    };
    const app = makeApp(svc);
    const res = await app.inject({ method: "GET", url: "/api/corridors/currency-meta" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=300");
    const body = res.json();
    expect(body.currencies).toHaveLength(1);
    expect(body.globalHubs[0].key).toBe("tranglo");
    await app.close();
  });

  it("GET /api/corridors/currency-meta/:code returns 200 or 404", async () => {
    const svc = {
      async list() {
        return { currencies: [], globalHubs: [] };
      },
      async getByCode(code: string) {
        return code === "USD"
          ? { code: "USD", issuers: [], actors: [], updatedAt: "2026-05-11T00:00:00.000Z" }
          : null;
      },
    };
    const app = makeApp(svc);
    const ok = await app.inject({ method: "GET", url: "/api/corridors/currency-meta/USD" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().code).toBe("USD");
    const miss = await app.inject({ method: "GET", url: "/api/corridors/currency-meta/ZZZ" });
    expect(miss.statusCode).toBe(404);
    await app.close();
  });
});
