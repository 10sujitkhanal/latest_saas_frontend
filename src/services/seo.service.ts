import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> { success: boolean; message?: string; data: T; errors?: Record<string, unknown>; }
type Id = string | number;
type Payload = Record<string, unknown>;

async function g<T>(u: string, params?: Payload) { const { data } = await apiClient.get<ApiEnvelope<T>>(u, { params }); return data; }
async function p<T>(u: string, payload: Payload = {}) { const { data } = await apiClient.post<ApiEnvelope<T>>(u, payload); return data; }

function base(ws: Id) { return `/organization/agents/workspaces/${ws}/seo`; }

export interface SeoScores { technical_seo: number; content: number; local_seo: number; aeo: number; overall: number; }
export interface SeoIssue {
  severity: 'fail' | 'warn'; check: string; message: string; fix: string;
  target_type: string; target_id: number | null; target_label: string;
}
export interface SeoAudit {
  scores: SeoScores; issues: SeoIssue[];
  summary: { posts_audited: number; listings_audited: number; issues: number; fails: number; warns: number };
}
export interface AgentTaskRow {
  id: number; kind: string; title: string; goal: string;
  status: 'proposed' | 'executed' | 'rejected' | 'failed';
  proposal: Record<string, unknown>; result: Record<string, unknown>;
  error?: string; created_at: string; executed_at: string | null;
}

export interface BusinessHour { day: number; open: string; close: string; closed: boolean }
export interface BusinessProfile {
  id: number; name: string; description: string; primary_category: string; secondary_categories: string[];
  phone: string; website: string; street: string; city: string; region: string; postal_code: string; country: string;
  latitude: number | null; longitude: number | null; hours: BusinessHour[]; attributes: Record<string, unknown>;
  source: 'manual' | 'gbp'; gbp_location_id: string; last_synced_at: string | null;
  is_connected: boolean; full_address: string;
}

export interface ManagerNextAction { priority: 'high' | 'medium' | 'low'; label: string; where: string }
export interface ManagerSummary {
  headline: string; pending_total: number; pending_by_agent: Record<string, number>;
  seo: { overall: number; fails: number };
  agents: { type: string; label: string; recent_7d: number; pending: number; last_action: string; last_at: string | null }[];
  next_actions: ManagerNextAction[];
}

export interface Review {
  id: number; platform: string; external_id: string; author_name: string; rating: number; text: string;
  reply_text: string; reply_status: 'none' | 'drafted' | 'published'; replied_at: string | null;
  reviewed_at: string | null; created_at: string;
}
export interface PendingReply { task_id: number; review_id: number; reply_text: string }
export interface Connection {
  id: number; provider: 'google_business' | 'meta'; status: 'disconnected' | 'pending' | 'connected' | 'error';
  account_id: string; location_id: string; error_message: string; last_synced_at: string | null; is_connected: boolean;
}

export const SeoService = {
  audit: (ws: Id) => g<SeoAudit>(`${base(ws)}/audit/`),
  profile: {
    get: (ws: Id) => g<BusinessProfile>(`${base(ws)}/business-profile/`),
    save: (ws: Id, payload: Payload) => { return apiClient.put<ApiEnvelope<BusinessProfile>>(`${base(ws)}/business-profile/`, payload).then((r) => r.data); },
  },
  draftBlog: (ws: Id, goal: string, focus_keyword?: string) =>
    p<{ task: AgentTaskRow }>(`${base(ws)}/blog-draft/`, { goal, focus_keyword }),
  draftSocial: (ws: Id, goal: string, platform: string) =>
    p<{ task: AgentTaskRow }>(`/organization/agents/workspaces/${ws}/social/draft/`, { goal, platform }),
  manager: (ws: Id) => g<ManagerSummary>(`/organization/agents/workspaces/${ws}/manager/summary/`),
  reviews: {
    list: (ws: Id) => g<{ reviews: Review[]; pending_replies: PendingReply[] }>(`${base(ws)}/reviews/`),
    add: (ws: Id, payload: { author_name: string; rating: number; text: string }) => p<Review>(`${base(ws)}/reviews/`, payload),
    draftReply: (ws: Id, reviewId: Id) => p<{ task: AgentTaskRow }>(`${base(ws)}/reviews/${reviewId}/draft-reply/`),
    approveReply: (ws: Id, taskId: Id, reply_text?: string) => p<{ review: Review }>(`${base(ws)}/review-replies/${taskId}/approve/`, reply_text ? { reply_text } : {}),
    rejectReply: (ws: Id, taskId: Id) => p<{ task: AgentTaskRow }>(`${base(ws)}/tasks/${taskId}/reject/`),
  },
  connections: {
    list: (ws: Id) => g<{ connections: Connection[]; gbp_enabled: boolean }>(`${base(ws)}/connections/`),
    connect: (ws: Id, provider: string) => p<{ authorize_url?: string; connection?: Connection }>(`${base(ws)}/connections/${provider}/connect/`),
    disconnect: (ws: Id, provider: string) => p<null>(`${base(ws)}/connections/${provider}/disconnect/`),
    sync: (ws: Id, provider: string) => p<unknown>(`${base(ws)}/connections/${provider}/sync/`),
  },
  enrichAeo: (ws: Id, post_id: Id) =>
    p<{ task: AgentTaskRow }>(`${base(ws)}/aeo-enrich/`, { post_id }),
  tasks: (ws: Id, status?: string) => g<AgentTaskRow[]>(`${base(ws)}/tasks/`, status ? { status } : undefined),
  approve: (ws: Id, taskId: Id, proposal?: Record<string, unknown>) =>
    p<{ task: AgentTaskRow; post?: unknown }>(`${base(ws)}/tasks/${taskId}/approve/`, proposal ? { proposal } : {}),
  reject: (ws: Id, taskId: Id) => p<{ task: AgentTaskRow }>(`${base(ws)}/tasks/${taskId}/reject/`, {}),
};
