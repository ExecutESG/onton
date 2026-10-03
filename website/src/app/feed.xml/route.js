import { getAllArticles, getAllEvents } from "@/lib/content";

const BASE_URL = "https://onton.live";

export async function GET() {
  const articles = getAllArticles();
  const events = getAllEvents();

  const escapeXml = (str) =>
    (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const articleItems = articles.map((art) => `
    <item>
      <title>${escapeXml(art.title)}</title>
      <link>${BASE_URL}/blog/${art.slug}</link>
      <guid>${BASE_URL}/blog/${art.slug}</guid>
      <pubDate>${new Date(art.publishedAt || Date.now()).toUTCString()}</pubDate>
      <description>${escapeXml(art.meta_description || art.excerpt)}</description>
      <category>${escapeXml(art.category)}</category>
      <author>${escapeXml(art.author || "ONTON Team")}</author>
    </item>`).join("");

  const eventItems = events.map((ev) => `
    <item>
      <title>${escapeXml(ev.eventName || ev.title)}</title>
      <link>${BASE_URL}/events</link>
      <guid>${BASE_URL}/events/${ev.slug}</guid>
      <pubDate>${new Date(ev.publishedAt || Date.now()).toUTCString()}</pubDate>
      <description>${escapeXml(ev.meta_description)}</description>
      <category>Web3 Events</category>
      <author>ONTON Events Hub</author>
    </item>`).join("");

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ONTON — The Hub of Web3 Events</title>
    <link>${BASE_URL}</link>
    <description>Tactical guides, fee comparisons, and event calendars for Web3 event organizers and Telegram Mini App developers.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    ${articleItems}
    ${eventItems}
  </channel>
</rss>`;

  return new Response(rssFeed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
