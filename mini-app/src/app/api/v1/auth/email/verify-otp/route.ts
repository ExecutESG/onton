import { NextRequest, NextResponse } from "next/server";
import { authEngine } from "@/lib/auth/authEngine";
import { cookies } from "next/headers";
import "@/lib/gracefullyShutdown";

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, code, name } = body;

    if (!email || !code) {
      return NextResponse.json(
        { ok: false, error: "Missing required parameters: email and code" },
        { status: 400 }
      );
    }

    const verification = await authEngine.verifyEmailOtp(email, code);
    if (!verification.valid || !verification.email) {
      return NextResponse.json(
        { ok: false, error: verification.error || "Invalid or expired code" },
        { status: 401 }
      );
    }

    const resolved = await authEngine.resolveOrCreateUser({
      provider: "email",
      providerUserId: verification.email,
      email: verification.email,
      name: name || undefined,
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
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
