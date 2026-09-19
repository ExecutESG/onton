import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getGlossaryTermBySlug,
  getAllGlossarySlugs,
  getAllArticles,
  renderMarkdown,
} from "@/lib/content";

const BASE_URL = "https://onton.live";

export async function generateStaticParams() {
  return getAllGlossarySlugs().map((term) => ({ term }));
}

export async function generateMetadata({ params }) {
  const { term } = params;
  const item = getGlossaryTermBySlug(term);

  if (!item) {
    return { title: "Term Not Found — ONTON Glossary" };
  }

  return {
    title: `${item.title} — ONTON Web3 Glossary`,
    description: item.meta_description,
    openGraph: {
      title: item.title,
      description: item.meta_description,
      url: `${BASE_URL}/resources/glossary/${item.slug}`,
      siteName: "ONTON — The Luma of Telegram & Web3",
      type: "article",
      images: [
        {
          url: `${BASE_URL}/onton-landing-1.svg`,
          width: 1200,
          height: 630,
          alt: item.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description: item.meta_description,
      creator: "@ontonbot",
      images: [`${BASE_URL}/onton-landing-1.svg`],
    },
    alternates: {
      canonical: `${BASE_URL}/resources/glossary/${item.slug}`,
    },
  };
}

export default async function GlossaryTermPage({ params }) {
  const { term } = params;
  const item = getGlossaryTermBySlug(term);

  if (!item) {
    notFound();
  }

  const htmlContent = await renderMarkdown(item.content);
  const allArticles = getAllArticles().slice(0, 3);

  // Schema.org DefinedTerm
  const definedTermSchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: item.term || item.title,
    description: item.meta_description,
    inDefinedTermSet: `${BASE_URL}/resources/glossary`,
    url: `${BASE_URL}/resources/glossary/${item.slug}`,
  };

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
        name: "Glossary",
        item: `${BASE_URL}/resources/glossary`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: item.term || item.title,
        item: `${BASE_URL}/resources/glossary/${item.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-[#F9F9FB] text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link
              href="/resources/glossary"
              className="hover:text-blue-600 transition-colors"
            >
              Glossary
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{item.term || item.title}</span>
          </nav>

          {/* Term Header */}
          <header className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 mb-8 shadow-sm">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 mb-4">
              <span>📖</span> Web3 Definition
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
              {item.title}
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              {item.meta_description}
            </p>
          </header>

          {/* Body Content */}
          <main className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 mb-12 shadow-sm">
            <div
              className="prose prose-blue max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:p-4 prose-blockquote:rounded-r-lg"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </main>

          {/* Related Tactical Guides */}
          <section className="mb-12">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Apply this knowledge with ONTON Guides
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {allArticles.map((art) => (
                <Link
                  key={art.slug}
                  href={`/blog/${art.slug}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-500 hover:shadow-sm transition-all"
                >
                  <span className="text-[10px] font-bold text-blue-600 uppercase">
                    {art.category}
                  </span>
                  <h4 className="font-bold text-gray-900 text-sm mt-1 line-clamp-2">
                    {art.title}
                  </h4>
                  <span className="text-xs text-gray-400 mt-2 block">
                    {art.readTime}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
