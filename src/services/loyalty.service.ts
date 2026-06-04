import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> { success: boolean; message?: string; data: T; errors?: Record<string, unknown>; }

export interface GiftCardRow {
  id: number; code: string; customer?: number | null; customer_name?: string | null;
  initial_value: string; balance: string; currency: string;
  status: 'active' | 'redeemed' | 'expired' | 'void'; issued_date?: string | null; expiry_date?: string | null; notes?: string;
}
export interface MembershipPlanRow {
  id: number; name: string; description?: string; price: string; currency: string;
  interval: 'monthly' | 'quarterly' | 'yearly' | 'one_time'; benefits?: string; is_active: boolean; is_public?: boolean;
}
export interface MembershipRow {
  id: number; customer: number; customer_name?: string | null; plan: number; plan_name?: string | null;
  member_no: string; start_date: string; end_date?: string | null; status: 'active' | 'expired' | 'cancelled'; auto_renew: boolean;
}
export interface LoyaltyAccountRow {
  id: number; customer: number; customer_name?: string | null; points: number; lifetime_points: number; tier: string;
}
export interface MembershipInsights {
  currency: string;
  active_members: number;
  mrr: string; arr: string;
  new_this_month: number; churned_this_month: number; churn_rate: number;
  auto_renew_count: number; expiring_30d: number;
  by_plan: { plan: string; interval: string; members: number; mrr: string }[];
  upcoming_renewals: { member_no: string; customer: string; plan: string; end_date: string | null; auto_renew: boolean }[];
}

type Params = Record<string, unknown>; type Payload = Record<string, unknown>; type Id = string | number;
function base(ws: Id) { return `/organization/loyalty/workspaces/${ws}`; }
async function g<T>(u: string, params?: Params) { const { data } = await apiClient.get<ApiEnvelope<T>>(u, { params }); return data; }
async function p<T>(u: string, payload: Payload = {}) { const { data } = await apiClient.post<ApiEnvelope<T>>(u, payload); return data; }
async function pa<T>(u: string, payload: Payload) { const { data } = await apiClient.patch<ApiEnvelope<T>>(u, payload); return data; }
async function del<T>(u: string) { const { data } = await apiClient.delete<ApiEnvelope<T>>(u); return data; }

function crud<T>(res: string) {
  return {
    list: (ws: Id, params?: Params) => g<T[]>(`${base(ws)}/${res}/`, params),
    create: (ws: Id, payload: Payload) => p<T>(`${base(ws)}/${res}/`, payload),
    update: (ws: Id, id: Id, payload: Payload) => pa<T>(`${base(ws)}/${res}/${id}/`, payload),
    remove: (ws: Id, id: Id) => del<null>(`${base(ws)}/${res}/${id}/`),
  };
}

export const LoyaltyService = {
  giftCards: { ...crud<GiftCardRow>('gift-cards'), redeem: (ws: Id, id: Id, amount: number | string) => p<GiftCardRow>(`${base(ws)}/gift-cards/${id}/redeem/`, { amount }) },
  plans: crud<MembershipPlanRow>('plans'),
  memberships: {
    ...crud<MembershipRow>('memberships'),
    renew: (ws: Id, id: Id, collectPayment: boolean) =>
      p<MembershipRow & { invoice_no?: string | null }>(`${base(ws)}/memberships/${id}/renew/`, { collect_payment: collectPayment }),
    insights: (ws: Id) => g<MembershipInsights>(`${base(ws)}/memberships/insights/`),
  },
  accounts: { ...crud<LoyaltyAccountRow>('accounts'), points: (ws: Id, id: Id, action: 'earn' | 'redeem', points: number) => p<LoyaltyAccountRow>(`${base(ws)}/accounts/${id}/points/`, { action, points }) },
};
