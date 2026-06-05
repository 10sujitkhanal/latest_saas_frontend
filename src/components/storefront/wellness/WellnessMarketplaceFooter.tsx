"use client";

import Link from "next/link";
import { Leaf, Mail, Phone, MapPin } from "lucide-react";
import type { PublicStorefront } from "@/lib/storefront/storefrontPublicApi";

interface Props {
  storefront: PublicStorefront;
}

const SOCIAL_META: Record<string, { label: string; icon: string }> = {
  facebook:  { label: "Facebook",  icon: "📘" },
  instagram: { label: "Instagram", icon: "📷" },
  tiktok:    { label: "TikTok",    icon: "🎵" },
  youtube:   { label: "YouTube",   icon: "▶️" },
  linkedin:  { label: "LinkedIn",  icon: "💼" },
  twitter:   { label: "X",         icon: "𝕏" },
  website:   { label: "Website",   icon: "🌐" },
};

export function WellnessMarketplaceFooter({ storefront }: Props) {
  const slug = storefront.slug;

  const socialLinks = Object.entries(storefront.social ?? {})
    .filter(([, url]) => url && url.trim())
    .map(([key, url]) => ({
      key,
      url: url as string,
      label: SOCIAL_META[key]?.label ?? key,
      icon: SOCIAL_META[key]?.icon ?? "🔗",
    }));

  return (
    <footer className="bg-[#1a3a2b]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              {storefront.logoUrl
                ? <img src={storefront.logoUrl} alt={storefront.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" />
                : <div className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"><Leaf className="h-5 w-5 text-amber-400" /></div>}
              <span className="text-base font-extrabold text-white">{storefront.name}</span>
            </div>
            <p className="text-emerald-300 text-sm leading-relaxed mb-5">
              {storefront.tagline || "Naturliga hälsoprodukter av högsta kvalitet — certifierade, testade och levererade till din dörr."}
            </p>
            <div className="space-y-2 text-sm text-emerald-400">
              {storefront.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{storefront.city}</span>
                </div>
              )}
              {storefront.contactEmail && (
                <a href={`mailto:${storefront.contactEmail}`} className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{storefront.contactEmail}</span>
                </a>
              )}
              {storefront.contactPhone && (
                <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{storefront.contactPhone}</span>
                </a>
              )}
            </div>
            {/* Social */}
            {socialLinks.length > 0 && (
              <div className="flex items-center flex-wrap gap-3 mt-5">
                {socialLinks.map(s => (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                    title={s.label}
                    className="h-8 px-2.5 flex items-center justify-center gap-1.5 rounded-full bg-white/10 text-emerald-300 hover:bg-amber-400 hover:text-stone-900 transition-all text-xs font-semibold">
                    <span className="text-sm">{s.icon}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Handla</h4>
            <ul className="space-y-3 text-sm text-emerald-200">
              <li><Link href={`/s/${slug}`} className="hover:text-white transition-colors">Alla produkter</Link></li>
              <li><Link href={`/s/${slug}/deals`} className="hover:text-white transition-colors">Erbjudanden &amp; deals</Link></li>
              <li><Link href={`/s/${slug}/search`} className="hover:text-white transition-colors">Sök produkter</Link></li>
              <li><Link href={`/s/${slug}/blog`} className="hover:text-white transition-colors">Blogg &amp; guider</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Kategorier</h4>
            <ul className="space-y-3 text-sm text-emerald-200">
              <li><Link href={`/s/${slug}`} className="hover:text-white transition-colors">Vitaminer &amp; Mineraler</Link></li>
              <li><Link href={`/s/${slug}`} className="hover:text-white transition-colors">Energi &amp; Uthållighet</Link></li>
              <li><Link href={`/s/${slug}`} className="hover:text-white transition-colors">Sömn &amp; Återhämtning</Link></li>
              <li><Link href={`/s/${slug}`} className="hover:text-white transition-colors">Skönhet &amp; Kollagen</Link></li>
              <li><Link href={`/s/${slug}`} className="hover:text-white transition-colors">Träning &amp; Protein</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Information</h4>
            <ul className="space-y-3 text-sm text-emerald-200">
              <li><Link href={`/s/${slug}/terms`} className="hover:text-white transition-colors">Köpvillkor</Link></li>
              <li><Link href={`/s/${slug}/privacy`} className="hover:text-white transition-colors">Integritetspolicy</Link></li>
              <li><Link href={`/s/${slug}/cookies`} className="hover:text-white transition-colors">Cookiepolicy</Link></li>
              <li><Link href={`/s/${slug}/refund`} className="hover:text-white transition-colors">Retur &amp; Reklamation</Link></li>
              <li><Link href={`/s/${slug}/shipping`} className="hover:text-white transition-colors">Leveranspolicy</Link></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-emerald-500">
            © {new Date().getFullYear()} {storefront.name}. Alla rättigheter förbehållna.
          </p>
          <div className="flex items-center gap-4 text-xs text-emerald-500">
            <Link href={`/s/${slug}/terms`} className="hover:text-white transition-colors">Villkor</Link>
            <span>·</span>
            <Link href={`/s/${slug}/privacy`} className="hover:text-white transition-colors">Integritet</Link>
            <span>·</span>
            <span className="text-emerald-600">Powered by Merkoll</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
