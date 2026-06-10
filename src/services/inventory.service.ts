import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface CategoryRow {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  item_count?: number;
}

export interface ItemRow {
  id: number;
  category?: number | null;
  category_name?: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  status: 'active' | 'archived';
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
  is_low_stock: boolean;
  reorder_point: string;
  reorder_qty: string;
  cost_price: string;
  selling_price: string;
  currency: string;
  barcode?: string;
  is_active: boolean;
  storefront_listing_id?: number | null;   // first marketplace Listing for this item, or null
}

export interface MovementRow {
  id: number;
  item: number;
  item_name: string;
  item_sku: string;
  type: 'in' | 'out' | 'adjust';
  qty: string;
  qty_before: string;
  qty_after: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/inventory/workspaces/${workspaceId}`;
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

function crud<TRow>(resource: string) {
  return {
    list: (workspaceId: Id, params?: Params) => httpGet<TRow[]>(`${base(workspaceId)}/${resource}/`, params),
    get: (workspaceId: Id, id: Id) => httpGet<TRow>(`${base(workspaceId)}/${resource}/${id}/`),
    create: (workspaceId: Id, payload: Payload) => httpPost<TRow>(`${base(workspaceId)}/${resource}/`, payload),
    update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<TRow>(`${base(workspaceId)}/${resource}/${id}/`, payload),
    remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/${resource}/${id}/`),
  };
}

export const InventoryService = {
  categories: crud<CategoryRow>('categories'),
  items: crud<ItemRow>('items'),
  listMovements: (workspaceId: Id, params?: Params) => httpGet<MovementRow[]>(`${base(workspaceId)}/movements/`, params),
  recordMovement: (workspaceId: Id, payload: Payload) => httpPost<MovementRow>(`${base(workspaceId)}/movements/`, payload),
};
