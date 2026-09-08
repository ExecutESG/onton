import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { usersDB } from "@/db/modules/users.db";
import { createWebSessionToken } from "@/server/utils/jwt";
import { InitUserData } from "@/types/extendedUserTypes";

const BOT_TOKEN = process.env.BOT_TOKEN || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash");
  if (!hash) {
    return new NextResponse("Missing hash", { status: 400 });
  }

  // 1. Sort parameters and build data-check string
  const checkParams: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== "hash") {
      checkParams.push(`${key}=${value}`);
    }
  });
  checkParams.sort();
  const dataCheckString = checkParams.join("\n");

  // 2. Validate hash
  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (hmac !== hash) {
    return new NextResponse("Authentication failed: invalid hash", { status: 403 });
  }

  // 3. Validate freshness (within 24 hours)
  const authDate = Number(searchParams.get("auth_date") || "0");
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) {
    return new NextResponse("Authentication failed: auth date too old", { status: 403 });
  }

  // 4. Resolve or create user
  const idStr = searchParams.get("id");
  if (!idStr) {
    return new NextResponse("Missing id", { status: 400 });
  }
  const id = Number(idStr);

  const username = searchParams.get("username") || "";
  const first_name = searchParams.get("first_name") || "";
  const last_name = searchParams.get("last_name") || "";
  const photo_url = searchParams.get("photo_url") || "";

  // Insert or update user
  const mockInitDataJson: InitUserData = {
    user: {
      id: id,
      username: username,
      first_name: first_name,
      last_name: last_name,
      language_code: "en",
      is_premium: false,
      allows_write_to_pm: false,
      photo_url: photo_url || undefined,
    },
  };

  const user = await usersDB.insertUser(mockInitDataJson);
  if (!user) {
    return new NextResponse("Failed to insert or retrieve user", { status: 500 });
  }

  if (user.role === "ban") {
    return new NextResponse("User is banned", { status: 403 });
  }

  // 5. Issue Web Session JWT
  const sessionToken = await createWebSessionToken({
    userId: user.user_id,
    authMethod: "telegram_widget",
  });

  // 6. Set HTTP-only Cookie
  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set("onton_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return response;
}

export const dynamic = "force-dynamic";
