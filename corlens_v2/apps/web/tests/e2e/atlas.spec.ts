import { expect, test } from "@playwright/test";

test.describe("Corridor Atlas", () => {
  test("/corridors renders the atlas with corridor cards from the live catalog", async ({
    page,
  }) => {
    await page.goto("/corridors");
    await page.waitForLoadState("networkidle");
    // The atlas table populates from GET /api/corridors. Wait for at least one
    // currency triple ("USD" + "EUR" or "USD" + "JPY") to appear, which only
    // happens after the API call resolves.
    await expect(page.locator("body")).toContainText(/USD/i, { timeout: 15_000 });
  });

  test("clicking the USD → EUR card navigates to /corridors/usd-eur", async ({ page }) => {
    await page.goto("/corridors");
    await page.waitForLoadState("networkidle");
    // CorridorCard renders as a clickable div (not an anchor) — match it by
    // the human label.
    const card = page.getByText(/USD → EUR/, { exact: false }).first();
    await card.waitFor({ state: "visible", timeout: 15_000 });
    await card.click();
    await expect(page).toHaveURL(/\/corridors\/usd-eur/);
  });

  test("/corridors/usd-eur loads the USD → EUR detail page", async ({ page }) => {
    await page.goto("/corridors/usd-eur");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/USD/i);
    await expect(page.locator("body")).toContainText(/EUR/i);
  });
});
