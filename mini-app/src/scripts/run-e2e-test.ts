import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function run() {
  console.log("Launching Playwright...");
  const browser = await chromium.launch({ headless: true });
  
  // Set up artifacts directory
  const artifactsDir = "/Users/mahdifarimani/.gemini/antigravity/brain/b689b14f-98e1-40f2-a132-aebf7727e79d";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Create context with video recording
  const context = await browser.newContext({
    recordVideo: {
      dir: artifactsDir,
      size: { width: 1280, height: 800 }
    },
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { timeout: 120000 });

  console.log("Waiting for Login button in sidebar to become visible...");
  const loginBtn = page.locator('.hidden.md\\:flex').getByText('Login');
  await loginBtn.waitFor({ state: 'visible', timeout: 60000 });

  // 1. Desktop View Screenshot
  const desktopScreenshot = path.join(artifactsDir, "screenshot_desktop.png");
  await page.screenshot({ path: desktopScreenshot });
  console.log(`Saved desktop view screenshot to ${desktopScreenshot}`);

  // 2. Click Login button in sidebar
  console.log("Clicking Login in sidebar...");
  await loginBtn.click();
  await page.waitForTimeout(1000);

  // 3. Take screenshot of login modal on desktop
  const desktopLoginScreenshot = path.join(artifactsDir, "screenshot_login_desktop.png");
  await page.screenshot({ path: desktopLoginScreenshot });
  console.log(`Saved desktop login modal screenshot to ${desktopLoginScreenshot}`);

  // Dismiss modal
  console.log("Dismissing modal...");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Close desktop context to save its video
  await context.close();

  // Now create a mobile context to test responsive design
  console.log("Initializing mobile context...");
  const mobileContext = await browser.newContext({
    recordVideo: {
      dir: artifactsDir,
      size: { width: 375, height: 812 }
    },
    viewport: { width: 375, height: 812 }
  });
  const mobilePage = await mobileContext.newPage();

  console.log("Navigating to http://localhost:3000 on mobile...");
  await mobilePage.goto("http://localhost:3000", { timeout: 120000 });
  console.log("Waiting for Login button in bottom navigation to become visible...");
  const mobileLoginBtn = mobilePage.locator('.fixed.left-0.bottom-0').getByText('Login');
  await mobileLoginBtn.waitFor({ state: 'visible', timeout: 60000 });

  // 4. Mobile View Screenshot
  const mobileScreenshot = path.join(artifactsDir, "screenshot_mobile.png");
  await mobilePage.screenshot({ path: mobileScreenshot });
  console.log(`Saved mobile view screenshot to ${mobileScreenshot}`);

  // 5. Click Login in bottom nav
  console.log("Clicking Login in mobile bottom navigation...");
  await mobileLoginBtn.click();
  await mobilePage.waitForTimeout(1000);

  // 6. Mobile Login Modal Screenshot
  const mobileLoginScreenshot = path.join(artifactsDir, "screenshot_login_mobile.png");
  await mobilePage.screenshot({ path: mobileLoginScreenshot });
  console.log(`Saved mobile login modal screenshot to ${mobileLoginScreenshot}`);

  await mobileContext.close();
  await browser.close();
  console.log("Browser closed successfully.");
}

run().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
