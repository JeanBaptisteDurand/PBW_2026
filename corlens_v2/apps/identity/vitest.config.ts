import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/identity",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        // Integration tests share the same Postgres/Redis instance; run serially
        // to avoid cross-suite data races.
        minForks: 1,
        maxForks: 1,
      },
    },
  },
});
