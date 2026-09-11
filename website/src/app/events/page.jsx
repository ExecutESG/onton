import Link from "next/link";
import { getAllEvents } from "@/lib/content";
import EventSponsorshipCalculator from "@/components/interactive/EventSponsorshipCalculator";

export const metadata = {
  title: "Web3 Events & Side Events Directory (2026) — ONTON Hub",
  description:
    "Discover the official calendar of Web3 conferences, hackathons, VIP networking dinners, and side events. 1-tap Telegram RSVP powered by ONTON.",
  openGraph: {
    title: "Web3 Events & Side Events Hub — ONTON",
    description:
      "Token2049, Devcon, ETHDenver, and TON Gateway side events directory with instant Telegram ticketing.",
    url: "https://onton.live/events",
    siteName: "ONTON — The Luma of Telegram & Web3",
    type: "website",
    images: [
      {
        url: "https://onton.live/onton-landing-1.svg",
        width: 1200,
        height: 630,
        alt: "ONTON Web3 Events Hub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Web3 Events & Side Events Hub — ONTON",
    description:
      "Token2049, Devcon, ETHDenver, and TON Gateway side events directory with instant Telegram ticketing.",
    creator: "@ontonbot",
    images: ["https://onton.live/onton-landing-1.svg"],
  },
  alternates: {
    canonical: "https://onton.live/events",
  },
};

export default function EventsHubPage() {
  const events = getAllEvents();

  // Schema.org Event Array
  const eventSchemas = events.map((ev) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.eventName || ev.title,
    description: ev.meta_description,
    startDate: ev.startDate,
    endDate: ev.endDate || ev.startDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: ev.venue || ev.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: ev.location,
      },
    },
    organizer: {
      "@type": "Organization",
      name: ev.organizer || "ONTON Web3 Events",
      url: "https://onton.live",
    },
    offers: {
      "@type": "Offer",
      price: ev.ticketPrice && ev.ticketPrice.includes("Free") ? "0" : "50",
      priceCurrency: "USD",
      url: ev.rsvpUrl || "https://t.me/theontonbot/event",
      availability: "https://schema.org/InStock",
    },
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchemas) }}
      />

      <div className="min-h-screen bg-[#F9F9FB] text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-12 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-4 border border-blue-200 shadow-sm">
              <span>🎟️</span> Curated Web3 Calendar & Side Events
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
              Global Web3 Events Hub (2026)
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Find, host, and RSVP to flagship crypto summits, hacker houses, and exclusive side events with 1-tap Telegram Stars or crypto checkouts.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <a
                href="https://t.me/theontonbot/event"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-sm text-sm"
              >
                <span>➕</span> List Your Event for Free
              </a>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all shadow-sm text-sm"
              >
                <span>📘</span> Organizer Guides ({events.length} Events Listed)
              </Link>
            </div>
          </header>

          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {events.map((ev) => (
              <div
                key={ev.slug}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600">
                      {ev.ecosystem || "Web3"}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {ev.ticketPrice || "Free RSVP"}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2 leading-snug">
                    {ev.eventName || ev.title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span>{ev.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>
                        {ev.startDate} {ev.endDate && `— ${ev.endDate}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🏛️</span>
                      <span>{ev.venue || "Flagship Location"}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                    {ev.meta_description || ev.content}
                  </p>
                </div>

                <div className="p-6 pt-0">
                  <a
                    href={ev.rsvpUrl || "https://t.me/theontonbot/event"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center block px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm"
                  >
                    1-Tap Telegram RSVP →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Sponsorship Revenue Calculator */}
          <section className="mb-16">
            <EventSponsorshipCalculator />
          </section>

          {/* Organizer Submission Callout */}
          <div className="bg-gradient-to-br from-gray-900 to-slate-900 text-white rounded-2xl p-8 sm:p-12 text-center shadow-xl border border-gray-800">
            <h3 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Hosting a Side Event at Token2049, Devcon, or ETHDenver?
            </h3>
            <p className="text-gray-400 max-w-xl mx-auto mb-6 text-sm sm:text-base">
              Get listed on the ONTON Event Hub and enable 1-tap Telegram RSVPs, automated group chat gating, and Proof of Attendance SBTs for your guests.
            </p>
            <a
              href="https://t.me/theontonbot/event"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all shadow-lg text-sm sm:text-base"
            >
              <span>🚀</span> Submit Your Event via Bot
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
