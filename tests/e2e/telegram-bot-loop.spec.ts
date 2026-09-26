import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const rawBot = process.env.TELEGRAM_TARGET_BOT || process.env.NEXT_PUBLIC_BOT_USERNAME;
if (!rawBot) {
  throw new Error("No bot configured: TELEGRAM_TARGET_BOT or NEXT_PUBLIC_BOT_USERNAME must be set");
}
const TARGET_BOT = rawBot.startsWith("@") ? rawBot : `@${rawBot}`;
if (TARGET_BOT.toLowerCase() === "@theontonbot" && process.env.NODE_ENV !== "production") {
  throw new Error("Safety violation: attempted to run non-prod tests against production bot @theontonbot");
}
const ADMIN_ID = 7013087032;

function execTgAdmin(args: string): any {
  try {
    const raw = execSync(`tgadmin ${args}`, {
      encoding: "utf-8",
      timeout: 20000,
    });
    return raw.trim();
  } catch (err: any) {
    throw new Error(`tgadmin command failed [${args}]: ${err.message}`);
  }
}

test.describe("MTProto Telegram Bot Interaction Suite (@ontonadmin)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ isMobile }) => {
    test.skip(isMobile, "Run MTProto bot loop tests once on desktop chromium");
  });

  test("TG-1: Verify tgadmin MTProto session is authenticated as @ontonadmin", async () => {
    const statusRaw = execTgAdmin("status --json");
    const status = JSON.parse(statusRaw);

    expect(status.authenticated).toBe(true);
    expect(status.id).toBe(ADMIN_ID);
    expect(status.first_name).toBe("ONTON");
  });

  test("TG-2: Verify dialog listing includes ONTON bot entity", async () => {
    const chatsRaw = execTgAdmin("chats -n 10 --json");
    const chats = JSON.parse(chatsRaw);
    expect(Array.isArray(chats)).toBe(true);

    const ontonDialog = chats.find(
      (c: any) => c.username === "theontonbot" || c.title?.toLowerCase().includes("onton")
    );
    expect(ontonDialog).toBeDefined();
  });

  test("TG-3: Send /start to bot and receive structured welcome payload", async () => {
    // Send /start command
    execTgAdmin(`send "${TARGET_BOT}" "/start"`);

    // Allow 2.5s for bot polling loop to process and reply
    await new Promise((r) => setTimeout(r, 2500));

    const messagesRaw = execTgAdmin(`read "${TARGET_BOT}" -n 3 --json`);
    const messages = JSON.parse(messagesRaw);
    expect(messages.length).toBeGreaterThan(0);

    const incoming = messages.find((m: any) => !m.out);
    expect(incoming).toBeDefined();
    expect(incoming.text).toContain("Welcome to ONTON");
    expect(incoming.text).toContain("1-Tap Free RSVP");
    expect(incoming.text).toContain("Telegram Stars & Crypto");
  });

  test("TG-4: Send /start with valid event deep link parameter", async () => {
    const eventUuid = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";
    execTgAdmin(`send "${TARGET_BOT}" "/start event_${eventUuid}"`);

    await new Promise((r) => setTimeout(r, 2500));

    const messagesRaw = execTgAdmin(`read "${TARGET_BOT}" -n 2 --json`);
    const messages = JSON.parse(messagesRaw);

    const incoming = messages.find((m: any) => !m.out);
    expect(incoming).toBeDefined();
    expect(incoming.text).toContain("Welcome to ONTON");
  });

  test("TG-5: Verify /start with campaign affiliate parameter (Issue #968)", async () => {
    const affiliateParam = "campaign-aff-test123";
    execTgAdmin(`send "${TARGET_BOT}" "/start ${affiliateParam}"`);

    await new Promise((r) => setTimeout(r, 2500));

    const messagesRaw = execTgAdmin(`read "${TARGET_BOT}" -n 2 --json`);
    const messages = JSON.parse(messagesRaw);

    const incoming = messages.find((m: any) => !m.out);
    expect(incoming).toBeDefined();
    expect(incoming.text).toContain("Welcome to ONTON");
  });
});
