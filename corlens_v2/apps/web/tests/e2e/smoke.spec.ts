import { expect, test } from "@playwright/test";

// Smoke test: every navigable v1-port route mounts at the v2 gateway, renders
// the Layout shell, and the Navbar's "corelens" brand is visible. We don't
// assert on data-loaded content here — that's covered by Vitest unit tests
// and per-route specs in Phase G.

const ROUTES: Array<{ path: string; expect: RegExp | string }> = [
  { path: "/", expect: /corlens|landing/i },
  { path: "/landing", expect: /corlens|landing/i },
  { path: "/home", expect: /Corridor Intelligence|corelens/i },
  { path: "/corridors", expect: /corelens/i },
  { path: "/analyze", expect: /Entity Audit|corelens/i },
  { path: "/safe-path", expect: /Safe Path|corelens/i },
  { path: "/history", expect: /corelens/i },
  { path: "/developers", expect: /corelens/i },
  { path: "/premium", expect: /corelens/i },
  { path: "/account", expect: /corelens/i },
];

for (const route of ROUTES) {
  test(`route ${route.path} mounts and renders the Layout`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.status(), `GET ${route.path}`).toBeLessThan(400);
    // The Vite bundle takes a tick to hydrate; wait for any text node to render.
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toContainText(route.expect, { timeout: 10_000 });
  });
}

test("the v2 backend is reachable through Caddy for the corridor list endpoint", async ({
  request,
}) => {
  const res = await request.get("/api/corridors?limit=5");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeGreaterThan(0);
  expect(body[0]).toHaveProperty("id");
  expect(body[0]).toHaveProperty("status");
});

test("the v2 corridor currency-meta endpoint serves the v1 catalog data", async ({ request }) => {
  const res = await request.get("/api/corridors/currency-meta/USD");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.code).toBe("USD");
  expect(Array.isArray(body.issuers)).toBe(true);
  expect(body.issuers.length).toBeGreaterThan(0);
});
