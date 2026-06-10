"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin, Phone, Mail, Mountain, Calendar, Users, Clock, CheckCircle2,
  ChevronRight, X, Loader2, Shield, Star, Tag, Compass, ArrowRight, Settings2,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicBooking } from "@/lib/storefront/storefrontPublicApi";
import MembershipJoinSection from "@/components/storefront/MembershipJoinSection";
import { formatCurrencyMarket } from "@/lib/utils/currency";
import { getIndustryCapabilities } from "@/lib/industry/config";
import { getIndustryStorefrontConfig } from "@/lib/moredealsx/industry-config";
import { loadPinnedItems, type CrossSellItem } from "@/lib/storefront/crossSellCatalogue";

interface Props {
  storefront:   PublicStorefront;
  items:        PublicItem[];
  offers:       PublicOffer[];
  availability: PublicAvailability | null;
  refCode?:     string;
  joinIntent?:  boolean;
}

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function getAttr(item: PublicItem, key: string): unknown {
  return (item as unknown as { attributes?: Record<string, unknown> }).attributes?.[key] ?? "";
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:     "bg-green-100 text-green-800",
  moderate: "bg-amber-100 text-amber-800",
  hard:     "bg-red-100 text-red-800",
  expert:   "bg-purple-100 text-purple-800",
};

function PackageCard({ pkg, currency, onBook }: {
  pkg: PublicItem; currency: string; onBook: (p: PublicItem) => void;
}) {
  const displayPrice = pkg.discountPrice ?? pkg.price;
  const discount = pkg.discountPrice != null && pkg.discountPrice < pkg.price;
  const difficulty = String(getAttr(pkg, "difficulty") || "");
  const duration   = String(getAttr(pkg, "duration") || getAttr(pkg, "days") || "");
  const groupSize  = String(getAttr(pkg, "group_size") || getAttr(pkg, "groupSize") || "");
  const elevation  = String(getAttr(pkg, "max_altitude") || getAttr(pkg, "elevation") || "");

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-44 bg-gradient-to-br from-emerald-800 to-green-900 flex items-center justify-center overflow-hidden">
        {pkg.imageUrl
          ? <img src={pkg.imageUrl} alt={pkg.title} className="w-full h-full object-cover" />
          : <div className="text-7xl opacity-80">{pkg.imageEmoji || "🏔️"}</div>}
        {difficulty && (
          <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full capitalize ${DIFFICULTY_COLORS[difficulty.toLowerCase()] ?? "bg-slate-100 text-slate-700"}`}>
            {difficulty}
          </span>
        )}
        {discount && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">SALE</span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-xs text-emerald-600 font-medium mb-0.5">{pkg.category}</p>
            <h3 className="font-bold text-slate-900 leading-tight">{pkg.title}</h3>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-emerald-700 text-lg">{fmt(displayPrice, currency)}</p>
            {discount && <p className="text-xs text-slate-400 line-through">{fmt(pkg.price, currency)}</p>}
            <p className="text-[10px] text-slate-400">per person</p>
          </div>
        </div>

        {pkg.shortDescription && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-2">{pkg.shortDescription}</p>
        )}

        <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-600">
          {duration && (
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" />{duration} days</span>
          )}
          {groupSize && (
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" />Max {groupSize} pax</span>
          )}
          {elevation && (
            <span className="flex items-center gap-1.5"><Mountain className="w-3.5 h-3.5 text-slate-400" />{elevation}m</span>
          )}
        </div>

        <button onClick={() => onBook(pkg)}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          <Compass className="w-4 h-4" />
          Book This Trip
        </button>
      </div>
    </div>
  );
}

function BookingModal({ pkg, storefront, onClose }: {
  pkg: PublicItem | null; storefront: PublicStorefront; onClose: () => void;
}) {
  const currency = storefront.currency ?? "SEK";
  const [form, setForm] = useState({ name: "", phone: "", email: "", date: "", guests: 1, notes: "" });
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalPrice = pkg ? (pkg.discountPrice ?? pkg.price) * form.guests : 0;
  const canSubmit  = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && form.date;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await createPublicBooking(storefront.slug, {
        itemId:        pkg?.id,
        bookingType:   "trekking",
        customerName:  form.name,
        customerPhone: form.phone,
        customerEmail: form.email || undefined,
        requestedDate: form.date,
        guests:        form.guests,
        notes:         form.notes || undefined,
      });
      setRef((res as { bookingRef?: string }).bookingRef ?? "TK-" + Date.now().toString(36).toUpperCase());
      setDone(true);
    } catch {
      setError("Booking failed. Please contact us directly.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Book Your Adventure</h2>
            {pkg && <p className="text-sm text-slate-500">{pkg.title}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-1">Booking Confirmed!</h3>
            <p className="text-slate-500 text-sm mb-2">Ref: <span className="font-mono font-bold text-emerald-700">{ref}</span></p>
            <p className="text-sm text-slate-500">Our team will contact you within 24 hours to confirm details.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700">Done</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Preferred Start Date *</label>
              <input type="date" min={new Date().toISOString().split("T")[0]} value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Group Size</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(p => ({ ...p, guests: Math.max(1, p.guests - 1) }))}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 font-bold text-slate-700">−</button>
                <span className="font-semibold text-slate-900 w-6 text-center">{form.guests}</span>
                <button onClick={() => setForm(p => ({ ...p, guests: Math.min(20, p.guests + 1) }))}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 font-bold text-slate-700">+</button>
                <span className="text-sm text-slate-500">person{form.guests !== 1 ? "s" : ""}</span>
              </div>
            </div>
            {pkg && form.guests > 0 && (
              <div className="bg-emerald-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-emerald-900">{form.guests} × {fmt(pkg.discountPrice ?? pkg.price, currency)}</p>
                  <p className="text-xs text-emerald-600">per person</p>
                </div>
                <p className="text-lg font-bold text-emerald-800">{fmt(totalPrice, currency)}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Your Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Erik Svensson"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Phone *</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+46 70 …"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@email.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Additional Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Fitness level, dietary requirements, experience, etc."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}
        {!done && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmit} disabled={!canSubmit || loading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mountain className="w-4 h-4" />}
              Confirm Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TrekkingStorefrontClient({ storefront, items, offers, joinIntent }: Props) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [selectedPkg, setSelectedPkg] = useState<PublicItem | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<CrossSellItem[]>([]);

  useEffect(() => {
    setPinnedItems(loadPinnedItems(storefront.id ?? storefront.slug));
  }, [storefront.id, storefront.slug]);
  const currency = storefront.currency ?? "SEK";

  const visibleItems = items.filter(i => i.visible);
  const categories   = ["All", ...Array.from(new Set(visibleItems.map(i => i.category).filter(Boolean)))];
  const difficulties = ["All", "Easy", "Moderate", "Hard", "Expert"];

  const filtered = visibleItems
    .filter(i => activeCategory === "All" || i.category === activeCategory)
    .filter(i => {
      if (difficultyFilter === "All") return true;
      const d = String(getAttr(i, "difficulty") || "").toLowerCase();
      return d === difficultyFilter.toLowerCase();
    });

  const handleBook = (pkg: PublicItem) => {
    setSelectedPkg(pkg);
    setShowBooking(true);
  };

  return (
    <div className="min-h-screen bg-emerald-50">
      {storefront.announcement && storefront.announcementVisible && (
        <div className="bg-emerald-700 text-white text-center text-sm py-2 px-4 font-medium">
          {storefront.announcement}
        </div>
      )}

      {/* Hero */}
      <div className="relative h-[380px] bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 overflow-hidden">
        {storefront.bannerUrl
          ? <img src={storefront.bannerUrl} alt={storefront.name} className="absolute inset-0 w-full h-full object-cover opacity-50" />
          : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          {storefront.logoUrl && (
            <img src={storefront.logoUrl} alt={storefront.name} className="w-16 h-16 rounded-2xl object-contain bg-white/10 p-2 mb-3 shadow-xl" />
          )}
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2">{storefront.name}</h1>
          <p className="text-emerald-200 mb-2 text-lg">{storefront.tagline || "Explore the World with Expert Guides"}</p>
          <p className="flex items-center gap-1.5 text-emerald-200/70 text-sm mb-6">
            <MapPin className="w-4 h-4" />{storefront.city}
          </p>
          <button onClick={() => { setSelectedPkg(null); setShowBooking(true); }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-2xl transition-colors shadow-lg">
            <Compass className="w-5 h-5" />
            Plan Your Adventure
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">

        {/* Trust */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: "🏔️", text: "Expert Guides" },
            { icon: "🛡️", text: "Safe & Insured" },
            { icon: "👥", text: "Group Discounts" },
            { icon: "🗺️", text: "Flexible Itinerary" },
          ].map(t => (
            <div key={t.text} className="flex items-center gap-2.5 bg-white rounded-xl border border-emerald-100 px-4 py-3">
              <span className="text-xl shrink-0">{t.icon}</span>
              <span className="text-xs font-medium text-slate-700">{t.text}</span>
            </div>
          ))}
        </div>

        {/* Offers */}
        {offers.filter(o => o.visible).length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-600" /> Special Offers
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {offers.filter(o => o.visible).map(o => (
                <div key={o.id} className="shrink-0 min-w-[200px] bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4">
                  <span className="text-2xl">{o.imageEmoji || "🏕️"}</span>
                  <p className="font-bold mt-1 text-sm">{o.title}</p>
                  {o.discountType === "percentage" && <p className="text-emerald-100 text-sm mt-0.5">{o.discountValue}% OFF</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Membership join (scan-QR → become a member) — after hero, before packages */}
        {(storefront.memberships?.length ?? 0) > 0 && (
          <MembershipJoinSection slug={storefront.slug} memberships={storefront.memberships ?? []} joinIntent={joinIntent} />
        )}

        {/* Packages */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Mountain className="w-5 h-5 text-emerald-600" /> Our Packages
          </h2>

          <div className="flex flex-wrap gap-4 mb-5">
            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button key={c} onClick={() => setActiveCategory(c)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${activeCategory === c ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300"}`}>
                  {c}
                </button>
              ))}
            </div>
            {/* Difficulty filter */}
            <div className="flex flex-wrap gap-2">
              {difficulties.map(d => (
                <button key={d} onClick={() => setDifficultyFilter(d)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${difficultyFilter === d ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                  {d === "All" ? "Any Difficulty" : d}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-emerald-100">
              <Mountain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No packages match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(pkg => (
                <PackageCard key={pkg.id} pkg={pkg} currency={currency} onBook={handleBook} />
              ))}
            </div>
          )}
        </section>

        {/* Cross-sell */}
        {pinnedItems.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">Also Available from Our Partners</h2>
              <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                <Settings2 className="w-3.5 h-3.5" /> Edit
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pinnedItems.map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{item.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm leading-tight">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{item.businessName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{item.type}</span>
                    <span className="text-sm font-bold text-slate-900">{item.price} {item.currency}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : getIndustryCapabilities(storefront.industry).crossSellCategories.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">Extend Your Adventure</h2>
              <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-700 font-medium">
                <Settings2 className="w-3.5 h-3.5" /> Set up cross-sell
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {getIndustryCapabilities(storefront.industry).crossSellCategories.map((cat) => {
                const cfg = getIndustryStorefrontConfig(cat as never);
                return (
                  <Link key={cat} href={`/moredealsx/businesses?industry=${encodeURIComponent(cat)}`}
                    className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow group">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{cfg.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{cfg.primaryAction}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Contact */}
        <section className="bg-slate-900 rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">Get in Touch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {storefront.contactPhone && (
              <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 hover:bg-white/20">
                <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
                <div><p className="text-[10px] text-white/50">Phone</p><p className="text-sm font-medium">{storefront.contactPhone}</p></div>
              </a>
            )}
            {storefront.contactEmail && (
              <a href={`mailto:${storefront.contactEmail}`} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 hover:bg-white/20">
                <Mail className="w-5 h-5 text-emerald-400 shrink-0" />
                <div><p className="text-[10px] text-white/50">Email</p><p className="text-sm font-medium">{storefront.contactEmail}</p></div>
              </a>
            )}
            {storefront.city && (
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                <div><p className="text-[10px] text-white/50">Base Camp</p><p className="text-sm font-medium">{storefront.city}</p></div>
              </div>
            )}
          </div>
        </section>
      </div>

      {showBooking && (
        <BookingModal
          pkg={selectedPkg}
          storefront={storefront}
          onClose={() => { setShowBooking(false); setSelectedPkg(null); }}
        />
      )}
    </div>
  );
}
