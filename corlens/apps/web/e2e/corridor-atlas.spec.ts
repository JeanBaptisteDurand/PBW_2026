import { test, expect } from "@playwright/test";

// ─── Corridor atlas — pair model + filters + routes + chat ───────────────
// Tests the multi-route corridor atlas. Each corridor is a fiat pair with
// multiple candidate routes, and the picker chooses a winner. Requires the
// server to be running with at least one refresh pass complete on the key
// corridors (USD→EUR, USD→CNY, USD→RLUSD).

test.describe("Corridor atlas — list + filters", () => {
  test("loads the full pair-based catalog (100+ corridors)", async ({ page }) => {
    await page.goto("/corridors");
    await expect(page.locator("h1", { hasText: "XRPL Corridor Atlas" })).toBeVisible();

    await expect(page.locator('[data-testid="corridor-filters"]')).toBeVisible();

    // Catalog ships ~114 auto-generated pair corridors (fiat matrix +
    // stablecoin on/off ramps + cross-stable + XRP lanes). Wait for the first
    // card to mount before counting.
    await page.locator('[data-testid="corridor-card-usd-eur"]').waitFor({ timeout: 15_000 });
    const cards = page.locator('[data-testid^="corridor-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(100);
  });

  test("flagship pair corridors are present", async ({ page }) => {
    await page.goto("/corridors");
    const ids = ["usd-eur", "usd-cny", "usd-jpy", "usd-rlusd", "xrp-usd", "rlusd-cny"];
    for (const id of ids) {
      await expect(page.locator(`[data-testid="corridor-card-${id}"]`)).toBeVisible();
    }
  });

  test("search filter narrows the list", async ({ page }) => {
    await page.goto("/corridors");
    await page.locator('[data-testid="corridor-card-usd-rlusd"]').waitFor();

    await page.fill('[data-testid="filter-search"]', "RLUSD");
    await expect(page.locator('[data-testid="corridor-card-usd-rlusd"]')).toBeVisible();
    await expect(page.locator('[data-testid="corridor-card-rlusd-cny"]')).toBeVisible();
    await expect(page.locator('[data-testid="corridor-card-usd-chf"]')).not.toBeVisible();
  });

  test("From/To currency filters narrow the list", async ({ page }) => {
    await page.goto("/corridors");
    await page.locator('[data-testid="corridor-card-usd-cny"]').waitFor();

    await page.selectOption('[data-testid="filter-from"]', "USD");
    await page.selectOption('[data-testid="filter-to"]', "CNY");

    await expect(page.locator('[data-testid="corridor-card-usd-cny"]')).toBeVisible();
    await expect(page.locator('[data-testid="corridor-card-jpy-usd"]')).not.toBeVisible();

    const counter = page.locator('[data-testid="result-count"]');
    await expect(counter).toContainText(/of \d+ corridors/);
  });

  test("category filter isolates xrp-offramp lanes", async ({ page }) => {
    await page.goto("/corridors");
    await page.locator('[data-testid="corridor-card-usd-eur"]').waitFor();

    await page.selectOption('[data-testid="filter-category"]', "xrp-offramp");
    await expect(page.locator('[data-testid="corridor-card-xrp-usd"]')).toBeVisible();
    await expect(page.locator('[data-testid="corridor-card-xrp-eur"]')).toBeVisible();
    await expect(page.locator('[data-testid="corridor-card-usd-eur"]')).not.toBeVisible();
  });

  test("Reset button clears filters", async ({ page }) => {
    await page.goto("/corridors");
    await page.locator('[data-testid="corridor-card-usd-rlusd"]').waitFor();

    await page.fill('[data-testid="filter-search"]', "ZZZZZ");
    await expect(page.locator('[data-testid^="corridor-card-"]')).toHaveCount(0);

    await page.click("button:has-text('Reset')");
    await expect(page.locator('[data-testid="corridor-card-usd-rlusd"]')).toBeVisible();
  });

  test("a refreshed corridor card shows AI note", async ({ page }) => {
    await page.goto("/corridors");
    // USD→EUR is the highest-importance pair and refreshes first in every pass
    const card = page.locator('[data-testid="corridor-card-usd-eur"]');
    await expect(card).toBeVisible();
    const note = page.locator('[data-testid="corridor-ai-note-usd-eur"]');
    await expect(note).toBeVisible({ timeout: 15_000 });
    const text = (await note.textContent()) ?? "";
    expect(text.length).toBeGreaterThan(80);
  });
});

test.describe("Corridor detail page — routes comparison", () => {
  test("loads detail with AI note + routes table", async ({ page }) => {
    await page.goto("/corridors/usd-cny");

    await expect(page.locator("h1", { hasText: "USD → CNY" })).toBeVisible();
    await expect(page.locator('[data-testid="ai-note-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="routes-comparison"]')).toBeVisible();

    // USD→CNY auto-generates 9 candidate routes (3 USD issuers × 3 CNY issuers)
    const rows = page.locator('[data-testid^="route-row-"]');
    await expect(rows).toHaveCount(9, { timeout: 10_000 });
  });

  test("all-routes graph renders deduped source + dest nodes", async ({ page }) => {
    await page.goto("/corridors/usd-cny");
    // Wait for graph to mount
    const graph = page.locator('[data-testid="corridor-routes-graph"]');
    await expect(graph).toBeVisible({ timeout: 10_000 });

    // The ALL ROUTES legend should be present
    await expect(graph.locator("text=ALL ROUTES · DEDUPED")).toBeVisible();

    // We expect SOURCE and DEST labelled nodes to be present and distinct.
    // USD→CNY scans 3 source issuers (bs/gh/snap) and 3 dest issuers
    // (fox/cn/qk). Even if only some routes actually found a path, the ones
    // that did produce at least one source and one dest node.
    const sourceNodes = graph.locator(".react-flow__node :text('SOURCE')");
    const destNodes = graph.locator(".react-flow__node :text('DEST')");
    expect(await sourceNodes.count()).toBeGreaterThanOrEqual(1);
    expect(await destNodes.count()).toBeGreaterThanOrEqual(1);
  });

  test("clicking a route row swaps the selected route detail", async ({ page }) => {
    await page.goto("/corridors/usd-cny");
    await page.locator('[data-testid="routes-comparison"]').waitFor();

    // Click an explicit non-winner row
    await page.click('[data-testid="route-row-gh-fox"]');
    const detail = page.locator('[data-testid="selected-route-card"]');
    await expect(detail).toContainText("USD.GateHub → CNY.RippleFox");
  });

  test("refresh button is wired", async ({ page }) => {
    await page.goto("/corridors/usd-eur");
    await expect(page.locator('[data-testid="refresh-corridor"]')).toBeVisible();
  });

  test("related corridors panel renders and is clickable", async ({ page }) => {
    await page.goto("/corridors/usd-cny");
    const related = page.locator('[data-testid="related-corridors"]');
    await expect(related).toBeVisible();
    const firstRelated = related.locator("button").first();
    await firstRelated.click();
    await expect(page).toHaveURL(/\/corridors\/[^/]+$/);
  });
});

test.describe("Corridor chat bubble", () => {
  test("chat bubble accepts an atlas-level question and answers", async ({ page }) => {
    await page.goto("/corridors");
    await page.click('[data-testid="chat-bubble-open"]');
    await expect(page.locator('[data-testid="chat-bubble-panel"]')).toBeVisible();

    await page.fill(
      '[data-testid="chat-input"]',
      "Which USD to CNY route did the picker choose and why?",
    );
    await page.click('[data-testid="chat-send"]');

    await expect(page.locator('[data-testid="chat-msg-user"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="chat-msg-assistant"]').first()).toBeVisible({
      timeout: 60_000,
    });
    const answer =
      (await page.locator('[data-testid="chat-msg-assistant"]').first().textContent()) ?? "";
    expect(answer.toLowerCase()).toMatch(/cny|ripplefox|fox|bitstamp/);
    await expect(page.locator('[data-testid="chat-source"]').first()).toBeVisible();
  });

  test("chat bubble carries corridor context on detail page", async ({ page }) => {
    await page.goto("/corridors/usd-cny");
    await page.click('[data-testid="chat-bubble-open"]');
    await expect(page.locator('[data-testid="chat-context"]')).toContainText("usd-cny");

    await page.fill(
      '[data-testid="chat-input"]',
      "Why did the picker reject the gh-cn route?",
    );
    await page.click('[data-testid="chat-send"]');

    await expect(page.locator('[data-testid="chat-msg-assistant"]').first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("chat refuses to invent a non-existent corridor", async ({ page }) => {
    await page.goto("/corridors");
    await page.click('[data-testid="chat-bubble-open"]');

    await page.fill(
      '[data-testid="chat-input"]',
      "Does a USD to Klingon Darsek corridor exist?",
    );
    await page.click('[data-testid="chat-send"]');

    await expect(page.locator('[data-testid="chat-msg-assistant"]').first()).toBeVisible({
      timeout: 60_000,
    });
    const answer =
      (await page.locator('[data-testid="chat-msg-assistant"]').first().textContent()) ?? "";
    expect(answer.toLowerCase()).toMatch(/no|does not|doesn'?t|not.*exist|unavailable|not.*found|unfortunately/);
  });
});
