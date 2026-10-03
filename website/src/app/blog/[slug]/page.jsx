import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getArticleBySlug,
  getAllArticleSlugs,
  getRelatedArticles,
  extractHeadings,
  renderMarkdown,
} from "@/lib/content";
import EventFeeCalculator from "@/components/interactive/EventFeeCalculator";
import TelegramGatingSimulator from "@/components/interactive/TelegramGatingSimulator";

const BASE_URL = "https://onton.live";

export async function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { title: "Article Not Found — ONTON" };
  }

  const keywords = Array.isArray(article.keywords)
    ? article.keywords
    : [article.primary_keyword || "web3 events"];

  const ogImageUrl = article.featured_image
    ? (article.featured_image.startsWith("http")
      ? article.featured_image
      : `${BASE_URL}${article.featured_image}`)
    : `${BASE_URL}/onton-landing-1.svg`;

  return {
    title: `${article.title} — ONTON`,
    description: article.meta_description,
    keywords,
    authors: [{ name: article.author || "ONTON Team" }],
      openGraph: {
        title: article.title,
        description: article.meta_description,
        url: `${BASE_URL}/blog/${article.slug}`,
        siteName: "ONTON — The Luma of Telegram & Web3",
        type: "article",
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt || article.publishedAt,
        authors: [article.author || "ONTON Team"],
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: article.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description: article.meta_description,
        creator: "@ontonbot",
        images: [ogImageUrl],
      },
    alternates: {
      canonical: `${BASE_URL}/blog/${article.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const htmlContent = await renderMarkdown(article.content);
  const headings = extractHeadings(article.content);
  const relatedArticles = getRelatedArticles(article.slug, article.category, 3);

  // Schema.org Article Structured Data
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    image: article.featured_image || `${BASE_URL}/onton-landing-1.svg`,
    author: {
      "@type": "Person",
      name: article.author || "ONTON Team",
      jobTitle: article.author_role || "Product Lead",
      url: article.author_link || BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "ONTON",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.ico`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${article.slug}`,
    },
    keywords: Array.isArray(article.keywords)
      ? article.keywords.join(", ")
      : article.primary_keyword,
  };

  // BreadcrumbList Schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${BASE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: `${BASE_URL}/blog/${article.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-[#F9F9FB] text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb Navigation */}
          <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-blue-600 transition-colors">
              Blog
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate max-w-xs sm:max-w-md">
              {article.title}
            </span>
          </nav>

          {/* Article Header */}
          <header className="mb-10 pb-8 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                {article.category}
              </span>
              <span className="text-xs text-gray-500">{article.readTime}</span>
              <span className="text-xs text-gray-300">•</span>
              <span className="text-xs text-gray-500">
                Published {article.publishedAt}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
              {article.title}
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-6">
              {article.meta_description}
            </p>

            {/* Author Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                  {article.author ? article.author.charAt(0) : "O"}
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">
                    {article.author || "ONTON Team"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {article.author_role || "Core Contributor"}
                  </div>
                </div>
              </div>

              {/* Share & Mini App CTA */}
              <div className="flex items-center gap-2">
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(
                    `${BASE_URL}/blog/${article.slug}`
                  )}&text=${encodeURIComponent(article.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  <span>✈️</span> Share on Telegram
                </a>
                <a
                  href="https://t.me/theontonbot/event"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <span>🎟️</span> Launch Event
                </a>
              </div>
            </div>
          </header>

          {/* Main Grid: TOC + Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Table of Contents Sidebar */}
            {headings.length > 0 && (
              <aside className="lg:col-span-4 order-2 lg:order-1 sticky top-24 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Table of Contents
                </h3>
                <ul className="space-y-2 text-sm">
                  {headings.map((h) => (
                    <li
                      key={h.id}
                      className={h.level === 3 ? "pl-3 text-xs text-gray-500" : "font-medium"}
                    >
                      <a
                        href={`#${h.id}`}
                        className="text-gray-700 hover:text-blue-600 transition-colors block py-0.5 line-clamp-1"
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>

                {/* Sidebar Quick Action */}
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <span className="text-xs text-gray-400 font-semibold block mb-2">
                    Host on Telegram
                  </span>
                  <a
                    href="https://t.me/theontonbot/event"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center block px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    Open @theontonbot
                  </a>
                </div>
              </aside>
            )}

            {/* Article Body */}
            <main
              className={`${
                headings.length > 0 ? "lg:col-span-8" : "lg:col-span-12"
              } order-1 lg:order-2 bg-white rounded-2xl border border-gray-200 p-6 sm:p-10 shadow-sm`}
            >
              {/* Contextual Interactive Widget */}
              {article.category === "Telegram Stars" && <EventFeeCalculator />}
              {article.category === "Event Guides" && <TelegramGatingSimulator />}

              {/* Rendered Markdown Body */}
              <div
                className="prose prose-blue max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-table:w-full prose-table:border prose-table:border-gray-200 prose-th:bg-gray-50 prose-th:p-3 prose-td:p-3 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:p-4 prose-blockquote:rounded-r-lg"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />

              {/* Bottom In-Article Conversion Banner */}
              <div className="mt-12 pt-8 border-t border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Ready to host your event inside Telegram?
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      1-tap Free RSVPs, Telegram Stars payments, and automated chat gating with 0 wallet friction.
                    </p>
                  </div>
                  <a
                    href="https://t.me/theontonbot/event"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-sm"
                  >
                    Start in Telegram →
                  </a>
                </div>
              </div>
            </main>
          </div>

          {/* Related Articles Cluster */}
          {relatedArticles.length > 0 && (
            <section className="mt-16 pt-12 border-t border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Related Tactical Guides & Resources
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedArticles.map((rel) => (
                  <div
                    key={rel.slug}
                    className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {rel.category}
                      </span>
                      <h4 className="font-bold text-gray-900 text-base mt-2 mb-2 line-clamp-2">
                        <Link href={`/blog/${rel.slug}`}>{rel.title}</Link>
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {rel.meta_description}
                      </p>
                    </div>
                    <Link
                      href={`/blog/${rel.slug}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-4 inline-flex items-center gap-1"
                    >
                      Read Now <span>→</span>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
