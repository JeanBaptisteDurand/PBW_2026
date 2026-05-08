import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/market-data",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: { forks: { minForks: 1, maxForks: 1 } },
  },
});
