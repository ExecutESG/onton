import { NextResponse } from "next/server";
import { getArticleBySlug } from "@/lib/content";

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, slug, reviewer } = body;

    if (!action || !slug) {
      return NextResponse.json(
        { error: "Missing action or slug parameter" },
        { status: 400 }
      );
    }

    const article = getArticleBySlug(slug);
    if (!article) {
      return NextResponse.json(
        { error: `Article '${slug}' not found` },
        { status: 404 }
      );
    }

    if (action === "approve") {
      return NextResponse.json({
        success: true,
        status: "published",
        message: `Article '${slug}' approved by ${reviewer || "admin"} and published.`,
        publishedAt: new Date().toISOString(),
      });
    }

    if (action === "reject") {
      return NextResponse.json({
        success: true,
        status: "revision_requested",
        message: `Article '${slug}' marked for revision.`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
