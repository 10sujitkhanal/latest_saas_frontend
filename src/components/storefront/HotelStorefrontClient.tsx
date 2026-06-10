"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin, Star, Phone, Mail, BedDouble, Users, Calendar, CheckCircle2,
  ChevronRight, Wifi, Coffee, Car, Dumbbell, Waves, Utensils, Shield,
  ArrowRight, X, Loader2, Tag, Clock, Settings2,
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

function getAttr(item: PublicItem, key: string): any {
  const attrs = (item as unknown as { attributes?: Record<string, unknown> }).attributes;
  return attrs?.[key] ?? "";
}

// Common hotel amenity icons
const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-4 h-4" />,
  breakfast: <Coffee className="w-4 h-4" />,
  parking: <Car className="w-4 h-4" />,
  gym: <Dumbbell className="w-4 h-4" />,
  pool: <Waves className="w-4 h-4" />,
  restaurant: <Utensils className="w-4 h-4" />,
};

function RoomCard({
  room, currency, onBook,
}: {
  room: PublicItem; currency: string; onBook: (room: PublicItem) => void;
}) {
  const discount = room.discountPrice != null && room.discountPrice < room.price;
  const displayPrice = room.discountPrice ?? room.price;
  const capacity = getAttr(room, "capacity") || getAttr(room, "guests") || 2;
  const bedType = getAttr(room, "bed_type") || getAttr(room, "bedType") || "";
  const size = getAttr(room, "size") || getAttr(room, "room_size") || "";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Room image / emoji hero */}
      <div className="relative h-48 bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center overflow-hidden">
        {room.imageUrl
          ? <img src={room.imageUrl} alt={room.title} className="w-full h-full object-cover" />
          : <div className="text-7xl">{room.imageEmoji || "🛏️"}</div>}
        {room.badges.slice(0, 1).map((b) => (
          <span key={b} className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {b}
          </span>
        ))}
        {discount && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            SALE
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-bold text-slate-900">{room.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{room.category}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-blue-700 text-lg">{fmt(displayPrice, currency)}</p>
            {discount && <p className="text-xs text-slate-400 line-through">{fmt(room.price, currency)}</p>}
            <p className="text-[10px] text-slate-400">per night</p>
          </div>
        </div>

        {room.shortDescription && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-2">{room.shortDescription}</p>
        )}

        {/* Room specs */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-600">
          {Number(capacity) > 0 && (
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Up to {String(capacity)} guests
            </span>
          )}
          {bedType && (
            <span className="flex items-center gap-1.5">
              <BedDouble className="w-3.5 h-3.5 text-slate-400" />
              {String(bedType)}
            </span>
          )}
          {size && (
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              {String(size)} m²
            </span>
          )}
        </div>

        <button
          onClick={() => onBook(room)}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <BedDouble className="w-4 h-4" />
          Book This Room
        </button>
      </div>
    </div>
  );
}

function BookingModal({
  room, storefront, onClose,
}: {
  room: PublicItem | null; storefront: PublicStorefront; onClose: () => void;
}) {
  const currency = storefront.currency ?? "SEK";
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    checkIn: "", checkOut: "", guests: 1, notes: "",
  });
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nights = (() => {
    if (!form.checkIn || !form.checkOut) return 0;
    const diff = new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime();
    return Math.max(0, Math.round(diff / 86400000));
  })();

  const pricePerNight = room ? (room.discountPrice ?? room.price) : 0;
  const totalPrice = nights * pricePerNight;

  const canSubmit = form.name.trim().length >= 2 && form.phone.trim().length >= 6 &&
    form.checkIn && form.checkOut && nights > 0;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await createPublicBooking(storefront.slug, {
        itemId:        room?.id,
        bookingType:   "hotel",
        customerName:  form.name,
        customerPhone: form.phone,
        customerEmail: form.email || undefined,
        requestedDate: form.checkIn,
        startDatetime: `${form.checkIn}T14:00`,
        endDatetime:   `${form.checkOut}T12:00`,
        guests:        form.guests,
        notes:         form.notes || undefined,
      });
      setRef((res as { bookingRef?: string }).bookingRef ?? "HB-" + Date.now().toString(36).toUpperCase());
      setDone(true);
    } catch {
      setError("Booking failed. Please call us directly.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Reserve Your Room</h2>
            {room && <p className="text-sm text-slate-500">{room.title}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-1">Booking Confirmed!</h3>
            <p className="text-slate-500 text-sm mb-3">Booking reference: <span className="font-mono font-bold text-blue-700">{ref}</span></p>
            <p className="text-sm text-slate-500">We&apos;ll confirm your reservation shortly. Check your email for details.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700">
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Check-in *</label>
                <input type="date" min={new Date().toISOString().split("T")[0]} value={form.checkIn}
                  onChange={e => setForm(p => ({ ...p, checkIn: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Check-out *</label>
                <input type="date" min={form.checkIn || new Date().toISOString().split("T")[0]} value={form.checkOut}
                  onChange={e => setForm(p => ({ ...p, checkOut: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            {/* Guest count */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Guests</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(p => ({ ...p, guests: Math.max(1, p.guests - 1) }))}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 font-bold text-slate-700">−</button>
                <span className="font-semibold text-slate-900 w-6 text-center">{form.guests}</span>
                <button onClick={() => setForm(p => ({ ...p, guests: Math.min(10, p.guests + 1) }))}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 font-bold text-slate-700">+</button>
                <span className="text-sm text-slate-500">guests</span>
              </div>
            </div>

            {/* Price preview */}
            {nights > 0 && room && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-blue-900">{nights} night{nights !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-blue-600">{fmt(pricePerNight, currency)}/night</p>
                </div>
                <p className="text-lg font-bold text-blue-800">{fmt(totalPrice, currency)}</p>
              </div>
            )}

            {/* Guest details */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="John Doe"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Phone *</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+46 70 123 45 67"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@email.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Special Requests</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Early check-in, dietary requirements, etc."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}

        {!done && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmit} disabled={!canSubmit || loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BedDouble className="w-4 h-4" />}
              Confirm Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function HotelStorefrontClient({ storefront, items, offers, availability, joinIntent }: Props) {
  const [selectedRoom, setSelectedRoom] = useState<PublicItem | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All Rooms");
  const [pinnedItems, setPinnedItems] = useState<CrossSellItem[]>([]);
  const currency = storefront.currency ?? "SEK";

  useEffect(() => {
    setPinnedItems(loadPinnedItems(storefront.id ?? storefront.slug));
  }, [storefront.id, storefront.slug]);

  const visibleItems = items.filter(i => i.visible);
  const categories = ["All Rooms", ...Array.from(new Set(visibleItems.map(i => i.category).filter(Boolean)))];
  const filtered = activeCategory === "All Rooms" ? visibleItems : visibleItems.filter(i => i.category === activeCategory);
  const visibleOffers = offers.filter(o => o.visible);

  const handleBook = (room: PublicItem) => {
    setSelectedRoom(room);
    setShowBooking(true);
  };

  // Build amenities from storefront design or fallback
  const amenities = [
    { key: "wifi",       label: "Free WiFi"        },
    { key: "breakfast",  label: "Breakfast"         },
    { key: "parking",    label: "Free Parking"      },
    { key: "gym",        label: "Fitness Center"    },
    { key: "pool",       label: "Swimming Pool"     },
    { key: "restaurant", label: "Restaurant & Bar"  },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Announcement bar */}
      {storefront.announcement && storefront.announcementVisible && (
        <div className="bg-blue-700 text-white text-center text-sm py-2 px-4 font-medium">
          {storefront.announcement}
        </div>
      )}

      {/* Hero */}
      <div className="relative h-[420px] bg-gradient-to-br from-blue-900 to-slate-900 overflow-hidden">
        {storefront.bannerUrl
          ? <img src={storefront.bannerUrl} alt={storefront.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />
          : <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZIMHYtNmgzNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          {storefront.logoUrl && (
            <img src={storefront.logoUrl} alt={storefront.name} className="w-20 h-20 rounded-2xl object-contain bg-white/10 p-2 mb-4 shadow-xl" />
          )}
          <div className="flex items-center gap-1 mb-2">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">{storefront.name}</h1>
          <p className="text-lg text-white/80 mb-1">{storefront.tagline || "Your Perfect Stay Awaits"}</p>
          <p className="flex items-center gap-1.5 text-white/60 text-sm">
            <MapPin className="w-4 h-4" />{storefront.city}
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <p className="text-white/50 text-xs">Scroll to explore</p>
          <ChevronRight className="w-4 h-4 text-white/30 rotate-90" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">

        {/* Trust bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: "💎", text: "Best Rate Guarantee" },
            { icon: "🔄", text: "Free Cancellation" },
            { icon: "☎️", text: "24/7 Guest Support" },
            { icon: "✅", text: "Verified Property" },
          ].map(t => (
            <div key={t.text} className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-xl shrink-0">{t.icon}</span>
              <span className="text-xs font-medium text-slate-700">{t.text}</span>
            </div>
          ))}
        </div>

        {/* Offers / Packages */}
        {visibleOffers.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" /> Special Packages & Offers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleOffers.map(offer => (
                <div key={offer.id} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
                  <div className="text-3xl mb-3">{offer.imageEmoji || "🏷️"}</div>
                  <h3 className="font-bold text-lg mb-1">{offer.title}</h3>
                  <p className="text-blue-100 text-sm mb-3 line-clamp-2">{offer.description}</p>
                  {offer.discountType === "percentage" && (
                    <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                      {offer.discountValue}% OFF
                    </span>
                  )}
                  {offer.discountType === "fixed" && offer.discountValue && (
                    <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                      Save {fmt(Number(offer.discountValue), currency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Membership join (scan-QR → become a member) — after hero, before rooms */}
        {(storefront.memberships?.length ?? 0) > 0 && (
          <MembershipJoinSection slug={storefront.slug} memberships={storefront.memberships ?? []} joinIntent={joinIntent} />
        )}

        {/* Rooms section */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-blue-600" /> Our Rooms & Suites
          </h2>
          <p className="text-slate-500 text-sm mb-5">All rooms include complimentary WiFi and daily housekeeping.</p>

          {/* Category tabs */}
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300"}`}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No rooms available in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(room => (
                <RoomCard key={room.id} room={room} currency={currency} onBook={handleBook} />
              ))}
            </div>
          )}
        </section>

        {/* Amenities */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-5">Hotel Amenities</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {amenities.map(a => (
              <div key={a.key} className="flex flex-col items-center gap-2 p-3 bg-blue-50 rounded-xl text-center">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  {AMENITY_ICONS[a.key]}
                </div>
                <span className="text-xs font-medium text-slate-700">{a.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Cross-sell — pinned items from partner businesses */}
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
              <h2 className="text-lg font-bold text-slate-900">Guests Also Book</h2>
              <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
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
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Contact */}
        <section className="bg-slate-900 rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">Contact & Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {storefront.contactPhone && (
              <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 hover:bg-white/20 transition-colors">
                <Phone className="w-5 h-5 text-blue-300 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/50">Phone</p>
                  <p className="text-sm font-medium">{storefront.contactPhone}</p>
                </div>
              </a>
            )}
            {storefront.contactEmail && (
              <a href={`mailto:${storefront.contactEmail}`} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 hover:bg-white/20 transition-colors">
                <Mail className="w-5 h-5 text-blue-300 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/50">Email</p>
                  <p className="text-sm font-medium">{storefront.contactEmail}</p>
                </div>
              </a>
            )}
            {storefront.city && (
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <MapPin className="w-5 h-5 text-blue-300 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/50">Location</p>
                  <p className="text-sm font-medium">{storefront.city}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-4">
          <p className="text-xs text-slate-400">
            Powered by <span className="font-semibold text-slate-600">Merkoll</span>
            {" · "}
            <Link href="/" className="hover:underline">merkoll.com</Link>
          </p>
        </footer>
      </div>

      {showBooking && (
        <BookingModal
          room={selectedRoom}
          storefront={storefront}
          onClose={() => { setShowBooking(false); setSelectedRoom(null); }}
        />
      )}
    </div>
  );
}
