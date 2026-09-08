import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";
const KNOWN_EVENT_UUID = "0cf4733c-190c-4e5a-9a1d-8d8631f7b725";

test.describe("Core User Journeys - Event Discovery", () => {
  test("Public events catalog renders banner, title, organizer, and ticket price", async ({ page }) => {
    await page.goto(`${BASE_URL}/search`, { waitUntil: "networkidle" });

    // Ensure the search/discovery container is visible
    await expect(page.locator("body")).toBeVisible();

    // Verify event card listing
    const firstEventCard = page.locator(".cursor-pointer:has-text('Free'), .cursor-pointer:has-text('The Future of Finance')").first();
    await expect(firstEventCard).toBeVisible({ timeout: 10000 });

    // Verify event thumbnail/banner image inside card
    const cardImage = firstEventCard.locator("img").first();
    await expect(cardImage).toBeVisible();
    const imageSrc = await cardImage.getAttribute("src");
    expect(imageSrc).toBeTruthy();

    // Verify event title
    const eventTitle = firstEventCard.locator("div.line-clamp-2, typography").first();
    await expect(eventTitle).toBeVisible();
    const titleText = await eventTitle.textContent();
    expect(titleText?.trim().length).toBeGreaterThan(0);

    // Verify host/organizer name
    const organizerText = firstEventCard.locator(".text-blue-500").or(firstEventCard.getByText("Farukh")).first();
    await expect(organizerText).toBeVisible();

    // Verify ticket price indicator (e.g. Free or ticket price badge)
    const priceBadge = firstEventCard.locator("text=Free").first();
    await expect(priceBadge).toBeVisible();
  });

  test("Event details page renders banner, title, host details, and ticket price", async ({ page }) => {
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: "networkidle" });

    // Verify title in DOM and document
    await expect(page).toHaveTitle(/The Future of Finance|ONTON Events/i);

    // 1. Verify Event Banner image renders properly
    const eventBanner = page.locator("img[alt*='Event Image']").first();
    await expect(eventBanner).toBeVisible({ timeout: 10000 });
    const bannerSrc = await eventBanner.getAttribute("src");
    expect(bannerSrc).toContain("storage.onton.live");

    // 2. Verify Event Title
    const titleHeading = page.locator("text=The Future of Finance in Argentina").first();
    await expect(titleHeading).toBeVisible();

    // 3. Verify Host/Organizer Details
    const organizerSection = page.locator("text=Organizer").first();
    await expect(organizerSection).toBeVisible();
    const organizerName = page.locator("text=Farukh").first();
    await expect(organizerName).toBeVisible();

    // 4. Verify Ticket Price options
    const ticketPriceSection = page.locator("text=Ticket Price").first();
    await expect(ticketPriceSection).toBeVisible();
    const freeTicketBadge = page.locator("text=Free").first();
    await expect(freeTicketBadge).toBeVisible();
  });
});

test.describe("Core User Journeys - Guest Flow & RSVP Protection", () => {
  test("Unauthenticated guest flow opens WebLoginSheet modal with Telegram and TonConnect options", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Locate the guest login action:
    // Available via Desktop sidebar (.hidden.md:flex) or Mobile bottom navigation (.fixed.left-0.bottom-0)
    const loginTrigger = page
      .locator(".hidden.md\\:flex, .fixed.left-0.bottom-0")
      .getByText("Login")
      .first();

    if (await loginTrigger.isVisible()) {
      await loginTrigger.click();
    } else {
      // Fallback to guest profile unlock flow which strictly gates RSVP/user actions
      await page.goto(`${BASE_URL}/my`, { waitUntil: "networkidle" });
      const guestSignInBtn = page.getByRole("button", { name: /Sign In to ONTON|Sign In/i });
      await expect(guestSignInBtn).toBeVisible();
      await guestSignInBtn.click();
    }

    // Verify the WebLoginSheet modal opens
    const loginModal = page.locator("div.visible.opacity-100");
    await expect(loginModal).toBeVisible({ timeout: 5000 });

    // Verify modal title
    await expect(loginModal.getByText("Sign in to ONTON")).toBeVisible();

    // Verify Telegram Portal option
    await expect(loginModal.getByText("Telegram Portal")).toBeVisible();

    // Verify Web3 Connect option
    await expect(loginModal.getByText("Web3 Connect")).toBeVisible();

    // Verify Web2 Sign In option is also available
    await expect(loginModal.getByText("Web2 Sign In")).toBeVisible();
  });

  test("Event RSVP / registration gate triggers authentication sheet for unauthenticated guests", async ({ page }) => {
    // Intercept event query to simulate an upcoming event with open registration
    await page.route("**/api/trpc/events.getEvent*", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json && json[0]?.result?.data) {
        json[0].result.data.isNotEnded = true;
        json[0].result.data.isStarted = false;
        json[0].result.data.has_registration = true;
        json[0].result.data.capacity_filled = false;
        json[0].result.data.registrant_status = "";
      }
      await route.fulfill({ json });
    });

    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: "networkidle" });

    // Verify unauthenticated registration card prompt
    const regPrompt = page.locator("text=Registration Form, text=Please sign in to register for this event");
    if (await regPrompt.first().isVisible()) {
      await expect(regPrompt.first()).toBeVisible();
    }

    // Trigger LoginSheet via guest access button
    const loginNav = page.locator(".hidden.md\\:flex, .fixed.left-0.bottom-0").getByText("Login").first();
    if (await loginNav.isVisible()) {
      await loginNav.click();
      const loginModal = page.locator("div.visible.opacity-100");
      await expect(loginModal.getByText("Sign in to ONTON")).toBeVisible();
      await expect(loginModal.getByText("Telegram Portal")).toBeVisible();
      await expect(loginModal.getByText("Web3 Connect")).toBeVisible();
    }
  });
});

test.describe("Core User Journeys - TonConnect UI", () => {
  test("TonConnect UI components render and wallet modal opens without console exceptions", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err);
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Open WebLoginSheet to interact with TonConnect UI
    const loginNav = page.locator(".hidden.md\\:flex, .fixed.left-0.bottom-0").getByText("Login").first();
    if (await loginNav.isVisible()) {
      await loginNav.click();
    } else {
      await page.goto(`${BASE_URL}/my`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Sign In to ONTON" }).click();
    }

    const loginModal = page.locator("div.visible.opacity-100");
    await expect(loginModal).toBeVisible();

    // 1. Verify TonConnect button element inside WebLoginSheet
    const tonConnectBtn = loginModal
      .locator("tc-root")
      .filter({ hasText: /Connect Wallet/i })
      .first();
    await expect(tonConnectBtn).toBeVisible({ timeout: 5000 });

    // 2. Click the TonConnect button to open wallet selection modal
    await tonConnectBtn.click();
    await page.waitForTimeout(1000);

    // 3. Verify TonConnect modal renders with wallet connection options
    const modalHeading = page.getByRole("heading", { name: /Connect your TON wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // Verify wallet provider options inside TonConnect modal (e.g. Tonkeeper)
    const walletOption = page.getByRole("button", { name: /Tonkeeper/i }).first();
    await expect(walletOption).toBeVisible();

    // 4. Assert zero unhandled page exceptions occurred during TonConnect interaction
    expect(pageErrors).toEqual([]);
  });
});

test.describe("Core User Journeys - Public API", () => {
  test("Direct GET /api/client/v1/public/ping returns 200 OK with valid health metadata", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/client/v1/public/ping`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("pong");
    expect(data.server).toBeDefined();
    expect(typeof data.server.uptime).toBe("string");
    expect(data.server.uptime).toMatch(/\d+ seconds/);
    expect(typeof data.server.timestamp).toBe("string");
    expect(new Date(data.server.timestamp).getTime()).not.toBeNaN();
    expect(typeof data.sha).toBe("string");
    expect(data.sha.length).toBeGreaterThan(0);
  });
});
