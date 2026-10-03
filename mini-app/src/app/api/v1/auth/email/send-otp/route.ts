import { NextRequest, NextResponse } from "next/server";
import { authEngine } from "@/lib/auth/authEngine";
import "@/lib/gracefullyShutdown";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: email" },
        { status: 400 }
      );
    }

    const result = await authEngine.generateEmailOtp(email);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to generate OTP" },
      { status: 500 }
    );
  }
}
