import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export type QuoteStatus =
  | 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'cancelled' | 'converted';

export interface QuoteLine {
  id?: number;
  item?: number | null;
  item_name?: string;
  item_sku?: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  discount_amount?: string | number;
  tax_amount?: string | number;
  total?: string;
  cost_snapshot?: string | number;
  internal_note?: string;
}

export interface QuoteRow {
  id: number;
  quote_no: string;
  public_token: string;
  lead?: number | null;
  lead_name?: string;
  accounting_customer?: number | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  status: QuoteStatus;
  currency: string;
  issue_date: string;
  valid_until?: string | null;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  system_description?: string;
  terms?: string;
  notes?: string;
  internal_notes?: string;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  converted_invoice?: number | null;
  converted_invoice_no?: string;
  is_editable: boolean;
  lines: QuoteLine[];
  created_at: string;
  updated_at: string;
}

export interface ConvertResult {
  quote: QuoteRow;
  invoice_id: number;
  invoice_no: string;
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/sales/workspaces/${workspaceId}`;
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

export const SalesService = {
  list: (workspaceId: Id, params?: Params) => httpGet<QuoteRow[]>(`${base(workspaceId)}/quotes/`, params),
  get: (workspaceId: Id, id: Id) => httpGet<QuoteRow>(`${base(workspaceId)}/quotes/${id}/`),
  create: (workspaceId: Id, payload: Payload) => httpPost<QuoteRow>(`${base(workspaceId)}/quotes/`, payload),
  update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<QuoteRow>(`${base(workspaceId)}/quotes/${id}/`, payload),
  remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/quotes/${id}/`),
  setStatus: (workspaceId: Id, id: Id, status: QuoteStatus) =>
    httpPost<QuoteRow>(`${base(workspaceId)}/quotes/${id}/status/`, { status }),
  convert: (workspaceId: Id, id: Id) => httpPost<ConvertResult>(`${base(workspaceId)}/quotes/${id}/convert/`),
  pdf: (workspaceId: Id, id: Id) => httpGet<{ pdf_data_url: string; filename: string }>(`${base(workspaceId)}/quotes/${id}/pdf/`),
  email: (workspaceId: Id, id: Id, acceptUrl: string) =>
    httpPost<QuoteRow>(`${base(workspaceId)}/quotes/${id}/email/`, { accept_url: acceptUrl }),
};
