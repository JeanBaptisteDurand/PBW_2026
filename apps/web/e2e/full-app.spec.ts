import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const API = "http://localhost:3001";

let ANALYSES: Record<string, { id: string; nodeCount: number; kinds: string[] }> = {};

test.beforeAll(async ({ request }) => {
  const resp = await request.get(`${API}/api/analyze?limit=200`);
  const all = await resp.json();
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
    if (ANALYSES[label] && ANALYSES[label].nodeCount > graph.nodes.length) continue;
    ANALYSES[label] = {
      id: a.id,
      nodeCount: graph.nodes.length,
      kinds: [...new Set(graph.nodes.map((n: any) => n.kind))].sort() as string[],
    };
  }
});

// ─── Home Page ───────────────────────────────────────────────

test.describe("Home Page", () => {
  test("loads and shows title", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("has navigation to Analyze", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('a[href="/analyze"]').first()).toBeVisible();
  });
});

// ─── Analyze Page — Entity Tab ───────────────────────────────

test.describe("Analyze Page — Entity Audit", () => {
  // Corridor analysis lives on its own /corridors and /safe-path pages
  // now, so the Analyze page is entity-only — no mode tabs.

  test("entity form visible with address input", async ({ page }) => {
    await page.goto(`${BASE}/analyze`);
    await expect(page.locator('input[placeholder*="rMxCKbEDwqr76"]')).toBeVisible();
  });

  test("shows preset buttons", async ({ page }) => {
    await page.goto(`${BASE}/analyze`);
    await expect(page.getByRole("button", { name: "RLUSD Issuer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bitstamp (8 currencies)" })).toBeVisible();
  });

  test("clicking preset fills address input", async ({ page }) => {
    await page.goto(`${BASE}/analyze`);
    await page.getByRole("button", { name: "RLUSD Issuer" }).click();
    await expect(page.locator('input[placeholder*="rMxCKbEDwqr76"]')).toHaveValue(
      "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
    );
  });

  test("Start Analysis button disabled without address", async ({ page }) => {
    await page.goto(`${BASE}/analyze`);
    await expect(page.getByRole("button", { name: "Start Analysis" })).toBeDisabled();
  });
});

// ─── Graph View — Core ──────────────────────────────────────

test.describe("Graph View — Core", () => {
  test("RLUSD graph renders nodes", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const count = await page.locator(".react-flow__node").count();
    expect(count).toBeGreaterThan(0);
  });

  test("stats bar shows node/edge count", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible();
    await expect(page.locator("text=/\\d+ edges/")).toBeVisible();
  });

  test("Compliance Report and AI Chat buttons visible", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await expect(page.getByRole("button", { name: "Compliance Report" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Chat" })).toBeVisible();
  });

  test("clicking node opens sidebar with Node Data", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await page.locator(".react-flow__node").first().click();
    await expect(page.locator("text=Node Data")).toBeVisible({ timeout: 3000 });
  });

  test("sidebar closes with X button", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await page.locator(".react-flow__node").first().click();
    await expect(page.locator("text=Node Data")).toBeVisible({ timeout: 3000 });
    await page.locator("button:has-text('\u00d7')").click();
    await expect(page.locator("text=Node Data")).not.toBeVisible({ timeout: 2000 });
  });

  test("edges render between nodes", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const edges = await page.locator(".react-flow__edge").count();
    expect(edges).toBeGreaterThan(0);
  });

  test("zoom controls and minimap visible", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await expect(page.locator(".react-flow__controls")).toBeVisible();
    await expect(page.locator(".react-flow__minimap")).toBeVisible();
  });

  test("legend visible", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await expect(page.locator("text=Issuer").first()).toBeVisible();
  });

  test("HIGH risk badge shown in stats bar", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await expect(page.locator("text=/HIGH/")).toBeVisible();
  });
});

// ─── All 9 Analyses Load ────────────────────────────────────

test.describe("All Analyses Load", () => {
  for (const name of ["RLUSD","Bitstamp","Binance","TipBot","Oracle","RippleEscrow","Coinbase","AMM_Pool","GateHub"]) {
    test(`${name} graph loads`, async ({ page }) => {
      const id = ANALYSES[name]?.id;
      test.skip(!id, `${name} not available`);
      await page.goto(`${BASE}/graph/${id}`);
      await page.waitForSelector(".react-flow__node", { timeout: 15000 });
      expect(await page.locator(".react-flow__node").count()).toBeGreaterThan(0);
    });
  }
});

// ─── Node Type Verification ─────────────────────────────────

test.describe("Node Types Verified", () => {
  async function findNodeWithContent(page: any, contentMatch: string, maxClicks = 15): Promise<string | null> {
    const nodes = page.locator(".react-flow__node");
    const count = await nodes.count();
    for (let i = 0; i < Math.min(count, maxClicks); i++) {
      try {
        await nodes.nth(i).click({ force: true, timeout: 3000 });
      } catch {
        continue;
      }
      await page.waitForTimeout(200);
      const pre = page.locator("pre").first();
      if (await pre.isVisible().catch(() => false)) {
        const text = (await pre.textContent()) ?? "";
        if (text.includes(contentMatch)) return text;
      }
    }
    return null;
  }

  test("Oracle graph: oracle node has priceDataSeries with baseAsset", async ({ page }) => {
    const id = ANALYSES["Oracle"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, "priceDataSeries");
    expect(data).toBeTruthy();
    expect(data).toContain("baseAsset");
    expect(data).toContain("diadata");
  });

  test("RippleEscrow: escrow node has amount and destination", async ({ page }) => {
    const id = ANALYSES["RippleEscrow"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, '"finishAfter"');
    expect(data).toBeTruthy();
    expect(data).toContain('"amount"');
    expect(data).toContain('"destination"');
  });

  test("RippleEscrow: signerList node has quorum and signers", async ({ page }) => {
    const id = ANALYSES["RippleEscrow"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    // signerList is the last node (17th), need to click through all
    const data = await findNodeWithContent(page, '"signerQuorum"', 20);
    expect(data).toBeTruthy();
    expect(data).toContain('"signers"');
  });

  test("Coinbase: check node has sendMax and destination", async ({ page }) => {
    const id = ANALYSES["Coinbase"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, '"sendMax"', 35);
    expect(data).toBeTruthy();
    expect(data).toContain('"destination"');
  });

  test("AMM_Pool: ammPool node has reserves and tradingFee", async ({ page, request }) => {
    const id = ANALYSES["AMM_Pool"]?.id;
    test.skip(!id);
    // Verify via API (AMM node is hard to click in a 74-node graph)
    const resp = await request.get(`${API}/api/analysis/${id}/graph`);
    const graph = await resp.json();
    const amm = graph.nodes.find((n: any) => n.kind === "ammPool");
    expect(amm).toBeTruthy();
    expect(amm.data.reserve1).toBeTruthy();
    expect(amm.data.reserve2).toBeTruthy();
    expect(amm.data.tradingFee).toBeDefined();
    expect(amm.data.lpHolderCount).toBeDefined();
    // Also verify the graph page loads
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    expect(await page.locator(".react-flow__node").count()).toBeGreaterThan(0);
  });

  test("RLUSD: issuer node has balance, domain, flags, isBlackholed", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, '"isBlackholed"');
    expect(data).toBeTruthy();
    expect(data).toContain('"balance"');
    expect(data).toContain('"domain"');
    expect(data).toContain('"flags"');
  });

  test("Bitstamp: issuer has transferRate and regularKey", async ({ page }) => {
    const id = ANALYSES["Bitstamp"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, "1001500000");
    expect(data).toBeTruthy();
    expect(data).toContain('"transferRate"');
    expect(data).toContain('"regularKey"');
  });

  test("GateHub: issuer has transferRate and messageKey", async ({ page }) => {
    const id = ANALYSES["GateHub"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    const data = await findNodeWithContent(page, "1002000000");
    expect(data).toBeTruthy();
    expect(data).toContain('"transferRate"');
    expect(data).toContain('"messageKey"');
  });
});

// ─── Navigation ──────────────────────────────────────────────

test.describe("Navigation", () => {
  test("Compliance Report button navigates", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await page.getByRole("button", { name: "Compliance Report" }).click();
    await expect(page).toHaveURL(new RegExp(`/compliance/${id}`));
  });

  test("AI Chat button navigates", async ({ page }) => {
    const id = ANALYSES["RLUSD"]?.id;
    test.skip(!id);
    await page.goto(`${BASE}/graph/${id}`);
    await page.waitForSelector(".react-flow__node", { timeout: 10000 });
    await page.getByRole("button", { name: "AI Chat" }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/${id}`));
  });
});
