import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost, mediaUrl } from "@/lib/blog/blogApi";

type Params = Promise<{ schema: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { schema, slug } = await params;
  const post = await getBlogPost(schema, slug);
  if (!post) return { title: "Not found", robots: { index: false, follow: false } };
  const s = post.seo;
  const canonical = s.canonical_url || `/store/${schema}/blog/${slug}`;
  const ogImage = mediaUrl(s.og_image || post.cover_image);
  return {
    title: s.seo_title || post.title,
    description: s.meta_description || post.excerpt,
    keywords: [s.focus_keyword, ...(s.secondary_keywords || [])].filter(Boolean),
    alternates: { canonical },
    robots: { index: !s.robots.includes("noindex"), follow: !s.robots.includes("nofollow") },
    openGraph: {
      title: s.og_title || s.seo_title || post.title,
      description: s.og_description || s.meta_description || post.excerpt,
      type: "article",
      url: canonical,
      images: ogImage ? [{ url: ogImage }] : undefined,
      publishedTime: post.published_at || undefined,
    },
    twitter: {
      card: s.twitter_card === "summary" ? "summary" : "summary_large_image",
      title: s.og_title || s.seo_title || post.title,
      description: s.og_description || s.meta_description || post.excerpt,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { schema, slug } = await params;
  const post = await getBlogPost(schema, slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-white">
      {/* schema.org structured data (BlogPosting + FAQPage) in the HTML for crawlers/AI */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(post.json_ld) }} />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href={`/store/${schema}/blog`} className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700">← Blog</Link>

        <header className="mt-4">
          {post.category && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">{post.category.name}</span>
          )}
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
            {post.author && <span>{post.author.name}</span>}
            {post.published_at && <span>· {new Date(post.published_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>}
            {post.reading_minutes > 0 && <span>· {post.reading_minutes} min read</span>}
          </div>
        </header>

        {post.cover_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(post.cover_image)} alt={post.title} className="mt-6 w-full rounded-2xl object-cover" />
        )}

        {/* AEO: short-answer block (the AI-search / featured-snippet answer) */}
        {post.aeo.short_answer && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">In short</p>
            <p className="mt-1 text-[15px] text-emerald-900">{post.aeo.short_answer}</p>
          </div>
        )}

        {/* AEO: TL;DR bullets */}
        {post.aeo.tldr.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">TL;DR</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px] text-slate-700">
              {post.aeo.tldr.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        )}

        {/* Body (rich-text HTML authored by the owner) */}
        <div
          className="prose prose-slate mt-8 max-w-none prose-headings:font-bold prose-a:text-emerald-700"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />

        {/* AEO: FAQ accordion (also emitted as FAQPage JSON-LD) */}
        {post.aeo.faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-slate-900">Frequently asked questions</h2>
            <div className="mt-4 space-y-3">
              {post.aeo.faqs.map((f, i) => (
                <details key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer font-semibold text-slate-900">{f.q}</summary>
                  <p className="mt-2 text-[14px] text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <Link key={t.slug} href={`/store/${schema}/blog?tag=${t.slug}`} className="rounded-full border border-slate-200 px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50">#{t.name}</Link>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
