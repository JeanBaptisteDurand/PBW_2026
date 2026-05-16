import { expect, test } from "@playwright/test";

// Smoke: every navigable v1-port route mounts the Layout shell and the
// navbar's "corelens" brand is visible. Anonymous flows only — auth-gated
// features get their own anonymous-state assertions in the per-feature
// specs below.

const ROUTES: Array<{ path: string; expect: RegExp }> = [
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
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toContainText(route.expect, { timeout: 10_000 });
  });
}
