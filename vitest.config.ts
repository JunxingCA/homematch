import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.mjs",
      "tests/integration/**/*.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.{ts,mjs}"],
      exclude: ["src/domain/fixtures.ts"],
      reporter: ["text", "html", "json", "json-summary"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
        "src/domain/recommendations.ts": {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        "src/domain/interpretation.ts": {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
