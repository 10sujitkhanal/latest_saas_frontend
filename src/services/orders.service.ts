import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface OrderItemRow {
  id?: number;
  item?: number | null;
  item_name?: string;
  item_sku?: string;
  description: string;
  qty: string | number;
  unit_price: string | number;
  total?: string;
}

export interface OrderRow {
  id: number;
  order_no: string;
  customer?: number | null;
  customer_label?: string;
  customer_name: string;
  order_date: string;
  status: 'draft' | 'confirmed' | 'fulfilled' | 'cancelled';
  currency: string;
  subtotal: string;
  total: string;
  notes?: string;
  fulfilled_at?: string | null;
  invoice?: number | null;
  invoice_no?: string;
  lines: OrderItemRow[];
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/orders/workspaces/${workspaceId}`;
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

export const OrdersService = {
  list: (workspaceId: Id, params?: Params) => httpGet<OrderRow[]>(`${base(workspaceId)}/orders/`, params),
  get: (workspaceId: Id, id: Id) => httpGet<OrderRow>(`${base(workspaceId)}/orders/${id}/`),
  create: (workspaceId: Id, payload: Payload) => httpPost<OrderRow>(`${base(workspaceId)}/orders/`, payload),
  update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<OrderRow>(`${base(workspaceId)}/orders/${id}/`, payload),
  remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/orders/${id}/`),
  confirm: (workspaceId: Id, id: Id) => httpPost<OrderRow>(`${base(workspaceId)}/orders/${id}/confirm/`),
  cancel: (workspaceId: Id, id: Id) => httpPost<OrderRow>(`${base(workspaceId)}/orders/${id}/cancel/`),
  fulfill: (workspaceId: Id, id: Id) => httpPost<OrderRow>(`${base(workspaceId)}/orders/${id}/fulfill/`),
  createInvoice: (workspaceId: Id, id: Id) => httpPost<OrderRow>(`${base(workspaceId)}/orders/${id}/create-invoice/`),
};
