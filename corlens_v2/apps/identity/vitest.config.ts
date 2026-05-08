import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/identity",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
  },
});
