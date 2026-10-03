import { test, expect } from "@playwright/test";
import { Address } from "../../mini-app/node_modules/@ton/ton";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";
const TARGET_EVENT_UUID = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";
const TESTNET_TONCENTER_V2 = "https://testnet.toncenter.com/api/v2";
const TONCENTER_HEADERS = {
  "X-API-Key": "4fb3c0656555c4f63de82e91f978285e88ea0738389c05365220dee7bdfe1c84",
};

test.describe("SBT On-Chain Verification via TonCenter Suite", () => {
  test.describe.configure({ mode: "serial" });
  let collectionAddress: string = "EQBFz6oNg-5c_qiIdjQZjMHXDEWM2vIKAHR3BJWOh2n4bPBf";

  test.beforeAll(async ({ request }) => {
    try {
      const input = encodeURIComponent(JSON.stringify({ "0": { eventUuid: TARGET_EVENT_UUID } }));
      const response = await request.get(`${BASE_URL}/api/trpc/sbt.getEventCollection?batch=1&input=${input}`);
      if (response.status() === 200) {
        const body = await response.json();
        const col = body[0]?.result?.data?.collection?.collectionAddress;
        if (col) collectionAddress = col;
      }
    } catch {
      // Fallback remains initialized
    }
  });

  test("ON-1: Retrieve SBT collection from dev platform and validate TonAddress format", async ({ request }) => {
    const input = encodeURIComponent(JSON.stringify({ "0": { eventUuid: TARGET_EVENT_UUID } }));
    const response = await request.get(`${BASE_URL}/api/trpc/sbt.getEventCollection?batch=1&input=${input}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const collection = body[0]?.result?.data?.collection;
    expect(collection).toBeDefined();
    expect(collection.collectionAddress).toBeDefined();

    // Verify it is a valid, parseable TON address
    const parsed = Address.parse(collection.collectionAddress);
    expect(parsed.workChain).toBe(0);
    collectionAddress = collection.collectionAddress;
  });

  test("ON-2: Query TonCenter testnet RPC for collection account state", async ({ request }) => {
    test.skip(!collectionAddress, "Collection address not loaded from Step 1");

    const tcResponse = await request.get(
      `${TESTNET_TONCENTER_V2}/getAddressInformation?address=${encodeURIComponent(collectionAddress)}`,
      { headers: TONCENTER_HEADERS }
    );
    expect(tcResponse.status()).toBe(200);

    const tcJson = await tcResponse.json();
    expect(tcJson.ok).toBe(true);
    expect(tcJson.result).toBeDefined();
    expect(tcJson.result["@type"]).toBe("raw.fullAccountState");
    expect(tcJson.result.block_id).toBeDefined();
  });

  test("ON-3: Verify TonCenter testnet network responsiveness and block synchronization", async ({ request }) => {
    const masterResponse = await request.get(`${TESTNET_TONCENTER_V2}/getMasterchainInfo`, {
      headers: TONCENTER_HEADERS,
    });
    expect(masterResponse.status()).toBe(200);

    const masterJson = await masterResponse.json();
    expect(masterJson.ok).toBe(true);
    expect(masterJson.result?.last?.seqno).toBeGreaterThan(0);
    expect(masterJson.result?.last?.workchain).toBe(-1);
  });
});
