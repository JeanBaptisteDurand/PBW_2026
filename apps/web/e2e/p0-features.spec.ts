import { test, expect } from "@playwright/test";

// Tests for the HACKATHON_STRATEGY.md TIER 0 features implemented in
// this branch: Corridor Health page, Safe Path Agent, interactive legend
// filter, PDF download, and XLS-80 Permissioned Domain seed.

test.describe("P0.1 — Corridor atlas (cached)", () => {
  test("navbar link exists and atlas page loads with key pair-corridors", async ({ page }) => {
    await page.goto("/");
    await page.click("nav >> text=Corridors");
    await expect(page).toHaveURL(/\/corridors/);
    await expect(page.locator("h1", { hasText: "XRPL Corridor Atlas" })).toBeVisible();

    // Pair-based corridor IDs introduced by the multi-route refactor
    const pairIds = [
      "usd-eur",
      "usd-cny",
      "usd-jpy",
      "usd-rlusd",
      "xrp-usd",
      "xrp-solo",
    ];
    for (const id of pairIds) {
      await expect(page.locator(`[data-testid="corridor-card-${id}"]`)).toBeVisible();
    }
  });
});

test.describe("P0.5 — Safe Path Agent page", () => {
  test("navbar link loads the page with intent form", async ({ page }) => {
    await page.goto("/");
    await page.click("nav >> text=Safe Path");
    await expect(page).toHaveURL(/\/safe-path/);
    await expect(page.locator("h1", { hasText: "Safe Path AI Agent" })).toBeVisible();
    // Pre-filled intent form
    await expect(page.locator("text=Source currency")).toBeVisible();
    await expect(page.locator("text=Destination currency")).toBeVisible();
    await expect(page.locator("button", { hasText: "Run Safe Path Agent" })).toBeVisible();
  });

  test("reasoning panel streams events when agent runs", async ({ page }) => {
    await page.goto("/safe-path");
    await page.click("button:has-text('Run Safe Path Agent')");
    // Stream container visible
    const stream = page.locator('[data-testid="safe-path-stream"]');
    await expect(stream).toBeVisible();
    // Wait for at least one "step" marker (▸) or tool call (↳) to arrive
    await expect(stream).toContainText(/▸|↳/, { timeout: 60_000 });
  });
});

test.describe("P0.7 — Interactive graph legend filter", () => {
  test("legend has collapse and show/hide buttons", async ({ page }) => {
    // Pick any completed analysis to land on GraphView
    const listResp = await page.request.get("/api/analyze");
    const list = await listResp.json();
    const done = (list as Array<{ id: string; status: string }>).find((a) => a.status === "done");
    test.skip(!done, "No completed analysis available");
    await page.goto(`/graph/${done!.id}`);
    // Wait for React Flow to render
    await page.waitForSelector(".react-flow__node", { timeout: 20_000 });

    const legend = page.locator('[data-testid="graph-legend"]');
    await expect(legend).toBeVisible();
    // Collapse button (labeled "Filter")
    await expect(legend.locator("button", { hasText: "Filter" })).toBeVisible();
    // Show All / Hide All buttons
    await expect(legend.locator("button", { hasText: "All" })).toBeVisible();
    await expect(legend.locator("button", { hasText: "None" })).toBeVisible();
    // At least one toggle checkbox
    const checkboxes = legend.locator('input[type="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThan(0);
  });

  test("hiding all nodes empties the canvas, showing all restores", async ({ page }) => {
    const listResp = await page.request.get("/api/analyze");
    const list = await listResp.json();
    const done = (list as Array<{ id: string; status: string }>).find((a) => a.status === "done");
    test.skip(!done, "No completed analysis available");
    await page.goto(`/graph/${done!.id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 20_000 });

    const beforeCount = await page.locator(".react-flow__node").count();
    expect(beforeCount).toBeGreaterThan(0);

    await page.locator('[data-testid="graph-legend"] button', { hasText: "None" }).click();
    // Give React a tick to re-layout
    await page.waitForTimeout(300);
    const afterHide = await page.locator(".react-flow__node").count();
    expect(afterHide).toBe(0);

    await page.locator('[data-testid="graph-legend"] button', { hasText: "All" }).click();
    await page.waitForTimeout(300);
    const afterShow = await page.locator(".react-flow__node").count();
    expect(afterShow).toBe(beforeCount);
  });
});

test.describe("P0.3 — Compliance PDF endpoint", () => {
  test("GET /api/compliance/:id/pdf returns a valid PDF", async ({ request }) => {
    const listResp = await request.get("/api/analyze");
    const list = await listResp.json();
    const done = (list as Array<{ id: string; status: string }>).find((a) => a.status === "done");
    test.skip(!done, "No completed analysis available");

    const pdfResp = await request.get(`/api/compliance/${done!.id}/pdf`);
    expect(pdfResp.ok()).toBeTruthy();
    expect(pdfResp.headers()["content-type"]).toBe("application/pdf");
    const body = await pdfResp.body();
    // PDF magic bytes: %PDF
    expect(body.slice(0, 4).toString("utf-8")).toBe("%PDF");
    // Should be non-trivial
    expect(body.length).toBeGreaterThan(1000);
  });
});

test.describe("P0.2 — XLS-80 Permissioned Domain seed", () => {
  test("POST /api/permissioned-domain/seed creates a reusable analysis", async ({ request }) => {
    const first = await request.post("/api/permissioned-domain/seed");
    expect(first.ok()).toBeTruthy();
    const firstBody = await first.json();
    expect(firstBody.id).toBeTruthy();

    // Idempotent — second call re-uses
    const second = await request.post("/api/permissioned-domain/seed");
    const secondBody = await second.json();
    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.reused).toBe(true);
  });

  test("seeded graph renders with permissionedDomain node and HIGH risk flag", async ({ page, request }) => {
    const seed = await request.post("/api/permissioned-domain/seed");
    const { id } = await seed.json();
    await page.goto(`/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 15_000 });

    // Stats bar shows HIGH risk
    await expect(page.locator("text=/HIGH:/")).toBeVisible();
    // XLS-81 venue label renders
    await expect(page.locator("text=Permissioned DEX (XLS-81)")).toBeVisible();
  });
});
