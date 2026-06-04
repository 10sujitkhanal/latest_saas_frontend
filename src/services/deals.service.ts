import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface CouponRow {
  id: number;
  code: string;
  description?: string;
  type: 'percent' | 'flat' | 'free_delivery' | 'buy_x_get_y';
  value: string;
  min_order_amount: string;
  max_discount?: string | null;
  usage_limit?: number | null;
  used_count: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'scheduled' | 'expired' | 'paused';
  first_time_only: boolean;
  stackable: boolean;
}

export interface CouponValidation {
  valid: boolean;
  discount: string;
  coupon_id?: number;
  message: string;
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/deals/workspaces/${workspaceId}`;
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

export const DealsService = {
  list: (workspaceId: Id, params?: Params) => httpGet<CouponRow[]>(`${base(workspaceId)}/coupons/`, params),
  get: (workspaceId: Id, id: Id) => httpGet<CouponRow>(`${base(workspaceId)}/coupons/${id}/`),
  create: (workspaceId: Id, payload: Payload) => httpPost<CouponRow>(`${base(workspaceId)}/coupons/`, payload),
  update: (workspaceId: Id, id: Id, payload: Payload) => httpPatch<CouponRow>(`${base(workspaceId)}/coupons/${id}/`, payload),
  remove: (workspaceId: Id, id: Id) => httpDelete<null>(`${base(workspaceId)}/coupons/${id}/`),
  validate: (workspaceId: Id, code: string, amount: number) => httpPost<CouponValidation>(`${base(workspaceId)}/coupons/validate/`, { code, amount }),
};
