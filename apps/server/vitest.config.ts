import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: "postgresql://xrplens:xrplens_dev@localhost:5432/xrplens",
      REDIS_URL: "redis://localhost:6379",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@xrplens/core": resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
});
