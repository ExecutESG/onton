import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("SBT Engine API & Endpoint Tests", () => {
  test("Client API Public Ping responds with HTTP 200", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/client/v1/public/ping`);
    expect(response.status()).toBe(200);
  });

  test("tRPC batch query interface is responsive", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/trpc/config.getConfig?batch=1&input=%7B%7D`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test("TonProof payload generation is responsive", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/ton-proof/generate-payload`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data?.payload).toBeDefined();
  });
});
