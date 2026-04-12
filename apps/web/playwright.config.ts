import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // Enable software WebGL in headless Chromium so WebGL-based
        // visualisations (e.g. the cobe corridor globe) actually render.
        launchOptions: {
          args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
});
