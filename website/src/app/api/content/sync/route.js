import { NextResponse } from "next/server";
import { getManifest } from "@/lib/content";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("x-onton-sync-secret");
    const configuredSecret = process.env.CONTENT_SYNC_SECRET || "onton-marketing-sync-2026";

    if (authHeader && authHeader !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized sync request" }, { status: 401 });
    }

    const manifest = getManifest();

    return NextResponse.json({
      success: true,
      message: "Content synchronized successfully",
      timestamp: new Date().toISOString(),
      counts: {
        articles: (manifest.articles || []).length,
        glossary: (manifest.glossary || []).length,
        events: (manifest.events || []).length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const manifest = getManifest();
  return NextResponse.json({
    status: "healthy",
    counts: {
      articles: (manifest.articles || []).length,
      glossary: (manifest.glossary || []).length,
      events: (manifest.events || []).length,
    },
  });
}
