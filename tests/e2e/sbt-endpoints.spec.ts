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

  test("tRPC sbt.getEventCollection responds with valid data structure", async ({ request }) => {
    const input = encodeURIComponent(JSON.stringify({ "0": { eventUuid: "test-event-uuid" } }));
    const response = await request.get(`${BASE_URL}/api/trpc/sbt.getEventCollection?batch=1&input=${input}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[0]).toBeDefined();
    expect(body[0]?.result?.data?.collection).toBeNull(); // non-existent event returns null collection cleanly
  });

  test("tRPC sbt.getWalletBadges responds with array of badges", async ({ request }) => {
    const input = encodeURIComponent(JSON.stringify({ "0": { walletAddress: "0:0000000000000000000000000000000000000000000000000000000000000000" } }));
    const response = await request.get(`${BASE_URL}/api/trpc/sbt.getWalletBadges?batch=1&input=${input}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[0]).toBeDefined();
    expect(Array.isArray(body[0]?.result?.data?.badges)).toBe(true);
  });

  test("tRPC sbt.getUserBadges responds with array of badges for a user", async ({ request }) => {
    const input = encodeURIComponent(JSON.stringify({ "0": { userId: 987654321 } }));
    const response = await request.get(`${BASE_URL}/api/trpc/sbt.getUserBadges?batch=1&input=${input}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[0]).toBeDefined();
    expect(Array.isArray(body[0]?.result?.data?.badges)).toBe(true);
  });

  test("tRPC sbt.verifyOwnership returns valid shape for non-holder check", async ({ request }) => {
    const input = encodeURIComponent(
      JSON.stringify({
        "0": {
          walletAddress: "0:0000000000000000000000000000000000000000000000000000000000000000",
          eventUuid: "4b287361-a06f-43dd-87c1-2d3a68f99fa7",
        },
      })
    );
    const response = await request.get(`${BASE_URL}/api/trpc/sbt.verifyOwnership?batch=1&input=${input}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[0]).toBeDefined();
    const result = body[0]?.result?.data;
    expect(result).toBeDefined();
    expect(result.isOwner).toBe(false);
    expect(result.sbtItem).toBeNull();
    expect(result.onChainVerified).toBe(false);
  });
});

