/**
 * Wellness sellable-setup config: the suggested categories the wizard offers,
 * each tagged with the TYPE that decides its fields + how the backend creates it
 * (product -> Item+Listing | service/consultation/package -> item-less Listing |
 * membership -> MembershipPlan). Industry-aware: wellness only for now, but the
 * wizard reads from here so other verticals add their own list later.
 */

export type SellableType = 'product' | 'service' | 'consultation' | 'package' | 'membership';

export interface SellableCategory {
  /** Stable key for selection state. */
  key: string;
  /** Free-text category written onto each Listing. */
  label: string;
  type: SellableType;
  /** Pre-checked in the picker. */
  recommended?: boolean;
}

export const WELLNESS_CATEGORIES: SellableCategory[] = [
  { key: 'supplements', label: 'Supplements', type: 'product', recommended: true },
  { key: 'vitamins', label: 'Vitamins & Minerals', type: 'product' },
  { key: 'protein', label: 'Protein & Fitness', type: 'product' },
  { key: 'skincare', label: 'Skincare', type: 'product' },
  { key: 'services', label: 'Wellness Services', type: 'service', recommended: true },
  { key: 'consultations', label: 'Consultations', type: 'consultation', recommended: true },
  { key: 'packages', label: 'Wellness Packages', type: 'package' },
  { key: 'memberships', label: 'Memberships', type: 'membership' },
];

/** Per-type field hints for the "type-to-add" row (what the owner fills). */
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

/** Wellness-first MVP; other industries fall back to the wellness set for now. */
export function sellableCategoriesFor(_industry?: string | null): SellableCategory[] {
  return WELLNESS_CATEGORIES;
}

/**
 * Conservative starter rows the "Start with wellness suggestions" button
 * pre-fills into the wizard. NEUTRAL, non-medical descriptions and — deliberately
 * — NO prices: the owner enters every price before saving. Each row is editable
 * and removable; nothing is created until the owner reviews and saves as draft.
 * Health-claim guardrail: never "heals/cures/treats/guaranteed/medical benefits".
 */
export interface StarterRow { name: string; description: string }

export const STARTER_CATEGORY_KEYS = ['services', 'consultations', 'packages', 'supplements', 'memberships'];

export const WELLNESS_STARTERS: Record<string, StarterRow[]> = {
  services: [
    { name: '60-minute wellness session', description: 'A general wellness service offered by your business.' },
    { name: 'Follow-up wellness session', description: 'A follow-up wellness service offered by your business.' },
  ],
  consultations: [
    { name: 'Initial consultation', description: 'An initial wellness consultation with your business.' },
    { name: 'Online consultation', description: 'An online wellness consultation with your business.' },
  ],
  packages: [
    { name: '5-session wellness package', description: 'A multi-session wellness package offered by your business.' },
  ],
  supplements: [
    { name: 'Supplement product', description: 'A wellness supplement offered by your business.' },
    { name: 'Wellness bundle', description: 'A bundle of wellness products offered by your business.' },
  ],
  memberships: [
    { name: 'Monthly wellness membership', description: 'A monthly wellness membership offered by your business.' },
  ],
};
