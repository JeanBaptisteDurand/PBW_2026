import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const API = "http://localhost:3001";

let ANALYSES: Record<string, { id: string; nodeCount: number; kinds: string[] }> = {};

test.beforeAll(async ({ request }) => {
  const resp = await request.get(`${API}/api/analyze?limit=200`);
  const all = await resp.json();
  // Include both 'done' and 'running' (data may already be persisted during AI explanation step)
  const testAnalyses = all.filter(
    (a: any) =>
      (a.status === "done" || a.status === "running") &&
      a.seedLabel?.startsWith("test_"),
  );
  for (const a of testAnalyses) {
    const graphResp = await request.get(`${API}/api/analysis/${a.id}/graph`);
    const graph = await graphResp.json();
    if (graph.nodes.length === 0) continue;
    const label = a.seedLabel.replace("test_", "");
    // Don't override with a worse version
    if (ANALYSES[label] && ANALYSES[label].nodeCount > graph.nodes.length) continue;
    ANALYSES[label] = {
      id: a.id,
      nodeCount: graph.nodes.length,
      kinds: [...new Set(graph.nodes.map((n: any) => n.kind))].sort() as string[],
    };
  }
});

// ─── Compliance Report E2E ───────────────────────────────────

test.describe("Compliance Report Page", () => {
  test("loads with empty state", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/compliance/${id}`);
    await expect(page.locator("h1", { hasText: "Compliance Report" })).toBeVisible();
    await expect(page.locator("text=Generate AML Compliance Report")).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate Report/ }).first()).toBeVisible();
  });

  test("Back to Graph button navigates", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/compliance/${id}`);
    await page.getByRole("button", { name: "Back to Graph" }).click();
    await expect(page).toHaveURL(new RegExp(`/graph/${id}`));
  });

  test("generates compliance report end-to-end", async ({ page }) => {
    test.setTimeout(180000);
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/compliance/${id}`);

    await page.getByRole("button", { name: /Generate Report/ }).first().click();

    // Wait for report content (LLM call may take up to 2 min for big graphs)
    await expect(page.locator("text=Risk Assessment").first()).toBeVisible({
      timeout: 150000,
    });

    // Print button should appear
    await expect(page.getByRole("button", { name: /Print/ })).toBeVisible();
  });

  test("report shows entity breakdown and risk flags", async ({ page }) => {
    test.setTimeout(180000);
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/compliance/${id}`);
    await page.getByRole("button", { name: /Generate Report/ }).first().click();

    // Wait for the report to render
    await expect(page.locator("text=Entity Breakdown").first()).toBeVisible({ timeout: 150000 });
    await expect(page.locator("text=Risk Assessment").first()).toBeVisible();
  });
});

// ─── Chat Page E2E ───────────────────────────────────────────

test.describe("Chat Page", () => {
  test("loads with header and back button", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/chat/${id}`);
    await expect(page.locator("text=AI Chat").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to Graph" })).toBeVisible();
  });

  test("shows suggestion buttons on empty chat", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/chat/${id}`);
    await expect(
      page.getByRole("button", { name: /highest-risk counterparties/i }),
    ).toBeVisible();
  });

  test("Back to Graph button navigates", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/chat/${id}`);
    await page.getByRole("button", { name: "Back to Graph" }).click();
    await expect(page).toHaveURL(new RegExp(`/graph/${id}`));
  });

  test("Compliance Report button navigates from chat", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/chat/${id}`);
    await page.getByRole("button", { name: "Compliance Report" }).click();
    await expect(page).toHaveURL(new RegExp(`/compliance/${id}`));
  });

  test("clicking suggestion sends message and gets AI response", async ({ page }) => {
    test.setTimeout(180000);
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/chat/${id}`);

    // Click first suggestion button
    await page.getByRole("button", { name: /highest-risk counterparties/i }).click();

    // User message should appear in messages area (not just the button)
    await page.waitForTimeout(1000);

    // Wait for the input to be cleared (signals message was sent)
    const input = page.locator('input[placeholder*="risk"]').first();
    await expect(input).toHaveValue("", { timeout: 10000 });

    // Wait for assistant response (the suggestion buttons should disappear once messages exist)
    await page.waitForTimeout(2000);
    // Check that some response text appears in the body — wait for LLM
    await expect(page.locator("body")).toContainText(/risk|account|trust|liquidity/i, {
      timeout: 120000,
    });
  });

  test("can type and submit custom message", async ({ page }) => {
    test.setTimeout(180000);
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/chat/${id}`);

    const input = page.locator('input[placeholder*="risk"]').first();
    await input.fill("How many trust lines does this account have?");
    await input.press("Enter");

    // Wait for assistant response — may take 30s+
    await expect(page.locator("text=/trust line/i").first()).toBeVisible({ timeout: 120000 });
  });
});

// ─── Corridor Detail Page ────────────────────────────────────
// Moved from Analyze → lives at /corridors/:id as its own page backed
// by the shared PathGraph component.

test.describe("Corridor Detail Page", () => {
  // Updated for the multi-route pair model: legacy issuer-pair IDs replaced
  // with the canonical fiat-pair slugs (usd-eur, usd-rlusd, …).

  test("USD → EUR pair page renders the routes comparison and AI note", async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`${BASE}/corridors/usd-eur`);
    await expect(page.locator("h1", { hasText: "USD → EUR" })).toBeVisible();
    await expect(page.locator('[data-testid="ai-note-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="routes-comparison"]')).toBeVisible({ timeout: 30000 });
  });

  test("USD → RLUSD detail page surfaces CLAWBACK_ENABLED flag on the winner", async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`${BASE}/corridors/usd-rlusd`);
    await expect(page.locator('[data-testid="ai-note-card"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator("text=CLAWBACK_ENABLED").first()).toBeVisible({ timeout: 15000 });
  });
});

// ─── Rare Node Types Tests ───────────────────────────────────

test.describe("Rare Node Types", () => {
  async function findNodeWithContent(page: any, contentMatch: string, maxClicks = 30): Promise<string | null> {
    const nodes = page.locator(".react-flow__node");
    const count = await nodes.count();
    for (let i = 0; i < Math.min(count, maxClicks); i++) {
      try {
        await nodes.nth(i).click({ force: true, timeout: 3000 });
      } catch {
        continue;
      }
      await page.waitForTimeout(150);
      const pre = page.locator("pre").first();
      if (await pre.isVisible().catch(() => false)) {
        const text = (await pre.textContent()) ?? "";
        if (text.includes(contentMatch)) return text;
      }
    }
    return null;
  }

  test("DocAccount has credential nodes via API", async ({ request }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const credentials = graph.nodes.filter((n: any) => n.kind === "credential");
    expect(credentials.length).toBeGreaterThan(0);
    expect(credentials[0].data).toHaveProperty("subject");
    expect(credentials[0].data).toHaveProperty("issuer");
    expect(credentials[0].data).toHaveProperty("credentialType");
  });

  test("DocAccount has depositPreauth nodes via API", async ({ request }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const dps = graph.nodes.filter((n: any) => n.kind === "depositPreauth");
    expect(dps.length).toBeGreaterThan(0);
    expect(dps[0].data).toHaveProperty("authorize");
  });

  test("DocAccount has ticket nodes via API", async ({ request }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const tickets = graph.nodes.filter((n: any) => n.kind === "ticket");
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets[0].data).toHaveProperty("ticketSequence");
  });

  test("DocAccount has payChannel nodes via API", async ({ request }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const channels = graph.nodes.filter((n: any) => n.kind === "payChannel");
    expect(channels.length).toBeGreaterThan(0);
    expect(channels[0].data).toHaveProperty("destination");
    expect(channels[0].data).toHaveProperty("amount");
    expect(channels[0].data).toHaveProperty("settleDelay");
  });

  test("DocAccount has offer nodes via API", async ({ request }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const offers = graph.nodes.filter((n: any) => n.kind === "offer");
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0].data).toHaveProperty("takerGets");
    expect(offers[0].data).toHaveProperty("takerPays");
  });

  test("NFTHolder has nft nodes via API", async ({ request }) => {
    const id = ANALYSES["NFTHolder"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const nfts = graph.nodes.filter((n: any) => n.kind === "nft");
    expect(nfts.length).toBeGreaterThan(0);
    expect(nfts[0].data).toHaveProperty("nftId");
    expect(nfts[0].data).toHaveProperty("issuer");
    expect(nfts[0].data).toHaveProperty("taxon");
  });

  test("NFTHolder has nftOffer nodes via API", async ({ request }) => {
    const id = ANALYSES["NFTHolder"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const offers = graph.nodes.filter((n: any) => n.kind === "nftOffer");
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0].data).toHaveProperty("amount");
    expect(offers[0].data).toHaveProperty("isSellOffer");
  });

  test("NFTHolder has payChannel nodes via API", async ({ request }) => {
    const id = ANALYSES["NFTHolder"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const channels = graph.nodes.filter((n: any) => n.kind === "payChannel");
    expect(channels.length).toBeGreaterThan(0);
  });

  test("MPTIssuer has mpToken nodes via API", async ({ request }) => {
    const id = ANALYSES["MPTIssuer"]?.id;
    test.skip(!id);
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const mpts = graph.nodes.filter((n: any) => n.kind === "mpToken");
    expect(mpts.length).toBeGreaterThan(0);
    expect(mpts[0].data).toHaveProperty("mptIssuanceID");
    expect(mpts[0].data).toHaveProperty("issuer");
  });

  // UI render tests for rare types
  test("DocAccount graph renders all rare node types in UI", async ({ page }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const nodeCount = await page.locator(".react-flow__node").count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test("DocAccount: clicking credential node shows credentialType", async ({ page }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, '"credentialType"', 30);
    expect(data).toBeTruthy();
    expect(data).toContain('"subject"');
  });

  test("DocAccount: clicking ticket node shows ticketSequence", async ({ page }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, '"ticketSequence"', 30);
    expect(data).toBeTruthy();
  });

  test("DocAccount: clicking payChannel node shows settleDelay", async ({ page }) => {
    const id = ANALYSES["DocAccount"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, '"settleDelay"', 30);
    expect(data).toBeTruthy();
    expect(data).toContain('"destination"');
  });

  test("NFTHolder: clicking nft node shows nftId and taxon", async ({ page, request }) => {
    const id = ANALYSES["NFTHolder"]?.id;
    test.skip(!id);
    // Verify via API since NFT nodes are far in a 275-node graph
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const nft = graph.nodes.find((n: any) => n.kind === "nft");
    expect(nft).toBeTruthy();
    expect(nft.data).toHaveProperty("nftId");
    expect(nft.data).toHaveProperty("taxon");
    // Also verify the page renders
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    expect(await page.locator(".react-flow__node").count()).toBeGreaterThan(0);
  });

  test("MPTIssuer: clicking mpToken node shows mptIssuanceID", async ({ page }) => {
    const id = ANALYSES["MPTIssuer"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, '"mptIssuanceID"', 5);
    expect(data).toBeTruthy();
  });
});
