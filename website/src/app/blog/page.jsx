import Link from "next/link";
import { getAllArticles, getAllGlossaryTerms, getAllEvents } from "@/lib/content";
import EventFeeCalculator from "@/components/interactive/EventFeeCalculator";

export const metadata = {
  title: "ONTON Blog — Web3 Event Ticketing, Telegram Stars & Growth",
  description:
    "Insights, tactical guides, and fee teardowns for Web3 event organizers, crypto conference leads, and Telegram Mini App developers.",
  openGraph: {
    title: "ONTON Blog — The Web3 Event Operating System",
    description:
      "Insights, tactical guides, and fee teardowns for Web3 event organizers, crypto conference leads, and Telegram Mini App developers.",
    url: "https://onton.live/blog",
    siteName: "ONTON — The Luma of Telegram & Web3",
    type: "website",
    images: [
      {
        url: "https://onton.live/onton-landing-1.svg",
        width: 1200,
        height: 630,
        alt: "ONTON Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ONTON Blog — The Web3 Event Operating System",
    description:
      "Insights, tactical guides, and fee teardowns for Web3 event organizers, crypto conference leads, and Telegram Mini App developers.",
    creator: "@ontonbot",
    images: ["https://onton.live/onton-landing-1.svg"],
  },
  alternates: {
    canonical: "https://onton.live/blog",
  },
};

export default function BlogIndexPage() {
  const articles = getAllArticles();
  const glossaryTerms = getAllGlossaryTerms();
  const events = getAllEvents();

  const featured = articles[0];
  const restArticles = articles.slice(1);

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-[#007AFF] mb-4 border border-blue-200 shadow-sm">
            <span>📚</span> ONTON Growth & Event Engineering
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
            The Hub of Web3 Event Knowledge
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Master Telegram Stars ticketing, automated private chat gating, and Soulbound Token (SBT) attendance badges with zero wallet friction.
          </p>

          {/* Quick Hub Links */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-800 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
            >
              <span>🎟️</span> Web3 Events Directory ({events.length})
            </Link>
            <Link
              href="/resources/glossary"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-800 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
            >
              <span>📖</span> Web3 Jargon Glossary ({glossaryTerms.length})
            </Link>
            <Link
              href="/blog/guide"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-800 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
            >
              <span>📘</span> Official Organizer Handbook
            </Link>
          </div>
        </header>

        {/* Featured Hero Article */}
        {featured && (
          <section className="mb-12">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-8 sm:p-10">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                    {featured.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {featured.readTime || "8 min read"}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-400">
                    {featured.publishedAt}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight hover:text-blue-600 transition-colors">
                  <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
                </h2>

                <p className="text-gray-600 text-base sm:text-lg mb-6 leading-relaxed">
                  {featured.meta_description || featured.excerpt}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {featured.author ? featured.author.charAt(0) : "O"}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block">
                        {featured.author || "ONTON Team"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {featured.author_role || "Core Contributor"}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/blog/${featured.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm"
                  >
                    Read Article <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Interactive Fee Calculator Callout */}
        <section className="mb-12">
          <EventFeeCalculator />
        </section>

        {/* Recent Articles Grid */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
              All Tactical Guides & Teardowns
            </h3>
            <span className="text-sm text-gray-500">
              {articles.length} Published Articles
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restArticles.map((article) => (
              <article
                key={article.slug}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-700">
                      {article.category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {article.readTime}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors leading-snug">
                    <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                  </h4>

                  <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed mb-4">
                    {article.meta_description || article.excerpt}
                  </p>
                </div>

                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>{article.author || "ONTON Team"}</span>
                  <Link
                    href={`/blog/${article.slug}`}
                    className="font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                  >
                    Read Guide <span>→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
