import { test, expect } from "@playwright/test";
import {
  generateTonTestWallet,
  createTonProofSignature,
  injectHeadlessTonWallet,
} from "./helpers/headless-ton-wallet";
import { injectTelegramMock } from "./helpers/telegram-mock";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("Web3 TonConnect & Cryptographic Verification Suite", () => {
  test("Test 1: Live Cryptographic TonProof Verification with Backend", async ({ request }) => {
    // 1. Request cryptographic challenge payload from backend
    const payloadRes = await request.get(`${BASE_URL}/api/v1/ton-proof/generate-payload`);
    expect(payloadRes.status()).toBe(200);
    const payloadJson = await payloadRes.json();
    expect(payloadJson?.payload).toBeDefined();
    const challengePayload = payloadJson.payload;

    // 2. Generate a real TON V4R2 wallet keypair
    const wallet = generateTonTestWallet();

    // 3. Create a real Ed25519 TonProof signature
    const proof = await createTonProofSignature(
      wallet.rawAddress,
      wallet.keyPair,
      challengePayload,
      new URL(BASE_URL).hostname
    );

    // 4. Submit to backend /check-proof
    const checkReq = {
      address: wallet.rawAddress,
      network: "-3",
      public_key: wallet.publicKeyHex,
      proof: {
        timestamp: proof.timestamp,
        domain: proof.domain,
        payload: proof.payload,
        signature: proof.signature,
        state_init: wallet.stateInitBase64,
      },
    };

    const checkRes = await request.post(`${BASE_URL}/api/v1/ton-proof/check-proof`, {
      data: checkReq,
      headers: { "Content-Type": "application/json" },
    });

    expect(checkRes.status()).toBe(200);
    const checkJson = await checkRes.json();
    expect(checkJson?.token).toBeDefined();
    expect(typeof checkJson.token).toBe("string");
    console.log("✅ Live TonProof verified successfully by backend. Issued JWT Token:", checkJson.token.slice(0, 35) + "...");
  });

  test("Test 2: Headless Tonkeeper Injected Wallet Discovery in Browser", async ({ page }) => {
    // 1. Inject Headless Tonkeeper provider into the page
    const walletSession = await injectHeadlessTonWallet(page, {
      domain: new URL(BASE_URL).hostname,
      network: "-3",
    });

    // 2. Navigate to Mini-App homepage
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // 3. Verify in-page injection succeeded
    const isWalletInjected = await page.evaluate(() => {
      // @ts-ignore
      return !!(window.tonkeeper && window.tonkeeper.tonconnect);
    });
    expect(isWalletInjected).toBe(true);

    // 4. Open Login Sheet
    const loginTrigger = page.locator(".hidden.md\\:flex, .fixed.left-0.bottom-0").getByText("Login").first();
    if (await loginTrigger.isVisible()) {
      await loginTrigger.click();
    } else {
      await page.goto(`${BASE_URL}/my`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Sign In/i }).first().click();
    }

    const loginModal = page.locator("div.visible.opacity-100").first();
    await expect(loginModal).toBeVisible();

    // 5. Verify TonConnect button is rendered
    const tonConnectBtn = loginModal.locator("tc-root").first();
    await expect(tonConnectBtn).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test-results/screenshots/web3_step1_login_sheet.png" });

    // 6. Click TonConnect to open the provider selection
    await tonConnectBtn.click();
    const modalHeading = page.getByRole("heading", { name: /Connect your TON wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "test-results/screenshots/web3_step2_tonconnect_modal.png" });

    // 7. Verify Tonkeeper is visible in the wallet list
    const tonkeeperEntry = page.locator("text=Tonkeeper").first();
    await expect(tonkeeperEntry).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/web3_step3_tonkeeper_detected.png" });
    console.log("✅ Headless Tonkeeper successfully detected by @tonconnect/ui in browser DOM");
  });

  test("Test 3: Headless Tonkeeper Direct Connect Execution", async ({ page }) => {
    // 1. Inject Headless Tonkeeper provider
    const walletSession = await injectHeadlessTonWallet(page, {
      domain: new URL(BASE_URL).hostname,
      network: "-3",
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // 2. Direct connect invocation via in-browser JS bridge
    const connectResult = await page.evaluate(async () => {
      // @ts-ignore
      const bridge = window.tonkeeper.tonconnect;
      return await bridge.connect(2, {
        manifestUrl: "https://storage.onton.live/onton/onton_manifest.json",
        items: [
          { name: "ton_addr" },
          { name: "ton_proof", payload: "live_e2e_headless_test" },
        ],
      });
    });

    expect(connectResult.event).toBe("connect");
    expect(connectResult.payload.items.length).toBeGreaterThanOrEqual(1);
    expect(connectResult.payload.items[0].address).toBe(walletSession.rawAddress);
    expect(connectResult.payload.device.appName).toBe("Tonkeeper");

    console.log("✅ Direct Connect Execution Succeeded for:", walletSession.rawAddress);
    await page.screenshot({ path: "test-results/screenshots/web3_step4_connected_state.png" });
  });
});
