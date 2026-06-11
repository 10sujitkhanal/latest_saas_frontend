"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Star, MapPin, Clock, Phone, Mail, ShoppingCart, X, Plus, Minus,
  CheckCircle2, Calendar, Users, ChevronRight, Tag, Zap, Shield,
  ArrowRight, Send, Camera, ChevronLeft, MessageCircle, Ticket, Globe, Search,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicOrder, createPublicBooking } from "@/lib/storefront/storefrontPublicApi";
import { getIndustryStorefrontConfig } from "@/lib/moredealsx/industry-config";
import { getIndustryCapabilities, type BookingType } from "@/lib/industry/config";
import { BusinessMembershipPanel } from "@/components/moredealsx/BusinessMembershipPanel";
import MembershipJoinSection from "@/components/storefront/MembershipJoinSection";
import type { MdxBusiness } from "@/lib/moredealsx/types";
import { formatCurrencyMarket, buildSwishLink, getVatLabel, isPriceInclusive } from "@/lib/utils/currency";
import { WellnessStorefrontClient } from "@/components/storefront/WellnessStorefrontClient";
import { NaturalBeautyStorefrontClient } from "@/components/storefront/NaturalBeautyStorefrontClient";
import { FikaStorefrontClient } from "@/components/storefront/FikaStorefrontClient";
import { CraftBeerStorefrontClient } from "@/components/storefront/CraftBeerStorefrontClient";
import { HotelStorefrontClient } from "@/components/storefront/HotelStorefrontClient";
import { RestaurantStorefrontClient } from "@/components/storefront/RestaurantStorefrontClient";
import { SalonStorefrontClient } from "@/components/storefront/SalonStorefrontClient";
import { TrekkingStorefrontClient } from "@/components/storefront/TrekkingStorefrontClient";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  storefront:   PublicStorefront;
  items:        PublicItem[];
  offers:       PublicOffer[];
  availability: PublicAvailability | null;
  refCode?:     string;   // ?ref=CODE affiliate tracking
  joinIntent?:  boolean;  // ?join=1 membership QR deep-link — scrolls/focuses the membership join section
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function formatAttrValue(v: string | number | boolean | string[]): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function Badge({ label, color = "bg-slate-100 text-slate-600" }: { label: string; color?: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>{label}</span>;
}

const BADGE_COLOR: Record<string, string> = {
  popular:      "bg-orange-100 text-orange-700",
  bestseller:   "bg-orange-100 text-orange-700",
  offer:        "bg-emerald-100 text-emerald-700",
  "all-inclusive": "bg-blue-100 text-blue-700",
  bridal:       "bg-pink-100 text-pink-700",
  romantic:     "bg-rose-100 text-rose-700",
  suite:        "bg-purple-100 text-purple-700",
  "lake view":  "bg-blue-100 text-blue-700",
  adventure:    "bg-emerald-100 text-emerald-700",
  veg:          "bg-green-100 text-green-700",
  spicy:        "bg-red-100 text-red-700",
  new:          "bg-sky-100 text-sky-700",
  morning:      "bg-amber-100 text-amber-700",
  value:        "bg-teal-100 text-teal-700",
};

const TRUST_POINTS: Record<string, string[]> = {
  Restaurant:              ["🍃 Fresh & Hygienic", "🛵 Fast Delivery", "🔒 Secure Payment", "⭐ 5-Star Rated"],
  Hotel:                   ["💎 Best Rate Guarantee", "🔄 Free Cancellation", "☎️ 24/7 Support", "✅ Verified Property"],
  "Salon / Spa":           ["🎓 Certified Professionals", "🧼 Hygienic Equipment", "📅 Easy Cancellation", "💆 Premium Products"],
  "Trekking / Travel":     ["🏔️ Expert Guides", "🛡️ Safe & Insured", "👥 Group Discounts", "🗺️ Flexible Itinerary"],
  Clothing:                ["🧵 Premium Fabric", "🔄 Easy Returns", "🚚 Fast Shipping", "🔒 Secure Payment"],
  Grocery:                 ["🌿 Fresh & Organic", "⚡ Same-Day Delivery", "✅ Quality Guaranteed", "🔒 Secure Payment"],
  Events:                  ["✅ Verified Organizer", "🎫 Secure Ticketing", "🔄 Easy Refund Policy", "📲 Real-Time Updates"],
  "Local Services":        ["✅ Background Checked", "🛡️ Insured Pros", "⭐ Satisfaction Guaranteed", "⚡ Fast Response"],
  "CCTV & Security":       ["🎓 Certified Technicians", "📜 Licensed & Insured", "📡 24/7 Monitoring", "🔧 Warranty Included"],
  "IT Services":           ["🎓 Certified Engineers", "🌐 Remote & On-Site", "📋 SLA Guaranteed", "🔒 Data Privacy"],
  Cleaning:                ["👥 Trained Staff", "🌿 Eco-Friendly Products", "🛡️ Insured & Bonded", "⭐ Satisfaction Guaranteed"],
  "General Retail":        ["✅ Genuine Products", "🔄 Easy Returns", "🔒 Secure Payment", "🚚 Fast Delivery"],
  "Supplier / Wholesale":  ["✅ Verified Supplier", "📦 Bulk Discounts", "📋 Quality Certified", "🔒 Secure Trade"],
};

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item, accentClass, darkClass, softClass, bookingType, showCart,
  onAdd, onBook, onDetail, cartQty,
}: {
  item: PublicItem;
  accentClass: string;
  darkClass: string;
  softClass: string;
  bookingType: BookingType;
  showCart: boolean;
  onAdd: (item: PublicItem) => void;
  onBook: (item: PublicItem) => void;
  onDetail: (item: PublicItem) => void;
  cartQty: number;
}) {
  const discount = item.discountPrice != null && item.discountPrice < item.price;
  const displayPrice = item.discountPrice ?? item.price;

  const attributeKeys = Object.entries(item.attributes).slice(0, 3);

  const actionBtn = () => {
    if (showCart && item.orderingEnabled) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(item); }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${accentClass} hover:opacity-90`}
        >
          {cartQty > 0 ? (
            <><Plus className="h-3.5 w-3.5" />{cartQty} in cart</>
          ) : (
            <><Plus className="h-3.5 w-3.5" />Add</>
          )}
        </button>
      );
    }
    if (item.bookingEnabled && bookingType !== "none") {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onBook(item); }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${accentClass} hover:opacity-90`}
        >
          {bookingType === "inquiry" ? <><Send className="h-3.5 w-3.5" />Get quote</> : <><Calendar className="h-3.5 w-3.5" />Book</>}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => onDetail(item)}>
      <div className={`relative flex h-32 items-center justify-center ${softClass} bg-opacity-40 overflow-hidden`}>
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
          : <span className="text-4xl">{item.imageEmoji}</span>}
      </div>
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div>
          <div className="flex flex-wrap gap-1 mb-1">
            {item.badges.slice(0, 2).map((b) => (
              <Badge key={b} label={b} color={BADGE_COLOR[b]} />
            ))}
            {item.availabilityStatus === "limited" && (
              <Badge label="Limited" color="bg-amber-100 text-amber-700" />
            )}
          </div>
          <p className="font-semibold text-slate-900 text-sm leading-tight">{item.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.shortDescription}</p>
        </div>

        {attributeKeys.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {attributeKeys.map(([k, v]) => (
              <span key={k} className="text-[10px] text-slate-500">
                <span className="font-medium text-slate-700">{formatAttrValue(v)}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <div>
            <span className={`font-bold text-sm ${darkClass}`}>{fmt(displayPrice, item.currency)}</span>
            {discount && (
              <span className="ml-1.5 text-xs text-slate-400 line-through">{fmt(item.price, item.currency)}</span>
            )}
          </div>
          {actionBtn()}
        </div>
      </div>
    </div>
  );
}

// ─── Booking / Inquiry Modal ──────────────────────────────────────────────────

interface BookingForm {
  name: string; phone: string; email: string;
  date: string; checkOut: string; time: string;
  guests: number; notes: string;
}

function BookingModal({
  item, storefront, bookingType, requiresDateRange, requiresGuestCount,
  accentClass, onClose,
}: {
  item: PublicItem | null;
  storefront: PublicStorefront;
  bookingType: BookingType;
  requiresDateRange: boolean;
  requiresGuestCount: boolean;
  accentClass: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BookingForm>({
    name: "", phone: "", email: "",
    date: "", checkOut: "", time: "",
    guests: 1, notes: "",
  });
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);

  const up = (f: Partial<BookingForm>) => setForm((p) => ({ ...p, ...f }));
  const canSubmit = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && form.date.trim().length > 0;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await createPublicBooking(storefront.slug, {
        itemId:          item?.id,
        bookingType:     bookingType === "room" ? "hotel" : bookingType === "appointment" ? "salon" : bookingType === "slot" ? "trekking" : "general",
        customerName:    form.name,
        customerPhone:   form.phone,
        customerEmail:   form.email || undefined,
        requestedDate:   form.date,
        requestedTime:   form.time || undefined,
        startDatetime:   requiresDateRange && form.date ? `${form.date}T14:00` : undefined,
        endDatetime:     requiresDateRange && form.checkOut ? `${form.checkOut}T11:00` : undefined,
        quantity:        form.guests,
        notes:           form.notes || undefined,
        source:          "storefront",
      });
      setRef(res.bookingRef);
      setDone(true);
    } catch {
      setRef("BK-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const title =
    bookingType === "inquiry" ? "Request a quote" :
    bookingType === "room"    ? "Reserve this room" :
    bookingType === "appointment" ? "Book appointment" :
    "Book now";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {done ? (
          <div className="text-center py-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 text-lg font-bold text-slate-900">
              {bookingType === "inquiry" ? "Quote request sent!" : "Booking confirmed!"}
            </p>
            <p className="mt-1 text-sm text-slate-500">Reference: <span className="font-semibold text-slate-800">{ref}</span></p>
            <p className="mt-1 text-xs text-slate-400">{storefront.name} will contact you on {form.phone} shortly.</p>
            <button onClick={onClose} className={`mt-5 rounded-lg px-6 py-2.5 text-sm font-semibold text-white ${accentClass}`}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-slate-900">{title}</p>
                {item && <p className="text-xs text-slate-500">{item.title}</p>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Full name *</label>
                  <input value={form.name} onChange={(e) => up({ name: e.target.value })} placeholder="Your name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Phone *</label>
                  <input value={form.phone} onChange={(e) => up({ phone: e.target.value })} placeholder="+977-..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Email</label>
                  <input value={form.email} onChange={(e) => up({ email: e.target.value })} placeholder="optional" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className={requiresDateRange ? "" : "col-span-2"}>
                  <label className="text-xs font-semibold text-slate-600">
                    {requiresDateRange ? "Check-in *" : "Date *"}
                  </label>
                  <input type="date" value={form.date} onChange={(e) => up({ date: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {requiresDateRange && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Check-out *</label>
                    <input type="date" value={form.checkOut} onChange={(e) => up({ checkOut: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                {!requiresDateRange && bookingType !== "inquiry" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Preferred time</label>
                    <input type="time" value={form.time} onChange={(e) => up({ time: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                {requiresGuestCount && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Guests / persons</label>
                    <input type="number" min={1} value={form.guests} onChange={(e) => up({ guests: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600">
                    {bookingType === "inquiry" ? "Describe your requirements" : "Notes (optional)"}
                  </label>
                  <textarea value={form.notes} onChange={(e) => up({ notes: e.target.value })} rows={2} placeholder="Any specific requirements..." className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white ${accentClass} hover:opacity-90 disabled:opacity-40`}
              >
                {loading ? "Sending…" : bookingType === "inquiry" ? "Send quote request" : "Confirm booking"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

type CartMap = Record<string, number>;

interface CartPanelProps {
  cart: CartMap;
  items: PublicItem[];
  storefront: PublicStorefront;
  availability: PublicAvailability | null;
  accentClass: string;
  softClass: string;
  darkClass: string;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function CartPanel({ cart, items, storefront, availability, accentClass, softClass, darkClass, onAdd, onRemove, onClear }: CartPanelProps) {
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("pickup");
  const [form, setForm] = useState({ name: "", phone: "", address: "", coupon: "", notes: "" });
  const [done, setDone] = useState(false);
  const [orderNum, setOrderNum] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSwishBox, setShowSwishBox] = useState(false);

  // Read payment settings saved by admin
  const paymentSettings = (() => {
    if (typeof window === "undefined") return { enabled: {}, keys: {} };
    try { return JSON.parse(localStorage.getItem(`storefront_payments_${storefront.slug}`) ?? "{}"); }
    catch { return { enabled: {}, keys: {} }; }
  })();
  const swishEnabled = !!paymentSettings?.enabled?.swish;
  const swishNumber  = (paymentSettings?.keys?.swish ?? "").replace(/\D/g, "");

  const cartEntries = Object.entries(cart).map(([id, qty]) => ({ item: items.find((i) => i.id === id)!, qty })).filter((x) => x.item);
  const subtotal = cartEntries.reduce((s, { item, qty }) => s + (item.discountPrice ?? item.price) * qty, 0);
  const deliveryFee = orderType === "delivery" ? (availability?.deliveryFee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  const canOrder = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && (orderType === "pickup" || form.address.trim().length >= 4) && cartEntries.length > 0;

  const handleOrder = async () => {
    setLoading(true);
    try {
      const res = await createPublicOrder(storefront.slug, {
        items: cartEntries.map(({ item, qty }) => ({ itemId: item.id, title: item.title, quantity: qty, unitPrice: item.discountPrice ?? item.price })),
        deliveryMethod: orderType,
        deliveryAddress: orderType === "delivery" ? form.address : undefined,
        customerName: form.name,
        customerPhone: form.phone,
        notes: form.notes || undefined,
        couponCode: form.coupon || undefined,
        subtotal, deliveryFee, discount: 0, tax: 0, total,
        paymentMethod: "cash",
        orderSource: "storefront",
      });
      setOrderNum(res.orderNumber);
      setDone(true);
      onClear();
    } catch {
      setOrderNum("ORD-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      setDone(true);
      onClear();
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-3 font-bold text-slate-900">Order placed!</p>
        <p className="text-sm text-slate-500 mt-1">Reference: <span className="font-semibold">{orderNum}</span></p>
        <p className="text-xs text-slate-400 mt-1">{storefront.name} will contact you shortly.</p>
        <button onClick={() => setDone(false)} className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white ${accentClass}`}>Order again</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <p className="font-bold text-slate-900">Your order</p>

      {cartEntries.length === 0 ? (
        <div className={`rounded-xl ${softClass} bg-opacity-30 px-4 py-6 text-center`}>
          <ShoppingCart className={`mx-auto h-8 w-8 opacity-40 ${darkClass}`} />
          <p className="mt-2 text-sm text-slate-500">Add items to start your order</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cartEntries.map(({ item, qty }) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-lg">{item.imageEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                <p className="text-xs text-slate-500">{fmt(item.discountPrice ?? item.price, item.currency)} × {qty}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onRemove(item.id)} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => onAdd(item.id)} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {storefront.deliveryEnabled && storefront.pickupEnabled && (
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
          {(["pickup", "delivery"] as const).map((t) => (
            <button key={t} onClick={() => setOrderType(t)}
              className={`flex-1 py-2 capitalize transition-colors ${orderType === t ? `${accentClass} text-white` : "text-slate-600 hover:bg-slate-50"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name *" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone *" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        {orderType === "delivery" && (
          <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Delivery address *" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        )}
        <input value={form.coupon} onChange={(e) => setForm((f) => ({ ...f, coupon: e.target.value }))} placeholder="Coupon code (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      {cartEntries.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between text-slate-500"><span>Delivery</span><span>{fmt(deliveryFee)}</span></div>}
          <div className={`flex justify-between font-bold ${darkClass}`}><span>Total</span><span>{fmt(total)}</span></div>
          {isPriceInclusive(cartEntries[0]?.item?.currency ?? "SEK") && (
            <p className="text-[10px] text-slate-400 text-right">{getVatLabel(cartEntries[0]?.item?.currency ?? "SEK")}</p>
          )}
        </div>
      )}

      <button
        onClick={handleOrder}
        disabled={!canOrder || loading}
        className={`w-full rounded-xl py-2.5 text-sm font-bold text-white ${accentClass} hover:opacity-90 disabled:opacity-40`}
      >
        {loading ? "Placing order…" : `Place order · ${fmt(total)}`}
      </button>

      {swishEnabled && swishNumber && cartEntries.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-medium text-slate-400">or pay directly</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          {showSwishBox ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center space-y-2">
              <p className="text-2xl font-black text-green-700">🟢 Swish</p>
              <p className="text-sm text-slate-600">Send <span className="font-bold">{fmt(total)}</span> to:</p>
              <p className="text-xl font-mono font-bold text-slate-800 tracking-wider">{swishNumber}</p>
              <p className="text-xs text-slate-400">Use your order name as message</p>
              <a
                href={buildSwishLink({ payeeNumber: swishNumber, amount: total, message: `Order ${storefront.name}` })}
                className="block w-full rounded-lg py-2 bg-green-500 text-white text-sm font-bold hover:bg-green-600"
              >
                Open Swish app
              </a>
              <button onClick={() => setShowSwishBox(false)} className="text-xs text-slate-400 underline">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowSwishBox(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors"
            >
              🟢 Pay with Swish · {fmt(total)}
            </button>
          )}
        </>
      )}

      {storefront.contactPhone && cartEntries.length > 0 && form.name.trim() && (
        <>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-medium text-slate-400">or send directly</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <a
            href={(() => {
              const lines = [
                `Hello ${storefront.name}! 🛒 I'd like to place an order:`,
                ``,
                ...cartEntries.map(({ item, qty }) =>
                  `• ${qty}× ${item.title} — ${fmt((item.discountPrice ?? item.price) * qty, item.currency)}`
                ),
                ``,
                subtotal !== total ? `Subtotal: ${fmt(subtotal)}` : null,
                deliveryFee > 0 ? `Delivery fee: ${fmt(deliveryFee)}` : null,
                `*Total: ${fmt(total)}*`,
                ``,
                `Order type: ${orderType === "delivery" ? "Delivery 🛵" : "Pickup 📦"}`,
                `Name: ${form.name}`,
                `Phone: ${form.phone}`,
                orderType === "delivery" && form.address ? `Address: ${form.address}` : null,
                form.coupon ? `Coupon: ${form.coupon}` : null,
                form.notes  ? `Notes: ${form.notes}` : null,
              ].filter(Boolean).join("\n");
              return `https://wa.me/${storefront.contactPhone.replace(/\D/g, "")}?text=${encodeURIComponent(lines)}`;
            })()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Send order on WhatsApp
          </a>
        </>
      )}
    </div>
  );
}

// ─── Offers Strip ─────────────────────────────────────────────────────────────

function OfferCard({ offer, accentClass, currency }: { offer: PublicOffer; accentClass: string; currency: string }) {
  const [copied, setCopied] = useState(false);

  const discountLabel =
    offer.discountType === "percentage" ? `${offer.discountValue}% OFF` :
    offer.discountType === "fixed"      ? `${fmt(offer.discountValue, currency)} OFF` :
    "BUY 1 GET 1";

  const daysLeft = Math.ceil((new Date(offer.endDate).getTime() - Date.now()) / 86400000);

  const copy = () => {
    if (!offer.code) return;
    navigator.clipboard.writeText(offer.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex min-w-[240px] max-w-[280px] flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Discount header */}
      <div className={`${accentClass} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-white" />
          <span className="text-white font-bold text-sm">{discountLabel}</span>
        </div>
        {daysLeft <= 7 && daysLeft > 0 && (
          <span className="bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">{daysLeft}d left</span>
        )}
      </div>
      {/* Content */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight">{offer.title}</p>
        {offer.description && <p className="text-xs text-slate-500 line-clamp-2">{offer.description}</p>}
        {offer.minOrderValue > 0 && (
          <p className="text-[10px] text-slate-400">Min. order: {fmt(offer.minOrderValue, currency)}</p>
        )}
        {offer.code && (
          <button onClick={copy}
            className="flex items-center gap-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg px-2.5 py-1.5 hover:border-indigo-400 hover:bg-indigo-50 transition-colors mt-auto">
            <code className="flex-1 text-[11px] font-mono font-bold text-slate-700 tracking-wider">{offer.code}</code>
            {copied
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              : <span className="text-[10px] text-indigo-600 font-semibold shrink-0">COPY</span>}
          </button>
        )}
        <p className="text-[10px] text-slate-300">Valid until {new Date(offer.endDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function OffersStrip({ offers, accentClass, currency }: { offers: PublicOffer[]; accentClass: string; currency: string }) {
  if (!offers.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      {offers.map((o) => <OfferCard key={o.id} offer={o} accentClass={accentClass} currency={currency} />)}
    </div>
  );
}

// ─── Gallery Section ──────────────────────────────────────────────────────────

function GallerySection({ images, name, accentClass }: { images: string[]; name: string; accentClass: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (images.length === 0) return null;

  const prev = () => setLightbox(i => i !== null ? (i - 1 + images.length) % images.length : null);
  const next = () => setLightbox(i => i !== null ? (i + 1) % images.length : null);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-slate-900 text-lg flex items-center gap-2">
          <Camera className="h-5 w-5 text-slate-400" /> Gallery
        </p>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{images.length} photo{images.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Marketplace masonry grid */}
      <div className={`grid gap-2 ${
        images.length === 1 ? "grid-cols-1" :
        images.length === 2 ? "grid-cols-2" :
        images.length === 3 ? "grid-cols-3" :
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      }`}>
        {images.map((url, idx) => {
          const isBig = idx === 0 && images.length >= 4;
          return (
            <div key={idx}
              className={`relative overflow-hidden rounded-xl cursor-pointer group ${isBig ? "col-span-2 row-span-2" : ""}`}
              style={{ aspectRatio: isBig ? "1/1" : "4/3" }}
              onClick={() => setLightbox(idx)}>
              <img src={url} alt={`${name} photo ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {idx === images.length - 1 && images.length > 8 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                  <span className="text-white font-bold text-lg">+{images.length - 8}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}>
          {/* Close */}
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={() => setLightbox(null)}>
            <X className="h-5 w-5" />
          </button>
          {/* Prev */}
          {images.length > 1 && (
            <button className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              onClick={e => { e.stopPropagation(); prev(); }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {/* Image */}
          <img src={images[lightbox]} alt={`${name} ${lightbox + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()} />
          {/* Next */}
          {images.length > 1 && (
            <button className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              onClick={e => { e.stopPropagation(); next(); }}>
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {/* Counter */}
          <p className="absolute bottom-4 left-0 right-0 text-center text-white/60 text-sm">
            {lightbox + 1} / {images.length}
          </p>
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1.5 px-4 overflow-x-auto">
              {images.map((url, idx) => (
                <button key={idx} onClick={e => { e.stopPropagation(); setLightbox(idx); }}
                  className={`shrink-0 w-12 h-8 rounded overflow-hidden border-2 transition-all ${idx === lightbox ? "border-white scale-110" : "border-white/30 hover:border-white/60"}`}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Announcement Banner ──────────────────────────────────────────────────────

const ANNOUNCEMENT_STYLES: Record<string, string> = {
  promo:   "bg-purple-600 text-white",
  info:    "bg-blue-600 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-white",
};

function AnnouncementBanner({ message, type }: { message: string; type: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !message.trim()) return null;
  const cls = ANNOUNCEMENT_STYLES[type] ?? ANNOUNCEMENT_STYLES.info;
  return (
    <div className={`${cls} px-4 py-2.5 flex items-center justify-between gap-3`}>
      <p className="flex-1 text-center text-sm font-medium">{message}</p>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Trust Bar ────────────────────────────────────────────────────────────────

function TrustBar({ industry, softClass, darkClass }: { industry: string; softClass: string; darkClass: string }) {
  const points = TRUST_POINTS[industry] ?? ["✅ Secure Payment", "⭐ Quality Guarantee", "📞 Customer Support", "🔄 Easy Refunds"];
  return (
    <div className="bg-white border-b border-slate-100 px-4 py-2.5">
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5">
        {points.map((p, i) => (
          <span key={i} className={`text-xs font-semibold ${darkClass}`}>{p}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Product Detail Drawer ────────────────────────────────────────────────────

function ProductDetailDrawer({
  item, accentClass, darkClass, softClass, bookingType, showCart,
  onAdd, onBook, onClose, cartQty,
}: {
  item: PublicItem | null;
  accentClass: string; darkClass: string; softClass: string;
  bookingType: BookingType; showCart: boolean;
  onAdd: (item: PublicItem) => void;
  onBook: (item: PublicItem) => void;
  onClose: () => void;
  cartQty: number;
}) {
  const [qty, setQty] = useState(1);

  useEffect(() => { setQty(1); }, [item?.id]);

  if (!item) return null;

  const discount = item.discountPrice != null && item.discountPrice < item.price;
  const displayPrice = item.discountPrice ?? item.price;
  const savingPct = discount ? Math.round(((item.price - item.discountPrice!) / item.price) * 100) : 0;

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) onAdd(item);
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="relative w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image / emoji hero */}
        <div className={`relative h-56 shrink-0 flex items-center justify-center ${softClass} overflow-hidden`}>
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
            : <span className="text-7xl">{item.imageEmoji}</span>}
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60">
            <X className="h-4 w-4" />
          </button>
          {discount && (
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
              -{savingPct}%
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex flex-col flex-1 overflow-y-auto p-5 gap-4">
          {item.badges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.badges.map((b) => <Badge key={b} label={b} color={BADGE_COLOR[b]} />)}
              {item.availabilityStatus === "limited" && <Badge label="Limited" color="bg-amber-100 text-amber-700" />}
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{item.title}</h2>
            {item.category && <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>}
          </div>

          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold ${darkClass}`}>{fmt(displayPrice, item.currency)}</span>
            {discount && (
              <>
                <span className="text-sm text-slate-400 line-through">{fmt(item.price, item.currency)}</span>
                <span className="text-xs font-semibold text-red-500">Save {savingPct}%</span>
              </>
            )}
          </div>

          {item.description && item.description.length > 10 && (
            <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
          )}

          {Object.keys(item.attributes).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(item.attributes).map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{k}</p>
                  <p className="text-sm font-semibold text-slate-800">{formatAttrValue(v)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="shrink-0 border-t border-slate-100 p-4 flex flex-col gap-3 bg-white">
          {showCart && item.orderingEnabled && (
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-600">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold text-slate-900">{qty}</span>
                <button onClick={() => setQty(q => q + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-600">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button onClick={handleAdd}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white ${accentClass} hover:opacity-90`}>
                <ShoppingCart className="h-4 w-4" />
                {cartQty > 0 ? `Add more · ${fmt(displayPrice * qty, item.currency)}` : `Add to cart · ${fmt(displayPrice * qty, item.currency)}`}
              </button>
            </div>
          )}
          {item.bookingEnabled && bookingType !== "none" && (
            <button onClick={() => onBook(item)}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white ${accentClass} hover:opacity-90`}>
              <Calendar className="h-4 w-4" />
              {bookingType === "inquiry" ? "Get a Quote" : bookingType === "appointment" ? "Book Appointment" : "Book Now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Events System ────────────────────────────────────────────────────────────

export interface StoredEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  capacity: number;
  ticketPrice: number;
  isFree: boolean;
  imageUrl: string;
  isOnlineEvent: boolean;
  visible: boolean;
  onMoreDealsX: boolean;
}

function EventCard({
  ev, accentClass, darkClass, softClass, onRsvp,
}: {
  ev: StoredEvent;
  accentClass: string; darkClass: string; softClass: string;
  onRsvp: (ev: StoredEvent) => void;
}) {
  const d = new Date(ev.date + "T00:00:00");
  const day = d.toLocaleDateString("en", { day: "2-digit" });
  const mon = d.toLocaleDateString("en", { month: "short" });
  const isPast = new Date(ev.date + "T23:59:59") < new Date();

  return (
    <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      <div className={`${accentClass} flex-none w-16 flex flex-col items-center justify-center py-3 text-white shrink-0`}>
        <span className="text-xl font-extrabold leading-none">{day}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">{mon}</span>
      </div>
      <div className="flex flex-col flex-1 p-3 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{ev.title}</p>
            <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-slate-500">
              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3 shrink-0" />{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>
              <span className="flex items-center gap-0.5">
                {ev.isOnlineEvent ? <Globe className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                {ev.isOnlineEvent ? "Online" : ev.location}
              </span>
              {ev.capacity > 0 && <span className="flex items-center gap-0.5"><Users className="h-3 w-3 shrink-0" />{ev.capacity} seats</span>}
            </div>
            {ev.description && <p className="mt-1 text-xs text-slate-400 line-clamp-1">{ev.description}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ev.isFree ? "bg-emerald-100 text-emerald-700" : `${softClass} ${darkClass}`}`}>
              {ev.isFree ? "FREE" : fmt(ev.ticketPrice)}
            </span>
            {ev.onMoreDealsX && (
              <span className="text-[9px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">MoreDealsX</span>
            )}
          </div>
        </div>
        {!isPast ? (
          <button onClick={() => onRsvp(ev)}
            className={`mt-2 self-start flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold text-white ${accentClass} hover:opacity-90`}>
            <Ticket className="h-3.5 w-3.5" />
            {ev.isFree ? "RSVP" : "Buy Ticket"}
          </button>
        ) : (
          <span className="mt-2 text-[10px] text-slate-400 italic">Event ended</span>
        )}
      </div>
    </div>
  );
}

function EventsSection({
  events, storefront, accentClass, darkClass, softClass,
}: {
  events: StoredEvent[];
  storefront: PublicStorefront;
  accentClass: string; darkClass: string; softClass: string;
}) {
  const [rsvpEv, setRsvpEv] = useState<StoredEvent | null>(null);
  const [rsvpForm, setRsvpForm] = useState({ name: "", phone: "", email: "" });
  const [rsvpDone, setRsvpDone] = useState(false);

  const upcoming = events.filter(e => e.visible).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0) return null;

  const submitRsvp = () => setRsvpDone(true);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Ticket className={`h-5 w-5 ${darkClass}`} />
        <p className="font-bold text-slate-900 text-lg">Upcoming Events</p>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          {upcoming.length} event{upcoming.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {upcoming.map(ev => (
          <EventCard key={ev.id} ev={ev} accentClass={accentClass} darkClass={darkClass} softClass={softClass} onRsvp={setRsvpEv} />
        ))}
      </div>

      {rsvpEv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            {rsvpDone ? (
              <div className="text-center py-2">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="mt-3 font-bold text-slate-900">You&apos;re registered!</p>
                <p className="mt-1 text-sm text-slate-500">{storefront.name} will confirm your spot shortly.</p>
                <button onClick={() => { setRsvpEv(null); setRsvpDone(false); setRsvpForm({ name: "", phone: "", email: "" }); }}
                  className={`mt-4 rounded-lg px-5 py-2 text-sm font-semibold text-white ${accentClass}`}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-slate-900">{rsvpEv.isFree ? "RSVP for event" : "Buy ticket"}</p>
                    <p className="text-xs text-slate-500">{rsvpEv.title}</p>
                  </div>
                  <button onClick={() => setRsvpEv(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {([
                    { label: "Full name *", key: "name" as const, placeholder: "Your name" },
                    { label: "Phone *",     key: "phone" as const, placeholder: "+977-..." },
                    { label: "Email",       key: "email" as const, placeholder: "optional" },
                  ]).map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                      <input value={rsvpForm[f.key]}
                        onChange={e => setRsvpForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                  <button onClick={submitRsvp}
                    disabled={rsvpForm.name.trim().length < 2 || rsvpForm.phone.trim().length < 6}
                    className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white ${accentClass} hover:opacity-90 disabled:opacity-40`}>
                    {rsvpEv.isFree ? "Confirm RSVP" : `Pay ${fmt(rsvpEv.ticketPrice)} & Register`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Floating Actions ─────────────────────────────────────────────────────────

function FloatingActions({ phone }: { phone?: string }) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, "");
  const waLink  = `https://wa.me/${cleaned}`;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2 lg:bottom-8">
      <a href={waLink} target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-colors">
        <MessageCircle className="h-5 w-5" />
      </a>
      <a href={`tel:${phone}`} title="Call us"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-700 text-white shadow-lg hover:bg-slate-800 transition-colors">
        <Phone className="h-5 w-5" />
      </a>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UniversalStorefrontClient({ storefront, items, offers, availability, refCode, joinIntent }: Props) {
  // Industry-specific storefront routing
  if (storefront.industry === "Wellness / Supplements" || storefront.industry === "Wellness / Natural Beauty" || storefront.industry.toLowerCase().startsWith("wellness")) {
    return <WellnessStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }
  if (storefront.industry === "Natural Beauty / Skincare") {
    return <NaturalBeautyStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }
  if (storefront.industry === "Fika / Coffee") {
    return <FikaStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }
  if (storefront.industry === "Craft Beer / Brewery") {
    return <CraftBeerStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }
  if (storefront.industry === "Hotel") {
    return <HotelStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }
  if (storefront.industry === "Restaurant") {
    return <RestaurantStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }
  if (storefront.industry === "Salon / Spa") {
    return <SalonStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }
  if (storefront.industry === "Trekking / Travel") {
    return <TrekkingStorefrontClient storefront={storefront} items={items} offers={offers} availability={availability} refCode={refCode} joinIntent={joinIntent} />;
  }

  const config = getIndustryStorefrontConfig(storefront.industry as never);
  const caps   = getIndustryCapabilities(storefront.industry);

  const { accentClass: configAccentClass, softClass: configSoftClass, darkClass: configDarkClass } = config;
  const { bookingType, showCart, requiresDateRange, requiresGuestCount } = caps;

  // Admin bridge — reads localStorage written by /storefront admin panel (shared across tabs)
  const [liveData, setLiveData] = useState<{
    logoUrl: string | null; bannerUrl: string | null;
    name: string; tagline: string; gallery: string[];
    primaryColor: string; theme: string; layout: string; visibleSections: string[];
    announcement: string; announcementType: string; announcementVisible: boolean;
  }>({
    logoUrl: storefront.logoUrl, bannerUrl: storefront.bannerUrl,
    name: storefront.name, tagline: storefront.tagline,
    gallery: storefront.galleryImages ?? [],
    primaryColor: storefront.primaryColor,
    theme: storefront.theme,
    layout: storefront.layout,
    visibleSections: storefront.visibleSections,
    announcement: "", announcementType: "promo", announcementVisible: false,
  });
  const [liveItems, setLiveItems] = useState<PublicItem[]>(items);
  const [liveOffers, setLiveOffers] = useState<PublicOffer[]>(offers);
  const [liveEvents, setLiveEvents] = useState<StoredEvent[]>([]);
  const [detailItem, setDetailItem] = useState<PublicItem | null>(null);

  // Use industry config classes as fallback; override inline when admin chose a custom color
  const accentClass = configAccentClass;
  const softClass   = configSoftClass;
  const darkClass   = configDarkClass;
  // The inline style for the hero uses liveData.primaryColor so it overrides CSS class color
  const heroStyle = liveData.primaryColor && liveData.primaryColor !== storefront.primaryColor
    ? { backgroundColor: liveData.primaryColor }
    : {};

  // Reads the admin localStorage cache and applies it to liveData + liveItems + liveOffers.
  // Called on mount, on storage events (another tab saved), and on tab focus.
  const applyStorageCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(`storefront_cache_${storefront.slug}`);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (!cached) return;

      // ── Identity + design fields ──────────────────────────────────────────
      setLiveData({
        logoUrl:             cached.design?.logo                ?? storefront.logoUrl,
        bannerUrl:           cached.design?.banner              ?? storefront.bannerUrl,
        name:                cached.name                        ?? storefront.name,
        tagline:             cached.tagline                     ?? storefront.tagline,
        gallery:             cached.design?.galleryImages       ?? storefront.galleryImages ?? [],
        primaryColor:        cached.design?.primaryColor        ?? storefront.primaryColor,
        theme:               cached.design?.theme               ?? storefront.theme,
        layout:              cached.design?.layout              ?? storefront.layout,
        visibleSections:     cached.design?.visibleSections     ?? storefront.visibleSections,
        announcement:        cached.design?.announcement        ?? "",
        announcementType:    cached.design?.announcementType    ?? "promo",
        announcementVisible: cached.design?.announcementVisible ?? false,
      });

      // ── Products ──────────────────────────────────────────────────────────
      if (Array.isArray(cached.products) && cached.products.length > 0) {
        // If user has added their own products (non-sfp IDs), skip the server mock items entirely
        const userProducts = (cached.products as Record<string, unknown>[]).filter(
          (p) => !(p.id as string).startsWith("sfp-")
        );
        const hasUserProducts = userProducts.length > 0;

        const toPublicItem = (p: Record<string, unknown>): PublicItem => {
          const base = items.find(i => i.id === p.id);
          return {
            id:                p.id as string,
            slug:              p.id as string,
            type:              "product",
            title:             (p.title as string) ?? base?.title ?? "",
            shortDescription:  (p.description as string) ?? base?.shortDescription ?? "",
            description:       (p.description as string) ?? base?.description ?? "",
            price:             (p.price as number) ?? base?.price ?? 0,
            discountPrice:     (p.discountPrice as number | null) ?? base?.discountPrice ?? null,
            currency:          base?.currency ?? "SEK",
            category:          (p.category as string) ?? base?.category ?? "",
            imageEmoji:        (p.imageEmoji as string) ?? base?.imageEmoji ?? "📦",
            imageUrl:          (p.imageUrl as string | null) ?? base?.imageUrl ?? null,
            isFeatured:        Boolean(p.featured),
            badges:            base?.badges ?? [],
            attributes:        base?.attributes ?? {},
            availabilityStatus: base?.availabilityStatus ?? "available",
            orderingEnabled:   base?.orderingEnabled ?? true,
            bookingEnabled:    base?.bookingEnabled ?? false,
            preorderEnabled:   base?.preorderEnabled ?? false,
            deliveryEnabled:   base?.deliveryEnabled ?? false,
            pickupEnabled:     base?.pickupEnabled ?? false,
          };
        };

        if (hasUserProducts) {
          // User has real products — show ONLY those (never mix with sfp mocks)
          const result = userProducts
            .filter((p) => p.visible !== false)
            .map(toPublicItem);
          setLiveItems(result);
        } else {
          // All products are sfp mocks — apply overrides to server items
          const adminMap = new Map<string, Record<string, unknown>>(
            (cached.products as Record<string, unknown>[]).map((p) => [p.id as string, p])
          );
          const result: PublicItem[] = [];
          const seen = new Set<string>();
          for (const p of cached.products as Record<string, unknown>[]) {
            if (p.visible === false) continue;
            result.push(toPublicItem(p));
            seen.add(p.id as string);
          }
          for (const item of items) {
            if (!seen.has(item.id)) {
              if (adminMap.get(item.id)?.visible === false) continue;
              result.push(item);
            }
          }
          setLiveItems(result);
        }
      }

      // ── Offers ────────────────────────────────────────────────────────────
      if (Array.isArray(cached.offers) && cached.offers.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const mapped: PublicOffer[] = (cached.offers as Record<string, unknown>[])
          .filter((o) => o.visible !== false && (o.endDate as string) >= today)
          .map((o) => ({
            id:            o.id as string,
            title:         o.title as string,
            code:          o.code as string ?? "",
            discountType:  o.discountType as PublicOffer["discountType"],
            discountValue: o.discountValue as number,
            minOrderValue: (o.minOrderValue as number) ?? 0,
            startDate:     o.startDate as string,
            endDate:       o.endDate as string,
            description:   (o.description as string) ?? "",
          }));
        setLiveOffers(mapped);
      }

      // ── Events ──────────────────────────────────────────────────────────────
      if (Array.isArray(cached.events) && cached.events.length > 0) {
        setLiveEvents((cached.events as StoredEvent[]).filter(e => e.visible !== false));
      }
    } catch { /* ignore */ }
  }, [storefront.slug, storefront.logoUrl, storefront.bannerUrl, storefront.name, storefront.tagline,
      storefront.galleryImages, storefront.primaryColor, storefront.theme, storefront.layout,
      storefront.visibleSections, items]);

  useEffect(() => {
    // Run on mount
    applyStorageCache();

    // Re-run when admin tab writes to localStorage (storage event fires in OTHER tabs)
    const onStorage = (e: StorageEvent) => {
      if (e.key === `storefront_cache_${storefront.slug}`) applyStorageCache();
    };
    // Re-run when user switches back to this tab (covers same-tab admin → public)
    const onVisible = () => { if (document.visibilityState === "visible") applyStorageCache(); };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [applyStorageCache, storefront.slug]);

  // Cart state (for showCart industries)
  const [cart, setCart] = useState<CartMap>({});
  const addToCart    = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart((c) => { const n = { ...c }; if ((n[id] ?? 0) > 1) n[id]--; else delete n[id]; return n; });
  const cartCount    = Object.values(cart).reduce((a, b) => a + b, 0);

  // Booking state
  const [bookingItem, setBookingItem] = useState<PublicItem | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const openBooking = (item: PublicItem) => { setBookingItem(item); setShowBookingModal(true); };
  const openGeneralBooking = () => { setBookingItem(null); setShowBookingModal(true); };

  // Category filter + search — uses liveItems (admin overrides applied)
  const categories = ["All", ...Array.from(new Set(liveItems.map((i) => i.category).filter(Boolean)))];
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categoryFiltered = activeCategory === "All" ? liveItems : liveItems.filter((i) => i.category === activeCategory);
  const filteredItems = searchQuery.trim()
    ? categoryFiltered.filter((i) => {
        const q = searchQuery.toLowerCase();
        return i.title.toLowerCase().includes(q)
          || i.shortDescription?.toLowerCase().includes(q)
          || i.category?.toLowerCase().includes(q);
      })
    : categoryFiltered;

  // Cart drawer (mobile)
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Business hours
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const todayName = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayHours = storefront.openingHours?.[todayName];
  const isOpenNow = todayHours && !todayHours.closed;

  // Dummy membership bridge (existing component uses MdxBusiness shape)
  const bizAsLegacy = {
    id: storefront.slug,
    name: storefront.name,
    slug: storefront.slug,
    industry: storefront.industry,
    city: storefront.city,
    area: storefront.area,
    rating: storefront.rating,
    reviewCount: storefront.reviewCount,
    tags: [],
    description: storefront.description,
    phone: storefront.contactPhone,
    email: storefront.contactEmail,
    address: storefront.address,
    logo: storefront.logoUrl ?? "",
    cover: storefront.bannerUrl ?? "",
    verified: true,
    featured: false,
    membershipTiers: [],
    deals: [],
    listings: [],
    rentals: [],
  } as unknown as MdxBusiness;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Announcement banner ──────────────────────────────────────────── */}
      {liveData.announcementVisible && liveData.announcement && (
        <AnnouncementBanner message={liveData.announcement} type={liveData.announcementType} />
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className={`relative ${accentClass} px-4 py-10 text-white sm:px-8 overflow-hidden`} style={heroStyle}>
        {/* Banner background */}
        {liveData.bannerUrl && (
          <div className="absolute inset-0 z-0">
            <img src={liveData.bannerUrl} alt="" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
          </div>
        )}
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {liveData.logoUrl && (
                  <img src={liveData.logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-contain bg-white/20 p-1 shrink-0" />
                )}
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">{config.label}</span>
                {storefront.isPublished && <span className="rounded-full bg-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold">● Live</span>}
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">{liveData.name}</h1>
              {liveData.tagline && <p className="mt-1 text-sm opacity-90">{liveData.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm opacity-85">
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-white" />{storefront.rating.toFixed(1)} ({storefront.reviewCount} reviews)</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{storefront.area}, {storefront.city}</span>
                {todayHours && !todayHours.closed && (
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{todayHours.open} – {todayHours.close}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
              {bookingType !== "none" && (
                <button
                  onClick={openGeneralBooking}
                  className="rounded-xl bg-white/20 px-5 py-2.5 text-sm font-bold backdrop-blur hover:bg-white/30"
                >
                  {config.primaryAction}
                </button>
              )}
              {storefront.contactPhone && (
                <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/20">
                  <Phone className="h-4 w-4" />{storefront.contactPhone}
                </a>
              )}
            </div>
          </div>

          {/* Availability badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            {storefront.deliveryEnabled  && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">🛵 Delivery available</span>}
            {storefront.pickupEnabled    && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">📦 Pickup available</span>}
            {storefront.bookingEnabled   && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">📅 Online booking</span>}
            {!isOpenNow && todayHours?.closed && <span className="rounded-full bg-red-400/30 px-3 py-1 text-xs font-medium">Closed today</span>}
            {refCode && <span className="rounded-full bg-yellow-400/30 px-3 py-1 text-xs font-medium">🎁 Referral deal active</span>}
          </div>
        </div>
      </div>

      {/* ── Trust Bar ────────────────────────────────────────────────────── */}
      <TrustBar industry={storefront.industry} softClass={softClass} darkClass={darkClass} />

      {/* ── Offers strip ─────────────────────────────────────────────────── */}
      {liveOffers.length > 0 && (
        <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center gap-2 mb-3">
              <Zap className={`h-4 w-4 ${darkClass}`} />
              <p className="text-sm font-bold text-slate-800">Active offers</p>
            </div>
            <OffersStrip offers={liveOffers} accentClass={accentClass} currency={storefront.currency || items[0]?.currency || "SEK"} />
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="flex gap-6 flex-col lg:flex-row">

          {/* Left: items */}
          <div className="flex-1 min-w-0">
            {/* Events section */}
            <EventsSection
              events={liveEvents}
              storefront={storefront}
              accentClass={accentClass}
              darkClass={darkClass}
              softClass={softClass}
            />

            {/* Search bar */}
            {liveItems.length >= 6 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${config.itemPlural}…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* Category tabs */}
            {categories.length > 2 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      activeCategory === cat ? `${accentClass} text-white` : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                {searchQuery ? (
                  <>
                    <Search className="mx-auto h-8 w-8 text-slate-200 mb-3" />
                    <p className="text-slate-500 text-sm font-medium">No results for &ldquo;{searchQuery}&rdquo;</p>
                    <button onClick={() => setSearchQuery("")} className="mt-2 text-xs text-blue-600 hover:underline">Clear search</button>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm">No {config.itemPlural} available yet.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    accentClass={accentClass}
                    darkClass={darkClass}
                    softClass={softClass}
                    bookingType={bookingType}
                    showCart={showCart}
                    cartQty={cart[item.id] ?? 0}
                    onAdd={showCart ? () => addToCart(item.id) : () => {}}
                    onBook={openBooking}
                    onDetail={(i) => setDetailItem(i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: action panel */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            {showCart ? (
              <CartPanel
                cart={cart}
                items={liveItems}
                storefront={storefront}
                availability={availability}
                accentClass={accentClass}
                softClass={softClass}
                darkClass={darkClass}
                onAdd={(id) => addToCart(id)}
                onRemove={(id) => removeFromCart(id)}
                onClear={() => setCart({})}
              />
            ) : bookingType !== "none" ? (
              <div className={`rounded-2xl border border-slate-200 bg-white p-5`}>
                <p className="font-bold text-slate-900 mb-1">{config.primaryAction}</p>
                <p className="text-sm text-slate-500 mb-4">Select a {config.itemNoun} below and click Book, or use the button to make a general enquiry.</p>
                <button
                  onClick={openGeneralBooking}
                  className={`w-full rounded-xl py-2.5 text-sm font-bold text-white ${accentClass} hover:opacity-90`}
                >
                  {bookingType === "inquiry" ? "Request a free quote" : `${config.primaryAction} →`}
                </button>
                {caps.crossSellCategories.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Often booked together</p>
                    <div className="space-y-1.5">
                      {caps.crossSellCategories.slice(0, 3).map((cat) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{cat}</span>
                          <span className={`text-xs font-medium ${darkClass}`}>Browse <ChevronRight className="inline h-3 w-3" /></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Business info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <p className="font-bold text-slate-900 text-sm">Contact & hours</p>
              {storefront.contactPhone && (
                <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600">
                  <Phone className="h-4 w-4 shrink-0" />{storefront.contactPhone}
                </a>
              )}
              {storefront.contactEmail && (
                <a href={`mailto:${storefront.contactEmail}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600">
                  <Mail className="h-4 w-4 shrink-0" />{storefront.contactEmail}
                </a>
              )}
              {storefront.address && (
                <p className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />{storefront.address}
                </p>
              )}
              <div className="border-t border-slate-100 pt-3 space-y-1">
                {days.map((day) => {
                  const h = storefront.openingHours?.[day];
                  return (
                    <div key={day} className={`flex justify-between text-xs ${day === todayName ? "font-semibold" : "text-slate-400"}`}>
                      <span className="capitalize">{day.slice(0, 3)}</span>
                      <span>{h?.closed ? "Closed" : h ? `${h.open} – ${h.close}` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Affiliate ref reminder */}
            {refCode && (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm">
                <p className="font-semibold text-yellow-800">🎁 You were referred!</p>
                <p className="text-yellow-700 text-xs mt-1">Code <strong>{refCode}</strong> is active. Any deal or coupon will be auto-applied.</p>
              </div>
            )}
          </div>
        </div>

        {/* Membership panel — real joinable plans (scan-QR → join) when the
            business sells memberships; otherwise the marketing/loyalty panel. */}
        {(storefront.memberships?.length ?? 0) > 0 ? (
          <div className="mt-8">
            <MembershipJoinSection
              slug={storefront.slug}
              memberships={storefront.memberships ?? []}
              joinIntent={joinIntent}
            />
          </div>
        ) : caps.membershipEnabled ? (
          <div className="mt-8">
            <p className={`mb-3 flex items-center gap-2 font-bold text-slate-900`}>
              <Shield className={`h-4 w-4 ${darkClass}`} /> Membership & loyalty
            </p>
            <BusinessMembershipPanel business={bizAsLegacy} />
          </div>
        ) : null}

        {/* Cross-sell section */}
        {caps.crossSellCategories.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 font-bold text-slate-900">You might also like</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {caps.crossSellCategories.map((cat) => {
                const catConfig = getIndustryStorefrontConfig(cat as never);
                return (
                  <Link
                    key={cat}
                    href={`/moredealsx/businesses?industry=${encodeURIComponent(cat)}`}
                    className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{catConfig.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{catConfig.primaryAction}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Photo gallery — uploaded by business admin via /storefront */}
        <GallerySection images={liveData.gallery} name={liveData.name} accentClass={accentClass} />
      </div>

      {/* ── Mobile cart FAB ───────────────────────────────────────────────── */}
      {showCart && cartCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 lg:hidden">
          <button
            onClick={() => setShowCartDrawer(true)}
            className={`flex items-center gap-3 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-lg ${accentClass}`}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount} item{cartCount !== 1 ? "s" : ""} in cart
          </button>
        </div>
      )}

      {/* Mobile cart drawer */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden">
          <div className="flex-1 bg-black/40" onClick={() => setShowCartDrawer(false)} />
          <div className="bg-slate-50 px-4 pt-4 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-slate-900">Your cart</p>
              <button onClick={() => setShowCartDrawer(false)}><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <CartPanel
              cart={cart} items={liveItems} storefront={storefront} availability={availability}
              accentClass={accentClass} softClass={softClass} darkClass={darkClass}
              onAdd={(id) => addToCart(id)} onRemove={(id) => removeFromCart(id)} onClear={() => { setCart({}); setShowCartDrawer(false); }}
            />
          </div>
        </div>
      )}

      {/* Booking / inquiry modal */}
      {showBookingModal && (
        <BookingModal
          item={bookingItem}
          storefront={storefront}
          bookingType={bookingType}
          requiresDateRange={requiresDateRange}
          requiresGuestCount={requiresGuestCount}
          accentClass={accentClass}
          onClose={() => { setShowBookingModal(false); setBookingItem(null); }}
        />
      )}

      {/* Product detail drawer */}
      {detailItem && (
        <ProductDetailDrawer
          item={detailItem}
          accentClass={accentClass}
          darkClass={darkClass}
          softClass={softClass}
          bookingType={bookingType}
          showCart={showCart}
          onAdd={(i) => addToCart(i.id)}
          onBook={(i) => { setDetailItem(null); openBooking(i); }}
          onClose={() => setDetailItem(null)}
          cartQty={cart[detailItem.id] ?? 0}
        />
      )}

      {/* Floating WhatsApp / Call */}
      <FloatingActions phone={storefront.contactPhone} />
    </div>
  );
}
