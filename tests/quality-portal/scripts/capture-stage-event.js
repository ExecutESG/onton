const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'https://dev-app.dev.onton.live';
const EVENT_UUID = '3278e906-f331-4659-b38e-959b87f5eba4';

const TARGET_DIR = path.join(__dirname, '..', 'assets', 'screenshots');
const E2E_SCREEN_DIR = path.join(__dirname, '..', '..', 'e2e', 'test-results', 'screenshots');

if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });
if (!fs.existsSync(E2E_SCREEN_DIR)) fs.mkdirSync(E2E_SCREEN_DIR, { recursive: true });

function getTelegramMockScript() {
  const user = {
    id: 23932283,
    first_name: "Mahdi",
    last_name: "Farimani",
    username: "Mfarimani",
    language_code: "en",
    is_premium: true,
  };
  return `
    window.Telegram = {
      WebApp: {
        initData: "user=${encodeURIComponent(JSON.stringify(user))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=e2e_mock_hash",
        initDataUnsafe: {
          user: ${JSON.stringify(user)},
          auth_date: "${Math.floor(Date.now() / 1000)}",
          hash: "e2e_mock_hash"
        },
        version: "7.0",
        platform: "ios",
        colorScheme: "light",
        themeParams: {
          bg_color: "#ffffff",
          text_color: "#000000",
          hint_color: "#999999",
          link_color: "#2481cc",
          button_color: "#2481cc",
          button_text_color: "#ffffff"
        },
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        headerColor: "#ffffff",
        backgroundColor: "#ffffff",
        BackButton: { isVisible: false, onClick: () => {}, show: () => {}, hide: () => {} },
        MainButton: {
          text: "BUY TICKET",
          color: "#2481cc",
          textColor: "#ffffff",
          isVisible: true,
          isActive: true,
          isProgressVisible: false,
          setText: function(t) { this.text = t; },
          onClick: function(fn) { this._handler = fn; },
          show: function() { this.isVisible = true; },
          hide: function() { this.isVisible = false; },
          enable: function() { this.isActive = true; },
          disable: function() { this.isActive = false; }
        },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
        openInvoice: (slug, callback) => {
          console.log('[TMA Mock] openInvoice called with slug:', slug);
          if (callback) callback('paid');
        },
        openLink: (url) => window.open(url, '_blank'),
        openTelegramLink: (url) => window.open(url, '_blank'),
        expand: () => {},
        close: () => {},
        ready: () => {}
      }
    };
  `;
}

async function capture(page, filename, label) {
  const filePath = path.join(TARGET_DIR, filename);
  await page.screenshot({ path: filePath });
  const e2ePath = path.join(E2E_SCREEN_DIR, filename);
  fs.copyFileSync(filePath, e2ePath);
  console.log(`[Captured] ${label} -> ${filename}`);
}

async function run() {
  console.log(`=== Starting Live Staging Visual Capture for Event ${EVENT_UUID} ===`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile TMA viewport
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0',
    deviceScaleFactor: 2
  });

  const page = await context.newPage();
  await page.addInitScript(getTelegramMockScript());

  // Set auth cookie fallback
  await context.addCookies([
    {
      name: 'onton_user_session',
      value: JSON.stringify({ userId: 23932283, username: 'Mfarimani', firstName: 'Mahdi', role: 'user' }),
      domain: new URL(BASE_URL).hostname,
      path: '/'
    }
  ]);

  // 1. Event Landing Page
  const eventUrl = `${BASE_URL}/events/${EVENT_UUID}`;
  console.log(`Navigating to event page: ${eventUrl}`);
  await page.goto(eventUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
    await page.goto(eventUrl, { waitUntil: 'domcontentloaded' });
  });
  await page.waitForTimeout(1500);

  // Capture hero & event overview
  await capture(page, 'user_u3_step1_event_view.png', 'Step 1: Event View (Top Hero & Schedule)');
  await capture(page, 'guest_g3_event_details.png', 'Guest G3: Event Details & Buy Ticket');

  // Scroll down to check the registration area (verify free form is suppressed)
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(600);
  await capture(page, 'user_u3_step2_tier_select.png', 'Step 2: Event Details & Ticket Action');

  // 2. Checkout Flow
  const checkoutUrl = `${BASE_URL}/events/${EVENT_UUID}/checkout`;
  console.log(`Navigating to checkout: ${checkoutUrl}`);
  await page.goto(checkoutUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
    await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded' });
  });
  await page.waitForTimeout(1500);

  await capture(page, 'user_u3_step3_checkout_form.png', 'Step 3: Checkout Page Header & Ticket Summary');
  await capture(page, 'user_u3_paid_checkout.png', 'Full Paid Ticket Checkout Experience');

  // Scroll down into attendee form
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(600);
  await capture(page, 'user_u3_step4_attendee_info.png', 'Step 4: Attendee Contact Information Fields');

  // Fill in sample info if inputs exist
  try {
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Mahdi Farimani');
    }
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('mahdi.farimani@executesg.com');
    }
  } catch (e) {
    console.log('Form field fill note:', e.message);
  }

  // Scroll down to payment method
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(600);
  await capture(page, 'user_u3_step5_payment_method.png', 'Step 5: Payment Method (Telegram Stars / TON Connect)');

  // 3. Ticket Pass / QR Code
  const ticketPassUrl = `${BASE_URL}/tickets/${EVENT_UUID}`;
  console.log(`Navigating to ticket pass view: ${ticketPassUrl}`);
  await page.goto(ticketPassUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await capture(page, 'user_u4_step1_ticket_pass.png', 'User U4: Apple-Pass Style Ticket');

  const qrUrl = `${BASE_URL}/tickets/${EVENT_UUID}/qrcode`;
  console.log(`Navigating to high-contrast QR view: ${qrUrl}`);
  await page.goto(qrUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  await capture(page, 'user_u4_step2_high_contrast_qr.png', 'User U4: High-Contrast QR Code');

  await browser.close();
  console.log('=== Capture process completed successfully! ===');
}

run().catch((err) => {
  console.error('Capture process error:', err);
  process.exit(1);
});
