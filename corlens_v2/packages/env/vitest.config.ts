import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/env",
    include: ["tests/**/*.test.ts"],
  },
});
