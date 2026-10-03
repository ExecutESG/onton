import { test, expect } from "@playwright/test";
import { generateTonTestWallet } from "./helpers/headless-ton-wallet";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";
const TARGET_EVENT_UUID = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";

test.describe("SBT Engine End-to-End Lifecycle Suite", () => {
  test.describe.configure({ mode: "serial" });

  // We share a test wallet across sequential steps within the lifecycle flow
  const testWallet = generateTonTestWallet();
  let mintedItemAddress: string = "";
  let mintedItemIndex: number = 0;

  test("Step 1: Query sbt.getEventCollection returns valid on-chain SBT collection", async ({ request }) => {
    const input = encodeURIComponent(JSON.stringify({ "0": { eventUuid: TARGET_EVENT_UUID } }));
    const response = await request.get(`${BASE_URL}/api/trpc/sbt.getEventCollection?batch=1&input=${input}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body[0]).toBeDefined();
    const collection = body[0]?.result?.data?.collection;
    expect(collection).toBeDefined();
    expect(collection.eventUuid).toBe(TARGET_EVENT_UUID);
    expect(collection.collectionAddress).toMatch(/^(EQ|UQ|0:)/);
    expect(collection.status).toBe("active");
    expect(collection.name).toContain("MOMIS Memory Tournament");
  });

  test("Step 2: Dispatch sbt.mintBadge successfully issues soulbound credential to attendee", async ({ request }) => {
    const badgePayload = {
      "0": {
        eventUuid: TARGET_EVENT_UUID,
        walletAddress: testWallet.rawAddress,
        badgeTitle: `E2E Automated Attendance Badge #${Date.now()}`,
        badgeDescription: "Verified Proof of Attendance issued by ONTON Automated Lifecycle Suite",
        attributes: [
          { trait_type: "Attendance", value: "Verified" },
          { trait_type: "Test Run", value: new Date().toISOString() },
        ],
      },
    };

    const response = await request.post(`${BASE_URL}/api/trpc/sbt.mintBadge?batch=1`, {
      data: badgePayload,
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[0]).toBeDefined();
    expect(body[0]?.result?.data?.success).toBe(true);

    const item = body[0]?.result?.data?.item;
    expect(item).toBeDefined();
    expect(item.recipientWalletAddress).toBe(testWallet.rawAddress);
    expect(item.status).toBe("minted");
    expect(item.itemAddress).toMatch(/^(EQ|UQ|0:)/);
    expect(item.metadataUrl).toBeDefined();
    expect(typeof item.itemIndex).toBe("number");

    mintedItemAddress = item.itemAddress;
    mintedItemIndex = item.itemIndex;
  });

  test("Step 3: Query sbt.getWalletBadges returns newly minted badge in attendee credentials", async ({ request }) => {
    const input = encodeURIComponent(JSON.stringify({ "0": { walletAddress: testWallet.rawAddress } }));
    const response = await request.get(`${BASE_URL}/api/trpc/sbt.getWalletBadges?batch=1&input=${input}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body[0]).toBeDefined();
    const badges = body[0]?.result?.data?.badges;
    expect(Array.isArray(badges)).toBe(true);
    expect(badges.length).toBeGreaterThanOrEqual(1);

    const foundBadge = badges.find((b: { itemAddress: string }) => b.itemAddress === mintedItemAddress);
    expect(foundBadge).toBeDefined();
    expect(foundBadge.status).toBe("minted");
    expect(foundBadge.recipientWalletAddress).toBe(testWallet.rawAddress);
  });

  test("Step 4: Query sbt.verifyOwnership cryptographically validates attendee credential ownership", async ({ request }) => {
    // 4A: Positive verification for attendee who owns the minted badge
    const inputValid = encodeURIComponent(
      JSON.stringify({
        "0": {
          walletAddress: testWallet.rawAddress,
          eventUuid: TARGET_EVENT_UUID,
        },
      })
    );
    const responseValid = await request.get(`${BASE_URL}/api/trpc/sbt.verifyOwnership?batch=1&input=${inputValid}`);
    expect(responseValid.status()).toBe(200);

    const bodyValid = await responseValid.json();
    expect(bodyValid[0]).toBeDefined();
    const resultValid = bodyValid[0]?.result?.data;
    expect(resultValid).toBeDefined();
    expect(resultValid.isOwner).toBe(true);
    expect(resultValid.sbtItem).toBeDefined();
    expect(resultValid.sbtItem.recipientWalletAddress).toBe(testWallet.rawAddress);
    expect(resultValid.sbtItem.itemAddress).toBe(mintedItemAddress);

    // 4B: Negative verification for uncredentialed address
    const nonHolderWallet = generateTonTestWallet();
    const inputInvalid = encodeURIComponent(
      JSON.stringify({
        "0": {
          walletAddress: nonHolderWallet.rawAddress,
          eventUuid: TARGET_EVENT_UUID,
        },
      })
    );
    const responseInvalid = await request.get(`${BASE_URL}/api/trpc/sbt.verifyOwnership?batch=1&input=${inputInvalid}`);
    expect(responseInvalid.status()).toBe(200);

    const bodyInvalid = await responseInvalid.json();
    expect(bodyInvalid[0]).toBeDefined();
    const resultInvalid = bodyInvalid[0]?.result?.data;
    expect(resultInvalid.isOwner).toBe(false);
    expect(resultInvalid.sbtItem).toBeNull();
  });
});
