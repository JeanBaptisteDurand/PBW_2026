import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/clients",
    include: ["tests/**/*.test.ts"],
  },
});
