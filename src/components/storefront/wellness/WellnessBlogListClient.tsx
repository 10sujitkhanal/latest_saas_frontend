"use client";

import Link from "next/link";
import { Clock, User, Tag, ArrowRight, Search } from "lucide-react";
import { useState, useEffect } from "react";
import type { PublicStorefront } from "@/lib/storefront/storefrontPublicApi";
import { WELLNESS_BLOG_POSTS, type WellnessBlogPost } from "@/lib/storefront/wellnessBlogData";
import { WellnessPageLayout } from "./WellnessPageLayout";

const BLOG_STORAGE_KEY = "wellness_blog_posts";
const HIDDEN_STORAGE_KEY = "wellness_blog_posts_hidden";

function getActivePosts(): WellnessBlogPost[] {
  try {
    const hidden = new Set<string>(JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) ?? "[]"));
    const custom: WellnessBlogPost[] = JSON.parse(localStorage.getItem(BLOG_STORAGE_KEY) ?? "[]");
    const base = WELLNESS_BLOG_POSTS.filter(p => !hidden.has(p.slug));
    const customSlugs = new Set(custom.map(p => p.slug));
    const baseFiltered = base.filter(p => !customSlugs.has(p.slug));
    return [...custom.filter(p => !hidden.has(p.slug)), ...baseFiltered];
  } catch { return WELLNESS_BLOG_POSTS; }
}

interface Props {
  storefront: PublicStorefront;
}

function BlogCard({ post, slug }: { post: WellnessBlogPost; slug: string }) {
  return (
    <Link href={`/s/${slug}/blog/${post.slug}`}
      className="group bg-white rounded-3xl overflow-hidden border border-stone-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className={`h-48 bg-gradient-to-br ${post.gradientFrom} ${post.gradientTo} flex items-center justify-center relative overflow-hidden`}>
        <span className="text-7xl group-hover:scale-110 transition-transform duration-500 select-none">{post.imageEmoji}</span>
        <span className="absolute bottom-3 right-3 text-[10px] font-bold bg-white/90 text-stone-700 rounded-full px-2.5 py-1">
          {post.readingTime} min
        </span>
      </div>
      <div className="p-5">
        <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1 mb-3">
          {post.category}
        </span>
        <h2 className="font-bold text-stone-900 text-base leading-snug group-hover:text-[#1a3a2b] transition-colors mb-2 line-clamp-2">
          {post.title}
        </h2>
        <p className="text-sm text-stone-500 leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span>{post.author}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{new Date(post.publishedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function WellnessBlogListClient({ storefront }: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Alla");
  const [allPosts, setAllPosts] = useState<WellnessBlogPost[]>(WELLNESS_BLOG_POSTS);

  useEffect(() => { setAllPosts(getActivePosts()); }, []);

  const ALL_CATEGORIES = Array.from(new Set(allPosts.map(p => p.category)));
  const featured = allPosts.filter(p => p.featured);
  const rest = allPosts.filter(p => !p.featured);

  const filtered = allPosts.filter(p => {
    const matchCat = activeCategory === "Alla" || p.category === activeCategory;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt.toLowerCase().includes(search.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const showingAll = activeCategory !== "Alla" || search;

  return (
    <WellnessPageLayout storefront={storefront}>
      {/* Hero */}
      <div className="bg-[#1a3a2b] py-14">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-white/10 rounded-full px-3 py-1.5 mb-4">
            🌿 Wellness-guider &amp; artiklar
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Kunskapscentrum för din hälsa
          </h1>
          <p className="text-emerald-200 text-base sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            Expertartiklar om naturliga produkter, kosttillskott och ett hälsosamt liv — skrivet av certifierade nutritionister.
          </p>
          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sök artiklar, ämnen eller taggar…"
              className="w-full rounded-2xl bg-white border-0 pl-11 pr-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          {["Alla", ...ALL_CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all border ${activeCategory === cat ? "bg-[#1a3a2b] text-white border-[#1a3a2b] shadow-sm" : "bg-white text-stone-600 border-stone-200 hover:border-emerald-400"}`}>
              {cat}
            </button>
          ))}
        </div>

        {showingAll ? (
          /* Filtered results */
          filtered.length === 0 ? (
            <div className="text-center py-20">
              <span className="text-5xl mb-4 block">🔍</span>
              <p className="text-stone-500 font-medium">Inga artiklar hittades.</p>
              <button onClick={() => { setSearch(""); setActiveCategory("Alla"); }} className="mt-3 text-sm text-emerald-600 underline">Rensa filter</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(post => <BlogCard key={post.slug} post={post} slug={storefront.slug} />)}
            </div>
          )
        ) : (
          <>
            {/* Featured posts */}
            {featured.length > 0 && (
              <div className="mb-12">
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-5">Utvalda artiklar</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Hero post */}
                  <Link href={`/s/${storefront.slug}/blog/${featured[0].slug}`}
                    className="group lg:col-span-2 bg-white rounded-3xl overflow-hidden border border-stone-100 hover:shadow-xl transition-all">
                    <div className={`h-64 bg-gradient-to-br ${featured[0].gradientFrom} ${featured[0].gradientTo} flex items-center justify-center`}>
                      <span className="text-8xl group-hover:scale-110 transition-transform duration-500">{featured[0].imageEmoji}</span>
                    </div>
                    <div className="p-6">
                      <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1 mb-3">{featured[0].category}</span>
                      <h2 className="text-xl font-bold text-stone-900 mb-2 group-hover:text-[#1a3a2b] transition-colors">{featured[0].title}</h2>
                      <p className="text-sm text-stone-500 line-clamp-2 mb-4">{featured[0].excerpt}</p>
                      <div className="flex items-center gap-3 text-xs text-stone-400">
                        <span>{featured[0].author}</span>
                        <span>·</span>
                        <span>{featured[0].readingTime} min läsning</span>
                        <span className="ml-auto flex items-center gap-1 text-emerald-600 font-semibold">Läs mer <ArrowRight className="h-3.5 w-3.5" /></span>
                      </div>
                    </div>
                  </Link>
                  {/* Side posts */}
                  <div className="flex flex-col gap-4">
                    {featured.slice(1, 3).map(post => <BlogCard key={post.slug} post={post} slug={storefront.slug} />)}
                  </div>
                </div>
              </div>
            )}

            {/* More articles */}
            {rest.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-5">Fler artiklar</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map(post => <BlogCard key={post.slug} post={post} slug={storefront.slug} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Popular tags */}
        <div className="mt-14 bg-white rounded-3xl p-6 border border-stone-100">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Populära ämnen</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(WELLNESS_BLOG_POSTS.flatMap(p => p.tags))).slice(0, 18).map(tag => (
              <button key={tag} onClick={() => setSearch(tag)}
                className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-full px-3 py-1.5 transition-colors">
                <Tag className="h-3 w-3" /> {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </WellnessPageLayout>
  );
}
