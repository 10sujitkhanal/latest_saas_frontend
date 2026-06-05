"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, User, Tag, ArrowRight, Share2 } from "lucide-react";
import type { PublicStorefront } from "@/lib/storefront/storefrontPublicApi";
import { WELLNESS_BLOG_POSTS, type WellnessBlogPost } from "@/lib/storefront/wellnessBlogData";
import { WellnessPageLayout } from "./WellnessPageLayout";

function getAllPosts(): WellnessBlogPost[] {
  try {
    const custom: WellnessBlogPost[] = JSON.parse(localStorage.getItem("wellness_blog_posts") ?? "[]");
    const customSlugs = new Set(custom.map(p => p.slug));
    return [...custom, ...WELLNESS_BLOG_POSTS.filter(p => !customSlugs.has(p.slug))];
  } catch { return WELLNESS_BLOG_POSTS; }
}

interface Props {
  storefront: PublicStorefront;
  post: WellnessBlogPost;
}

export function WellnessBlogPostClient({ storefront, post }: Props) {
  const [allPosts, setAllPosts] = useState<WellnessBlogPost[]>(WELLNESS_BLOG_POSTS);
  useEffect(() => { if (typeof window !== "undefined") setAllPosts(getAllPosts()); }, []);
  const related = allPosts.filter(p => p.slug !== post.slug && (p.category === post.category || p.tags.some(t => post.tags.includes(t)))).slice(0, 3);
  const slug = storefront.slug;

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: post.title, text: post.excerpt, url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  };

  return (
    <WellnessPageLayout storefront={storefront}>
      {/* Hero */}
      <div className={`bg-gradient-to-br ${post.gradientFrom} ${post.gradientTo} py-16`}>
        <div className="mx-auto max-w-3xl px-4 text-center">
          <span className="text-7xl block mb-4">{post.imageEmoji}</span>
          <span className="inline-block text-xs font-bold text-emerald-700 bg-white/80 rounded-full px-3 py-1 mb-4">{post.category}</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 leading-tight mb-4">{post.title}</h1>
          <p className="text-stone-600 text-base leading-relaxed mb-6 max-w-xl mx-auto">{post.excerpt}</p>
          <div className="flex items-center justify-center gap-4 text-sm text-stone-500">
            <span className="flex items-center gap-1.5"><User className="h-4 w-4" />{post.author}</span>
            <span className="text-stone-300">·</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{post.readingTime} min läsning</span>
            <span className="text-stone-300">·</span>
            <span>{new Date(post.publishedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Back link */}
        <Link href={`/s/${slug}/blog`} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-[#1a3a2b] mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Tillbaka till bloggen
        </Link>

        {/* Article body */}
        <article
          className="blog-content text-stone-700 leading-relaxed [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-[#1a3a2b] [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#1a3a2b] [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 [&_strong]:font-bold [&_strong]:text-stone-900 [&_a]:text-emerald-700 [&_a:hover]:underline"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1.5">
              <Tag className="h-3 w-3" /> {tag}
            </span>
          ))}
        </div>

        {/* Author card */}
        <div className="mt-10 flex items-center gap-4 bg-white rounded-2xl border border-stone-100 p-5">
          <div className="h-14 w-14 rounded-full bg-[#1a3a2b] flex items-center justify-center text-2xl shrink-0">
            {post.imageEmoji}
          </div>
          <div>
            <p className="font-bold text-stone-900">{post.author}</p>
            <p className="text-sm text-stone-500">{post.authorRole}</p>
            <p className="text-xs text-stone-400 mt-1">Certifierad expert med passion för naturlig hälsa och välmående.</p>
          </div>
        </div>

        {/* Share + CTA */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors">
            <Share2 className="h-4 w-4" /> Dela artikel
          </button>
          <Link href={`/s/${slug}`}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1a3a2b] text-white px-5 py-3 text-sm font-bold hover:bg-emerald-800 transition-colors">
            Utforska produkter från {storefront.name} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-5">Liknande artiklar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map(relPost => (
                <Link key={relPost.slug} href={`/s/${slug}/blog/${relPost.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-stone-100 hover:shadow-lg transition-all">
                  <div className={`h-28 bg-gradient-to-br ${relPost.gradientFrom} ${relPost.gradientTo} flex items-center justify-center`}>
                    <span className="text-4xl group-hover:scale-110 transition-transform">{relPost.imageEmoji}</span>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-stone-900 line-clamp-2 group-hover:text-[#1a3a2b] transition-colors">{relPost.title}</p>
                    <p className="text-[10px] text-stone-400 mt-1">{relPost.readingTime} min</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </WellnessPageLayout>
  );
}
