// Server-side blog fetch. The public blog API takes the tenant <schema> in the
// PATH (resolves the tenant regardless of host), so the blog pages can be
// SERVER-rendered (metadata + JSON-LD in the initial HTML for crawlers) by
// hitting the apex API host. Dev uses NEXT_PUBLIC_API_BASE_URL.

function apiV1Base(): string {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL; // e.g. http://localhost:8000/api/v1/
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:8000/api/v1";
  const apex = (process.env.NEXT_PUBLIC_API_APEX || "api.morefungi.com").replace(/\/+$/, "");
  return `https://${apex}/api/v1`;
}

async function get(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${apiV1Base()}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 }, // ISR: re-fetch published content every 2 min
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json || json.success === false) return null;
    return json.data ?? json;
  } catch {
    return null;
  }
}

export interface BlogCard {
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
  author: { name: string; slug: string; avatar?: string } | null;
  reading_minutes: number;
  published_at: string | null;
  short_answer: string;
}

export interface BlogPostFull extends BlogCard {
  body: string;
  seo: {
    seo_title: string; meta_description: string; canonical_url: string;
    og_title: string; og_description: string; og_image: string;
    twitter_card: string; robots: string; focus_keyword: string; secondary_keywords: string[];
  };
  aeo: { short_answer: string; faqs: { q: string; a: string }[]; key_entities: string[]; tldr: string[] };
  json_ld: Record<string, unknown>[];
}

/** Prefix a relative /media path with the API host so images load cross-host. */
export function mediaUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  const base = apiV1Base().replace(/\/api\/v1\/?$/, "");
  return `${base}${path}`;
}

export async function getBlogPosts(
  schema: string,
  opts: { page?: number; category?: string; tag?: string } = {},
): Promise<{ posts: BlogCard[]; total: number; page: number; pages: number }> {
  const qs = new URLSearchParams();
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.category) qs.set("category", opts.category);
  if (opts.tag) qs.set("tag", opts.tag);
  const q = qs.toString() ? `?${qs}` : "";
  const data = await get(`/public/blog/${encodeURIComponent(schema)}/posts/${q}`);
  return data ?? { posts: [], total: 0, page: 1, pages: 0 };
}

export async function getBlogPost(schema: string, slug: string): Promise<BlogPostFull | null> {
  return get(`/public/blog/${encodeURIComponent(schema)}/posts/${encodeURIComponent(slug)}/`);
}

export async function getBlogTaxonomy(schema: string): Promise<{
  categories: { name: string; slug: string; post_count: number }[];
  tags: { name: string; slug: string }[];
}> {
  const data = await get(`/public/blog/${encodeURIComponent(schema)}/taxonomy/`);
  return data ?? { categories: [], tags: [] };
}
