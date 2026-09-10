import Link from "next/link";
import { getAllGlossaryTerms } from "@/lib/content";

export const metadata = {
  title: "Web3 & Event Ticketing Glossary — ONTON",
  description:
    "The authoritative glossary of Web3 event ticketing, Telegram Stars, Soulbound Tokens (SBT), Sybil resistance, and on-chain community gating.",
  openGraph: {
    title: "Web3 Event Jargon Glossary — ONTON",
    description:
      "Clear, plain-English definitions for Soulbound Tokens, Telegram Stars, Proof of Attendance, and token gating.",
    url: "https://onton.live/resources/glossary",
  },
  alternates: {
    canonical: "https://onton.live/resources/glossary",
  },
};

export default function GlossaryIndexPage() {
  const terms = getAllGlossaryTerms();

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-4 border border-blue-200 shadow-sm">
            <span>📖</span> Web3 Event Terminology Dictionary
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
            Web3 Event Jargon, Demystified
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            Essential definitions for event organizers, protocol developers, and community leads navigating Telegram-native ticketing and on-chain identity.
          </p>
        </header>

        {/* Glossary Terms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {terms.map((item) => (
            <div
              key={item.slug}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded">
                    {item.term || item.title}
                  </span>
                  <span className="text-xs text-gray-400">Web3 Standard</span>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                  <Link href={`/resources/glossary/${item.slug}`}>
                    {item.title}
                  </Link>
                </h2>

                <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">
                  {item.meta_description || item.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">ONTON Knowledge Base</span>
                <Link
                  href={`/resources/glossary/${item.slug}`}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  View Full Definition <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-8 sm:p-10 text-center shadow-xl">
          <h3 className="text-2xl sm:text-3xl font-bold mb-3">
            Ready to apply these concepts to your next event?
          </h3>
          <p className="text-blue-100 max-w-xl mx-auto mb-6 text-sm sm:text-base">
            Launch your event with zero wallet friction, automated Telegram chat gating, and Proof of Attendance badges in 2 minutes.
          </p>
          <a
            href="https://t.me/theontonbot/event"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-blue-600 font-bold hover:bg-gray-50 transition-all shadow-md"
          >
            <span>🎟️</span> Launch Event on ONTON
          </a>
        </div>
      </div>
    </div>
  );
}
