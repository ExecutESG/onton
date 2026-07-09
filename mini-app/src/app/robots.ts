import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://dev.onton.live";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/events", "/channels", "/play-2-win"],
      disallow: ["/my", "/api", "/_next"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
