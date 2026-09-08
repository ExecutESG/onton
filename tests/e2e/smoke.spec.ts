import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("ONTON Platform Smoke & Health Tests", () => {
  test("Landing page loads successfully with HTTP 200", async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("Critical DOM containers render on page", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const body = page.locator("body");
    await expect(body).toBeVisible();

    const mainContainer = page.locator("main, #__next, div");
    await expect(mainContainer.first()).toBeVisible();
  });

  test("Static Next.js bundle assets load without 404", async ({ page }) => {
    const failedAssets: string[] = [];

    page.on("response", (resp) => {
      if (resp.status() >= 400 && resp.url().includes("/_next/static")) {
        failedAssets.push(`${resp.status()}: ${resp.url()}`);
      }
    });

    await page.goto(BASE_URL, { waitUntil: "load" });
    expect(failedAssets).toEqual([]);
  });

  test("Platform responds with HTTP 200 on direct API ping", async ({ request }) => {
    const response = await request.get(BASE_URL);
    expect(response.status()).toBe(200);
  });
});
