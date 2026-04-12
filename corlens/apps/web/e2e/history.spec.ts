import { test, expect } from "@playwright/test";

// ─── History page — streaming + graph + node selection ────────────────────
// The SSE endpoint is stubbed with a fixture stream so this test does not
// require a live server or a real XRPL node. EventSource reads the entire
// body chunk and processes each `data:` frame sequentially.

const SEED = "rNrkPvyVXYEewjC8rFVj9WDevKpXQL3ce8";
const ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

function sseBody(events: unknown[]): string {
  let out = ":" + " ".repeat(2048) + "\n\n";
  for (const ev of events) {
    out += `data: ${JSON.stringify(ev)}\n\n`;
  }
  return out;
}

test.describe("/history page", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/history/stream**", async (route) => {
      const body = sseBody([
        {
          type: "seed_ready",
          seed: {
            id: SEED,
            kind: "seed",
            address: SEED,
            depth: 0,
            txCount: 200,
            crawlStatus: "skipped",
          },
          lightNodes: [],
          heavyQueue: [
            {
              id: ISSUER,
              kind: "issuer",
              address: ISSUER,
              depth: 1,
              txCount: 5,
              crawlStatus: "pending",
            },
          ],
          edges: [
            {
              id: `${SEED}->${ISSUER}:TrustSet`,
              from: SEED,
              to: ISSUER,
              txType: "TrustSet",
              count: 1,
            },
          ],
          txTypeSummary: [{ type: "TrustSet", count: 1 }],
        },
        {
          type: "node_added",
          node: {
            id: ISSUER,
            kind: "issuer",
            address: ISSUER,
            depth: 1,
            txCount: 5,
            crawlStatus: "crawled",
            riskFlags: ["CLAWBACK_ENABLED"],
          },
          edges: [],
        },
        {
          type: "done",
          stats: {
            nodes: 2,
            edges: 1,
            crawlsRun: 1,
            durationMs: 1234,
            truncated: false,
          },
        },
      ]);
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body,
      });
    });
  });

  test("loads example wallet and streams graph to completion", async ({ page }) => {
    await page.goto("/history");

    // Initial state — graph container exists but nothing to render.
    await expect(page.locator('[data-testid="history-graph"]')).toBeVisible();

    // Click the demo loader
    await page.getByRole("button", { name: /Load example wallet/i }).click();

    // The SSE stream is consumed and the reducer settles on status="done".
    // Wait for the stats banner that only renders after `done`. The hook also
    // flips the Run button label back from "Crawling…" to "Run".
    await expect(page.getByRole("button", { name: /^Run$/ })).toBeVisible({
      timeout: 5000,
    });

    // Seed address surfaces in the left panel
    await expect(page.getByText(SEED).first()).toBeVisible();
  });

  test("Run button is disabled when address is empty", async ({ page }) => {
    await page.goto("/history");
    const runBtn = page.getByRole("button", { name: /^Run$/ });
    await expect(runBtn).toBeDisabled();
  });
});
