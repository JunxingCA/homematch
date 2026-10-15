import { defineConfig } from "@playwright/test";
import research from "./playwright.research.config";

// Reuse the configured local app without taking over its dev-server lock.
export default defineConfig({ ...research, testMatch: "recovery.spec.ts" });
