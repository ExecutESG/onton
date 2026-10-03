import { expect, request, test, APIRequestContext } from "@playwright/test";
import { signTelegramInitData } from "../helpers/initDataSigner";
import { TRPCClient } from "../helpers/trpcClient";
import { loadEnvTest, requireEnv } from "../helpers/envTest";
import * as crypto from "crypto";

loadEnvTest();

interface SyncedUser {
  user_id: number;
  role: string;
}

const baseURL = requireEnv("BASE_URL");
const botToken = requireEnv("STAGING_BOT_TOKEN");
const attendee = { id: Number(requireEnv("E2E_ATTENDEE_TG_ID")), first_name: "challenquizer", username: "challenquizer" };

/** Builds initData signed with an arbitrary auth_date (seconds). */
function signWithAuthDate(authDate: number): string {
  const fields: Record<string, string> = {
    auth_date: String(authDate),
    query_id: `qa_${authDate}`,
    user: JSON.stringify({ id: attendee.id, first_name: attendee.first_name, username: attendee.username, language_code: "en" }),
  };
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  const params = new URLSearchParams(fields);
  params.append("hash", hash);
  return params.toString();
}

let context: APIRequestContext;

test.beforeAll(async () => {
  context = await request.newContext({ baseURL });
});

test.afterAll(async () => {
  await context.dispose();
});

test.describe("Real auth (staging)", () => {
  for (const [label, idVar, username] of [
    ["organizer", "E2E_ORGANIZER_TG_ID", "ontonadmin"],
    ["attendee", "E2E_ATTENDEE_TG_ID", "challenquizer"],
    ["officer/admin", "E2E_OFFICER_TG_ID", "Mfarimani"],
  ] as const) {
    test(`signed initData authenticates the ${label}`, async () => {
      const id = Number(requireEnv(idVar));
      const client = new TRPCClient(context, baseURL, signTelegramInitData({ id, first_name: username, username }, botToken));
      const response = await client.query<SyncedUser>("users.syncUser");
      expect(response.status, response.errorMessage).toBe(200);
      expect(response.data?.user_id).toBe(id);
    });
  }

  test("missing auth is rejected with 401", async () => {
    const response = await new TRPCClient(context, baseURL, null).query<SyncedUser>("users.syncUser");
    expect(response.status).toBe(401);
    expect(response.errorCode).toBe("UNAUTHORIZED");
  });

  test("tampered hash is rejected with 401", async () => {
    const valid = signTelegramInitData(attendee, botToken);
    const tampered = valid.replace(/hash=([0-9a-f])/, (_match, first: string) => `hash=${first === "0" ? "1" : "0"}`);
    expect(tampered).not.toBe(valid);
    const response = await new TRPCClient(context, baseURL, tampered).query<SyncedUser>("users.syncUser");
    expect(response.status).toBe(401);
  });

  test("tampered user id (impersonation) is rejected with 401", async () => {
    const valid = signTelegramInitData(attendee, botToken);
    const forged = valid.replace(encodeURIComponent(`"id":${attendee.id}`), encodeURIComponent(`"id":${requireEnv("E2E_ADMIN_TG_ID")}`));
    expect(forged).not.toBe(valid);
    const response = await new TRPCClient(context, baseURL, forged).query<SyncedUser>("users.syncUser");
    expect(response.status).toBe(401);
  });

  test("initData older than 24h is rejected with 401", async () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 86400;
    const response = await new TRPCClient(context, baseURL, signWithAuthDate(twoDaysAgo)).query<SyncedUser>("users.syncUser");
    expect(response.status).toBe(401);
  });

  test("initData signed with a different bot token is rejected with 401", async () => {
    const wrongToken = "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const response = await new TRPCClient(context, baseURL, signTelegramInitData(attendee, wrongToken)).query<SyncedUser>("users.syncUser");
    expect(response.status).toBe(401);
  });
});
