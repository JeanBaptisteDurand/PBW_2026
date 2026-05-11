// Convention confirmed by reading identity/src/controllers/internal.controller.ts and
// ai-service/src/controllers/events.controller.ts:
//   - HMAC guard is applied via `preHandler: createHmacVerifyHook(...)` on each route.
//   - No `config: { internal: true }` or plugin wrapping.
//   - `hmacSigner` from `@corlens/clients` is used to sign test requests.

import { hmacSigner } from "@corlens/clients";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { registerRiskEngineRoutes } from "../../src/controllers/risk-engine.controller.js";

const SECRET = "x".repeat(32);

function makeApp(svc: any) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerRiskEngineRoutes(app, svc, SECRET);
  return app;
}

// A valid XRPL address (25-35 chars after the leading 'r')
const VALID_ADDRESS = "rTestrTestrTestrTestrTestrTestrTest";

describe("risk-engine.controller", () => {
  it("401s without HMAC", async () => {
    const app = makeApp({ evaluate: vi.fn() });
    const res = await app.inject({
      method: "POST",
      url: "/api/risk-engine/quick-eval",
      payload: { address: VALID_ADDRESS },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("200 with valid HMAC + body", async () => {
    const svc = {
      evaluate: vi.fn(async (a: string) => ({
        address: a,
        score: 0,
        flags: [],
        summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
      })),
    };
    const app = makeApp(svc);
    const sign = hmacSigner({ secret: SECRET });
    const body = { address: VALID_ADDRESS };
    const bodyStr = JSON.stringify(body);
    const headers = sign(bodyStr);
    const res = await app.inject({
      method: "POST",
      url: "/api/risk-engine/quick-eval",
      headers: { ...headers, "content-type": "application/json" },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(svc.evaluate).toHaveBeenCalledWith(VALID_ADDRESS);
    await app.close();
  });
});
