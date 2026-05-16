import { expect, test } from "@playwright/test";

test.describe("Top navbar — links work across pages", () => {
  test("clicking Corridor Atlas in the navbar lands on /corridors", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: /Corridor Atlas/i }).click();
    await expect(page).toHaveURL(/\/corridors$/);
  });

  test("clicking Entity Audit in the navbar lands on /analyze", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: /Entity Audit/i }).click();
    await expect(page).toHaveURL(/\/analyze$/);
  });

  test("clicking Docs in the navbar lands on /developers", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: /Docs/i }).first().click();
    await expect(page).toHaveURL(/\/developers$/);
  });

  test("clicking the brand logo lands on /home", async ({ page }) => {
    await page.goto("/corridors");
    await page.getByLabel(/Go to corelens home/i).click();
    await expect(page).toHaveURL(/\/home$/);
  });
});
