'use client';

import { useEffect, useState } from 'react';

const FALLBACK_EVENTS = [
  {
    title: 'TON Community Meetup & Hack Night',
    subtitle: 'Connecting builders, founders, and designers building on TON and Telegram.',
    location: 'Dubai & Online Streaming',
    badge: '🎟️ Free 1-Tap RSVP',
    link: 'https://t.me/theontonbot',
  },
  {
    title: 'Web3 Gaming & Mini Apps Summit',
    subtitle: 'Explore the next wave of viral Telegram mini-games and decentralized entertainment.',
    location: 'Singapore & Telegram Livestream',
    badge: '⭐ Telegram Stars / Crypto',
    link: 'https://t.me/theontonbot',
  },
  {
    title: 'DeFi & Telegram Bot Architecture Workshop',
    subtitle: 'Hands-on masterclass on building high-conversion checkout flows and group-gated communities.',
    location: 'Online Workshop',
    badge: '🎟️ Free 1-Tap RSVP',
    link: 'https://t.me/theontonbot',
  },
];

export default function FeaturedEventsSection() {
  const [eventsList, setEventsList] = useState(FALLBACK_EVENTS);

  useEffect(() => {
    const loadFeatured = async () => {
      try {
        const res = await fetch('https://app.onton.live/api/client/v1/public/stats');
        if (res.ok) {
          const json = await res.json();
          if (json.data?.featuredEvents && json.data.featuredEvents.length > 0) {
            const mapped = json.data.featuredEvents.map((evt) => ({
              title: evt.title || 'Featured Telegram Event',
              subtitle: evt.subtitle || 'Join community members for an exclusive gathering on Telegram.',
              location: evt.location || (evt.participationType === 'online' ? 'Online' : 'In-Person'),
              badge: evt.hasPayment ? '⭐ Telegram Stars / TON' : '🎟️ Free 1-Tap RSVP',
              link: `https://t.me/theontonbot?start=event_${evt.eventUuid || evt.eventId}`,
            }));
            setEventsList(mapped);
          }
        }
      } catch {
        // Keep fallbacks
      }
    };

    loadFeatured();
  }, []);

  return (
    <section className="py-12 bg-white border-b border-gray-200">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-2">
              🔥 Trending on Telegram
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Featured Events Powered by ONTON
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Discover real-time meetups, workshops, and summits with instant 1-tap Telegram RSVP.
            </p>
          </div>

          <a
            href="https://t.me/theontonbot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#007AFF] hover:underline"
          >
            Explore All in Mini App ➔
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {eventsList.map((evt, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div>
                <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-gray-200 text-gray-800 mb-3 shadow-2xs">
                  {evt.badge}
                </span>
                <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 leading-snug">
                  {evt.title}
                </h3>
                <p className="text-xs text-gray-600 mb-4 line-clamp-2">
                  {evt.subtitle}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate max-w-[170px]">
                  <span>📍</span>
                  <span className="truncate">{evt.location}</span>
                </div>
                <a
                  href={evt.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-[#007AFF] text-white text-xs font-semibold hover:bg-blue-600 transition-all shadow-2xs"
                >
                  RSVP ➔
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
