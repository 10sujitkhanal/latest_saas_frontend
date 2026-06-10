/**
 * Industry sellable-setup registry — the per-industry config that drives the
 * "Set up what you sell" wizard so each business gets categories + starters that
 * fit ITS industry (a salon sees hair/nails, a restaurant sees menu items), not
 * wellness for everyone.
 *
 * This is the sellable layer of the SAME industry system as
 * `workspaceIndustry.ts` (keyed by the identical `effective_industry` strings) —
 * not a third parallel system. The wizard resolves the workspace's industry to a
 * family config; unknown industries fall back to a GENERIC retail/service set
 * (never wellness).
 *
 * IMPORTANT distinction: only true item-entry things are categories here
 * (Listings/Items/MembershipPlans). Modules/features — bookings, tables, events,
 * gift cards, coupons, loyalty, B2B — are NOT categories; they live on the
 * storefront/Setup Hub. `b2bVisible`/`copyRule` are metadata for those surfaces.
 */

export type SellableType = 'product' | 'service' | 'consultation' | 'package' | 'membership';

export interface SellableCategory {
  key: string;
  label: string;        // free-text category written to each Listing
  type: SellableType;
  recommended?: boolean; // pre-checked in the picker (default-checked)
}

export interface StarterRow { name: string; description: string }

export interface IndustrySellableConfig {
  family: string;                 // 'wellness' | 'salon' | 'restaurant' | 'hotel' | 'retail' | 'generic'
  ctaLabel: string;               // "Start with salon suggestions"
  categories: SellableCategory[];
  starters: Record<string, StarterRow[]>;   // categoryKey -> editable starter rows (BLANK prices)
  starterCategoryKeys: string[];  // which categories "suggestions" pre-selects + fills
  b2bVisible: boolean;            // (metadata) does this industry surface B2B/wholesale elsewhere
  copyRule: string;               // (metadata) safe-copy guard for future AI copy
}

/** Per-type field hints for the wizard's "type-to-add" row. */
export const TYPE_FIELDS: Record<SellableType, {
  nameLabel: string; showDuration: boolean; showDescription: boolean;
  showTrackStock: boolean; priceLabel: string;
}> = {
  product:      { nameLabel: 'Product name',      showDuration: false, showDescription: false, showTrackStock: true,  priceLabel: 'Price' },
  service:      { nameLabel: 'Service name',      showDuration: true,  showDescription: false, showTrackStock: false, priceLabel: 'Price' },
  consultation: { nameLabel: 'Consultation name', showDuration: true,  showDescription: false, showTrackStock: false, priceLabel: 'Price' },
  package:      { nameLabel: 'Package name',      showDuration: false, showDescription: true,  showTrackStock: false, priceLabel: 'Price' },
  membership:   { nameLabel: 'Plan name',         showDuration: false, showDescription: true,  showTrackStock: false, priceLabel: 'Monthly price' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-industry configs. Wellness is the fully-built one; the others are light:
// safe, conventional categories + a few obvious starter rows (BLANK prices,
// neutral copy) — enough to feel industry-designed without pretending to know
// the specific business. Owner edits/removes everything; nothing is created
// until review/save; all drafts.
// ─────────────────────────────────────────────────────────────────────────────

const WELLNESS: IndustrySellableConfig = {
  family: 'wellness',
  ctaLabel: 'Start with wellness suggestions',
  b2bVisible: true,
  copyRule: 'Benefits-neutral, non-medical copy only — never heals/cures/treats/guaranteed.',
  categories: [
    { key: 'supplements', label: 'Supplements', type: 'product', recommended: true },
    { key: 'vitamins', label: 'Vitamins & Minerals', type: 'product' },
    { key: 'protein', label: 'Protein & Fitness', type: 'product' },
    { key: 'skincare', label: 'Skincare', type: 'product' },
    { key: 'services', label: 'Wellness Services', type: 'service', recommended: true },
    { key: 'consultations', label: 'Consultations', type: 'consultation', recommended: true },
    { key: 'packages', label: 'Wellness Packages', type: 'package' },
    { key: 'memberships', label: 'Memberships', type: 'membership' },
  ],
  starterCategoryKeys: ['services', 'consultations', 'packages', 'supplements', 'memberships'],
  starters: {
    services: [
      { name: '60-minute wellness session', description: 'A general wellness service offered by your business.' },
      { name: 'Follow-up wellness session', description: 'A follow-up wellness service offered by your business.' },
    ],
    consultations: [
      { name: 'Initial consultation', description: 'An initial wellness consultation with your business.' },
      { name: 'Online consultation', description: 'An online wellness consultation with your business.' },
    ],
    packages: [{ name: '5-session wellness package', description: 'A multi-session wellness package offered by your business.' }],
    supplements: [
      { name: 'Supplement product', description: 'A wellness supplement offered by your business.' },
      { name: 'Wellness bundle', description: 'A bundle of wellness products offered by your business.' },
    ],
    memberships: [{ name: 'Monthly wellness membership', description: 'A monthly wellness membership offered by your business.' }],
  },
};

const SALON: IndustrySellableConfig = {
  family: 'salon',
  ctaLabel: 'Start with salon suggestions',
  b2bVisible: false,
  copyRule: 'Neutral service copy — no guaranteed results.',
  categories: [
    { key: 'hair', label: 'Hair Services', type: 'service', recommended: true },
    { key: 'nails', label: 'Nails', type: 'service', recommended: true },
    { key: 'skincare', label: 'Skincare', type: 'service' },
    { key: 'products', label: 'Product upsells', type: 'product' },
    { key: 'memberships', label: 'Memberships', type: 'membership' },
  ],
  starterCategoryKeys: ['hair', 'nails', 'skincare', 'products'],
  starters: {
    hair: [
      { name: 'Haircut', description: 'A haircut service offered by your business.' },
      { name: 'Hair coloring', description: 'A hair coloring service offered by your business.' },
    ],
    nails: [{ name: 'Manicure', description: 'A manicure service offered by your business.' }],
    skincare: [{ name: 'Facial treatment', description: 'A facial treatment offered by your business.' }],
    products: [{ name: 'Haircare product', description: 'A haircare product offered by your business.' }],
  },
};

const RESTAURANT: IndustrySellableConfig = {
  family: 'restaurant',
  ctaLabel: 'Start with restaurant suggestions',
  b2bVisible: false,
  copyRule: 'Neutral menu copy.',
  categories: [
    { key: 'menu', label: 'Menu Items', type: 'product', recommended: true },
    { key: 'drinks', label: 'Drinks', type: 'product' },
    { key: 'catering', label: 'Catering', type: 'package' },
  ],
  starterCategoryKeys: ['menu', 'drinks', 'catering'],
  starters: {
    menu: [
      { name: 'Starter', description: 'A starter dish offered by your business.' },
      { name: 'Main dish', description: 'A main dish offered by your business.' },
      { name: 'Dessert', description: 'A dessert offered by your business.' },
    ],
    drinks: [{ name: 'Drink', description: 'A drink offered by your business.' }],
    catering: [{ name: 'Catering package', description: 'A catering package offered by your business.' }],
  },
};

const HOTEL: IndustrySellableConfig = {
  family: 'hotel',
  ctaLabel: 'Start with hotel suggestions',
  b2bVisible: false,
  copyRule: 'Neutral room/service copy.',
  categories: [
    { key: 'rooms', label: 'Rooms', type: 'service', recommended: true },
    { key: 'addons', label: 'Add-ons', type: 'product', recommended: true },
    { key: 'services', label: 'Guest Services', type: 'service' },
    { key: 'packages', label: 'Packages', type: 'package' },
  ],
  starterCategoryKeys: ['rooms', 'addons', 'packages'],
  starters: {
    rooms: [
      { name: 'Standard room', description: 'A standard room offered by your business.' },
      { name: 'Deluxe room', description: 'A deluxe room offered by your business.' },
    ],
    addons: [
      { name: 'Breakfast add-on', description: 'A breakfast add-on offered by your business.' },
      { name: 'Airport pickup', description: 'An airport pickup service offered by your business.' },
    ],
    packages: [{ name: 'Event package', description: 'An event package offered by your business.' }],
  },
};

const RETAIL: IndustrySellableConfig = {
  family: 'retail',
  ctaLabel: 'Start with retail suggestions',
  b2bVisible: false,
  copyRule: 'Neutral product copy.',
  categories: [
    { key: 'products', label: 'Products', type: 'product', recommended: true },
    { key: 'bundles', label: 'Bundles', type: 'package' },
    { key: 'memberships', label: 'Memberships', type: 'membership' },
  ],
  starterCategoryKeys: ['products', 'bundles'],
  starters: {
    products: [
      { name: 'Featured product', description: 'A featured product offered by your business.' },
      { name: 'Seasonal product', description: 'A seasonal product offered by your business.' },
      { name: 'Gift item', description: 'A gift item offered by your business.' },
    ],
    bundles: [{ name: 'Bundle', description: 'A product bundle offered by your business.' }],
  },
};

// Unknown industry → generic products + services (NOT wellness).
const GENERIC: IndustrySellableConfig = {
  family: 'generic',
  ctaLabel: 'Start with suggestions',
  b2bVisible: false,
  copyRule: 'Neutral copy.',
  categories: [
    { key: 'products', label: 'Products', type: 'product', recommended: true },
    { key: 'services', label: 'Services', type: 'service', recommended: true },
    { key: 'packages', label: 'Packages', type: 'package' },
    { key: 'memberships', label: 'Memberships', type: 'membership' },
  ],
  starterCategoryKeys: ['products', 'services'],
  starters: {
    products: [{ name: 'Featured product', description: 'A product offered by your business.' }],
    services: [{ name: 'Service', description: 'A service offered by your business.' }],
  },
};

/** Resolve an `effective_industry` string to its sellable config family. */
export function sellableSetupFor(industry?: string | null): IndustrySellableConfig {
  const s = (industry || '').toLowerCase();
  if (s.startsWith('wellness') || s.includes('natural beauty') || s.includes('skincare')) return WELLNESS;
  if (s.startsWith('salon')) return SALON;
  if (s.startsWith('restaurant') || s.includes('fika') || s.includes('coffee') || s.includes('beer') || s.includes('brewery')) return RESTAURANT;
  if (s.startsWith('hotel')) return HOTEL;
  if (s.includes('retail') || s.includes('clothing') || s.includes('grocery') || s.includes('wholesale') || s.includes('supplier')) return RETAIL;
  return GENERIC;
}
