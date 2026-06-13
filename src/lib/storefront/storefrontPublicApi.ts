/**
 * Public Storefront API Service
 * Used by /s/[slug] pages — customer-facing data only.
 * Never exposes cost price, supplier price, internal notes, or margins.
 *
 * Real endpoints (wire when backend ready):
 *   GET  /api/storefronts/:slug
 *   GET  /api/storefronts/:slug/categories
 *   GET  /api/storefronts/:slug/items
 *   GET  /api/storefronts/:slug/items/:itemSlug
 *   GET  /api/storefronts/:slug/offers
 *   GET  /api/storefronts/:slug/availability
 *   POST /api/storefronts/:slug/orders
 *   POST /api/storefronts/:slug/bookings
 */

// Wired to the PRODUCTION public storefront API (/api/v1/public/storefront/<schema>/).
// The source clients consume the rich PublicStorefront/PublicItem shape below; the
// helpers here fetch our leaner public endpoints and adapt the response to that
// shape (sensible defaults where our backend doesn't yet expose a field — these
// can be deepened later without touching the clients).
import { resolveApiV1Base } from "@/lib/apiBase";

// Owner draft-preview token from the current URL (?preview=…) — forwarded so a
// closed/draft store renders for the authenticated owner. Public visitors never
// have it.
function _previewQuery(): string {
  if (typeof window === "undefined") return "";
  const t = new URLSearchParams(window.location.search).get("preview");
  return t ? `?preview=${encodeURIComponent(t)}` : "";
}

async function _pubGet(path: string): Promise<any> {
  const res = await fetch(`${resolveApiV1Base()}${path}`, { headers: { Accept: "application/json" } });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) throw new Error(json?.message || `HTTP ${res.status}`);
  return json.data ?? json;
}

async function _pubPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${resolveApiV1Base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) throw new Error(json?.message || `HTTP ${res.status}`);
  return json.data ?? json;
}

// One bundle call returns storefronts + listings + capabilities + theme + events.
// Cache briefly so the 4 client fetches don't hit the API 4×.
let _bundleCache: { key: string; data: any; t: number } | null = null;
async function _bundle(schema: string): Promise<any> {
  const q = _previewQuery();
  const key = schema + q;
  if (_bundleCache && _bundleCache.key === key && Date.now() - _bundleCache.t < 5000) return _bundleCache.data;
  const data = await _pubGet(`/public/storefront/${encodeURIComponent(schema)}/${q}`);
  _bundleCache = { key, data, t: Date.now() };
  return data;
}

function _num(v: unknown): number { const n = Number(v); return isFinite(n) ? n : 0; }

function _orderTypes(b: any): string[] { return (b?.capabilities?.order_types as string[]) || []; }
function _bookingOpen(b: any): boolean { const bt = b?.capabilities?.booking_type; return !!bt && bt !== "none"; }

function _mapStorefront(b: any): PublicStorefront {
  const sf = (b.storefronts && b.storefronts[0]) || {};
  const ot = _orderTypes(b);
  return {
    slug: b.tenant_schema || sf.tenant_schema || "",
    name: sf.title || b.tenant_name || "",
    industry: b.industry || "",
    tagline: sf.tagline || "",
    description: sf.tagline || "",
    logoUrl: b.theme?.logo ?? null,
    faviconUrl: b.theme?.favicon ?? null,
    bannerUrl: null,
    primaryColor: b.theme?.accent || "#10b981",
    theme: "modern",
    layout: "grid",
    city: "", area: "", address: "",
    contactPhone: "", contactEmail: "",
    openingHours: {},
    enabledFeatures: [],
    visibleSections: [],
    rating: 0,
    reviewCount: 0,
    isPublished: true,
    deliveryEnabled: ot.includes("delivery"),
    pickupEnabled: ot.includes("pickup"),
    orderingEnabled: !!b.capabilities?.show_cart,
    bookingEnabled: _bookingOpen(b),
    galleryImages: [],
    sellsGiftCards: !!sf.sell_gift_cards,
    giftCardDenominations: Array.isArray(sf.gift_card_denominations)
      ? sf.gift_card_denominations.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [],
    giftCardMessage: sf.gift_card_message || "",
    loyaltyEnabled: !!sf.award_loyalty,
    loyaltyEarnRate: _num(sf.loyalty_points_per_unit),
    rewards: Array.isArray(b.rewards)
      ? b.rewards.map((r: any): PublicLoyaltyReward => ({
          id: String(r.id),
          name: r.name || "",
          description: r.description || "",
          pointsCost: _num(r.points_cost),
          rewardType: r.reward_type || "discount_percent",
          value: String(r.value ?? "0"),
        }))
      : [],
    memberships: Array.isArray(b.memberships)
      ? b.memberships.map((m: any): PublicMembershipPlan => ({
          id: String(m.id),
          name: m.name || "",
          description: m.description || "",
          price: String(m.price ?? "0"),
          currency: m.currency || sf.currency || "",
          interval: m.interval || "monthly",
          benefits: m.benefits || "",
          perks: Array.isArray(m.perks) ? m.perks.map((p: any) => String(p)) : [],
          memberDiscountPercent: Number(m.member_discount_percent ?? 0),
        }))
      : [],
  };
}

function _mapItem(l: any, b: any): PublicItem {
  const ot = _orderTypes(b);
  const ind = (b.industry || "").toLowerCase();
  const type: PublicItemType =
    ind.includes("restaurant") || ind.includes("fika") || ind.includes("coffee") || ind.includes("beer") || ind.includes("brew") ? "menu_item" :
    ind.includes("hotel") ? "room" :
    ind.includes("salon") || ind.includes("spa") || ind.includes("clean") || ind.includes("service") ? "service" :
    ind.includes("trek") || ind.includes("travel") || ind.includes("tour") || ind.includes("event") ? "package" : "product";
  return {
    id: String(l.id),
    slug: l.slug || String(l.id),
    type,
    title: l.title || "",
    shortDescription: String(l.description || "").slice(0, 140),
    description: l.description || "",
    price: _num(l.price),
    discountPrice: null,
    currency: l.currency || "SEK",
    category: l.category || "",
    imageEmoji: "",
    imageUrl: l.image_url || null,
    isFeatured: !!l.is_featured,
    badges: l.is_featured ? ["featured"] : [],
    availabilityStatus: l.in_stock === false ? "unavailable" : "available",
    orderingEnabled: !!b.capabilities?.show_cart,
    bookingEnabled: _bookingOpen(b),
    preorderEnabled: ot.includes("preorder"),
    deliveryEnabled: ot.includes("delivery"),
    pickupEnabled: ot.includes("pickup"),
    attributes: {},
  };
}

function _mapAvailability(b: any): PublicAvailability {
  const sf = (b.storefronts && b.storefronts[0]) || {};
  const ot = _orderTypes(b);
  return {
    orderingOpen: !!b.capabilities?.show_cart && !!sf.accept_orders,
    bookingOpen: _bookingOpen(b),
    deliveryAvailable: ot.includes("delivery"),
    pickupAvailable: ot.includes("pickup"),
    estimatedDeliveryTime: "",
    estimatedPickupTime: "",
    nextOpenTime: null,
    minimumOrderAmount: 0,
    deliveryFee: 0,
    deliveryAreas: [],
  };
}

// ─── Public Types ─────────────────────────────────────────────────────────────

export type PublicItemType = "product" | "service" | "room" | "menu_item" | "package" | "event" | "rental";
export type PublicOrderStatus = "pending" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled" | "refunded";
export type PublicBookingStatus = "requested" | "confirmed" | "rescheduled" | "completed" | "cancelled";
export type DeliveryMethod = "delivery" | "pickup" | "dine_in" | "inquiry" | "appointment";
export type PaymentMethod = "cash" | "card" | "online" | "later";

export interface PublicStorefront {
  id?: string;
  slug: string;
  name: string;
  industry: string;
  currency?: string;
  swishNumber?: string | null;
  announcement?: string;
  announcementVisible?: boolean;
  tagline: string;
  description: string;
  logoUrl: string | null;
  faviconUrl?: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  theme: string;
  layout: string;
  city: string;
  area: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  openingHours: Record<string, { open: string; close: string; closed?: boolean }>;
  enabledFeatures: string[];
  visibleSections: string[];
  rating: number;
  reviewCount: number;
  isPublished: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  orderingEnabled: boolean;
  bookingEnabled: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  galleryImages?: string[];
  social?: {
    facebook?: string; instagram?: string; tiktok?: string;
    youtube?: string; linkedin?: string; twitter?: string; website?: string;
  };
  /** Published membership plans a shopper can join on this store. */
  memberships?: PublicMembershipPlan[];
  /** Gift cards: whether the store sells them + the preset amounts + a blurb. */
  sellsGiftCards?: boolean;
  giftCardDenominations?: number[];
  giftCardMessage?: string;
  /** Loyalty: points earn rate + the rewards a customer can redeem points for. */
  loyaltyEnabled?: boolean;
  loyaltyEarnRate?: number;
  rewards?: PublicLoyaltyReward[];
}

/** A loyalty reward as a shopper sees it (redeem N points for this). */
export interface PublicLoyaltyReward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  rewardType: "discount_percent" | "discount_amount" | "gift_card";
  value: string;
}

/** A membership plan as a shopper sees it on the storefront. */
export interface PublicMembershipPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  interval: string;
  benefits: string;
  /** Structured "what you get" lines, rendered as a checklist on the card. */
  perks: string[];
  /** Automatic % off storefront orders for active members of this plan (0 = none). */
  memberDiscountPercent: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  itemCount: number;
  displayOrder: number;
}

export interface PublicItem {
  id: string;
  slug: string;
  type: PublicItemType;
  title: string;
  shortDescription: string;
  description: string;
  price: number;
  discountPrice: number | null;
  currency: string;
  category: string;
  imageEmoji: string;
  imageUrl: string | null;
  isFeatured: boolean;
  badges: string[];
  availabilityStatus: "available" | "limited" | "unavailable";
  orderingEnabled: boolean;
  bookingEnabled: boolean;
  preorderEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  visible?: boolean;
  attributes: Record<string, string | number | boolean | string[]>;
}

export interface PublicOffer {
  id: string;
  title: string;
  code: string;
  discountType: "percentage" | "fixed" | "bogo";
  discountValue: number;
  minOrderValue: number;
  startDate: string;
  endDate: string;
  description: string;
  visible?: boolean;
  imageEmoji?: string;
}

export interface PublicAvailability {
  orderingOpen: boolean;
  bookingOpen: boolean;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  estimatedDeliveryTime: string;
  estimatedPickupTime: string;
  nextOpenTime: string | null;
  minimumOrderAmount: number;
  deliveryFee: number;
  deliveryAreas: string[];
}

export interface OrderLineItem {
  itemId: string;
  title?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
}

export interface CreateOrderPayload {
  items: OrderLineItem[];
  deliveryMethod?: DeliveryMethod;
  deliveryAddress?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  preferredTime?: string;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  tax?: number;
  total?: number;
  paymentMethod?: PaymentMethod;
  couponCode?: string;
  orderSource?: "storefront" | "moredealsx";
  orderType?: string;
}

export interface CreateBookingPayload {
  itemId?: string;
  bookingType: "hotel" | "salon" | "trekking" | "event" | "service" | "rental" | "general";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  requestedDate: string;
  requestedTime?: string;
  startDatetime?: string;
  endDatetime?: string;
  quantity?: number;
  guests?: number;
  notes?: string;
  source?: "storefront" | "moredealsx";
}

export interface OrderConfirmation {
  id: string;
  orderNumber: string;
  status: PublicOrderStatus;
  estimatedTime?: string;
  message: string;
}

export interface BookingConfirmation {
  id: string;
  bookingRef: string;
  status: PublicBookingStatus;
  message: string;
}

// ─── Multi-industry Mock Data ──────────────────────────────────────────────────

const MOCK_STOREFRONTS: Record<string, PublicStorefront> = {
  "pokhara-food-house": {
    slug: "pokhara-food-house", name: "Pokhara Food House", industry: "Restaurant",
    tagline: "Authentic Nepali flavors since 2015",
    description: "We serve traditional Nepali and Indian cuisine made with fresh local ingredients. Dine in, takeaway, or order for delivery — experience the taste of real Nepal at Lakeside.",
    logoUrl: null, bannerUrl: null, primaryColor: "#e85d04", theme: "warm", layout: "grid",
    city: "Pokhara", area: "Lakeside", address: "Lakeside Marg, Pokhara-6",
    contactPhone: "+977-61-123456", contactEmail: "info@pokharafoodhouse.com",
    openingHours: {
      monday: { open: "07:00", close: "21:00" }, tuesday: { open: "07:00", close: "21:00" },
      wednesday: { open: "07:00", close: "21:00" }, thursday: { open: "07:00", close: "21:00" },
      friday: { open: "07:00", close: "22:00" }, saturday: { open: "08:00", close: "22:00" },
      sunday: { open: "08:00", close: "21:00" },
    },
    enabledFeatures: ["menu", "food_ordering", "pickup", "delivery", "offers", "table_booking"],
    visibleSections: ["menu", "offers", "booking", "about", "contact"],
    rating: 4.6, reviewCount: 218, isPublished: true,
    deliveryEnabled: true, pickupEnabled: true, orderingEnabled: true, bookingEnabled: true,
  },
  "lakeside-grand-hotel": {
    slug: "lakeside-grand-hotel", name: "Lakeside Grand Hotel", industry: "Hotel",
    tagline: "Your lakeside retreat in the heart of Pokhara",
    description: "A boutique lakeside hotel offering rooms, packages, spa, dining and local experiences from one trusted address.",
    logoUrl: null, bannerUrl: null, primaryColor: "#1d4ed8", theme: "modern", layout: "featured",
    city: "Pokhara", area: "Lakeside", address: "Baidam, Lakeside, Pokhara-6",
    contactPhone: "+977-61-234567", contactEmail: "reservations@lakesidegrand.com",
    openingHours: {
      monday: { open: "00:00", close: "23:59" }, tuesday: { open: "00:00", close: "23:59" },
      wednesday: { open: "00:00", close: "23:59" }, thursday: { open: "00:00", close: "23:59" },
      friday: { open: "00:00", close: "23:59" }, saturday: { open: "00:00", close: "23:59" },
      sunday: { open: "00:00", close: "23:59" },
    },
    enabledFeatures: ["rooms", "booking_inquiry", "packages", "experiences", "spa", "dining", "cross_sell"],
    visibleSections: ["rooms", "packages", "dining", "spa", "experiences", "contact"],
    rating: 4.8, reviewCount: 384, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: false, bookingEnabled: true,
  },
  "himalayan-trekking-nepal": {
    slug: "himalayan-trekking-nepal", name: "Himalayan Trekking Nepal", industry: "Trekking / Travel",
    tagline: "Book trusted trekking experiences with local experts",
    description: "Guided hikes, trekking packages and travel experiences sold directly and through partner hotels.",
    logoUrl: null, bannerUrl: null, primaryColor: "#059669", theme: "minimal", layout: "list",
    city: "Pokhara", area: "Lakeside", address: "Tourist Complex, Pokhara",
    contactPhone: "+977-61-345678", contactEmail: "info@himalayantrekking.com",
    openingHours: {
      monday: { open: "07:00", close: "19:00" }, tuesday: { open: "07:00", close: "19:00" },
      wednesday: { open: "07:00", close: "19:00" }, thursday: { open: "07:00", close: "19:00" },
      friday: { open: "07:00", close: "19:00" }, saturday: { open: "08:00", close: "18:00" },
      sunday: { open: "08:00", close: "17:00" },
    },
    enabledFeatures: ["packages", "booking_inquiry", "availability", "guides", "cross_sell"],
    visibleSections: ["packages", "day_trips", "guides", "availability", "reviews", "contact"],
    rating: 4.9, reviewCount: 521, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: false, bookingEnabled: true,
  },
  "glow-beauty-salon": {
    slug: "glow-beauty-salon", name: "Glow Beauty Salon", industry: "Salon / Spa",
    tagline: "Beauty, spa and bridal services you can trust",
    description: "Beauty, spa and bridal services cross-sold through hotels and fashion partners.",
    logoUrl: null, bannerUrl: null, primaryColor: "#db2777", theme: "warm", layout: "grid",
    city: "Pokhara", area: "Lakeside", address: "Lakeside Chowk, Pokhara",
    contactPhone: "+977-61-456789", contactEmail: "appointments@glowsalon.com",
    openingHours: {
      monday: { open: "09:00", close: "19:00" }, tuesday: { open: "09:00", close: "19:00" },
      wednesday: { open: "09:00", close: "19:00" }, thursday: { open: "09:00", close: "19:00" },
      friday: { open: "09:00", close: "20:00" }, saturday: { open: "09:00", close: "20:00" },
      sunday: { closed: true, open: "09:00", close: "17:00" },
    },
    enabledFeatures: ["services", "packages", "appointment_booking", "bridal", "offers"],
    visibleSections: ["services", "packages", "team", "offers", "contact"],
    rating: 4.7, reviewCount: 163, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: false, bookingEnabled: true,
  },
  "mountain-fashion-pokhara": {
    slug: "mountain-fashion-pokhara", name: "Mountain Fashion Pokhara", industry: "Clothing",
    tagline: "Travel-ready clothing and city fashion for every adventure",
    description: "Pokhara's go-to for trekking wear, city fashion, outdoor gear and travel essentials. Shop jackets, shoes, accessories and seasonal collections with fast delivery across the valley.",
    logoUrl: null, bannerUrl: null, primaryColor: "#1e293b", theme: "modern", layout: "grid",
    city: "Pokhara", area: "Mahendrapul", address: "Mahendrapul Bazaar, Pokhara-8",
    contactPhone: "+977-61-678901", contactEmail: "shop@mountainfashion.com",
    openingHours: {
      monday: { open: "09:30", close: "19:30" }, tuesday: { open: "09:30", close: "19:30" },
      wednesday: { open: "09:30", close: "19:30" }, thursday: { open: "09:30", close: "19:30" },
      friday: { open: "09:30", close: "20:00" }, saturday: { open: "09:00", close: "20:00" },
      sunday: { open: "10:00", close: "18:00" },
    },
    enabledFeatures: ["products", "cart", "delivery", "pickup", "offers", "new_arrivals"],
    visibleSections: ["products", "new_arrivals", "offers", "about", "contact"],
    rating: 4.5, reviewCount: 142, isPublished: true,
    deliveryEnabled: true, pickupEnabled: true, orderingEnabled: true, bookingEnabled: false,
  },
  "fresh-mart-pokhara": {
    slug: "fresh-mart-pokhara", name: "Fresh Mart Pokhara", industry: "Grocery",
    tagline: "Fresh groceries and daily essentials delivered to your door",
    description: "Your neighbourhood grocery store in Pokhara. Fresh produce, dairy, staples, household goods and daily essentials with same-day delivery. Hotel and restaurant bulk orders welcome.",
    logoUrl: null, bannerUrl: null, primaryColor: "#16a34a", theme: "warm", layout: "grid",
    city: "Pokhara", area: "New Road", address: "New Road Bazaar, Pokhara-9",
    contactPhone: "+977-61-789012", contactEmail: "orders@freshmartpokhara.com",
    openingHours: {
      monday: { open: "06:00", close: "20:00" }, tuesday: { open: "06:00", close: "20:00" },
      wednesday: { open: "06:00", close: "20:00" }, thursday: { open: "06:00", close: "20:00" },
      friday: { open: "06:00", close: "20:00" }, saturday: { open: "06:00", close: "20:00" },
      sunday: { open: "07:00", close: "19:00" },
    },
    enabledFeatures: ["grocery_cart", "delivery", "pickup", "daily_offers", "bulk_orders"],
    visibleSections: ["produce", "essentials", "daily_offers", "delivery_slots", "contact"],
    rating: 4.6, reviewCount: 203, isPublished: true,
    deliveryEnabled: true, pickupEnabled: true, orderingEnabled: true, bookingEnabled: false,
  },
  "pokhara-events-hub": {
    slug: "pokhara-events-hub", name: "Pokhara Events Hub", industry: "Events",
    tagline: "Tickets, events and unforgettable Pokhara experiences",
    description: "Book tickets for music nights, cultural shows, food festivals, workshops, adventure events and community gatherings across Pokhara. Official ticketing for lakeside and valley events.",
    logoUrl: null, bannerUrl: null, primaryColor: "#d97706", theme: "bold", layout: "featured",
    city: "Pokhara", area: "Lakeside", address: "Lakeside Event Ground, Pokhara-6",
    contactPhone: "+977-61-890123", contactEmail: "tickets@pokharaevents.com",
    openingHours: {
      monday: { open: "10:00", close: "18:00" }, tuesday: { open: "10:00", close: "18:00" },
      wednesday: { open: "10:00", close: "18:00" }, thursday: { open: "10:00", close: "18:00" },
      friday: { open: "10:00", close: "20:00" }, saturday: { open: "09:00", close: "22:00" },
      sunday: { open: "09:00", close: "22:00" },
    },
    enabledFeatures: ["events", "tickets", "booking", "group_tickets", "offers"],
    visibleSections: ["upcoming_events", "tickets", "past_events", "reviews", "contact"],
    rating: 4.4, reviewCount: 178, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: true, bookingEnabled: true,
  },
  "pokhara-local-services": {
    slug: "pokhara-local-services", name: "Pokhara Local Services", industry: "Local Services",
    tagline: "Trusted local services — transport, repairs, home help and more",
    description: "Verified local service providers across Pokhara. Airport pickups, bike repairs, plumbing, painting, home help, catering and general errands. Send a quote request and we'll respond within 2 hours.",
    logoUrl: null, bannerUrl: null, primaryColor: "#0d9488", theme: "minimal", layout: "list",
    city: "Pokhara", area: "Lakeside", address: "Pokhara Valley, Nepal",
    contactPhone: "+977-61-901234", contactEmail: "help@pokharalocalservices.com",
    openingHours: {
      monday: { open: "07:00", close: "20:00" }, tuesday: { open: "07:00", close: "20:00" },
      wednesday: { open: "07:00", close: "20:00" }, thursday: { open: "07:00", close: "20:00" },
      friday: { open: "07:00", close: "20:00" }, saturday: { open: "08:00", close: "18:00" },
      sunday: { open: "08:00", close: "17:00" },
    },
    enabledFeatures: ["service_packages", "inquiry_form", "quote_request", "booking"],
    visibleSections: ["services", "quote_request", "reviews", "service_area", "contact"],
    rating: 4.3, reviewCount: 89, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: false, bookingEnabled: true,
  },
  "secure-vision-pokhara": {
    slug: "secure-vision-pokhara", name: "Secure Vision Pokhara", industry: "CCTV & Security",
    tagline: "Professional CCTV, alarm and monitoring for homes and businesses",
    description: "Pokhara's trusted CCTV installation and security service. Supply, install and configure CCTV systems, alarm systems, access control and annual maintenance contracts. Serving hotels, restaurants, offices and homes since 2016.",
    logoUrl: null, bannerUrl: null, primaryColor: "#1e293b", theme: "professional", layout: "list",
    city: "Pokhara", area: "Prithvi Chowk", address: "Prithvi Chowk, Pokhara-5",
    contactPhone: "+977-61-012345", contactEmail: "info@securevision.com",
    openingHours: {
      monday: { open: "09:00", close: "18:00" }, tuesday: { open: "09:00", close: "18:00" },
      wednesday: { open: "09:00", close: "18:00" }, thursday: { open: "09:00", close: "18:00" },
      friday: { open: "09:00", close: "18:00" }, saturday: { open: "09:00", close: "16:00" },
      sunday: { closed: true, open: "10:00", close: "14:00" },
    },
    enabledFeatures: ["service_packages", "inquiry_form", "amc_contracts", "quote_request"],
    visibleSections: ["packages", "amc", "monitoring", "audit", "quote_request", "contact"],
    rating: 4.9, reviewCount: 67, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: false, bookingEnabled: true,
  },
  "techpro-solutions-pokhara": {
    slug: "techpro-solutions-pokhara", name: "TechPro Solutions Pokhara", industry: "IT Services",
    tagline: "Business IT support, networking and emergency help without long waits",
    description: "IT support, networking, device repair, cloud setup, cybersecurity and AMC plans for Pokhara businesses. Remote and on-site support. Fast response. Trusted by 100+ local businesses.",
    logoUrl: null, bannerUrl: null, primaryColor: "#4f46e5", theme: "modern", layout: "list",
    city: "Pokhara", area: "Lakeside", address: "Lakeside Tech Park, Pokhara-6",
    contactPhone: "+977-61-123450", contactEmail: "support@techpro.com",
    openingHours: {
      monday: { open: "08:00", close: "18:00" }, tuesday: { open: "08:00", close: "18:00" },
      wednesday: { open: "08:00", close: "18:00" }, thursday: { open: "08:00", close: "18:00" },
      friday: { open: "08:00", close: "18:00" }, saturday: { open: "09:00", close: "15:00" },
      sunday: { closed: true, open: "10:00", close: "13:00" },
    },
    enabledFeatures: ["it_services", "amc_plans", "remote_support", "quote_request", "emergency"],
    visibleSections: ["services", "amc_plans", "remote_support", "networking", "quote_request"],
    rating: 4.7, reviewCount: 112, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: false, bookingEnabled: true,
  },
  "sparkle-clean-pokhara": {
    slug: "sparkle-clean-pokhara", name: "Sparkle Clean Pokhara", industry: "Cleaning",
    tagline: "Reliable cleaning teams for homes, hotels, kitchens and offices",
    description: "Verified cleaning professionals for residential and commercial spaces. Deep cleaning, regular maintenance plans, hotel room turnover, kitchen sanitisation and office cleaning with checklist reports. Serving all Pokhara Valley.",
    logoUrl: null, bannerUrl: null, primaryColor: "#0891b2", theme: "minimal", layout: "list",
    city: "Pokhara", area: "Chipledhunga", address: "Chipledhunga, Pokhara-7",
    contactPhone: "+977-61-234501", contactEmail: "book@sparkleclean.com",
    openingHours: {
      monday: { open: "07:00", close: "18:00" }, tuesday: { open: "07:00", close: "18:00" },
      wednesday: { open: "07:00", close: "18:00" }, thursday: { open: "07:00", close: "18:00" },
      friday: { open: "07:00", close: "18:00" }, saturday: { open: "08:00", close: "17:00" },
      sunday: { closed: true, open: "09:00", close: "14:00" },
    },
    enabledFeatures: ["cleaning_services", "booking", "recurring_plans", "hotel_packages", "certificates"],
    visibleSections: ["services", "recurring_plans", "team", "certificates", "contact"],
    rating: 4.8, reviewCount: 134, isPublished: true,
    deliveryEnabled: false, pickupEnabled: false, orderingEnabled: false, bookingEnabled: true,
  },
  "pokhara-general-store": {
    slug: "pokhara-general-store", name: "Pokhara General Store", industry: "General Retail",
    tagline: "Everything you need, delivered fast across Pokhara",
    description: "A well-stocked general store with electronics, accessories, household goods, stationery, small appliances and gift items. Daily essentials with same-day delivery to Lakeside and surrounding areas.",
    logoUrl: null, bannerUrl: null, primaryColor: "#2563eb", theme: "modern", layout: "grid",
    city: "Pokhara", area: "Damside", address: "Damside Bazaar, Pokhara-8",
    contactPhone: "+977-61-345012", contactEmail: "shop@pokharageneral.com",
    openingHours: {
      monday: { open: "08:00", close: "20:00" }, tuesday: { open: "08:00", close: "20:00" },
      wednesday: { open: "08:00", close: "20:00" }, thursday: { open: "08:00", close: "20:00" },
      friday: { open: "08:00", close: "20:30" }, saturday: { open: "08:00", close: "20:30" },
      sunday: { open: "09:00", close: "19:00" },
    },
    enabledFeatures: ["products", "cart", "delivery", "pickup", "offers"],
    visibleSections: ["products", "deals", "bundles", "delivery", "contact"],
    rating: 4.4, reviewCount: 161, isPublished: true,
    deliveryEnabled: true, pickupEnabled: true, orderingEnabled: true, bookingEnabled: false,
  },
  "summit-wholesale-pokhara": {
    slug: "summit-wholesale-pokhara", name: "Summit Wholesale Pokhara", industry: "Supplier / Wholesale",
    tagline: "Reliable bulk supply for retailers, hotels, restaurants and institutions",
    description: "Wholesale supplier of FMCG, packaged goods, cleaning supplies and dry goods. Supplying Pokhara's hotels, restaurants, retailers and institutions since 2018. Competitive bulk pricing, same-day dispatch, MOQ from 5 units.",
    logoUrl: null, bannerUrl: null, primaryColor: "#d97706", theme: "professional", layout: "list",
    city: "Pokhara", area: "Industrial Area", address: "Rambazar Industrial Zone, Pokhara-11",
    contactPhone: "+977-61-567890", contactEmail: "orders@summitwholesale.com",
    openingHours: {
      monday: { open: "08:00", close: "18:00" }, tuesday: { open: "08:00", close: "18:00" },
      wednesday: { open: "08:00", close: "18:00" }, thursday: { open: "08:00", close: "18:00" },
      friday: { open: "08:00", close: "18:00" }, saturday: { open: "09:00", close: "16:00" },
      sunday: { closed: true, open: "09:00", close: "13:00" },
    },
    enabledFeatures: ["wholesale_catalogue", "bulk_ordering", "retailer_management", "invoicing", "delivery"],
    visibleSections: ["catalogue", "bulk_pricing", "moq_guide", "delivery_areas", "contact"],
    rating: 4.8, reviewCount: 94, isPublished: true,
    deliveryEnabled: true, pickupEnabled: true, orderingEnabled: true, bookingEnabled: false,
  },
};

const MOCK_ITEMS: Record<string, PublicItem[]> = {
  "pokhara-food-house": [
    { id: "pfh-1", slug: "momo-combo", type: "menu_item", title: "Momo Combo", shortDescription: "24 pcs steamed/fried momos with achar", description: "24 pieces of steamed or fried momos with spicy achar and fresh salad. A crowd favourite.", price: 450, discountPrice: 400, currency: "NPR", category: "Appetizers", imageEmoji: "🥟", imageUrl: null, isFeatured: true, badges: ["popular", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { prepTime: "15 min", spiceLevel: "Medium", diet: "Non-veg", serves: 2 } },
    { id: "pfh-2", slug: "thakali-set", type: "menu_item", title: "Thakali Set", shortDescription: "Complete Thakali meal with dal bhat", description: "Classic Nepali thakali meal: dal bhat, two curries, achar, papad and seasonal tarkari.", price: 650, discountPrice: null, currency: "NPR", category: "Mains", imageEmoji: "🍱", imageUrl: null, isFeatured: true, badges: ["popular"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { prepTime: "20 min", spiceLevel: "Mild", diet: "Non-veg", serves: 1 } },
    { id: "pfh-3", slug: "family-meal-deal", type: "menu_item", title: "Family Meal Deal", shortDescription: "Feeds 4–5 people, rice + dal + 2 veg + meat", description: "Serves 4–5 people. Rice, dal, 2 vegetables, meat curry, achar and salad.", price: 2200, discountPrice: 1900, currency: "NPR", category: "Family Packs", imageEmoji: "🍽️", imageUrl: null, isFeatured: true, badges: ["value", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { prepTime: "30 min", spiceLevel: "Mild", diet: "Non-veg", serves: 5 } },
    { id: "pfh-4", slug: "breakfast-combo", type: "menu_item", title: "Breakfast Combo", shortDescription: "Eggs, toast, tea and fresh juice", description: "Eggs any style, toast, masala chai and a fresh juice. Available 7–11 AM daily.", price: 280, discountPrice: null, currency: "NPR", category: "Breakfast", imageEmoji: "🍳", imageUrl: null, isFeatured: false, badges: ["morning"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: true, attributes: { prepTime: "10 min", spiceLevel: "None", diet: "Veg", serves: 1 } },
    { id: "pfh-5", slug: "veg-chowmein", type: "menu_item", title: "Veg Chowmein", shortDescription: "Stir-fried noodles with seasonal vegetables", description: "Wok-tossed egg noodles with seasonal vegetables and soy-chilli sauce.", price: 220, discountPrice: null, currency: "NPR", category: "Noodles", imageEmoji: "🍜", imageUrl: null, isFeatured: false, badges: ["veg"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { prepTime: "12 min", spiceLevel: "Medium", diet: "Veg", serves: 1 } },
    { id: "pfh-6", slug: "chicken-curry", type: "menu_item", title: "Chicken Curry", shortDescription: "Slow-cooked chicken in aromatic gravy", description: "Free-range chicken slow-cooked in aromatic spicy gravy, served with basmati rice.", price: 480, discountPrice: null, currency: "NPR", category: "Mains", imageEmoji: "🍛", imageUrl: null, isFeatured: false, badges: ["spicy"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { prepTime: "20 min", spiceLevel: "Hot", diet: "Non-veg", serves: 1 } },
  ],
  "lakeside-grand-hotel": [
    { id: "lgh-1", slug: "deluxe-lake-view-room", type: "room", title: "Deluxe Lake View Room", shortDescription: "Lake-facing room with king bed and balcony", description: "Spacious deluxe room with panoramic Phewa Lake views. King bed, private balcony, en-suite bathroom, AC and complimentary breakfast.", price: 8500, discountPrice: 7500, currency: "NPR", category: "Rooms", imageEmoji: "🏨", imageUrl: null, isFeatured: true, badges: ["popular", "lake view", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { roomType: "Deluxe", maxGuests: 2, beds: "1 King", amenities: ["AC", "WiFi", "TV", "Mini bar", "Balcony"], breakfastIncluded: true } },
    { id: "lgh-2", slug: "superior-mountain-view", type: "room", title: "Superior Mountain View", shortDescription: "Annapurna range views with twin beds", description: "Comfortable superior room with Annapurna mountain views. Twin beds, mountain-view window, en-suite bathroom and buffet breakfast.", price: 6500, discountPrice: null, currency: "NPR", category: "Rooms", imageEmoji: "🏔️", imageUrl: null, isFeatured: false, badges: ["mountain view"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { roomType: "Superior", maxGuests: 2, beds: "2 Twin", amenities: ["AC", "WiFi", "TV", "Hot water"], breakfastIncluded: true } },
    { id: "lgh-3", slug: "honeymoon-suite", type: "room", title: "Honeymoon Suite", shortDescription: "Private suite with jacuzzi and lake terrace", description: "Romantic lakeside suite with private jacuzzi, outdoor terrace, king bed, candlelight dinner arrangement and couples spa package.", price: 18000, discountPrice: 15500, currency: "NPR", category: "Suites", imageEmoji: "💑", imageUrl: null, isFeatured: true, badges: ["suite", "romantic", "offer"], availabilityStatus: "limited", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { roomType: "Suite", maxGuests: 2, beds: "1 King", amenities: ["Jacuzzi", "Private terrace", "Lake view", "Champagne", "Couples spa"], breakfastIncluded: true } },
    { id: "lgh-4", slug: "annapurna-trek-package", type: "package", title: "Annapurna Trek Package", shortDescription: "3-night stay + Annapurna Base Camp trek", description: "3-night stay at Lakeside Grand + guided Annapurna Base Camp trek with certified guide, meals on trail and gear rental.", price: 45000, discountPrice: 39000, currency: "NPR", category: "Packages", imageEmoji: "🏕️", imageUrl: null, isFeatured: true, badges: ["adventure", "all-inclusive", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "6 days / 3 nights", difficulty: "Moderate", groupSize: "2–8 people", includes: ["Hotel", "Guide", "Trail meals", "Gear"] } },
  ],
  "himalayan-trekking-nepal": [
    { id: "htn-1", slug: "abc-trek-10-days", type: "package", title: "Annapurna Base Camp (10 Days)", shortDescription: "Full ABC trek with guide, porter and meals", description: "10-day guided Annapurna Base Camp trek including certified guide, porter, teahouse accommodation, all meals on trail, trekking permit and TIMS card.", price: 85000, discountPrice: 75000, currency: "NPR", category: "Treks", imageEmoji: "🏔️", imageUrl: null, isFeatured: true, badges: ["bestseller", "all-inclusive", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "10 days", difficulty: "Moderate", groupSize: "1–12 people", includes: ["Guide", "Porter", "Meals", "Accommodation", "Permit", "TIMS"] } },
    { id: "htn-2", slug: "sarangkot-sunrise-day-trip", type: "package", title: "Sarangkot Sunrise Day Trip", shortDescription: "Guided sunrise hike to Sarangkot viewpoint", description: "Early morning guided hike to Sarangkot for the famous Annapurna sunrise view, then optional paragliding or return hike with breakfast.", price: 3500, discountPrice: null, currency: "NPR", category: "Day Trips", imageEmoji: "🌅", imageUrl: null, isFeatured: true, badges: ["popular", "morning"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "Half day", difficulty: "Easy", groupSize: "1–20 people", includes: ["Guide", "Breakfast"] } },
    { id: "htn-3", slug: "poon-hill-3-days", type: "package", title: "Poon Hill Trek (3 Days)", shortDescription: "Short Ghorepani trek with Himalaya views", description: "3-day Ghorepani Poon Hill trek — the perfect short Himalaya experience with incredible sunrise views over Dhaulagiri and Annapurna.", price: 28000, discountPrice: null, currency: "NPR", category: "Treks", imageEmoji: "🚶", imageUrl: null, isFeatured: false, badges: ["beginner-friendly"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "3 days", difficulty: "Easy", groupSize: "1–15 people", includes: ["Guide", "Porter", "Meals", "Lodge"] } },
  ],
  "glow-beauty-salon": [
    { id: "gbs-1", slug: "signature-facial", type: "service", title: "Signature Glow Facial", shortDescription: "60-min deep cleansing and brightening facial", description: "Our signature 60-minute facial with deep cleanse, steam, exfoliation, masque and hydrating serum. Leaves skin glowing.", price: 2800, discountPrice: 2400, currency: "NPR", category: "Skin Care", imageEmoji: "✨", imageUrl: null, isFeatured: true, badges: ["popular", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "60 min", staff: "Senior esthetician", gender: "All", addOns: ["Eye treatment", "Neck massage"] } },
    { id: "gbs-2", slug: "bridal-package", type: "package", title: "Complete Bridal Package", shortDescription: "Full bridal prep: hair, makeup, mehndi, facial", description: "Complete bridal preparation: professional makeup, hairstyling, mehndi design, facial, manicure and pedicure. Includes trial session.", price: 35000, discountPrice: 30000, currency: "NPR", category: "Bridal", imageEmoji: "💍", imageUrl: null, isFeatured: true, badges: ["bridal", "offer", "all-inclusive"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "Full day", staff: "Senior stylist + team", gender: "Female", addOns: ["Pre-wedding shoot prep", "Family makeup"] } },
    { id: "gbs-3", slug: "swedish-massage-60", type: "service", title: "Swedish Relaxation Massage", shortDescription: "60-min full body Swedish massage", description: "60-minute full body Swedish massage with aromatherapy oils. Relieves tension, improves circulation and promotes deep relaxation.", price: 3200, discountPrice: null, currency: "NPR", category: "Spa", imageEmoji: "💆", imageUrl: null, isFeatured: false, badges: ["relaxing"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "60 min", staff: "Certified therapist", gender: "All", addOns: ["Hot stone add-on", "Aromatherapy upgrade"] } },
    { id: "gbs-4", slug: "hair-cut-styling", type: "service", title: "Hair Cut & Styling", shortDescription: "Professional cut and blow-dry style", description: "Precision haircut, wash and blow-dry with professional styling. Includes scalp massage and heat protection.", price: 1200, discountPrice: null, currency: "NPR", category: "Hair", imageEmoji: "✂️", imageUrl: null, isFeatured: false, badges: ["everyday"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { duration: "45 min", staff: "Senior stylist", gender: "All", addOns: ["Deep conditioning", "Colour treatment"] } },
  ],
  "mountain-fashion-pokhara": [
    { id: "mfp-1", slug: "lightweight-trek-jacket", type: "product", title: "Lightweight Trek Jacket", shortDescription: "Water-resistant jacket for mountain and city", description: "Packable water-resistant jacket. Works as a windbreaker on treks or a city layer. Adjustable hood, two zip pockets.", price: 3800, discountPrice: 3200, currency: "NPR", category: "Jackets", imageEmoji: "🧥", imageUrl: null, isFeatured: true, badges: ["bestseller", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sizes: ["S","M","L","XL"], colors: ["Olive","Black","Navy"], material: "Water-resistant nylon", fit: "Regular", season: "All year", returnPolicy: "7 days" } },
    { id: "mfp-2", slug: "comfort-travel-shoes", type: "product", title: "Comfort Travel Shoes", shortDescription: "Breathable everyday shoes for long walks", description: "Lightweight mesh shoes with cushioned insole. Ideal for city walks, light hiking and daily travel.", price: 4500, discountPrice: null, currency: "NPR", category: "Shoes", imageEmoji: "👟", imageUrl: null, isFeatured: true, badges: ["popular"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sizes: ["38","39","40","41","42","43"], colors: ["Brown","Black","Grey"], material: "Breathable mesh", fit: "True to size", season: "All season", returnPolicy: "Exchange only" } },
    { id: "mfp-3", slug: "trekking-wear-bundle", type: "product", title: "Trekking Wear Bundle", shortDescription: "Layered fleece + shell for high altitude", description: "Complete layering bundle: fleece mid-layer and shell outer. Trusted by trekkers on Annapurna and Poon Hill trails.", price: 8500, discountPrice: 7200, currency: "NPR", category: "Trekking Wear", imageEmoji: "🏔️", imageUrl: null, isFeatured: true, badges: ["adventure", "offer", "bundle"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sizes: ["M","L","XL"], colors: ["Graphite","Forest"], material: "Fleece + shell", fit: "Layered", season: "High altitude", returnPolicy: "7 days unused" } },
    { id: "mfp-4", slug: "city-casual-tshirt", type: "product", title: "City Casual T-Shirt 3-Pack", shortDescription: "Soft cotton tees in 3 neutral colours", description: "Pack of 3 cotton T-shirts in black, white and grey. Comfortable, breathable and machine washable.", price: 1800, discountPrice: null, currency: "NPR", category: "Casual Wear", imageEmoji: "👕", imageUrl: null, isFeatured: false, badges: ["value"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sizes: ["S","M","L","XL","XXL"], colors: ["Black + White + Grey"], material: "100% cotton", fit: "Regular", season: "All year", returnPolicy: "7 days" } },
    { id: "mfp-5", slug: "trekking-backpack-45l", type: "product", title: "Trekking Backpack 45L", shortDescription: "Durable 45L backpack with rain cover", description: "45-litre trekking backpack with padded shoulder straps, hip belt, rain cover and multiple compartments. Tested on Himalayan trails.", price: 6200, discountPrice: 5500, currency: "NPR", category: "Accessories", imageEmoji: "🎒", imageUrl: null, isFeatured: false, badges: ["popular", "offer"], availabilityStatus: "limited", orderingEnabled: true, bookingEnabled: false, preorderEnabled: true, deliveryEnabled: true, pickupEnabled: true, attributes: { sizes: ["45L"], colors: ["Red","Blue","Black"], material: "600D polyester", fit: "Unisex", season: "All season", returnPolicy: "7 days unused" } },
  ],
  "fresh-mart-pokhara": [
    { id: "fmp-1", slug: "fresh-vegetable-box-4kg", type: "product", title: "Fresh Vegetable Box 4kg", shortDescription: "Seasonal mixed veg picked today — morning delivery", description: "Daily-picked seasonal vegetables from local Pokhara farms. Mixed box of 4kg — tomatoes, potatoes, onions, greens and seasonal produce. Available for morning delivery before 10 AM.", price: 480, discountPrice: 420, currency: "NPR", category: "Produce", imageEmoji: "🥦", imageUrl: null, isFeatured: true, badges: ["fresh", "local", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { unit: "box", weight: "4 kg", origin: "Pokhara farms", freshness: "Picked today", expiryDate: "Use within 3 days", organic: true, deliveryWindow: "Before 10 AM" } },
    { id: "fmp-2", slug: "dairy-breakfast-pack", type: "product", title: "Dairy Breakfast Pack", shortDescription: "Milk + curd + butter + eggs + bread", description: "Everything for a complete breakfast: 1L full-cream milk, 500ml curd, 200g butter, 6 eggs and a loaf of bread. Fresh daily from local dairy.", price: 680, discountPrice: null, currency: "NPR", category: "Dairy", imageEmoji: "🥛", imageUrl: null, isFeatured: true, badges: ["popular", "morning"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { unit: "bundle", weight: "Family pack", origin: "Local dairy", freshness: "Fresh today", expiryDate: "2 days", organic: false, deliveryWindow: "Before 9 AM" } },
    { id: "fmp-3", slug: "basmati-rice-5kg", type: "product", title: "Basmati Rice 5kg", shortDescription: "Premium long-grain rice sealed pack", description: "Premium long-grain basmati rice in a sealed 5kg bag. Fluffy, aromatic and consistent quality. Used by Pokhara's top hotels and home cooks.", price: 980, discountPrice: null, currency: "NPR", category: "Staples", imageEmoji: "🌾", imageUrl: null, isFeatured: false, badges: ["popular"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { unit: "bag", weight: "5 kg", origin: "Nepal / India", freshness: "Sealed pack", expiryDate: "Nov 2026", organic: false, deliveryWindow: "Same-day" } },
    { id: "fmp-4", slug: "instant-noodles-bulk-24", type: "product", title: "Instant Noodles Bulk Pack (24 pcs)", shortDescription: "Wai Wai mixed flavour — 24 packets", description: "Pack of 24 Wai Wai instant noodles in mixed flavours. A Nepali staple. Great for trekking supply and student hostels.", price: 520, discountPrice: 480, currency: "NPR", category: "Snacks", imageEmoji: "🍜", imageUrl: null, isFeatured: false, badges: ["bulk", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { unit: "pack", weight: "24 × 75g", origin: "Nepal", freshness: "Sealed", expiryDate: "Jan 2027", organic: false, deliveryWindow: "Same-day" } },
    { id: "fmp-5", slug: "cooking-oil-5l", type: "product", title: "Sunflower Cooking Oil 5L", shortDescription: "Clean light cooking oil in 5L tin", description: "Light, neutral-flavoured sunflower oil for everyday cooking. 5L tin — ideal for families and small restaurants.", price: 1050, discountPrice: null, currency: "NPR", category: "Staples", imageEmoji: "🫙", imageUrl: null, isFeatured: false, badges: ["everyday"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { unit: "tin", weight: "5L", origin: "India", freshness: "Sealed", expiryDate: "Dec 2026", organic: false, deliveryWindow: "Same-day" } },
  ],
  "pokhara-events-hub": [
    { id: "peh-1", slug: "lakeside-music-night", type: "event", title: "Lakeside Music Night", shortDescription: "Live music at the Lakeside terrace — Fri & Sat", description: "Weekly live music nights at the Lakeside open-air terrace. Local and touring artists, drinks available. Doors open at 6:30 PM.", price: 800, discountPrice: 600, currency: "NPR", category: "Music", imageEmoji: "🎵", imageUrl: null, isFeatured: true, badges: ["popular", "weekend", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { date: "Every Fri & Sat", time: "7:00 PM – 10:30 PM", capacity: "120 guests", venue: "Lakeside Terrace, Pokhara-6" } },
    { id: "peh-2", slug: "paragliding-sunset-slot", type: "event", title: "Paragliding Sunset Slot", shortDescription: "Tandem paragliding from Sarangkot — sunset launch", description: "Tandem paragliding from Sarangkot hill during the golden hour. Panoramic views of Phewa Lake and Annapurna. 20-30 min flight. Certified pilots.", price: 7500, discountPrice: 6500, currency: "NPR", category: "Adventure", imageEmoji: "🪂", imageUrl: null, isFeatured: true, badges: ["adventure", "popular", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { date: "Daily (weather permitting)", time: "3:30 PM – 5:30 PM", capacity: "8 slots", venue: "Sarangkot, Pokhara" } },
    { id: "peh-3", slug: "cooking-workshop-nepali", type: "event", title: "Nepali Cooking Workshop", shortDescription: "Learn to cook traditional Nepali dishes", description: "3-hour hands-on workshop. Cook momo, dal bhat, gundruk and sel roti with a local chef. Includes ingredients and a full sit-down meal after.", price: 2500, discountPrice: null, currency: "NPR", category: "Workshop", imageEmoji: "🍱", imageUrl: null, isFeatured: false, badges: ["cultural", "hands-on"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { date: "Tue, Thu, Sat", time: "10:00 AM – 1:00 PM", capacity: "12 guests", venue: "Lakeside Kitchen Studio" } },
    { id: "peh-4", slug: "pokhara-film-screening", type: "event", title: "Pokhara Film Screening — Outdoor Cinema", shortDescription: "Outdoor cinema under the Annapurna stars", description: "Monthly outdoor film screening at Fewa Lake park. International and Nepali films with subtitles. Bean bags, blankets, popcorn and beverages available.", price: 400, discountPrice: null, currency: "NPR", category: "Community", imageEmoji: "🎬", imageUrl: null, isFeatured: false, badges: ["community", "relaxed"], availabilityStatus: "limited", orderingEnabled: true, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { date: "Last Saturday of month", time: "6:30 PM", capacity: "60 guests", venue: "Fewa Lake Park" } },
  ],
  "pokhara-local-services": [
    { id: "pls-1", slug: "airport-transfer", type: "service", title: "Airport Transfer", shortDescription: "Private car from Pokhara airport to any hotel", description: "Reliable private transfer from Pokhara Regional Airport to your hotel or guesthouse. AC car, meet and greet, luggage assistance.", price: 1200, discountPrice: null, currency: "NPR", category: "Transport", imageEmoji: "🚗", imageUrl: null, isFeatured: true, badges: ["popular", "reliable"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { serviceArea: "Pokhara Airport → Any location", responseTime: "On arrival", availability: "Daily 6 AM – 10 PM", included: ["Driver", "Luggage help", "AC car"] } },
    { id: "pls-2", slug: "plumbing-repair", type: "service", title: "Plumbing Repair", shortDescription: "Leaks, taps, pipes and drainage — same day", description: "Emergency and scheduled plumbing repairs. Leaking taps, blocked drains, pipe repairs, tank installation and bathroom fitting.", price: 800, discountPrice: null, currency: "NPR", category: "Repairs", imageEmoji: "🔧", imageUrl: null, isFeatured: true, badges: ["emergency", "verified"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { serviceArea: "Pokhara Valley", responseTime: "2–4 hours", availability: "7 days a week", included: ["Labour", "Basic parts"] } },
    { id: "pls-3", slug: "catering-service-50pax", type: "service", title: "Event Catering (up to 50 pax)", shortDescription: "Full catering for parties, meetings, weddings", description: "Complete catering for 25–50 people. Menu planning, cooking, serving and cleanup. Nepali, Indian and continental options.", price: 35000, discountPrice: 30000, currency: "NPR", category: "Home Services", imageEmoji: "🍽️", imageUrl: null, isFeatured: false, badges: ["offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { serviceArea: "Pokhara and surroundings", responseTime: "Book 48 hrs ahead", availability: "By appointment", included: ["Chef", "Staff", "Equipment", "Cleanup"] } },
  ],
  "secure-vision-pokhara": [
    { id: "svp-1", slug: "4-camera-cctv-package", type: "service", title: "4-Camera CCTV Package", shortDescription: "Supply, install and configure 4 HD cameras", description: "Complete CCTV installation: 4 HD cameras, DVR unit, cables, mobile app access and 1-year warranty. Covers entrances, parking and key areas.", price: 28000, discountPrice: 24000, currency: "NPR", category: "CCTV", imageEmoji: "📷", imageUrl: null, isFeatured: true, badges: ["popular", "offer", "turnkey"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { cameraCount: 4, monitoring: "Mobile app (Android/iOS)", warranty: "1 year parts + labour", amc: true } },
    { id: "svp-2", slug: "8-camera-hotel-package", type: "service", title: "8-Camera Hotel Security Package", shortDescription: "Full hotel CCTV with reception, floors and parking", description: "8-camera hotel security package covering lobby, floors, parking and service areas. Includes NVR, remote monitoring, night vision and 6-month AMC.", price: 65000, discountPrice: 58000, currency: "NPR", category: "CCTV", imageEmoji: "🏨", imageUrl: null, isFeatured: true, badges: ["hotel-grade", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { cameraCount: 8, monitoring: "Remote + on-site", warranty: "2 years", amc: true } },
    { id: "svp-3", slug: "amc-annual-contract", type: "service", title: "Annual Maintenance Contract", shortDescription: "Quarterly inspection + emergency support all year", description: "12-month AMC for any existing CCTV system. Quarterly inspection, cleaning, firmware updates, emergency callout within 4 hours.", price: 12000, discountPrice: null, currency: "NPR", category: "AMC", imageEmoji: "🛡️", imageUrl: null, isFeatured: false, badges: ["support", "annual"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { cameraCount: 0, monitoring: "Quarterly visits", warranty: "Covered under AMC", amc: true } },
  ],
  "techpro-solutions-pokhara": [
    { id: "tsp-1", slug: "small-biz-it-amc", type: "service", title: "Small Business IT AMC", shortDescription: "Monthly IT support — up to 10 devices", description: "Monthly IT AMC for small businesses. Covers up to 10 devices, office Wi-Fi, backups, antivirus, urgent support within next business day. Remote + on-site.", price: 6500, discountPrice: 5500, currency: "NPR", category: "AMC", imageEmoji: "💻", imageUrl: null, isFeatured: true, badges: ["popular", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { sla: "Next business day", remoteSupport: true, devices: 10, coverage: "Devices + Wi-Fi + backups" } },
    { id: "tsp-2", slug: "network-setup-office", type: "service", title: "Office Network Setup", shortDescription: "Full wired + wireless office network installation", description: "Complete office network setup: structured cabling, router/switch configuration, Wi-Fi AP placement, VPN and firewall setup.", price: 18000, discountPrice: 15000, currency: "NPR", category: "Networking", imageEmoji: "📡", imageUrl: null, isFeatured: true, badges: ["offer", "certified"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { sla: "3–5 business days", remoteSupport: false, devices: 0, coverage: "Full office network" } },
    { id: "tsp-3", slug: "device-repair-walk-in", type: "service", title: "Device Repair (Walk-in)", shortDescription: "Laptops, phones, printers — same-day diagnosis", description: "Walk-in device repair: laptops, phones, tablets, printers and desktop computers. Free diagnosis, transparent quote before repair begins.", price: 500, discountPrice: null, currency: "NPR", category: "Repair", imageEmoji: "🔌", imageUrl: null, isFeatured: false, badges: ["walk-in", "transparent"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { sla: "Same-day diagnosis", remoteSupport: true, devices: 1, coverage: "Laptops, phones, printers, desktops" } },
    { id: "tsp-4", slug: "hotel-it-package", type: "service", title: "Hotel IT Package", shortDescription: "Full hotel IT support — POS, Wi-Fi, NAS, CCTV integration", description: "Complete IT setup and support for hotels. POS system, property Wi-Fi (multi-floor), NAS backup, CCTV system integration, firewall and 12-month AMC.", price: 85000, discountPrice: 75000, currency: "NPR", category: "AMC", imageEmoji: "🏨", imageUrl: null, isFeatured: false, badges: ["hotel-grade", "all-inclusive", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { sla: "4-hour emergency response", remoteSupport: true, devices: 0, coverage: "Full hotel IT infrastructure" } },
  ],
  "sparkle-clean-pokhara": [
    { id: "scp-1", slug: "home-deep-clean", type: "service", title: "Home Deep Clean", shortDescription: "Full home deep cleaning — up to 1,000 sq ft", description: "Complete home deep cleaning with trained team. Includes all rooms, kitchen, bathroom scrubbing, floor mopping, dusting and surface sanitisation. Supplies included. Checklist report provided.", price: 5500, discountPrice: 4800, currency: "NPR", category: "Home", imageEmoji: "🏠", imageUrl: null, isFeatured: true, badges: ["popular", "offer", "certified"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { areaSize: "Up to 1,000 sq ft", frequency: "One-time", teamSize: 3, suppliesIncluded: true, certificate: "Checklist report" } },
    { id: "scp-2", slug: "hotel-room-turnover", type: "service", title: "Hotel Room Turnover Service", shortDescription: "Professional room cleaning between guest stays", description: "Fast and thorough hotel room cleaning between checkouts and check-ins. Linen change, bathroom sanitisation, surface wipe-down, amenity restocking. ISO cleaning checklist.", price: 800, discountPrice: null, currency: "NPR", category: "Hotel", imageEmoji: "🛏️", imageUrl: null, isFeatured: true, badges: ["hotel-grade", "fast"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: false, deliveryEnabled: false, pickupEnabled: false, attributes: { areaSize: "Per room", frequency: "Per turnover", teamSize: 2, suppliesIncluded: true, certificate: "ISO checklist" } },
    { id: "scp-3", slug: "kitchen-sanitisation", type: "service", title: "Restaurant Kitchen Sanitisation", shortDescription: "Deep kitchen clean — grease, exhaust, tiles and equipment", description: "Professional restaurant kitchen sanitisation. Grease removal from exhaust hoods, equipment deep clean, tile scrubbing and floor sanitisation. HACCP-compliant cleaning protocols.", price: 9500, discountPrice: 8200, currency: "NPR", category: "Kitchen", imageEmoji: "🍳", imageUrl: null, isFeatured: false, badges: ["HACCP", "offer"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { areaSize: "Full commercial kitchen", frequency: "One-time / Monthly", teamSize: 4, suppliesIncluded: true, certificate: "HACCP cleaning certificate" } },
    { id: "scp-4", slug: "monthly-office-plan", type: "service", title: "Monthly Office Cleaning Plan", shortDescription: "Regular daily/weekly office cleaning contract", description: "Monthly office cleaning contract. Daily trash removal, floor sweeping and mopping, surface wipe-down, bathroom cleaning. Flexible schedule — morning or evening.", price: 12000, discountPrice: null, currency: "NPR", category: "Office", imageEmoji: "🏢", imageUrl: null, isFeatured: false, badges: ["recurring", "contract"], availabilityStatus: "available", orderingEnabled: false, bookingEnabled: true, preorderEnabled: true, deliveryEnabled: false, pickupEnabled: false, attributes: { areaSize: "Up to 2,000 sq ft", frequency: "Daily / 5× per week", teamSize: 2, suppliesIncluded: true, certificate: "Monthly report" } },
  ],
  "pokhara-general-store": [
    { id: "pgs-1", slug: "power-bank-20000", type: "product", title: "Power Bank 20,000mAh", shortDescription: "Dual USB + USB-C fast charging power bank", description: "20,000mAh portable charger with dual USB-A and one USB-C port. Fast charge compatible. Essential for trekking, travel and frequent power cuts.", price: 2800, discountPrice: 2400, currency: "NPR", category: "Electronics", imageEmoji: "🔋", imageUrl: null, isFeatured: true, badges: ["popular", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sku: "PB-20K-01", brand: "Anker / local", stock: 24, warranty: "6 months" } },
    { id: "pgs-2", slug: "usb-led-desk-lamp", type: "product", title: "USB LED Desk Lamp", shortDescription: "Adjustable brightness — 3 colour modes", description: "USB-powered desk lamp with 3 brightness levels and 3 colour temperatures. Foldable arm, touch control. Works with power bank, laptop or USB adapter.", price: 1200, discountPrice: null, currency: "NPR", category: "Electronics", imageEmoji: "💡", imageUrl: null, isFeatured: false, badges: ["everyday"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sku: "LED-DL-02", brand: "Generic", stock: 38, warranty: "3 months" } },
    { id: "pgs-3", slug: "stainless-water-bottle-1l", type: "product", title: "Stainless Steel Water Bottle 1L", shortDescription: "Double-wall insulated — keeps cold 24h, hot 12h", description: "1-litre double-wall stainless steel bottle with leak-proof lid. Keeps drinks cold for 24 hours and hot for 12. BPA-free. Perfect for treks and daily use.", price: 1500, discountPrice: 1300, currency: "NPR", category: "Accessories", imageEmoji: "🫙", imageUrl: null, isFeatured: true, badges: ["popular", "offer", "eco"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sku: "BTL-SS-1L", brand: "Local", stock: 52, warranty: "1 year" } },
    { id: "pgs-4", slug: "stationery-bundle", type: "product", title: "Office Stationery Bundle", shortDescription: "Pens, notebooks, folders, tape and sticky notes", description: "Complete office stationery set: 10 ballpoint pens, 2 A4 notebooks, 5 folders, sticky notes, tape dispenser and highlighters.", price: 850, discountPrice: null, currency: "NPR", category: "Stationery", imageEmoji: "📝", imageUrl: null, isFeatured: false, badges: ["bundle"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { sku: "STAT-BUNDLE", brand: "Mixed", stock: 30, warranty: "N/A" } },
  ],
  "summit-wholesale-pokhara": [
    { id: "swp-1", slug: "basmati-rice-50kg", type: "product", title: "Basmati Rice 50kg Sack", shortDescription: "Premium long-grain basmati — MOQ 10 sacks", description: "Restaurant and hotel-grade basmati rice in 50kg wholesale sacks. FSSAI certified, consistent grain quality. Minimum order 10 sacks. Same-day dispatch.", price: 8400, discountPrice: 7350, currency: "NPR", category: "Staples", imageEmoji: "🌾", imageUrl: null, isFeatured: true, badges: ["bestseller", "bulk", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: true, deliveryEnabled: true, pickupEnabled: true, attributes: { moq: 10, unit: "50 kg sack", bulkPrice: "NPR 735/sack (10+)", leadTime: "Same day", origin: "Nepal / India", certification: "FSSAI" } },
    { id: "swp-2", slug: "sunflower-oil-20l", type: "product", title: "Sunflower Cooking Oil 20L", shortDescription: "Restaurant-grade cooking oil — MOQ 20 tins", description: "High-quality sunflower cooking oil used by Pokhara's top hotels and restaurants. 20L food-grade tins. Halal and FSSAI certified.", price: 3360, discountPrice: null, currency: "NPR", category: "FMCG", imageEmoji: "🫙", imageUrl: null, isFeatured: true, badges: ["popular"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: true, deliveryEnabled: true, pickupEnabled: true, attributes: { moq: 20, unit: "20L tin", bulkPrice: "NPR 3,360/tin (20+)", leadTime: "Next day", origin: "India", certification: "FSSAI, Halal" } },
    { id: "swp-3", slug: "hotel-cleaning-bundle", type: "product", title: "Hotel Cleaning Supply Bundle", shortDescription: "Monthly cleaning essentials for hotels — MOQ 5 bundles", description: "Hotel-grade monthly cleaning bundle: floor cleaner 5L, disinfectant 5L, glass cleaner 2L, detergent 5kg. ISO 9001 certified. Trusted by Lakeside hotels.", price: 6560, discountPrice: 5700, currency: "NPR", category: "Cleaning Supplies", imageEmoji: "🧴", imageUrl: null, isFeatured: true, badges: ["hotel-approved", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { moq: 5, unit: "bundle/month", bulkPrice: "NPR 5,700/bundle (5+)", leadTime: "Same day", origin: "Nepal", certification: "ISO 9001" } },
    { id: "swp-4", slug: "disposable-containers-bulk", type: "product", title: "Disposable Food Containers (1000 pcs)", shortDescription: "Restaurant takeaway containers — MOQ 10 packs", description: "Food-safe PP disposable containers with lids, 500ml. Used by restaurants for delivery and takeaway packaging. Microwave-safe.", price: 2800, discountPrice: null, currency: "NPR", category: "Packaging", imageEmoji: "📦", imageUrl: null, isFeatured: false, badges: ["food-safe"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: false, deliveryEnabled: true, pickupEnabled: true, attributes: { moq: 10, unit: "1000 pcs pack", bulkPrice: "NPR 2,800/pack", leadTime: "Next day", origin: "Nepal / China", certification: "Food-safe PP" } },
    { id: "swp-5", slug: "tea-leaves-25kg", type: "product", title: "Premium Tea Leaves 25kg", shortDescription: "Ilam tea — hotels, restaurants, cafes — MOQ 5 bags", description: "Aromatic Ilam valley tea leaves in 25kg bags. Strong brew favoured by Pokhara's hospitality businesses. Perfect for restaurants and hotels serving Nepali masala chai.", price: 14000, discountPrice: 12500, currency: "NPR", category: "Beverages", imageEmoji: "🍵", imageUrl: null, isFeatured: false, badges: ["local", "offer"], availabilityStatus: "available", orderingEnabled: true, bookingEnabled: false, preorderEnabled: true, deliveryEnabled: true, pickupEnabled: true, attributes: { moq: 5, unit: "25 kg bag", bulkPrice: "NPR 12,500/bag (5+)", leadTime: "1–2 days", origin: "Ilam, Nepal", certification: "Organic-pending" } },
  ],
};

const MOCK_OFFERS: Record<string, PublicOffer[]> = {
  "pokhara-food-house": [
    { id: "pfo-1", title: "Weekend Special", code: "WEEKEND20", discountType: "percentage", discountValue: 20, minOrderValue: 500, startDate: "2026-05-17", endDate: "2026-05-31", description: "20% off all orders above NPR 500 every weekend." },
    { id: "pfo-2", title: "First Order Discount", code: "FIRST150", discountType: "fixed", discountValue: 150, minOrderValue: 800, startDate: "2026-05-01", endDate: "2026-06-30", description: "NPR 150 off your first order above NPR 800." },
  ],
  "lakeside-grand-hotel": [
    { id: "lgo-1", title: "Early Bird Summer", code: "SUMMER15", discountType: "percentage", discountValue: 15, minOrderValue: 0, startDate: "2026-05-01", endDate: "2026-08-31", description: "Book 7+ days ahead for 15% off room rates." },
  ],
  "himalayan-trekking-nepal": [
    { id: "htno-1", title: "Group Discount", code: "GROUP10", discountType: "percentage", discountValue: 10, minOrderValue: 0, startDate: "2026-01-01", endDate: "2026-12-31", description: "10% off for groups of 4 or more." },
  ],
  "glow-beauty-salon": [
    { id: "gbso-1", title: "New Client Welcome", code: "WELCOME25", discountType: "percentage", discountValue: 25, minOrderValue: 1000, startDate: "2026-01-01", endDate: "2026-12-31", description: "25% off your first appointment at Glow Beauty." },
  ],
  "mountain-fashion-pokhara": [
    { id: "mfpo-1", title: "Trek Season Sale", code: "TREK20", discountType: "percentage", discountValue: 20, minOrderValue: 2000, startDate: "2026-05-01", endDate: "2026-06-30", description: "20% off all trekking wear and accessories during peak season." },
    { id: "mfpo-2", title: "Bundle Deal", code: "BUNDLE15", discountType: "percentage", discountValue: 15, minOrderValue: 5000, startDate: "2026-01-01", endDate: "2026-12-31", description: "Buy any 3+ items and save 15%." },
  ],
  "fresh-mart-pokhara": [
    { id: "fmpo-1", title: "Morning Fresh Discount", code: "MORNING10", discountType: "percentage", discountValue: 10, minOrderValue: 300, startDate: "2026-01-01", endDate: "2026-12-31", description: "10% off orders placed before 8 AM for morning delivery." },
    { id: "fmpo-2", title: "Hotel Bulk Rate", code: "HOTELBULK", discountType: "percentage", discountValue: 12, minOrderValue: 5000, startDate: "2026-01-01", endDate: "2026-12-31", description: "12% off for hotel and restaurant bulk grocery orders above NPR 5,000." },
  ],
  "pokhara-events-hub": [
    { id: "peho-1", title: "Group of 4 Discount", code: "GROUP4", discountType: "percentage", discountValue: 15, minOrderValue: 0, startDate: "2026-01-01", endDate: "2026-12-31", description: "15% off when booking 4 or more tickets for any event." },
  ],
  "pokhara-local-services": [
    { id: "plso-1", title: "First Job Free Inspection", code: "FIRSTFREE", discountType: "fixed", discountValue: 200, minOrderValue: 800, startDate: "2026-01-01", endDate: "2026-12-31", description: "NPR 200 off your first service booking." },
  ],
  "secure-vision-pokhara": [
    { id: "svpo-1", title: "Hotel Security Bundle", code: "HOTELSEC", discountType: "percentage", discountValue: 12, minOrderValue: 0, startDate: "2026-01-01", endDate: "2026-12-31", description: "12% off for hotels booking 8+ camera packages." },
  ],
  "techpro-solutions-pokhara": [
    { id: "tspo-1", title: "New Client IT Audit Free", code: "ITAUDIT", discountType: "fixed", discountValue: 2000, minOrderValue: 5000, startDate: "2026-01-01", endDate: "2026-12-31", description: "Free IT audit (NPR 2,000 value) with any new AMC contract." },
  ],
  "sparkle-clean-pokhara": [
    { id: "scpo-1", title: "First Deep Clean Discount", code: "FIRSTCLEAN", discountType: "percentage", discountValue: 15, minOrderValue: 3000, startDate: "2026-01-01", endDate: "2026-12-31", description: "15% off your first deep cleaning booking." },
    { id: "scpo-2", title: "Monthly Plan Saving", code: "MONTHLY10", discountType: "percentage", discountValue: 10, minOrderValue: 10000, startDate: "2026-01-01", endDate: "2026-12-31", description: "10% off when you sign up for a monthly cleaning contract." },
  ],
  "pokhara-general-store": [
    { id: "pgso-1", title: "Free Delivery Over NPR 1,500", code: "FREEDEL", discountType: "fixed", discountValue: 80, minOrderValue: 1500, startDate: "2026-01-01", endDate: "2026-12-31", description: "Free delivery on any order above NPR 1,500." },
  ],
  "summit-wholesale-pokhara": [
    { id: "swpo-1", title: "New Retailer Discount", code: "NEWRETAIL10", discountType: "percentage", discountValue: 10, minOrderValue: 50000, startDate: "2026-01-01", endDate: "2026-12-31", description: "10% off your first bulk order above NPR 50,000. One-time use for new retail accounts." },
    { id: "swpo-2", title: "Hotel Partner Rate", code: "HOTELB2B", discountType: "percentage", discountValue: 8, minOrderValue: 100000, startDate: "2026-01-01", endDate: "2026-12-31", description: "8% partner rate for registered hotel accounts with monthly orders above NPR 1,00,000." },
  ],
};

const MOCK_AVAILABILITY: Record<string, PublicAvailability> = {
  "pokhara-food-house": {
    orderingOpen: true, bookingOpen: true, deliveryAvailable: true, pickupAvailable: true,
    estimatedDeliveryTime: "30–45 min", estimatedPickupTime: "15–20 min",
    nextOpenTime: null, minimumOrderAmount: 300, deliveryFee: 50,
    deliveryAreas: ["Lakeside", "Damside", "Bagar", "Mahendra Pul"],
  },
  "lakeside-grand-hotel": {
    orderingOpen: false, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: [],
  },
  "himalayan-trekking-nepal": {
    orderingOpen: false, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: [],
  },
  "glow-beauty-salon": {
    orderingOpen: false, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: [],
  },
  "mountain-fashion-pokhara": {
    orderingOpen: true, bookingOpen: false, deliveryAvailable: true, pickupAvailable: true,
    estimatedDeliveryTime: "2–4 hours (Pokhara valley)", estimatedPickupTime: "Ready in 30 min",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 100,
    deliveryAreas: ["Lakeside", "Mahendrapul", "Bagar", "New Road", "Chipledhunga", "Prithvi Chowk"],
  },
  "fresh-mart-pokhara": {
    orderingOpen: true, bookingOpen: false, deliveryAvailable: true, pickupAvailable: true,
    estimatedDeliveryTime: "1–3 hours (morning slot before 10 AM)", estimatedPickupTime: "Ready in 15 min",
    nextOpenTime: null, minimumOrderAmount: 200, deliveryFee: 50,
    deliveryAreas: ["Lakeside", "Damside", "New Road", "Bagar", "Mahendrapul", "Chipledhunga", "Rambazar"],
  },
  "pokhara-events-hub": {
    orderingOpen: true, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "E-ticket sent instantly",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: [],
  },
  "pokhara-local-services": {
    orderingOpen: false, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: ["Pokhara Valley"],
  },
  "secure-vision-pokhara": {
    orderingOpen: false, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: ["Pokhara Valley"],
  },
  "techpro-solutions-pokhara": {
    orderingOpen: false, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: ["Pokhara Valley (on-site) / Remote (Nepal-wide)"],
  },
  "sparkle-clean-pokhara": {
    orderingOpen: false, bookingOpen: true, deliveryAvailable: false, pickupAvailable: false,
    estimatedDeliveryTime: "", estimatedPickupTime: "",
    nextOpenTime: null, minimumOrderAmount: 0, deliveryFee: 0,
    deliveryAreas: ["Lakeside", "Damside", "Bagar", "Mahendrapul", "Chipledhunga", "New Road", "Rambazar"],
  },
  "pokhara-general-store": {
    orderingOpen: true, bookingOpen: false, deliveryAvailable: true, pickupAvailable: true,
    estimatedDeliveryTime: "2–5 hours", estimatedPickupTime: "Ready in 1 hour",
    nextOpenTime: null, minimumOrderAmount: 300, deliveryFee: 80,
    deliveryAreas: ["Lakeside", "Damside", "Bagar", "New Road", "Mahendrapul"],
  },
  "summit-wholesale-pokhara": {
    orderingOpen: true, bookingOpen: false, deliveryAvailable: true, pickupAvailable: true,
    estimatedDeliveryTime: "Same day (orders before 12 PM) / Next day",
    estimatedPickupTime: "Ready within 2 hours",
    nextOpenTime: null, minimumOrderAmount: 25000, deliveryFee: 0,
    deliveryAreas: ["Lakeside", "Bagar", "Mahendra Pul", "New Road", "Chipledhunga", "Prithvi Chowk", "Rambazar", "Pokhara Valley"],
  },
};

// ─── Service Functions ────────────────────────────────────────────────────────

export async function getPublicStorefront(slug: string): Promise<PublicStorefront | null> {
  try {
    const b = await _bundle(slug);
    if (b && (Array.isArray(b.storefronts) ? b.storefronts.length : b.industry)) return _mapStorefront(b);
  } catch { /* fall through */ }
  return null;
}

export async function getPublicCategories(slug: string): Promise<PublicCategory[]> {
  const items = await getPublicItems(slug);
  const map = new Map<string, number>();
  items.forEach(i => { if (i.category) map.set(i.category, (map.get(i.category) ?? 0) + 1); });
  return Array.from(map.entries()).map(([name, count], idx) => ({
    id: `cat-${idx}`, name, itemCount: count, displayOrder: idx,
  }));
}

export async function getPublicItems(slug: string, category?: string): Promise<PublicItem[]> {
  try {
    const b = await _bundle(slug);
    let items: PublicItem[] = (b.listings || []).map((l: any) => _mapItem(l, b));
    if (category) items = items.filter(i => i.category === category);
    return items;
  } catch { /* fall through */ }
  return [];
}

export async function getPublicItem(slug: string, itemSlug: string): Promise<PublicItem | null> {
  const items = await getPublicItems(slug);
  return items.find(i => i.slug === itemSlug || i.id === itemSlug) ?? null;
}

export async function getPublicOffers(slug: string): Promise<PublicOffer[]> {
  try {
    const data = await _pubGet(`/public/storefront/${encodeURIComponent(slug)}/deals/${_previewQuery()}`);
    const coupons: any[] = Array.isArray(data) ? data : (data?.coupons || data?.deals || []);
    return coupons.map((c: any) => ({
      id: c.code,
      title: c.description || c.code,
      code: c.code,
      discountType: (String(c.type).startsWith("perc") ? "percentage" : "fixed") as PublicOffer["discountType"],
      discountValue: _num(c.value),
      minOrderValue: _num(c.min_order_amount),
      startDate: "",
      endDate: c.end_date || "",
      description: c.description || "",
    }));
  } catch { /* fall through */ }
  return [];
}

export async function getPublicAvailability(slug: string): Promise<PublicAvailability | null> {
  try {
    const b = await _bundle(slug);
    if (b) return _mapAvailability(b);
  } catch { /* fall through */ }
  return null;
}

export interface PublicEvent {
  id: string; title: string; description: string;
  date: string; time: string; endTime: string; location: string;
  capacity: number; ticketPrice: number; isFree: boolean;
  imageUrl: string; videoUrl: string; onlineLink?: string;
  isOnlineEvent: boolean; tags?: string;
}

export async function getPublicEvents(slug: string): Promise<PublicEvent[]> {
  try {
    const b = await _bundle(slug);
    return (b.events || []).map((e: any) => {
      const dt = e.starts_at ? new Date(e.starts_at) : null;
      return {
        id: String(e.id),
        title: e.title || "",
        description: e.description || "",
        date: dt ? dt.toISOString().slice(0, 10) : "",
        time: dt ? dt.toISOString().slice(11, 16) : "",
        endTime: "",
        location: e.venue || "",
        capacity: _num(e.seats_left),
        ticketPrice: _num(e.price),
        isFree: !!e.free,
        imageUrl: e.image_url || "",
        videoUrl: "",
        isOnlineEvent: false,
      } as PublicEvent;
    });
  } catch { /* fall through */ }
  return [];
}

export async function rsvpPublicEvent(
  slug: string, eventId: string,
  payload: { name: string; phone: string; email?: string; quantity?: number }
): Promise<{ ticketRef: string; onlineLink?: string; message?: string } | null> {
  try {
    const data = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/rsvp/`, {
      event_id: eventId,
      name: payload.name, phone: payload.phone,
      email: payload.email ?? "", quantity: payload.quantity ?? 1,
    });
    return { ticketRef: data?.ticket_ref || data?.ticketRef || `RSVP-${Date.now().toString().slice(-6)}`, message: data?.message };
  } catch { /* fall through */ }
  return null;
}

export async function createPublicOrder(slug: string, payload: CreateOrderPayload): Promise<OrderConfirmation> {
  try {
    const data = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/order/`, payload);
    return {
      id: String(data?.id ?? data?.order_id ?? `ord-${Date.now()}`),
      orderNumber: data?.order_number || data?.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
      status: data?.status || "pending",
      estimatedTime: data?.estimated_time || "",
      message: data?.message || "Order received! We will confirm shortly.",
    };
  } catch { /* fall through */ }
  return {
    id: `mock-ord-${Date.now()}`,
    orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
    status: "pending",
    estimatedTime: "30–45 min",
    message: "Order received! We will confirm shortly.",
  };
}

export async function createPublicBooking(slug: string, payload: CreateBookingPayload): Promise<BookingConfirmation> {
  try {
    const data = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/book/`, payload);
    return {
      id: String(data?.id ?? `bkg-${Date.now()}`),
      bookingRef: data?.booking_ref || data?.bookingRef || `BKG-${Date.now().toString().slice(-6)}`,
      status: data?.status || "requested",
      message: data?.message || "Booking request received! We will confirm within 24 hours.",
    };
  } catch { /* fall through */ }
  return {
    id: `mock-bkg-${Date.now()}`,
    bookingRef: `BKG-${Date.now().toString().slice(-6)}`,
    status: "requested",
    message: "Booking request received! We will confirm within 24 hours.",
  };
}

// ─── Subscription (Wellness / Natural Beauty) ─────────────────────────────────

export interface CreateSubscriptionPayload {
  itemId?: string;
  itemTitle?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  plan: "monthly" | "bi_monthly" | "quarterly";
  discountPercent: number;
  unitPrice: number;
  currency?: string;
  notes?: string;
}

export interface SubscriptionConfirmation {
  id: string;
  plan: string;
  status: string;
  message: string;
}

export async function createPublicSubscription(
  slug: string,
  payload: CreateSubscriptionPayload,
): Promise<SubscriptionConfirmation> {
  try {
    const data = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/subscribe/`, payload);
    return {
      id: String(data?.id ?? `sub-${Date.now()}`),
      plan: data?.plan || payload.plan,
      status: data?.status || "active",
      message: data?.message || "Subscription registered! We'll contact you shortly.",
    };
  } catch { /* fall through */ }
  return {
    id: `mock-sub-${Date.now()}`,
    plan: payload.plan,
    status: "active",
    message: "Prenumeration registrerad! Vi kontaktar dig snart.",
  };
}

// ─── Membership join (scan QR → become a member of THIS business) ─────────────

export interface MembershipJoinPayload {
  planId: string;
  name: string;
  email: string;
  phone?: string;
}

export interface MembershipJoinResult {
  memberNo: string;
  plan: string;
  /** True when an active membership already existed (idempotent re-join). */
  alreadyMember: boolean;
}

/**
 * Join a membership plan on this business's storefront (anonymous, public).
 * Hits the same backend the QR `?join=1` flow targets. The backend is the
 * source of truth: it is workspace-scoped and idempotent (one active membership
 * per customer+workspace+plan), so a re-scan returns the existing membership.
 *
 * Unlike the other public helpers, this does NOT mock on failure — the caller
 * needs the real outcome and any real error message.
 */
export interface GiftCardBuyPayload {
  amount: number;
  name: string;
  email: string;
  phone?: string;
  recipient?: string;
  message?: string;
}
export interface GiftCardBuyResult { code: string; amount: string; currency: string; }

/** Buy a gift card on this storefront (anonymous, public). Real outcome, no mock —
 *  the buyer needs the issued code and any real error. */
export async function buyGiftCard(slug: string, payload: GiftCardBuyPayload): Promise<GiftCardBuyResult> {
  const data = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/gift-card/`, {
    amount: payload.amount,
    recipient: payload.recipient ?? "",
    message: payload.message ?? "",
    customer: { name: payload.name, email: payload.email, phone: payload.phone ?? "" },
  });
  return {
    code: String(data?.code ?? ""),
    amount: String(data?.amount ?? ""),
    currency: String(data?.currency ?? ""),
  };
}

/** Look up a shopper's loyalty points by email (public). */
export async function checkLoyaltyPoints(slug: string, email: string): Promise<{ found: boolean; points: number; tier: string }> {
  const data = await _pubGet(`/public/storefront/${encodeURIComponent(slug)}/loyalty/points/?email=${encodeURIComponent(email)}`);
  return { found: !!data?.found, points: Number(data?.points ?? 0), tier: String(data?.tier ?? "") };
}

export interface RedeemRewardResult { code: string; reward: string; rewardType: string; value: string; pointsRemaining: number; }
/** Redeem points for a reward (public). Issues a coupon/gift-card code. */
export async function redeemReward(slug: string, email: string, rewardId: string): Promise<RedeemRewardResult> {
  const data = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/loyalty/redeem/`, { email, reward_id: rewardId });
  return {
    code: String(data?.code ?? ""),
    reward: String(data?.reward ?? ""),
    rewardType: String(data?.reward_type ?? ""),
    value: String(data?.value ?? ""),
    pointsRemaining: Number(data?.points_remaining ?? 0),
  };
}

export async function joinMembership(slug: string, payload: MembershipJoinPayload): Promise<MembershipJoinResult> {
  const data = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/subscribe/`, {
    plan_id: payload.planId,
    customer: { name: payload.name, email: payload.email, phone: payload.phone ?? "" },
  });
  return {
    memberNo: String(data?.member_no ?? ""),
    plan: String(data?.plan ?? ""),
    alreadyMember: Boolean(data?.already_member),
  };
}

// ─── Fika Loyalty Stamps ──────────────────────────────────────────────────────

export interface StampState {
  count: number;
  totalEarned: number;
  freeItemsEarned: number;
  lastStamp: string | null;
}

export async function getPublicLoyaltyStamps(_slug: string, _customerPhone: string): Promise<StampState | null> {
  // Not exposed on the production public API yet — degrade gracefully.
  return null;
}

export async function addPublicLoyaltyStamps(
  _slug: string,
  _customerPhone: string,
  _add: number = 1,
): Promise<StampState | null> {
  return null;
}

// ─── Storefront AI assistant ────────────────────────────────────────────────
// Customer-facing chat, powered by the store's own trained KB (the same engine
// the owner trains in /w/<id>/knowledge). Backend never exposes anything beyond
// the answer text + confidence.

export interface AssistantStatus {
  available: boolean;
  name: string;
  greeting: string;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantReply {
  available: boolean;
  answer: string;
  confidence: number;
}

/** Is the AI assistant turned on for this store? (cheap, no LLM call). */
export async function getAssistantStatus(slug: string): Promise<AssistantStatus> {
  try {
    const d = await _pubGet(`/public/storefront/${encodeURIComponent(slug)}/assistant/`);
    return {
      available: !!d?.available,
      name: d?.name || "",
      greeting: d?.greeting || "",
    };
  } catch {
    return { available: false, name: "", greeting: "" };
  }
}

/** Ask the store's AI assistant a question. ``history`` is recent turns for context. */
export async function askAssistant(
  slug: string,
  query: string,
  history: AssistantTurn[] = [],
): Promise<AssistantReply> {
  const d = await _pubPost(`/public/storefront/${encodeURIComponent(slug)}/assistant/`, {
    query,
    history,
  });
  return {
    available: d?.available !== false,
    answer: d?.answer || "",
    confidence: Number(d?.confidence ?? 0),
  };
}

/**
 * Streaming ask — answer text arrives token-by-token via SSE so the UI can type
 * it out live. ``onToken`` is called with each delta. Throws on transport
 * failure (or an error event before any token) so the caller can fall back to
 * the blocking ``askAssistant``. Resolves once the stream completes.
 */
export async function askAssistantStream(
  slug: string,
  query: string,
  history: AssistantTurn[],
  onToken: (text: string) => void,
): Promise<{ confidence: number; available: boolean }> {
  const res = await fetch(
    `${resolveApiV1Base()}/public/storefront/${encodeURIComponent(slug)}/assistant/stream/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ query, history }),
    },
  );
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let confidence = 0;
  let available = true;
  let gotToken = false;

  const handle = (payload: string) => {
    if (!payload) return;
    let ev: { type?: string; text?: string; confidence?: number; available?: boolean };
    try {
      ev = JSON.parse(payload);
    } catch {
      return;
    }
    if (ev.type === "token" && ev.text) {
      gotToken = true;
      onToken(ev.text);
    } else if (ev.type === "done") {
      confidence = Number(ev.confidence ?? 0);
      if (ev.available === false) available = false;
    } else if (ev.type === "error" && !gotToken) {
      throw new Error("stream error");
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() || "";
    for (const frame of frames) {
      const line = frame.trim();
      if (line.startsWith("data:")) handle(line.slice(5).trim());
    }
  }
  return { confidence, available };
}
