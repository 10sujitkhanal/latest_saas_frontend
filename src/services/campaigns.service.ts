import { apiClient } from '@/lib/axios';

type Id = string | number;
const base = (workspaceId: Id) => `/organization/campaigns/workspaces/${workspaceId}`;

export interface CampaignBenefit { title: string; desc: string }
export interface CampaignFaq { q: string; a: string }
export interface CampaignContent {
  headline: string; subhead?: string; offer?: string; cta_label?: string;
  benefits?: CampaignBenefit[]; social_proof?: string[]; faq?: CampaignFaq[];
  form_fields?: string[]; theme?: { accent?: string };
}
export interface Campaign {
  id: number; name: string; slug: string; brief: string; content: CampaignContent;
  status: 'draft' | 'published' | 'archived'; visit_count: number; lead_count: number;
  created_at: string; updated_at: string; public_path: string;
}

interface Env<T> { success: boolean; message?: string; data: T }

export const CampaignsService = {
  list: (wsId: Id) =>
    apiClient.get<Env<{ campaigns: Campaign[] }>>(`${base(wsId)}/`).then((r) => r.data),
  create: (wsId: Id, body: { name: string; brief: string }) =>
    apiClient.post<Env<{ campaign: Campaign }>>(`${base(wsId)}/`, body).then((r) => r.data),
  get: (wsId: Id, id: Id) =>
    apiClient.get<Env<{ campaign: Campaign }>>(`${base(wsId)}/${id}/`).then((r) => r.data),
  update: (wsId: Id, id: Id, body: Partial<{ name: string; brief: string; content: CampaignContent }>) =>
    apiClient.patch<Env<{ campaign: Campaign }>>(`${base(wsId)}/${id}/`, body).then((r) => r.data),
  remove: (wsId: Id, id: Id) =>
    apiClient.delete<Env<unknown>>(`${base(wsId)}/${id}/`).then((r) => r.data),
  generate: (wsId: Id, id: Id, brief?: string) =>
    apiClient.post<Env<{ campaign: Campaign }>>(`${base(wsId)}/${id}/generate/`, { brief }).then((r) => r.data),
  publish: (wsId: Id, id: Id) =>
    apiClient.post<Env<{ campaign: Campaign }>>(`${base(wsId)}/${id}/publish/`, {}).then((r) => r.data),
};

/** Public landing page (no auth) — used by /c/[slug]. */
export const PublicCampaignsService = {
  get: (slug: string) =>
    apiClient.get<Env<{ name: string; content: CampaignContent }>>(`/public/campaign/${slug}/`).then((r) => r.data),
  submit: (slug: string, body: Record<string, string>) =>
    apiClient.post<Env<unknown>>(`/public/campaign/${slug}/`, body).then((r) => r.data),
};
