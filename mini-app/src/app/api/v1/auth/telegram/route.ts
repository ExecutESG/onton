import { NextRequest, NextResponse } from "next/server";
import { authEngine } from "@/lib/auth/authEngine";
import { checkRateLimit } from "@/lib/checkRateLimit";
import { cookies } from "next/headers";
import "@/lib/gracefullyShutdown";

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawInitData = body.init_data || body.initData || req.nextUrl.searchParams.get("init_data");

    if (!rawInitData) {
      return NextResponse.json({ error: "Missing required parameter: init_data" }, { status: 400 });
    }

    const verification = authEngine.verifyTelegramInitData(rawInitData);
    if (!verification.valid || !verification.telegramUser) {
      return NextResponse.json({ error: "Invalid or expired Telegram initData" }, { status: 401 });
    }

    const { telegramUser } = verification;

    const rl = await checkRateLimit(String(telegramUser.id), "auth_telegram", 30, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many authentication attempts. Please wait a minute." },
        { status: 429 }
      );
    }
    const resolved = await authEngine.resolveOrCreateUser({
      provider: "telegram",
      providerUserId: String(telegramUser.id),
      name: `${telegramUser.first_name} ${telegramUser.last_name || ""}`.trim(),
      username: telegramUser.username,
      avatarUrl: telegramUser.photo_url,
      telegramId: telegramUser.id,
      metadata: telegramUser,
    });

    const cookieStore = cookies();
    const cookieOptions = {
      expires: new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000),
      sameSite: "none" as const,
      secure: true,
      partitioned: true,
      path: "/",
    };

    cookieStore.set("onton_token", resolved.token, cookieOptions);
    cookieStore.set("token", resolved.token, cookieOptions);

    return NextResponse.json({
      ok: true,
      token: resolved.token,
      user: resolved.user,
      isNewUser: resolved.isNewUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Authentication failed", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
