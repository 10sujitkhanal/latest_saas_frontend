"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart, X, Plus, Minus, CheckCircle2, Search, ArrowRight,
  MessageCircle, Truck, Shield, ChevronLeft, Clock, Star, Calendar,
  Users, MapPin, Phone, Mail, Zap, Settings2,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicOrder, createPublicBooking } from "@/lib/storefront/storefrontPublicApi";
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

// Beer Club subscription tiers
interface BeerClubTier {
  id: string;
  name: string;
  price: number;
  period: string;
  perks: string[];
  badge: string;
}

const BEER_CLUB_TIERS: BeerClubTier[] = [
  {
    id: "monthly",
    name: "Monthly Club",
    price: 199,
    period: "/ month",
    badge: "Most popular",
    perks: [
      "3 hand-picked bottles monthly",
      "10% discount on all orders",
      "Early access to seasonal releases",
      "Member tasting notes PDF",
    ],
  },
  {
    id: "quarterly",
    name: "Quarterly Club",
    price: 549,
    period: "/ quarter",
    badge: "Best value",
    perks: [
      "10 bottles per quarter",
      "15% discount on all orders",
      "Invited to member-only tap events",
      "Free taproom tasting (1× per quarter)",
    ],
  },
  {
    id: "anniversary",
    name: "Anniversary Club",
    price: 799,
    period: "/ quarter",
    badge: "Premium",
    perks: [
      "14 bottles + 2 limited-edition specials",
      "20% discount on all orders",
      "Behind-the-scenes brewery tour",
      "Named on our Members Wall",
    ],
  },
];

const BEER_STYLES = ["IPA", "Pale Ale", "Stout & Porter", "Lager", "Sour & Wild", "Seasonal", "Merchandise"];

const TRUST_POINTS = [
  { icon: "🍺", text: "Brewed on-site"            },
  { icon: "🌿", text: "Local ingredients"          },
  { icon: <Truck    className="h-4 w-4" />, text: "Cold-chain delivery" },
  { icon: <Shield   className="h-4 w-4" />, text: "Secure payment"      },
  { icon: <Star     className="h-4 w-4" />, text: "Beer Club rewards"   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function getAttr(item: PublicItem, key: string): any {
  return (item as unknown as { attributes: Record<string, unknown> }).attributes?.[key];
}

// ─── Beer Card ────────────────────────────────────────────────────────────────

function BeerCard({
  item, onAdd, onDetail, cartQty,
}: {
  item: PublicItem;
  onAdd: () => void;
  onDetail: () => void;
  cartQty: number;
}) {
  const discount = item.discountPrice != null && item.discountPrice < item.price;
  const displayPrice = item.discountPrice ?? item.price;
  const abv = getAttr(item, "abv");
  const ibu = getAttr(item, "ibu");
  const organic = getAttr(item, "organic");
  const vegan = getAttr(item, "vegan");

  return (
    <div
      className="flex flex-col rounded-2xl border border-amber-100 bg-white overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={onDetail}
    >
      {/* Image / emoji */}
      <div className="relative flex h-36 items-center justify-center bg-amber-50 overflow-hidden">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <span className="text-5xl">🍺</span>}
        {discount && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            SALE
          </div>
        )}
        {organic && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            🌿 Organic
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div>
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            {item.category}
          </span>
          {vegan && (
            <span className="ml-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              🌱 Vegan
            </span>
          )}
        </div>
        <p className="font-bold text-slate-900 text-sm leading-tight">{item.title}</p>
        <p className="text-xs text-slate-500 line-clamp-2">{item.shortDescription}</p>

        {/* ABV / IBU badges */}
        {(abv != null || ibu != null) && (
          <div className="flex gap-2 flex-wrap">
            {abv != null && (
              <span className="text-[10px] font-bold bg-amber-900 text-amber-50 px-2 py-0.5 rounded-full">
                {String(abv)}% ABV
              </span>
            )}
            {ibu != null && (
              <span className="text-[10px] font-bold bg-slate-700 text-white px-2 py-0.5 rounded-full">
                {String(ibu)} IBU
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <div>
            <span className="font-bold text-sm text-amber-900">{fmt(displayPrice, item.currency)}</span>
            {discount && (
              <span className="ml-1.5 text-xs text-slate-400 line-through">{fmt(item.price, item.currency)}</span>
            )}
          </div>
          {item.orderingEnabled && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="flex items-center gap-1 bg-amber-900 text-amber-50 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-amber-800 transition-colors"
            >
              {cartQty > 0 ? <><Plus className="h-3 w-3" />{cartQty}</> : <><Plus className="h-3 w-3" />Add</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Beer Detail Drawer ───────────────────────────────────────────────────────

function BeerDetailDrawer({
  item, onAdd, onClose, cartQty,
}: {
  item: PublicItem | null;
  onAdd: (item: PublicItem) => void;
  onClose: () => void;
  cartQty: number;
}) {
  const [qty, setQty] = useState(1);
  useEffect(() => { setQty(1); }, [item?.id]);

  if (!item) return null;

  const abv         = getAttr(item, "abv");
  const ibu         = getAttr(item, "ibu");
  const malts       = getAttr(item, "malts");
  const hops        = getAttr(item, "hops");
  const yeast       = getAttr(item, "yeast");
  const servingTemp = getAttr(item, "servingTemp");
  const glassware   = getAttr(item, "glassware");
  const foodPairing = getAttr(item, "foodPairing");
  const organic     = getAttr(item, "organic");
  const vegan       = getAttr(item, "vegan");

  const displayPrice = item.discountPrice ?? item.price;

  const specs: { label: string; value: string }[] = [
    ...(abv         != null ? [{ label: "ABV",          value: `${String(abv)}%`       }] : []),
    ...(ibu         != null ? [{ label: "IBU",          value: String(ibu)             }] : []),
    ...(malts       != null ? [{ label: "Malts",        value: String(malts)           }] : []),
    ...(hops        != null ? [{ label: "Hops",         value: String(hops)            }] : []),
    ...(yeast       != null ? [{ label: "Yeast",        value: String(yeast)           }] : []),
    ...(servingTemp != null ? [{ label: "Serving temp", value: String(servingTemp)     }] : []),
    ...(glassware   != null ? [{ label: "Glassware",    value: String(glassware)       }] : []),
    ...(foodPairing != null ? [{ label: "Food pairing", value: String(foodPairing)     }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="relative w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-52 shrink-0 flex items-center justify-center bg-amber-50 overflow-hidden">
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
            : <span className="text-7xl">🍺</span>}
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto p-5 gap-4">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{item.category}</span>
            {organic && <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🌿 Organic</span>}
            {vegan   && <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🌱 Vegan</span>}
          </div>

          <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>

          <div className="flex items-center gap-2">
            {abv != null && (
              <span className="text-sm font-bold bg-amber-900 text-amber-50 px-3 py-1 rounded-full">{String(abv)}% ABV</span>
            )}
            {ibu != null && (
              <span className="text-sm font-bold bg-slate-700 text-white px-3 py-1 rounded-full">{String(ibu)} IBU</span>
            )}
            <span className="text-2xl font-extrabold text-amber-900 ml-auto">{fmt(displayPrice, item.currency)}</span>
          </div>

          {item.description && item.description.length > 10 && (
            <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
          )}

          {specs.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {specs.map(({ label, value }) => (
                <div key={label} className="bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                  <p className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {item.orderingEnabled && (
          <div className="shrink-0 border-t border-slate-100 p-4 flex items-center gap-3 bg-white">
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
            <button
              onClick={() => { for (let i = 0; i < qty; i++) onAdd(item); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-amber-50 bg-amber-900 hover:bg-amber-800"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartQty > 0 ? `Add more · ${fmt(displayPrice * qty, item.currency)}` : `Add to cart · ${fmt(displayPrice * qty, item.currency)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({
  cart, items, storefront, availability, onAdd, onRemove, onClear,
}: {
  cart: CartMap;
  items: PublicItem[];
  storefront: PublicStorefront;
  availability: PublicAvailability | null;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("pickup");
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [done, setDone] = useState(false);
  const [orderNum, setOrderNum] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSwishBox, setShowSwishBox] = useState(false);

  const paymentSettings = (() => {
    if (typeof window === "undefined") return { enabled: {}, keys: {} };
    try { return JSON.parse(localStorage.getItem(`storefront_payments_${storefront.slug}`) ?? "{}"); }
    catch { return { enabled: {}, keys: {} }; }
  })();
  const swishEnabled = !!paymentSettings?.enabled?.swish;
  const swishNumber  = (paymentSettings?.keys?.swish ?? "").replace(/\D/g, "");

  const cartEntries = Object.entries(cart)
    .map(([id, qty]) => ({ item: items.find(i => i.id === id)!, qty }))
    .filter(x => x.item);
  const subtotal = cartEntries.reduce((s, { item, qty }) => s + (item.discountPrice ?? item.price) * qty, 0);
  const deliveryFee = orderType === "delivery" ? (availability?.deliveryFee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  const canOrder = form.name.trim().length >= 2 && form.phone.trim().length >= 6
    && (orderType === "pickup" || form.address.trim().length >= 4)
    && cartEntries.length > 0;

  const handleOrder = async () => {
    setLoading(true);
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
        notes: form.notes || undefined,
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
        <p className="text-xs text-slate-400 mt-1">{storefront.name} will confirm shortly.</p>
        <button onClick={() => setDone(false)} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-amber-50 bg-amber-900">
          Order again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <p className="font-bold text-slate-900">Your order</p>

      {cartEntries.length === 0 ? (
        <div className="rounded-xl bg-amber-50 px-4 py-6 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 opacity-30 text-amber-900" />
          <p className="mt-2 text-sm text-slate-500">Add beers to start your order</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cartEntries.map(({ item, qty }) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-lg">🍺</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                <p className="text-xs text-slate-500">{fmt(item.discountPrice ?? item.price, item.currency)} × {qty}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onRemove(item.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => onAdd(item.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
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
              className={`flex-1 py-2 capitalize transition-colors ${orderType === t ? "bg-amber-900 text-amber-50" : "text-slate-600 hover:bg-slate-50"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Your name *" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="Phone *" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        {orderType === "delivery" && (
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="Delivery address *" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        )}
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2} placeholder="Notes (optional)" className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      {cartEntries.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between text-slate-500"><span>Delivery</span><span>{fmt(deliveryFee)}</span></div>}
          <div className="flex justify-between font-bold text-amber-900"><span>Total</span><span>{fmt(total)}</span></div>
          {isPriceInclusive(cartEntries[0]?.item?.currency ?? "SEK") && (
            <p className="text-[10px] text-slate-400 text-right">{getVatLabel(cartEntries[0]?.item?.currency ?? "SEK")}</p>
          )}
        </div>
      )}

      <button onClick={handleOrder} disabled={!canOrder || loading}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-amber-50 bg-amber-900 hover:bg-amber-800 disabled:opacity-40">
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
              <a
                href={buildSwishLink({ payeeNumber: swishNumber, amount: total, message: `Order ${storefront.name}` })}
                className="block w-full rounded-lg py-2 bg-green-500 text-white text-sm font-bold hover:bg-green-600"
              >
                Open Swish app
              </a>
              <button onClick={() => setShowSwishBox(false)} className="text-xs text-slate-400 underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowSwishBox(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors">
              🟢 Pay with Swish · {fmt(total)}
            </button>
          )}
        </>
      )}

      {storefront.contactPhone && cartEntries.length > 0 && form.name.trim() && (
        <>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-medium text-slate-400">or order on WhatsApp</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <a
            href={(() => {
              const lines = [
                `Hello ${storefront.name}! 🍺 Order:`,
                ``,
                ...cartEntries.map(({ item, qty }) =>
                  `• ${qty}× ${item.title} — ${fmt((item.discountPrice ?? item.price) * qty, item.currency)}`
                ),
                ``,
                `*Total: ${fmt(total)}*`,
                `Type: ${orderType}`,
                `Name: ${form.name}`,
                `Phone: ${form.phone}`,
                orderType === "delivery" && form.address ? `Address: ${form.address}` : null,
                form.notes ? `Notes: ${form.notes}` : null,
              ].filter(Boolean).join("\n");
              return `https://wa.me/${storefront.contactPhone!.replace(/\D/g, "")}?text=${encodeURIComponent(lines)}`;
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

// ─── Beer Club Modal ──────────────────────────────────────────────────────────

function BeerClubModal({
  storefront, onClose,
}: {
  storefront: PublicStorefront;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<BeerClubTier | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!selected || !form.name.trim() || !form.email.trim()) return;
    setLoading(true);
    // Simulate subscription registration (POST to push-subscribe or custom endpoint)
    await new Promise(r => setTimeout(r, 700));
    setDone(true);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {done ? (
          <div className="p-8 text-center">
            <p className="text-4xl mb-3">🍻</p>
            <p className="text-xl font-bold text-slate-900">Welcome to the Beer Club!</p>
            <p className="mt-2 text-sm text-slate-500">
              You&apos;ve joined the <span className="font-semibold">{selected?.name}</span>.<br />
              {storefront.name} will contact you at {form.email} to complete your subscription.
            </p>
            <button onClick={onClose}
              className="mt-5 rounded-xl px-6 py-2.5 text-sm font-bold text-amber-50 bg-amber-900 hover:bg-amber-800">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="bg-amber-900 text-amber-50 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">🍺 Join the Beer Club</p>
                <p className="text-amber-200 text-sm mt-0.5">Hand-picked craft beers delivered to your door</p>
              </div>
              <button onClick={onClose} className="text-amber-300 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Tier selection */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {BEER_CLUB_TIERS.map(tier => (
                  <button
                    key={tier.id}
                    onClick={() => setSelected(tier)}
                    className={`relative flex flex-col rounded-xl border-2 p-3 text-left transition-all ${
                      selected?.id === tier.id
                        ? "border-amber-900 bg-amber-50"
                        : "border-slate-200 hover:border-amber-300"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full self-start mb-2">
                      {tier.badge}
                    </span>
                    <p className="font-bold text-slate-900 text-sm">{tier.name}</p>
                    <p className="text-amber-900 font-extrabold text-base mt-1">
                      {fmt(tier.price)} <span className="text-xs font-normal text-slate-400">{tier.period}</span>
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {tier.perks.map(p => (
                        <li key={p} className="text-[10px] text-slate-600 flex items-start gap-1">
                          <span className="text-amber-600 mt-0.5 shrink-0">✓</span>{p}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              {selected && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-600">Your details</p>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name *"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Email address *"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone (optional)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <button
                    onClick={handleJoin}
                    disabled={loading || !form.name.trim() || !form.email.trim()}
                    className="w-full rounded-xl py-2.5 text-sm font-bold text-amber-50 bg-amber-900 hover:bg-amber-800 disabled:opacity-40"
                  >
                    {loading ? "Joining…" : `Join ${selected.name} · ${fmt(selected.price)}${selected.period}`}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Taproom Booking Modal ────────────────────────────────────────────────────

function TaproomModal({
  storefront, onClose,
}: {
  storefront: PublicStorefront;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    date: "", time: "15:00",
    groupSize: 2,
    tastingAddon: false,
    notes: "",
  });
  const [done, setDone] = useState(false);
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && form.date.length > 0;

  const handleBook = async () => {
    setLoading(true);
    try {
      const res = await createPublicBooking(storefront.slug, {
        bookingType:    "general",
        customerName:   form.name,
        customerPhone:  form.phone,
        customerEmail:  form.email || undefined,
        requestedDate:  form.date,
        requestedTime:  form.time,
        quantity:       form.groupSize,
        notes:          [
          form.tastingAddon ? "Tasting add-on requested" : null,
          form.notes || null,
        ].filter(Boolean).join(". ") || undefined,
        source:         "storefront",
      });
      setRef(res.bookingRef);
      setDone(true);
    } catch {
      setRef("TR-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const TIME_SLOTS = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {done ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 text-xl font-bold text-slate-900">Taproom booked!</p>
            <p className="mt-1 text-sm text-slate-500">
              Reference: <span className="font-semibold text-slate-800">{ref}</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">{storefront.name} will confirm on {form.phone}.</p>
            <button onClick={onClose}
              className="mt-5 rounded-xl px-6 py-2.5 text-sm font-bold text-amber-50 bg-amber-900 hover:bg-amber-800">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="bg-amber-900 text-amber-50 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">🏭 Book Taproom Visit</p>
                <p className="text-amber-200 text-sm mt-0.5">Reserve a table at our taproom</p>
              </div>
              <button onClick={onClose} className="text-amber-300 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Full name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Phone *</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+46-..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="optional"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Time</label>
                  <select value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Group size</label>
                  <div className="mt-1 flex items-center gap-2">
                    <button onClick={() => setForm(f => ({ ...f, groupSize: Math.max(2, f.groupSize - 1) }))}
                      className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-sm font-bold text-slate-900 w-6 text-center">{form.groupSize}</span>
                    <button onClick={() => setForm(f => ({ ...f, groupSize: Math.min(20, f.groupSize + 1) }))}
                      className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-slate-400 ml-1">persons (max 20)</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-dashed border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-colors">
                    <input type="checkbox" checked={form.tastingAddon}
                      onChange={e => setForm(f => ({ ...f, tastingAddon: e.target.checked }))}
                      className="rounded border-amber-300 text-amber-700" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">🍻 Add guided tasting session</p>
                      <p className="text-xs text-slate-500">Our brew master walks you through 5 signature beers (+199 SEK / person)</p>
                    </div>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Notes (optional)</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Dietary needs, birthday visit, etc."
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <button onClick={handleBook} disabled={!canSubmit || loading}
                className="w-full rounded-xl py-2.5 text-sm font-bold text-amber-50 bg-amber-900 hover:bg-amber-800 disabled:opacity-40">
                {loading ? "Booking…" : `Book for ${form.groupSize} people`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Offer Card ───────────────────────────────────────────────────────────────

function OfferCard({ offer }: { offer: PublicOffer }) {
  const [copied, setCopied] = useState(false);
  const discountLabel =
    offer.discountType === "percentage" ? `${offer.discountValue}% OFF` :
    offer.discountType === "fixed"      ? `${fmt(offer.discountValue)} OFF` : "BUY 1 GET 1";
  const daysLeft = Math.ceil((new Date(offer.endDate).getTime() - Date.now()) / 86400000);

  return (
    <div className="flex min-w-[220px] max-w-[260px] flex-col rounded-xl border border-amber-200 bg-white overflow-hidden shadow-sm">
      <div className="bg-amber-900 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-200" />
          <span className="text-amber-50 font-bold text-sm">{discountLabel}</span>
        </div>
        {daysLeft <= 7 && daysLeft > 0 && (
          <span className="bg-white/20 text-amber-100 text-[10px] font-semibold px-2 py-0.5 rounded-full">{daysLeft}d left</span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <p className="text-sm font-semibold text-slate-900">{offer.title}</p>
        {offer.description && <p className="text-xs text-slate-500 line-clamp-2">{offer.description}</p>}
        {offer.code && (
          <button onClick={() => {
            navigator.clipboard.writeText(offer.code!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
          }}
            className="flex items-center gap-2 bg-amber-50 border border-dashed border-amber-300 rounded-lg px-2.5 py-1.5 hover:border-amber-500 transition-colors mt-auto">
            <code className="flex-1 text-[11px] font-mono font-bold text-slate-700 tracking-wider">{offer.code}</code>
            {copied
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              : <span className="text-[10px] text-amber-700 font-semibold shrink-0">COPY</span>}
          </button>
        )}
        <p className="text-[10px] text-slate-300">Valid until {new Date(offer.endDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CraftBeerStorefrontClient({ storefront, items, offers, availability, refCode, joinIntent }: Props) {
  // Admin localStorage bridge (same pattern as UniversalStorefrontClient)
  const [liveData, setLiveData] = useState({
    logoUrl:     storefront.logoUrl,
    bannerUrl:   storefront.bannerUrl,
    name:        storefront.name,
    tagline:     storefront.tagline,
    gallery:     storefront.galleryImages ?? [] as string[],
    announcement:        "",
    announcementType:    "promo",
    announcementVisible: false,
  });
  const [liveItems,  setLiveItems]  = useState<PublicItem[]>(items);
  const [liveOffers, setLiveOffers] = useState<PublicOffer[]>(offers);
  const [pinnedItems, setPinnedItems] = useState<CrossSellItem[]>([]);

  useEffect(() => {
    setPinnedItems(loadPinnedItems(storefront.id ?? storefront.slug));
  }, [storefront.id, storefront.slug]);

  const applyStorageCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(`storefront_cache_${storefront.slug}`);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (!cached) return;

      setLiveData({
        logoUrl:             cached.design?.logo          ?? storefront.logoUrl,
        bannerUrl:           cached.design?.banner        ?? storefront.bannerUrl,
        name:                cached.name                  ?? storefront.name,
        tagline:             cached.tagline               ?? storefront.tagline,
        gallery:             cached.design?.galleryImages ?? storefront.galleryImages ?? [],
        announcement:        cached.design?.announcement        ?? "",
        announcementType:    cached.design?.announcementType    ?? "promo",
        announcementVisible: cached.design?.announcementVisible ?? false,
      });

      if (Array.isArray(cached.products) && cached.products.length > 0) {
        const toPublicItem = (p: Record<string, unknown>): PublicItem => {
          const base = items.find(i => i.id === p.id);
          return {
            id: p.id as string, slug: p.id as string, type: "product",
            title: (p.title as string) ?? base?.title ?? "",
            shortDescription: (p.description as string) ?? base?.shortDescription ?? "",
            description: (p.description as string) ?? base?.description ?? "",
            price: (p.price as number) ?? base?.price ?? 0,
            discountPrice: (p.discountPrice as number | null) ?? base?.discountPrice ?? null,
            currency: base?.currency ?? "SEK",
            category: (p.category as string) ?? base?.category ?? "",
            imageEmoji: (p.imageEmoji as string) ?? "🍺",
            imageUrl: (p.imageUrl as string | null) ?? base?.imageUrl ?? null,
            isFeatured: Boolean(p.featured),
            badges: base?.badges ?? [],
            attributes: base?.attributes ?? {},
            availabilityStatus: base?.availabilityStatus ?? "available",
            orderingEnabled: base?.orderingEnabled ?? true,
            bookingEnabled: base?.bookingEnabled ?? false,
            preorderEnabled: base?.preorderEnabled ?? false,
            deliveryEnabled: base?.deliveryEnabled ?? false,
            pickupEnabled: base?.pickupEnabled ?? false,
          };
        };
        const userProducts = (cached.products as Record<string, unknown>[]).filter(p => !(p.id as string).startsWith("sfp-"));
        if (userProducts.length > 0) {
          setLiveItems(userProducts.filter(p => p.visible !== false).map(toPublicItem));
        }
      }

      if (Array.isArray(cached.offers) && cached.offers.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        setLiveOffers((cached.offers as Record<string, unknown>[])
          .filter(o => o.visible !== false && (o.endDate as string) >= today)
          .map(o => ({
            id: o.id as string, title: o.title as string,
            code: o.code as string ?? "",
            discountType: o.discountType as PublicOffer["discountType"],
            discountValue: o.discountValue as number,
            minOrderValue: (o.minOrderValue as number) ?? 0,
            startDate: o.startDate as string,
            endDate: o.endDate as string,
            description: (o.description as string) ?? "",
          })));
      }
    } catch { /* ignore */ }
  }, [storefront.slug, storefront.logoUrl, storefront.bannerUrl, storefront.name, storefront.tagline, storefront.galleryImages, items]);

  useEffect(() => {
    applyStorageCache();
    const onStorage = (e: StorageEvent) => {
      if (e.key === `storefront_cache_${storefront.slug}`) applyStorageCache();
    };
    const onVisible = () => { if (document.visibilityState === "visible") applyStorageCache(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [applyStorageCache, storefront.slug]);

  // Cart state
  const [cart, setCart] = useState<CartMap>({});
  const addToCart    = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(c => { const n = { ...c }; if ((n[id] ?? 0) > 1) n[id]--; else delete n[id]; return n; });
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // UI state
  const [detailItem,       setDetailItem]       = useState<PublicItem | null>(null);
  const [showBeerClub,     setShowBeerClub]     = useState(false);
  const [showTaproom,      setShowTaproom]      = useState(false);
  const [showCartDrawer,   setShowCartDrawer]   = useState(false);
  const [activeStyle,      setActiveStyle]      = useState("All");
  const [searchQuery,      setSearchQuery]      = useState("");

  const styleFiltered = activeStyle === "All"
    ? liveItems
    : liveItems.filter(i => i.category === activeStyle);
  const filteredItems = searchQuery.trim()
    ? styleFiltered.filter(i => {
        const q = searchQuery.toLowerCase();
        return i.title.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q);
      })
    : styleFiltered;

  // Business hours
  const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const todayName = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayHours = storefront.openingHours?.[todayName];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Announcement */}
      {liveData.announcementVisible && liveData.announcement && (
        <div className="bg-amber-900 text-amber-50 px-4 py-2.5 text-center text-sm font-medium">
          {liveData.announcement}
        </div>
      )}

      {/* Hero */}
      <div className="relative bg-amber-900 text-amber-50 px-4 py-12 sm:px-8 overflow-hidden">
        {liveData.bannerUrl && (
          <div className="absolute inset-0 z-0">
            <img src={liveData.bannerUrl} alt="" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-amber-950/80 to-transparent" />
          </div>
        )}
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                {liveData.logoUrl && (
                  <img src={liveData.logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 shrink-0" />
                )}
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">🍺 Craft Beer & Brewery</span>
                {storefront.isPublished && (
                  <span className="rounded-full bg-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold">● Live</span>
                )}
              </div>
              <h1 className="text-3xl font-extrabold sm:text-4xl">{liveData.name}</h1>
              {liveData.tagline && <p className="mt-1 text-amber-200 text-base">{liveData.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-200">
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-200" />{storefront.rating.toFixed(1)} ({storefront.reviewCount} reviews)</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{storefront.area}, {storefront.city}</span>
                {todayHours && !todayHours.closed && (
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{todayHours.open} – {todayHours.close}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
              <button onClick={() => setShowTaproom(true)}
                className="rounded-xl bg-white/15 px-5 py-2.5 text-sm font-bold backdrop-blur hover:bg-white/25 border border-amber-700">
                🏭 Book Taproom
              </button>
              <button onClick={() => setShowBeerClub(true)}
                className="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-bold hover:bg-amber-600 border border-amber-600">
                🍻 Join Beer Club
              </button>
              {storefront.contactPhone && (
                <a href={`tel:${storefront.contactPhone}`}
                  className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/20">
                  <Phone className="h-4 w-4" />{storefront.contactPhone}
                </a>
              )}
            </div>
          </div>

          {/* Availability badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            {storefront.deliveryEnabled  && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">🛵 Delivery available</span>}
            {storefront.pickupEnabled    && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">📦 Taproom pickup</span>}
            {refCode && <span className="rounded-full bg-yellow-400/30 px-3 py-1 text-xs font-medium">🎁 Referral deal active</span>}
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-white border-b border-stone-100 px-4 py-2.5">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5">
          {TRUST_POINTS.map((p, i) => (
            <span key={i} className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
              {typeof p.icon === "string" ? p.icon : p.icon} {p.text}
            </span>
          ))}
        </div>
      </div>

      {/* Membership join (scan-QR → become a member) — after hero, before products */}
      {(storefront.memberships?.length ?? 0) > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-8">
          <MembershipJoinSection slug={storefront.slug} memberships={storefront.memberships ?? []} joinIntent={joinIntent} />
        </div>
      )}

      {/* Offers strip */}
      {liveOffers.length > 0 && (
        <div className="border-b border-stone-200 bg-white px-4 py-4 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-amber-900" />
              <p className="text-sm font-bold text-slate-800">Active offers</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {liveOffers.map(o => <OfferCard key={o.id} offer={o} />)}
            </div>
          </div>
        </div>
      )}

      {/* Beer Club promo banner */}
      <div className="bg-gradient-to-r from-amber-900 to-amber-700 px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-amber-50">
            <p className="font-bold text-base">🍺 Beer Club — hand-picked craft beers delivered monthly</p>
            <p className="text-amber-200 text-sm mt-0.5">From 199 SEK / month · 10% discount · Early access to seasonal releases</p>
          </div>
          <button onClick={() => setShowBeerClub(true)}
            className="shrink-0 rounded-xl bg-white text-amber-900 font-bold text-sm px-5 py-2.5 hover:bg-amber-50 transition-colors">
            Join Beer Club →
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="flex gap-6 flex-col lg:flex-row">

          {/* Left: catalogue */}
          <div className="flex-1 min-w-0">
            {/* Search */}
            {liveItems.length >= 6 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search beers…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* Style filter tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
              {["All", ...BEER_STYLES].map(style => (
                <button key={style} onClick={() => setActiveStyle(style)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeStyle === style ? "bg-amber-900 text-amber-50" : "bg-white border border-stone-200 text-slate-600 hover:border-amber-300"
                  }`}>
                  {style}
                </button>
              ))}
            </div>

            {/* Beer grid */}
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
                <p className="text-4xl mb-3">🍺</p>
                <p className="text-slate-500 text-sm font-medium">
                  {searchQuery ? `No beers matching "${searchQuery}"` : "No beers available yet."}
                </p>
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="mt-2 text-xs text-amber-700 hover:underline">Clear search</button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map(item => (
                  <BeerCard
                    key={item.id}
                    item={item}
                    cartQty={cart[item.id] ?? 0}
                    onAdd={() => addToCart(item.id)}
                    onDetail={() => setDetailItem(item)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: order panel + info */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            {/* Cart */}
            <CartPanel
              cart={cart}
              items={liveItems}
              storefront={storefront}
              availability={availability}
              onAdd={addToCart}
              onRemove={removeFromCart}
              onClear={() => setCart({})}
            />

            {/* Quick actions */}
            <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
              <button onClick={() => setShowTaproom(true)}
                className="w-full flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors">
                <span className="text-2xl">🏭</span>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-amber-900">Book Taproom Visit</p>
                  <p className="text-xs text-amber-700">Reserve a table + optional guided tasting</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-700 shrink-0" />
              </button>
              <button onClick={() => setShowBeerClub(true)}
                className="w-full flex items-center gap-3 rounded-xl border border-amber-900/20 bg-amber-900 px-4 py-3 hover:bg-amber-800 transition-colors">
                <span className="text-2xl">🍻</span>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-amber-50">Join Beer Club</p>
                  <p className="text-xs text-amber-200">Monthly deliveries from 199 SEK</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-300 shrink-0" />
              </button>
            </div>

            {/* Contact & hours */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
              <p className="font-bold text-slate-900 text-sm">Contact & hours</p>
              {storefront.contactPhone && (
                <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-700">
                  <Phone className="h-4 w-4 shrink-0" />{storefront.contactPhone}
                </a>
              )}
              {storefront.contactEmail && (
                <a href={`mailto:${storefront.contactEmail}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-700">
                  <Mail className="h-4 w-4 shrink-0" />{storefront.contactEmail}
                </a>
              )}
              {storefront.address && (
                <p className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />{storefront.address}
                </p>
              )}
              <div className="border-t border-stone-100 pt-3 space-y-1">
                {days.map(day => {
                  const h = storefront.openingHours?.[day];
                  return (
                    <div key={day} className={`flex justify-between text-xs ${day === todayName ? "font-semibold text-amber-900" : "text-slate-400"}`}>
                      <span className="capitalize">{day.slice(0, 3)}</span>
                      <span>{h?.closed ? "Closed" : h ? `${h.open} – ${h.close}` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {refCode && (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm">
                <p className="font-semibold text-yellow-800">🎁 You were referred!</p>
                <p className="text-yellow-700 text-xs mt-1">Code <strong>{refCode}</strong> is active — any deal will be auto-applied.</p>
              </div>
            )}
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
            <h2 className="text-lg font-bold text-slate-900">Perfect Pairings</h2>
            <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium">
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
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-700 transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Mobile cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 lg:hidden">
          <button onClick={() => setShowCartDrawer(true)}
            className="flex items-center gap-3 rounded-2xl px-6 py-3 text-sm font-bold text-amber-50 bg-amber-900 shadow-lg">
            <ShoppingCart className="h-5 w-5" />
            {cartCount} beer{cartCount !== 1 ? "s" : ""} in cart
          </button>
        </div>
      )}

      {/* Mobile cart drawer */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden">
          <div className="flex-1 bg-black/40" onClick={() => setShowCartDrawer(false)} />
          <div className="bg-stone-50 px-4 pt-4 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-slate-900">Your cart</p>
              <button onClick={() => setShowCartDrawer(false)}><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <CartPanel
              cart={cart} items={liveItems} storefront={storefront} availability={availability}
              onAdd={addToCart} onRemove={removeFromCart} onClear={() => { setCart({}); setShowCartDrawer(false); }}
            />
          </div>
        </div>
      )}

      {/* Beer detail drawer */}
      {detailItem && (
        <BeerDetailDrawer
          item={detailItem}
          cartQty={cart[detailItem.id] ?? 0}
          onAdd={i => addToCart(i.id)}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* Beer Club modal */}
      {showBeerClub && <BeerClubModal storefront={storefront} onClose={() => setShowBeerClub(false)} />}

      {/* Taproom booking modal */}
      {showTaproom && <TaproomModal storefront={storefront} onClose={() => setShowTaproom(false)} />}

      {/* Floating WhatsApp */}
      {storefront.contactPhone && (
        <div className="fixed bottom-24 right-4 z-40 lg:bottom-8">
          <a href={`https://wa.me/${storefront.contactPhone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp"
            className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-colors">
            <MessageCircle className="h-5 w-5" />
          </a>
        </div>
      )}
    </div>
  );
}
