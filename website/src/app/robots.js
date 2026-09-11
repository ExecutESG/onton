const BASE_URL = "https://onton.live";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"],
        allow: ["/", "/blog/", "/resources/glossary/", "/events/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
