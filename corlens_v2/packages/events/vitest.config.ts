import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/events",
    include: ["tests/**/*.test.ts"],
  },
});
