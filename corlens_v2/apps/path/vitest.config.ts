import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/path",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: { forks: { minForks: 1, maxForks: 1 } },
  },
});
