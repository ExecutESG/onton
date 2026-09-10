import { getAllArticleSlugs, getAllGlossarySlugs, getAllEventSlugs } from "@/lib/content";

const BASE_URL = "https://onton.live";

export default function sitemap() {
  const currentDate = new Date();

  // Core Static Pages
  const staticRoutes = [
    {
      url: `${BASE_URL}/`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/events`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/resources/glossary`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog/guide`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/feed.xml`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/tos`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Dynamic Blog Posts
  const articleSlugs = getAllArticleSlugs();
  const articleRoutes = articleSlugs.map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  // Dynamic Glossary Terms
  const glossarySlugs = getAllGlossarySlugs();
  const glossaryRoutes = glossarySlugs.map((slug) => ({
    url: `${BASE_URL}/resources/glossary/${slug}`,
    lastModified: currentDate,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  return [...staticRoutes, ...articleRoutes, ...glossaryRoutes];
}
