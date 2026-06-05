"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin, Phone, Mail, Star, Calendar, Clock, CheckCircle2,
  Sparkles, Users, X, Loader2, ChevronRight, Shield, RotateCcw, ArrowRight, Settings2,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicBooking } from "@/lib/storefront/storefrontPublicApi";
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
}

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function ServiceCard({
  service, currency, onBook,
}: {
  service: PublicItem; currency: string; onBook: (s: PublicItem) => void;
}) {
  const displayPrice = service.discountPrice ?? service.price;
  const discount = service.discountPrice != null && service.discountPrice < service.price;
  const duration = (service as unknown as { attributes?: { duration?: number } }).attributes?.duration;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start gap-4 mb-3">
        <div className="w-14 h-14 rounded-xl bg-pink-50 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
          {service.imageUrl
            ? <img src={service.imageUrl} alt={service.title} className="w-full h-full object-cover rounded-xl" />
            : <span>{service.imageEmoji || "✂️"}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1">
            {service.badges.slice(0, 2).map(b => (
              <span key={b} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-800">{b}</span>
            ))}
          </div>
          <h3 className="font-bold text-slate-900 text-sm leading-tight">{service.title}</h3>
          {service.category && <p className="text-xs text-slate-500">{service.category}</p>}
        </div>
      </div>

      {service.shortDescription && (
        <p className="text-sm text-slate-600 mb-3 line-clamp-2 flex-1">{service.shortDescription}</p>
      )}

      <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-500">
        {duration && (
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-pink-400" />{duration} min</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div>
          <span className="font-bold text-pink-700">{fmt(displayPrice, currency)}</span>
          {discount && <span className="ml-1.5 text-xs text-slate-400 line-through">{fmt(service.price, currency)}</span>}
        </div>
        {service.bookingEnabled && (
          <button onClick={() => onBook(service)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-sm font-semibold transition-colors">
            <Calendar className="w-3.5 h-3.5" />Book
          </button>
        )}
      </div>
    </div>
  );
}

function BookingModal({
  service, storefront, onClose,
}: {
  service: PublicItem | null; storefront: PublicStorefront; onClose: () => void;
}) {
  const currency = storefront.currency ?? "SEK";
  const [form, setForm] = useState({ name: "", phone: "", email: "", date: "", time: "", notes: "" });
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && form.date;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await createPublicBooking(storefront.slug, {
        itemId:       service?.id,
        bookingType:  "salon",
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email || undefined,
        requestedDate: form.date,
        requestedTime: form.time || undefined,
        notes:         form.notes || undefined,
      });
      setRef((res as { bookingRef?: string }).bookingRef ?? "SA-" + Date.now().toString(36).toUpperCase());
      setDone(true);
    } catch {
      setError("Booking failed. Please call us to schedule.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Book Appointment</h2>
            {service && <p className="text-sm text-slate-500">{service.title}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-1">Appointment Booked!</h3>
            <p className="text-slate-500 text-sm mb-2">Booking ref: <span className="font-mono font-bold text-pink-700">{ref}</span></p>
            <p className="text-sm text-slate-500">We&apos;ll confirm your appointment shortly.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-pink-600 text-white rounded-xl font-semibold text-sm hover:bg-pink-700">Done</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Preferred Date *</label>
                <input type="date" min={new Date().toISOString().split("T")[0]} value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Preferred Time</label>
                <input type="time" value={form.time}
                  onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
            </div>
            {service && (
              <div className="bg-pink-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <p className="text-sm font-medium text-pink-900">{service.title}</p>
                <p className="font-bold text-pink-700">{fmt(service.discountPrice ?? service.price, currency)}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Your Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Anna Lindström"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Phone *</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+46 70 …"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@email.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Notes / Preferences</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any specific requests, hair length, colour preference, etc."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400 resize-none" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}
        {!done && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmit} disabled={!canSubmit || loading}
              className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Confirm Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SalonStorefrontClient({ storefront, items, offers }: Props) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedService, setSelectedService] = useState<PublicItem | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<CrossSellItem[]>([]);

  useEffect(() => {
    setPinnedItems(loadPinnedItems(storefront.id ?? storefront.slug));
  }, [storefront.id, storefront.slug]);
  const currency = storefront.currency ?? "SEK";

  const visibleItems = items.filter(i => i.visible);
  const categories = ["All", ...Array.from(new Set(visibleItems.map(i => i.category).filter(Boolean)))];
  const filtered = activeCategory === "All" ? visibleItems : visibleItems.filter(i => i.category === activeCategory);

  const handleBook = (service: PublicItem) => {
    setSelectedService(service);
    setShowBooking(true);
  };

  return (
    <div className="min-h-screen bg-rose-50">
      {storefront.announcement && storefront.announcementVisible && (
        <div className="bg-pink-700 text-white text-center text-sm py-2 px-4 font-medium">
          {storefront.announcement}
        </div>
      )}

      {/* Hero */}
      <div className="relative h-72 bg-gradient-to-br from-pink-800 via-rose-700 to-pink-900 overflow-hidden">
        {storefront.bannerUrl
          ? <img src={storefront.bannerUrl} alt={storefront.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />
          : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          {storefront.logoUrl && (
            <img src={storefront.logoUrl} alt={storefront.name} className="w-16 h-16 rounded-2xl object-contain bg-white/10 p-2 mb-3 shadow-xl" />
          )}
          <div className="flex items-center gap-1 mb-2">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-pink-200 text-pink-200" />)}
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-1">{storefront.name}</h1>
          <p className="text-pink-200 mb-1">{storefront.tagline || "Beauty & Wellness Experts"}</p>
          <p className="flex items-center gap-1.5 text-pink-200/70 text-sm">
            <MapPin className="w-4 h-4" />{storefront.city}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Trust */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: "🎓", text: "Certified Professionals" },
            { icon: "🧼", text: "Hygienic Equipment" },
            { icon: "📅", text: "Easy Cancellation" },
            { icon: "💆", text: "Premium Products" },
          ].map(t => (
            <div key={t.text} className="flex items-center gap-2 bg-white rounded-xl border border-pink-100 px-3 py-2.5">
              <span className="text-lg shrink-0">{t.icon}</span>
              <span className="text-xs font-medium text-slate-700">{t.text}</span>
            </div>
          ))}
        </div>

        {/* Offers */}
        {offers.filter(o => o.visible).length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="text-pink-500">✨</span> Special Offers
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {offers.filter(o => o.visible).map(o => (
                <div key={o.id} className="shrink-0 min-w-[200px] bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-2xl p-4">
                  <span className="text-2xl">{o.imageEmoji || "🎀"}</span>
                  <p className="font-bold mt-1 text-sm">{o.title}</p>
                  {o.discountType === "percentage" && <p className="text-pink-100 text-sm mt-0.5">{o.discountValue}% OFF</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Services */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-600" /> Our Services
          </h2>

          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? "bg-pink-600 text-white" : "bg-white border border-pink-200 text-slate-600 hover:border-pink-400"}`}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-pink-100">
              <Sparkles className="w-12 h-12 text-pink-200 mx-auto mb-3" />
              <p className="text-slate-500">No services in this category yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(service => (
                <ServiceCard key={service.id} service={service} currency={currency} onBook={handleBook} />
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
              <h2 className="text-lg font-bold text-slate-900">Complete Your Look</h2>
              <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-pink-500 hover:text-pink-700 font-medium">
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
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-pink-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Contact */}
        <section className="bg-gradient-to-br from-pink-900 to-rose-900 rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-pink-300" /> Visit Us</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {storefront.contactPhone && (
              <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 hover:bg-white/20">
                <Phone className="w-5 h-5 text-pink-300 shrink-0" />
                <div><p className="text-[10px] text-white/50">Call</p><p className="text-sm font-medium">{storefront.contactPhone}</p></div>
              </a>
            )}
            {storefront.contactEmail && (
              <a href={`mailto:${storefront.contactEmail}`} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 hover:bg-white/20">
                <Mail className="w-5 h-5 text-pink-300 shrink-0" />
                <div><p className="text-[10px] text-white/50">Email</p><p className="text-sm font-medium">{storefront.contactEmail}</p></div>
              </a>
            )}
            {storefront.city && (
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <MapPin className="w-5 h-5 text-pink-300 shrink-0" />
                <div><p className="text-[10px] text-white/50">Location</p><p className="text-sm font-medium">{storefront.city}</p></div>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-center">
            <button onClick={() => { setSelectedService(null); setShowBooking(true); }}
              className="flex items-center gap-2 bg-white text-pink-900 font-bold px-6 py-3 rounded-xl hover:bg-pink-50 transition-colors">
              <Calendar className="w-5 h-5" />
              Book a Treatment
            </button>
          </div>
        </section>
      </div>

      {showBooking && (
        <BookingModal
          service={selectedService}
          storefront={storefront}
          onClose={() => { setShowBooking(false); setSelectedService(null); }}
        />
      )}
    </div>
  );
}
