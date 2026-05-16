import { expect, test } from "@playwright/test";

// Backend contract tests through the v2 Caddy gateway. These verify the
// SPA's calls land on the right services and return the expected shape —
// no SPA UI in the loop.

test("GET /api/corridors returns the seeded catalog", async ({ request }) => {
  const res = await request.get("/api/corridors?limit=5");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBe(5);
  for (const c of body) {
    expect(c).toHaveProperty("id");
    expect(c).toHaveProperty("label");
    expect(c).toHaveProperty("status");
  }
});

test("GET /api/corridors/usd-eur returns a detail payload with source + dest", async ({
  request,
}) => {
  const res = await request.get("/api/corridors/usd-eur");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe("usd-eur");
  expect(body.source).toMatchObject({ currency: "USD" });
  expect(body.dest).toMatchObject({ currency: "EUR" });
});

test("GET /api/corridors/currency-meta/USD returns RLUSD + GateHub + Bitstamp issuers", async ({
  request,
}) => {
  const res = await request.get("/api/corridors/currency-meta/USD");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.code).toBe("USD");
  expect(Array.isArray(body.issuers)).toBe(true);
  const keys = body.issuers.map((i: { key: string }) => i.key);
  expect(keys).toContain("rlusd");
  expect(keys).toContain("gh");
  expect(keys).toContain("bs");
});

test("GET /api/corridors/currency-meta returns the full catalog + globalHubs", async ({
  request,
}) => {
  const res = await request.get("/api/corridors/currency-meta");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.currencies)).toBe(true);
  expect(body.currencies.length).toBeGreaterThan(50);
  expect(Array.isArray(body.globalHubs)).toBe(true);
});

test("GET /api/corridors/usd-mxn/status-history?days=30 is reachable", async ({ request }) => {
  const res = await request.get("/api/corridors/usd-mxn/status-history?days=30");
  expect([200, 404]).toContain(res.status());
});

test("POST /api/auth/login/challenge issues a signed-in challenge", async ({ request }) => {
  const res = await request.post("/api/auth/login/challenge", {
    data: { walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH" },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.challenge).toContain("Sign in to CORLens");
  expect(body.challenge).toContain("rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH");
  expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
});

test("GET /api/payment/info returns the XRP + RLUSD pricing options", async ({ request }) => {
  const res = await request.get("/api/payment/info");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.options)).toBe(true);
  expect(body.options.length).toBeGreaterThanOrEqual(2);
  const currencies = body.options.map((o: { currency: string }) => o.currency);
  expect(currencies).toEqual(expect.arrayContaining(["XRP", "RLUSD"]));
  // demoWalletAddress is populated from XRPL_DEMO_WALLET_SECRET — empty in
  // local dev when the secret isn't set, a valid r-address otherwise.
  expect(body.demoWalletAddress).toMatch(/^(r[a-zA-Z0-9]{24,}|)$/);
});

test("GET /api/auth/profile without a JWT returns 401 (forward_auth gates the route)", async ({
  request,
}) => {
  const res = await request.get("/api/auth/profile");
  expect(res.status()).toBe(401);
});

test("GET /health on the gateway returns the dev status payload", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.gateway).toBe("caddy");
});

test("GET /api/compliance/verify?hash=unknown returns a not-found-shape (no 5xx)", async ({
  request,
}) => {
  const res = await request.get("/api/compliance/verify?hash=0000000000000000");
  expect([400, 404, 422]).toContain(res.status());
});
