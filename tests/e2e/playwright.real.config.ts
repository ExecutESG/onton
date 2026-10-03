import { defineConfig } from "@playwright/test";
import * as path from "path";
import { assertNotProduction, loadEnvTest } from "./helpers/envTest";

loadEnvTest(path.resolve(__dirname, ".env.test"));
assertNotProduction();

/**
 * Real-backend suite: API-level tests against STAGING with signed Telegram initData.
 * Serial on purpose: tests share persistent fixtures and run in order.
 */
export default defineConfig({
  testDir: "./real",
  testMatch: /.*\.real\.spec\.ts$/,
  globalSetup: "./real/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  reporter: [["list"], ["html", { outputFolder: "playwright-report-real", open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL,
  },
});
