import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "pwa.spec.ts",
  outputDir: "test-results/pwa",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4318",
    trace: "retain-on-failure",
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "android-emulation",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } },
    },
    {
      name: "ios-guidance-emulation",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 4318",
    url: "http://127.0.0.1:4318",
    reuseExistingServer: false,
    env: {
      APP_MODE: "preview",
      APP_ORIGIN: "http://127.0.0.1:4318",
      LOCATION_MODE: "fixtures",
    },
  },
});
