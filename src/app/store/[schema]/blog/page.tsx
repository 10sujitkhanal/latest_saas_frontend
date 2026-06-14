import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts, getBlogTaxonomy, mediaUrl, type BlogCard } from "@/lib/blog/blogApi";

type Params = Promise<{ schema: string }>;
type Search = Promise<{ page?: string; category?: string; tag?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { schema } = await params;
  const title = "Blog";
  const description = "Articles, guides and updates.";
  return {
    title,
    description,
    alternates: { canonical: `/store/${schema}/blog` },
    openGraph: { title, description, type: "website" },
  };
}

function PostCard({ schema, p }: { schema: string; p: BlogCard }) {
  return (
    <Link
      href={`/store/${schema}/blog/${p.slug}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
    >
      {p.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(p.cover_image)} alt={p.title} className="h-44 w-full object-cover" />
      )}
      <div className="p-4">
        {p.category && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">{p.category.name}</span>
        )}
        <h2 className="mt-1 font-bold text-slate-900 group-hover:text-emerald-700">{p.title}</h2>
        {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.excerpt}</p>}
        <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-400">
          {p.author && <span>{p.author.name}</span>}
          {p.published_at && <span>· {new Date(p.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
          {p.reading_minutes > 0 && <span>· {p.reading_minutes} min</span>}
        </div>
      </div>
    </Link>
  );
}

export default async function BlogIndexPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { schema } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const [{ posts, pages }, tax] = await Promise.all([
    getBlogPosts(schema, { page, category: sp.category, tag: sp.tag }),
    getBlogTaxonomy(schema),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Blog</h1>
          {tax.categories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/store/${schema}/blog`} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${!sp.category ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600"}`}>All</Link>
              {tax.categories.map((c) => (
                <Link key={c.slug} href={`/store/${schema}/blog?category=${c.slug}`}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold ${sp.category === c.slug ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-white"}`}>
                  {c.name} ({c.post_count})
                </Link>
              ))}
            </div>
          )}
        </header>

        {posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No articles yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <PostCard key={p.slug} schema={schema} p={p} />)}
          </div>
        )}

        {pages > 1 && (
          <div className="mt-8 flex justify-center gap-2 text-sm">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={`/store/${schema}/blog?page=${n}${sp.category ? `&category=${sp.category}` : ""}`}
                className={`rounded-lg px-3 py-1.5 font-semibold ${n === page ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}>
                {n}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
