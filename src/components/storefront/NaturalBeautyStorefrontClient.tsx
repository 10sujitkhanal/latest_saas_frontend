"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart, X, Plus, Minus, CheckCircle2, ChevronRight,
  Search, ArrowRight, RefreshCw, MessageCircle, Truck,
  RotateCcw, Shield, Leaf, ChevronLeft, Info, Sparkles, Settings2,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicOrder } from "@/lib/storefront/storefrontPublicApi";
import MembershipJoinSection from "@/components/storefront/MembershipJoinSection";
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
type SubInterval = "once" | "monthly" | "bi_monthly" | "quarterly";

// ─── Constants ────────────────────────────────────────────────────────────────

const BEAUTY_CERTS = [
  { key: "ecocert",        label: "ECOCERT",               icon: "🌿", bg: "bg-green-100 text-green-800",    tip: "Certifierad av ECOCERT" },
  { key: "cosmos_organic", label: "COSMOS Organic",        icon: "⭐", bg: "bg-lime-100 text-lime-800",      tip: "COSMOS organisk certifiering" },
  { key: "cosmos_natural", label: "COSMOS Natural",        icon: "🌱", bg: "bg-emerald-100 text-emerald-800",tip: "COSMOS naturlig certifiering" },
  { key: "cruelty_free",   label: "Cruelty Free",          icon: "🐰", bg: "bg-pink-100 text-pink-800",      tip: "Inte testad på djur" },
  { key: "leaping_bunny",  label: "Leaping Bunny",         icon: "🐇", bg: "bg-rose-100 text-rose-800",      tip: "Leaping Bunny certifierad" },
  { key: "naturkosmetik",  label: "Naturkosmetik",         icon: "🍃", bg: "bg-teal-100 text-teal-800",      tip: "Certifierad naturkosmetik" },
  { key: "vegan_society",  label: "Vegan Society",         icon: "🌱", bg: "bg-purple-100 text-purple-800",  tip: "Vegan Society certifierad" },
  { key: "dermatologiskt", label: "Dermatologiskt testad", icon: "🔬", bg: "bg-blue-100 text-blue-800",      tip: "Kliniskt dermatologiskt testad" },
] as const;

type BeautyCertKey = typeof BEAUTY_CERTS[number]["key"];

const SKIN_TYPES = [
  { key: "all",         label: "Alla",       icon: "✨" },
  { key: "normal",      label: "Normal",     icon: "🌸" },
  { key: "dry",         label: "Torr",       icon: "💧" },
  { key: "combination", label: "Kombinerad", icon: "☯️" },
  { key: "sensitive",   label: "Känslig",    icon: "🌼" },
  { key: "oily",        label: "Fet",        icon: "✨" },
] as const;

type SkinTypeKey = typeof SKIN_TYPES[number]["key"];

const SUBSCRIPTION_OPTIONS: { key: SubInterval; label: string; discount: number }[] = [
  { key: "once",       label: "Engångsköp",    discount: 0  },
  { key: "monthly",    label: "Varje månad",   discount: 15 },
  { key: "bi_monthly", label: "Varannan månad",discount: 10 },
  { key: "quarterly",  label: "Varje kvartal", discount: 5  },
];

const TRUST_POINTS = [
  { icon: <Truck      className="h-4 w-4" />, text: "Gratis frakt över 499 kr"           },
  { icon: <RotateCcw  className="h-4 w-4" />, text: "30 dagar öppet köp"                 },
  { icon: <Shield     className="h-4 w-4" />, text: "Säker betalning"                    },
  { icon: <Leaf       className="h-4 w-4" />, text: "EU-certifierade ingredienser"       },
  { icon: <Sparkles   className="h-4 w-4" />, text: "Inga skadliga tillsatser"           },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function getAttr(item: PublicItem, key: string): string | string[] | number | undefined {
  return (item as any).attributes?.[key];
}

function getCertList(item: PublicItem): BeautyCertKey[] {
  const raw = getAttr(item, "certifications");
  if (Array.isArray(raw)) return raw as BeautyCertKey[];
  if (typeof raw === "string") return raw.split(",").map(s => s.trim()) as BeautyCertKey[];
  return [];
}

function getSkinTypes(item: PublicItem): string[] {
  const raw = getAttr(item, "skinTypes");
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return raw.split(",").map(s => s.trim());
  return [];
}

function getFreeFrom(item: PublicItem): string[] {
  const raw = getAttr(item, "freeFrom");
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return raw.split(",").map(s => s.trim());
  return [];
}

function applySubDiscount(price: number, interval: SubInterval): number {
  const opt = SUBSCRIPTION_OPTIONS.find(o => o.key === interval);
  if (!opt || opt.discount === 0) return price;
  return Math.round(price * (1 - opt.discount / 100));
}

// ─── CertBadge ────────────────────────────────────────────────────────────────

function CertBadge({ certKey, size = "sm" }: { certKey: string; size?: "sm" | "xs" }) {
  const cert = BEAUTY_CERTS.find(c => c.key === certKey);
  if (!cert) return null;
  return (
    <span title={cert.tip}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${cert.bg} ${size === "xs" ? "text-[10px]" : "text-xs"}`}>
      {cert.icon} {cert.label}
    </span>
  );
}

// ─── ProductDetailDrawer ──────────────────────────────────────────────────────

function ProductDetailDrawer({ item, onClose, onAdd, currency, subInterval, onSubChange }: {
  item: PublicItem;
  onClose: () => void;
  onAdd: (id: string) => void;
  currency: string;
  subInterval: SubInterval;
  onSubChange: (v: SubInterval) => void;
}) {
  const certs       = getCertList(item);
  const skinTypes   = getSkinTypes(item);
  const freeFrom    = getFreeFrom(item);
  const price       = item.discountPrice ?? item.price;
  const subPrice    = applySubDiscount(price, subInterval);
  const ingredients = getAttr(item, "ingredients") as string | undefined;
  const howToUse    = getAttr(item, "howToUse")    as string | undefined;
  const size        = getAttr(item, "size")         as string | undefined;
  const skincareLine= getAttr(item, "skincareLine") as string | undefined;
  const skinConcerns = (getAttr(item, "skinConcerns") as string[] | undefined) ?? [];
  const [qty, setQty] = useState(1);

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

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Image */}
          <div className="w-full aspect-square rounded-2xl bg-rose-50 flex items-center justify-center overflow-hidden border border-rose-100">
            {item.imageUrl
              ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
              : <span className="text-8xl">{item.imageEmoji || "🌸"}</span>}
          </div>

          {/* Name + meta */}
          <div>
            <div className="flex flex-wrap gap-1 mb-2">
              {skincareLine && (
                <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 rounded-full px-2 py-0.5">{skincareLine}</span>
              )}
              {size && (
                <span className="text-[10px] font-semibold bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">{size}</span>
              )}
              {skinTypes.slice(0, 2).map(t => {
                const st = SKIN_TYPES.find(x => x.key === t);
                return st ? (
                  <span key={t} className="text-[10px] font-semibold bg-pink-50 text-pink-700 rounded-full px-2 py-0.5">{st.icon} {st.label}</span>
                ) : null;
              })}
            </div>
            <h2 className="text-xl font-bold text-stone-900">{item.title}</h2>
            {item.shortDescription && <p className="text-sm text-stone-500 mt-1">{item.shortDescription}</p>}
          </div>

          {/* Certifications */}
          {certs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">Certifieringar</p>
              <div className="flex flex-wrap gap-1.5">
                {certs.map(c => <CertBadge key={c} certKey={c} />)}
              </div>
            </div>
          )}

          {/* Free From */}
          {freeFrom.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">Fri från</p>
              <div className="flex flex-wrap gap-1.5">
                {freeFrom.map(f => (
                  <span key={f} className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200">
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skin concerns */}
          {skinConcerns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">Hudproblem</p>
              <div className="flex flex-wrap gap-1.5">
                {skinConcerns.map(c => (
                  <span key={c} className="text-xs rounded-full px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Subscription selector */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Prenumerera & spara
            </p>
            <div className="space-y-2">
              {SUBSCRIPTION_OPTIONS.map(opt => (
                <label key={opt.key}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer border transition-all ${subInterval === opt.key ? "border-rose-500 bg-white shadow-sm" : "border-transparent hover:border-rose-200"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${subInterval === opt.key ? "border-rose-600 bg-rose-600" : "border-stone-300"}`}>
                      {subInterval === opt.key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <input type="radio" name="sub" value={opt.key} checked={subInterval === opt.key}
                      onChange={() => onSubChange(opt.key)} className="sr-only" />
                    <span className="text-sm font-medium text-stone-800">{opt.label}</span>
                  </div>
                  <div className="text-right">
                    {opt.discount > 0
                      ? <><p className="text-sm font-bold text-rose-700">{fmt(applySubDiscount(price, opt.key), currency)}</p>
                          <p className="text-[10px] text-rose-600">Spara {opt.discount}%</p></>
                      : <p className="text-sm font-semibold text-stone-700">{fmt(price, currency)}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* How to use */}
          {howToUse && (
            <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Användning</p>
              <p className="text-sm text-stone-700">{howToUse}</p>
            </div>
          )}

          {/* Ingredients INCI */}
          {ingredients && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Ingredienser (INCI)
              </p>
              <p className="text-xs text-stone-500 leading-relaxed">{ingredients}</p>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Om produkten</p>
              <p className="text-sm text-stone-600 leading-relaxed">{item.description}</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
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
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Lägg i varukorg · {fmt(subPrice * qty, currency)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BeautyItemCard ───────────────────────────────────────────────────────────

function BeautyItemCard({ item, onAdd, onDetail, subInterval }: {
  item: PublicItem;
  onAdd: (id: string) => void;
  onDetail: (item: PublicItem) => void;
  subInterval: SubInterval;
}) {
  const price    = item.discountPrice ?? item.price;
  const subPrice = applySubDiscount(price, subInterval);
  const certs    = getCertList(item);
  const freeFrom = getFreeFrom(item);
  const size     = getAttr(item, "size") as string | undefined;

  return (
    <div className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md transition-all cursor-pointer"
      onClick={() => onDetail(item)}>
      {/* Image */}
      <div className="aspect-square bg-rose-50 flex items-center justify-center overflow-hidden relative">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <span className="text-5xl">{item.imageEmoji || "🌸"}</span>}
        {item.discountPrice && (
          <span className="absolute top-2 left-2 rounded-full bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5">
            -{Math.round((1 - item.discountPrice / item.price) * 100)}%
          </span>
        )}
        {subInterval !== "once" && (
          <span className="absolute top-2 right-2 rounded-full bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5">
            Prenumeration
          </span>
        )}
      </div>

      <div className="p-4 space-y-2">
        {/* Free-from badges (up to 3) */}
        {freeFrom.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {freeFrom.slice(0, 3).map(f => (
              <span key={f} className="text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">✓ {f}</span>
            ))}
            {freeFrom.length > 3 && <span className="text-[10px] text-stone-400">+{freeFrom.length - 3}</span>}
          </div>
        )}

        <h3 className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">{item.title}</h3>
        {size && <p className="text-xs text-stone-400">{size}</p>}

        {/* Cert badges (max 2) */}
        {certs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {certs.slice(0, 2).map(c => <CertBadge key={c} certKey={c} size="xs" />)}
            {certs.length > 2 && <span className="text-[10px] text-stone-400">+{certs.length - 2}</span>}
          </div>
        )}

        {/* Price */}
        <div className="flex items-end justify-between pt-1">
          <div>
            {subInterval !== "once" && subPrice !== price ? (
              <>
                <p className="text-xs text-stone-400 line-through">{fmt(price, item.currency)}</p>
                <p className="text-base font-bold text-rose-700">{fmt(subPrice, item.currency)}</p>
              </>
            ) : (
              <>
                {item.discountPrice && <p className="text-xs text-stone-400 line-through">{fmt(item.price, item.currency)}</p>}
                <p className="text-base font-bold text-stone-900">{fmt(price, item.currency)}</p>
              </>
            )}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onAdd(item.id); }}
            className="flex items-center gap-1 rounded-xl px-3 py-2 bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BeautyCartPanel ──────────────────────────────────────────────────────────

function BeautyCartPanel({ cart, items, storefront, availability, subInterval, onAdd, onRemove, onClear }: {
  cart: CartMap;
  items: PublicItem[];
  storefront: PublicStorefront;
  availability: PublicAvailability | null;
  subInterval: SubInterval;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [form, setForm]         = useState({ name: "", phone: "", address: "", notes: "" });
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

  const subtotal = cartEntries.reduce((s, { item, qty }) => {
    return s + applySubDiscount(item.discountPrice ?? item.price, subInterval) * qty;
  }, 0);
  const deliveryFee = availability?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;

  const subOpt = SUBSCRIPTION_OPTIONS.find(o => o.key === subInterval);
  const totalSavings = subOpt?.discount
    ? cartEntries.reduce((s, { item, qty }) => {
        const base = item.discountPrice ?? item.price;
        return s + (base - applySubDiscount(base, subInterval)) * qty;
      }, 0)
    : 0;

  const canOrder = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && cartEntries.length > 0;

  const writeSubscription = (orderNum: string) => {
    if (subInterval === "once") return;
    const key  = `storefront_subscriptions_${storefront.slug}`;
    const disc = subOpt?.discount ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    const addMonths = (d: string, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); };
    const nextMap: Record<string, string> = {
      monthly: addMonths(today, 1), bi_monthly: addMonths(today, 2), quarterly: addMonths(today, 3),
    };
    const newSub = {
      id: `sub-${Date.now()}`,
      customerName: form.name,
      customerPhone: form.phone,
      deliveryAddress: form.address,
      items: cartEntries.map(({ item, qty }) => ({
        itemId: item.id, title: item.title, qty,
        unitPrice: applySubDiscount(item.discountPrice ?? item.price, subInterval),
        imageEmoji: item.imageEmoji,
      })),
      interval: subInterval,
      discountPct: disc,
      status: "active",
      createdAt: today,
      lastShippedAt: today,
      nextShipDate: nextMap[subInterval] ?? addMonths(today, 1),
      totalOrders: 1,
      notes: `Beställning ${orderNum}`,
    };
    try {
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
      localStorage.setItem(key, JSON.stringify([...existing, newSub]));
    } catch { /* ignore */ }
  };

  const handleOrder = async () => {
    setLoading(true);
    try {
      const res = await createPublicOrder(storefront.slug, {
        items: cartEntries.map(({ item, qty }) => ({
          itemId: item.id, title: item.title, quantity: qty,
          unitPrice: applySubDiscount(item.discountPrice ?? item.price, subInterval),
        })),
        deliveryMethod: "delivery",
        deliveryAddress: form.address || undefined,
        customerName: form.name,
        customerPhone: form.phone,
        notes: subInterval !== "once" ? `Prenumeration: ${subOpt?.label}. ${form.notes}` : form.notes || undefined,
        subtotal, deliveryFee, discount: totalSavings, tax: 0, total,
        paymentMethod: "cash",
        orderSource: "storefront",
      });
      setOrderNum(res.orderNumber);
      writeSubscription(res.orderNumber);
      setDone(true);
      onClear();
    } catch {
      const fallback = "LB-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      setOrderNum(fallback);
      writeSubscription(fallback);
      setDone(true);
      onClear();
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-rose-500" />
        <p className="mt-3 font-bold text-stone-900">Beställning mottagen!</p>
        <p className="text-sm text-stone-500 mt-1">Ref: <span className="font-semibold font-mono">{orderNum}</span></p>
        {subInterval !== "once" && (
          <p className="text-xs text-rose-600 mt-1">✓ Prenumeration: {subOpt?.label}</p>
        )}
        <p className="text-xs text-stone-400 mt-1">{storefront.name} kontaktar dig snart.</p>
        <button onClick={() => setDone(false)} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-rose-600">Beställ igen</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <p className="font-bold text-stone-900">Din varukorg</p>

      {cartEntries.length === 0 ? (
        <div className="rounded-xl bg-rose-50 px-4 py-6 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-rose-200" />
          <p className="mt-2 text-sm text-stone-500">Lägg till produkter för att beställa</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cartEntries.map(({ item, qty }) => {
            const linePrice = applySubDiscount(item.discountPrice ?? item.price, subInterval);
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-xl">{item.imageEmoji || "🌸"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{item.title}</p>
                  <p className="text-xs text-stone-400">{fmt(linePrice, item.currency)} × {qty}</p>
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
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Ditt namn *" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="Telefon *" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
        <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="Leveransadress" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>

      {cartEntries.length > 0 && (
        <div className="border-t border-stone-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-stone-500"><span>Delsumma</span><span>{fmt(subtotal)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between text-stone-500"><span>Frakt</span><span>{fmt(deliveryFee)}</span></div>}
          {totalSavings > 0 && (
            <div className="flex justify-between text-rose-600 font-medium">
              <span>Prenumerationsrabatt</span><span>−{fmt(totalSavings)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-stone-900"><span>Totalt</span><span>{fmt(total)}</span></div>
          {isPriceInclusive("SEK") && (
            <p className="text-[10px] text-stone-400 text-right">{getVatLabel("SEK")}</p>
          )}
        </div>
      )}

      {subInterval !== "once" && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
          <RefreshCw className="h-3.5 w-3.5 text-rose-600 shrink-0" />
          <p className="text-xs text-rose-700 font-medium">{subOpt?.label} · {subOpt?.discount}% rabatt aktiverad</p>
        </div>
      )}

      <button onClick={handleOrder} disabled={!canOrder || loading}
        className="w-full rounded-xl py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 transition-colors">
        {loading ? "Skickar…" : `Beställ · ${fmt(total)}`}
      </button>

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

      {storefront.contactPhone && cartEntries.length > 0 && form.name.trim() && (
        <a href={`https://wa.me/${storefront.contactPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hej ${storefront.name}! 🌸 Jag vill beställa:\n\n${cartEntries.map(({ item, qty }) =>
            `• ${qty}× ${item.title} — ${fmt(applySubDiscount(item.discountPrice ?? item.price, subInterval) * qty, item.currency)}`
          ).join("\n")}\n\nTotalt: ${fmt(total)}\n${subInterval !== "once" ? `Prenumeration: ${subOpt?.label}\n` : ""}Namn: ${form.name}\nTelefon: ${form.phone}`
        )}`}
          target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors">
          <MessageCircle className="h-4 w-4" />
          Skicka beställning via WhatsApp
        </a>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NaturalBeautyStorefrontClient({ storefront, items, offers, availability, refCode, joinIntent }: Props) {
  const cacheKey = `storefront_cache_${storefront.slug}`;

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
    const onStorage  = () => applyCache();
    const onVisible  = () => { if (!document.hidden) applyCache(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", onVisible); };
  }, [applyCache]);

  const [cart,     setCart]     = useState<CartMap>({});
  const [showCart, setShowCart] = useState(false);

  const addToCart     = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(c => {
    const next = { ...c };
    if ((next[id] ?? 0) > 1) next[id]--; else delete next[id];
    return next;
  });
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const [subInterval,    setSubInterval]    = useState<SubInterval>("once");
  const [activeSkinType, setActiveSkinType] = useState<SkinTypeKey>("all");
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [detailItem,     setDetailItem]     = useState<PublicItem | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const visibleItems = liveItems.filter(item => {
    if (searchQuery) {
      const hay = `${item.title} ${item.shortDescription ?? ""} ${item.category ?? ""}`.toLowerCase();
      if (!hay.includes(searchQuery.toLowerCase())) return false;
    }
    if (activeCategory && item.category !== activeCategory) return false;
    if (activeSkinType !== "all") {
      const st = getSkinTypes(item);
      if (!st.includes(activeSkinType)) return false;
    }
    return true;
  });

  const categories   = Array.from(new Set(liveItems.map(i => i.category).filter(Boolean))) as string[];
  const storeCurrency = liveItems[0]?.currency ?? "SEK";

  const ANNOUNCEMENT_BG: Record<string, string> = {
    promo: "bg-rose-600 text-white", info: "bg-blue-600 text-white",
    warning: "bg-amber-500 text-white", success: "bg-green-600 text-white",
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {announcement.visible && announcement.text && (
        <div className={`${ANNOUNCEMENT_BG[announcement.type] ?? ANNOUNCEMENT_BG.promo} text-center py-2 px-4 text-sm font-medium`}>
          {announcement.text}
        </div>
      )}

      {/* Top nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {logoUrl
              ? <img src={logoUrl} alt={name} className="h-9 w-9 rounded-full object-cover" />
              : <div className="h-9 w-9 rounded-full bg-rose-600 flex items-center justify-center text-white font-bold text-sm">{name[0]}</div>}
            <div>
              <p className="text-sm font-bold text-stone-900">{name}</p>
              <p className="text-xs text-rose-600">{storefront.city}</p>
            </div>
          </div>
          <button onClick={() => setShowCart(v => !v)}
            className="relative flex items-center gap-2 rounded-xl bg-rose-600 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-700 transition-colors">
            <ShoppingCart className="h-4 w-4" />
            Varukorg
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-stone-900 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden bg-rose-600 text-white">
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <p className="text-rose-300 text-sm font-semibold uppercase tracking-widest mb-3">
            🌸 Naturlig Skönhet & Hudvård
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight max-w-2xl leading-tight">
            {tagline || name}
          </h1>
          <p className="mt-4 text-rose-100 text-lg max-w-xl">{storefront.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-2 rounded-full bg-white text-rose-700 px-6 py-3 text-sm font-bold hover:bg-rose-50 transition-colors">
              Utforska produkter <ArrowRight className="h-4 w-4" />
            </button>
            {liveOffers.length > 0 && (
              <button onClick={() => document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-2 rounded-full border border-rose-300 text-white px-6 py-3 text-sm font-semibold hover:bg-rose-500 transition-colors">
                Se erbjudanden
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap justify-center gap-6">
          {TRUST_POINTS.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-stone-600">
              <span className="text-rose-500">{t.icon}</span>
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* Membership join (scan-QR → become a member) — after hero, before products */}
      {(storefront.memberships?.length ?? 0) > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10">
          <MembershipJoinSection slug={storefront.slug} memberships={storefront.memberships ?? []} joinIntent={joinIntent} />
        </div>
      )}

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left: products */}
          <div className="flex-1 min-w-0">

            {/* Subscription mode global picker */}
            <div className="mb-6 rounded-2xl border border-rose-200 bg-white p-4">
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-rose-600" /> Välj leveransfrekvens — gäller hela varukorgen
              </p>
              <div className="flex flex-wrap gap-2">
                {SUBSCRIPTION_OPTIONS.map(opt => (
                  <button key={opt.key}
                    onClick={() => setSubInterval(opt.key)}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold border transition-all ${subInterval === opt.key ? "border-rose-600 bg-rose-600 text-white shadow-sm" : "border-stone-200 bg-white text-stone-600 hover:border-rose-300"}`}>
                    {opt.label}
                    {opt.discount > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${subInterval === opt.key ? "bg-white/20 text-white" : "bg-rose-50 text-rose-600"}`}>
                        -{opt.discount}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sök produkter…"
                className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-stone-400" />
                </button>
              )}
            </div>

            {/* Skin type filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
              {SKIN_TYPES.map(st => (
                <button key={st.key}
                  onClick={() => setActiveSkinType(st.key)}
                  className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${activeSkinType === st.key ? "bg-rose-600 text-white border-rose-600" : "bg-white text-stone-600 border-stone-200 hover:border-rose-300"}`}>
                  {st.icon} {st.label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
                <button onClick={() => setActiveCategory("")}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold border transition-all ${activeCategory === "" ? "bg-stone-800 text-white border-stone-800" : "bg-white text-stone-600 border-stone-200"}`}>
                  Allt
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold border transition-all ${activeCategory === cat ? "bg-stone-800 text-white border-stone-800" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Product grid */}
            <section id="products">
              {visibleItems.length === 0 ? (
                <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
                  <p className="text-stone-400 text-sm">Inga produkter matchar din sökning</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {visibleItems.map(item => (
                    <BeautyItemCard key={item.id} item={item}
                      onAdd={addToCart} onDetail={setDetailItem} subInterval={subInterval} />
                  ))}
                </div>
              )}
            </section>

            {/* Offers */}
            {liveOffers.length > 0 && (
              <section id="offers" className="mt-12">
                <h2 className="text-lg font-bold text-stone-900 mb-4">Erbjudanden</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {liveOffers.map(offer => (
                    <div key={offer.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                      <span className="text-xs font-bold text-rose-700 bg-rose-100 rounded-full px-2 py-0.5 uppercase tracking-wide">{offer.discountType}</span>
                      <h3 className="mt-2 font-bold text-stone-900">{offer.title}</h3>
                      <p className="text-sm text-stone-600 mt-1">{offer.description}</p>
                      {offer.code && (
                        <p className="mt-2 font-mono text-sm font-bold text-rose-700 bg-white rounded-lg px-3 py-1 inline-block border border-rose-200">
                          {offer.code}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cert transparency section */}
            <section className="mt-16">
              <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
                <h2 className="text-lg font-bold text-stone-900 mb-2">Vår certifieringstransparens</h2>
                <p className="text-sm text-stone-500 mb-6">Vi arbetar enbart med produkter som uppfyller strikta krav på naturliga ingredienser, etisk tillverkning och miljöpåverkan.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {BEAUTY_CERTS.map(cert => (
                    <div key={cert.key} className={`rounded-xl px-3 py-3 text-center ${cert.bg}`}>
                      <p className="text-2xl mb-1">{cert.icon}</p>
                      <p className="text-xs font-semibold">{cert.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{cert.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right: cart (desktop) */}
          <div className="lg:w-80 xl:w-96 shrink-0">
            <div className="sticky top-20">
              <BeautyCartPanel
                cart={cart} items={liveItems} storefront={storefront}
                availability={availability} subInterval={subInterval}
                onAdd={addToCart} onRemove={removeFromCart}
                onClear={() => setCart({})}
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
            <h2 className="text-lg font-bold text-slate-900">Complete Your Routine</h2>
            <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium">
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
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-500 transition-colors" />
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
            className="flex items-center gap-3 rounded-full bg-rose-600 text-white px-6 py-3 shadow-2xl text-sm font-bold hover:bg-rose-700">
            <ShoppingCart className="h-5 w-5" />
            {cartCount} varor · {fmt(
              Object.entries(cart).reduce((s, [id, qty]) => {
                const item = liveItems.find(i => i.id === id);
                if (!item) return s;
                return s + applySubDiscount(item.discountPrice ?? item.price, subInterval) * qty;
              }, 0),
              storeCurrency
            )}
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
              <p className="font-bold text-stone-900">Din varukorg</p>
              <button onClick={() => setShowMobileCart(false)} className="p-2 hover:bg-stone-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <BeautyCartPanel
              cart={cart} items={liveItems} storefront={storefront}
              availability={availability} subInterval={subInterval}
              onAdd={addToCart} onRemove={removeFromCart}
              onClear={() => { setCart({}); setShowMobileCart(false); }}
            />
          </div>
        </div>
      )}

      {/* Product detail drawer */}
      {detailItem && (
        <ProductDetailDrawer
          item={detailItem} onClose={() => setDetailItem(null)}
          onAdd={addToCart} currency={storeCurrency}
          subInterval={subInterval} onSubChange={setSubInterval}
        />
      )}
    </div>
  );
}
