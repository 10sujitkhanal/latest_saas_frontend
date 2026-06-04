import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
}

export interface ExpenseCategoryRow {
  id: number;
  name: string;
  description?: string;
  account?: number | null;
  account_name?: string | null;
  is_active: boolean;
}

export interface ExpenseRow {
  id: number;
  expense_no: string;
  title: string;
  category?: number | null;
  category_name?: string | null;
  vendor?: number | null;
  vendor_name?: string | null;
  date: string;
  payment_method: 'cash' | 'company_card' | 'personal_card';
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed';
  subtotal: string;
  tax_total: string;
  total: string;
  submitted_by?: string;
  approved_by?: string;
  notes?: string;
  receipt_url?: string;
  posted_journal_no?: string | null;
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(ws: Id) { return `/organization/expenses/workspaces/${ws}`; }
async function g<T>(url: string, params?: Params) { const { data } = await apiClient.get<ApiEnvelope<T>>(url, { params }); return data; }
async function p<T>(url: string, payload: Payload = {}) { const { data } = await apiClient.post<ApiEnvelope<T>>(url, payload); return data; }
async function pa<T>(url: string, payload: Payload) { const { data } = await apiClient.patch<ApiEnvelope<T>>(url, payload); return data; }
async function del<T>(url: string) { const { data } = await apiClient.delete<ApiEnvelope<T>>(url); return data; }

export const ExpensesService = {
  categories: {
    list: (ws: Id) => g<ExpenseCategoryRow[]>(`${base(ws)}/categories/`),
    create: (ws: Id, payload: Payload) => p<ExpenseCategoryRow>(`${base(ws)}/categories/`, payload),
    update: (ws: Id, id: Id, payload: Payload) => pa<ExpenseCategoryRow>(`${base(ws)}/categories/${id}/`, payload),
    remove: (ws: Id, id: Id) => del<null>(`${base(ws)}/categories/${id}/`),
  },
  expenses: {
    list: (ws: Id, params?: Params) => g<ExpenseRow[]>(`${base(ws)}/expenses/`, params),
    get: (ws: Id, id: Id) => g<ExpenseRow>(`${base(ws)}/expenses/${id}/`),
    create: (ws: Id, payload: Payload) => p<ExpenseRow>(`${base(ws)}/expenses/`, payload),
    update: (ws: Id, id: Id, payload: Payload) => pa<ExpenseRow>(`${base(ws)}/expenses/${id}/`, payload),
    remove: (ws: Id, id: Id) => del<null>(`${base(ws)}/expenses/${id}/`),
    approve: (ws: Id, id: Id) => p<ExpenseRow>(`${base(ws)}/expenses/${id}/approve/`),
    reject: (ws: Id, id: Id) => p<ExpenseRow>(`${base(ws)}/expenses/${id}/reject/`),
  },
};
