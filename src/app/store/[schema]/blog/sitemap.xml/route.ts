import { getBlogPosts } from "@/lib/blog/blogApi";

// Per-tenant blog sitemap at /store/<schema>/blog/sitemap.xml — lists published
// posts so search engines discover + index the tenant's blog. Absolute URLs are
// built from the request host (the tenant's storefront host).
export async function GET(request: Request, { params }: { params: Promise<{ schema: string }> }) {
  const { schema } = await params;
  const origin = new URL(request.url).origin;
  const base = `${origin}/store/${schema}/blog`;

  // Walk pages (cap to keep it bounded).
  const urls: { loc: string; lastmod?: string }[] = [{ loc: base }];
  let page = 1;
  for (; page <= 20; page++) {
    const { posts, pages } = await getBlogPosts(schema, { page });
    for (const p of posts) {
      urls.push({ loc: `${base}/${p.slug}`, lastmod: p.published_at ?? undefined });
    }
    if (page >= pages) break;
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}</url>`,
      )
      .join("\n") +
    `\n</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
