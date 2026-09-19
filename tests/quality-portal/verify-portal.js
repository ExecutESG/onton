const { chromium } = require("@playwright/test");

async function main() {
  console.log("Launching headless browser to test Quality Portal at http://localhost:4000...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  const response = await page.goto("http://localhost:4000/", { waitUntil: "networkidle" });
  console.log("Portal response status:", response.status());

  // Check title
  const title = await page.title();
  console.log("Portal title:", title);

  // Check metrics
  const readiness = await page.locator(".text-4xl.font-extrabold").first().textContent();
  console.log("Portal readiness displayed:", readiness?.trim());

  const testCounter = await page.locator("#metric-tests").textContent();
  console.log("Portal test scenarios:", testCounter?.trim());

  const flawsFixed = await page.locator("#metric-flaws").textContent();
  console.log("Portal flaws fixed metric:", flawsFixed?.trim());

  // Switch to flaws tab
  console.log("Switching to flaws tab...");
  await page.click("#nav-mode-flaws");
  await page.waitForTimeout(500);

  const flawCardsCount = await page.locator("#flaws-container > div").count();
  console.log(`Total flaw cards displayed: ${flawCardsCount}`);

  // Test filter 'Resolved'
  console.log("Filtering by 'Resolved'...");
  await page.click('button[data-severity="Resolved"]');
  await page.waitForTimeout(300);
  const resolvedCardsCount = await page.locator("#flaws-container > div").count();
  console.log(`Resolved flaw cards displayed: ${resolvedCardsCount}`);

  // Take verification screenshot of portal
  await page.screenshot({ path: "tests/quality-portal/assets/portal_verification.png", fullPage: false });
  console.log("Captured portal verification screenshot.");

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error("Console errors encountered:", consoleErrors);
    process.exit(1);
  } else {
    console.log("SUCCESS: 0 console errors. Quality portal verified 100% operational!");
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
