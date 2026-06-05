/**
 * Master Industry Configuration Registry
 *
 * Single source of truth for ALL industry-specific behaviour across:
 *   - Business registration  → which modules to pre-select
 *   - Storefront admin       → which tabs to show (/storefront)
 *   - Public storefront      → layout, colors, CTA, booking type (/s/[slug])
 *   - MoreDealsX marketplace → listing type, search filters
 *   - Accounting             → which feature modules are auto-enabled
 *
 * Adding a new industry = add ONE object here. Nothing else touches.
 */

import {
  type IndustryStorefrontConfig,
  getIndustryStorefrontConfig,
} from "@/lib/moredealsx/industry-config";
import type { MdxIndustry } from "@/lib/moredealsx/types";

export { type IndustryStorefrontConfig, getIndustryStorefrontConfig };
export type { MdxIndustry };

// ─── Capability types ─────────────────────────────────────────────────────────

export type BookingType = "table" | "room" | "appointment" | "slot" | "inquiry" | "none";
export type OrderType   = "delivery" | "pickup" | "dine_in" | "preorder";
export type MdxListingType = "deal" | "rental" | "service" | "event" | "listing";

export interface AccountingModules {
  inventory:          boolean;
  payroll:            boolean;
  invoicing:          boolean;
  delivery:           boolean;
  tableManagement:    boolean;
  roomRevenue:        boolean;
  appointmentBilling: boolean;
  eventTicketing:     boolean;
}

export interface AdminTabs {
  items:    boolean;   // Products / Menu / Rooms / Services
  orders:   boolean;   // Online ordering queue
  bookings: boolean;   // Appointments / reservations
  delivery: boolean;   // Delivery & pickup settings
  tables:   boolean;   // Table management (restaurant only)
  rooms:    boolean;   // Room management (hotel only)
}

export interface IndustryCapabilities {
  industry: MdxIndustry;

  // ── Storefront admin tabs ──────────────────────────────────────────────────
  adminTabs: AdminTabs;

  // ── Public storefront behaviour ────────────────────────────────────────────
  bookingType:          BookingType;
  orderTypes:           OrderType[];
  showCart:             boolean;  // shopping cart vs quote/booking
  requiresDateRange:    boolean;  // check-in / check-out pair
  requiresGuestCount:   boolean;  // party / group size input
  showTableSelection:   boolean;  // table picker

  // ── MoreDealsX marketplace ─────────────────────────────────────────────────
  mdxListingType:   MdxListingType;
  mdxSearchFilters: string[];

  // ── Monetisation ──────────────────────────────────────────────────────────
  affiliateEnabled:      boolean;
  membershipEnabled:     boolean;
  crossSellCategories:   MdxIndustry[];

  // ── Accounting auto-enable ─────────────────────────────────────────────────
  accountingModules: AccountingModules;

  // ── Dev / demo ────────────────────────────────────────────────────────────
  testSlug: string;   // pre-seeded slug to test this industry's storefront
}

// ─── Master registry ──────────────────────────────────────────────────────────

export const INDUSTRY_CAPABILITIES: Record<MdxIndustry, IndustryCapabilities> = {
  Restaurant: {
    industry: "Restaurant",
    adminTabs:           { items: true,  orders: true,  bookings: true,  delivery: true,  tables: true,  rooms: false },
    bookingType:         "table",
    orderTypes:          ["delivery", "pickup", "dine_in", "preorder"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "deal",
    mdxSearchFilters:    ["cuisine_type", "price_range", "diet", "delivery"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Events", "Grocery"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: true, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "pokhara-food-house",
  },

  Hotel: {
    industry: "Hotel",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: true  },
    bookingType:         "room",
    orderTypes:          [],
    showCart:            false,
    requiresDateRange:   true,
    requiresGuestCount:  true,
    showTableSelection:  false,
    mdxListingType:      "rental",
    mdxSearchFilters:    ["star_rating", "amenities", "price_per_night", "breakfast"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Trekking / Travel", "Salon / Spa", "Restaurant"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: true, appointmentBilling: false, eventTicketing: false },
    testSlug:            "lakeside-grand-hotel",
  },

  "Salon / Spa": {
    industry: "Salon / Spa",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: false },
    bookingType:         "appointment",
    orderTypes:          [],
    showCart:            false,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "service",
    mdxSearchFilters:    ["service_type", "gender", "price_range", "duration"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Clothing", "Hotel"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: false, appointmentBilling: true, eventTicketing: false },
    testSlug:            "glow-beauty-salon",
  },

  "Trekking / Travel": {
    industry: "Trekking / Travel",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: false },
    bookingType:         "slot",
    orderTypes:          [],
    showCart:            false,
    requiresDateRange:   true,
    requiresGuestCount:  true,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["duration", "difficulty", "group_size", "price_range"],
    affiliateEnabled:    true,
    membershipEnabled:   false,
    crossSellCategories: ["Hotel", "Restaurant", "Cleaning"],
    accountingModules:   { inventory: false, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "himalayan-trekking-nepal",
  },

  Clothing: {
    industry: "Clothing",
    adminTabs:           { items: true,  orders: true,  bookings: false, delivery: true,  tables: false, rooms: false },
    bookingType:         "none",
    orderTypes:          ["delivery", "pickup"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["size", "color", "brand", "price_range", "season"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Salon / Spa", "Events"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "mountain-fashion-pokhara",
  },

  Grocery: {
    industry: "Grocery",
    adminTabs:           { items: true,  orders: true,  bookings: false, delivery: true,  tables: false, rooms: false },
    bookingType:         "none",
    orderTypes:          ["delivery", "pickup"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["category", "organic", "price_range", "delivery_window"],
    affiliateEnabled:    false,
    membershipEnabled:   true,
    crossSellCategories: ["Restaurant"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "fresh-mart-pokhara",
  },

  Events: {
    industry: "Events",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: false },
    bookingType:         "slot",
    orderTypes:          [],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  true,
    showTableSelection:  false,
    mdxListingType:      "event",
    mdxSearchFilters:    ["event_type", "date", "venue", "price_range"],
    affiliateEnabled:    true,
    membershipEnabled:   false,
    crossSellCategories: ["Restaurant", "Trekking / Travel"],
    accountingModules:   { inventory: false, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: true },
    testSlug:            "pokhara-events-hub",
  },

  "Local Services": {
    industry: "Local Services",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: false },
    bookingType:         "inquiry",
    orderTypes:          [],
    showCart:            false,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "service",
    mdxSearchFilters:    ["service_area", "response_time", "price_range"],
    affiliateEnabled:    false,
    membershipEnabled:   false,
    crossSellCategories: ["CCTV & Security", "Cleaning", "IT Services"],
    accountingModules:   { inventory: false, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: false, appointmentBilling: true, eventTicketing: false },
    testSlug:            "pokhara-local-services",
  },

  "CCTV & Security": {
    industry: "CCTV & Security",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: false },
    bookingType:         "inquiry",
    orderTypes:          [],
    showCart:            false,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "service",
    mdxSearchFilters:    ["service_type", "area_coverage", "price_range"],
    affiliateEnabled:    false,
    membershipEnabled:   false,
    crossSellCategories: ["IT Services", "Local Services"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: false, appointmentBilling: true, eventTicketing: false },
    testSlug:            "secure-vision-pokhara",
  },

  "IT Services": {
    industry: "IT Services",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: false },
    bookingType:         "inquiry",
    orderTypes:          [],
    showCart:            false,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "service",
    mdxSearchFilters:    ["service_type", "sla", "price_range", "remote_support"],
    affiliateEnabled:    false,
    membershipEnabled:   false,
    crossSellCategories: ["CCTV & Security", "Local Services"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: false, appointmentBilling: true, eventTicketing: false },
    testSlug:            "techpro-solutions-pokhara",
  },

  Cleaning: {
    industry: "Cleaning",
    adminTabs:           { items: true,  orders: false, bookings: true,  delivery: false, tables: false, rooms: false },
    bookingType:         "appointment",
    orderTypes:          [],
    showCart:            false,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "service",
    mdxSearchFilters:    ["service_type", "area_size", "frequency", "price_range"],
    affiliateEnabled:    false,
    membershipEnabled:   true,
    crossSellCategories: ["Local Services", "IT Services"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: false, tableManagement: false, roomRevenue: false, appointmentBilling: true, eventTicketing: false },
    testSlug:            "sparkle-clean-pokhara",
  },

  "General Retail": {
    industry: "General Retail",
    adminTabs:           { items: true,  orders: true,  bookings: false, delivery: true,  tables: false, rooms: false },
    bookingType:         "none",
    orderTypes:          ["delivery", "pickup"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["brand", "price_range", "stock"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Grocery", "Clothing"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "pokhara-general-store",
  },

  "Supplier / Wholesale": {
    industry: "Supplier / Wholesale",
    adminTabs:           { items: true,  orders: true,  bookings: false, delivery: true,  tables: false, rooms: false },
    bookingType:         "none",
    orderTypes:          ["delivery", "pickup"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["category", "min_order_qty", "price_range", "certification", "origin"],
    affiliateEnabled:    false,
    membershipEnabled:   true,
    crossSellCategories: ["General Retail", "Grocery"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "summit-wholesale-pokhara",
  },

  "Wellness / Supplements": {
    industry: "Wellness / Supplements",
    adminTabs:           { items: true,  orders: true,  bookings: false, delivery: true,  tables: false, rooms: false },
    bookingType:         "none",
    orderTypes:          ["delivery", "pickup"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["goal", "form", "certification", "dietary", "price_range", "subscription"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Salon / Spa", "Grocery", "General Retail"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "swedevital",
  },

  "Fika / Coffee": {
    industry: "Fika / Coffee",
    adminTabs:           { items: true,  orders: true,  bookings: false, delivery: true,  tables: false, rooms: false },
    bookingType:         "none",
    orderTypes:          ["pickup", "delivery", "preorder"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "deal",
    mdxSearchFilters:    ["category", "dietary", "allergens", "season", "price_range", "preorder"],
    affiliateEnabled:    false,
    membershipEnabled:   true,
    crossSellCategories: ["Wellness / Supplements", "Natural Beauty / Skincare", "Events"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "kafferosteriet-stockholm",
  },

  "Craft Beer / Brewery": {
    industry: "Craft Beer / Brewery",
    adminTabs:           { items: true,  orders: true,  bookings: true,  delivery: true,  tables: false, rooms: false },
    bookingType:         "slot",
    orderTypes:          ["delivery", "pickup"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  true,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["style", "abv", "organic", "vegan", "price_range", "subscription"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Restaurant", "Events", "Fika / Coffee"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "bryggverket-stockholm",
  },

  "Natural Beauty / Skincare": {
    industry: "Natural Beauty / Skincare",
    adminTabs:           { items: true,  orders: true,  bookings: false, delivery: true,  tables: false, rooms: false },
    bookingType:         "none",
    orderTypes:          ["delivery", "pickup"],
    showCart:            true,
    requiresDateRange:   false,
    requiresGuestCount:  false,
    showTableSelection:  false,
    mdxListingType:      "listing",
    mdxSearchFilters:    ["skin_type", "skin_concern", "certification", "free_from", "price_range", "subscription"],
    affiliateEnabled:    true,
    membershipEnabled:   true,
    crossSellCategories: ["Salon / Spa", "Wellness / Supplements", "General Retail"],
    accountingModules:   { inventory: true, payroll: true, invoicing: true, delivery: true, tableManagement: false, roomRevenue: false, appointmentBilling: false, eventTicketing: false },
    testSlug:            "lunabeauty",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getIndustryCapabilities(industry: string): IndustryCapabilities {
  if (INDUSTRY_CAPABILITIES[industry as MdxIndustry]) {
    return INDUSTRY_CAPABILITIES[industry as MdxIndustry];
  }
  const lc = industry.toLowerCase();
  if (lc.startsWith("wellness"))             return INDUSTRY_CAPABILITIES["Wellness / Supplements"];
  if (lc.includes("beauty") || lc.includes("skincare")) return INDUSTRY_CAPABILITIES["Natural Beauty / Skincare"];
  if (lc.includes("fika") || lc.includes("coffee"))     return INDUSTRY_CAPABILITIES["Fika / Coffee"];
  if (lc.includes("beer") || lc.includes("brew"))       return INDUSTRY_CAPABILITIES["Craft Beer / Brewery"];
  if (lc.includes("restaurant") || lc.includes("food")) return INDUSTRY_CAPABILITIES["Restaurant"];
  if (lc.includes("hotel") || lc.includes("accommodation")) return INDUSTRY_CAPABILITIES["Hotel"];
  if (lc.includes("salon") || lc.includes("spa"))       return INDUSTRY_CAPABILITIES["Salon / Spa"];
  return INDUSTRY_CAPABILITIES["General Retail"];
}

/** Combined config + capabilities — use this in most places. */
export function getFullIndustryConfig(industry: string) {
  const config = getIndustryStorefrontConfig(industry as MdxIndustry);
  const caps   = getIndustryCapabilities(industry);
  return { ...config, ...caps };
}

/** Returns all test slugs → useful for generating sitemap or seed script. */
export function getAllTestSlugs(): { slug: string; industry: MdxIndustry }[] {
  return Object.values(INDUSTRY_CAPABILITIES).map((c) => ({
    slug: c.testSlug,
    industry: c.industry,
  }));
}

/** Maps signup industry id (from form.industryId) to MdxIndustry.
 *  form.industryId is already a MdxIndustry value when using INDUSTRY_CHOICES from industryOptions.
 *  This is a safety wrapper in case a legacy lowercase id slips through.
 */
export function normaliseIndustryId(id: string): MdxIndustry {
  const knownIds = Object.keys(INDUSTRY_CAPABILITIES) as MdxIndustry[];
  const direct = knownIds.find((k) => k === id);
  if (direct) return direct;
  const lower = id.toLowerCase();
  const match = knownIds.find((k) => k.toLowerCase() === lower || k.toLowerCase().startsWith(lower));
  return match ?? "General Retail";
}
