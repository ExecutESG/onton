import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth";
import { authEngine } from "@/lib/auth/authEngine";
import { userIdentitiesDB } from "@/db/modules/userIdentities.db";
import "@/lib/gracefullyShutdown";

export async function POST(req: NextRequest) {
  const [userId, authError] = getAuthenticatedUser(req);
  if (authError) {
    return authError;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { provider, data } = body;

    if (!provider || !data) {
      return NextResponse.json(
        { ok: false, error: "Missing required parameters: provider and data" },
        { status: 400 }
      );
    }

    if (provider === "telegram") {
      const verification = authEngine.verifyTelegramInitData(data);
      if (!verification.valid || !verification.telegramUser) {
        return NextResponse.json({ ok: false, error: "Invalid Telegram initData" }, { status: 400 });
      }

      const result = await userIdentitiesDB.linkIdentity(
        userId,
        "telegram",
        String(verification.telegramUser.id),
        verification.telegramUser
      );

      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
      }

      return NextResponse.json({ ok: true, identity: result.identity });
    }

    if (provider === "email") {
      const { email, code } = data;
      if (!email || !code) {
        return NextResponse.json({ ok: false, error: "Missing email or verification code" }, { status: 400 });
      }

      const verification = await authEngine.verifyEmailOtp(email, code);
      if (!verification.valid || !verification.email) {
        return NextResponse.json({ ok: false, error: verification.error || "Invalid code" }, { status: 400 });
      }

      const result = await userIdentitiesDB.linkIdentity(
        userId,
        "email",
        verification.email,
        { email: verification.email }
      );

      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
      }

      return NextResponse.json({ ok: true, identity: result.identity });
    }

    if (provider === "ton_wallet") {
      const { address } = data;
      if (!address || typeof address !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid wallet address" }, { status: 400 });
      }

      const result = await userIdentitiesDB.linkIdentity(
        userId,
        "ton_wallet",
        address.trim(),
        { address: address.trim() }
      );

      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
      }

      return NextResponse.json({ ok: true, identity: result.identity });
    }

    if (provider === "google") {
      const { sub, email, name, picture } = data;
      if (!sub || typeof sub !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid Google user identifier" }, { status: 400 });
      }

      const result = await userIdentitiesDB.linkIdentity(
        userId,
        "google",
        sub.trim(),
        { email, name, picture }
      );

      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
      }

      return NextResponse.json({ ok: true, identity: result.identity });
    }

    return NextResponse.json({ ok: false, error: `Unsupported provider: ${provider}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to link identity" },
      { status: 500 }
    );
  }
}
