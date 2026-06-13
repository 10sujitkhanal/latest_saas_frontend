"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingCart, X, Plus, Minus, CheckCircle2,
  Search, ArrowRight, RefreshCw, MessageCircle, Leaf, Truck,
  RotateCcw, Shield, FlaskConical, Star, ChevronLeft, Info,
  BookOpen, Tag, Mail,
} from "lucide-react";
import type { PublicStorefront, PublicItem, PublicOffer, PublicAvailability } from "@/lib/storefront/storefrontPublicApi";
import { createPublicOrder, getPublicEvents } from "@/lib/storefront/storefrontPublicApi";
import { formatCurrencyMarket, buildSwishLink, isPriceInclusive, getVatLabel } from "@/lib/utils/currency";
import { getIndustryCapabilities } from "@/lib/industry/config";
import { getIndustryStorefrontConfig } from "@/lib/moredealsx/industry-config";
import { loadPinnedItems, type CrossSellItem } from "@/lib/storefront/crossSellCatalogue";
import { WELLNESS_BLOG_POSTS } from "@/lib/storefront/wellnessBlogData";
import { WellnessMarketplaceFooter } from "@/components/storefront/wellness/WellnessMarketplaceFooter";
import MembershipJoinSection from "@/components/storefront/MembershipJoinSection";
import GiftCardBuySection from "@/components/storefront/GiftCardBuySection";
import LoyaltyRewardsSection from "@/components/storefront/LoyaltyRewardsSection";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  storefront:   PublicStorefront;
  items:        PublicItem[];
  offers:       PublicOffer[];
  availability: PublicAvailability | null;
  refCode?:     string;
  joinIntent?:  boolean;
}

interface StoredEvent {
  id: string; title: string; description: string;
  date: string; time: string; endTime: string; location: string;
  capacity: number; ticketPrice: number; isFree: boolean;
  imageUrl: string; videoUrl?: string; onlineLink?: string;
  isOnlineEvent: boolean; visible: boolean; onMoreDealsX: boolean; tags?: string;
}

type CartMap = Record<string, number>;
type SubInterval = "once" | "monthly" | "bi_monthly" | "quarterly";

// ─── Bilingual text dictionary ────────────────────────────────────────────────

type Lang = "sv" | "en";

const TEXTS: Record<Lang, {
  heroBadge: string;
  stat1Label: string;
  stat2Value: string; stat2Label: string;
  stat3Value: string; stat3Label: string;
  trustPoints: string[];
  subSave: string; subDesc: string;
  subOptions: string[];
  offersTitle: string;
  productsTitle: string; productsSubtitle: string;
  searchPlaceholder: string; allCategories: string; clearFilter: string; noProducts: string;
  certTitle: string; certSubtitle: string; certBadge: string;
  cartTitle: string; cartEmpty: string; cartSubtotal: string; cartDelivery: string;
  cartDiscount: string; cartTotal: string;
  cartNamePlaceholder: string; cartPhonePlaceholder: string; cartAddressPlaceholder: string;
  orderBtn: (total: string) => string; sending: string;
  orderSuccessTitle: string; orderAgain: string;
  whatsappBtn: string;
  categoryTitle: string;
  goalAll: string;
}> = {
  sv: {
    heroBadge:        "Naturliga hälsoprodukter",
    stat1Label:       "Produkter",
    stat2Value:       "100%", stat2Label: "Naturliga",
    stat3Value:       "30d",  stat3Label: "Öppet köp",
    trustPoints:      ["Gratis frakt över 499 kr", "30 dagar öppet köp", "Säker betalning", "Naturliga ingredienser", "Tredjepartstestade"],
    subSave:          "Prenumerera & spara upp till 15%",
    subDesc:          "Välj köpläge — gäller alla produkter i varukorgen",
    subOptions:       ["Engångsköp", "Varje månad", "Varannan månad", "Varje kvartal"],
    offersTitle:      "Aktuella erbjudanden",
    productsTitle:    "Våra produkter",
    productsSubtitle: "Filtrera efter ditt hälsomål",
    searchPlaceholder:"Sök produkt…",
    allCategories:    "Alla kategorier",
    clearFilter:      "Rensa filter",
    noProducts:       "Inga produkter hittades.",
    certTitle:        "Transparens & certifieringar",
    certSubtitle:     "Varje produkt är testad, märkt och anmäld hos relevanta myndigheter.",
    certBadge:        "Tredjepartsverifierat",
    cartTitle:        "Din varukorg",
    cartEmpty:        "Lägg till produkter för att beställa",
    cartSubtotal:     "Delsumma",
    cartDelivery:     "Frakt",
    cartDiscount:     "Prenumerationsrabatt",
    cartTotal:        "Totalt",
    cartNamePlaceholder:    "Ditt namn *",
    cartPhonePlaceholder:   "Telefon *",
    cartAddressPlaceholder: "Leveransadress",
    orderBtn:         (t) => `Beställ · ${t}`,
    sending:          "Skickar…",
    orderSuccessTitle:"Beställning mottagen!",
    orderAgain:       "Beställ igen",
    whatsappBtn:      "Skicka beställning via WhatsApp",
    categoryTitle:    "Utforska efter hälsomål",
    goalAll:          "Alla",
  },
  en: {
    heroBadge:        "Natural health products",
    stat1Label:       "Products",
    stat2Value:       "100%", stat2Label: "Natural",
    stat3Value:       "30d",  stat3Label: "Returns",
    trustPoints:      ["Free delivery over 499 kr", "30-day returns", "Secure payment", "Natural ingredients", "Third-party tested"],
    subSave:          "Subscribe & save up to 15%",
    subDesc:          "Choose purchase mode — applies to all cart items",
    subOptions:       ["One-time", "Monthly", "Every 2 months", "Quarterly"],
    offersTitle:      "Current offers",
    productsTitle:    "Our products",
    productsSubtitle: "Filter by your health goal",
    searchPlaceholder:"Search product…",
    allCategories:    "All categories",
    clearFilter:      "Clear filters",
    noProducts:       "No products found.",
    certTitle:        "Transparency & certifications",
    certSubtitle:     "Every product is tested, labelled and registered with relevant authorities.",
    certBadge:        "Third-party verified",
    cartTitle:        "Your cart",
    cartEmpty:        "Add products to place an order",
    cartSubtotal:     "Subtotal",
    cartDelivery:     "Delivery",
    cartDiscount:     "Subscription discount",
    cartTotal:        "Total",
    cartNamePlaceholder:    "Your name *",
    cartPhonePlaceholder:   "Phone *",
    cartAddressPlaceholder: "Delivery address",
    orderBtn:         (t) => `Order · ${t}`,
    sending:          "Sending…",
    orderSuccessTitle:"Order received!",
    orderAgain:       "Order again",
    whatsappBtn:      "Send order via WhatsApp",
    categoryTitle:    "Explore by health goal",
    goalAll:          "All",
  },
};

const GOALS_LABELS: Record<Lang, string[]> = {
  sv: ["Alla", "Energi", "Immunitet", "Sömn", "Vikt", "Träning", "Skönhet", "Stress", "Barn"],
  en: ["All",  "Energy","Immunity", "Sleep","Weight","Fitness","Beauty","Stress","Kids"],
};

// ─── Swedish wellness constants ───────────────────────────────────────────────

const CERTIFICATIONS = [
  { key: "krav",             label: "KRAV",               icon: "🌿", bg: "bg-green-100  text-green-800",  tip: "Certifierat ekologiskt av KRAV" },
  { key: "eu_organic",       label: "EU Ekologisk",        icon: "⭐", bg: "bg-lime-100   text-lime-800",   tip: "EU-certifierad ekologisk produkt" },
  { key: "svanen",           label: "Svanen",              icon: "🦢", bg: "bg-sky-100    text-sky-800",    tip: "Nordisk miljömärkning" },
  { key: "livsmedelsverket", label: "Livsmedelsverket",   icon: "🇸🇪", bg: "bg-blue-100   text-blue-800",   tip: "Anmäld hos Livsmedelsverket" },
  { key: "vegan",            label: "Vegansk",             icon: "🌱", bg: "bg-emerald-100 text-emerald-800", tip: "100% veganskt" },
  { key: "gluten_free",      label: "Glutenfri",           icon: "🌾", bg: "bg-amber-100  text-amber-800",  tip: "Glutenfritt" },
  { key: "lactose_free",     label: "Laktosfri",           icon: "🥛", bg: "bg-orange-100 text-orange-800", tip: "Laktosfri produkt" },
  { key: "sugar_free",       label: "Sockerfri",           icon: "🍬", bg: "bg-rose-100   text-rose-800",   tip: "Utan tillsatt socker" },
  { key: "third_party",      label: "Tredjepartstest",     icon: "🔬", bg: "bg-purple-100 text-purple-800", tip: "Oberoende laboratorietestning" },
] as const;

type CertKey = typeof CERTIFICATIONS[number]["key"];

const GOALS = [
  { key: "all",      label: "Alla",      icon: "✨" },
  { key: "energy",   label: "Energi",    icon: "⚡" },
  { key: "immunity", label: "Immunitet", icon: "🛡️" },
  { key: "sleep",    label: "Sömn",      icon: "😴" },
  { key: "weight",   label: "Vikt",      icon: "⚖️" },
  { key: "fitness",  label: "Träning",   icon: "💪" },
  { key: "beauty",   label: "Skönhet",   icon: "✨" },
  { key: "stress",   label: "Stress",    icon: "🧘" },
  { key: "kids",     label: "Barn",      icon: "👶" },
] as const;

type GoalKey = typeof GOALS[number]["key"];

const SUBSCRIPTION_OPTIONS: { key: SubInterval; label: string; discount: number }[] = [
  { key: "once",      label: "Engångsköp",           discount: 0  },
  { key: "monthly",   label: "Varje månad",           discount: 15 },
  { key: "bi_monthly",label: "Varannan månad",        discount: 10 },
  { key: "quarterly", label: "Varje kvartal",         discount: 5  },
];

const WELLNESS_GOAL_CATEGORIES = [
  { goalKey: "energy",   icon: "⚡", label: "Energi"         },
  { goalKey: "immunity", icon: "🛡️", label: "Immunitet"      },
  { goalKey: "sleep",    icon: "😴", label: "Sömn"           },
  { goalKey: "fitness",  icon: "💪", label: "Träning"        },
  { goalKey: "weight",   icon: "⚖️", label: "Viktkontroll"   },
  { goalKey: "beauty",   icon: "✨", label: "Skönhet"        },
  { goalKey: "stress",   icon: "🧘", label: "Stresshantering"},
  { goalKey: "kids",     icon: "👶", label: "Barn & Familj"  },
] as const;

const FEATURED_BLOG_POSTS = WELLNESS_BLOG_POSTS.filter(p => p.featured).slice(0, 3);

const TRUST_POINTS = [
  { icon: <Truck   className="h-4 w-4" />, text: "Gratis frakt över 499 kr"     },
  { icon: <RotateCcw className="h-4 w-4" />, text: "30 dagar öppet köp"         },
  { icon: <Shield  className="h-4 w-4" />, text: "Säker betalning"               },
  { icon: <Leaf    className="h-4 w-4" />, text: "Naturliga ingredienser"         },
  { icon: <FlaskConical className="h-4 w-4" />, text: "Tredjepartstestade"        },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "SEK") {
  return formatCurrencyMarket(n, currency);
}

function getAttr(item: PublicItem, key: string): string | string[] | number | undefined {
  return (item as any).attributes?.[key];
}

function getCertList(item: PublicItem): CertKey[] {
  const raw = getAttr(item, "certifications");
  if (Array.isArray(raw)) return raw as CertKey[];
  if (typeof raw === "string") return raw.split(",").map(s => s.trim()) as CertKey[];
  return [];
}

function getGoals(item: PublicItem): string[] {
  const raw = getAttr(item, "goals");
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
  const cert = CERTIFICATIONS.find(c => c.key === certKey);
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
  const certs    = getCertList(item);
  const goals    = getGoals(item);
  const price    = item.discountPrice ?? item.price;
  const subPrice = applySubDiscount(price, subInterval);
  const ingredients = getAttr(item, "ingredients") as string | undefined;
  const dosage      = getAttr(item, "dosage")      as string | undefined;
  const servings    = getAttr(item, "servings")     as number | undefined;
  const weight      = getAttr(item, "weight")       as string | undefined;
  const form        = getAttr(item, "form")         as string | undefined;
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
          {/* Image / emoji */}
          <div className="w-full aspect-square rounded-2xl bg-stone-50 flex items-center justify-center overflow-hidden border border-stone-100">
            {item.imageUrl
              ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
              : <span className="text-8xl">{item.imageEmoji || "🌿"}</span>}
          </div>

          {/* Name + goal tags */}
          <div>
            <div className="flex flex-wrap gap-1 mb-2">
              {goals.map(g => {
                const goal = GOALS.find(x => x.key === g);
                return goal ? (
                  <span key={g} className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">
                    {goal.icon} {goal.label}
                  </span>
                ) : null;
              })}
              {form && <span className="text-[10px] font-semibold bg-stone-100 text-stone-600 rounded-full px-2 py-0.5">{form}</span>}
            </div>
            <h2 className="text-xl font-bold text-stone-900">{item.title}</h2>
            {item.shortDescription && <p className="text-sm text-stone-500 mt-1">{item.shortDescription}</p>}
            {weight && <p className="text-xs text-stone-400 mt-1">{weight}{servings ? ` · ${servings} portioner` : ""}</p>}
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

          {/* Subscription selector */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Prenumerera & spara
            </p>
            <div className="space-y-2">
              {SUBSCRIPTION_OPTIONS.map(opt => (
                <label key={opt.key} className={`flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer border transition-all ${subInterval === opt.key ? "border-emerald-500 bg-white shadow-sm" : "border-transparent hover:border-emerald-200"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${subInterval === opt.key ? "border-emerald-600 bg-emerald-600" : "border-stone-300"}`}>
                      {subInterval === opt.key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <input type="radio" name="sub" value={opt.key} checked={subInterval === opt.key}
                      onChange={() => onSubChange(opt.key)} className="sr-only" />
                    <span className="text-sm font-medium text-stone-800">{opt.label}</span>
                  </div>
                  <div className="text-right">
                    {opt.discount > 0
                      ? <><p className="text-sm font-bold text-emerald-700">{fmt(applySubDiscount(price, opt.key), currency)}</p>
                          <p className="text-[10px] text-emerald-600">Spara {opt.discount}%</p></>
                      : <p className="text-sm font-semibold text-stone-700">{fmt(price, currency)}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Dosage */}
          {dosage && (
            <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Dosering</p>
              <p className="text-sm text-stone-700">{dosage}</p>
            </div>
          )}

          {/* Ingredients */}
          {ingredients && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Ingredienser
              </p>
              <p className="text-xs text-stone-500 leading-relaxed">{ingredients}</p>
            </div>
          )}

          {/* Full description */}
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
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors"
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

// ─── WellnessItemCard ─────────────────────────────────────────────────────────

function WellnessItemCard({ item, onAdd, onDetail, subInterval }: {
  item: PublicItem;
  onAdd: (id: string) => void;
  onDetail: (item: PublicItem) => void;
  subInterval: SubInterval;
}) {
  const price    = item.discountPrice ?? item.price;
  const subPrice = applySubDiscount(price, subInterval);
  const certs    = getCertList(item);
  const goals    = getGoals(item);

  return (
    <div
      className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-stone-100"
      onClick={() => onDetail(item)}
    >
      {/* Image area */}
      <div className="relative h-44 bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50 flex items-center justify-center overflow-hidden">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <span className="text-7xl group-hover:scale-110 transition-transform duration-300 select-none">{item.imageEmoji || "🌿"}</span>}

        {/* Badges top-left */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {item.discountPrice && (
            <span className="rounded-full bg-rose-500 text-white text-[10px] font-bold px-2.5 py-0.5 shadow-sm">
              -{Math.round((1 - item.discountPrice / item.price) * 100)}%
            </span>
          )}
          {item.category && (
            <span className="rounded-full bg-white/90 text-stone-700 text-[10px] font-semibold px-2 py-0.5 backdrop-blur-sm shadow-sm">
              {item.category}
            </span>
          )}
        </div>

        {/* Subscription badge top-right */}
        {subInterval !== "once" && (
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-0.5 rounded-full bg-[#1a3a2b] text-white text-[10px] font-bold px-2 py-0.5 shadow">
              <RefreshCw className="h-2.5 w-2.5" /> Sub
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2">
        {/* Goal chips */}
        {goals.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {goals.slice(0, 2).map(g => {
              const goal = GOALS.find(x => x.key === g);
              return goal ? (
                <span key={g} className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full px-1.5 py-0.5">
                  {goal.icon} {goal.label}
                </span>
              ) : null;
            })}
          </div>
        )}

        <h3 className="text-sm font-bold text-stone-900 leading-snug line-clamp-2">{item.title}</h3>

        {item.shortDescription && (
          <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed">{item.shortDescription}</p>
        )}

        {/* Cert badges */}
        {certs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {certs.slice(0, 2).map(c => <CertBadge key={c} certKey={c} size="xs" />)}
            {certs.length > 2 && <span className="text-[10px] text-stone-400">+{certs.length - 2}</span>}
          </div>
        )}

        {/* Price + Add */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-auto">
          <div>
            {subInterval !== "once" && subPrice !== price ? (
              <>
                <p className="text-[10px] text-stone-400 line-through leading-none">{fmt(price, item.currency)}</p>
                <p className="text-sm font-bold text-emerald-700 leading-tight">{fmt(subPrice, item.currency)}</p>
              </>
            ) : (
              <>
                {item.discountPrice && <p className="text-[10px] text-stone-400 line-through leading-none">{fmt(item.price, item.currency)}</p>}
                <p className="text-sm font-bold text-stone-900 leading-tight">{fmt(price, item.currency)}</p>
              </>
            )}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onAdd(item.id); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1a3a2b] text-white hover:bg-emerald-800 transition-colors shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WellnessCartPanel ────────────────────────────────────────────────────────

function WellnessCartPanel({ cart, items, storefront, availability, subInterval, lang, onAdd, onRemove, onClear }: {
  cart: CartMap;
  items: PublicItem[];
  storefront: PublicStorefront;
  availability: PublicAvailability | null;
  subInterval: SubInterval;
  lang: Lang;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const tc = TEXTS[lang];
  const [form, setForm]     = useState({ name: "", phone: "", address: "", notes: "" });
  const [done, setDone]     = useState(false);
  const [orderNum, setOrderNum] = useState("");
  const [loading, setLoading]  = useState(false);
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
    const p = applySubDiscount(item.discountPrice ?? item.price, subInterval);
    return s + p * qty;
  }, 0);
  const deliveryFee = availability?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;

  const subOpt = SUBSCRIPTION_OPTIONS.find(o => o.key === subInterval);
  const totalSavings = subOpt?.discount
    ? cartEntries.reduce((s, { item, qty }) => {
        const base = item.discountPrice ?? item.price;
        const saved = base - applySubDiscount(base, subInterval);
        return s + saved * qty;
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
      const fallback = "SW-" + Math.random().toString(36).slice(2, 8).toUpperCase();
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
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-3 font-bold text-stone-900">{tc.orderSuccessTitle}</p>
        <p className="text-sm text-stone-500 mt-1">Ref: <span className="font-semibold font-mono">{orderNum}</span></p>
        {subInterval !== "once" && (
          <p className="text-xs text-emerald-600 mt-1">✓ {SUBSCRIPTION_OPTIONS.find(o=>o.key===subInterval)?.label}</p>
        )}
        <p className="text-xs text-stone-400 mt-1">{storefront.name} {lang === "sv" ? "kontaktar dig snart." : "will contact you shortly."}</p>
        <button onClick={() => setDone(false)} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-emerald-700">{tc.orderAgain}</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <p className="font-bold text-stone-900">{tc.cartTitle}</p>

      {cartEntries.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-6 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-emerald-200" />
          <p className="mt-2 text-sm text-stone-500">{tc.cartEmpty}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cartEntries.map(({ item, qty }) => {
            const linePrice = applySubDiscount(item.discountPrice ?? item.price, subInterval);
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-xl">{item.imageEmoji || "🌿"}</span>
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
          placeholder={tc.cartNamePlaceholder} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder={tc.cartPhonePlaceholder} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder={tc.cartAddressPlaceholder} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>

      {cartEntries.length > 0 && (
        <div className="border-t border-stone-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-stone-500"><span>{tc.cartSubtotal}</span><span>{fmt(subtotal)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between text-stone-500"><span>{tc.cartDelivery}</span><span>{fmt(deliveryFee)}</span></div>}
          {totalSavings > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>{tc.cartDiscount}</span><span>−{fmt(totalSavings)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-stone-900"><span>{tc.cartTotal}</span><span>{fmt(total)}</span></div>
          {isPriceInclusive("SEK") && (
            <p className="text-[10px] text-stone-400 text-right">{getVatLabel("SEK")}</p>
          )}
        </div>
      )}

      {subInterval !== "once" && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
          <RefreshCw className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700 font-medium">{subOpt?.label} · {subOpt?.discount}% rabatt aktiverad</p>
        </div>
      )}

      <button onClick={handleOrder} disabled={!canOrder || loading}
        className="w-full rounded-xl py-3 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 transition-colors">
        {loading ? tc.sending : tc.orderBtn(fmt(total))}
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
          `Hej ${storefront.name}! 🌿 Jag vill beställa:\n\n${cartEntries.map(({ item, qty }) =>
            `• ${qty}× ${item.title} — ${fmt(applySubDiscount(item.discountPrice ?? item.price, subInterval) * qty, item.currency)}`
          ).join("\n")}\n\nTotalt: ${fmt(total)}\n${subInterval !== "once" ? `Prenumeration: ${subOpt?.label}\n` : ""}Namn: ${form.name}\nTelefon: ${form.phone}`
        )}`}
          target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-green-500 hover:bg-green-600 transition-colors">
          <MessageCircle className="h-4 w-4" />
          {tc.whatsappBtn}
        </a>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WellnessStorefrontClient({ storefront, items, offers, availability, joinIntent }: Props) {
  const cacheKey = `storefront_cache_${storefront.slug}`;

  // Live data from localStorage bridge
  const [liveItems,    setLiveItems]    = useState<PublicItem[]>(items);
  const [liveOffers,   setLiveOffers]   = useState<PublicOffer[]>(offers);
  const [announcement, setAnnouncement] = useState({ text: "", type: "promo", visible: false });
  const [bannerUrl,    setBannerUrl]    = useState(storefront.bannerUrl);
  const [logoUrl,      setLogoUrl]      = useState(storefront.logoUrl);
  const [name,         setName]         = useState(storefront.name);
  const [tagline,      setTagline]      = useState(storefront.tagline);
  const [description,  setDescription]  = useState(storefront.description);
  const [primaryColor, setPrimaryColor] = useState(storefront.primaryColor ?? "#1a3a2b");
  const [heroCta,      setHeroCta]      = useState("Utforska produkter");
  const [heroCtaSub,   setHeroCtaSub]   = useState("Se erbjudanden");
  const [visibleSecs,  setVisibleSecs]  = useState<string[]>([]);
  const [pinnedItems,  setPinnedItems]  = useState<CrossSellItem[]>([]);
  const [liveEvents,   setLiveEvents]   = useState<StoredEvent[]>([]);

  useEffect(() => {
    const sfId = (storefront as any).id as string | undefined;
    const refresh = () => setPinnedItems(loadPinnedItems(sfId ?? storefront.slug));
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [storefront.slug]);

  // Fetch events from backend (falls back to localStorage cache via applyCache)
  useEffect(() => {
    getPublicEvents(storefront.slug).then(evts => {
      if (evts.length > 0) {
        setLiveEvents(evts.map(e => ({
          ...e, videoUrl: e.videoUrl ?? "", visible: true, onMoreDealsX: false,
        })) as StoredEvent[]);
      }
    });
  }, [storefront.slug]);

  const applyCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const c = JSON.parse(raw);
      const d = c.design ?? {};   // nested design block written by /storefront admin

      // Identity — admin writes nested: c.name, c.tagline, c.design.logo/banner/primaryColor
      if (c.name    !== undefined) setName(c.name);
      if (c.tagline !== undefined) setTagline(c.tagline);
      if (c.description !== undefined) setDescription(c.description);

      // Logo & banner — new format: c.design.logo / c.design.banner; fallback: flat c.logoUrl
      setBannerUrl(d.banner     ?? c.bannerUrl     ?? storefront.bannerUrl);
      setLogoUrl  (d.logo       ?? c.logoUrl       ?? storefront.logoUrl);

      // Primary colour — new format: c.design.primaryColor; fallback: storefront.primaryColor
      if (d.primaryColor) setPrimaryColor(d.primaryColor);

      // Hero CTA text — stored as c.design.heroCta / c.design.heroCtaSub
      // Language
      if (d.language)            setLang(d.language as Lang);
      // Hero title / subtitle overrides
      if (d.heroTitle !== undefined)    setTagline(d.heroTitle || c.tagline || storefront.tagline);
      if (d.heroSubtitle !== undefined) setDescription(d.heroSubtitle || c.description || storefront.description);
      // Hero CTA overrides
      if (d.heroCta)             setHeroCta(d.heroCta);
      if (d.heroCtaSub)          setHeroCtaSub(d.heroCtaSub);
      if (d.heroBadge)           setHeroBadgeOverride(d.heroBadge);
      if (d.heroStat2Value)      setStat2Value(d.heroStat2Value);
      if (d.heroStat2Label)      setStat2Label(d.heroStat2Label);
      if (d.heroStat3Value)      setStat3Value(d.heroStat3Value);
      if (d.heroStat3Label)      setStat3Label(d.heroStat3Label);
      if (d.trustPoints)         setTrustOverride(d.trustPoints.split("\n").map((s: string) => s.trim()).filter(Boolean));
      // Newsletter
      if (d.newsletterHeadline)  setNewsletterHeadline(d.newsletterHeadline);
      if (d.newsletterSubtext)   setNewsletterSubtext(d.newsletterSubtext);

      // Visible sections — controls which storefront sections render
      if (Array.isArray(d.visibleSections)) setVisibleSecs(d.visibleSections);

      // Announcement — new format: c.design.announcement; fallback: flat keys
      const annText    = d.announcement        ?? c.announcement        ?? "";
      const annType    = d.announcementType     ?? c.announcementType    ?? "promo";
      const annVisible = d.announcementVisible  ?? c.announcementVisible ?? false;
      setAnnouncement({ text: annText, type: annType, visible: !!annVisible });

      // Products & offers (unchanged)
      const userProducts = (c.products ?? []).filter((p: PublicItem) => !p.id.startsWith("sfp-"));
      if (userProducts.length > 0) setLiveItems(userProducts);
      const userOffers = (c.offers ?? []).filter((o: PublicOffer) => !o.id.startsWith("sfo-"));
      if (userOffers.length > 0) setLiveOffers(userOffers);

      // Events — only show visible, future-or-today, sorted by date
      if (Array.isArray(c.events)) {
        setLiveEvents((c.events as StoredEvent[]).filter(e => e.visible !== false));
      }
    } catch { /* ignore */ }
  }, [cacheKey, storefront.bannerUrl, storefront.logoUrl]);

  useEffect(() => {
    applyCache();
    const onStorage = () => applyCache();
    const onVisible = () => { if (!document.hidden) applyCache(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", onVisible); };
  }, [applyCache]);

  // Cart
  const [cart,     setCart]    = useState<CartMap>({});
  const [showCart, setShowCart] = useState(false);

  const addToCart = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(c => {
    const next = { ...c };
    if ((next[id] ?? 0) > 1) next[id]--; else delete next[id];
    return next;
  });
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Subscription mode (global — applies to all cart items)
  const [subInterval, setSubInterval] = useState<SubInterval>("once");

  // Filters
  const [activeGoal,     setActiveGoal]     = useState<GoalKey>("all");
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [detailItem,     setDetailItem]     = useState<PublicItem | null>(null);
  const [lang,               setLang]               = useState<Lang>("sv");
  const [newsletterEmail,    setNewsletterEmail]    = useState("");
  const [newsletterDone,     setNewsletterDone]     = useState(false);
  const [newsletterHeadline, setNewsletterHeadline] = useState("");
  const [newsletterSubtext,  setNewsletterSubtext]  = useState("");
  // Hero content overrides
  const [heroBadgeOverride,  setHeroBadgeOverride]  = useState("");
  const [stat2Value,         setStat2Value]         = useState("");
  const [stat2Label,         setStat2Label]         = useState("");
  const [stat3Value,         setStat3Value]         = useState("");
  const [stat3Label,         setStat3Label]         = useState("");
  const [trustOverride,      setTrustOverride]      = useState<string[]>([]);

  // Show a section if visibleSecs is empty (no admin config = show all) OR explicitly included
  const showSection = (key: string) => visibleSecs.length === 0 || visibleSecs.includes(key);

  const visibleItems = liveItems.filter(item => {
    if (searchQuery) {
      const hay = `${item.title} ${item.shortDescription ?? ""} ${item.category ?? ""}`.toLowerCase();
      if (!hay.includes(searchQuery.toLowerCase())) return false;
    }
    if (activeCategory && item.category !== activeCategory) return false;
    if (activeGoal !== "all") {
      const goals = getGoals(item);
      if (!goals.includes(activeGoal)) return false;
    }
    return true;
  });

  const categories = Array.from(new Set(liveItems.map(i => i.category).filter(Boolean))) as string[];
  const storeCurrency = liveItems[0]?.currency ?? "SEK";

  // Upcoming events — future-or-today, sorted ascending by date
  const upcomingEvents = liveEvents
    .filter(e => !e.date || new Date(e.date + "T23:59:59") >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date));

  // Resolved texts — language defaults overridden by admin config
  const t = TEXTS[lang];
  const badge      = heroBadgeOverride  || `${t.heroBadge} · ${storefront.city}`;
  const s2v        = stat2Value  || t.stat2Value;
  const s2l        = stat2Label  || t.stat2Label;
  const s3v        = stat3Value  || t.stat3Value;
  const s3l        = stat3Label  || t.stat3Label;
  const trustPts   = trustOverride.length > 0 ? trustOverride : t.trustPoints;
  const goalLabels = GOALS_LABELS[lang];
  const nlHeadline = newsletterHeadline || (lang === "sv" ? "Håll dig uppdaterad" : "Stay up to date");
  const nlSubtext  = newsletterSubtext  || (lang === "sv" ? "Få exklusiva erbjudanden, wellness-tips och information om nya produkter direkt i din inkorg." : "Get exclusive offers, wellness tips and new product news straight to your inbox.");

  const ANNOUNCEMENT_BG: Record<string, string> = {
    promo: "bg-emerald-700 text-white", info: "bg-blue-600 text-white",
    warning: "bg-amber-500 text-white", success: "bg-green-600 text-white",
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0]">
      {/* Announcement banner */}
      {announcement.visible && announcement.text && (
        <div className={`${ANNOUNCEMENT_BG[announcement.type] ?? ANNOUNCEMENT_BG.promo} text-center py-2 px-4 text-sm font-medium`}>
          {announcement.text}
        </div>
      )}

      {/* Top nav */}
      <nav className="sticky top-0 z-40 shadow-lg" style={{ backgroundColor: primaryColor }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {logoUrl
              ? <img src={logoUrl} alt={name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" />
              : <div className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-sm">{name[0]}</div>}
            <div>
              <p className="text-sm font-bold text-white">{name}</p>
              <p className="text-xs text-emerald-300">{storefront.city}</p>
            </div>
          </div>
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
              className="text-emerald-300 hover:text-white text-sm font-medium transition-colors"
            >
              Produkter
            </button>
            <Link href={`/s/${storefront.slug}/deals`}
              className="flex items-center gap-1 text-emerald-300 hover:text-white text-sm font-medium transition-colors">
              <Tag className="h-3.5 w-3.5" /> Erbjudanden
            </Link>
            <Link href={`/s/${storefront.slug}/blog`}
              className="flex items-center gap-1 text-emerald-300 hover:text-white text-sm font-medium transition-colors">
              <BookOpen className="h-3.5 w-3.5" /> Blogg
            </Link>
          </div>
          <button onClick={() => setShowCart(v => !v)}
            className="relative flex items-center gap-2 rounded-xl bg-amber-400 text-stone-900 px-4 py-2 text-sm font-bold hover:bg-amber-300 transition-colors shadow-md active:scale-95">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Varukorg</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 left-1/3 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-64 h-64 rounded-full bg-emerald-700/20 blur-2xl" />
        </div>
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-5" />
        )}

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Leaf className="h-3.5 w-3.5" /> {badge}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-none mb-4">
              {tagline || name}
            </h1>
            {description && (
              <p className="text-emerald-200 text-base sm:text-lg leading-relaxed max-w-lg mb-8">
                {description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mb-10">
              <button
                onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-2 rounded-full bg-amber-400 text-stone-900 px-6 py-3 text-sm font-bold hover:bg-amber-300 transition-colors shadow-lg active:scale-95"
              >
                {heroCta} <ArrowRight className="h-4 w-4" />
              </button>
              {liveOffers.length > 0 && (
                <button
                  onClick={() => document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" })}
                  className="flex items-center gap-2 rounded-full border border-white/25 text-white px-6 py-3 text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  {heroCtaSub}
                </button>
              )}
            </div>
            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
              <div>
                <p className="text-2xl font-extrabold text-white">{liveItems.length > 0 ? `${liveItems.length}+` : "∞"}</p>
                <p className="text-xs text-emerald-400 mt-0.5">{t.stat1Label}</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{s2v}</p>
                <p className="text-xs text-emerald-400 mt-0.5">{s2l}</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{s3v}</p>
                <p className="text-xs text-emerald-400 mt-0.5">{s3l}</p>
              </div>
            </div>
          </div>

          {/* Right: floating product cards (desktop) */}
          {liveItems.length > 0 && (
            <div className="hidden lg:flex items-center justify-center relative h-80">
              {/* Back card */}
              {liveItems.length > 1 && (
                <div className="absolute top-4 -left-4 w-52 bg-white/90 rounded-3xl p-4 shadow-xl -rotate-3 opacity-70 backdrop-blur-sm">
                  <div className="h-28 rounded-2xl bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center mb-3">
                    <span className="text-4xl">{liveItems[1].imageEmoji || "💊"}</span>
                  </div>
                  <p className="font-semibold text-stone-800 text-xs line-clamp-1">{liveItems[1].title}</p>
                  <p className="text-xs text-emerald-700 font-bold mt-1">{fmt(liveItems[1].discountPrice ?? liveItems[1].price, storeCurrency)}</p>
                </div>
              )}
              {/* Front card */}
              <div className="relative w-60 bg-white rounded-3xl p-5 shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500 z-10">
                <div className="h-36 rounded-2xl bg-gradient-to-br from-emerald-50 to-stone-100 flex items-center justify-center mb-4 overflow-hidden">
                  {liveItems[0].imageUrl
                    ? <img src={liveItems[0].imageUrl} alt={liveItems[0].title} className="w-full h-full object-cover" />
                    : <span className="text-6xl">{liveItems[0].imageEmoji || "🌿"}</span>}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-stone-900 text-sm line-clamp-1">{liveItems[0].title}</p>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{liveItems[0].shortDescription}</p>
                  </div>
                  <span className="shrink-0 text-[10px] bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-semibold whitespace-nowrap">⭐ Top</span>
                </div>
                <p className="text-sm font-bold text-emerald-700 mt-2">{fmt(liveItems[0].discountPrice ?? liveItems[0].price, storeCurrency)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-amber-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap justify-center gap-6 sm:gap-10">
          {trustPts.slice(0, 5).map((point, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-semibold text-stone-900">
              <span className="text-stone-800">{TRUST_POINTS[i]?.icon}</span>
              {point}
            </div>
          ))}
        </div>
      </div>

      {/* Membership join (scan-QR → become a member) — after hero, before products */}
      {(storefront.memberships?.length ?? 0) > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10">
          <MembershipJoinSection slug={storefront.slug} memberships={storefront.memberships ?? []} joinIntent={joinIntent} />
          {storefront.sellsGiftCards && <GiftCardBuySection slug={storefront.slug} currency={storefront.currency ?? ""} denominations={storefront.giftCardDenominations ?? []} message={storefront.giftCardMessage} />}
          {(storefront.rewards?.length ?? 0) > 0 && <LoyaltyRewardsSection slug={storefront.slug} currency={storefront.currency ?? ""} earnRate={storefront.loyaltyEarnRate} rewards={storefront.rewards ?? []} />}
        </div>
      )}

      {/* Category goal grid */}
      {showSection("categories") && <div className="bg-white border-b border-stone-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold text-stone-400 uppercase tracking-widest mb-5">{t.categoryTitle}</p>
          <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {WELLNESS_GOAL_CATEGORIES.map(cat => (
              <button
                key={cat.goalKey}
                onClick={() => {
                  setActiveGoal(cat.goalKey as GoalKey);
                  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  activeGoal === cat.goalKey
                    ? "bg-[#1a3a2b] border-[#1a3a2b] text-white shadow-md"
                    : "bg-white border-stone-200 text-stone-700 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
              >
                <span className="text-2xl sm:text-3xl">{cat.icon}</span>
                <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>}

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left: products */}
          <div className="flex-1 min-w-0">

            {/* Global subscription mode selector */}
            <div className="mb-8 relative overflow-hidden rounded-2xl p-5" style={{ backgroundColor: primaryColor }}>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-4 w-4 text-amber-400" />
                  <p className="text-sm font-bold text-white">{t.subSave}</p>
                </div>
                <p className="text-xs text-emerald-300 mb-4">{t.subDesc}</p>
                <div className="flex flex-wrap gap-2">
                  {SUBSCRIPTION_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => setSubInterval(opt.key)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                        subInterval === opt.key
                          ? "bg-amber-400 text-stone-900 shadow-md"
                          : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                      }`}>
                      {opt.label}{opt.discount > 0 ? ` −${opt.discount}%` : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Offers strip */}
            {liveOffers.length > 0 && (
              <div id="offers" className="mb-8">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">{t.offersTitle}</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {liveOffers.map(offer => (
                    <div key={offer.id} className="shrink-0 w-64 rounded-2xl p-5 shadow-md" style={{ backgroundColor: primaryColor }}>
                      <span className="text-xs font-bold bg-amber-400 text-stone-900 rounded-full px-2.5 py-0.5">
                        {offer.discountType === "percentage" ? `-${offer.discountValue}%` : `−${fmt(offer.discountValue ?? 0)}`}
                      </span>
                      <p className="mt-3 text-sm font-bold text-white">{offer.title}</p>
                      <p className="text-xs text-emerald-300 mt-1 line-clamp-2">{offer.description}</p>
                      {offer.code && (
                        <p className="mt-3 text-xs font-mono font-bold text-amber-400 bg-white/10 rounded-lg px-3 py-1.5 tracking-wider">{offer.code}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {showSection("events") && upcomingEvents.length > 0 && (
              <div id="events" className="mb-10">
                <h2 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: primaryColor }}>
                  {lang === "sv" ? "Kommande event" : "Upcoming Events"}
                </h2>
                <p className="text-sm text-stone-500 mb-4">
                  {lang === "sv" ? "Anmäl dig till våra workshops och evenemang" : "Register for our workshops and gatherings"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingEvents.map(ev => (
                    <Link key={ev.id} href={`/s/${storefront.slug}/events/${ev.id}`}
                      className="group bg-white rounded-2xl overflow-hidden border border-stone-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                      {/* Banner */}
                      {ev.imageUrl ? (
                        <div className="relative h-36 overflow-hidden">
                          <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          {ev.videoUrl && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                <ArrowRight className="h-5 w-5 text-stone-800" />
                              </div>
                            </div>
                          )}
                          <span className={`absolute top-3 left-3 text-[10px] font-bold rounded-full px-2.5 py-1 ${ev.isFree ? "bg-emerald-500 text-white" : "bg-amber-400 text-stone-900"}`}>
                            {ev.isFree ? (lang === "sv" ? "Gratis" : "Free") : `${ev.ticketPrice} kr`}
                          </span>
                        </div>
                      ) : (
                        <div className="h-20 flex items-center justify-between px-4" style={{ backgroundColor: primaryColor }}>
                          <div className="text-white">
                            <p className="text-2xl font-extrabold leading-none">{ev.date ? new Date(ev.date + "T00:00:00").getDate() : "—"}</p>
                            <p className="text-[10px] uppercase opacity-80">{ev.date ? new Date(ev.date + "T00:00:00").toLocaleDateString(lang === "sv" ? "sv-SE" : "en", { month: "short" }) : ""}</p>
                          </div>
                          <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${ev.isFree ? "bg-emerald-400 text-stone-900" : "bg-amber-400 text-stone-900"}`}>
                            {ev.isFree ? (lang === "sv" ? "Gratis" : "Free") : `${ev.ticketPrice} kr`}
                          </span>
                        </div>
                      )}
                      {/* Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-stone-900 text-sm leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">{ev.title}</h3>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-stone-500">
                          <span>{ev.date ? new Date(ev.date + "T00:00:00").toLocaleDateString(lang === "sv" ? "sv-SE" : "en", { day: "numeric", month: "short" }) : ""}</span>
                          <span>·</span>
                          <span>{ev.time}</span>
                          <span>·</span>
                          <span>{ev.isOnlineEvent ? (lang === "sv" ? "🌐 Online" : "🌐 Online") : `📍 ${ev.location || "TBC"}`}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color: primaryColor }}>
                          {lang === "sv" ? "Anmäl dig" : "Register"} <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Goal filter */}
            <div id="products" className="mb-4">
              <h2 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: primaryColor }}>{t.productsTitle}</h2>
              <p className="text-sm text-stone-500 mb-4">{t.productsSubtitle}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {GOALS.map((goal, idx) => (
                  <button key={goal.key} onClick={() => setActiveGoal(goal.key as GoalKey)}
                    className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all border border-stone-200 hover:border-stone-400"
                    style={activeGoal === goal.key ? { backgroundColor: primaryColor, color: "#fff", borderColor: primaryColor } : { backgroundColor: "#fff", color: "#44403c" }}>
                    {goal.icon} {goalLabels[idx] ?? goal.label}
                  </button>
                ))}
              </div>

              {/* Search + category */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {categories.length > 0 && (
                  <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                    <option value="">{t.allCategories}</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Product grid */}
            {visibleItems.length === 0 ? (
              <div className="text-center py-20 text-stone-400">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                  <Leaf className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-sm font-medium text-stone-500">{t.noProducts}</p>
                {(searchQuery || activeGoal !== "all" || activeCategory) && (
                  <button onClick={() => { setSearchQuery(""); setActiveGoal("all"); setActiveCategory(""); }}
                    className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-800 underline">{t.clearFilter}</button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleItems.map(item => (
                  <WellnessItemCard key={item.id} item={item} subInterval={subInterval}
                    onAdd={addToCart} onDetail={setDetailItem} />
                ))}
              </div>
            )}
          </div>

          {/* Right: cart (desktop) */}
          <div className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-20">
              <WellnessCartPanel
                cart={cart} items={liveItems} storefront={storefront}
                availability={availability} subInterval={subInterval} lang={lang}
                onAdd={addToCart} onRemove={removeFromCart} onClear={() => setCart({})}
              />
            </div>
          </div>
        </div>

        {/* Certification trust section */}
        <div className="mt-16 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ backgroundColor: primaryColor }}>
            <div>
              <h2 className="text-xl font-bold text-white">{t.certTitle}</h2>
              <p className="text-sm text-emerald-300 mt-1">{t.certSubtitle}</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold shrink-0">
              <Star className="h-4 w-4 text-amber-400" />
              {t.certBadge}
            </div>
          </div>
          <div className="bg-white p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CERTIFICATIONS.slice(0, 5).map(cert => (
              <div key={cert.key} className={`rounded-2xl p-4 text-center border border-opacity-30 ${cert.bg}`}>
                <p className="text-3xl mb-2">{cert.icon}</p>
                <p className="text-xs font-bold">{cert.label}</p>
                <p className="text-[10px] opacity-70 mt-1 leading-snug">{cert.tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Blog preview */}
      {showSection("blog") && FEATURED_BLOG_POSTS.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-[#1a3a2b] tracking-tight">Wellness-guider</h2>
              <p className="text-sm text-stone-500 mt-1">Expertartiklar om hälsa och naturliga produkter</p>
            </div>
            <Link href={`/s/${storefront.slug}/blog`}
              className="flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition-colors">
              Alla artiklar <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {FEATURED_BLOG_POSTS.map(post => (
              <Link key={post.slug} href={`/s/${storefront.slug}/blog/${post.slug}`}
                className="group bg-white rounded-2xl overflow-hidden border border-stone-100 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className={`h-40 bg-gradient-to-br ${post.gradientFrom} ${post.gradientTo} flex items-center justify-center`}>
                  <span className="text-6xl group-hover:scale-110 transition-transform duration-300 select-none">{post.imageEmoji}</span>
                </div>
                <div className="p-4">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">{post.category}</span>
                  <h3 className="font-bold text-stone-900 mt-2 leading-snug line-clamp-2 group-hover:text-[#1a3a2b] transition-colors text-sm">{post.title}</h3>
                  <p className="text-xs text-stone-500 mt-1.5 line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center gap-2 mt-3 text-[10px] text-stone-400">
                    <span>{post.author}</span>
                    <span>·</span>
                    <span>{post.readingTime} min läsning</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Newsletter */}
      {showSection("newsletter") && <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-[#1a3a2b] to-emerald-900 p-8 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          <div className="relative">
            <span className="text-4xl block mb-3">📬</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{nlHeadline}</h2>
            <p className="text-emerald-300 text-sm max-w-md mx-auto mb-6">
              {nlSubtext}
            </p>
            {newsletterDone ? (
              <div className="flex items-center justify-center gap-2 text-emerald-300 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Tack! Du är nu anmäld till vårt nyhetsbrev.
              </div>
            ) : (
              <form
                onSubmit={e => { e.preventDefault(); if (newsletterEmail) setNewsletterDone(true); }}
                className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto"
              >
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="email" required value={newsletterEmail}
                    onChange={e => setNewsletterEmail(e.target.value)}
                    placeholder="Din e-postadress"
                    className="w-full rounded-xl bg-white border-0 pl-9 pr-3 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-lg"
                  />
                </div>
                <button type="submit"
                  className="shrink-0 rounded-xl bg-amber-400 text-stone-900 px-6 py-3 text-sm font-bold hover:bg-amber-300 transition-colors shadow-md">
                  Prenumerera
                </button>
              </form>
            )}
            <p className="text-[10px] text-emerald-500 mt-3">Inga spam. Avregistrera dig när som helst.</p>
          </div>
        </div>
      </div>}

      {/* Cross-sell */}
      {pinnedItems.length > 0 ? (
        <section className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-stone-900">{lang === "sv" ? "Passar också bra ihop med" : "You May Also Love"}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinnedItems.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-stone-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{item.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900 text-sm leading-tight">{item.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{item.description}</p>
                    <p className="text-[11px] text-stone-400 mt-1">{item.businessName}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{item.type}</span>
                  <span className="text-sm font-bold text-stone-900">{item.price} {item.currency}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : getIndustryCapabilities(storefront.industry).crossSellCategories.length > 0 ? (
        <section className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-stone-900">{lang === "sv" ? "Utforska också" : "You May Also Love"}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {getIndustryCapabilities(storefront.industry).crossSellCategories.map((cat) => {
              const cfg = getIndustryStorefrontConfig(cat as never);
              return (
                <Link key={cat} href={`/moredealsx/businesses?industry=${encodeURIComponent(cat)}`}
                  className="flex items-center justify-between bg-white rounded-2xl border border-stone-200 p-4 hover:shadow-md transition-shadow group">
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">{cfg.label}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{cfg.primaryAction}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Footer */}
      <WellnessMarketplaceFooter storefront={storefront} />

      {/* Mobile cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden" onClick={() => setShowCart(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-stone-900">{t.cartTitle}</p>
              <button onClick={() => setShowCart(false)}><X className="h-5 w-5 text-stone-500" /></button>
            </div>
            <WellnessCartPanel
              cart={cart} items={liveItems} storefront={storefront}
              availability={availability} subInterval={subInterval} lang={lang}
              onAdd={addToCart} onRemove={removeFromCart} onClear={() => { setCart({}); setShowCart(false); }}
            />
          </div>
        </div>
      )}

      {/* Mobile cart FAB */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-6 inset-x-4 lg:hidden z-40">
          <button onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-emerald-700 text-white px-5 py-3.5 shadow-xl">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-bold">{cartCount} produkt{cartCount !== 1 ? "er" : ""}</span>
            </div>
            <span className="font-bold">
              {fmt(Object.entries(cart).reduce((s, [id, qty]) => {
                const item = liveItems.find(i => i.id === id);
                if (!item) return s;
                return s + applySubDiscount(item.discountPrice ?? item.price, subInterval) * qty;
              }, 0))}
            </span>
          </button>
        </div>
      )}

      {/* Product detail drawer */}
      {detailItem && (
        <ProductDetailDrawer
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onAdd={addToCart}
          currency={storeCurrency}
          subInterval={subInterval}
          onSubChange={setSubInterval}
        />
      )}
    </div>
  );
}
