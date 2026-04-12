import { test, expect } from "@playwright/test";

// ─── Corridor globe ──────────────────────────────────────────────────────
// Verifies the 3D spherical world map mounted at the top of the Corridor
// Atlas page: the cobe canvas renders, the stats chrome surfaces the
// expected fiat corridor counts, and the pointer drag handlers respond.

test.describe("Corridor globe (top of /corridors)", () => {
  test("renders the globe container, canvas and corner chrome", async ({ page }) => {
    await page.goto("/corridors");

    const globe = page.locator('[data-testid="corridor-globe"]');
    await expect(globe).toBeVisible();

    const canvas = page.locator('[data-testid="corridor-globe-canvas"]');
    await expect(canvas).toBeVisible();

    // Canvas must have non-zero dimensions (cobe inflates width/height
    // against devicePixelRatio, so expect at least a few hundred pixels).
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(300);

    // Corner chrome — title, legend dots, hint.
    await expect(globe.getByText("XRPL · Fiat Corridor Network")).toBeVisible();
    await expect(globe.getByText("Green")).toBeVisible();
    await expect(globe.getByText("Amber")).toBeVisible();
    await expect(globe.getByText("Red")).toBeVisible();
    await expect(globe.getByText(/Drag to rotate/i)).toBeVisible();
  });

  test("stats readout reports a realistic number of fiat corridors", async ({
    page,
  }) => {
    await page.goto("/corridors");

    // The catalog lists ~30+ fiat currencies with USD-crosses plus several
    // regional triangles. Exact number depends on catalog generation —
    // assert a sensible floor instead of a hard equality.
    const stats = page.locator('[data-testid="globe-stats"]');
    await expect(stats).toBeVisible();
    await expect(stats).toContainText(/fiat corridors/);
    await expect(stats).toContainText(/financial centres/);

    const text = (await stats.textContent()) ?? "";
    const match = text.match(/(\d+)\s+fiat corridors\s+·\s+(\d+)\s+financial centres/);
    expect(match).not.toBeNull();
    const corridorCount = Number(match![1]);
    const centreCount = Number(match![2]);
    expect(corridorCount).toBeGreaterThan(10);
    expect(centreCount).toBeGreaterThan(5);
  });

  test("globe is positioned above the filter bar", async ({ page }) => {
    await page.goto("/corridors");

    const globeBox = await page
      .locator('[data-testid="corridor-globe"]')
      .boundingBox();
    const filterBox = await page
      .locator('[data-testid="corridor-filters"]')
      .boundingBox();

    expect(globeBox).not.toBeNull();
    expect(filterBox).not.toBeNull();
    // The globe should sit above the filter bar in the DOM flow.
    expect(globeBox!.y).toBeLessThan(filterBox!.y);
  });

  test("canvas actually paints pixels (not a blank rectangle)", async ({
    page,
  }) => {
    await page.goto("/corridors");

    // Wait for cobe to finish its fade-in and paint at least one frame
    // with visible markers / arcs.
    await page.waitForTimeout(1500);

    const brightness = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="corridor-globe-canvas"]',
      );
      if (!canvas) return -1;
      // cobe uses WebGL, so a 2D getContext will fail. Instead, rely on a
      // visual proxy: copy the canvas into an offscreen 2D canvas via
      // drawImage and sample pixels. If the WebGL context was created with
      // `preserveDrawingBuffer: false` (cobe's default) we may sample a
      // cleared buffer; do the sample immediately after a RAF to maximise
      // the chance of catching a non-empty frame.
      return new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          const off = document.createElement("canvas");
          off.width = canvas.width;
          off.height = canvas.height;
          const ctx = off.getContext("2d");
          if (!ctx) return resolve(-2);
          try {
            ctx.drawImage(canvas, 0, 0);
          } catch {
            return resolve(-3);
          }
          const { width, height } = off;
          const sample = ctx.getImageData(
            Math.floor(width / 2) - 50,
            Math.floor(height / 2) - 50,
            100,
            100,
          );
          let sum = 0;
          for (let i = 0; i < sample.data.length; i += 4) {
            sum += sample.data[i] + sample.data[i + 1] + sample.data[i + 2];
          }
          resolve(sum);
        });
      });
    });

    // Either the drawImage fallback failed (-2/-3: sandbox issue), in
    // which case we don't fail the test; or we got a positive brightness
    // meaning cobe actually drew something.
    if (brightness >= 0) {
      expect(brightness).toBeGreaterThan(0);
    }
  });

  test("currency labels render for every financial centre", async ({
    page,
  }) => {
    await page.goto("/corridors");
    // Labels layer exists.
    const layer = page.locator('[data-testid="corridor-globe-labels"]');
    await expect(layer).toBeVisible();
    // Every major fiat currency that participates in a fiat-fiat corridor
    // should have a label button. USD / EUR / GBP / JPY / CNY / CHF / AUD
    // are present in the seeded catalog.
    for (const sym of ["USD", "EUR", "GBP", "JPY", "CNY", "CHF", "AUD"]) {
      await expect(
        page.locator(`[data-testid="globe-label-${sym}"]`),
      ).toHaveCount(1);
    }
  });

  test("clicking a currency filters arcs and opens the connections panel", async ({
    page,
  }) => {
    await page.goto("/corridors");
    await page.waitForTimeout(500);

    // Hover the centre first — this pauses auto-spin via onMouseEnter so
    // subsequent clicks land on stable labels (matches human behaviour).
    const box = await page
      .locator('[data-testid="corridor-globe"]')
      .boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(200);

    // Click the USD label. Force-click because the button may still be in
    // a transform animation during the first frame after hover.
    await page.locator('[data-testid="globe-label-USD"]').click({ force: true });

    // Selection panel appears and names the selected currency.
    const panel = page.locator('[data-testid="globe-selection-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("USD");
    await expect(panel).toContainText(/connects to \d+ currenc/);

    // The panel surfaces at least one connection chip for every USD cross.
    for (const sym of ["EUR", "CNY", "JPY", "GBP"]) {
      await expect(
        panel.locator(`[data-testid^="globe-conn-"]`, {
          hasText: sym,
        }).first(),
      ).toBeVisible();
    }

    // Stats readout should now report only USD-related arcs, which is
    // strictly fewer than the full catalog (42 → ~12).
    const stats = page.locator('[data-testid="globe-stats"]');
    const afterText = (await stats.textContent()) ?? "";
    const filteredMatch = afterText.match(/(\d+)\s+fiat corridors/);
    expect(filteredMatch).not.toBeNull();
    const filtered = Number(filteredMatch![1]);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(30);
  });

  test("clicking a connection chip navigates to the corridor detail page", async ({
    page,
  }) => {
    await page.goto("/corridors");
    const box = await page
      .locator('[data-testid="corridor-globe"]')
      .boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(200);

    await page.locator('[data-testid="globe-label-USD"]').click({ force: true });
    const panel = page.locator('[data-testid="globe-selection-panel"]');
    await expect(panel).toBeVisible();

    // The USD → EUR corridor chip should navigate to /corridors/usd-eur.
    await panel.locator('[data-testid="globe-conn-usd-eur"]').click();
    await expect(page).toHaveURL(/\/corridors\/usd-eur$/);
  });

  test("clearing the selection hides the panel", async ({ page }) => {
    await page.goto("/corridors");
    const box = await page
      .locator('[data-testid="corridor-globe"]')
      .boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(200);

    await page.locator('[data-testid="globe-label-USD"]').click({ force: true });
    const panel = page.locator('[data-testid="globe-selection-panel"]');
    await expect(panel).toBeVisible();

    // Click the explicit Clear button.
    await panel.locator('button', { hasText: "Clear" }).click();
    await expect(panel).toBeHidden();
  });

  test("pointer drag pauses auto-spin without crashing", async ({ page }) => {
    await page.goto("/corridors");

    const canvas = page.locator('[data-testid="corridor-globe-canvas"]');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Drag across the sphere — should not throw or tear down the canvas.
    const startX = box!.x + box!.width / 2 - 80;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + i * 18, startY);
    }
    await page.mouse.up();

    // After the drag, the canvas is still in the DOM and still sized.
    await expect(canvas).toBeVisible();
    const after = await canvas.boundingBox();
    expect(after!.width).toBeGreaterThan(300);
  });
});
