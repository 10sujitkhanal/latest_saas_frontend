"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { PublicStorefront } from "@/lib/storefront/storefrontPublicApi";
import { WellnessPageLayout } from "./WellnessPageLayout";

interface Props {
  storefront: PublicStorefront;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function WellnessLegalPage({ storefront, title, lastUpdated, children }: Props) {
  return (
    <WellnessPageLayout storefront={storefront}>
      {/* Header */}
      <div className="bg-[#1a3a2b] py-10">
        <div className="mx-auto max-w-3xl px-4">
          <Link href={`/s/${storefront.slug}`} className="flex items-center gap-1.5 text-emerald-300 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Tillbaka till butiken
          </Link>
          <h1 className="text-3xl font-extrabold text-white">{title}</h1>
          <p className="text-emerald-400 text-sm mt-2">Senast uppdaterad: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 sm:p-10">
          <div
            className="prose prose-stone prose-sm sm:prose max-w-none
              prose-headings:font-bold prose-headings:text-[#1a3a2b]
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
              prose-p:text-stone-700 prose-p:leading-relaxed
              prose-ul:space-y-1.5 prose-li:text-stone-700
              prose-strong:text-stone-900"
          >
            {children}
          </div>
        </div>

        <p className="text-xs text-stone-400 text-center mt-6">
          {storefront.name} · {storefront.city}
          {storefront.contactEmail && <> · <a href={`mailto:${storefront.contactEmail}`} className="hover:text-stone-600">{storefront.contactEmail}</a></>}
        </p>
      </div>
    </WellnessPageLayout>
  );
}
