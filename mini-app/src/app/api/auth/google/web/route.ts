import { NextRequest, NextResponse } from "next/server";
import { makeGoogleAuthUrl } from "@/lib/google";
import { redisTools } from "@/lib/redisTools";

const OAUTH_TTL = 15 * 60; // 15-minute Redis lifetime

export async function GET(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || (forwardedHost?.includes("localhost") ? "http" : "https");
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.dev.onton.live");

  // Read return_to and prevent open redirects
  const returnToRaw = req.nextUrl.searchParams.get("return_to") || req.nextUrl.searchParams.get("redirect") || "/";
  const safeReturnPath = returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "/";
  const returnUrl = new URL(safeReturnPath, baseUrl).toString();

  // Dynamic redirect URI aligned with request origin
  const redirectUri = `${baseUrl}/api/google/callback`;
  const { url, codeVerifier, state } = makeGoogleAuthUrl(redirectUri);

  // Save the verification code, origin redirect URI, and return URL to Redis
  await redisTools.setCache(
    `goauth:${state}`,
    {
      codeVerifier,
      source: "web",
      returnUrl,
      redirectUri,
    },
    OAUTH_TTL
  );

  return NextResponse.redirect(url);
}

export const dynamic = "force-dynamic";
