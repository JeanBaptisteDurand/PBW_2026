import { expect, test } from "@playwright/test";

test.describe("Auth (unauthed state)", () => {
  test("the navbar shows the Connect Wallet button when no JWT is stored", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("button", { name: /Connect Wallet/i })).toBeVisible();
  });

  test("the Account page mounts without a JWT (placeholder card)", async ({ page }) => {
    await page.goto("/account");
    await expect(page.locator("body")).toContainText(/corelens/i);
  });

  test("seeding a fake JWT in localStorage flips the navbar to the wallet pill", async ({
    page,
  }) => {
    // Visit the SPA first so the app has a chance to mount with the storage
    // we're about to inject — the auth hook listens for the `storage` event
    // and on initial render reads localStorage synchronously.
    await page.goto("/home");
    await page.evaluate(() => {
      localStorage.setItem(
        "corlens_auth",
        JSON.stringify({
          token: "test.jwt.token",
          user: {
            id: "00000000-0000-0000-0000-000000000001",
            walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
            role: "free",
          },
        }),
      );
    });
    await page.reload();
    await expect(page.getByRole("button", { name: /rN7n7o/i })).toBeVisible({ timeout: 10_000 });
  });
});
