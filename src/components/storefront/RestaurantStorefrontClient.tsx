"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin, Phone, Mail, Star, ShoppingCart, X, Plus, Minus, CheckCircle2,
  Clock, Truck, UtensilsCrossed, Tag, Loader2, ChevronRight, Search, ArrowRight, Settings2,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicOrder } from "@/lib/storefront/storefrontPublicApi";
import { formatCurrencyMarket, buildSwishLink } from "@/lib/utils/currency";
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

type CartMap = Record<string, number>;
type OrderType = "dine_in" | "takeaway" | "delivery";

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function getAttr(item: PublicItem, key: string): any {
  return (item as unknown as { attributes?: Record<string, unknown> }).attributes?.[key] ?? "";
}

const DIETARY_ICONS: Record<string, { label: string; color: string }> = {
  vegan:       { label: "Vegan",    color: "bg-green-100 text-green-800"  },
  vegetarian:  { label: "Veg",      color: "bg-lime-100 text-lime-800"    },
  gluten_free: { label: "GF",       color: "bg-amber-100 text-amber-800"  },
  spicy:       { label: "🌶 Spicy", color: "bg-red-100 text-red-800"      },
  new:         { label: "New",      color: "bg-sky-100 text-sky-800"      },
  popular:     { label: "Popular",  color: "bg-orange-100 text-orange-800"},
  bestseller:  { label: "⭐ Best",  color: "bg-amber-100 text-amber-800"  },
};

function MenuItemCard({
  item, currency, cartQty, onAdd, onRemove,
}: {
  item: PublicItem; currency: string; cartQty: number;
  onAdd: () => void; onRemove: () => void;
}) {
  const discount = item.discountPrice != null && item.discountPrice < item.price;
  const displayPrice = item.discountPrice ?? item.price;
  const dietary = getAttr(item, "dietary");
  const allergens = getAttr(item, "allergens");
  const dietaryList = Array.isArray(dietary) ? dietary : [];
  const badges = [...item.badges, ...dietaryList];

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex gap-3 p-3 hover:shadow-sm transition-shadow">
      <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
          : <span className="text-4xl">{item.imageEmoji || "🍽️"}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 mb-1">
          {badges.slice(0, 3).map(b => {
            const d = DIETARY_ICONS[b.toLowerCase()];
            return <span key={b} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${d?.color ?? "bg-slate-100 text-slate-600"}`}>{d?.label ?? b}</span>;
          })}
        </div>
        <p className="font-semibold text-slate-900 text-sm leading-tight">{item.title}</p>
        {item.shortDescription && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.shortDescription}</p>
        )}
        {allergens && Array.isArray(allergens) && allergens.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">Contains: {(allergens as string[]).join(", ")}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="font-bold text-orange-700 text-sm">{fmt(displayPrice, currency)}</span>
            {discount && <span className="ml-1.5 text-xs text-slate-400 line-through">{fmt(item.price, currency)}</span>}
          </div>
          {item.orderingEnabled && (
            <div className="flex items-center gap-1.5">
              {cartQty > 0 ? (
                <>
                  <button onClick={onRemove} className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center hover:bg-orange-200 font-bold text-xs">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold text-slate-900 w-5 text-center">{cartQty}</span>
                </>
              ) : null}
              <button onClick={onAdd} className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RestaurantStorefrontClient({ storefront, items, offers }: Props) {
  const [cart, setCart] = useState<CartMap>({});
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [orderRef, setOrderRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [pinnedItems, setPinnedItems] = useState<CrossSellItem[]>([]);

  useEffect(() => {
    setPinnedItems(loadPinnedItems(storefront.id ?? storefront.slug));
  }, [storefront.id, storefront.slug]);
  const currency = storefront.currency ?? "SEK";

  const visibleItems = items.filter(i => i.visible);
  const categories = ["All", ...Array.from(new Set(visibleItems.map(i => i.category).filter(Boolean)))];
  const filtered = visibleItems
    .filter(i => activeCategory === "All" || i.category === activeCategory)
    .filter(i => !search || i.title.toLowerCase().includes(search.toLowerCase()));

  const totalQty  = Object.values(cart).reduce((s, q) => s + q, 0);
  const totalAmt  = visibleItems.reduce((s, i) => s + (cart[i.id] ?? 0) * (i.discountPrice ?? i.price), 0);
  const cartItems = visibleItems.filter(i => cart[i.id] > 0);

  const addToCart  = (id: string) => setCart(p => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(p => { const n = { ...p }; n[id] = Math.max(0, (n[id] ?? 0) - 1); return n; });

  const placeOrder = async () => {
    if (!customerForm.name.trim() || !customerForm.phone.trim()) return;
    setLoading(true);
    try {
      const res = await createPublicOrder(storefront.slug, {
        orderType,
        customerName:    customerForm.name,
        customerPhone:   customerForm.phone,
        deliveryAddress: orderType === "delivery" ? customerForm.address : undefined,
        notes:           customerForm.notes || undefined,
        items:           cartItems.map(i => ({ itemId: i.id, quantity: cart[i.id], price: i.discountPrice ?? i.price })),
      });
      setOrderRef((res as { orderNumber?: string }).orderNumber ?? "ORD-" + Date.now().toString(36).toUpperCase());
      setDone(true);
      setCart({});
    } catch {
      alert("Order failed. Please call us directly.");
    }
    setLoading(false);
  };

  const swishLink = storefront.swishNumber ? buildSwishLink({ payeeNumber: storefront.swishNumber, amount: totalAmt, message: `Order at ${storefront.name}` }) : null;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Announcement */}
      {storefront.announcement && storefront.announcementVisible && (
        <div className="bg-orange-600 text-white text-center text-sm py-2 px-4 font-medium">
          {storefront.announcement}
        </div>
      )}

      {/* Hero */}
      <div className="relative h-80 bg-gradient-to-br from-orange-900 via-red-900 to-slate-900 overflow-hidden">
        {storefront.bannerUrl
          ? <img src={storefront.bannerUrl} alt={storefront.name} className="absolute inset-0 w-full h-full object-cover opacity-50" />
          : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          {storefront.logoUrl && (
            <img src={storefront.logoUrl} alt={storefront.name} className="w-16 h-16 rounded-2xl object-contain bg-white/10 p-2 mb-3 shadow-xl" />
          )}
          <h1 className="text-4xl font-extrabold text-white mb-1">{storefront.name}</h1>
          <p className="text-orange-200 mb-1">{storefront.tagline || "Fine Food, Great Atmosphere"}</p>
          <div className="flex items-center gap-3 text-white/60 text-sm">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{storefront.city}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Open Now</span>
          </div>
        </div>
      </div>

      {/* Order type selector (sticky) */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {(["dine_in", "takeaway", "delivery"] as OrderType[]).map(t => {
              const labels = { dine_in: "🍽️ Dine-in", takeaway: "🥡 Takeaway", delivery: "🛵 Delivery" };
              return (
                <button key={t} onClick={() => setOrderType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${orderType === t ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {labels[t]}
                </button>
              );
            })}
          </div>
          {totalQty > 0 && (
            <button onClick={() => setCheckoutOpen(true)}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-1.5 rounded-xl text-sm font-semibold hover:bg-orange-700 transition-colors">
              <ShoppingCart className="w-4 h-4" />
              <span>{totalQty} item{totalQty !== 1 ? "s" : ""}</span>
              <span className="bg-white/20 px-1.5 rounded text-xs">{fmt(totalAmt, currency)}</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Offers */}
        {offers.filter(o => o.visible).length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {offers.filter(o => o.visible).map(o => (
              <div key={o.id} className="shrink-0 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl p-4 min-w-[220px]">
                <span className="text-2xl">{o.imageEmoji || "🎉"}</span>
                <p className="font-bold mt-1">{o.title}</p>
                {o.discountType === "percentage" && (
                  <p className="text-orange-100 text-sm">{o.discountValue}% OFF</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Search + category tabs */}
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search menu..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? "bg-orange-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-orange-300"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No items match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(item => (
              <MenuItemCard
                key={item.id} item={item} currency={currency}
                cartQty={cart[item.id] ?? 0}
                onAdd={() => addToCart(item.id)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))}
          </div>
        )}

        {/* Cross-sell */}
        {pinnedItems.length > 0 ? (
          <div>
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
          </div>
        ) : getIndustryCapabilities(storefront.industry).crossSellCategories.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">You Might Also Like</h2>
              <Link href="/settings/cross-sell" className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium">
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
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Contact */}
        <div className="bg-slate-900 rounded-2xl p-5 text-white grid grid-cols-1 sm:grid-cols-3 gap-4">
          {storefront.contactPhone && (
            <a href={`tel:${storefront.contactPhone}`} className="flex items-center gap-3 hover:opacity-80">
              <Phone className="w-5 h-5 text-orange-400 shrink-0" />
              <div><p className="text-[10px] text-white/50">Call us</p><p className="text-sm font-medium">{storefront.contactPhone}</p></div>
            </a>
          )}
          {storefront.contactEmail && (
            <a href={`mailto:${storefront.contactEmail}`} className="flex items-center gap-3 hover:opacity-80">
              <Mail className="w-5 h-5 text-orange-400 shrink-0" />
              <div><p className="text-[10px] text-white/50">Email us</p><p className="text-sm font-medium">{storefront.contactEmail}</p></div>
            </a>
          )}
          {storefront.city && (
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-orange-400 shrink-0" />
              <div><p className="text-[10px] text-white/50">Find us</p><p className="text-sm font-medium">{storefront.city}</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Checkout drawer */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="font-bold text-slate-900">Your Order</h2>
                <p className="text-xs text-slate-500 capitalize">{orderType.replace("_", "-")}</p>
              </div>
              <button onClick={() => setCheckoutOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {done ? (
                <div className="px-6 py-12 text-center">
                  <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Order Placed!</h3>
                  <p className="text-sm text-slate-500 mb-2">Order ref: <span className="font-mono font-bold text-orange-700">{orderRef}</span></p>
                  <p className="text-sm text-slate-500">We&apos;ll confirm shortly. Estimated time: 20–30 min.</p>
                  <button onClick={() => { setCheckoutOpen(false); setDone(false); }} className="mt-6 px-6 py-2.5 bg-orange-600 text-white rounded-xl font-semibold text-sm hover:bg-orange-700">
                    Continue Browsing
                  </button>
                </div>
              ) : (
                <div className="px-6 py-5 space-y-4">
                  {/* Cart items */}
                  <div className="space-y-2">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-100">
                        <span className="text-xl">{item.imageEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                          <p className="text-xs text-slate-500">{fmt(item.discountPrice ?? item.price, currency)} × {cart[item.id]}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><Minus className="w-3 h-3" /></button>
                          <span className="text-sm font-bold w-4 text-center">{cart[item.id]}</span>
                          <button onClick={() => addToCart(item.id)} className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700"><Plus className="w-3 h-3" /></button>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 w-16 text-right">{fmt((item.discountPrice ?? item.price) * cart[item.id], currency)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center py-2 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="font-bold text-orange-700 text-lg">{fmt(totalAmt, currency)}</span>
                  </div>

                  {/* Customer details */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Your Name *</label>
                      <input value={customerForm.name} onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Anna Lindström"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Phone *</label>
                      <input value={customerForm.phone} onChange={e => setCustomerForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+46 70 123 45 67"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    {orderType === "delivery" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Delivery Address *</label>
                        <input value={customerForm.address} onChange={e => setCustomerForm(p => ({ ...p, address: e.target.value }))}
                          placeholder="Storgatan 1, Stockholm"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Special Instructions</label>
                      <textarea rows={2} value={customerForm.notes} onChange={e => setCustomerForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Allergies, extra sauces, etc."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none" />
                    </div>
                  </div>

                  {swishLink && (
                    <a href={swishLink} className="flex items-center justify-center gap-2 w-full py-3 bg-[#4CAF50] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                      Pay with Swish {fmt(totalAmt, currency)}
                    </a>
                  )}
                </div>
              )}
            </div>

            {!done && (
              <div className="px-6 py-4 border-t border-slate-100 shrink-0">
                <button
                  onClick={placeOrder}
                  disabled={loading || !customerForm.name.trim() || !customerForm.phone.trim()}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
                  Place Order · {fmt(totalAmt, currency)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
