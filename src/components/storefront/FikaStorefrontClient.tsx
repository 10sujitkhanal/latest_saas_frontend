"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart, X, Plus, Minus, CheckCircle2, Search, ArrowRight,
  MessageCircle, Truck, RotateCcw, Shield, ChevronLeft, Clock,
  Leaf, Star, Calendar, Coffee, Settings2,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicOrder } from "@/lib/storefront/storefrontPublicApi";
import MembershipJoinSection from "@/components/storefront/MembershipJoinSection";
import GiftCardBuySection from "@/components/storefront/GiftCardBuySection";
import { formatCurrencyMarket, buildSwishLink, isPriceInclusive, getVatLabel } from "@/lib/utils/currency";
import { getIndustryCapabilities } from "@/lib/industry/config";
import { getIndustryStorefrontConfig } from "@/lib/moredealsx/industry-config";
import { loadPinnedItems, type CrossSellItem } from "@/lib/storefront/crossSellCatalogue";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  storefront:   PublicStorefront;
  items:        PublicItem[];
  offers:       PublicOffer[];
  availability: PublicAvailability | null;
  refCode?:     string;
  joinIntent?:  boolean;
}

type CartMap = Record<string, number>;

// Stamps: buy 9 get 1 free
const STAMPS_FOR_FREE = 9;

interface StampCard {
  count: number;
  lastStamp: string;
  totalEarned: number;
  freeItemsEarned: number;
}

// ─── Swedish fika constants ───────────────────────────────────────────────────

const DIETARY_LABELS: Record<string, { label: string; icon: string; bg: string }> = {
  vegan:        { label: "Vegansk",   icon: "🌱", bg: "bg-green-100 text-green-800"   },
  vegetarian:   { label: "Veg",       icon: "🥗", bg: "bg-lime-100 text-lime-800"     },
  gluten_free:  { label: "Glutenfri", icon: "✓",  bg: "bg-amber-100 text-amber-800"   },
  lactose_free: { label: "Laktosfri", icon: "✓",  bg: "bg-orange-100 text-orange-800" },
  sugar_free:   { label: "Sockerfri", icon: "✓",  bg: "bg-pink-100 text-pink-800"     },
  krav:         { label: "KRAV",      icon: "🌿", bg: "bg-emerald-100 text-emerald-800"},
  organic:      { label: "Eko",       icon: "⭐", bg: "bg-lime-100 text-lime-800"     },
};

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: "Gluten", dairy: "Mjölk", eggs: "Ägg",
  nuts: "Nötter", almonds: "Mandel", soy: "Soja", sesame: "Sesam",
};

const PICKUP_SLOTS = [
  { key: "morning",   label: "Morgon",       time: "08:00–10:00" },
  { key: "fika",      label: "Förmiddagsfika",time: "10:00–12:00" },
  { key: "lunch",     label: "Lunch",         time: "12:00–14:00" },
  { key: "afternoon", label: "Eftermiddagsfika",time:"14:00–17:00"},
];

const TRUST_POINTS = [
  { icon: <span className="text-base">🥐</span>, text: "Nybakat varje morgon" },
  { icon: <Truck     className="h-4 w-4" />,     text: "Hemleverans & hämtning"    },
  { icon: <Leaf      className="h-4 w-4" />,     text: "Lokala råvaror"            },
  { icon: <Shield    className="h-4 w-4" />,     text: "Säker betalning"           },
  { icon: <Star      className="h-4 w-4" />,     text: "Stamkort — var 9:e gratis" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function getAttr(item: PublicItem, key: string): unknown {
  return (item as any).attributes?.[key];
}

function getList(item: PublicItem, key: string): string[] {
  const raw = getAttr(item, key);
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return raw.split(",").map(s => s.trim());
  return [];
}

// ─── LoyaltyStampCard ─────────────────────────────────────────────────────────

function LoyaltyStampCard({ stamps, slug }: { stamps: StampCard; slug: string }) {
  const filled   = stamps.count % STAMPS_FOR_FREE;
  const isFull   = stamps.count > 0 && stamps.count % STAMPS_FOR_FREE === 0;
  const progress = isFull ? STAMPS_FOR_FREE : filled;

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-amber-900">☕ Ditt stamkort</p>
          <p className="text-xs text-amber-700 mt-0.5">Samla {STAMPS_FOR_FREE} stämplar — nästa fika är gratis</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-amber-600">{stamps.freeItemsEarned} gratis intjänade</p>
        </div>
      </div>

      {/* Stamp circles */}
      <div className="grid grid-cols-9 gap-1.5 mb-3">
        {Array.from({ length: STAMPS_FOR_FREE }).map((_, i) => {
          const stamped = i < progress;
          const isNext  = i === progress && !isFull;
          return (
            <div key={i}
              className={`aspect-square rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                stamped
                  ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                  : isNext
                  ? "border-amber-400 border-dashed bg-white text-amber-300"
                  : "border-amber-200 bg-white text-amber-200"
              }`}>
              {stamped ? "☕" : isNext ? "·" : "○"}
            </div>
          );
        })}
      </div>

      {isFull ? (
        <div className="rounded-xl bg-amber-600 text-white text-center py-2.5 text-sm font-bold animate-pulse">
          🎉 Grattis! Din nästa fika är gratis — visa för personalen
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-amber-700">
            {STAMPS_FOR_FREE - progress} stämpel{STAMPS_FOR_FREE - progress === 1 ? "" : "ar"} kvar till gratis fika
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: progress }).map((_, i) => (
              <span key={i} className="text-amber-500 text-xs">★</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FikaItemCard ─────────────────────────────────────────────────────────────

function FikaItemCard({ item, onAdd, onDetail }: {
  item: PublicItem;
  onAdd: (id: string) => void;
  onDetail: (item: PublicItem) => void;
}) {
  const price       = item.discountPrice ?? item.price;
  const dietary     = getList(item, "dietary");
  const freshBaked  = getAttr(item, "freshBaked") === true;
  const preorderOnly = getAttr(item, "preorderOnly") === true;
  const season      = getAttr(item, "season") as string | undefined;

  return (
    <div className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md transition-all cursor-pointer"
      onClick={() => onDetail(item)}>
      {/* Image */}
      <div className="aspect-square bg-amber-50 flex items-center justify-center overflow-hidden relative">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <span className="text-5xl">{item.imageEmoji || "☕"}</span>}

        {item.discountPrice && (
          <span className="absolute top-2 left-2 rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">
            -{Math.round((1 - item.discountPrice / item.price) * 100)}%
          </span>
        )}
        {freshBaked && (
          <span className="absolute top-2 right-2 rounded-full bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5">
            🥐 Nybakat
          </span>
        )}
        {preorderOnly && !freshBaked && (
          <span className="absolute top-2 right-2 rounded-full bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5">
            📅 Förbeställ
          </span>
        )}
      </div>

      <div className="p-4 space-y-2">
        {/* Season tag */}
        {season && season !== "Hela året" && (
          <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{season}</span>
        )}

        <h3 className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">{item.title}</h3>

        {/* Dietary badges */}
        {dietary.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dietary.slice(0, 3).map(d => {
              const dl = DIETARY_LABELS[d];
              return dl ? (
                <span key={d} className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${dl.bg}`}>
                  {dl.icon} {dl.label}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Price */}
        <div className="flex items-end justify-between pt-1">
          <div>
            {item.discountPrice && <p className="text-xs text-stone-400 line-through">{fmt(item.price, item.currency)}</p>}
            <p className="text-base font-bold text-stone-900">{fmt(price, item.currency)}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onAdd(item.id); }}
            className="flex items-center gap-1 rounded-xl px-3 py-2 bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProductDetailDrawer ──────────────────────────────────────────────────────

function ProductDetailDrawer({ item, onClose, onAdd, currency }: {
  item: PublicItem;
  onClose: () => void;
  onAdd: (id: string) => void;
  currency: string;
}) {
  const price       = item.discountPrice ?? item.price;
  const dietary     = getList(item, "dietary");
  const allergens   = getList(item, "allergens");
  const freshBaked  = getAttr(item, "freshBaked") === true;
  const preorderOnly = getAttr(item, "preorderOnly") === true;
  const season      = getAttr(item, "season") as string | undefined;
  const servings    = getAttr(item, "servings") as number | undefined;
  const availableDays = getList(item, "availableDays");
  const [qty, setQty] = useState(1);
  const [pickupSlot, setPickupSlot] = useState(PICKUP_SLOTS[1].key);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100">
            <ChevronLeft className="h-5 w-5 text-stone-500" />
          </button>
          <p className="text-sm font-semibold text-stone-600 truncate max-w-[200px]">{item.title}</p>
          <div className="w-8" />
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">
          {/* Image */}
          <div className="w-full aspect-square rounded-2xl bg-amber-50 flex items-center justify-center overflow-hidden border border-amber-100">
            {item.imageUrl
              ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
              : <span className="text-8xl">{item.imageEmoji || "☕"}</span>}
          </div>

          {/* Name + meta */}
          <div>
            <div className="flex flex-wrap gap-1 mb-2">
              {freshBaked && <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">🥐 Nybakat dagligen</span>}
              {preorderOnly && <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">📅 Förbeställning krävs</span>}
              {season && season !== "Hela året" && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">🍂 {season}</span>}
            </div>
            <h2 className="text-xl font-bold text-stone-900">{item.title}</h2>
            {item.shortDescription && <p className="text-sm text-stone-500 mt-1">{item.shortDescription}</p>}
            {servings && <p className="text-xs text-stone-400 mt-1">{servings} bitar / portioner</p>}
          </div>

          {/* Dietary */}
          {dietary.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Märkningar</p>
              <div className="flex flex-wrap gap-1.5">
                {dietary.map(d => {
                  const dl = DIETARY_LABELS[d];
                  return dl ? (
                    <span key={d} className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${dl.bg}`}>{dl.icon} {dl.label}</span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Allergens */}
          {allergens.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">⚠️ Innehåller allergener</p>
              <div className="flex flex-wrap gap-1.5">
                {allergens.map(a => (
                  <span key={a} className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-red-100 text-red-700">
                    {ALLERGEN_LABELS[a] ?? a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Available days */}
          {availableDays.length > 0 && (
            <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Tillgänglig
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableDays.map(d => (
                  <span key={d} className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-800">{d}</span>
                ))}
              </div>
            </div>
          )}

          {/* Pickup slot selector */}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Välj upphämtningstid
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PICKUP_SLOTS.map(slot => (
                <button key={slot.key}
                  onClick={() => setPickupSlot(slot.key)}
                  className={`rounded-xl px-3 py-2.5 text-left border transition-all ${pickupSlot === slot.key ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white hover:border-amber-300"}`}>
                  <p className="text-xs font-semibold text-stone-800">{slot.label}</p>
                  <p className="text-[10px] text-stone-400">{slot.time}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Om produkten</p>
              <p className="text-sm text-stone-600 leading-relaxed">{item.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-stone-100 bg-white px-6 py-4 space-y-3">
          {isPriceInclusive(currency) && (
            <p className="text-[10px] text-stone-400 text-right">{getVatLabel(currency)}</p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2.5 hover:bg-stone-50">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="px-3 py-2.5 hover:bg-stone-50">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => { for (let i = 0; i < qty; i++) onAdd(item.id); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-amber-700 text-white text-sm font-bold hover:bg-amber-800 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Lägg i varukorg · {fmt(price * qty, currency)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FikaCartPanel ────────────────────────────────────────────────────────────

function FikaCartPanel({ cart, items, storefront, availability, stamps, onAdd, onRemove, onClear, onOrderComplete }: {
  cart: CartMap;
  items: PublicItem[];
  storefront: PublicStorefront;
  availability: PublicAvailability | null;
  stamps: StampCard;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOrderComplete: () => void;
}) {
  const [form, setForm]         = useState({ name: "", phone: "", address: "", notes: "" });
  const [pickupSlot, setPickupSlot] = useState(PICKUP_SLOTS[1].key);
  const [orderType, setOrderType]   = useState<"pickup" | "delivery">("pickup");
  const [done, setDone]         = useState(false);
  const [orderNum, setOrderNum] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showSwishBox, setShowSwishBox] = useState(false);

  const paySettings = (() => {
    if (typeof window === "undefined") return { enabled: {}, keys: {} };
    try { return JSON.parse(localStorage.getItem(`storefront_payments_${storefront.slug}`) ?? "{}"); }
    catch { return { enabled: {}, keys: {} }; }
  })();
  const swishEnabled = !!paySettings?.enabled?.swish;
  const swishNumber  = (paySettings?.keys?.swish ?? "").replace(/\D/g, "");

  const cartEntries = Object.entries(cart)
    .map(([id, qty]) => ({ item: items.find(i => i.id === id)!, qty }))
    .filter(x => x.item);

  const subtotal    = cartEntries.reduce((s, { item, qty }) => s + (item.discountPrice ?? item.price) * qty, 0);
  const deliveryFee = orderType === "delivery" ? (availability?.deliveryFee ?? 0) : 0;
  const total       = subtotal + deliveryFee;
  const itemCount   = cartEntries.reduce((s, { qty }) => s + qty, 0);

  const canOrder = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && cartEntries.length > 0;

  const addStamps = (count: number) => {
    const key = `fika_stamps_${storefront.slug}`;
    try {
      const raw: StampCard = JSON.parse(localStorage.getItem(key) ?? "null") ?? { count: 0, lastStamp: "", totalEarned: 0, freeItemsEarned: 0 };
      const newCount = raw.count + count;
      const freeEarned = Math.floor(newCount / STAMPS_FOR_FREE);
      localStorage.setItem(key, JSON.stringify({
        count: newCount,
        lastStamp: new Date().toISOString().slice(0, 10),
        totalEarned: raw.totalEarned + count,
        freeItemsEarned: freeEarned,
      }));
    } catch { /* ignore */ }
  };

  const handleOrder = async () => {
    setLoading(true);
    const slotLabel = PICKUP_SLOTS.find(s => s.key === pickupSlot)?.label ?? pickupSlot;
    const notesText = [
      orderType === "pickup" ? `Hämtning: ${slotLabel}` : `Leverans: ${form.address}`,
      form.notes,
    ].filter(Boolean).join(" · ");
    try {
      const res = await createPublicOrder(storefront.slug, {
        items: cartEntries.map(({ item, qty }) => ({
          itemId: item.id, title: item.title, quantity: qty,
          unitPrice: item.discountPrice ?? item.price,
        })),
        deliveryMethod: orderType,
        deliveryAddress: orderType === "delivery" ? form.address : undefined,
        customerName: form.name,
        customerPhone: form.phone,
        notes: notesText || undefined,
        subtotal, deliveryFee, discount: 0, tax: 0, total,
        paymentMethod: "cash",
        orderSource: "storefront",
      });
      setOrderNum(res.orderNumber);
      addStamps(itemCount);
      onOrderComplete();
      setDone(true);
      onClear();
    } catch {
      const fallback = "FK-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      setOrderNum(fallback);
      addStamps(itemCount);
      onOrderComplete();
      setDone(true);
      onClear();
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center space-y-3">
        <div className="text-4xl">☕</div>
        <CheckCircle2 className="mx-auto h-8 w-8 text-amber-500" />
        <p className="font-bold text-stone-900">Beställning mottagen!</p>
        <p className="text-sm text-stone-500">Ref: <span className="font-semibold font-mono">{orderNum}</span></p>
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          +{itemCount} stämpel{itemCount === 1 ? "" : "ar"} tillagd{itemCount === 1 ? "" : "a"} på ditt stamkort!
        </p>
        <p className="text-xs text-stone-400">{storefront.name} bekräftar snart.</p>
        <button onClick={() => setDone(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-amber-700">Beställ igen</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <p className="font-bold text-stone-900">Din beställning</p>

      {cartEntries.length === 0 ? (
        <div className="rounded-xl bg-amber-50 px-4 py-6 text-center">
          <Coffee className="mx-auto h-8 w-8 text-amber-200" />
          <p className="mt-2 text-sm text-stone-500">Lägg till bakverk & dryck</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cartEntries.map(({ item, qty }) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-xl">{item.imageEmoji || "☕"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{item.title}</p>
                <p className="text-xs text-stone-400">{fmt(item.discountPrice ?? item.price, item.currency)} × {qty}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onRemove(item.id)} className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => onAdd(item.id)} className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 hover:bg-stone-50">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order type */}
      <div className="grid grid-cols-2 gap-2">
        {(["pickup", "delivery"] as const).map(t => (
          <button key={t} onClick={() => setOrderType(t)}
            className={`rounded-xl py-2 text-xs font-semibold border transition-all ${orderType === t ? "border-amber-600 bg-amber-50 text-amber-800" : "border-stone-200 bg-white text-stone-500 hover:border-amber-300"}`}>
            {t === "pickup" ? "🏃 Hämta" : "🚚 Hemleverans"}
          </button>
        ))}
      </div>

      {/* Pickup slot (if pickup) */}
      {orderType === "pickup" && (
        <div>
          <p className="text-xs font-semibold text-stone-500 mb-2 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Upphämtningstid
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PICKUP_SLOTS.map(slot => (
              <button key={slot.key} onClick={() => setPickupSlot(slot.key)}
                className={`rounded-lg px-2 py-2 text-left border text-xs transition-all ${pickupSlot === slot.key ? "border-amber-500 bg-amber-50" : "border-stone-200 hover:border-amber-300"}`}>
                <p className="font-semibold text-stone-800">{slot.label}</p>
                <p className="text-stone-400">{slot.time}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Customer form */}
      <div className="space-y-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Ditt namn *" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="Telefon *" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
        {orderType === "delivery" && (
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="Leveransadress" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
        )}
      </div>

      {/* Order total */}
      {cartEntries.length > 0 && (
        <div className="border-t border-stone-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-stone-500"><span>Delsumma</span><span>{fmt(subtotal)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between text-stone-500"><span>Leverans</span><span>{fmt(deliveryFee)}</span></div>}
          <div className="flex justify-between font-bold text-stone-900"><span>Totalt</span><span>{fmt(total)}</span></div>
          {isPriceInclusive("SEK") && (
            <p className="text-[10px] text-stone-400 text-right">{getVatLabel("SEK")}</p>
          )}
        </div>
      )}

      {/* Stamp info */}
      {cartEntries.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
          <span className="text-base">☕</span>
          <p className="text-xs text-amber-800 font-medium">
            Den här beställningen ger dig +{itemCount} stämpel{itemCount === 1 ? "" : "ar"}
          </p>
        </div>
      )}

      <button onClick={handleOrder} disabled={!canOrder || loading}
        className="w-full rounded-xl py-3 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-40 transition-colors">
        {loading ? "Skickar…" : `Beställ · ${fmt(total)}`}
      </button>

      {/* Swish */}
      {swishEnabled && swishNumber && cartEntries.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] font-medium text-stone-400">eller betala direkt</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>
          {showSwishBox ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center space-y-2">
              <p className="text-2xl font-black text-green-700">🟢 Swish</p>
              <p className="text-sm text-stone-600">Skicka <span className="font-bold">{fmt(total)}</span> till:</p>
              <p className="text-xl font-mono font-bold text-stone-800 tracking-wider">{swishNumber}</p>
              <a href={buildSwishLink({ payeeNumber: swishNumber, amount: total, message: `Beställning ${storefront.name}` })}
                className="block w-full rounded-lg py-2 bg-green-500 text-white text-sm font-bold hover:bg-green-600">
                Öppna Swish-appen
              </a>
              <button onClick={() => setShowSwishBox(false)} className="text-xs text-stone-400 underline">Avbryt</button>
            </div>
          ) : (
            <button onClick={() => setShowSwishBox(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors">
              🟢 Betala med Swish · {fmt(total)}
            </button>
          )}
        </>
      )}

      {/* WhatsApp */}
      {storefront.contactPhone && cartEntries.length > 0 && form.name.trim() && (
        <a href={`https://wa.me/${storefront.contactPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hej ${storefront.name}! ☕ Jag vill beställa:\n\n${cartEntries.map(({ item, qty }) =>
            `• ${qty}× ${item.title} — ${fmt((item.discountPrice ?? item.price) * qty, item.currency)}`
          ).join("\n")}\n\nTotalt: ${fmt(total)}\n${orderType === "pickup" ? `Hämtar: ${PICKUP_SLOTS.find(s => s.key === pickupSlot)?.label}` : `Leverans till: ${form.address}`}\nNamn: ${form.name}\nTelefon: ${form.phone}`
        )}`}
          target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors">
          <MessageCircle className="h-4 w-4" />
          Beställ via WhatsApp
        </a>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FikaStorefrontClient({ storefront, items, offers, availability, refCode, joinIntent }: Props) {
  const cacheKey  = `storefront_cache_${storefront.slug}`;
  const stampsKey = `fika_stamps_${storefront.slug}`;

  const [liveItems,  setLiveItems]  = useState<PublicItem[]>(items);
  const [liveOffers, setLiveOffers] = useState<PublicOffer[]>(offers);
  const [announcement, setAnnouncement] = useState({ text: "", type: "promo", visible: false });
  const [bannerUrl, setBannerUrl]   = useState(storefront.bannerUrl);
  const [logoUrl,   setLogoUrl]     = useState(storefront.logoUrl);
  const [name,      setName]        = useState(storefront.name);
  const [tagline,   setTagline]     = useState(storefront.tagline);
  const [pinnedItems, setPinnedItems] = useState<CrossSellItem[]>([]);

  useEffect(() => {
    setPinnedItems(loadPinnedItems(storefront.id ?? storefront.slug));
  }, [storefront.id, storefront.slug]);

  // Loyalty stamp card
  const [stamps, setStamps] = useState<StampCard>({ count: 0, lastStamp: "", totalEarned: 0, freeItemsEarned: 0 });

  const loadStamps = useCallback(() => {
    try {
      const raw = localStorage.getItem(stampsKey);
      if (raw) setStamps(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [stampsKey]);

  const applyCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.bannerUrl    !== undefined) setBannerUrl(c.bannerUrl);
      if (c.logoUrl      !== undefined) setLogoUrl(c.logoUrl);
      if (c.name         !== undefined) setName(c.name);
      if (c.tagline      !== undefined) setTagline(c.tagline);
      if (c.announcement !== undefined) setAnnouncement({
        text: c.announcement ?? "", type: c.announcementType ?? "promo", visible: !!c.announcementVisible,
      });
      const userProducts = (c.products ?? []).filter((p: PublicItem) => !p.id.startsWith("sfp-"));
      if (userProducts.length > 0) setLiveItems(userProducts);
      const userOffers = (c.offers ?? []).filter((o: PublicOffer) => !o.id.startsWith("sfo-"));
      if (userOffers.length > 0) setLiveOffers(userOffers);
    } catch { /* ignore */ }
  }, [cacheKey]);

  useEffect(() => {
    applyCache();
    loadStamps();
    const onStorage  = () => { applyCache(); loadStamps(); };
    const onVisible  = () => { if (!document.hidden) { applyCache(); loadStamps(); } };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", onVisible); };
  }, [applyCache, loadStamps]);

  const [cart,     setCart]     = useState<CartMap>({});
  const [showCart, setShowCart] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const addToCart      = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(c => {
    const next = { ...c };
    if ((next[id] ?? 0) > 1) next[id]--; else delete next[id];
    return next;
  });
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [detailItem,     setDetailItem]     = useState<PublicItem | null>(null);

  const visibleItems = liveItems.filter(item => {
    if (searchQuery) {
      const hay = `${item.title} ${item.shortDescription ?? ""} ${item.category ?? ""}`.toLowerCase();
      if (!hay.includes(searchQuery.toLowerCase())) return false;
    }
    if (activeCategory && item.category !== activeCategory) return false;
    return true;
  });

  const categories    = Array.from(new Set(liveItems.map(i => i.category).filter(Boolean))) as string[];
  const storeCurrency = liveItems[0]?.currency ?? "SEK";
  const totalCartPrice = Object.entries(cart).reduce((s, [id, qty]) => {
    const item = liveItems.find(i => i.id === id);
    return item ? s + (item.discountPrice ?? item.price) * qty : s;
  }, 0);

  const ANNOUNCEMENT_BG: Record<string, string> = {
    promo: "bg-amber-700 text-white", info: "bg-blue-600 text-white",
    warning: "bg-red-500 text-white", success: "bg-green-600 text-white",
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {announcement.visible && announcement.text && (
        <div className={`${ANNOUNCEMENT_BG[announcement.type] ?? ANNOUNCEMENT_BG.promo} text-center py-2 px-4 text-sm font-medium`}>
          {announcement.text}
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {logoUrl
              ? <img src={logoUrl} alt={name} className="h-9 w-9 rounded-full object-cover" />
              : <div className="h-9 w-9 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-sm">{name[0]}</div>}
            <div>
              <p className="text-sm font-bold text-stone-900">{name}</p>
              <p className="text-xs text-amber-700">{storefront.city}</p>
            </div>
          </div>
          <button onClick={() => setShowCart(v => !v)}
            className="relative flex items-center gap-2 rounded-xl bg-amber-700 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-800 transition-colors">
            <ShoppingCart className="h-4 w-4" />
            Beställ
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden bg-amber-700 text-white">
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <p className="text-amber-300 text-sm font-semibold uppercase tracking-widest mb-3">
            ☕ Kafé & Fika
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight max-w-2xl leading-tight">
            {tagline || name}
          </h1>
          <p className="mt-4 text-amber-100 text-lg max-w-xl">{storefront.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-2 rounded-full bg-white text-amber-800 px-6 py-3 text-sm font-bold hover:bg-amber-50 transition-colors">
              Se menyn <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => document.getElementById("stamkort")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-2 rounded-full border border-amber-400 text-white px-6 py-3 text-sm font-semibold hover:bg-amber-600 transition-colors">
              ☕ Mitt stamkort
            </button>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap justify-center gap-6">
          {TRUST_POINTS.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-stone-600">
              <span className="text-amber-600">{t.icon}</span>
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* Membership join (scan-QR → become a member) — after hero, before products */}
      {(storefront.memberships?.length ?? 0) > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10">
          <MembershipJoinSection slug={storefront.slug} memberships={storefront.memberships ?? []} joinIntent={joinIntent} />
          {storefront.sellsGiftCards && <GiftCardBuySection slug={storefront.slug} currency={storefront.currency ?? ""} denominations={storefront.giftCardDenominations ?? []} message={storefront.giftCardMessage} />}
        </div>
      )}

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* Loyalty stamp card */}
            <section id="stamkort">
              <LoyaltyStampCard stamps={stamps} slug={storefront.slug} />
            </section>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sök i menyn…"
                className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-stone-400" />
                </button>
              )}
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button onClick={() => setActiveCategory("")}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${activeCategory === "" ? "bg-amber-700 text-white border-amber-700" : "bg-white text-stone-600 border-stone-200 hover:border-amber-400"}`}>
                  Allt
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${activeCategory === cat ? "bg-amber-700 text-white border-amber-700" : "bg-white text-stone-600 border-stone-200 hover:border-amber-400"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Product grid */}
            <section id="menu">
              <h2 className="text-lg font-bold text-stone-900 mb-4">
                {activeCategory || "Hela menyn"}
                <span className="ml-2 text-sm font-normal text-stone-400">{visibleItems.length} produkter</span>
              </h2>
              {visibleItems.length === 0 ? (
                <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
                  <p className="text-stone-400 text-sm">Inga produkter matchar din sökning</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {visibleItems.map(item => (
                    <FikaItemCard key={item.id} item={item} onAdd={addToCart} onDetail={setDetailItem} />
                  ))}
                </div>
              )}
            </section>

            {/* Offers */}
            {liveOffers.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-stone-900 mb-4">Erbjudanden</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {liveOffers.map(offer => (
                    <div key={offer.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 uppercase tracking-wide">{offer.discountType}</span>
                      <h3 className="mt-2 font-bold text-stone-900">{offer.title}</h3>
                      <p className="text-sm text-stone-600 mt-1">{offer.description}</p>
                      {offer.code && (
                        <p className="mt-2 font-mono text-sm font-bold text-amber-800 bg-white rounded-lg px-3 py-1 inline-block border border-amber-200">
                          {offer.code}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Fika philosophy */}
            <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
              <h2 className="text-lg font-bold text-stone-900 mb-2">☕ Om fika</h2>
              <p className="text-sm text-stone-500 leading-relaxed">
                Fika är mer än bara kaffe och kaka — det är en paus, en mötesplats och en del av den svenska själen.
                Hos oss bakar vi med lokala råvaror varje morgon och välkomnar dig till en stunds ro mitt i vardagen.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { icon: "🌾", label: "Lokala råvaror",    desc: "Direkt från svenska bönder" },
                  { icon: "🥐", label: "Nybakat dagligen",  desc: "Klart klockan 07:00"        },
                  { icon: "🌿", label: "KRAV & ekologiskt", desc: "Där det är möjligt"          },
                ].map(p => (
                  <div key={p.label} className="rounded-xl bg-amber-50 p-3 text-center">
                    <p className="text-2xl mb-1">{p.icon}</p>
                    <p className="text-xs font-semibold text-amber-900">{p.label}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{p.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: cart (desktop) */}
          <div className="lg:w-80 xl:w-96 shrink-0">
            <div className="sticky top-20">
              <FikaCartPanel
                cart={cart} items={liveItems} storefront={storefront}
                availability={availability} stamps={stamps}
                onAdd={addToCart} onRemove={removeFromCart}
                onClear={() => setCart({})}
                onOrderComplete={loadStamps}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cross-sell */}
      {pinnedItems.length > 0 ? (
        <section className="max-w-5xl mx-auto px-4 py-8">
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
        <section className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Pair With Your Coffee</h2>
            <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-700 font-medium">
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
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Mobile cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden">
          <button onClick={() => setShowMobileCart(true)}
            className="flex items-center gap-3 rounded-full bg-amber-700 text-white px-6 py-3 shadow-2xl text-sm font-bold hover:bg-amber-800">
            <ShoppingCart className="h-5 w-5" />
            {cartCount} varor · {fmt(totalCartPrice, storeCurrency)}
          </button>
        </div>
      )}

      {/* Mobile cart drawer */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMobileCart(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 bg-stone-50 rounded-t-2xl max-h-[90vh] overflow-y-auto p-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-stone-900">Din beställning</p>
              <button onClick={() => setShowMobileCart(false)} className="p-2 hover:bg-stone-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FikaCartPanel
              cart={cart} items={liveItems} storefront={storefront}
              availability={availability} stamps={stamps}
              onAdd={addToCart} onRemove={removeFromCart}
              onClear={() => { setCart({}); setShowMobileCart(false); }}
              onOrderComplete={() => { loadStamps(); setShowMobileCart(false); }}
            />
          </div>
        </div>
      )}

      {/* Product detail drawer */}
      {detailItem && (
        <ProductDetailDrawer
          item={detailItem} onClose={() => setDetailItem(null)}
          onAdd={addToCart} currency={storeCurrency}
        />
      )}
    </div>
  );
}
