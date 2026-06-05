"use client";

import Link from "next/link";
import { Search, X, SlidersHorizontal, Plus, ArrowRight, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import type { PublicStorefront, PublicItem } from "@/lib/storefront/storefrontPublicApi";
import { WellnessPageLayout } from "./WellnessPageLayout";

interface Props {
  storefront: PublicStorefront;
  items: PublicItem[];
  initialQuery?: string;
  initialGoal?: string;
  initialCategory?: string;
}

const GOALS = [
  { key: "energy",   label: "Energi",    icon: "⚡" },
  { key: "immunity", label: "Immunitet", icon: "🛡️" },
  { key: "sleep",    label: "Sömn",      icon: "😴" },
  { key: "weight",   label: "Vikt",      icon: "⚖️" },
  { key: "fitness",  label: "Träning",   icon: "💪" },
  { key: "beauty",   label: "Skönhet",   icon: "✨" },
  { key: "stress",   label: "Stress",    icon: "🧘" },
  { key: "kids",     label: "Barn",      icon: "👶" },
];

function getGoals(item: PublicItem): string[] {
  const raw = (item as any).attributes?.goals;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return raw.split(",").map((s: string) => s.trim());
  return [];
}

function formatPrice(n: number, currency = "SEK"): string {
  return `${n.toLocaleString("sv-SE")} ${currency}`;
}

export function WellnessSearchClient({ storefront, items, initialQuery, initialGoal, initialCategory }: Props) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [activeGoal, setActiveGoal] = useState(initialGoal ?? "");
  const [activeCategory, setActiveCategory] = useState(initialCategory ?? "");
  const [sortBy, setSortBy] = useState<"relevance" | "price_asc" | "price_desc">("relevance");
  const [showFilters, setShowFilters] = useState(false);

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[], [items]);

  const results = useMemo(() => {
    let list = [...items];

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(item => {
        const hay = `${item.title} ${item.shortDescription ?? ""} ${item.category ?? ""} ${(item as any).attributes?.ingredients ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (activeCategory) list = list.filter(i => i.category === activeCategory);

    if (activeGoal) {
      list = list.filter(i => getGoals(i).includes(activeGoal));
    }

    if (sortBy === "price_asc") list.sort((a, b) => (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price));
    if (sortBy === "price_desc") list.sort((a, b) => (b.discountPrice ?? b.price) - (a.discountPrice ?? a.price));

    return list;
  }, [items, query, activeCategory, activeGoal, sortBy]);

  const hasFilters = query || activeGoal || activeCategory;
  const clearFilters = () => { setQuery(""); setActiveGoal(""); setActiveCategory(""); };

  return (
    <WellnessPageLayout storefront={storefront}>
      {/* Search bar hero */}
      <div className="bg-[#1a3a2b] py-10">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-2xl font-extrabold text-white mb-4 text-center">Sök produkter</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sök bland alla naturliga hälsoprodukter…"
              autoFocus
              className="w-full rounded-2xl bg-white pl-12 pr-12 py-4 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-xl"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:border-emerald-400 transition-colors">
            <SlidersHorizontal className="h-4 w-4" /> Filter
            {(activeGoal || activeCategory) && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
          </button>

          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-200">
            <option value="relevance">Sortera: Relevans</option>
            <option value="price_asc">Pris: Lägst först</option>
            <option value="price_desc">Pris: Högst först</option>
          </select>

          <span className="text-sm text-stone-400 ml-auto">
            {results.length} produkt{results.length !== 1 ? "er" : ""}
            {hasFilters && <button onClick={clearFilters} className="ml-2 text-emerald-600 underline">Rensa</button>}
          </span>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mb-6 bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            {/* Goals */}
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">Hälsomål</p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <button key={g.key} onClick={() => setActiveGoal(activeGoal === g.key ? "" : g.key)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${activeGoal === g.key ? "bg-[#1a3a2b] text-white border-[#1a3a2b]" : "bg-white border-stone-200 text-stone-700 hover:border-emerald-300"}`}>
                    {g.icon} {g.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">Kategori</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? "" : cat)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${activeCategory === cat ? "bg-[#1a3a2b] text-white border-[#1a3a2b]" : "bg-white border-stone-200 text-stone-700 hover:border-emerald-300"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {results.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-100">
            <Search className="mx-auto h-12 w-12 text-stone-200 mb-4" />
            <p className="text-stone-600 font-semibold text-lg mb-1">Inga produkter hittades</p>
            <p className="text-stone-400 text-sm mb-6">Prova ett annat sökord eller ta bort filter</p>
            {hasFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-2 rounded-xl bg-[#1a3a2b] text-white px-5 py-2.5 text-sm font-bold hover:bg-emerald-800 transition-colors">
                <Filter className="h-4 w-4" /> Rensa alla filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {results.map(item => {
              const price = item.discountPrice ?? item.price;
              return (
                <Link key={item.id} href={`/s/${storefront.slug}/items/${item.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-stone-100 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="h-36 bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50 flex items-center justify-center relative">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      : <span className="text-5xl group-hover:scale-110 transition-transform">{item.imageEmoji || "🌿"}</span>}
                    {item.discountPrice && (
                      <span className="absolute top-2 left-2 text-[10px] font-bold bg-rose-500 text-white rounded-full px-2 py-0.5">
                        -{Math.round((1 - item.discountPrice / item.price) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-stone-900 leading-snug line-clamp-2 group-hover:text-[#1a3a2b] transition-colors mb-1.5">{item.title}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#1a3a2b]">{formatPrice(price, item.currency)}</p>
                      <span className="h-6 w-6 rounded-lg bg-[#1a3a2b] text-white flex items-center justify-center">
                        <Plus className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Popular searches */}
        {!hasFilters && items.length > 0 && (
          <div className="mt-12">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Populärt just nu</p>
            <div className="flex flex-wrap gap-2">
              {["D-vitamin", "Magnesium", "Omega-3", "Protein", "Kollagen", "Adaptogener", "Probiotika"].map(term => (
                <button key={term} onClick={() => setQuery(term)}
                  className="text-xs bg-white border border-stone-200 text-stone-700 rounded-full px-3 py-1.5 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </WellnessPageLayout>
  );
}
