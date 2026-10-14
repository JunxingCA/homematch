import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "recovery.spec.ts",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4318", trace: "retain-on-failure" },
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
    command: "npm run dev -- --hostname 127.0.0.1 --port 4318",
    url: "http://127.0.0.1:4318",
    reuseExistingServer: false,
    env: {
      APP_MODE: "supabase",
      APP_ORIGIN: "http://127.0.0.1:4318",
      LOCATION_MODE: "onemap",
      PASSWORD_RECOVERY_ENABLED: "true",
    },
  },
});
