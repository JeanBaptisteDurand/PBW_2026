import { test, expect } from "@playwright/test";

// Smoke test: verify all main pages load without errors in local dev mode.

test.describe("Smoke — pages load", () => {
  test("Landing / Home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    // No crash — page rendered something
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("Home page loads", async ({ page }) => {
    await page.goto("/home");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("Analyze page loads with input", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.locator('input[placeholder*="rMxCKbEDwqr76"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Analysis" })).toBeVisible();
  });

  test("Corridors page loads", async ({ page }) => {
    await page.goto("/corridors");
    await expect(page.locator("h1")).toBeVisible();
    // Should show at least some corridor cards
    const cards = page.locator('[data-testid^="corridor-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  });

  test("Safe Path page loads (premium gate or form)", async ({ page }) => {
    await page.goto("/safe-path");
    // Page renders — either the premium gate or the agent form
    await expect(page.locator("body")).not.toBeEmpty();
    const premiumGate = page.locator("text=Premium Feature");
    const agentForm = page.locator("button", { hasText: "Run Safe Path Agent" });
    // One of these must be visible
    await expect(premiumGate.or(agentForm).first()).toBeVisible({ timeout: 10_000 });
  });

  test("API Docs page loads", async ({ page }) => {
    await page.goto("/api-docs");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("History page loads", async ({ page }) => {
    await page.goto("/history");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("Premium page loads", async ({ page }) => {
    await page.goto("/premium");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Smoke — API health", () => {
  test("GET /api/corridors returns data", async ({ request }) => {
    const resp = await request.get("http://localhost:3001/api/corridors");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    // API returns { corridors: [...] }
    expect(Array.isArray(body.corridors)).toBeTruthy();
    expect(body.corridors.length).toBeGreaterThan(0);
  });

  test("GET /api/analyze returns array", async ({ request }) => {
    const resp = await request.get("http://localhost:3001/api/analyze");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});
