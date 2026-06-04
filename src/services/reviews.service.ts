import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> { success: boolean; message?: string; data: T; errors?: Record<string, unknown>; }

export interface ReviewRow {
  id: number; customer_name: string; rating: number; text?: string; date: string;
  source: 'moredealsx' | 'google' | 'facebook' | 'direct';
  sentiment: 'positive' | 'neutral' | 'negative';
  replied: boolean; reply?: string; reply_date?: string | null; helpful: number; tags?: string[];
}
export interface FeedbackRow {
  id: number; customer_name?: string; category: string; rating: number; comment?: string; date: string; resolved: boolean;
}

type Params = Record<string, unknown>; type Payload = Record<string, unknown>; type Id = string | number;
function base(ws: Id) { return `/organization/reviews/workspaces/${ws}`; }
async function g<T>(u: string, params?: Params) { const { data } = await apiClient.get<ApiEnvelope<T>>(u, { params }); return data; }
async function p<T>(u: string, payload: Payload = {}) { const { data } = await apiClient.post<ApiEnvelope<T>>(u, payload); return data; }
async function pa<T>(u: string, payload: Payload) { const { data } = await apiClient.patch<ApiEnvelope<T>>(u, payload); return data; }
async function del<T>(u: string) { const { data } = await apiClient.delete<ApiEnvelope<T>>(u); return data; }

export const ReviewsService = {
  reviews: {
    list: (ws: Id, params?: Params) => g<ReviewRow[]>(`${base(ws)}/reviews/`, params),
    create: (ws: Id, payload: Payload) => p<ReviewRow>(`${base(ws)}/reviews/`, payload),
    update: (ws: Id, id: Id, payload: Payload) => pa<ReviewRow>(`${base(ws)}/reviews/${id}/`, payload),
    remove: (ws: Id, id: Id) => del<null>(`${base(ws)}/reviews/${id}/`),
    reply: (ws: Id, id: Id, reply: string) => p<ReviewRow>(`${base(ws)}/reviews/${id}/reply/`, { reply }),
  },
  feedback: {
    list: (ws: Id, params?: Params) => g<FeedbackRow[]>(`${base(ws)}/feedback/`, params),
    create: (ws: Id, payload: Payload) => p<FeedbackRow>(`${base(ws)}/feedback/`, payload),
    update: (ws: Id, id: Id, payload: Payload) => pa<FeedbackRow>(`${base(ws)}/feedback/${id}/`, payload),
    remove: (ws: Id, id: Id) => del<null>(`${base(ws)}/feedback/${id}/`),
  },
};
