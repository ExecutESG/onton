const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'https://app.dev.onton.live';
const TARGET_DIR = path.join(__dirname, '..', 'assets', 'screenshots');

async function captureStep(page, filename, label) {
  const filePath = path.join(TARGET_DIR, filename);
  await page.screenshot({ path: filePath });
  console.log(`Saved [${label}]: ${filePath}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Inject Telegram WebApp mock
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "user=%7B%22id%22%3A987654321%2C%22first_name%22%3A%22TON%22%2C%22last_name%22%3A%22Organizer%22%2C%22username%22%3A%22tonorganizer%22%7D",
        initDataUnsafe: { user: { id: 987654321, first_name: "TON", username: "tonorganizer" } },
        colorScheme: "light",
        themeParams: { bg_color: "#ffffff", text_color: "#000000" },
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        BackButton: { isVisible: false, show: () => {}, hide: () => {}, onClick: () => {} },
        MainButton: { text: "CONTINUE", isVisible: true, show: () => {}, hide: () => {}, onClick: () => {} },
        ready: () => {},
        expand: () => {},
        close: () => {},
      }
    };
  });

  console.log("Capturing FLOW-O2F: Zero-Friction Open Online Global AMA & Keynote...");
  await page.goto(`${BASE_URL}/events/create`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Clean any modal backdrops
  await page.evaluate(() => {
    document.querySelectorAll('.myDialog, .fixed.inset-0.bg-black').forEach(el => el.remove());
  });

  // Step 1: Online All-Hands Meta & Poster
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-gray-900">Broadcast Title & Visuals</h3>
              <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">Livestream</span>
            </div>
            <img src="https://storage.onton.live/onton/ton_hacker_house_dubai.png" class="w-full h-44 object-cover rounded-xl shadow-md" />
            <div>
              <label class="text-xs font-semibold text-gray-600">Event Title</label>
              <input type="text" value="TON Global Ecosystem All-Hands & Keynote" class="w-full mt-1 px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Format</label>
              <input type="text" value="Online Livestream & Open Community AMA" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step1_online_meta.png', 'O2F.1 Keynote title & poster');
  await captureStep(page, 'organizer_o2f_cover.png', 'O2F Cover: Zero-Friction Online Event');

  // Step 2: Stream Embed & Destination
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Livestream Destination</h3>
            <div>
              <label class="text-xs font-semibold text-gray-600">Telegram Live Stream Channel / Video URL</label>
              <input type="text" value="https://t.me/toncommunity?livestream" class="w-full mt-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl text-blue-600" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Schedule & Timezone</label>
              <input type="text" value="Thu, Oct 29, 2026 04:00 PM - 06:00 PM UTC" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step2_stream_embed.png', 'O2F.2 Stream destination & schedule');

  // Step 3: Zero-Friction Open Participation
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Zero-Friction Access Model</h3>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-blue-900">Open Public Access</span>
                <span class="px-2 py-0.5 bg-blue-600 text-white font-bold rounded-full text-[10px]">Zero Barriers</span>
              </div>
              <p class="text-[11px] text-blue-700">No wallet required · No KYC · No questionnaires · 100% Free</p>
            </div>
            <div class="flex justify-between items-center text-xs text-gray-600 pt-1">
              <span>Audience Capacity:</span>
              <span class="font-bold text-gray-900">Unlimited Global Viewers</span>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step3_zero_friction_access.png', 'O2F.3 Zero-friction participation');

  // Step 4: 1-Tap Calendar Sync Configuration
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Calendar Sync & Reminder Setup</h3>
            <p class="text-xs text-gray-500">Enable 1-tap calendar sync with auto-generated .ics link.</p>
            <div class="space-y-2">
              <div class="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <span class="font-medium text-gray-800">Apple / Google Calendar (.ics)</span>
                <span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded-full">Auto-generated</span>
              </div>
              <div class="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <span class="font-medium text-gray-800">Bot 15-min Broadcast Ping</span>
                <span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded-full">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step4_calendar_sync.png', 'O2F.4 Calendar sync configuration');

  // Step 5: Published AMA View with Direct Join CTA
  await page.goto(`${BASE_URL}/events/0cf4733c-190c-4e5a-9a1d-8d8631f7b725`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.querySelectorAll('.myDialog, .fixed.inset-0.bg-black').forEach(el => el.remove());
    const titleEl = document.querySelector('h1, h2, h3');
    if (titleEl) titleEl.textContent = 'TON Global Ecosystem All-Hands & Product Keynote';
    const btn = document.querySelector('button');
    if (btn) {
      btn.textContent = '▶ Join Livestream (Open Access)';
      btn.className = 'w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg';
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step5_published_ama.png', 'O2F.5 Published open online event');

  await browser.close();
  console.log("FLOW-O2F visual capture complete.");
}

run().catch(console.error);
