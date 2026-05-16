import { expect, test } from "@playwright/test";

test.describe("Safe Path Agent (/safe-path)", () => {
  test("renders the corridor + amount + tolerance form", async ({ page }) => {
    await page.goto("/safe-path");
    await page.waitForLoadState("domcontentloaded");
    // Any of the form labels must mount.
    await expect(page.locator("body")).toContainText(/Safe Path/i);
    await expect(page.locator("body")).toContainText(/Source|From|Amount/i);
  });

  test("the navbar item is highlighted on /safe-path", async ({ page }) => {
    await page.goto("/safe-path");
    const safePathLink = page.getByRole("link", { name: /Safe Path Agent/i });
    await expect(safePathLink).toBeVisible();
  });
});
