import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: [
    "recommendations.spec.ts",
    "interpretation.spec.ts",
    "interpretation-checks.spec.ts",
    "recovery.spec.ts",
    "account.spec.ts",
    "exploration.spec.ts",
    "pwa.spec.ts",
  ],
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4317", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 4317",
    url: "http://127.0.0.1:4317",
    reuseExistingServer: false,
    env: {
      APP_MODE: "preview",
      APP_ORIGIN: "http://127.0.0.1:4317",
      LOCATION_MODE: "fixtures",
    },
  },
});
