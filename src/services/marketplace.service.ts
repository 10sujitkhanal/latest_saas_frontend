import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface ListingRow {
  id: number;
  title: string;
  slug: string;
  description?: string;
  category: string;
  item?: number | null;
  item_name?: string;
  item_sku?: string;
  price: string;
  currency: string;
  image_url?: string;          // pasted URL (legacy/fallback)
  hero_image_url?: string;     // absolute URL: uploaded hero_image → pasted image_url → ''
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  published_at?: string | null;
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown> | FormData;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/marketplace/workspaces/${workspaceId}`;
}

async function httpGet<T>(url: string, params?: Params) {
  const { data } = await apiClient.get<ApiEnvelope<T>>(url, { params });
  return data;
}
async function httpPost<T>(url: string, payload: Payload = {}) {
  const { data } = await apiClient.post<ApiEnvelope<T>>(url, payload);
  return data;
}
async function httpPatch<T>(url: string, payload: Payload) {
  const { data } = await apiClient.patch<ApiEnvelope<T>>(url, payload);
  return data;
}
async function httpDelete<T>(url: string) {
  const { data } = await apiClient.delete<ApiEnvelope<T>>(url);
  return data;
}

export interface IndustryCapabilities {
  industry: string;
  admin_tabs: string[] | Record<string, boolean>;
  booking_type: 'table' | 'room' | 'appointment' | 'slot' | 'inquiry' | 'none';
  order_types: string[];
  show_cart: boolean;
  requires_date_range: boolean;
  requires_guest_count: boolean;
  show_table_selection: boolean;
  mdx_listing_type: string;
  mdx_search_filters: string[];
  affiliate_enabled: boolean;
  membership_enabled: boolean;
  gift_cards_enabled: boolean;
  deals_enabled: boolean;
  events_enabled: boolean;
  cross_sell_categories: string[];
  accounting_modules: string[];
}

export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  severity: 'required' | 'recommended';
  hint: string;
  fix_route: 'marketplace' | 'inventory' | 'settings' | 'storefront' | 'memberships' | string;
}
export interface StorefrontReadiness {
  ready: boolean;
  is_open: boolean;
  done: number;
  total: number;
  required_total: number;
  checks: ReadinessCheck[];
}

export interface StorefrontSettingsRow {
  id: number;
  workspace: number;
  is_open: boolean;
  accept_orders: boolean;
  auto_fulfill: boolean;
  auto_invoice: boolean;
  collect_payment: boolean;
  sell_memberships: boolean;
  accept_gift_cards: boolean;
  award_loyalty: boolean;
  loyalty_points_per_unit: string;
  title: string;
  tagline: string;
  currency: string;
  updated_at?: string;
  industry?: string;
  capabilities?: IndustryCapabilities;
}

export interface StorefrontBookingRow {
  id: number;
  booking_no: string;
  customer_name?: string | null;
  booking_type: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  service_name: string;
  date: string;
  end_date?: string | null;
  start_time?: string | null;
  party_size: number;
  amount: string;
  currency: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  invoice_no?: string | null;
}

export interface RestaurantTableRow {
  id: number;
  name: string;
  capacity: number;
  section?: string;
  is_active: boolean;
  notes?: string;
}

export interface StorefrontEventRow {
  id: number;
  title: string;
  description?: string;
  venue?: string;
  starts_at: string;
  ends_at?: string | null;
  capacity: number;
  tickets_sold: number;
  seats_left?: number | null;
  price: string;
  currency: string;
  status: 'draft' | 'published' | 'cancelled';
  image_url?: string;
  is_featured: boolean;
}

export interface TradeAccountRow {
  id: number;
  account_no: string;
  business_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  status: 'pending' | 'active' | 'suspended';
  discount_percent: string;
  payment_terms_days: number;
  credit_limit?: string | null;
  pricing_count?: number;
  notes?: string;
}

export const MarketplaceService = {
  list: (workspaceId: Id, params?: Params) => httpGet<ListingRow[]>(`${base(workspaceId)}/listings/`, params),
  get: (workspaceId: Id, id: Id) => httpGet<ListingRow>(`${base(workspaceId)}/listings/${id}/`),
  create: (workspaceId: Id, payload: Payload) => httpPost<ListingRow>(`${base(workspaceId)}/listings/`, payload),
  update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<ListingRow>(`${base(workspaceId)}/listings/${id}/`, payload),
  remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/listings/${id}/`),
  publish: (workspaceId: Id, id: Id, publish: boolean) => httpPost<ListingRow>(`${base(workspaceId)}/listings/${id}/publish/`, { publish }),
  feature: (workspaceId: Id, id: Id) => httpPost<ListingRow>(`${base(workspaceId)}/listings/${id}/feature/`),
  // One-click "Add to storefront" from an inventory item — idempotent draft create.
  fromItem: (workspaceId: Id, itemId: Id) => httpPost<ListingRow>(`${base(workspaceId)}/listings/from-item/${itemId}/`),
  // Upload a hero image (multipart). Let axios set the multipart boundary — do
  // NOT set Content-Type manually or the file body is dropped.
  uploadHeroImage: (workspaceId: Id, id: Id, file: File) => {
    const fd = new FormData();
    fd.append('hero_image', file);
    return httpPatch<ListingRow>(`${base(workspaceId)}/listings/${id}/`, fd);
  },
  getStorefront: (workspaceId: Id) => httpGet<StorefrontSettingsRow>(`${base(workspaceId)}/storefront/`),
  updateStorefront: (workspaceId: Id, payload: Payload) => httpPatch<StorefrontSettingsRow>(`${base(workspaceId)}/storefront/`, payload),
  storefrontQr: (workspaceId: Id, url: string) => httpGet<{ qr_data_url: string; url: string }>(`${base(workspaceId)}/storefront/qr/`, { url }),
  storefrontPreviewToken: (workspaceId: Id) => httpGet<{ token: string }>(`${base(workspaceId)}/storefront/preview-token/`),
  storefrontReadiness: (workspaceId: Id) => httpGet<StorefrontReadiness>(`${base(workspaceId)}/storefront/readiness/`),
  bookings: (workspaceId: Id, params?: Params) => httpGet<StorefrontBookingRow[]>(`${base(workspaceId)}/bookings/`, params),
  bookingStatus: (workspaceId: Id, id: Id, status: string) => httpPost<StorefrontBookingRow>(`${base(workspaceId)}/bookings/${id}/status/`, { status }),
  events: {
    list: (workspaceId: Id) => httpGet<StorefrontEventRow[]>(`${base(workspaceId)}/events/`),
    create: (workspaceId: Id, payload: Payload) => httpPost<StorefrontEventRow>(`${base(workspaceId)}/events/`, payload),
    update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<StorefrontEventRow>(`${base(workspaceId)}/events/${id}/`, payload),
    remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/events/${id}/`),
  },
  tables: {
    list: (workspaceId: Id) => httpGet<RestaurantTableRow[]>(`${base(workspaceId)}/tables/`),
    create: (workspaceId: Id, payload: Payload) => httpPost<RestaurantTableRow>(`${base(workspaceId)}/tables/`, payload),
    update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<RestaurantTableRow>(`${base(workspaceId)}/tables/${id}/`, payload),
    remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/tables/${id}/`),
  },
  tradeAccounts: {
    list: (workspaceId: Id, params?: Params) => httpGet<TradeAccountRow[]>(`${base(workspaceId)}/trade-accounts/`, params),
    create: (workspaceId: Id, payload: Payload) => httpPost<TradeAccountRow>(`${base(workspaceId)}/trade-accounts/`, payload),
    update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<TradeAccountRow>(`${base(workspaceId)}/trade-accounts/${id}/`, payload),
    remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/trade-accounts/${id}/`),
  },
};
