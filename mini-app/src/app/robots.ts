import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "";

  // Block indexing on staging / dev subdomains and local development
  const isStaging =
    baseUrl.includes("dev.onton.live") ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1") ||
    !baseUrl;

  if (isStaging) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/events", "/channels", "/play-2-win"],
      disallow: ["/my", "/api", "/_next"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
