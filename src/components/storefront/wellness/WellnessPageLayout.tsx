"use client";

import Link from "next/link";
import { BookOpen, Tag, ShoppingBag } from "lucide-react";
import type { PublicStorefront } from "@/lib/storefront/storefrontPublicApi";
import { WellnessMarketplaceFooter } from "./WellnessMarketplaceFooter";

interface Props {
  storefront: PublicStorefront;
  children: React.ReactNode;
}

export function WellnessPageLayout({ storefront, children }: Props) {
  const slug = storefront.slug;

  return (
    <div className="min-h-screen bg-[#f7f5f0]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-[#1a3a2b] shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href={`/s/${slug}`} className="flex items-center gap-3 group">
            {storefront.logoUrl
              ? <img src={storefront.logoUrl} alt={storefront.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" />
              : <div className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-sm">{storefront.name[0]}</div>}
            <div>
              <p className="text-sm font-bold text-white">{storefront.name}</p>
              <p className="text-xs text-emerald-300">{storefront.city}</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href={`/s/${slug}`} className="text-emerald-300 hover:text-white text-sm font-medium transition-colors">Produkter</Link>
            <Link href={`/s/${slug}/deals`} className="flex items-center gap-1 text-emerald-300 hover:text-white text-sm font-medium transition-colors">
              <Tag className="h-3.5 w-3.5" /> Erbjudanden
            </Link>
            <Link href={`/s/${slug}/blog`} className="flex items-center gap-1 text-emerald-300 hover:text-white text-sm font-medium transition-colors">
              <BookOpen className="h-3.5 w-3.5" /> Blogg
            </Link>
          </div>

          <Link href={`/s/${slug}`}
            className="flex items-center gap-2 rounded-xl bg-amber-400 text-stone-900 px-4 py-2 text-sm font-bold hover:bg-amber-300 transition-colors shadow-md">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Handla nu</span>
          </Link>
        </div>
      </nav>

      {/* Page content */}
      {children}

      {/* Footer */}
      <WellnessMarketplaceFooter storefront={storefront} />
    </div>
  );
}
