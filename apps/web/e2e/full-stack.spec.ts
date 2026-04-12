import { test, expect } from "@playwright/test";

// Pre-existing completed analysis from RLUSD auto-seed
const ANALYSIS_ID = "12d3c33b-6aec-438c-9f02-88c6b678c8de";
const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

// ─────────────────────────────────────────────────────────────
// 1. HOME PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Home Page", () => {
  test("renders with XRPLens branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toContainText("XRP");
    await expect(page.locator("nav")).toContainText("Lens");
  });

  test("shows hero headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Risk Intelligence")).toBeVisible();
  });

  test("shows 3 feature cards", async ({ page }) => {
    await page.goto("/");
    // The feature titles from Home.tsx FEATURES array
    await expect(page.getByText("Knowledge Graph")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Risk Flags")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compliance Reports" })).toBeVisible();
  });

  test("Analyze RLUSD CTA navigates to /analyze", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Analyze RLUSD')");
    await page.waitForURL(/\/analyze/);
    expect(page.url()).toContain("/analyze");
  });

  test("navbar links work", async ({ page }) => {
    await page.goto("/");
    await page.click("nav >> text=Analyze");
    await page.waitForURL("/analyze");
    expect(page.url()).toContain("/analyze");
  });

  test("stats section shows RLUSD data", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=317M+")).toBeVisible();
    await expect(page.locator("text=289")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. ANALYZE PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Analyze Page", () => {
  test("renders with title and form", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.locator("text=Analyze XRPL Entity")).toBeVisible();
    // Has input fields (no explicit type='text')
    const inputs = page.locator("input");
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);
  });

  test("RLUSD preset fills the address", async ({ page }) => {
    await page.goto("/analyze");
    await page.click("button:has-text('RLUSD Issuer')");
    // Check the address input has the RLUSD issuer
    await expect(page.locator(`input[value="${RLUSD_ISSUER}"]`)).toBeVisible();
  });

  test("URL params pre-fill the form", async ({ page }) => {
    await page.goto(`/analyze?address=${RLUSD_ISSUER}&label=RLUSD`);
    await expect(page.locator(`input[value="${RLUSD_ISSUER}"]`)).toBeVisible();
  });

  test("start analysis button exists and is clickable", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.locator("button:has-text('Start Analysis')")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 3. GRAPH VIEW PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Graph View Page", () => {
  test("renders graph for completed analysis", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    // Wait for the stats bar which shows "nodes"
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
  });

  test("shows node and edge count badges", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=/\\d+ edges/")).toBeVisible({ timeout: 15_000 });
  });

  test("shows risk flag badges", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/HIGH|MED/").first()).toBeVisible({ timeout: 15_000 });
  });

  test("ReactFlow canvas renders with nodes", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    // Wait for graph data to load first
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    // ReactFlow should have rendered
    await expect(page.locator(".react-flow")).toBeVisible();
    // Nodes should exist
    const nodeCount = await page.locator(".react-flow__node").count();
    expect(nodeCount).toBeGreaterThan(5);
  });

  test("graph has edges", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    // Give edges a moment to render
    await page.waitForTimeout(1_000);
    const edgeCount = await page.locator(".react-flow__edge").count();
    expect(edgeCount).toBeGreaterThan(0);
  });

  test("clicking a node shows detail panel", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    // Click the first node
    await page.locator(".react-flow__node").first().click();
    // Detail panel shows node kind and close button
    await expect(page.locator("text=Node Data")).toBeVisible({ timeout: 5_000 });
  });

  test("Compliance Report button navigates", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.click("button:has-text('Compliance Report')");
    await page.waitForURL(/\/compliance\//);
  });

  test("AI Chat button navigates", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.click("button:has-text('AI Chat')");
    await page.waitForURL(/\/chat\//);
  });

  test("nonexistent analysis shows error", async ({ page }) => {
    await page.goto("/graph/nonexistent-id");
    // Should show error card after loading
    await expect(page.getByText("Failed to load graph")).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 4. COMPLIANCE VIEW PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Compliance View Page", () => {
  test("renders with title and generate button", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await expect(page.getByRole("heading", { name: "Compliance Report", exact: true })).toBeVisible();
    await expect(page.locator("button:has-text('Generate Report')").first()).toBeVisible();
  });

  test("Back to Graph button navigates", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Back to Graph')");
    await page.waitForURL(/\/graph\//);
  });

  test("generate report creates and displays report", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Risk Assessment")).toBeVisible({ timeout: 30_000 });
  });

  test("report shows overall risk badge", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Risk Assessment")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=/HIGH|MED|LOW/").first()).toBeVisible();
  });

  test("report shows entity breakdown", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Entity Breakdown")).toBeVisible({ timeout: 30_000 });
  });

  test("report shows recommendations", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Recommendations")).toBeVisible({ timeout: 30_000 });
  });

  test("print button appears after generation", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Risk Assessment")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("button:has-text('Print')")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 5. CHAT PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Chat Page", () => {
  test("renders chat interface with input", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    await expect(page.locator("input, textarea").first()).toBeVisible();
  });

  test("shows suggestion chips when empty", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    await expect(page.locator("text=/risk|corridor|concentration|compliance/i").first()).toBeVisible();
  });

  test("can send a message and get response", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    const input = page.locator("input, textarea").first();
    await input.fill("What are the main risks?");
    await page.click("button:has-text('Send')");
    // User message should appear
    await expect(page.locator("text=What are the main risks?")).toBeVisible();
    // Wait for AI response (placeholder or real)
    await page.waitForTimeout(3_000);
    // Should have at least 2 messages now (user + assistant)
    const messages = page.locator("[class*='rounded-lg'][class*='px-']");
    expect(await messages.count()).toBeGreaterThanOrEqual(2);
  });

  test("Back to Graph button works", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    await page.click("button:has-text('Back to Graph')");
    await page.waitForURL(/\/graph\//);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. NAVIGATION & ROUTING
// ─────────────────────────────────────────────────────────────
test.describe("Navigation", () => {
  test("all routes load without crashes", async ({ page }) => {
    const routes = [
      "/",
      "/analyze",
      `/graph/${ANALYSIS_ID}`,
      `/compliance/${ANALYSIS_ID}`,
      `/chat/${ANALYSIS_ID}`,
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(1_000);
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(10);
    }
  });

  test("navbar is visible on all pages", async ({ page }) => {
    const routes = ["/", "/analyze", `/compliance/${ANALYSIS_ID}`];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("nav")).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 7. BACKEND API THROUGH VITE PROXY
// ─────────────────────────────────────────────────────────────
test.describe("API via Vite Proxy", () => {
  test("GET /api/analyze returns analysis list", async ({ request }) => {
    const response = await request.get("/api/analyze");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("id");
    expect(data[0]).toHaveProperty("status");
  });

  test("GET /api/analyze/:id/status returns done", async ({ request }) => {
    const response = await request.get(`/api/analyze/${ANALYSIS_ID}/status`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("done");
    expect(data.seedAddress).toBe(RLUSD_ISSUER);
  });

  test("GET /api/analysis/:id/graph returns full graph", async ({ request }) => {
    const response = await request.get(`/api/analysis/${ANALYSIS_ID}/graph`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.edges.length).toBeGreaterThan(0);
    expect(data.stats.totalNodes).toBeGreaterThan(0);
  });

  test("POST /api/analyze validates address", async ({ request }) => {
    const response = await request.post("/api/analyze", {
      data: { seedAddress: "invalid" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/compliance generates report", async ({ request }) => {
    const response = await request.post(`/api/compliance/${ANALYSIS_ID}`);
    expect([200, 201]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("report");
    expect(data.report).toHaveProperty("title");
    expect(data.report).toHaveProperty("riskAssessment");
    expect(data.report).toHaveProperty("recommendations");
  });

  test("POST /api/chat sends and gets response", async ({ request }) => {
    const response = await request.post("/api/chat", {
      data: { analysisId: ANALYSIS_ID, message: "What risks exist?" },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.chatId).toBeTruthy();
    expect(data.message.role).toBe("assistant");
    expect(data.message.content.length).toBeGreaterThan(0);
  });

  test("GET /api/analysis/nonexistent/graph returns 404", async ({ request }) => {
    const response = await request.get("/api/analysis/nonexistent/graph");
    expect(response.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// 8. CONSOLE ERROR MONITORING
// ─────────────────────────────────────────────────────────────
test.describe("Console Errors", () => {
  test("home page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test("analyze page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/analyze");
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test("graph page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test("compliance page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test("chat page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`/chat/${ANALYSIS_ID}`);
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});
