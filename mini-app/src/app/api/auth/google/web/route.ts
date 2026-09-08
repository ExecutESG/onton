import { NextRequest, NextResponse } from "next/server";
import { makeGoogleAuthUrl } from "@/lib/google";
import { redisTools } from "@/lib/redisTools";

const OAUTH_TTL = 15 * 60; // 15-minute Redis lifetime

export async function GET(req: NextRequest) {
  const { url, codeVerifier, state } = makeGoogleAuthUrl();

  // Save the verification code and the source indicator to Redis
  await redisTools.setCache(
    `goauth:${state}`,
    {
      codeVerifier,
      source: "web",
      returnUrl: new URL("/", req.url).toString(),
    },
    OAUTH_TTL
  );

  return NextResponse.redirect(url);
}

export const dynamic = "force-dynamic";
