import { expect, test } from "@playwright/test";

test.describe("Entity Audit (/analyze)", () => {
  test("renders the address form + the preset chips", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.getByPlaceholder(/rMxCKbEDwqr/i)).toBeVisible();
    await expect(page.getByPlaceholder(/RLUSD Issuer, Binance/i)).toBeVisible();
    await expect(page.getByText("RLUSD Issuer").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Start Analysis/i })).toBeVisible();
  });

  test("clicking a preset fills the address input", async ({ page }) => {
    await page.goto("/analyze");
    await page.getByText("RLUSD Issuer").first().click();
    const addr = page.getByPlaceholder(/rMxCKbEDwqr/i);
    await expect(addr).toHaveValue(/^r[a-zA-Z0-9]{24,}$/);
  });

  test("the depth selector exposes Quick / Deep / Very Deep options", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.getByText("Quick", { exact: true })).toBeVisible();
    await expect(page.getByText("Deep", { exact: true })).toBeVisible();
    await expect(page.getByText("Very Deep", { exact: true })).toBeVisible();
  });
});
