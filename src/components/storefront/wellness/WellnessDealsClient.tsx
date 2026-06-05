"use client";

import Link from "next/link";
import { Tag, Copy, Check, ArrowRight, Clock, ShoppingBag, AlertCircle } from "lucide-react";
import { useState } from "react";
import type { PublicStorefront, PublicOffer } from "@/lib/storefront/storefrontPublicApi";
import { WellnessPageLayout } from "./WellnessPageLayout";

interface Props {
  storefront: PublicStorefront;
  offers: PublicOffer[];
}

function OfferCard({ offer, storeSlug }: { offer: PublicOffer; storeSlug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!offer.code) return;
    navigator.clipboard?.writeText(offer.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const discountLabel = offer.discountType === "percentage"
    ? `-${offer.discountValue}%`
    : offer.discountType === "bogo"
    ? "2 för 1"
    : `${offer.discountValue} kr rabatt`;

  const isExpiringSoon = offer.endDate
    ? new Date(offer.endDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden hover:shadow-lg transition-all group">
      {/* Top accent */}
      <div className="bg-[#1a3a2b] px-5 pt-5 pb-4 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/5" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <span className="inline-block text-xl font-black text-amber-400 mb-1">{discountLabel}</span>
            <h3 className="text-base font-bold text-white leading-snug">{offer.title}</h3>
          </div>
          <div className="shrink-0 h-12 w-12 rounded-2xl bg-amber-400 flex items-center justify-center">
            <Tag className="h-5 w-5 text-stone-900" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {offer.description && (
          <p className="text-sm text-stone-600 leading-relaxed">{offer.description}</p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-2 text-xs text-stone-500">
          {offer.minOrderValue && offer.minOrderValue > 0 && (
            <span className="flex items-center gap-1 bg-stone-50 rounded-full px-2.5 py-1">
              <ShoppingBag className="h-3 w-3" /> Min. order {offer.minOrderValue} kr
            </span>
          )}
          {offer.endDate && (
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${isExpiringSoon ? "bg-red-50 text-red-600" : "bg-stone-50"}`}>
              <Clock className="h-3 w-3" />
              {isExpiringSoon ? "Snart slut! " : "Gäller till "}
              {new Date(offer.endDate).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Coupon code */}
        {offer.code && (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50 px-4 py-2.5">
              <span className="font-mono font-bold text-[#1a3a2b] tracking-wider text-sm">{offer.code}</span>
            </div>
            <button onClick={handleCopy}
              className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all ${copied ? "bg-green-500 text-white" : "bg-stone-100 text-stone-600 hover:bg-[#1a3a2b] hover:text-white"}`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}
        {copied && <p className="text-xs text-green-600 font-medium">Kod kopierad!</p>}

        {/* CTA */}
        <Link href={`/s/${storeSlug}`}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#1a3a2b] text-white py-3 text-sm font-bold hover:bg-emerald-800 transition-colors">
          Handla nu <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function WellnessDealsClient({ storefront, offers }: Props) {
  const activeOffers = offers.filter(o => {
    if (o.endDate && new Date(o.endDate) < new Date()) return false;
    return true;
  });

  return (
    <WellnessPageLayout storefront={storefront}>
      {/* Hero */}
      <div className="bg-[#1a3a2b] relative overflow-hidden py-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 right-1/4 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-56 h-56 rounded-full bg-emerald-500/10 blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <span className="text-5xl block mb-4">🏷️</span>
          <h1 className="text-4xl font-extrabold text-white mb-3">Aktuella erbjudanden</h1>
          <p className="text-emerald-200 text-base max-w-md mx-auto">
            Spara på naturliga hälsoprodukter av högsta kvalitet — alla priser inkl. moms.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-amber-400 text-stone-900 rounded-full px-4 py-1.5 text-sm font-bold">
            <Tag className="h-4 w-4" /> {activeOffers.length} aktiva erbjudanden
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        {activeOffers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-100">
            <AlertCircle className="mx-auto h-12 w-12 text-stone-200 mb-4" />
            <p className="text-stone-500 font-semibold text-lg mb-2">Inga aktiva erbjudanden just nu</p>
            <p className="text-stone-400 text-sm mb-6">Håll utkik — nya erbjudanden dyker upp regelbundet.</p>
            <Link href={`/s/${storefront.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1a3a2b] text-white px-6 py-3 text-sm font-bold hover:bg-emerald-800 transition-colors">
              <ShoppingBag className="h-4 w-4" /> Utforska alla produkter
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeOffers.map(offer => (
              <OfferCard key={offer.id} offer={offer} storeSlug={storefront.slug} />
            ))}
          </div>
        )}

        {/* Trust callout */}
        <div className="mt-12 bg-white rounded-3xl border border-stone-100 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <span className="text-4xl shrink-0">🔒</span>
          <div>
            <p className="font-bold text-stone-900 mb-1">Säker handel med {storefront.name}</p>
            <p className="text-sm text-stone-500">Alla erbjudanden är genuina och transparenta. Inga dolda avgifter. 30 dagars öppet köp på alla produkter.</p>
          </div>
          <Link href={`/s/${storefront.slug}`}
            className="shrink-0 flex items-center gap-2 rounded-xl bg-amber-400 text-stone-900 px-5 py-2.5 text-sm font-bold hover:bg-amber-300 transition-colors">
            Handla <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </WellnessPageLayout>
  );
}
