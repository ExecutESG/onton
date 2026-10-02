import { NextRequest, NextResponse } from "next/server";
import { makeGoogleAuthUrl } from "@/lib/google";
import { redisTools } from "@/lib/redisTools";

const OAUTH_TTL = 15 * 60; // 15-minute Redis lifetime

export async function GET(req: NextRequest) {
  const { url, codeVerifier, state } = makeGoogleAuthUrl();

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_APP_BASE_URL || req.url;

  // Save the verification code and the source indicator to Redis
  await redisTools.setCache(
    `goauth:${state}`,
    {
      codeVerifier,
      source: "web",
      returnUrl: new URL("/", baseUrl).toString(),
    },
    OAUTH_TTL
  );

  return NextResponse.redirect(url);
}

export const dynamic = "force-dynamic";
