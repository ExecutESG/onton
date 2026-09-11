import { Page } from "@playwright/test";

export interface UserSessionConfig {
  userId?: number;
  username?: string;
  firstName?: string;
  role?: "user" | "organizer" | "admin";
  wallet?: string;
  points?: number;
}

export async function setupUserTRPCMocks(page: Page, config: UserSessionConfig = {}) {
  const user = {
    user_id: config.userId || 987654321,
    username: config.username || "ontontester",
    first_name: config.firstName || "Onton",
    last_name: "Tester",
    language_code: "en",
    role: config.role || "user",
    wallet_address: config.wallet || "EQBvW8Z5huBkMJYdn3BaXTv8AqnyuvKMO-snjwOOY44",
    photo_url: "https://storage.onton.live/onton/default_avatar.png",
    points: config.points ?? 12500,
    has_blocked_the_bot: false,
    participated_event_count: 3,
    hosted_event_count: config.role === "organizer" || config.role === "admin" ? 5 : 0,
    created_at: new Date().toISOString(),
  };

  await page.route("**/api/trpc/*", async (route) => {
    const url = route.request().url().toLowerCase();

    // 1. Sync User (single httpLink returns object, not array)
    if (url.includes("users.syncuser")) {
      await route.fulfill({
        json: {
          result: {
            data: user,
          },
        },
      });
      return;
    }

    // 2. User Roles / Admin check
    if (url.includes("users.haveaccesstoeventadministration")) {
      await route.fulfill({
        json: {
          result: {
            data: {
              valid: user.role === "admin" || user.role === "organizer",
              role: user.role,
              user,
            },
          },
        },
      });
      return;
    }

    // 3. Wallet
    if (url.includes("users.getwallet")) {
      await route.fulfill({
        json: {
          result: {
            data: user.wallet_address,
          },
        },
      });
      return;
    }

    // 4. Points / Score
    if (url.includes("usersscore.gettotalscorebyuserid")) {
      await route.fulfill({
        json: {
          result: {
            data: user.points,
          },
        },
      });
      return;
    }

    // Pass through all other tRPC requests
    await route.continue();
  });
}
