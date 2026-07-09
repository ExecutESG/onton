import { MetadataRoute } from "next";
import { db } from "@/db/db";
import { events } from "@/db/schema/events";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://dev.onton.live";

  // Default static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/channels`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/play-2-win`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  try {
    // Fetch only event UUIDs and timestamps to minimize memory footprint
    const dbEvents = await db
      .select({
        event_uuid: events.event_uuid,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .execute();

    const eventPages: MetadataRoute.Sitemap = dbEvents.map((event) => ({
      url: `${baseUrl}/events/${event.event_uuid}`,
      lastModified: event.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticPages, ...eventPages];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticPages;
  }
}
