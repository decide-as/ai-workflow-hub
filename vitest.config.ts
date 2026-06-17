import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    alias: {
      "@shared": resolve(__dirname, "shared"),
    },
  },
  resolve: {
    alias: {
      "../../shared/types": resolve(__dirname, "shared/types.ts"),
      "../../../shared/types": resolve(__dirname, "shared/types.ts"),
    },
  },
});
