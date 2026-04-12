import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

test.describe("Payment Gate Flow", () => {
  test.beforeEach(async () => {
    // Reset DB: clear all payment-related data
    execSync(
      `docker exec corlens-postgres-1 psql -U corlens -d corlens -c "DELETE FROM \\"PremiumSubscription\\"; DELETE FROM \\"PaymentRequest\\"; DELETE FROM \\"User\\";"`,
    );
  });

  test("demo wallet payment unlocks premium features", async ({ page }) => {
    // Clear localStorage once at the start (not on every reload)
    await page.goto("/safe-path");
    await page.evaluate(() => localStorage.removeItem("corlens_auth"));
    await page.reload();

    // 1. Safe Path should show lock overlay
    await expect(page.getByText("Premium Feature")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Unlock Premium" })).toBeVisible();

    // 2. Click unlock → navigate to /premium
    await page.getByRole("button", { name: "Unlock Premium" }).click();
    await expect(page).toHaveURL(/\/premium/);

    // 3. Should show payment options
    await expect(page.getByRole("heading", { name: "10 XRP" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "5 RLUSD" })).toBeVisible();

    // 4. Click "Pay with Demo Wallet" (XRP is default)
    await page.getByRole("button", { name: /Pay.*Demo Wallet/ }).click();

    // 5. Wait for confirmation (testnet tx takes 3-15s)
    await expect(page.getByText("Payment confirmed on XRPL Testnet")).toBeVisible({ timeout: 45000 });

    // 6. Verify tx hash link to testnet explorer is shown
    await expect(page.getByText(/View on Explorer/)).toBeVisible();

    // 7. Navigate to Safe Path — should now be accessible (no lock overlay)
    await page.goto("/safe-path");
    await expect(page.getByText("Premium Feature")).not.toBeVisible({ timeout: 10000 });

    // 8. Refresh and check persistence (JWT in localStorage)
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.getByText("Premium Feature")).not.toBeVisible({ timeout: 10000 });
  });
});
