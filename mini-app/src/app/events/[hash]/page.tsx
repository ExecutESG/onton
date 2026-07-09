import { ErrorState } from "@/app/_components/ErrorState";
import { EventDataPage } from "@/app/_components/Event/EventPage";
import { fetchEventByUuid } from "@/db/modules/events.db";
import { Metadata } from "next";

type Props = { params: { hash: string } };

// Generate dynamic SEO metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (params.hash.length !== 36) {
    return { title: "Event Not Found" };
  }

  try {
    const event = await fetchEventByUuid(params.hash);
    if (!event) {
      return { title: "Event Not Found" };
    }

    const title = `${event.title} | ONTON Events`;
    const description = event.subtitle || event.description.substring(0, 155) + "...";
    const imageUrl = event.image_url;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: imageUrl ? [{ url: imageUrl }] : [],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return { title: "ONTON Event" };
  }
}

export default async function EventPage({ params }: Props) {
  if (params.hash.length !== 36) {
    return <ErrorState errorCode="event_not_found" />;
  }

  const event = await fetchEventByUuid(params.hash);
  if (!event) {
    return <ErrorState errorCode="event_not_found" />;
  }

  // Construct JSON-LD Structured Data for Googlebot Event Snippets
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "description": event.subtitle || event.description,
    "image": event.image_url,
    "startDate": event.start_date ? new Date(event.start_date * 1000).toISOString() : undefined,
    "endDate": event.end_date ? new Date(event.end_date * 1000).toISOString() : undefined,
    "eventStatus": event.enabled ? "https://schema.org/EventScheduled" : "https://schema.org/EventCancelled",
    "location": {
      "@type": "Place",
      "name": event.location || "Online",
      "address": event.location || "Online"
    },
    "organizer": {
      "@type": "Organization",
      "name": "ONTON",
      "url": "https://dev.onton.live"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EventDataPage eventHash={params.hash} />
    </>
  );
}
