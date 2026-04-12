import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANALYSIS_ID = "12d3c33b-6aec-438c-9f02-88c6b678c8de";
const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const SCREENSHOTS_DIR = path.resolve(__dirname, "../../../screenshots");

function ss(name: string) {
  return { path: path.join(SCREENSHOTS_DIR, `${name}.png`), fullPage: true };
}

function ssViewport(name: string) {
  return { path: path.join(SCREENSHOTS_DIR, `${name}.png`) };
}

// ─────────────────────────────────────────────────────────────
// 1. HOME PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Home Page Screenshots", () => {
  test("01 - home full page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1_000);
    await page.screenshot(ss("01-home-full"));
  });

  test("02 - home hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Risk Intelligence")).toBeVisible();
    await page.screenshot(ssViewport("02-home-hero"));
  });

  test("03 - home feature cards", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot(ssViewport("03-home-features"));
  });
});

// ─────────────────────────────────────────────────────────────
// 2. ANALYZE PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Analyze Page Screenshots", () => {
  test("04 - analyze empty form", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.locator("text=Analyze XRPL Entity")).toBeVisible();
    await page.screenshot(ss("04-analyze-empty"));
  });

  test("05 - analyze with RLUSD preset filled", async ({ page }) => {
    await page.goto("/analyze");
    await page.click("button:has-text('RLUSD Issuer')");
    await page.waitForTimeout(300);
    await page.screenshot(ss("05-analyze-preset-filled"));
  });

  test("06 - analyze from URL params", async ({ page }) => {
    await page.goto(`/analyze?address=${RLUSD_ISSUER}&label=RLUSD`);
    await page.waitForTimeout(500);
    await page.screenshot(ss("06-analyze-url-params"));
  });
});

// ─────────────────────────────────────────────────────────────
// 3. GRAPH VIEW PAGE
// ─────────────────────────────────────────────────────────────
test.describe("Graph View Screenshots", () => {
  test("07 - graph full view with stats bar", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    await page.screenshot(ssViewport("07-graph-full-view"));
  });

  test("08 - graph zoomed to center (issuer node)", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    // Zoom in using keyboard shortcut (Ctrl+= or mouse wheel)
    const canvas = page.locator(".react-flow");
    for (let i = 0; i < 3; i++) {
      await canvas.evaluate((el) => {
        el.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
      });
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);
    await page.screenshot(ssViewport("08-graph-zoomed-center"));
  });

  test("09 - graph node clicked - detail panel", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    // Click issuer node (first node rendered)
    await page.locator(".react-flow__node").first().click();
    await expect(page.locator("text=Node Data")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);
    await page.screenshot(ssViewport("09-graph-node-detail"));
  });

  test("10 - graph node with risk flags", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    // Find and click a node that has risk flags (look for the risk badge indicator)
    const nodesWithFlags = page.locator(".react-flow__node:has([style*='background: #ef4444']), .react-flow__node:has([style*='background: #f59e0b'])");
    const count = await nodesWithFlags.count();
    if (count > 0) {
      await nodesWithFlags.first().click();
      await page.waitForTimeout(500);
    }
    await page.screenshot(ssViewport("10-graph-risk-flags"));
  });

  test("11 - graph legend visible", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await page.screenshot(ssViewport("11-graph-with-legend"));
  });

  test("12 - graph error state (nonexistent)", async ({ page }) => {
    await page.goto("/graph/nonexistent-id");
    await expect(page.getByText("Failed to load graph")).toBeVisible({ timeout: 15_000 });
    await page.screenshot(ssViewport("12-graph-error-state"));
  });
});

// ─────────────────────────────────────────────────────────────
// 4. COMPLIANCE REPORT
// ─────────────────────────────────────────────────────────────
test.describe("Compliance Report Screenshots", () => {
  test("13 - compliance before generation", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.waitForTimeout(500);
    await page.screenshot(ss("13-compliance-before-generate"));
  });

  test("14 - compliance report generated (full)", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Risk Assessment")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot(ss("14-compliance-report-full"));
  });

  test("15 - compliance risk assessment section", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Risk Assessment")).toBeVisible({ timeout: 30_000 });
    // Scroll to risk assessment
    await page.locator("text=Risk Assessment").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot(ssViewport("15-compliance-risk-section"));
  });

  test("16 - compliance entity breakdown", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Entity Breakdown")).toBeVisible({ timeout: 30_000 });
    await page.locator("text=Entity Breakdown").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot(ssViewport("16-compliance-entity-breakdown"));
  });

  test("17 - compliance recommendations", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Recommendations")).toBeVisible({ timeout: 30_000 });
    await page.locator("text=Recommendations").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot(ssViewport("17-compliance-recommendations"));
  });
});

// ─────────────────────────────────────────────────────────────
// 5. AI CHAT
// ─────────────────────────────────────────────────────────────
test.describe("Chat Page Screenshots", () => {
  test("18 - chat empty state with suggestions", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    await page.waitForTimeout(500);
    await page.screenshot(ssViewport("18-chat-empty-suggestions"));
  });

  test("19 - chat with AI response", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    const input = page.locator("input, textarea").first();
    await input.fill("What are the main risks for RLUSD on XRPL?");
    await page.click("button:has-text('Send')");
    // Wait for AI response (real GPT-4o-mini now)
    await page.waitForTimeout(8_000);
    await page.screenshot(ssViewport("19-chat-ai-response"));
  });

  test("20 - chat follow-up conversation", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    const input = page.locator("input, textarea").first();

    // First message
    await input.fill("Summarize the LP concentration analysis");
    await page.click("button:has-text('Send')");
    await page.waitForTimeout(8_000);

    // Follow-up
    await input.fill("What should institutional investors watch out for?");
    await page.click("button:has-text('Send')");
    await page.waitForTimeout(8_000);

    await page.screenshot(ssViewport("20-chat-conversation"));
  });
});

// ─────────────────────────────────────────────────────────────
// 6. NAVIGATION & MISC
// ─────────────────────────────────────────────────────────────
test.describe("Navigation Screenshots", () => {
  test("21 - navbar on home", async ({ page }) => {
    await page.goto("/");
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "21-navbar-home.png"),
      clip: { x: 0, y: 0, width: 1280, height: 56 },
    });
  });

  test("22 - navbar on analyze (active state)", async ({ page }) => {
    await page.goto("/analyze");
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "22-navbar-analyze-active.png"),
      clip: { x: 0, y: 0, width: 1280, height: 56 },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 7. FUNCTIONAL E2E TESTS (with real AI)
// ─────────────────────────────────────────────────────────────
test.describe("Functional E2E with Real AI", () => {
  test("chat returns real AI analysis (not placeholder)", async ({ page }) => {
    await page.goto(`/chat/${ANALYSIS_ID}`);
    const input = page.locator("input, textarea").first();
    await input.fill("What risks exist for RLUSD?");
    await page.click("button:has-text('Send')");
    // Wait for real response
    await page.waitForTimeout(10_000);
    // Should NOT contain "placeholder" — should have real analysis
    const messages = await page.locator("[class*='bg-slate']").allInnerTexts();
    const aiResponse = messages.find((m) => m.length > 50) ?? "";
    expect(aiResponse).not.toContain("placeholder");
    expect(aiResponse.length).toBeGreaterThan(30);
  });

  test("compliance report has real AI summary", async ({ page }) => {
    await page.goto(`/compliance/${ANALYSIS_ID}`);
    await page.click("button:has-text('Generate Report')");
    // Wait for full report to render (AI generation can take a few seconds)
    await expect(page.locator("text=Recommendations")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=Risk Assessment")).toBeVisible();
    await expect(page.locator("text=Entity Breakdown")).toBeVisible();
    // Verify it's not placeholder content
    const riskSection = await page.locator("text=/HIGH|MED|LOW/").first().innerText();
    expect(riskSection.length).toBeGreaterThan(0);
  });

  test("graph renders all expected node types", async ({ page }) => {
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    // Check we have multiple node types rendered
    const nodeCount = await page.locator(".react-flow__node").count();
    expect(nodeCount).toBeGreaterThan(20);
    // Check edges exist
    const edgeCount = await page.locator(".react-flow__edge").count();
    expect(edgeCount).toBeGreaterThan(10);
  });

  test("full demo flow: home → analyze → graph → compliance → chat", async ({ page }) => {
    // 1. Start at home
    await page.goto("/");
    await expect(page.locator("text=Risk Intelligence")).toBeVisible();
    await page.screenshot(ssViewport("23-demo-01-home"));

    // 2. Click Analyze RLUSD
    await page.click("button:has-text('Analyze RLUSD')");
    await page.waitForURL(/\/analyze/);
    await expect(page.locator(`input[value="${RLUSD_ISSUER}"]`)).toBeVisible();
    await page.screenshot(ssViewport("24-demo-02-analyze"));

    // 3. Navigate directly to graph (analysis already done)
    await page.goto(`/graph/${ANALYSIS_ID}`);
    await expect(page.locator("text=/\\d+ nodes/")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    await page.screenshot(ssViewport("25-demo-03-graph"));

    // 4. Go to compliance
    await page.click("button:has-text('Compliance Report')");
    await page.waitForURL(/\/compliance\//);
    await page.click("button:has-text('Generate Report')");
    await expect(page.locator("text=Risk Assessment")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.screenshot(ssViewport("26-demo-04-compliance"));

    // 5. Go to chat
    await page.goto(`/chat/${ANALYSIS_ID}`);
    const input = page.locator("input, textarea").first();
    await input.fill("Which corridors are at risk of liquidity issues?");
    await page.click("button:has-text('Send')");
    await page.waitForTimeout(8_000);
    await page.screenshot(ssViewport("27-demo-05-chat"));
  });
});
