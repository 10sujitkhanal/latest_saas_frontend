import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface POLineRow {
  id?: number;
  item?: number | null;
  item_name?: string;
  item_sku?: string;
  description: string;
  qty: string | number;
  unit_cost: string | number;
  total?: string;
}

export interface PurchaseOrderRow {
  id: number;
  po_no: string;
  vendor: number;
  vendor_name: string;
  order_date: string;
  expected_date?: string | null;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  currency: string;
  subtotal: string;
  total: string;
  notes?: string;
  received_at?: string | null;
  bill?: number | null;
  bill_no?: string;
  lines: POLineRow[];
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/purchasing/workspaces/${workspaceId}`;
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

export const PurchasingService = {
  list: (workspaceId: Id, params?: Params) => httpGet<PurchaseOrderRow[]>(`${base(workspaceId)}/purchase-orders/`, params),
  get: (workspaceId: Id, id: Id) => httpGet<PurchaseOrderRow>(`${base(workspaceId)}/purchase-orders/${id}/`),
  create: (workspaceId: Id, payload: Payload) => httpPost<PurchaseOrderRow>(`${base(workspaceId)}/purchase-orders/`, payload),
  update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<PurchaseOrderRow>(`${base(workspaceId)}/purchase-orders/${id}/`, payload),
  remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/purchase-orders/${id}/`),
  send: (workspaceId: Id, id: Id) => httpPost<PurchaseOrderRow>(`${base(workspaceId)}/purchase-orders/${id}/send/`),
  cancel: (workspaceId: Id, id: Id) => httpPost<PurchaseOrderRow>(`${base(workspaceId)}/purchase-orders/${id}/cancel/`),
  receive: (workspaceId: Id, id: Id) => httpPost<PurchaseOrderRow>(`${base(workspaceId)}/purchase-orders/${id}/receive/`),
  createBill: (workspaceId: Id, id: Id) => httpPost<PurchaseOrderRow>(`${base(workspaceId)}/purchase-orders/${id}/create-bill/`),
};
